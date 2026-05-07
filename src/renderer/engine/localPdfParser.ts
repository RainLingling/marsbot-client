/**
 * 本地离线 PDF 解析器（渲染进程版）
 *
 * 架构：
 *   1. PDF.js 文本提取层 → 数字版 PDF 直接提取文本
 *   2. 规则解析层 → 正则 + 关键词匹配提取结构化字段
 *   3. LLM 兜底层 → 文本提取后调用用户配置的 LLM API
 *
 * 支持文档类型：
 *   - business_license  营业执照（PDF/图片）
 *   - financial_report  财务报表 PDF
 *   - audit_report      审计报告 PDF
 *   - bank_statement    银行流水 PDF
 *   - tax_vat           增值税申报表 PDF
 *   - tax_income        企业所得税申报表 PDF
 *   - tax_clearance     完税证明 PDF
 *   - tax_credit        纳税信用等级 PDF
 *   - qualification     资质证书 PDF
 *   - contract          合同 PDF
 *   - （其他）          通用 LLM 提取
 */

// ─── OCR 模块（懒加载） ──────────────────────────────────────────────────────────
let _ocrModule: typeof import('./proOcr') | null = null;
async function getOcrModule() {
  if (!_ocrModule) {
    _ocrModule = await import('./proOcr');
  }
  return _ocrModule;
}

/**
 * 对扫描件 PDF 执行 OCR（渲染每页为 Canvas 后识别）
 */
async function ocrScannedPdf(
  fileUrl: string,
  maxPages: number = 5,
  onProgress?: (progress: number) => void
): Promise<{ fullText: string; confidence: number; pageCount: number }> {
  const pdfjs = await getPdfjs();
  const ocr = await getOcrModule();

  const resp = await fetch(fileUrl);
  const buffer = await resp.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const totalPages = Math.min(pdf.numPages, maxPages);

  const pageTexts: string[] = [];
  let totalConfidence = 0;

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(Math.round((i - 1) / totalPages * 80));
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    const result = await ocr.recognizeCanvas(canvas);
    pageTexts.push(result.rawText);
    totalConfidence += result.confidence;
  }

  onProgress?.(100);
  return {
    fullText: pageTexts.join('\n\n---\n\n'),
    confidence: Math.round(totalConfidence / totalPages),
    pageCount: totalPages,
  };
}

// ─── PDF.js 初始化 ─────────────────────────────────────────────────────────────
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // 使用 CDN worker（避免 Vite 打包 worker 的复杂性）
    // Electron 渲染进程可以访问 node_modules 中的 worker 文件
    const workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  return pdfjsLib;
}

// ─── 核心：PDF 文本提取 ────────────────────────────────────────────────────────

export interface PdfTextResult {
  /** 全文文本（按页拼接，页间用 \n\n--- 分隔） */
  fullText: string;
  /** 按页分割的文本数组 */
  pages: string[];
  /** 总页数 */
  pageCount: number;
  /** 是否为扫描件（文本量极少） */
  isScanned: boolean;
}

/**
 * 从 Blob URL 或普通 URL 提取 PDF 全文
 */
