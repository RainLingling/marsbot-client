import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, AlertCircle, FileText, Building2,
  BarChart3, Shield, DollarSign, Activity, RefreshCw, Info, Pencil,
  Upload, X, Search, File, FileSpreadsheet, Image as ImageIcon,
  ExternalLink, Download, Network, Globe, TrendingUp, Package,
  ChevronDown, ChevronUp, Loader2, User, Plus, Trash2,
  Sparkles, Send, Clock, History, MicOff, Mic, Square, UserCircle, LogOut
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

// ─── Types (re-exported from Home.tsx) ───────────────────────────────────────
interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  searchResults?: CompanyCandidate[];
  uploadedFiles?: UploadedFile[];
  zipCard?: {
    zipName: string;       // 压缩包文件名
    zipId: string;         // 唯一ID
    entries: ZipFileEntry[]; // 解压后的文件列表
  };
  timestamp?: string; // ISO string for serialization
}

interface CompanyCandidate {
  id: string;
  name: string;
  creditCode: string;
  legalPerson: string;
  registrationStatus: string;
  registeredCapital: string;
  province: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  docId: string;         // 对应资料清单中的id
  docName: string;       // 识别出的文件类型名称
  parseType?: string;    // 服务端解析类型（可选，不存在时由parseTypeMap推断）
  status: "uploading" | "parsing" | "done" | "error";
  url?: string;
  parsedData?: Record<string, unknown>;
  fromZip?: string;      // 来自哪个压缩包（压缩包文件名）
  _file?: File;          // 原始 File 对象（用于重试上传）
}

// 压缩包内文件条目（用于对话卡片展示）
interface ZipFileEntry {
  id: string;
  name: string;          // 文件名
  size: string;          // 格式化大小
  docId: string;         // 自动匹配的资料类型ID
  docName: string;       // 自动匹配的资料类型名称
  parseType: string;     // 解析类型
  status: "pending" | "uploading" | "parsing" | "done" | "error"; // pending=等待用户确认
  userSelected?: boolean; // 是否用户手动选择了类型
  url?: string;
  file?: File;           // 原始File对象（临时存储）
}

