/**
 * 本地 Excel 解析器（渲染进程版）
 * 从云端 excelParser.ts 移植，替换 Node.js 专属依赖：
 *   - fs.readFileSync → fetch(blobUrl) + ArrayBuffer
 *   - 移除 Python xlrd 子进程（仅支持 xlsx/csv，xls 用 xlsx.js 的兼容模式）
 *   - 移除 downloadToTemp（直接在内存中处理）
 */
import * as XLSX from 'xlsx';

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 从 Blob URL 或普通 URL 读取 ArrayBuffer
 */
async function readFileAsBuffer(fileUrl: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to read file: HTTP ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * 判断文件是否为真正的 xls 格式（BIFF8）
 */
function isTrueXls(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
}

/**
 * 解析 Excel/CSV 文件为二维数组（所有 sheet）
 * 渲染进程版：不支持 Python xlrd，xls 格式也用 xlsx.js 处理
 */
function parseExcelBuffer(buffer: Uint8Array): Array<{ sheetName: string; data: any[][] }> {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    return { sheetName, data };
  });
}

/**
 * 解析数字（去除逗号、空格等格式符号）
 */
function parseNum(val: any): number {
  if (val === '' || val == null) return 0;
  const s = String(val).replace(/,/g, '').replace(/，/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 从日期值中提取月份字符串（YYYY-MM 格式）
 */
function parseMonthFromVal(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().substring(0, 7);
  const s = String(val).trim();
  // 20250402 格式
  const m0 = s.match(/^(20\d{2})(\d{2})\d{2}$/);
  if (m0) return `${m0[1]}-${m0[2]}`;
  // 2025-04-02 或 2025/04/02 格式
  const m1 = s.match(/^(20\d{2})[-\/年](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}`;
  return null;
}

// ─── 银行流水解析 ──────────────────────────────────────────────────────────────

export interface BankStatementResult {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  statementPeriod?: string;
  startDate?: string;
  endDate?: string;
  totalInflow: number;
  totalOutflow: number;
  monthlyStats: Array<{ month: string; inflow: number; outflow: number; balance: number }>;
  openingBalance?: number;
  closingBalance?: number;
  rowCount: number;
  headerRow: string[];
  sampleRows: string[][];
  counterparties?: Array<{ name: string; amount: number; direction: 'in' | 'out'; count: number }>;
}

/**
 * 银行流水 Excel 专用解析：直接用代码统计月度收支，不依赖 LLM
 * 处理全部行（无行数限制），返回结构化月度汇总 + 账户基本信息
 */
export async function parseBankStatementExcel(fileUrl: string): Promise<BankStatementResult> {
  const buffer = await readFileAsBuffer(fileUrl);
  const sheets = parseExcelBuffer(buffer);
  if (!sheets || sheets.length === 0) throw new Error('Empty workbook');
  const jsonData = sheets[0].data;
  if (!jsonData || jsonData.length === 0) throw new Error('Empty sheet');

  // 识别表头行（找包含"日期"/"金额"/"借方"/"贷方"/"交易类型"的行）
  let headerRowIdx = 0;
  const headerKeywords = ['日期', '交易日期', '记账日期', '借方', '贷方', '金额', '收入', '支出', '余额', '摘要', '对手方', '交易类型', 'Transaction'];
  for (let i = 0; i < Math.min(15, jsonData.length); i++) {
    const row = jsonData[i].map((c: any) => String(c).trim());
    const matchCount = headerKeywords.filter(k => row.some((cell: string) => cell.includes(k))).length;
    if (matchCount >= 2) { headerRowIdx = i; break; }
  }
  const headers = jsonData[headerRowIdx].map((c: any) => String(c).trim());

  // 识别关键列索引
  const findCol = (...keywords: string[]): number => {
    // 先尝试精确匹配
    for (const kw of keywords) {
      const idx = headers.findIndex((h: string) => h === kw || h.trim() === kw);
      if (idx >= 0) return idx;
    }
    // 再尝试包含匹配（排除账户信息列）
    for (const kw of keywords) {
      const idx = headers.findIndex((h: string) => {
        if (!h.includes(kw)) return false;
        const isAccountInfoCol = /账号|卡号|行号|行名|开户行|开户机构|支行|网点|证件/.test(h);
        return !isAccountInfoCol;
      });
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = findCol('交易日期', '日期', '记账日期', '发生日期', '业务日期', 'Transaction Date', '记账时间', '交易时间', '入账日期', '起息日期', '起息日', '价值日期');
  const inflowCol = findCol(
    '贷方金额', '贷方发生额', '入账金额', '收入金额', '存入金额',
    '贷方', '收入', '存入', '收款金额', '汇入金额', '转入金额',
    'Credit Amount', 'Credit', 'Cr Amount', '贷'
  );
  const outflowCol = findCol(
    '借方金额', '借方发生额', '出账金额', '支出金额', '付款金额',
    '借方', '支出', '取出', '转出', '汇出金额', '转出金额',
    'Debit Amount', 'Debit', 'Dr Amount', '借'
  );
  const balanceCol = findCol('交易后余额', '账户余额', '账面余额', '余额', '当前余额', '期末余额', 'After-transaction balance', 'Balance', 'Bal');
  const amountCol = (inflowCol < 0 && outflowCol < 0) || (inflowCol >= 0 && outflowCol >= 0 && inflowCol === outflowCol)
    ? findCol('交易金额', '发生额', '金额', '本次发生额', 'Trade Amount', 'Amount', 'Amt')
    : -1;
  const txTypeCol = findCol('交易类型', '借贷标志', '收支标志', '借贷方向', 'Transaction Type', 'Dr/Cr', 'D/C', '借贷');
  const directionCol = (amountCol >= 0 && txTypeCol < 0)
    ? findCol('方向', '收支类型', '收支方向', '类型', 'Direction', '收支')
    : -1;
  const remarkCol = findCol('摘要', '用途', '备注', '交易摘要', '附言', 'Remark', 'Description');
  const counterpartyNameCol = findCol('对方户名', '对手方名称', '对方名称', '收款人名称', '付款人名称', "Payee's Name", "Payer's Name", '对手方');

  // 账户基本信息（从前几行提取）
  let accountName: string | undefined;
  let accountNumber: string | undefined;
  let bankName: string | undefined;
  for (let i = 0; i < Math.min(headerRowIdx + 1, 20); i++) {
    const row = jsonData[i].map((c: any) => String(c).trim()).join(' ');
    if (!accountName && (row.includes('户名') || row.includes('账户名') || row.includes('客户名'))) {
      const m = row.match(/(?:户名|账户名|客户名)[：:\s]*([^\s\t，,]+)/);
      if (m) accountName = m[1];
    }
    if (!accountNumber && (row.includes('账号') || row.includes('卡号'))) {
      const m = row.match(/(?:账号|卡号)[：:\s]*(\d[\d\s*]{6,})/);
      if (m) accountNumber = m[1].replace(/\s/g, '');
    }
    if (!bankName && (row.includes('开户行') || row.includes('银行') || row.includes('支行'))) {
      const m = row.match(/(?:开户行|开户银行)[：:\s]*([^\s\t，,]{4,20})/);
      if (m) bankName = m[1];
    }
  }

  // 逐行统计月度收支
  const monthMap = new Map<string, { inflow: number; outflow: number; lastBalance: number }>();
  const counterpartyMap = new Map<string, { amount: number; direction: 'in' | 'out'; count: number }>();
  let totalInflow = 0;
  let totalOutflow = 0;
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  let rowCount = 0;

  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every((c: any) => String(c).trim() === '')) continue;
    const month = dateCol >= 0 ? parseMonthFromVal(row[dateCol]) : null;
    if (!month) continue;
    rowCount++;

    let inflow = 0;
    let outflow = 0;

    if (inflowCol >= 0 && outflowCol >= 0) {
      const rawIn = parseNum(row[inflowCol]);
      const rawOut = parseNum(row[outflowCol]);
      inflow = rawIn > 0 ? rawIn : 0;
      outflow = rawOut > 0 ? rawOut : 0;
    } else if (inflowCol >= 0 && outflowCol < 0) {
      inflow = Math.abs(parseNum(row[inflowCol]));
    } else if (inflowCol < 0 && outflowCol >= 0) {
      outflow = Math.abs(parseNum(row[outflowCol]));
    } else if (amountCol >= 0) {
      const amt = parseNum(row[amountCol]);
      const absAmt = Math.abs(amt);
      if (txTypeCol >= 0) {
        const txType = String(row[txTypeCol] || '').trim().toUpperCase();
        if (txType.includes('来账') || txType.includes('收') || txType === 'CR' || txType === '贷' || txType === 'C') {
          inflow = absAmt;
        } else if (txType.includes('往账') || txType.includes('支') || txType === 'DR' || txType === '借' || txType === 'D') {
          outflow = absAmt;
        } else if (amt < 0) {
          outflow = absAmt;
        } else {
          inflow = absAmt;
        }
      } else if (directionCol >= 0) {
        const dir = String(row[directionCol] || '').trim();
        if (dir.includes('贷') || dir.includes('收') || dir === '+' || dir === 'CR') inflow = absAmt;
        else if (dir.includes('借') || dir.includes('支') || dir === '-' || dir === 'DR') outflow = absAmt;
        else if (amt < 0) outflow = absAmt;
        else inflow = absAmt;
      } else {
        if (amt < 0) outflow = absAmt;
        else inflow = absAmt;
      }
    }

    const existing = monthMap.get(month) || { inflow: 0, outflow: 0, lastBalance: 0 };
    const balance = balanceCol >= 0 ? Math.abs(parseNum(row[balanceCol])) : 0;
    monthMap.set(month, {
      inflow: existing.inflow + inflow,
      outflow: existing.outflow + outflow,
      lastBalance: balance || existing.lastBalance,
    });
    totalInflow += inflow;
    totalOutflow += outflow;
    if (i === headerRowIdx + 1 && balanceCol >= 0) openingBalance = Math.abs(parseNum(row[balanceCol]));
    if (i === jsonData.length - 1 && balanceCol >= 0) closingBalance = Math.abs(parseNum(row[balanceCol]));

    // 提取对方名称
    if (counterpartyNameCol >= 0) {
      const cpName = String(row[counterpartyNameCol] || '').trim();
      if (cpName && cpName !== accountName && cpName.length > 2) {
        const direction = inflow > 0 ? 'in' : 'out';
        const amount = inflow > 0 ? inflow : outflow;
        const existing = counterpartyMap.get(cpName);
        if (existing) {
          existing.amount += amount;
          existing.count += 1;
        } else {
          counterpartyMap.set(cpName, { amount, direction, count: 1 });
        }
      }
    }
  }

  const monthlyStats = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, inflow: v.inflow, outflow: v.outflow, balance: v.lastBalance }));
  const months = monthlyStats.map(m => m.month);
  const startDate = months.length > 0 ? months[0] : undefined;
  const endDate = months.length > 0 ? months[months.length - 1] : undefined;
  const statementPeriod = startDate && endDate ? `${startDate} ~ ${endDate}` : undefined;
  const sampleRows = jsonData.slice(0, Math.min(headerRowIdx + 6, jsonData.length))
    .map((row: any[]) => row.map((c: any) => String(c).trim()));
  const counterparties = Array.from(counterpartyMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 20)
    .map(([name, v]) => ({ name, ...v }));

  return {
    accountName,
    accountNumber,
    bankName,
    statementPeriod,
    startDate,
    endDate,
    totalInflow,
    totalOutflow,
    monthlyStats,
    openingBalance,
    closingBalance,
    rowCount,
    headerRow: headers,
    sampleRows,
    counterparties: counterparties.length > 0 ? counterparties : undefined,
  };
}

// ─── TOP5 客户/供应商解析 ──────────────────────────────────────────────────────

function extractYearFromTitle(title: string): number | null {
  const m = title.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

export interface Top5CustomerResult {
  byYear: Array<{
    year: number;
    customers: Array<{ rank: number; name: string; amount: string; ratio: string; notes: string }>;
    suppliers: Array<{ rank: number; name: string; amount: string; ratio: string; notes: string }>;
    top5CustomerRatio?: number;
    top5SupplierRatio?: number;
  }>;
}

/**
 * 直接解析 TOP5 客户/供应商 Excel 文件（不走 LLM）
 */
export async function parseTop5CustomerExcel(fileUrl: string): Promise<Top5CustomerResult> {
  const buffer = await readFileAsBuffer(fileUrl);
  const sheets = parseExcelBuffer(buffer);
  const allRows: any[][] = [];
  for (const sheet of sheets) {
    allRows.push(...sheet.data);
  }

  const yearMap = new Map<number, {
    customers: Array<{ rank: number; name: string; amount: string; ratio: string; notes: string }>;
    suppliers: Array<{ rank: number; name: string; amount: string; ratio: string; notes: string }>;
    top5CustomerRatio?: number;
    top5SupplierRatio?: number;
  }>();

  let currentYear: number | null = null;
  let currentType: 'customer' | 'supplier' | null = null;
  let inDataBlock = false;
  let rank = 1;

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const firstCell = String(row[0] || '').trim();
    if (!firstCell) continue;

    const isSupplierTitle = /上游|供应商/.test(firstCell) && /(\d{4})/.test(firstCell);
    const isCustomerTitle = /下游|客户/.test(firstCell) && /(\d{4})/.test(firstCell);

    if (isSupplierTitle || isCustomerTitle) {
      const yr = extractYearFromTitle(firstCell);
      if (yr) {
        currentYear = yr;
        currentType = isSupplierTitle ? 'supplier' : 'customer';
        inDataBlock = false;
        rank = 1;
        if (!yearMap.has(yr)) yearMap.set(yr, { customers: [], suppliers: [] });
      }
      continue;
    }

    const isHeaderRow = /名称|金额|占比|供应|销售/.test(firstCell) && currentYear !== null;
    if (isHeaderRow) {
      inDataBlock = true;
      rank = 1;
      continue;
    }

    if (inDataBlock && currentYear && currentType) {
      const name = firstCell;
      if (!name || /合计|小计|总计/.test(name)) {
        const totalRatio = row[2];
        if (typeof totalRatio === 'number' && totalRatio > 0) {
          const yd = yearMap.get(currentYear)!;
          if (currentType === 'customer') yd.top5CustomerRatio = Math.round(totalRatio * 100 * 10) / 10;
          else yd.top5SupplierRatio = Math.round(totalRatio * 100 * 10) / 10;
        }
        inDataBlock = false;
        continue;
      }
      const amount = row[1];
      const ratio = row[2];
      const notes = String(row[3] || '').trim();
      if (typeof amount === 'number' && amount > 0) {
        const amountStr = (amount / 10000).toFixed(2);
        const ratioStr = typeof ratio === 'number' ? (ratio * 100).toFixed(1) + '%' : String(ratio || '');
        const item = { rank: rank++, name, amount: amountStr, ratio: ratioStr, notes };
        const yd = yearMap.get(currentYear)!;
        if (currentType === 'customer') yd.customers.push(item);
        else yd.suppliers.push(item);
      }
    }
  }

  const byYear = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({ year, ...data }));
  return { byYear };
}

// ─── 营业收入构成解析 ──────────────────────────────────────────────────────────

export interface RevenueBreakdownResult {
  byYear: Array<{
    year: number;
    period?: string;
    segments: Array<{ segmentName: string; revenue: number; revenueRatio: number }>;
    totalRevenue?: number;
  }>;
}

/**
 * 直接解析营业收入构成 Excel 文件（不走 LLM）
 */
export async function parseRevenueBreakdownExcel(fileUrl: string): Promise<RevenueBreakdownResult> {
  const buffer = await readFileAsBuffer(fileUrl);
  const sheets = parseExcelBuffer(buffer);
  const allRows: any[][] = [];
  for (const sheet of sheets) {
    allRows.push(...sheet.data);
  }

  const yearMap = new Map<number, {
    period?: string;
    segments: Array<{ segmentName: string; revenue: number; revenueRatio: number }>;
    totalRevenue?: number;
  }>();

  let currentYear: number | null = null;
  let currentPeriod: string | undefined;
  let inDataBlock = false;

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const firstCell = String(row[0] || '').trim();
    if (!firstCell && inDataBlock && currentYear) {
      const totalAmount = row[1];
      if (typeof totalAmount === 'number' && totalAmount > 0) {
        const yd = yearMap.get(currentYear)!;
        if (!yd.totalRevenue) yd.totalRevenue = totalAmount / 10000;
      }
      continue;
    }
    if (!firstCell) continue;

    const yearMatch = firstCell.match(/(\d{4})/);
    if (yearMatch && /收入|营收|构成|占比/.test(firstCell)) {
      currentYear = parseInt(yearMatch[1]);
      const periodMatch = firstCell.match(/(\d{1,2}-\d{1,2}月|全年|上半年|下半年)/);
      currentPeriod = periodMatch ? periodMatch[1] : undefined;
      inDataBlock = false;
      if (!yearMap.has(currentYear)) yearMap.set(currentYear, { period: currentPeriod, segments: [] });
      continue;
    }

    const isHeaderRow = (/类别|类型|品类/.test(firstCell) ||
      (row.length >= 2 && /金额|收入/.test(String(row[1] || '')) && /占比|比例/.test(String(row[2] || '')))) &&
      currentYear !== null && !(typeof row[1] === 'number' && row[1] > 0);
    if (isHeaderRow) {
      inDataBlock = true;
      continue;
    }

    if (inDataBlock && currentYear) {
      const name = firstCell;
      if (!name || /合计|小计|总计/.test(name)) {
        const totalAmount = row[1];
        if (typeof totalAmount === 'number' && totalAmount > 0) {
          const yd = yearMap.get(currentYear)!;
          yd.totalRevenue = totalAmount / 10000;
        }
        inDataBlock = false;
        continue;
      }
      const amount = row[1];
      const ratio = row[2];
      if (typeof amount === 'number' && amount > 0) {
        const revenue = amount / 10000;
        const revenueRatio = typeof ratio === 'number' ? ratio * 100 : 0;
        const yd = yearMap.get(currentYear)!;
        yd.segments.push({ segmentName: name, revenue, revenueRatio });
      }
    }
  }

  const byYear = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({ year, ...data }));
  return { byYear };
}

// ─── 财务报表解析 ──────────────────────────────────────────────────────────────

export type ReportPeriodType = 'annual' | 'quarterly' | 'monthly';

export interface FinancialExcelMeta {
  unit: '元' | '万元' | '千元' | '百万元';
  unitFactor: number;
  periodType: ReportPeriodType;
  reportMonth: number | null;
  annualizationFactor: number;
  preferredFlowColumn: string;
  enrichedText: string;
}

const CUMULATIVE_COL_ALIASES = [
  '累计金额', '本年累计', '年累计', '本年累计金额', '累计发生额',
  '本年发生额', '年度累计', '本期累计', '1-本月累计',
  'YTD', 'Year to Date', '年初至今',
];

const CURRENT_PERIOD_COL_ALIASES = [
  '本期金额', '本月金额', '本期发生额', '本月发生额', '当期金额',
  '本期', '本月', '当月金额', '当期发生额',
  'Current Period', 'Current Month',
];

function detectFinancialUnit(rowText: string): { unit: '元' | '万元' | '千元' | '百万元'; factor: number } | null {
  const patterns: Array<[RegExp, '元' | '万元' | '千元' | '百万元', number]> = [
    [/单位[：:]\s*(?:人民币)?\s*百万元/i, '百万元', 100],
    [/单位[：:]\s*(?:人民币)?\s*千元/i, '千元', 0.1],
    [/单位[：:]\s*(?:人民币)?\s*万元/i, '万元', 1],
    [/单位[：:]\s*(?:人民币)?\s*元/i, '元', 0.0001],
    [/\b百万元\b/, '百万元', 100],
    [/\b千元\b/, '千元', 0.1],
    [/\b万元\b/, '万元', 1],
  ];
  for (const [re, unit, factor] of patterns) {
    if (re.test(rowText)) return { unit, factor };
  }
  if (/(?<![万千百])元(?!素|旦|月|年|日|件|个|台|套|次|人|组)/.test(rowText)) {
    return { unit: '元', factor: 0.0001 };
  }
  return null;
}

/**
 * 财务报表 Excel 专用解析：识别单位 + 列选择 + 返回增强文本
 */
export async function parseFinancialStatementExcel(fileUrl: string): Promise<FinancialExcelMeta> {
  const buffer = await readFileAsBuffer(fileUrl);
  const sheetsData = parseExcelBuffer(buffer);

  // 扫描前5行，识别单位和日期
  let detectedUnit: '元' | '万元' | '千元' | '百万元' = '元';
  let unitFactor = 0.0001;
  let reportMonth: number | null = null;

  for (const { data: jsonData } of sheetsData) {
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const rowText = (jsonData[i] || []).map((c: any) => String(c ?? '').trim()).join(' ');
      const unitResult = detectFinancialUnit(rowText);
      if (unitResult) {
        detectedUnit = unitResult.unit;
        unitFactor = unitResult.factor;
      }
      if (reportMonth === null) {
        const datePatterns = [
          /(\d{4})\s*年\s*(\d{1,2})\s*月/,
          /(\d{4})-(\d{2})-\d{2}/,
          /(\d{4})(\d{2})\d{2}/,
        ];
        for (const pat of datePatterns) {
          const m = rowText.match(pat);
          if (m) {
            const month = parseInt(m[2]);
            if (month >= 1 && month <= 12) { reportMonth = month; break; }
          }
        }
      }
    }
  }

  // 识别报表期间类型
  let periodType: ReportPeriodType = 'monthly';
  if (reportMonth !== null) {
    if (reportMonth === 12) periodType = 'annual';
    else if (reportMonth === 3 || reportMonth === 6 || reportMonth === 9) periodType = 'quarterly';
    else periodType = 'monthly';
  }
  const annualizationFactor = reportMonth ? parseFloat((12 / reportMonth).toFixed(4)) : 1;

  // 识别利润表/现金流量表的列选择
  let preferredFlowColumn = '累计金额';
  let hasCumulativeCol = false;
  let hasCurrentPeriodCol = false;
  let foundCumulativeColName = '';
  let foundCurrentPeriodColName = '';

  for (const { data: jsonData } of sheetsData) {
    for (let i = 0; i < Math.min(6, jsonData.length); i++) {
      const row = (jsonData[i] || []).map((c: any) => String(c ?? '').trim());
      for (const alias of CUMULATIVE_COL_ALIASES) {
        const found = row.find((cell: string) => cell.includes(alias));
        if (found && !hasCumulativeCol) {
          hasCumulativeCol = true;
          foundCumulativeColName = found;
        }
      }
      for (const alias of CURRENT_PERIOD_COL_ALIASES) {
        const found = row.find((cell: string) => cell.includes(alias));
        if (found && !hasCurrentPeriodCol) {
          hasCurrentPeriodCol = true;
          foundCurrentPeriodColName = found;
        }
      }
    }
  }

  if (hasCumulativeCol) {
    preferredFlowColumn = foundCumulativeColName || '累计金额';
  } else if (hasCurrentPeriodCol) {
    preferredFlowColumn = foundCurrentPeriodColName || '本期金额';
  }

  // 生成增强文本
  const periodLabel = periodType === 'annual' ? '年报' : periodType === 'quarterly' ? `季报（1-${reportMonth}月）` : `月报（${reportMonth}月）`;
  const metaHeader = [
    `【财务报表解析元数据】`,
    `1. 金额单位: ${detectedUnit}`,
    `2. 报表期间: ${reportMonth ? `${reportMonth}月末` : '未知'}（${periodLabel}）`,
    `3. 年化系数: ${annualizationFactor}`,
    `4. 利润表/现金流量表列选择: 【使用"${preferredFlowColumn}"列】`,
    ``,
  ].join('\n');

  const sheets: string[] = [];
  for (const { sheetName, data: jsonData } of sheetsData) {
    if (!jsonData || jsonData.length === 0) continue;
    let text = `\n## Sheet: ${sheetName}\n\n`;
    const maxRows = Math.min(jsonData.length, 500);
    let maxCols = 0;
    for (let i = 0; i < maxRows; i++) {
      if (jsonData[i] && jsonData[i].length > maxCols) maxCols = jsonData[i].length;
    }
    maxCols = Math.min(maxCols, 50);
    for (let i = 0; i < maxRows; i++) {
      const row = jsonData[i] || [];
      const cells = [];
      for (let j = 0; j < maxCols; j++) {
        let val = row[j] ?? '';
        if (val instanceof Date) val = val.toISOString().split('T')[0];
        const str = String(val).trim();
        cells.push(str.length > 100 ? str.substring(0, 100) + '...' : str);
      }
      if (i > 0 && cells.every((c: string) => c === '')) continue;
      text += cells.join('\t') + '\n';
      if (i === 0) text += cells.map(() => '---').join('\t') + '\n';
    }
    sheets.push(text);
  }

  return {
    unit: detectedUnit,
    unitFactor,
    periodType,
    reportMonth,
    annualizationFactor,
    preferredFlowColumn,
    enrichedText: metaHeader + sheets.join('\n'),
  };
}

// ─── 通用文件类型识别 ──────────────────────────────────────────────────────────

export type LocalDocType =
  | 'bank_statement'       // 银行流水
  | 'financial_statement'  // 财务报表（三张表）
  | 'top5_customer'        // TOP5 客户/供应商
  | 'revenue_breakdown'    // 收入构成
  | 'tax_declaration'      // 增值税申报表
  | 'tax_certificate'      // 完税证明
  | 'business_license'     // 营业执照
  | 'audit_report'         // 审计报告
  | 'unknown';             // 未知

/**
 * 根据文件名和内容特征识别文件类型
 */
export function sniffDocType(fileName: string, firstSheetHeaders?: string[]): LocalDocType {
  const name = fileName.toLowerCase();

  // 基于文件名识别
  if (/银行流水|流水|bank.*statement|statement.*bank/.test(name)) return 'bank_statement';
  if (/财务报表|三张表|资产负债|利润表|现金流/.test(name)) return 'financial_statement';
  if (/top5|前五|客户供应商|供应商客户|上下游/.test(name)) return 'top5_customer';
  if (/收入构成|营收构成|revenue.*breakdown/.test(name)) return 'revenue_breakdown';
  if (/增值税|vat|税务申报/.test(name)) return 'tax_declaration';
  if (/完税证明|纳税证明/.test(name)) return 'tax_certificate';
  if (/营业执照|business.*license/.test(name)) return 'business_license';
  if (/审计报告|audit.*report/.test(name)) return 'audit_report';

  // 基于表头识别
  if (firstSheetHeaders) {
    const headers = firstSheetHeaders.join(' ');
    if (/借方|贷方|余额|交易日期|摘要/.test(headers)) return 'bank_statement';
    if (/资产|负债|所有者权益|营业收入|净利润|经营活动/.test(headers)) return 'financial_statement';
    if (/客户名称|供应商名称|销售金额|采购金额/.test(headers)) return 'top5_customer';
    if (/收入类别|收入金额|占比/.test(headers)) return 'revenue_breakdown';
  }

  return 'unknown';
}

/**
 * 从 Excel 文件中读取第一个 sheet 的表头行
 */
export async function getFirstSheetHeaders(fileUrl: string): Promise<string[]> {
  try {
    const buffer = await readFileAsBuffer(fileUrl);
    const sheets = parseExcelBuffer(buffer);
    if (!sheets || sheets.length === 0) return [];
    const data = sheets[0].data;
    // 找包含关键词最多的行作为表头
    let bestRow: string[] = [];
    let bestScore = 0;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i].map((c: any) => String(c).trim());
      const score = row.filter(c => c.length > 0).length;
      if (score > bestScore) {
        bestScore = score;
        bestRow = row;
      }
    }
    return bestRow;
  } catch {
    return [];
  }
}