export async function extractPdfText(fileUrl: string): Promise<PdfTextResult> {
  const pdfjs = await getPdfjs();

  // 读取 ArrayBuffer
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Failed to fetch PDF: HTTP ${resp.status}`);
  const buffer = await resp.arrayBuffer();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // 将文本项按位置拼接（保留换行结构）
    const pageText = textContent.items
      .map((item: any) => {
        if ('str' in item) return item.str;
        return '';
      })
      .join(' ')
      .replace(/\s{3,}/g, '\n')  // 多个空格替换为换行
      .trim();
    pages.push(pageText);
  }

  const fullText = pages.join('\n\n---\n\n');
  // 扫描件判断：全文字符数 < 200 且页数 >= 1
  const isScanned = fullText.replace(/\s/g, '').length < 200;

  return { fullText, pages, pageCount, isScanned };
}

// ─── LLM 调用（复用 localStore 的配置）────────────────────────────────────────

interface LlmConfig {
  llmApiKey?: string;
  llmModel?: string;
  llmApiUrl?: string;
}

function getLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem('marsbot_config');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * 调用用户配置的 LLM API 做结构化提取
 * 支持 OpenAI 兼容接口（DeepSeek / 通义千问 / GPT 等）
 */
export async function callLlmForExtraction(
  prompt: string,
  text: string,
  timeoutMs = 60000
): Promise<Record<string, unknown> | null> {
  const config = getLlmConfig();
  if (!config.llmApiKey || !config.llmApiUrl) {
    console.warn('[localPdfParser] LLM not configured, skipping LLM extraction');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(config.llmApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llmApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n以下是从PDF中提取的文本内容：\n\`\`\`\n${text.slice(0, 8000)}\n\`\`\`\n\n请严格按JSON格式返回，不要输出任何其他内容。`,
          },
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!resp.ok) {
      console.error('[localPdfParser] LLM API error:', resp.status);
      return null;
    }

    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed as Record<string, unknown>;
  } catch (e) {
    clearTimeout(timer);
    console.error('[localPdfParser] LLM call failed:', e);
    return null;
  }
}

// ─── 规则解析：营业执照 ────────────────────────────────────────────────────────

const BIZ_LICENSE_FIELDS: Record<string, RegExp[]> = {
  company: [
    /名\s*称[：:]\s*(.+?)(?:\n|统一社会信用代码|类\s*型)/,
    /企业名称[：:]\s*(.+?)(?:\n|统一)/,
  ],
  creditCode: [
    /统一社会信用代码[：:]\s*([A-Z0-9]{18})/,
    /信用代码[：:]\s*([A-Z0-9]{18})/,
    /([A-Z0-9]{18})/,
  ],
  legalPerson: [
    /法定代表人[：:]\s*(.+?)(?:\n|注册资本|成立日期)/,
    /法人[：:]\s*(.+?)(?:\n)/,
  ],
  registeredCapital: [
    /注册资本[：:]\s*(.+?)(?:\n|成立日期|住\s*所)/,
    /实缴资本[：:]\s*(.+?)(?:\n)/,
  ],
  establishDate: [
    /成立日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})/,
    /注册日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})/,
  ],
  address: [
    /住\s*所[：:]\s*(.+?)(?:\n|经营范围|营业期限)/,
    /地\s*址[：:]\s*(.+?)(?:\n|经营范围)/,
  ],
  businessScope: [
    /经营范围[：:]\s*([\s\S]+?)(?:\n\n|\n(?=登记机关|有效期|营业期限))/,
  ],
};

function extractByRegex(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  return null;
}

export function parseBusinessLicenseText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = { dataSource: '营业执照（离线解析）' };
  for (const [field, patterns] of Object.entries(BIZ_LICENSE_FIELDS)) {
    const val = extractByRegex(text, patterns);
    if (val) result[field] = val;
  }
  // 日期格式标准化
  if (result.establishDate) {
    result.establishDate = String(result.establishDate)
      .replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
  }
  return result;
}

// ─── 规则解析：财务报表 / 审计报告 ────────────────────────────────────────────

/**
 * 从 PDF 文本中定位三张表的文本区域
 * 与云端 extractPdfFinancialTables 逻辑对齐
 */