interface AppData {
  companyName?: string;
  creditCode?: string;
  legalPerson?: string;
  registeredCapital?: string;
  establishDate?: string;
  address?: string;
  industry?: string;
  companyType?: string;
  operatingStatus?: string;
  amount?: string;
  loanType?: string;
  period?: string;
  purpose?: string;
  revenue?: string;
  netProfit?: string;
  totalAssets?: string;
  totalLiabilities?: string;
  operatingCashFlow?: string;
  currentRatio?: string;
  quickRatio?: string;
  roe?: string;
  // 财务摘要（来自LLM解析的财务状况简评）
  financialSummary?: string;
  // 三张表完整财务数据（用于 AI 回答具体财务问题）- 最新年份快捷访问
  financialStatements?: {
    balanceSheet?: Record<string, string | null>;
    incomeStatement?: Record<string, string | null>;
    cashFlowStatement?: Record<string, string | null>;
  };
  // 多年度财务数据（按年份存储，支持多年对比）
  financialStatementsByYear?: Record<string, {
    year: string;
    reportPeriod?: string;  // 精确报告期，如 "2026-02"（月报）、"2025-Q3"（季报）、"2025"（年报）
    periodType?: 'annual' | 'monthly' | 'quarterly' | 'interim';  // 报告期类型
    balanceSheet?: Record<string, string | null>;
    incomeStatement?: Record<string, string | null>;
    cashFlowStatement?: Record<string, string | null>;
    fileName?: string;
  }>;
  // 审计报告解析结果（来源于审计报告PDF解析）
  auditReport?: {
    reportYear?: string;
    auditOpinion?: string;
    auditFirm?: string;
    auditDate?: string;
    financialDataFromAudit?: Record<string, unknown>;
    fileName?: string;
  };
  // 银行流水解析结果（来源于银行流水PDF解析）
  bankData?: Record<string, unknown>;
  // 纳税申报解析结果（来源于纳税申报表/完税证明解析）- 按类型分别存储，避免多次上传互相覆盖
  taxData?: Record<string, unknown>; // 兼容旧版单一taxData
  taxDataByType?: {
    vat?: Record<string, unknown>;       // 增值税申报表 (tax_vat)
    income?: Record<string, unknown>;    // 企业所得税申报表 (tax_income)
    clearance?: Record<string, unknown>; // 完税证明 (tax_clearance)
    credit?: Record<string, unknown>;    // 纳税信用等级 (tax_credit)
  };
  // 新版：按年份+类型的二维结构，支持多年税务数据并排显示
  taxDataByYear?: Record<string, {
    vat?: Record<string, unknown>;
    income?: Record<string, unknown>;
    clearance?: Record<string, unknown>;
    credit?: Record<string, unknown>;
  }>;
  // 其他解析文档结果（发票/合同等）
  parsedDocuments?: Array<{ fileType: string; data: Record<string, unknown> }>;
  // 工商数据来源标记（区分真实解析 vs AI生成）
  companyDataSource?: 'business_license' | 'ai_generated' | 'user_input';
  // TOP5 甲方单位（按年份，近三年动态）
  top5Customers?: Top5YearData[];
  // TOP5 供应商单位（按年份，近三年动态）
  top5Suppliers?: Top5YearData[];
  // 高管信息（来源于高管简历Excel解析）
  keyExecutives?: Array<{
    name?: string;
    position?: string;
    gender?: string;
    birthDate?: string;
    education?: string;
    idNumber?: string;
    phone?: string;
    workExperience?: string;
  }>;
  // 资质证书（来源于资质证书PDF/图片解析）
  qualifications?: Array<{
    certName?: string;
    certNumber?: string;
    certType?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingAuthority?: string;
  }>;
  // 公司经营概况（来源于经营概况Word文档解析）
  companyProfile?: {
    companyIntro?: string;
    mainProducts?: string[];
    upstreamDesc?: string;
    downstreamDesc?: string;
    patentCount?: number;
    coreCompetitiveness?: string;
  };
  // 他行授信（来源于他行授信Excel解析）
  creditFacilities?: Array<{
    bankName?: string;
    facilityType?: string;
    creditAmount?: number;
    outstandingBalance?: number;
    startDate?: string;
    endDate?: string;
    guaranteeType?: string;
  }>;
  // 业务板块/收入构成（来源于收入构成Excel解析）
  businessSegments?: Array<{
    segmentName?: string;
    revenue?: number;
    revenueRatio?: number;
    year?: string;
  }>;
  // 银行流水汇总（来源于银行流水Excel解析，支持多文件累加合并）
  bankFlowSummary?: {
    totalInflow?: number;
    totalOutflow?: number;
    netCashFlow?: number;
    statementPeriod?: string;  // 汇总流水期间，如 "2025-01 ~ 2026-03"
    startDate?: string;        // 最早月份，如 "2025-01"
    endDate?: string;          // 最晚月份，如 "2026-03"
    monthCount?: number;       // 月份数量
    accountName?: string;      // 账户名称
    bankName?: string;         // 开户行
    avgBalance?: number;       // 月均余额（万元）
    minBalance?: number;       // 最低余额（万元）
    repaymentRecords?: Array<{
      date?: string;
      description?: string;
      amount?: number;
      onTime?: boolean;
    }>;
    monthlyData?: Array<{
      month?: string;
      inflow?: number;
      outflow?: number;
      balance?: number;
    }>;
    top5Counterparties?: Array<{
      name: string;
      amount: number;   // 单位：元（LLM解析）
      direction: 'in' | 'out';
      count: number;
    }>;
  };
  // 甲方（债务人）信息 — 保理/供应链融资专用
  counterpartyInfo?: {
    name?: string;
    creditCode?: string;
    paymentTermDays?: number;
    paymentMethod?: string;
    contractAmount?: number;
    arConcentrationRatio?: number;
    contractSignDate?: string;
    factoringApplyDate?: string;
    invoiceAmount?: number;
    historicalRepaymentAmount?: number;
    hasOverdueHistory?: boolean;
    overdueDays?: number;
    enterpriseType?: string;
    industryPosition?: string;
    notes?: string;
  };
}

interface AnalysisResult {
  verdict: "approved" | "reduced" | "rejected";
  creditScore: number;
  layer3?: {
    ruleEngine?: {
      passed: boolean;
      triggeredRules: Array<{ ruleId: string; ruleName: string; detail: string }>;
      summary: string;
    };
    scorecard?: {
      score: number;
      creditGrade: string;
      subjectQualityScore: number;
      financialHealthScore: number;
      operationStabilityScore: number;
      scorePD: number;
      recommendation: string;
      scoreBreakdown?: {
        subjectWeight: number;
        financialWeight: number;
        operationWeight: number;
        subjectContribution: number;
        financialContribution: number;
        operationContribution: number;
        penaltyPoints: number;
      };
    };
    limitCalculation?: {
      revenueMethodLimit: number | null;
      netAssetMethodLimit: number | null;
      cashFlowMethodLimit: number | null;
      incomeMethodDetail?: string | null;
      netAssetMethodDetail?: string | null;
      cashFlowMethodDetail?: string | null;
      recommendedLimit: number | null;
      approvedAmount: number;
      approvalRatio: number;
      zeroAmountReasons?: Array<{
        category: string;
        reason: string;
        detail: string;
        suggestion: string;
      }>;
      methodDetails?: Array<{
        method: string;
        formula: string;
        inputValues: Record<string, number>;
        result: number;
        isBinding: boolean;
      }>;
    };
    featureSummary?: {
      dataCompleteness: number;
      missingFields: string[];
      values?: Record<string, number>;
      featureDetails?: Record<string, {
        value: number | null;
        source: string;
        formula: string;
        missingReason?: string;
      }>;
      // 数据缺失因果链（与 missingDataChain.ts MissingDataChain 接口一致）
      missingDataChain?: {
        missingItems: Array<{
          fileName: string;
          fileType: string;
          severity: "critical" | "important" | "optional";
          missingData: string[];
          affectedFeatures: string[];
          affectedScoring: string[];
          affectedLimits: string[];
        }>;
        dataCompleteness: number;
        availableDimensions: string[];
        unavailableDimensions: string[];
        summaryForAI: string;
      } | null;
    };
  };
}

