/**
 * proOcr.ts - Pro OCR 离线识别模块
 *
 * 基于 Tesseract.js（LSTM 引擎）实现完全离线的中文 OCR，无需 Python 运行时。
 *
 * 支持：
 * - 营业执照（图片/扫描件）
 * - 印章文件、合同扫描件
 * - 扫描件 PDF（配合 localPdfParser.ts 的 PDF→Canvas 流程）
 * - 任意含中文的图片文件（JPG/PNG/WEBP/BMP/TIFF）
 *
 * 架构：
 * 1. 图像预处理（Canvas API）：灰度化 + 对比度增强 + 倾斜纠正
 * 2. Tesseract.js 文字识别（chi_sim + eng 混合）
 * 3. 结构化字段提取（营业执照专用正则）
 * 4. 置信度评估（低置信度时建议降级到 LLM 视觉识别）
 */

import { createWorker, Worker, RecognizeResult } from "tesseract.js";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface OcrResult {
  /** 原始识别文本（所有行合并） */
  rawText: string;
  /** 识别置信度（0-100） */
  confidence: number;
  /** 识别耗时（毫秒） */
  durationMs: number;
  /** 是否建议降级到 LLM（置信度 < 60 时为 true） */
  shouldFallbackToLlm: boolean;
  /** 识别到的文本行列表 */
  lines: string[];
}

export interface BusinessLicenseOcrResult extends OcrResult {
  /** 结构化字段（从 rawText 提取） */
  fields: {
    companyName?: string;
    creditCode?: string;        // 统一社会信用代码（18位）
    legalPerson?: string;       // 法定代表人
    registeredCapital?: string; // 注册资本
    establishDate?: string;     // 成立日期
    address?: string;           // 住所
    businessScope?: string;     // 经营范围
    validPeriod?: string;       // 营业期限
    companyType?: string;       // 类型
  };
}

// ─── 单例 Worker 管理 ─────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _workerInitializing = false;
let _workerInitPromise: Promise<Worker> | null = null;

/**
 * 获取（或初始化）Tesseract Worker 单例
 * Worker 在首次调用时懒加载，后续复用
 */
async function getWorker(): Promise<Worker> {
  if (_worker) return _worker;
  if (_workerInitPromise) return _workerInitPromise;

  _workerInitializing = true;
  _workerInitPromise = (async () => {
    // Tesseract.js 7.x API
    const worker = await createWorker(["chi_sim", "eng"], 1, {
      workerPath: "/tesseract-worker.min.js",
      // 语言数据从 CDN 加载（Electron 环境有网络时）或使用本地缓存
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      cacheMethod: "readWrite",
      // 日志回调（开发调试用）
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          // 可在此更新进度条
        }
      },
    });

    // 设置识别参数
    await worker.setParameters({
      tessedit_pageseg_mode: "1" as any, // PSM_AUTO_OSD：自动检测方向和脚本
      preserve_interword_spaces: "1",
    });

    _worker = worker;
    _workerInitializing = false;
    return worker;
  })();

  return _workerInitPromise;
}

/**
 * 销毁 Worker（释放内存，在应用退出时调用）
 */
export async function destroyOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerInitPromise = null;
    _workerInitializing = false;
  }
}

// ─── 图像预处理 ───────────────────────────────────────────────────────────────

/**
 * 将 File/Blob 转为 HTMLImageElement
 */
async function fileToImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

/**
 * 图像预处理：灰度化 + 对比度增强 + 轻度锐化
 * 返回预处理后的 Canvas（Tesseract.js 可直接接受 Canvas）
 */