export function extractFinancialTablesFromText(text: string): {
  balanceSheetText: string;
  incomeStatementText: string;
  cashFlowText: string;
} {
  const lines = text.split('\n');

  const findTableRange = (startPattern: RegExp, endPatterns: RegExp[]): [number, number] => {
    let start = -1;
    let end = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (start === -1 && startPattern.test(lines[i])) {
        start = i;
      } else if (start !== -1 && endPatterns.some(p => p.test(lines[i]))) {
        end = i;
        break;
      }
    }
    return [start, end];
  };

  const extractByRange = (start: number, end: number): string => {
    if (start === -1) return '';
    return lines.slice(start, Math.min(end, start + 300)).join('\n');
  };

  // 资产负债表
  const [bsStart, bsEnd] = (() => {
    const [s1, e1] = findTableRange(/合并\s*资产负债表/, [/母公司\s*资产负债表/, /合并\s*利润表/, /合并\s*损益表/]);
    if (s1 !== -1) return [s1, e1];
    const [s2, e2] = findTableRange(/资产负债表\s*[\uff08(]合并[\uff09)]/, [/利润表/, /损益表/, /现金流量表/]);
    if (s2 !== -1) return [s2, e2];
    const [s3, e3] = findTableRange(/^\s*资产负债表\s*$/, [/利润表/, /损益表/, /现金流量表/]);
    if (s3 !== -1) return [s3, e3];
    return findTableRange(/Balance\s*Sheet/i, [/Income\s*Statement/i, /Profit/i]);
  })();

  // 利润表
  const [isStart, isEnd] = (() => {
    const [s1, e1] = findTableRange(/合并\s*利润表/, [/母公司\s*利润表/, /合并\s*现金流量表/, /合并\s*所有者权益变动表/]);
    if (s1 !== -1) return [s1, e1];
    const [s2, e2] = findTableRange(/利润表\s*[\uff08(]合并[\uff09)]/, [/现金流量表/, /所有者权益/]);
    if (s2 !== -1) return [s2, e2];
    const [s3, e3] = findTableRange(/^\s*利润表\s*$/, [/现金流量表/, /所有者权益/]);
    if (s3 !== -1) return [s3, e3];
    const [s4, e4] = findTableRange(/损益表/, [/现金流量表/, /所有者权益/]);
    if (s4 !== -1) return [s4, e4];
    return findTableRange(/Income\s*Statement/i, [/Cash\s*Flow/i, /Equity/i]);
  })();

  // 现金流量表
  const [cfStart, cfEnd] = (() => {
    const [s1, e1] = findTableRange(/合并\s*现金流量表/, [/母公司\s*现金流量表/, /合并\s*所有者权益变动表/, /附注/]);
    if (s1 !== -1) return [s1, e1];
    const [s2, e2] = findTableRange(/现金流量表\s*[\uff08(]合并[\uff09)]/, [/所有者权益变动表/, /附注/]);
    if (s2 !== -1) return [s2, e2];
    const [s3, e3] = findTableRange(/^\s*现金流量表\s*$/, [/所有者权益变动表/, /附注/]);
    if (s3 !== -1) return [s3, e3];
    return findTableRange(/Cash\s*Flow\s*Statement/i, [/Notes/i, /Equity/i]);
  })();

  // 兜底：关键字段行收集
  const fallbackCollect = (fields: string[]): string => {
    const collected = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      if (fields.some(f => lines[i].includes(f))) {
        for (let j = i; j <= Math.min(lines.length - 1, i + 4); j++) {
          collected.add(j);
        }
      }
    }
    return Array.from(collected).sort((a, b) => a - b).map(i => lines[i]).join('\n');
  };

  return {
    balanceSheetText: extractByRange(bsStart, bsEnd) || fallbackCollect([
      '货币资金', '流动资产合计', '非流动资产合计', '资产总计',
      '流动负债合计', '非流动负债合计', '负债合计', '所有者权益合计',
    ]),
    incomeStatementText: extractByRange(isStart, isEnd) || fallbackCollect([
      '营业收入', '营业成本', '净利润', '利润总额',
    ]),
    cashFlowText: extractByRange(cfStart, cfEnd) || fallbackCollect([
      '经营活动产生的现金流量净额', '投资活动产生的现金流量净额',
      '期末现金及现金等价物余额',
    ]),
  };
}

// ─── 规则解析：银行流水 PDF ────────────────────────────────────────────────────

export interface BankStatementPdfResult {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  statementPeriod?: string;
  startDate?: string;
  endDate?: string;
  totalInflow?: number;
  totalOutflow?: number;
  netCashFlow?: number;
  monthlyStats?: Array<{ month: string; inflow: number; outflow: number; balance?: number }>;
  rowCount?: number;
  dataSource: string;
}

/**
 * 从银行流水 PDF 文本中提取月度收支统计
 * 策略：识别交易行（日期 + 金额 + 余额），按月聚合
 */