// ─── 资料清单 ─────────────────────────────────────────────────────────────────

const DOC_CHECKLIST = [
  { id: "biz-license",      name: "营业执照",       required: true,  desc: "统一社会信用代码证",           category: "主体资质",  keywords: ["营业执照", "执照", "license", "bizlicense"] },
  { id: "id-card",          name: "法人身份证",      required: true,  desc: "正反面复印件",                category: "主体资质",  keywords: ["身份证", "idcard", "法人"] },
  { id: "articles",         name: "公司章程",        required: false, desc: "最新版公司章程",              category: "主体资质",  keywords: ["章程", "articles"] },
  { id: "bank-statement",   name: "银行流水",        required: true,  desc: "近12个月对公账户流水",        category: "财务数据",  keywords: ["流水", "银行", "bank", "statement"] },
  { id: "financial-report", name: "财务报表",        required: true,  desc: "近2年审计报告或财务报表",     category: "财务数据",  keywords: ["财务报表", "财务", "报表", "年报", "资产负债", "利润表", "现金流量", "financial", "balance sheet", "income statement"] },
  { id: "audit-report",     name: "审计报告",        required: false, desc: "年度审计报告（含审计意见）", category: "财务数据",  keywords: ["审计报告", "年审报告", "审报告", "年度审计", "审计意见", "注册会计师", "事务所", "audit report", "audit opinion", "auditor"] },
  { id: "vat-return",       name: "增值税申报表",    required: true,  desc: "近12个月增值税纳税申报表",    category: "纳税资料",  keywords: ["增值税申报", "增值税纳税", "申报表", "附加税", "vat return", "vat申报"] },
  { id: "income-tax",       name: "企业所得税年报",  required: true,  desc: "近2年企业所得税年度申报表",   category: "纳税资料",  keywords: ["所得税", "企业所得税", "income_tax", "年度申报"] },
  { id: "tax-clearance",    name: "完税证明",        required: true,  desc: "近12个月完税证明（无欠税）",  category: "纳税资料",  keywords: ["完税", "完税证明", "税务证明", "tax_clearance"] },
  { id: "tax-credit",       name: "纳税信用等级证书", required: false, desc: "A/B级优先,C/D级需说明",      category: "纳税资料",  keywords: ["纳税信用", "信用等级", "tax_credit", "纳税等级"] },
  { id: "customer-contract", name: "甲方业务合同",    required: false, desc: "主要客户/甲方合同",          category: "业务资料",  keywords: ["甲方合同", "客户合同", "customer_contract"] },
  { id: "supplier-contract", name: "供应商合同",    required: false, desc: "主要供应商/采购合同",          category: "业务资料",  keywords: ["供应商合同", "采购合同", "supplier_contract", "合同", "contract", "协议"] },
  { id: "invoice",          name: "应收账款发票",    required: false, desc: "保理业务必须提供",            category: "业务资料",  keywords: ["发票", "invoice"] },
  { id: "mortgage",         name: "抖押资料",        required: false, desc: "抖押贷款必须提供",            category: "担保资料",  keywords: ["抖押", "房产", "产权", "mortgage"] },
  { id: "top5-customer",    name: "Top5甲方/大客户",  required: false, desc: "Top5甲方订单、客户合同汇总及回款记录", category: "业务资料",  keywords: ["top5客户", "top5甲方", "top客户", "大客户", "主要客户", "客户汇总", "甲方汇总", "客户列表", "前五大客户", "前5大客户", "五大客户", "前五客户", "客户及供应商", "客户供应商"] },
  { id: "top5-supplier",    name: "Top5供应商",        required: false, desc: "Top5供应商采购金额及合同汇总",    category: "业务资料",  keywords: ["top5供应商", "top供应商", "主要供应商", "供应商汇总", "采购汇总", "供应商列表", "前五大供应商", "前5大供应商", "五大供应商", "前五供应商"] },
  { id: "revenue-breakdown", name: "营业收入组成", required: false, desc: "收入来源、主要产品/服务及占比",  category: "业务资料",  keywords: ["收入组成", "营业收入", "收入分析", "revenue", "收入结构", "收入构成", "营收构成", "收入占比", "营收占比", "收入来源", "业务构成", "主营业务收入"] },
  { id: "open-orders",      name: "在手订单",        required: false, desc: "当前已签订单及预期回款计划",      category: "业务资料",  keywords: ["在手订单", "订单", "order", "已签订单"] },
  { id: "sales-ledger",     name: "销售台账",        required: false, desc: "销售明细、发票对应记录",              category: "业务资料",  keywords: ["销售台账", "销售明细", "销售记录", "sales", "销售汇总"] },
  { id: "credit-facility",  name: "他行授信",        required: false, desc: "其他金融机构授信情况及贷款余额",  category: "贷款资料",  keywords: ["授信", "他行贷款", "其他贷款", "授信证明", "credit", "贷款余额"] },
  { id: "business-intro",   name: "公司介绍",        required: false, desc: "公司主营业务、商业模式简介",          category: "主体资质",  keywords: ["公司介绍", "企业介绍", "公司简介", "经营概况", "公司概况", "企业概况", "主营业务", "introduction"] },
  { id: "mgmt-resume",      name: "高管简历",        required: false, desc: "实际控制人/法人从业背景及诚信记录",  category: "主体资质",  keywords: ["高管简历", "法人简历", "简历", "resume"] },
  { id: "bank-permit",      name: "开户许可证",      required: false, desc: "验证企业预留开户账户真实性",          category: "主体资质",  keywords: ["开户许可", "开户证", "bank_permit"] },
  { id: "qualification",    name: "资质证明",        required: false, desc: "行业许可证、专业资质证书",            category: "主体资质",  keywords: ["资质证明", "资质证书", "许可证", "专精特新", "创新型", "高新技术", "高新企业", "国高新", "高新证书", "三体系", "iso", "认定证书", "认证证书", "资质认定", "qualification"] },
];

