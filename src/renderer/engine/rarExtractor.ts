/**
 * rarExtractor.ts - RAR/7z/TAR 解压模块
 * 基于 libarchive.js（WebAssembly 版 libarchive），支持：
 * - RAR v4 / RAR v5
 * - 7-Zip (.7z)
 * - TAR / TAR.GZ / TAR.BZ2
 * - ZIP（作为 JSZip 的补充，处理加密或特殊格式）
 *
 * 使用方式：
 *   import { extractArchive } from "@/engine/rarExtractor";
 *   const files = await extractArchive(rarFile);
 */

export interface ExtractedFile {
  name: string;         // 文件名（不含路径）
  path: string;         // 完整路径（含目录）
  file: File;           // 解压后的 File 对象
  size: number;
}

// libarchive.js worker 路径（Vite 会将 node_modules 中的文件复制到 public）
const WORKER_URL = "/libarchive-worker-bundle.js";

let archiveModule: any = null;

async function getArchiveModule(): Promise<any> {
  if (archiveModule) return archiveModule;
  try {
    const { Archive } = await import("libarchive.js");
    // 尝试初始化 worker（Electron 环境中 worker 可能不可用，降级到同步模式）
    try {
      Archive.init({ workerUrl: WORKER_URL });
    } catch {
      // 静默失败，libarchive.js 会尝试内联 worker
    }
    archiveModule = Archive;
    return Archive;
  } catch (e) {
    throw new Error(`libarchive.js 加载失败: ${e}`);
  }
}

/**
 * 解压 RAR/7z/TAR 等格式的压缩包
 * @param file 压缩包 File 对象
 * @returns 解压后的文件列表
 */
export async function extractArchive(file: File): Promise<ExtractedFile[]> {
  const Archive = await getArchiveModule();

  let archive: any;
  try {
    archive = await Archive.open(file);
  } catch (e) {
    throw new Error(`无法打开压缩包: ${e}`);
  }

  // 获取文件列表（不立即解压）
  let filesArray: Array<{ file: any; path: string }>;
  try {
    filesArray = await archive.getFilesArray();
  } catch (e) {
    throw new Error(`读取压缩包内容失败: ${e}`);
  }

  if (!filesArray || filesArray.length === 0) {
    throw new Error("压缩包为空或无法读取内容");
  }

  const results: ExtractedFile[] = [];

  for (const entry of filesArray) {
    const compressedFile = entry.file;
    const dirPath = entry.path || "";

    // 跳过目录条目
    if (!compressedFile || compressedFile.isDirectory) continue;

    const fileName = compressedFile.name || "unknown";
    const fullPath = dirPath ? `${dirPath}${fileName}` : fileName;

    // 跳过 macOS 元数据
    if (fullPath.startsWith("__MACOSX") || fileName.startsWith(".")) continue;

    try {
      // 解压单个文件
      const extractedFile: File = await compressedFile.extract();
      results.push({
        name: fileName,
        path: fullPath,
        file: extractedFile,
        size: extractedFile.size,
      });
    } catch (e) {
      console.warn(`[rarExtractor] 跳过文件 ${fullPath}: ${e}`);
    }
  }

  return results;
}

/**
 * 检查文件是否为支持的压缩格式（RAR/7z/TAR，不含 ZIP）
 */
export function isRarOrSevenZip(fileName: string): boolean {
  return /\.(rar|7z|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz)$/i.test(fileName);
}

/**
 * 获取压缩格式标签（用于 UI 显示）
 */
export function getArchiveFormatLabel(fileName: string): string {
  if (/\.rar$/i.test(fileName)) return "RAR";
  if (/\.7z$/i.test(fileName)) return "7-Zip";
  if (/\.tar\.gz$|\.tgz$/i.test(fileName)) return "TAR.GZ";
  if (/\.tar\.bz2$|\.tbz2$/i.test(fileName)) return "TAR.BZ2";
  if (/\.tar$/i.test(fileName)) return "TAR";
  return "压缩包";
}