export function parseBankStatementFromText(text: string): BankStatementPdfResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 账户信息提取
  const accountName = extractByRegex(text, [
    /账户名称[：:]\s*(.+?)(?:\n|账号)/,
    /户\s*名[：:]\s*(.+?)(?:\n|账号)/,
    /开户名[：:]\s*(.+?)(?:\n)/,
  ]);
  const accountNumber = extractByRegex(text, [
    /账\s*号[：:]\s*([\d\s*]{10,})/,
    /卡\s*号[：:]\s*([\d\s*]{10,})/,
  ]);
  const bankName = extractByRegex(text, [
    /开户行[：:]\s*(.+?)(?:\n)/,
    /开户银行[：:]\s*(.+?)(?:\n)/,
    /银行[：:]\s*(.+?)(?:\n)/,
  ]);

  // 交易行识别：格式通常为 "日期 摘要 借方/贷方 余额"
  // 支持多种日期格式：2024-01-15 / 2024/01/15 / 20240115
  const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{8})/;
  const amountPattern = /[\d,，]+\.\d{2}/g;

  const monthlyMap: Record<string, { inflow: number; outflow: number; balance: number; count: number }> = {};
  let totalInflow = 0;
  let totalOutflow = 0;
  let rowCount = 0;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const dateStr = dateMatch[1]
      .replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '')
      .replace(/\//g, '-');
    // 标准化为 YYYY-MM-DD
    let normalDate = dateStr;
    if (/^\d{8}$/.test(dateStr)) {
      normalDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    const month = normalDate.slice(0, 7); // YYYY-MM

    const amounts = line.match(amountPattern);
    if (!amounts || amounts.length < 1) continue;

    // 解析金额（去除逗号）
    const parseAmt = (s: string) => parseFloat(s.replace(/,/g, '').replace(/，/g, ''));

    // 判断收入/支出：通常借方=支出，贷方=收入
    // 简化策略：如果行中包含"收入/贷/入账"关键词则为收入，否则为支出
    const isInflow = /贷方|收入|入账|存入|汇入/.test(line);
    const isOutflow = /借方|支出|转出|付款|汇出/.test(line);

    if (amounts.length >= 2) {
      // 有两个金额：通常是 借方金额 + 余额 或 贷方金额 + 余额
      const amt = parseAmt(amounts[0]);
      const balance = parseAmt(amounts[amounts.length - 1]);

      if (!monthlyMap[month]) {
        monthlyMap[month] = { inflow: 0, outflow: 0, balance: 0, count: 0 };
      }

      if (isInflow || (!isOutflow && amt > 0)) {
        monthlyMap[month].inflow += amt;
        totalInflow += amt;
      } else {
        monthlyMap[month].outflow += amt;
        totalOutflow += amt;
      }
      monthlyMap[month].balance = balance;
      monthlyMap[month].count++;
      rowCount++;
    } else if (amounts.length === 1) {
      const amt = parseAmt(amounts[0]);
      if (!monthlyMap[month]) {
        monthlyMap[month] = { inflow: 0, outflow: 0, balance: 0, count: 0 };
      }
      if (isInflow) {
        monthlyMap[month].inflow += amt;
        totalInflow += amt;
      } else {
        monthlyMap[month].outflow += amt;
        totalOutflow += amt;
      }
      monthlyMap[month].count++;
      rowCount++;
    }
  }

  const monthlyStats = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => ({
      month,
      inflow: Math.round(stats.inflow * 100) / 100,
      outflow: Math.round(stats.outflow * 100) / 100,
      balance: Math.round(stats.balance * 100) / 100,
    }));

  const startDate = monthlyStats[0]?.month;
  const endDate = monthlyStats[monthlyStats.length - 1]?.month;
  const statementPeriod = startDate && endDate ? `${startDate} ~ ${endDate}` : undefined;

  return {
    accountName: accountName || undefined,
    accountNumber: accountNumber?.replace(/\s/g, '') || undefined,
    bankName: bankName || undefined,
    statementPeriod,
    startDate,
    endDate,
    totalInflow: Math.round(totalInflow * 100) / 100,
    totalOutflow: Math.round(totalOutflow * 100) / 100,
    netCashFlow: Math.round((totalInflow - totalOutflow) * 100) / 100,
    monthlyStats,
    rowCount,
    dataSource: '银行流水PDF（离线解析）',
  };
}