// ─── 文件类型识别 ─────────────────────────────────────────────────────────────
// docId → server parseType 映射表
const DOC_PARSE_TYPE_MAP: Record<string, string> = {
  "biz-license": "business_license",
  "id-card": "business_license",
  "financial-report": "financial_report",
  "audit-report": "audit_report",
  "bank-statement": "bank_statement",
  "invoice": "invoice",
  "customer-contract": "customer_contract",
  "supplier-contract": "supplier_contract",
  "articles": "articles",
  "mortgage": "mortgage",
  "vat-return": "tax_vat",
  "income-tax": "tax_income",
  "tax-clearance": "tax_clearance",
  "tax-credit": "tax_credit",
  "top5-customer": "top5_customer",
  "top5-supplier": "top5_supplier",
  "revenue-breakdown": "revenue_breakdown",
  "open-orders": "open_orders",
  "sales-ledger": "sales_ledger",
  "credit-facility": "credit_facility",
  "business-intro": "business_intro",
  "mgmt-resume": "mgmt_resume",
  "bank-permit": "bank_permit",
  "qualification": "qualification",
};
// 财务报表专项关键词（优先级高于银行流水）
const FINANCIAL_REPORT_KEYWORDS = [
  "财务报表", "年报", "资产负债", "利润表", "现金流量", "审计报告", "审计",
  "financial", "annual", "balance", "income statement", "cash flow", "audit",
  "财报", "三张表", "年度报告", "合并报表",
];
// 银行流水专项关键词
const BANK_STATEMENT_KEYWORDS = [
  "流水", "银行", "对账单", "交易明细", "账户明细", "对账",
  "bank statement", "transaction", "statement",
];
/**
 * 三层文件类型识别：
 * 1. 资料清单关键词匹配（最精确）
 * 2. 财务报表/银行流水专项关键词（区分 Excel 是报表还是流水）
 * 3. 文件格式兜底（Excel 返回 null 表示需要用户选择）
 */