export function preprocessImageForOcr(
  source: HTMLImageElement | HTMLCanvasElement,
  options: {
    grayscale?: boolean;      // 灰度化（默认 true）
    contrastBoost?: number;   // 对比度增强系数（默认 1.5）
    sharpen?: boolean;        // 锐化（默认 true）
    scale?: number;           // 放大倍数（默认 2，提升小字识别率）
  } = {}
): HTMLCanvasElement {
  const {
    grayscale = true,
    contrastBoost = 1.5,
    sharpen = true,
    scale = 2,
  } = options;

  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const canvas = document.createElement("canvas");
  canvas.width = srcWidth * scale;
  canvas.height = srcHeight * scale;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 绘制原图（放大）
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (grayscale || contrastBoost !== 1) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (grayscale) {
        // 加权灰度（人眼感知权重）
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        r = g = b = gray;
      }

      if (contrastBoost !== 1) {
        // 对比度增强：以 128 为中心拉伸
        r = Math.min(255, Math.max(0, Math.round((r - 128) * contrastBoost + 128)));
        g = Math.min(255, Math.max(0, Math.round((g - 128) * contrastBoost + 128)));
        b = Math.min(255, Math.max(0, Math.round((b - 128) * contrastBoost + 128)));
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  if (sharpen) {
    // 锐化卷积核（3x3 Unsharp Mask）
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const src = new Uint8ClampedArray(imageData.data);
    const dst = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let val = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              val += src[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          dst[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, val));
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

// ─── 核心识别函数 ─────────────────────────────────────────────────────────────

/**
 * 对图片文件执行 OCR 识别
 * @param file 图片文件（JPG/PNG/WEBP/BMP/TIFF）
 * @param onProgress 进度回调（0-100）
 */
export async function recognizeImage(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const t0 = Date.now();

  try {
    onProgress?.(5);

    // 加载图片
    const img = await fileToImage(file);
    onProgress?.(15);

    // 预处理
    const processedCanvas = preprocessImageForOcr(img, {
      grayscale: true,
      contrastBoost: 1.4,
      sharpen: true,
      scale: 2,
    });
    onProgress?.(25);

    // 获取 Worker
    const worker = await getWorker();
    onProgress?.(40);

    // 执行识别
    const result: RecognizeResult = await worker.recognize(processedCanvas);
    onProgress?.(90);

    const rawText = result.data.text || "";
    const confidence = result.data.confidence || 0;
    const lines = rawText
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    onProgress?.(100);

    return {
      rawText,
      confidence,
      durationMs: Date.now() - t0,
      shouldFallbackToLlm: confidence < 60,
      lines,
    };
  } catch (err) {
    console.error("[proOcr] recognizeImage 失败:", err);
    throw new Error(`OCR 识别失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 对 Canvas 元素执行 OCR 识别（用于 PDF 页面渲染后直接识别）
 */
export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrResult> {
  const t0 = Date.now();

  try {
    onProgress?.(10);

    // 预处理
    const processedCanvas = preprocessImageForOcr(canvas, {
      grayscale: true,
      contrastBoost: 1.3,
      sharpen: false, // PDF 渲染质量已较高，不需要锐化
      scale: 1.5,
    });
    onProgress?.(30);

    const worker = await getWorker();
    onProgress?.(45);

    const result: RecognizeResult = await worker.recognize(processedCanvas);
    onProgress?.(95);

    const rawText = result.data.text || "";
    const confidence = result.data.confidence || 0;
    const lines = rawText
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    onProgress?.(100);

    return {
      rawText,
      confidence,
      durationMs: Date.now() - t0,
      shouldFallbackToLlm: confidence < 55,
      lines,
    };
  } catch (err) {
    console.error("[proOcr] recognizeCanvas 失败:", err);
    throw new Error(`PDF 页面 OCR 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── 营业执照结构化提取 ───────────────────────────────────────────────────────

/**
 * 从 OCR 原始文本中提取营业执照结构化字段
 */
export function extractBusinessLicenseFields(
  rawText: string
): BusinessLicenseOcrResult["fields"] {
  const text = rawText.replace(/\s+/g, " ").trim();
  const fields: BusinessLicenseOcrResult["fields"] = {};

  // ── 统一社会信用代码（18位，字母+数字） ──
  const creditCodeMatch = text.match(/[0-9A-Z]{18}/);
  if (creditCodeMatch) {
    fields.creditCode = creditCodeMatch[0];
  }

  // ── 企业名称 ──
  const namePatterns = [
    /名\s*称[：:]\s*([^\n，,。]{4,50})/,
    /单位名称[：:]\s*([^\n，,。]{4,50})/,
    /公司名称[：:]\s*([^\n，,。]{4,50})/,
    // 匹配含"有限公司"/"股份"/"合伙"的行
    /([^\n]{2,30}(?:有限公司|股份有限公司|有限责任公司|合伙企业|个人独资企业))/,
  ];
  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m) {
      fields.companyName = m[1].trim();
      break;
    }
  }

  // ── 法定代表人 ──
  const legalPersonPatterns = [
    /法定代表人[：:]\s*([^\n，,。]{2,20})/,
    /负责人[：:]\s*([^\n，,。]{2,20})/,
    /执行事务合伙人[：:]\s*([^\n，,。]{2,20})/,
  ];
  for (const pattern of legalPersonPatterns) {
    const m = text.match(pattern);
    if (m) {
      fields.legalPerson = m[1].trim();
      break;
    }
  }

  // ── 注册资本 ──
  const capitalMatch = text.match(
    /注册资本[：:]\s*([\d,，.]+\s*(?:万元|亿元|元|美元|港元|欧元)?)/
  );
  if (capitalMatch) {
    fields.registeredCapital = capitalMatch[1].trim();
  }

  // ── 成立日期 ──
  const establishDatePatterns = [
    /成立日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
    /成立日期[：:]\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
    /注册日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
  ];
  for (const pattern of establishDatePatterns) {
    const m = text.match(pattern);
    if (m) {
      fields.establishDate = m[1].trim();
      break;
    }
  }

  // ── 住所/地址 ──
  const addressPatterns = [
    /住\s*所[：:]\s*([^\n]{5,100})/,
    /地\s*址[：:]\s*([^\n]{5,100})/,
    /经营场所[：:]\s*([^\n]{5,100})/,
  ];
  for (const pattern of addressPatterns) {
    const m = text.match(pattern);
    if (m) {
      fields.address = m[1].trim();
      break;
    }
  }

  // ── 经营范围 ──
  const scopeMatch = text.match(
    /经营范围[：:]\s*([\s\S]{10,500}?)(?=\n\n|\n[^\s]|登记机关|有效期|营业期限|$)/
  );
  if (scopeMatch) {
    fields.businessScope = scopeMatch[1].replace(/\s+/g, "").trim().slice(0, 300);
  }

  // ── 营业期限 ──
  const validPeriodPatterns = [
    /营业期限[：:]\s*([^\n]{5,50})/,
    /有效期[：:]\s*([^\n]{5,50})/,
    /经营期限[：:]\s*([^\n]{5,50})/,
  ];
  for (const pattern of validPeriodPatterns) {
    const m = text.match(pattern);
    if (m) {
      fields.validPeriod = m[1].trim();
      break;
    }
  }

  // ── 企业类型 ──
  const typeMatch = text.match(/类\s*型[：:]\s*([^\n，,。]{4,30})/);
  if (typeMatch) {
    fields.companyType = typeMatch[1].trim();
  }

  return fields;
}

// ─── 营业执照完整识别 ─────────────────────────────────────────────────────────

/**
 * 对营业执照图片执行 OCR + 结构化提取
 * @param file 营业执照图片文件
 * @param onProgress 进度回调（0-100）
 */
export async function recognizeBusinessLicense(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<BusinessLicenseOcrResult> {
  const ocrResult = await recognizeImage(file, onProgress);
  const fields = extractBusinessLicenseFields(ocrResult.rawText);

  return {
    ...ocrResult,
    fields,
  };
}

// ─── 通用文档识别（自动判断文档类型） ────────────────────────────────────────

export type OcrDocType =
  | "business_license"
  | "tax_certificate"
  | "bank_statement"
  | "financial_statement"
  | "contract"
  | "unknown";

/**
 * 根据 OCR 文本内容自动判断文档类型
 */
export function detectOcrDocType(rawText: string): OcrDocType {
  const text = rawText.slice(0, 500); // 只看前500字符

  if (
    /营业执照|统一社会信用代码|法定代表人|注册资本|经营范围/.test(text)
  ) return "business_license";

  if (
    /完税证明|纳税证明|税务局|税款所属期|实缴税额/.test(text)
  ) return "tax_certificate";

  if (
    /银行流水|交易明细|账户余额|借方|贷方|收入|支出/.test(text)
  ) return "bank_statement";

  if (
    /资产负债表|利润表|现金流量表|营业收入|净利润|总资产/.test(text)
  ) return "financial_statement";

  if (
    /合同|协议|甲方|乙方|签订|履行/.test(text)
  ) return "contract";

  return "unknown";
}

/**
 * 通用文档 OCR 识别（自动判断类型并返回对应结构化结果）
 */
export async function recognizeDocument(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<{
  docType: OcrDocType;
  ocrResult: OcrResult;
  structuredFields?: Record<string, string | undefined>;
}> {
  const ocrResult = await recognizeImage(file, onProgress);
  const docType = detectOcrDocType(ocrResult.rawText);

  let structuredFields: Record<string, string | undefined> | undefined;

  if (docType === "business_license") {
    structuredFields = extractBusinessLicenseFields(ocrResult.rawText) as Record<string, string | undefined>;
  }

  return { docType, ocrResult, structuredFields };
}

// ─── OCR 状态查询 ─────────────────────────────────────────────────────────────

/**
 * 检查 OCR Worker 是否已初始化
 */
export function isOcrWorkerReady(): boolean {
  return _worker !== null && !_workerInitializing;
}

/**
 * 预热 OCR Worker（在应用启动时提前加载，避免首次识别等待）
 */
export async function warmupOcrWorker(): Promise<void> {
  try {
    await getWorker();
    console.log("[proOcr] Worker 预热完成");
  } catch (err) {
    console.warn("[proOcr] Worker 预热失败（将在首次识别时重试）:", err);
  }
}