// ─── 规则解析：审计报告关键字段 ───────────────────────────────────────────────

export function parseAuditReportText(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = { dataSource: '审计报告（离线解析）' };

  // 审计意见类型
  const opinionPatterns = [
    { pattern: /无保留意见|标准无保留/, value: '无保留意见' },
    { pattern: /带强调事项段的无保留意见/, value: '带强调事项段的无保留意见' },
    { pattern: /保留意见/, value: '保留意见' },
    { pattern: /否定意见/, value: '否定意见' },
    { pattern: /无法表示意见|拒绝表示意见/, value: '无法表示意见' },
  ];
  for (const { pattern, value } of opinionPatterns) {
    if (pattern.test(text)) {
      result.auditOpinion = value;
      break;
    }
  }

  // 审计机构
  result.auditFirm = extractByRegex(text, [
    /会计师事务所[（(](.+?)[)）]/,
    /(.+?会计师事务所)/,
    /审计机构[：:]\s*(.+?)(?:\n)/,
  ]);

  // 审计日期
  result.auditDate = extractByRegex(text, [
    /报告日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
    /(\d{4}年\d{1,2}月\d{1,2}日)/,
  ]);

  // 报告年度
  result.reportYear = extractByRegex(text, [
    /(\d{4})年度财务报表/,
    /截至(\d{4})年12月31日/,
    /(\d{4})年12月31日止/,
  ]);

  // 提取财务表格区域
  const tables = extractFinancialTablesFromText(text);
  result.balanceSheetText = tables.balanceSheetText;
  result.incomeStatementText = tables.incomeStatementText;
  result.cashFlowText = tables.cashFlowText;

  return result;
}

// ─── 规则解析：完税证明 ───────────────────────────────────────────────────────

export function parseTaxClearanceText(text: string): Record<string, unknown> {
  return {
    companyName: extractByRegex(text, [/纳税人名称[：:]\s*(.+?)(?:\n|统一社会信用代码)/, /企业名称[：:]\s*(.+?)(?:\n)/]),
    creditCode: extractByRegex(text, [/统一社会信用代码[：:]\s*([A-Z0-9]{18})/, /纳税人识别号[：:]\s*([A-Z0-9]{15,18})/]),
    taxAuthority: extractByRegex(text, [/主管税务机关[：:]\s*(.+?)(?:\n)/, /税务机关[：:]\s*(.+?)(?:\n)/]),
    clearancePeriod: extractByRegex(text, [/完税期间[：:]\s*(.+?)(?:\n)/, /纳税期间[：:]\s*(.+?)(?:\n)/]),
    issuedDate: extractByRegex(text, [/开具日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/, /日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2})/]),
    hasArrears: /欠税|欠缴/.test(text) && !/无欠税|无欠缴/.test(text),
    dataSource: '完税证明（离线解析）',
  };
}

// ─── 规则解析：纳税信用等级 ───────────────────────────────────────────────────

export function parseTaxCreditText(text: string): Record<string, unknown> {
  return {
    companyName: extractByRegex(text, [/纳税人名称[：:]\s*(.+?)(?:\n)/, /企业名称[：:]\s*(.+?)(?:\n)/]),
    creditCode: extractByRegex(text, [/统一社会信用代码[：:]\s*([A-Z0-9]{18})/, /纳税人识别号[：:]\s*([A-Z0-9]{15,18})/]),
    creditLevel: extractByRegex(text, [/纳税信用级别[：:]\s*([ABCDE])/, /信用等级[：:]\s*([ABCDE])/, /评定结果[：:]\s*([ABCDE])/]),
    evaluationYear: extractByRegex(text, [/(\d{4})年度纳税信用/, /评定年度[：:]\s*(\d{4})/]),
    taxAuthority: extractByRegex(text, [/主管税务机关[：:]\s*(.+?)(?:\n)/]),
    issuedDate: extractByRegex(text, [/开具日期[：:]\s*(\d{4}年\d{1,2}月\d{1,2}日)/]),
    dataSource: '纳税信用等级（离线解析）',
  };
}