function guessDocType(filename: string): { docId: string; docName: string; parseType: string } | null {
  // 去掉文件名前的数字编号前缀（如"4、"、"3. "、"(2)"等），避免干扰关键词匹配
  const baseName = filename.replace(/^[\d\s\(\)、.。_-]+/, '');
  const lower = baseName.toLowerCase();
  const lowerFull = filename.toLowerCase(); // 完整文件名（含编号）也保留用于兜底

  // 优先级0：资质证书类（防止被识别为财务报表）
  const QUALIFICATION_KEYWORDS = ["专精特新", "创新型", "高新技术", "高新企业", "国高新", "高新证书", "三体系", "iso", "认定证书", "认证证书", "资质认定", "资质证明", "资质证书", "许可证", "qualification"];
  if (QUALIFICATION_KEYWORDS.some(k => lower.includes(k) || lowerFull.includes(k))) {
    return { docId: "qualification", docName: "资质证明", parseType: "qualification" };
  }

  // 优先级1：纳税申报类（防止被识别为财务报表）
  const TAX_KEYWORDS = ["申报表", "增值税申报", "增值税纳税", "附加税", "所得税申报", "完税证明", "完税", "税务证明", "纳税信用"];
  if (TAX_KEYWORDS.some(k => lower.includes(k) || lowerFull.includes(k))) {
    if (lower.includes("所得税") || lowerFull.includes("所得税")) {
      return { docId: "income-tax", docName: "企业所得税年报", parseType: "tax_income" };
    }
    if (lower.includes("完税") || lower.includes("税务证明") || lowerFull.includes("完税")) {
      return { docId: "tax-clearance", docName: "完税证明", parseType: "tax_clearance" };
    }
    if (lower.includes("纳税信用") || lowerFull.includes("纳税信用")) {
      return { docId: "tax-credit", docName: "纳税信用等级证书", parseType: "tax_credit" };
    }
    // 默认归为增值税申报表
    return { docId: "vat-return", docName: "增值税申报表", parseType: "tax_vat" };
  }

  // 第一层：资料清单关键词匹配（优先级最高，使用去编号后的文件名）
  for (const doc of DOC_CHECKLIST) {
    if (doc.keywords.some(k => lower.includes(k.toLowerCase()) || lowerFull.includes(k.toLowerCase()))) {
      return { docId: doc.id, docName: doc.name, parseType: DOC_PARSE_TYPE_MAP[doc.id] || "contract" };
    }
  }
  // 第二层：财务报表专项关键词（比银行流水优先级高）
  if (FINANCIAL_REPORT_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) {
    return { docId: "financial-report", docName: "财务报表", parseType: "financial_report" };
  }
  // 第二层：银行流水专项关键词
  if (BANK_STATEMENT_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) {
    return { docId: "bank-statement", docName: "银行流水", parseType: "bank_statement" };
  }
  // 第三层：年月数字文件名智能识别（如 202302.pdf、2022年报.xlsx）
  // 匹配纯年份或年月格式：2020~2030年的4位或6位数字
  const yearMonthPattern = /^(20[0-9]{2})(0[1-9]|1[0-2])?(\.\w+)?$/;
  const strippedName = lower.replace(/[\s_\-年月]/g, ''); // 去掉空格/下划线/连字符/汉字
  const nameWithoutExt = strippedName.replace(/\.[^.]+$/, '');
  if (yearMonthPattern.test(nameWithoutExt + (lower.match(/\.[^.]+$/)?.[0] || ''))) {
    // 纯年月数字文件名：PDF→审计报告（年度报告）
    // Excel/CSV → 返回 null 让用户选择（可能是银行流水或财务报表，无法确定）
    if (lower.endsWith('.pdf') || lowerFull.endsWith('.pdf')) {
      return { docId: 'audit-report', docName: '审计报告', parseType: 'audit_report' };
    }
    // Excel/CSV 年月数字文件名：无法确定是银行流水还是财务报表，返回 null 触发用户选择弹窗
    if (['.xls', '.xlsx', '.csv'].some(e => lower.endsWith(e) || lowerFull.endsWith(e))) {
      return null;
    }
  }
  // 第四层：文件格式兜底
  // PDF 文件无法通过文件名识别时，返回 null 触发服务端 sniffDocType 内容嗅探，而非直接归为合同
  if (lower.endsWith(".pdf") || lowerFull.endsWith(".pdf")) return null;
  if ([".jpg", ".jpeg", ".png", ".webp"].some(e => lower.endsWith(e) || lowerFull.endsWith(e))) return { docId: "biz-license", docName: "营业执照", parseType: "business_license" };
  // Excel/CSV 且文件名无关键词：返回 null 触发用户选择弹窗
  if ([".xls", ".xlsx", ".csv"].some(e => lower.endsWith(e) || lowerFull.endsWith(e))) return null;
  // .docx/.doc Word 文档：返回 null 触发 sniffDocType 内容嗅探（可能是经营概况/材料清单等）
  if ([".docx", ".doc"].some(e => lower.endsWith(e) || lowerFull.endsWith(e))) return null;
  return { docId: "contract", docName: "其他资料", parseType: "contract" };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function FileTypeIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].some(e => lower.endsWith(e))) return <ImageIcon size={14} className="text-purple-500" />;
  if ([".xls", ".xlsx", ".csv"].some(e => lower.endsWith(e))) return <FileSpreadsheet size={14} className="text-green-500" />;
  return <FileText size={14} className="text-blue-500" />;
}

// ─── Manus 风格解析步骤 ──────────────────────────────────────────────────────
type ParseStepStatus = "pending" | "active" | "done" | "error";
interface ParseStep { label: string; detail?: string; status: ParseStepStatus; }

