import { contextBridge, ipcRenderer } from "electron";

// ─── 暴露给渲染进程的安全 API ──────────────────────────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {
  // 文件系统
  openFiles: (options?: { multiple?: boolean; accept?: string[] }) =>
    ipcRenderer.invoke("dialog:openFiles", options),
  readFile: (filePath: string) =>
    ipcRenderer.invoke("fs:readFile", filePath),

  // SQLite 数据库（通过文件读写）
  dbReadFile: () =>
    ipcRenderer.invoke("db:readFile"),
  dbWriteFile: (base64Data: string) =>
    ipcRenderer.invoke("db:writeFile", base64Data),

  // JSON 导出
  exportSaveJson: (payload: { filename: string; data: unknown }) =>
    ipcRenderer.invoke("export:saveJson", payload),
  exportSaveAs: (payload: { defaultName: string; data: unknown }) =>
    ipcRenderer.invoke("export:saveAs", payload),
  exportOpenDir: () =>
    ipcRenderer.invoke("export:openDir"),

  // 历史记录
  historyLoad: () =>
    ipcRenderer.invoke("history:load"),
  historySave: (records: unknown[]) =>
    ipcRenderer.invoke("history:save", records),

  // 系统信息
  systemInfo: () =>
    ipcRenderer.invoke("system:info"),

  // 外部链接
  openExternal: (url: string) =>
    ipcRenderer.invoke("shell:openExternal", url),
});

// ─── 类型声明（供 TypeScript 使用） ──────────────────────────────────────────
export type ElectronAPI = {
  openFiles: (options?: { multiple?: boolean; accept?: string[] }) => Promise<string[]>;
  readFile: (filePath: string) => Promise<{
    success: boolean;
    data?: string;
    size?: number;
    name?: string;
    ext?: string;
    error?: string;
  }>;
  dbReadFile: () => Promise<{ success: boolean; data: string | null; error?: string }>;
  dbWriteFile: (base64Data: string) => Promise<{ success: boolean; error?: string }>;
  exportSaveJson: (payload: { filename: string; data: unknown }) => Promise<{ success: boolean; path?: string; error?: string }>;
  exportSaveAs: (payload: { defaultName: string; data: unknown }) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  exportOpenDir: () => Promise<{ success: boolean }>;
  historyLoad: () => Promise<{ success: boolean; data: unknown[]; error?: string }>;
  historySave: (records: unknown[]) => Promise<{ success: boolean; error?: string }>;
  systemInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
    dataDir: string;
    exportDir: string;
    nodeVersion: string;
    electronVersion: string;
  }>;
  openExternal: (url: string) => Promise<{ success: boolean }>;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