// ─── LLM Prompt 模板（与云端保持一致）────────────────────────────────────────

const LLM_PROMPTS: Record<string, string> = {
  business_license: `请识别这份营业执照，提取以下字段并以JSON格式返回：
{
  "company": "企业名称（完整名称）",
  "creditCode": "统一社会信用代码（18位）",
  "legalPerson": "法定代表人姓名",
  "registeredCapital": "注册资本（如：500万元人民币）",
  "establishDate": "成立日期（格式：YYYY-MM-DD）",
  "address": "住所/注册地址",
  "businessScope": "经营范围（简短摘要，不超过100字）"
}
如果某字段无法识别，对应值填null。只返回JSON，不要其他文字。`,

  financial_report: `请从以下财务报表文本中提取三张表的关键数据，金额单位万元，返回JSON：
{
  "summary": "财务状况简评（100字以内）",
  "reportYear": "报告年度（如2024）",
  "reportDate": "报表日期（如2024-12-31）",
  "balanceSheet": {
    "货币资金": null, "应收账款": null, "存货": null,
    "流动资产合计": null, "非流动资产合计": null, "资产总计": null,
    "短期借款": null, "应付账款": null, "流动负债合计": null,
    "长期借款": null, "非流动负债合计": null, "负债合计": null,
    "所有者权益合计": null
  },
  "incomeStatement": {
    "营业收入": null, "营业成本": null, "毛利润": null,
    "营业利润": null, "利润总额": null, "净利润": null
  },
  "cashFlowStatement": {
    "经营活动产生的现金流量净额": null,
    "投资活动产生的现金流量净额": null,
    "筹资活动产生的现金流量净额": null,
    "期末现金及现金等价物余额": null
  }
}
严禁编造数据，找不到的字段填null。`,

  audit_report: `请从以下审计报告文本中提取关键信息，返回JSON：
{
  "auditOpinion": "审计意见类型（无保留意见/保留意见/否定意见/无法表示意见）",
  "auditFirm": "会计师事务所名称",
  "auditDate": "报告日期",
  "reportYear": "审计年度",
  "summary": "审计意见摘要（100字以内）",
  "balanceSheet": {"资产总计": null, "负债合计": null, "所有者权益合计": null},
  "incomeStatement": {"营业收入": null, "净利润": null},
  "cashFlowStatement": {"经营活动产生的现金流量净额": null}
}
严禁编造数据，找不到的字段填null。`,

  bank_statement: `请从以下银行流水文本中提取关键信息，金额单位元，返回JSON：
{
  "accountName": "账户名称",
  "accountNumber": "账号（后4位）",
  "bankName": "开户行",
  "statementPeriod": "流水期间（如202401-202412）",
  "totalInflow": 0,
  "totalOutflow": 0,
  "monthlyStats": [{"month": "2024-01", "inflow": 0, "outflow": 0, "balance": 0}],
  "dataSource": "银行流水"
}
严禁编造数据，找不到的字段填null。`,

  tax_vat: `请从以下增值税申报表文本中提取关键数据，金额单位万元，返回JSON：
{
  "byYear": [{
    "taxYear": "申报年度",
    "taxPeriod": "申报期间",
    "salesRevenue": null,
    "taxableRevenue": null,
    "outputTax": null,
    "inputTax": null,
    "taxPayable": null,
    "taxBurdenRate": null,
    "hasArrears": false
  }],
  "dataSource": "增值税申报表"
}
严禁编造数据，找不到的字段填null。`,

  tax_income: `请从以下企业所得税申报表文本中提取关键数据，金额单位万元，返回JSON：
{
  "byYear": [{
    "taxYear": "申报年度",
    "totalRevenue": null,
    "netProfit": null,
    "taxableIncome": null,
    "taxRate": null,
    "taxPayable": null,
    "effectiveTaxRate": null,
    "hasArrears": false
  }],
  "dataSource": "企业所得税年报"
}
严禁编造数据，找不到的字段填null。`,

  tax_clearance: `请从以下完税证明文本中提取关键信息，返回JSON：
{
  "companyName": null, "creditCode": null, "taxAuthority": null,
  "clearancePeriod": null, "hasArrears": false, "arrearAmount": 0,
  "issuedDate": null, "dataSource": "完税证明"
}
严禁编造数据，找不到的字段填null。`,

  tax_credit: `请从以下纳税信用等级证书文本中提取关键信息，返回JSON：
{
  "companyName": null, "creditCode": null, "creditLevel": null,
  "evaluationYear": null, "taxAuthority": null, "issuedDate": null,
  "dataSource": "纳税信用等级证书"
}
严禁编造数据，找不到的字段填null。`,

  qualification: `请从以下资质证书文本中提取关键信息，返回JSON：
{
  "certName": null, "certNo": null, "certLevel": null,
  "issuingAuthority": null, "issueDate": null, "expiryDate": null,
  "scope": null, "holder": null, "isValid": true,
  "dataSource": "资质证书"
}
严禁编造数据，找不到的字段填null。`,

  contract: `请从以下合同文本中提取关键信息，金额单位万元，返回JSON：
{
  "contractNo": null, "contractDate": null, "contractType": null,
  "partyA": null, "partyB": null, "contractAmount": null,
  "subject": null, "paymentTerms": null, "performancePeriod": null,
  "performanceStatus": null, "dataSource": "合同"
}
严禁编造数据，找不到的字段填null。`,
};