function getParseSteps(parseType: string, status: "uploading" | "parsing" | "done" | "error"): ParseStep[] {
  // 根据文件类型定义步骤标签
  const stepsByType: Record<string, string[]> = {
    business_license: ["读取文件", "识别企业名称", "提取信用代码", "核验法人信息"],
    financial_report: ["读取文件结构", "定位三张报表", "提取财务数据", "计算关键指标"],
    audit_report: ["读取审计报告", "识别审计意见", "提取财务数据", "评估审计风险"],
    bank_statement: ["读取流水文件", "识别账户信息", "统计月度收支", "分析资金流向"],
    tax_vat: ["读取申报表", "识别申报期间", "提取月度收入", "计算税负指标"],
    tax_income: ["读取年报", "识别申报年度", "提取利润数据", "计算税负率"],
    tax_clearance: ["读取完税证明", "识别税务机关", "核验欠税情况", "确认有效期"],
    tax_credit: ["读取信用证书", "识别评级结果", "核验有效期", "记录信用等级"],
    invoice: ["读取发票文件", "识别发票类型", "提取金额信息", "核验发票真实性"],
    contract: ["读取合同文件", "识别合同主体", "提取关键条款", "提取金额与期限"],
  };
  const labels = stepsByType[parseType] || stepsByType.contract;
  const steps: ParseStep[] = labels.map(label => ({ label, status: "pending" as ParseStepStatus }));
  if (status === "uploading") {
    steps[0].status = "active";
  } else if (status === "parsing") {
    steps[0].status = "done";
    steps[1].status = "active";
    steps[2].status = "active";
    // 最后一步仍 pending（生成指标阶段）
  } else if (status === "done") {
    steps.forEach(s => (s.status = "done"));
  } else if (status === "error") {
    steps[0].status = "done";
    steps[1].status = "error";
  }
  return steps;
}

// TOP5 甲方/供应商数据类型
interface Top5Item {
  rank: number;       // 排名 1-5
  name: string;       // 单位名称
  amount: string;     // 交易金额（万元）
  ratio: string;      // 占比
  notes?: string;     // 备注
}
interface Top5YearData {
  year: number;       // 年份
  items: Top5Item[];  // 当年TOP5列表
}

// ─── 面板 Tab ──────────────────────────────────────────────────────────────────────────────────────
type PanelTab = "docs" | "data-verify" | "financial-analysis" | "bank-flow" | "tax-analysis" | "industry-analysis" | "cross-analysis" | "multi-source" | "comprehensive" | "credit-decision" | "analysis-engine";
const PANEL_TABS: Array<{ id: PanelTab; label: string; icon: React.ReactNode; isAdvanced?: boolean }> = [
  { id: "docs",               label: "资料清单", icon: <FileText size={13} /> },
  { id: "data-verify",        label: "数据核验", icon: <Building2 size={13} /> },
  { id: "financial-analysis", label: "财报分析", icon: <BarChart3 size={13} /> },
  { id: "bank-flow",          label: "银行流水", icon: <Activity size={13} /> },
  { id: "tax-analysis",       label: "税务分析", icon: <FileText size={13} /> },
  { id: "industry-analysis",  label: "行业分析", icon: <Globe size={13} /> },
  { id: "cross-analysis",     label: "交叉分析", icon: <Network size={13} /> },
  { id: "multi-source",       label: "多源数据", icon: <Network size={13} /> },
  { id: "comprehensive",      label: "综合评估", icon: <Shield size={13} /> },
  { id: "credit-decision",    label: "信贷决策", icon: <DollarSign size={13} /> },
  { id: "analysis-engine",    label: "分析引擎", icon: <Activity size={13} />, isAdvanced: true },
];

