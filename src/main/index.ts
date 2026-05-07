import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from "electron";
import path from "path";
import fs from "fs";
import os from "os";

// ─── 环境检测 ──────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development" && process.env.ELECTRON_DEV === "1";

// ─── 数据目录 ──────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath("userData"), "marsbot-data");
const DB_PATH = path.join(DATA_DIR, "graph.db");
const EXPORT_DIR = path.join(app.getPath("documents"), "Marsbot-Exports");

function ensureDirectories() {
  [DATA_DIR, EXPORT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// ─── 主窗口 ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "Marsbot Client - AI信贷风控分析",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
  });

  // 加载页面
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL("app://marsbot/index.html");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── 注册自定义协议 ──────────────────────────────────────────────────────────────
// 必须在 app.whenReady 之前注册协议方案
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// ─── App 生命周期 ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureDirectories();

  // 注册 app:// 协议，将请求映射到 dist/renderer 目录
  const RENDERER_DIR = path.join(__dirname, "../../renderer");
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = path.join(RENDERER_DIR, url.pathname);
    // 默认加载 index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(RENDERER_DIR, "index.html");
    }
    return net.fetch(`file://${filePath}`);
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ─── IPC: 文件系统 ──────────────────────────────────────────────────────────────

// 打开文件选择对话框
ipcMain.handle("dialog:openFiles", async (_, options?: { multiple?: boolean; accept?: string[] }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: options?.multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [
      { name: "支持的文件", extensions: ["xlsx", "xls", "csv", "pdf", "zip", "json"] },
      { name: "Excel 文件", extensions: ["xlsx", "xls"] },
      { name: "PDF 文件", extensions: ["pdf"] },
      { name: "压缩包", extensions: ["zip"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// 读取文件内容（返回 Buffer 的 base64 编码）
ipcMain.handle("fs:readFile", async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return {
      success: true,
      data: buffer.toString("base64"),
      size: buffer.length,
      name: path.basename(filePath),
      ext: path.extname(filePath).toLowerCase(),
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── IPC: SQLite 图谱数据库 ──────────────────────────────────────────────────────

// 初始化数据库（在渲染进程中用sql.js，主进程只做文件读写）
ipcMain.handle("db:readFile", async () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      return { success: true, data: buffer.toString("base64") };
    }
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle("db:writeFile", async (_, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(DB_PATH, buffer);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── IPC: JSON 导出 ──────────────────────────────────────────────────────────

ipcMain.handle("export:saveJson", async (_, payload: { filename: string; data: unknown }) => {
  try {
    const savePath = path.join(EXPORT_DIR, payload.filename);
    const jsonStr = JSON.stringify(payload.data, null, 2);
    fs.writeFileSync(savePath, jsonStr, "utf-8");
    return { success: true, path: savePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// 打开导出目录
ipcMain.handle("export:openDir", async () => {
  shell.openPath(EXPORT_DIR);
  return { success: true };
});

// 另存为对话框
ipcMain.handle("export:saveAs", async (_, payload: { defaultName: string; data: unknown }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: path.join(EXPORT_DIR, payload.defaultName),
    filters: [{ name: "JSON 文件", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    const jsonStr = JSON.stringify(payload.data, null, 2);
    fs.writeFileSync(result.filePath, jsonStr, "utf-8");
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── IPC: 历史记录 ──────────────────────────────────────────────────────────

const HISTORY_FILE = path.join(DATA_DIR, "history.json");

ipcMain.handle("history:load", async () => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
      return { success: true, data: JSON.parse(raw) };
    }
    return { success: true, data: [] };
  } catch (err) {
    return { success: false, error: String(err), data: [] };
  }
});

ipcMain.handle("history:save", async (_, records: unknown[]) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(records, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── IPC: 系统信息 ──────────────────────────────────────────────────────────

ipcMain.handle("system:info", async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    dataDir: DATA_DIR,
    exportDir: EXPORT_DIR,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  };
});

// 打开外部链接
ipcMain.handle("shell:openExternal", async (_, url: string) => {
  await shell.openExternal(url);
  return { success: true };
});