// ─── 主入口：离线 PDF 解析 ─────────────────────────────────────────────────────

export interface LocalPdfParseResult {
  type: string;
  data: Record<string, unknown> | null;
  method: 'rule' | 'llm' | 'rule+llm' | 'scanned_no_llm';
  isScanned: boolean;
  textLength: number;
}

/**
 * 离线解析 PDF 文件
 *
 * 流程：
 *   1. PDF.js 提取文本
 *   2. 规则解析（快速提取已知字段）
 *   3. LLM 兜底（如果配置了 LLM API）
 *   4. 合并结果（规则字段优先，LLM 补充缺失字段）
 */
export async function parseLocalPdf(
  fileUrl: string,
  fileType: string
): Promise<LocalPdfParseResult> {
  // Step 1: 提取 PDF 文本
  let textResult: PdfTextResult;
  try {
    textResult = await extractPdfText(fileUrl);
  } catch (e) {
    console.error('[localPdfParser] PDF text extraction failed:', e);
    return { type: fileType, data: null, method: 'rule', isScanned: false, textLength: 0 };
  }

  const { fullText, isScanned, pages } = textResult;
  const textLength = fullText.length;

  // Step 2: 规则解析
  let ruleResult: Record<string, unknown> = {};
  switch (fileType) {
    case 'business_license':
      ruleResult = parseBusinessLicenseText(fullText);
      break;
    case 'audit_report':
      ruleResult = parseAuditReportText(fullText);
      break;
    case 'financial_report':
      ruleResult = extractFinancialTablesFromText(fullText);
      break;
    case 'bank_statement':
      ruleResult = parseBankStatementFromText(fullText);
      break;
    case 'tax_clearance':
      ruleResult = parseTaxClearanceText(fullText);
      break;
    case 'tax_credit':
      ruleResult = parseTaxCreditText(fullText);
      break;
    default:
      ruleResult = { rawText: fullText.slice(0, 2000), dataSource: fileType };
  }

  // 扫描件处理：优先本地 OCR，再考虑 LLM
  const config = getLlmConfig();
  const hasLlm = !!(config.llmApiKey && config.llmApiUrl);

  if (isScanned) {
    // 尝试本地 OCR（Tesseract.js）
    try {
      const ocrResult = await ocrScannedPdf(fileUrl, 5);
      if (ocrResult.confidence >= 50 && ocrResult.fullText.replace(/\s/g, '').length >= 100) {
        // OCR 成功：用 OCR 文本重新走规则解析
        let ocrRuleResult: Record<string, unknown> = {};
        switch (fileType) {
          case 'business_license': {
            ocrRuleResult = parseBusinessLicenseText(ocrResult.fullText);
            // 额外用专用字段提取器
            const ocr = await getOcrModule();
            const blFields = ocr.extractBusinessLicenseFields(ocrResult.fullText);
            const blMerged = { ...ocrRuleResult };
            for (const [k, v] of Object.entries(blFields)) {
              if (v !== undefined && v !== null && v !== '') blMerged[k] = v;
            }
            return {
              type: fileType,
              data: { ...blMerged, _ocrConfidence: ocrResult.confidence, _method: 'local_ocr' },
              method: 'rule',
              isScanned: true,
              textLength: ocrResult.fullText.length,
            };
          }
          case 'audit_report': ocrRuleResult = parseAuditReportText(ocrResult.fullText); break;
          case 'bank_statement': ocrRuleResult = parseBankStatementFromText(ocrResult.fullText); break;
          case 'tax_clearance': ocrRuleResult = parseTaxClearanceText(ocrResult.fullText); break;
          case 'tax_credit': ocrRuleResult = parseTaxCreditText(ocrResult.fullText); break;
          default: ocrRuleResult = { rawText: ocrResult.fullText.slice(0, 2000), dataSource: fileType };
        }
        return {
          type: fileType,
          data: { ...ocrRuleResult, _ocrConfidence: ocrResult.confidence, _method: 'local_ocr' },
          method: 'rule',
          isScanned: true,
          textLength: ocrResult.fullText.length,
        };
      }
    } catch (ocrErr) {
      console.warn('[localPdfParser] 本地 OCR 失败，降级:', ocrErr);
    }

    // OCR 失败或置信度不足：无 LLM 时返回提示
    if (!hasLlm) {
      return {
        type: fileType,
        data: { ...ruleResult, isScanned: true, note: '扫描件PDF，本地OCR置信度不足，建议配置LLM API以提升准确率' },
        method: 'scanned_no_llm',
        isScanned: true,
        textLength,
      };
    }
  }

  // Step 3: LLM 兜底（文本版 PDF 或扫描件+LLM）
  const prompt = LLM_PROMPTS[fileType] || `请提取这份文件的关键信息，以JSON格式返回。严禁编造数据，找不到的字段填null。`;

  // 对于财务报表/审计报告，只传三张表的文本区域（减少 token）
  let textForLlm = fullText;
  if (fileType === 'financial_report' || fileType === 'audit_report') {
    const tables = extractFinancialTablesFromText(fullText);
    textForLlm = [
      tables.balanceSheetText,
      tables.incomeStatementText,
      tables.cashFlowText,
    ].filter(Boolean).join('\n\n') || fullText;
  }

  let llmResult: Record<string, unknown> | null = null;
  if (hasLlm) {
    llmResult = await callLlmForExtraction(prompt, textForLlm);
  }

  // Step 4: 合并结果
  if (llmResult) {
    // 规则字段优先（更精确），LLM 补充缺失字段
    const merged: Record<string, unknown> = { ...llmResult };
    for (const [k, v] of Object.entries(ruleResult)) {
      if (v !== null && v !== undefined && v !== '') {
        merged[k] = v;
      }
    }
    return {
      type: fileType,
      data: merged,
      method: 'rule+llm',
      isScanned,
      textLength,
    };
  }

  // 仅规则结果
  return {
    type: fileType,
    data: Object.keys(ruleResult).length > 0 ? ruleResult : null,
    method: 'rule',
    isScanned,
    textLength,
  };
}

// ─── 工具：判断是否为 PDF 文件 ─────────────────────────────────────────────────

export function isPdfFile(fileUrl: string, fileName?: string): boolean {
  const urlPath = fileUrl.split('?')[0];
  if (/\.pdf$/i.test(urlPath)) return true;
  if (fileName && /\.pdf$/i.test(fileName)) return true;
  return false;
}

export function isImageFile(fileUrl: string, fileName?: string): boolean {
  const urlPath = fileUrl.split('?')[0];
  if (/\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(urlPath)) return true;
  if (fileName && /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(fileName)) return true;
  return false;
}