// ─── 38特征分组 ───────────────────────────────────────────────────────────────────────────────────
type FeatureItem = { id: string; name: string; unit: string; key: string; isPercent?: boolean; isRatio?: boolean; isBool?: boolean; goodHigh?: boolean; goodLow?: boolean };
const FEATURE_GROUPS: Array<{ name: string; features: FeatureItem[] }> = [
  { name: "主体资质（F01-F12）", features: [
    { id: "F01", name: "纳税信用等级", unit: "分", key: "F01_taxCreditScore", goodHigh: true },
    { id: "F02", name: "企业成立月数", unit: "月", key: "F02_companyAgeMonths", goodHigh: true },
    { id: "F03", name: "注册资本对数", unit: "ln", key: "F03_registeredCapitalLn", goodHigh: true },
    { id: "F04", name: "法人风险评分", unit: "分", key: "F04_legalPersonRiskScore", goodLow: true },
    { id: "F05", name: "股权集中度", unit: "", key: "F05_shareholderConcentration", isRatio: true },
    { id: "F06", name: "关联企业数量", unit: "家", key: "F06_relatedCompanyCount" },
    { id: "F07", name: "关联高风险企业", unit: "家", key: "F07_relatedRiskCompanyCount", goodLow: true },
    { id: "F08", name: "高管变更次数", unit: "次", key: "F08_executiveChangeCount", goodLow: true },
    { id: "F09", name: "经营范围匹配度", unit: "", key: "F09_businessScopeMatch", isRatio: true, goodHigh: true },
    { id: "F10", name: "资质证书数量", unit: "个", key: "F10_certificationCount", goodHigh: true },
    { id: "F11", name: "是否上市公司", unit: "", key: "F11_isListedCompany", isBool: true },
    { id: "F12", name: "行业风险评分", unit: "分", key: "F12_industryRiskScore", goodLow: true },
  ]},
  { name: "财务健康（F13-F25）", features: [
    { id: "F13", name: "资产负债率", unit: "%", key: "F13_debtRatio", isPercent: true, goodLow: true },
    { id: "F14", name: "流动比率", unit: "倍", key: "F14_currentRatio", goodHigh: true },
    { id: "F15", name: "速动比率", unit: "倍", key: "F15_quickRatio", goodHigh: true },
    { id: "F16", name: "利息保障倍数", unit: "倍", key: "F16_interestCoverageRatio", goodHigh: true },
    { id: "F17", name: "营收增长率", unit: "%", key: "F17_revenueGrowthRate", isPercent: true, goodHigh: true },
    { id: "F18", name: "净利润率", unit: "%", key: "F18_netProfitMargin", isPercent: true, goodHigh: true },
    { id: "F19", name: "净资产收益率ROE", unit: "%", key: "F19_roe", isPercent: true, goodHigh: true },
    { id: "F20", name: "应收账款周转天数", unit: "天", key: "F20_arTurnoverDays", goodLow: true },
    { id: "F21", name: "存货周转天数", unit: "天", key: "F21_inventoryTurnoverDays", goodLow: true },
    { id: "F22", name: "经营现金流/净利润", unit: "倍", key: "F22_operatingCFRatio", goodHigh: true },
    { id: "F23", name: "其他应收款/总资产", unit: "%", key: "F23_otherReceivableRatio", isPercent: true, goodLow: true },
    { id: "F24", name: "三源收入一致性", unit: "%", key: "F24_revenueConsistency", isPercent: true, goodHigh: true },
    { id: "F25", name: "EBITDA/有息负债", unit: "倍", key: "F25_ebitdaToDebt", goodHigh: true },
  ]},
  { name: "经营稳定性（F26-F40）", features: [
    { id: "F26", name: "月收入变异系数", unit: "", key: "F26_revenueCV", goodLow: true },
    { id: "F27", name: "Top3客户集中度", unit: "%", key: "F27_topCustomerConcentration", isPercent: true },
    { id: "F28", name: "Top3供应商集中度", unit: "%", key: "F28_topSupplierConcentration", isPercent: true },
    { id: "F29", name: "月均经营性收入", unit: "万元", key: "F29_avgMonthlyRevenue", goodHigh: true },
    { id: "F30", name: "现金流稳定性", unit: "分", key: "F30_cashFlowStability", goodHigh: true },
    { id: "F31", name: "关联交易占收入比", unit: "%", key: "F31_relatedPartyTxRatio", isPercent: true, goodLow: true },
    { id: "F32", name: "发票与流水匹配率", unit: "%", key: "F32_invoiceMatchRate", isPercent: true, goodHigh: true },
    { id: "F33", name: "税务与流水匹配率", unit: "%", key: "F33_taxRevenueMatchRate", isPercent: true, goodHigh: true },
    { id: "F34", name: "历史逾期评分", unit: "分", key: "F34_overdueHistoryScore", goodHigh: true },
    { id: "F35", name: "诉讼风险评分", unit: "分", key: "F35_litigationRiskScore", goodLow: true },
    { id: "F36", name: "舆情风险评分", unit: "分", key: "F36_publicSentimentScore", goodHigh: true },
    { id: "F37", name: "银行账户稳定性", unit: "月", key: "F37_bankAccountStability", goodHigh: true },
    { id: "F38", name: "申请额/月均收入比", unit: "倍", key: "F38_loanRequestRatio", goodLow: true },
    { id: "F39", name: "客户集中度HHI指数", unit: "", key: "F39_hhiCustomerConcentration", goodLow: true },
    { id: "F40", name: "Top1客户依赖度", unit: "%", key: "F40_top1CustomerDependency", isPercent: true, goodLow: true },
  ]},
];

// 特征值格式化函数
function formatFeatureValue(feat: FeatureItem, raw: number): string {
  if (feat.isBool) return raw === 1 ? "是" : "否";
  if (feat.isPercent) return `${(raw * 100).toFixed(2)}%`;
  if (feat.isRatio) return `${(raw * 100).toFixed(2)}%`;
  if (feat.unit === "倍" || feat.unit === "ln") return raw.toFixed(2);
  if (feat.unit === "天") return `${Math.round(raw)}天`;
  if (feat.unit === "万元") return `${raw.toFixed(1)}万`;
  return raw.toFixed(1);
}

// 特征结论生成函数
function getFeatureConclusion(feat: FeatureItem, raw: number): { text: string; level: "good" | "warn" | "bad" | "neutral" } {
  if (feat.isBool) return { text: raw === 1 ? "上市公司,信息透明度高" : "非上市,需关注信息披露质量", level: raw === 1 ? "good" : "neutral" };
  // 特定特征的结论规则
  if (feat.key === "F13_debtRatio") {
    const pct = raw * 100;
    if (pct > 85) return { text: `资产负债率${pct.toFixed(2)}%，超过85%红线，触发硬性规则`, level: "bad" };
    if (pct > 70) return { text: `资产负债率${pct.toFixed(2)}%，偏高，需关注偿债能力`, level: "warn" };
    return { text: `资产负债率${pct.toFixed(2)}%，处于合理区间`, level: "good" };
  }
  if (feat.key === "F14_currentRatio") {
    if (raw < 1) return { text: `流动比率${raw.toFixed(2)}，低于1，短期偿债能力不足`, level: "bad" };
    if (raw < 1.5) return { text: `流动比率${raw.toFixed(2)}，略低，建议关注流动性`, level: "warn" };
    return { text: `流动比率${raw.toFixed(2)}，流动性良好`, level: "good" };
  }
  if (feat.key === "F17_revenueGrowthRate") {
    const pct = raw * 100;
    if (pct < -10) return { text: `营收下滑${Math.abs(pct).toFixed(2)}%，经营恶化`, level: "bad" };
    if (pct < 0) return { text: `营收小幅下滑${Math.abs(pct).toFixed(2)}%，需关注`, level: "warn" };
    if (pct > 30) return { text: `营收高速增长${pct.toFixed(2)}%，成长性强`, level: "good" };
    return { text: `营收增长${pct.toFixed(2)}%，稳健增长`, level: "good" };
  }
  if (feat.key === "F38_loanRequestRatio") {
    if (raw > 10) return { text: `申请额是月均收入的${raw.toFixed(1)}倍，还款压力极大`, level: "bad" };
    if (raw > 6) return { text: `申请额是月均收入的${raw.toFixed(1)}倍，还款压力较大`, level: "warn" };
    return { text: `申请额是月均收入的${raw.toFixed(1)}倍，还款能力充足`, level: "good" };
  }
  if (feat.key === "F34_overdueHistoryScore" || feat.key === "F36_publicSentimentScore") {
    if (raw >= 80) return { text: `评分${raw.toFixed(0)}分，信用记录良好`, level: "good" };
    if (raw >= 60) return { text: `评分${raw.toFixed(0)}分，存在一定风险记录`, level: "warn" };
    return { text: `评分${raw.toFixed(0)}分，风险记录较差`, level: "bad" };
  }
  // 通用规则
  if (feat.goodHigh) {
    const normalized = feat.isPercent || feat.isRatio ? raw * 100 : raw;
    const threshold = feat.isPercent || feat.isRatio ? 60 : undefined;
    if (threshold && normalized < 30) return { text: "偏低,需关注", level: "warn" };
    if (threshold && normalized > 70) return { text: "表现良好", level: "good" };
    return { text: "正常范围", level: "neutral" };
  }
  if (feat.goodLow) {
    if (feat.isPercent && raw * 100 > 70) return { text: "偏高,存在风险", level: "warn" };
    if (raw === 0) return { text: "无风险记录", level: "good" };
    return { text: raw > 3 ? "偏高,需关注" : "正常范围", level: raw > 3 ? "warn" : "neutral" };
  }
  return { text: "已计算", level: "neutral" };
}

// ─── parseType → docId 反向映射（用于 sniffDocType 结果自动匹配资料清单条目）
const PARSE_TYPE_TO_DOC_ID: Record<string, string> = Object.fromEntries(
  Object.entries(DOC_PARSE_TYPE_MAP).map(([docId, parseType]) => [parseType, docId])
);

// ─── Main Component ──────────────────────────────────────────────────────────────────
// ─── 分析引擎面板（折叠式，合并38特征+规则引擎+评分卡+三法额度）───────────────────


// ─── Exports ──────────────────────────────────────────────────────────────────
export type {
  ChatMessage, CompanyCandidate, UploadedFile, ZipFileEntry, AppData,
  AnalysisResult, ParseStep, ParseStepStatus, Top5Item, Top5YearData,
  PanelTab, FeatureItem
};
export {
  DOC_CHECKLIST, DOC_PARSE_TYPE_MAP, PARSE_TYPE_TO_DOC_ID, FINANCIAL_REPORT_KEYWORDS, BANK_STATEMENT_KEYWORDS,
  guessDocType, formatFileSize, FileTypeIcon, getParseSteps,
  PANEL_TABS, FEATURE_GROUPS, formatFeatureValue, getFeatureConclusion
};
