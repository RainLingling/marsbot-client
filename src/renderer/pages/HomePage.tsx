/**
 * Marsbot 火星豹 AI 信贷决策系统 - 对话框模式
 * 左侧：AI对话引导（企业联想搜索 → 文件上传 → 分析结果）
 * 右侧：实时指标面板（资料清单 / 原始数据 / 38特征 / 规则引擎 / 评分卡 / 三法额度）
 */
import { MARSBOT_LOGO_PATH } from "@/lib/brand";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useSaasAuth } from "@/contexts/SaasAuthContext";
import {
  Send, Loader2, Sparkles, LayoutDashboard, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, AlertCircle, FileText, Building2,
  BarChart3, Shield, DollarSign, Activity, RefreshCw, Info, Pencil,
  Paperclip, X, Search, Upload, File, FileSpreadsheet, Image as ImageIcon,
  History, Clock, ExternalLink, Download, Network, Globe, LogOut, UserCircle,
  TrendingUp, Package, Mic, MicOff, Square, User, BookOpen
} from "lucide-react";
import { runLocalAnalysis } from "@/engine/localAnalyzer";
import {
  parseBankStatementExcel,
  parseFinancialStatementExcel,
  parseTop5CustomerExcel,
  parseRevenueBreakdownExcel,
  sniffDocType as localSniffDocType,
  getFirstSheetHeaders,
} from "@/engine/localExcelParser";
import { 
  getHistory, createDraft, updateDraftCompany, updateRecordWithResult,
  deleteRecord, deleteRecordsBatch, getConfig, saveConfig,
  sendChatMessage, transcribeVoiceLocal, searchCompanyLocal
} from "@/lib/localStore";
import { Streamdown } from "streamdown";
import JSZip from "jszip";
import {
  DocChecklistPanel,
  DataVerifyPanel,
  FinancialTableSection,
  Top5EntryBlock,
  Top5DisplayBlock,
  FeaturesPanel,
  RulesPanel,
  ScorecardPanel,
  LimitPanel,
  KnowledgeGraphPanel,
  NineDimensionPanel,
  FinancialAnalysisPanel,
  CreditReportPanel,
  AnalysisEnginePanel,
  ComprehensivePanel,
  CreditDecisionPanel,
  MultiSourcePanel,
  DOC_CHECKLIST,
  DOC_PARSE_TYPE_MAP,
  PARSE_TYPE_TO_DOC_ID,
  FINANCIAL_KEY_LABELS,
  FEATURE_TO_FILE_MAP,
  FEATURE_GROUPS,
  PANEL_TABS,
  formatFeatureValue,
  getFeatureConclusion,
  guessDocType,
  formatFileSize,
  FileTypeIcon,
  getParseSteps,
} from "@/components/panels/SubPanels";
import type { PanelTab, Top5YearData, Top5Item } from "@/components/panels/SubPanels";
import {
  FinancialMultiYearPanel,
  BankFlowPanel,
  TaxAnalysisPanel,
  IndustryAnalysisPanel,
  CrossAnalysisPanel,
} from "@/components/panels/MultiDimPanels";

// ─── Types ────────────────────────────────────────────────────────────────────
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

// 行业名称标准化（与行业本体库 industryOntology 保持一致）
const INDUSTRY_OPTIONS_HOME = [
  "制造业", "批发零售", "建筑业", "科技",
  "农、林、牧、渔业", "餐饮住宿", "房地产",
  "交通运输、仓储和邮政业", "卫生和社会工作",
  "军工/国防科技", "综合",
];
const HOME_INDUSTRY_MAP: Record<string, string> = {
  "贸易": "批发零售", "批发和零售业": "批发零售",
  "批发业": "批发零售", "零售业": "批发零售",
  "零售": "批发零售", "贸易业": "批发零售",
  "建筑": "建筑业", "建筑工程": "建筑业",
  "农业": "农、林、牧、渔业", "农林牧渔": "农、林、牧、渔业",
  "服务业": "餐饮住宿", "餐饮": "餐饮住宿", "住宿": "餐饮住宿",
  "物流": "交通运输、仓储和邮政业", "运输": "交通运输、仓储和邮政业",
  "交通运输": "交通运输、仓储和邮政业", "仓储": "交通运输、仓储和邮政业",
  "医疗": "卫生和社会工作", "医疗健康": "卫生和社会工作",
  "军工": "军工/国防科技", "国防": "军工/国防科技",
  "互联网": "科技", "软件": "科技", "信息技术": "科技",
};
function normalizeIndustryHome(raw: string | undefined): string {
  if (!raw) return "综合";
  if (INDUSTRY_OPTIONS_HOME.includes(raw)) return raw;
  return HOME_INDUSTRY_MAP[raw] ?? raw; // 保留原始值，让用户在数据核验面自行确认
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
    sourceUnit?: '元' | '万元' | '千元' | '百万元'; // 后端已换算后的单位标记，'万元'表示后端已换算完毕，前端无需再换算
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
    monthlyData?: Array<{
      month?: string;
      inflow?: number;
      outflow?: number;
      balance?: number;
    }>;
    top5Counterparties?: Array<{
      name: string;
      amount: number;
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

export default function Home() {
  const [, setLocation] = useLocation();
  const { user: saasUser, isAuthenticated: saasAuthenticated, creditsLeft, logout: saasLogout } = useSaasAuth();
  // SESSION_KEY 按用户 ID 隔离，避免切换账号时泄露对话
  const sessionKeyRef = useRef(`marsbot_session_v2_u${saasUser?.id ?? 'guest'}`);
  // 用户登录后更新 key，并从新 key 加载会话
  useEffect(() => {
    const newKey = `marsbot_session_v2_u${saasUser?.id ?? 'guest'}`;
    if (newKey !== sessionKeyRef.current) {
      sessionKeyRef.current = newKey;
      // 切换账号时清空当前对话，从新用户的存储加载
      try {
        const saved = JSON.parse(sessionStorage.getItem(newKey) || 'null');
        if (saved) {
          setMessages(saved.messages || []);
          setAppData(saved.appData || {});
          setAnalysisResult(saved.analysisResult || null);
          const validTabs: PanelTab[] = ['docs', 'data-verify', 'financial-analysis', 'bank-flow', 'tax-analysis', 'industry-analysis', 'cross-analysis', 'multi-source', 'comprehensive', 'credit-decision', 'analysis-engine'];
          setActiveTab((validTabs.includes(saved.activeTab as PanelTab) ? saved.activeTab : 'docs') as PanelTab);
          setExpandedGroups(saved.expandedGroups || { '主体资质（F01-F12）': true });
          setUploadedDocs(saved.uploadedDocs || {});
          setUploadedFiles(saved.uploadedFiles || []);
          setStep(saved.step || 'welcome');
        } else {
          // 新用户没有历史会话，重置为初始状态
          setMessages([{ role: 'assistant', content: '您好！我是 **Marsbot 火星豹** AI 信贷风控助手 🐆\n\n请输入企业名称开始分析，我会自动搜索企业工商信息。您也可以直接上传材料（营业执照、财务报表、銀行流水等），我会自动识别并提取关键数据。\n\n支持的融资类型：**小额信贷 · 保理融资 · 供应链金融 · 抵押贷款**' }]);
          setAppData({});
          setAnalysisResult(null);
          setStep('welcome');
          setUploadedDocs({});
          setUploadedFiles([]);
        }
      } catch { /* ignore */ }
    }
  }, [saasUser?.id]);
  const SESSION_KEY = sessionKeyRef.current;
  const savedSession = (() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  })();

  const [messages, setMessages] = useState<ChatMessage[]>(savedSession?.messages || [{
    role: "assistant",
    content: "您好！我是 **Marsbot 火星豹** AI 信贷风控助手 🐆\n\n请输入企业名称开始分析，我会自动搜索企业工商信息。您也可以直接上传材料（营业执照、财务报表、銀行流水等），我会自动识别并提取关键数据。\n\n支持的融资类型：**小额信贷 · 保理融资 · 供应链金融 · 抵押贷款**",
  }]);
  const [input, setInput] = useState("");
  const [appData, setAppData] = useState<AppData>(savedSession?.appData || {});
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(savedSession?.analysisResult || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const validTabIds: PanelTab[] = ['docs', 'data-verify', 'financial-analysis', 'bank-flow', 'tax-analysis', 'industry-analysis', 'cross-analysis', 'multi-source', 'comprehensive', 'credit-decision', 'analysis-engine'];
  const [activeTab, setActiveTab] = useState<PanelTab>(
    (savedSession?.activeTab && validTabIds.includes(savedSession.activeTab as PanelTab)) ? savedSession.activeTab as PanelTab : "docs"
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(savedSession?.expandedGroups || { "主体资质（F01-F12）": true });
  // 资料清单状态：docId -> 是否已上传
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>(savedSession?.uploadedDocs || {});
  // 所有已上传文件列表
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(savedSession?.uploadedFiles || []);
  const uploadedFilesRef = useRef<UploadedFile[]>(savedSession?.uploadedFiles || []);
  // Keep ref in sync with state for use in callbacks without stale closures
  useEffect(() => { uploadedFilesRef.current = uploadedFiles; }, [uploadedFiles]);
  // 待确认类型的 Excel 文件（文件名无关键词时触发选择弹窗）
  const [pendingExcelFiles, setPendingExcelFiles] = useState<Array<{ file: File; tempId: string }>>([]);
  // 搜索状态
  const [isSearching, setIsSearching] = useState(false);
  // 步骤：welcome → company-selected → loan-info → analyzing → result
  const [step, setStep] = useState<"welcome" | "company-selected" | "loan-info" | "analyzing" | "result">(savedSession?.step || "welcome");

  const messagesEndRef = useRef<HTMLDivElement>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // [Local] utils stub - replaces tRPC useUtils()
  const utils = {
    loan: {
      getConfig: { invalidate: () => {} },
    },
    client: {
      loan: {
        searchCompany: {
          query: async (_args: { keyword: string }) => {
            return { companies: [] as CompanyCandidate[] };
          },
        },
        getCompanyProfile: {
          query: async (_args: { companyName: string; companyId?: string }) => {
            return { basic: { name: _args.companyName } };
          },
        },
        parseDocument: {
          mutate: async (args: { fileUrl: string; fileType: string; docId?: string }) => {
            try {
              const ft = args.fileType;
              if (ft === 'bank_statement') {
                const result = await parseBankStatementExcel(args.fileUrl);
                return { data: result };
              } else if (ft === 'financial_report' || ft === 'financial_statement') {
                const result = await parseFinancialStatementExcel(args.fileUrl);
                return { data: result };
              } else if (ft === 'top5_customer') {
                const result = await parseTop5CustomerExcel(args.fileUrl);
                return { data: result };
              } else if (ft === 'revenue_breakdown') {
                const result = await parseRevenueBreakdownExcel(args.fileUrl);
                return { data: result };
              } else {
                // 通用 Excel 解析（返回原始行数据）
                const resp = await fetch(args.fileUrl);
                const buffer = await resp.arrayBuffer();
                const XLSX = await import('xlsx');
                const wb = XLSX.read(buffer, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
                return { data: { rawRows: data.slice(0, 100) } };
              }
            } catch (err) {
              console.error('[parseDocument] error:', err);
              return { data: null };
            }
          },
        },
        sniffDocType: {
          mutate: async (args: { fileUrl: string; fileName: string }) => {
            // 先读取第一个 sheet 的表头，再用本地识别函数判断类型
            const headers = await getFirstSheetHeaders(args.fileUrl).catch(() => []);
            const docType = localSniffDocType(args.fileName, headers);
            const typeMap: Record<string, string> = {
              'bank_statement': 'bank_statement',
              'financial_statement': 'financial_report',
              'top5_customer': 'top5_customer',
              'revenue_breakdown': 'revenue_breakdown',
              'tax_declaration': 'tax_report',
              'tax_certificate': 'tax_report',
              'business_license': 'business_license',
              'audit_report': 'audit_report',
              'unknown': 'contract',
            };
            return { parseType: typeMap[docType] || 'contract' };
          },
        },
        updateFileState: {
          mutate: async (_args: unknown) => { /* local: no-op */ },
        },
        getApplicationDetail: {
          query: async (_args: { id: string | number }) => {
            const history = getHistory();
            return history.find((r: { id: string | number }) => String(r.id) === String(_args.id)) || null;
          },
        },
      },
    },
  };
  // [Local] File upload handled locally
  // [Local] Voice transcription handled locally
  // [Local] Config saved to localStorage
  // ── 语音录音状态 ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [_configData, setConfigData] = useState(() => getConfig());
  const configQuery = { data: _configData };
  // Manus OAuth 登录用户信息（保留为兼容，主要使用 SaaS 认证）
  // [Local] No Manus OAuth needed
  const manusUser = null;
  // 使用 SaaS 自建认证状态作为主要登录判断
  const isManusLoggedIn = true; // [Local] Always logged in

  const deleteAppMutation = { mutateAsync: async ({ recordId }: { recordId: string }) => { deleteRecord(recordId); setLocalHistory(getHistory()); } };
  const deleteAppsBatchMutation = { mutateAsync: async ({ recordIds }: { recordIds: string[] }) => { deleteRecordsBatch(recordIds); setLocalHistory(getHistory()); setSelectedAppIds(new Set()); setIsSelectMode(false); } };
  const createDraftMutation = { mutateAsync: async ({ companyName, tenantUserId: _tid }: { companyName: string; tenantUserId?: number | string }) => { const r = createDraft(companyName); setLocalHistory(getHistory()); return r; } };
  const updateDraftCompanyMutation = { mutate: (args: { recordId: string; companyName: string }) => { updateDraftCompany(args.recordId, args.companyName); setLocalHistory(getHistory()); } };
  // [Local] File state managed in React state
  // 当前草稿申请的 recordId（新建申请时创建，企业名确认后更新）
  const [currentDraftRecordId, setCurrentDraftRecordId] = useState<string | null>(null);
  // 正在切换的历史记录 ID（用于显示切换加载状态）
  const [switchingRecordId, setSwitchingRecordId] = useState<number | null>(null);
  // 压缩包解压后的文件条目（按 zipId 存储，用于对话卡片实时更新）
  const [zipEntriesMap, setZipEntriesMap] = useState<Record<string, ZipFileEntry[]>>({});
  // 是否正在等待AI通用回复
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const [modelConfigForm, setModelConfigForm] = useState({ apiKey: '', model: '', apiUrl: '' });
  const [modelConfigSaving, setModelConfigSaving] = useState(false);
  // 历史申请面板（始终加载，企业识别后刷新）
  const [showHistory, setShowHistory] = useState(false);
  const [showCounterpartyForm, setShowCounterpartyForm] = useState(false);
  // 移动端视图切换：chat=对话 | analysis=分析 | history=历史 | profile=我的
  const [mobilePage, setMobilePage] = useState<'chat' | 'analysis' | 'history' | 'profile'>('chat');
  // 申请记录查询：登录用户只能看自己的记录
  const [localHistoryData, setLocalHistory] = useState(() => getHistory());
  const historyQuery = { data: localHistoryData, refetch: () => setLocalHistory(getHistory()) };
  // 历史申请批量删除状态
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<number>>(new Set());

  // 从配置中获取当前模型名称
  const currentModelName = (() => {
    const configs = configQuery.data?.configs || [];
    const modelConfig = configs.find(c => c.key === 'llm_model');
    const apiKeyConfig = configs.find(c => c.key === 'llm_api_key');
    if (!apiKeyConfig?.configured) return 'Marsbot 1.7';
    const model = (modelConfig as { key: string; description: string | null; configured: boolean; value?: string | null } | undefined)?.value || '';
    if (model.includes('deepseek')) return 'DeepSeek';
    if (model.includes('qwen')) return '通义千问';
    if (model.includes('gpt')) return 'GPT-4o';
    return model || '自定义模型';
  })();

  const MODEL_PRESETS = [
    { id: 'builtin', name: 'Marsbot 1.7', desc: '内置模型，无需配置', model: '', apiUrl: '', apiKey: '' },
    { id: 'deepseek', name: 'DeepSeek', desc: '国内领先，性价比高', model: 'deepseek-chat', apiUrl: 'https://api.deepseek.com/v1/chat/completions', apiKey: '' },
    { id: 'qwen', name: '通义千问', desc: '阿里云大模型', model: 'qwen-plus', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', apiKey: '' },
    { id: 'openai', name: 'GPT-4o', desc: 'OpenAI，质量最高', model: 'gpt-4o', apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: '' },
  ];

  const handleModelSelect = async (preset: typeof MODEL_PRESETS[0]) => {
    setShowModelDropdown(false);
    if (preset.id === 'builtin') {
      saveConfig({ llmApiKey: '', llmModel: '', llmApiUrl: '' });
    } else {
      // 非内置模型需要 API Key，跳转到系统设置
      setLocation('/admin/system-settings');
      return;
    }
    utils.loan.getConfig.invalidate();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // 自动保存状态到 sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        messages,
        appData,
        analysisResult,
        activeTab,
        expandedGroups,
        uploadedDocs,
        uploadedFiles,
        step,
      }));
    } catch { /* sessionStorage 满时忽略 */ }
  }, [messages, appData, analysisResult, activeTab, expandedGroups, uploadedDocs, uploadedFiles, step]);

  const addMsg = useCallback((role: "assistant" | "user", content: string, extra?: Partial<ChatMessage>) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date().toISOString(), ...extra }]);
  }, []);

  // ─── 企业联想搜索 ─────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim() || keyword.trim().length < 2) return;
    setIsSearching(true);
    addMsg("user", keyword);
    addMsg("assistant", `🔍 正在搜索「**${keyword}**」相关企业...`);
    try {
      const result = await utils.client.loan.searchCompany.query({ keyword });
      const companies = result?.companies || [];
      if (companies.length === 0) {
        addMsg("assistant", "未找到相关企业，请尝试更精确的名称，或直接上传营业执照让我自动识别。");
      } else {
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = {
            role: "assistant",
            content: `找到 **${companies.length}** 家相关企业，请选择：`,
            searchResults: companies,
            timestamp: new Date().toISOString(),
          };
          return newMsgs;
        });
      }
    } catch {
      addMsg("assistant", "搜索暂时不可用，请直接上传营业执照或手动输入企业信息。");
    } finally {
      setIsSearching(false);
      setInput("");
    }
  }, [addMsg]);

  // ─── 选择候选企业 ─────────────────────────────────────────────────────────
  const handleSelectCompany = useCallback(async (company: CompanyCandidate) => {
    addMsg("assistant", `✅ 已选择 **${company.name}**，正在获取完整工商信息...`);
    setAppData(prev => ({
      ...prev,
      companyName: company.name,
      creditCode: company.creditCode,
      legalPerson: company.legalPerson,
      registeredCapital: company.registeredCapital,
    }));
    try {
      const profile = await utils.client.loan.getCompanyProfile.query({ companyName: company.name, companyId: company.id });
      const basic = profile?.basic || {};
      setAppData(prev => ({
        ...prev,
        companyName: basic.name || company.name,
        creditCode: basic.creditCode || company.creditCode,
        legalPerson: basic.legalPerson || company.legalPerson,
        registeredCapital: basic.registeredCapital || company.registeredCapital,
        establishDate: basic.establishDate,
        address: basic.address,
        industry: normalizeIndustryHome(basic.industry),
        companyType: basic.companyType,
        // 标记数据来源为AI生成（模拟）
        companyDataSource: 'ai_generated',
      }));
      setStep("company-selected");
      addMsg("assistant", `🏢 **${basic.name || company.name}** 工商信息已自动填入：\n\n| 字段 | 内容 |\n|------|------|\n| 统一社会信用代码 | \`${basic.creditCode || company.creditCode}\` |\n| 法定代表人 | ${basic.legalPerson || company.legalPerson} |\n| 注册资本 | ${basic.registeredCapital || company.registeredCapital} |\n| 成立日期 | ${basic.establishDate || "—"} |\n| 所属行业 | ${basic.industry || "—"} |\n| 注册地址 | ${basic.address || "—"} |\n\n请告诉我：**申请金额、贷款类型、贷款期限、用途**，或直接上传财务材料。`);
      setActiveTab("data-verify");
      // 企业名确认后更新草稿记录的企业名
      if (currentDraftRecordId) {
        /* [Local] updateDraftCompany({ recordId: currentDraftRecordId, companyName: basic.name || company.name }) */
      }
      // 企业识别后立即刷新左侧申请列表
      setLocalHistory(getHistory());
    } catch {
      setStep("company-selected");
      addMsg("assistant", `已选择 **${company.name}**。请告诉我申请金额和贷款类型，或上传财务材料。`);
    }
  }, [addMsg, currentDraftRecordId, updateDraftCompanyMutation, utils]);  // ─── 辅助：处理单个文件（上传+解析），供 handleFiles 和 ZIP 解压后调用 ─────────────────
  const processOneFile = useCallback(async (file: File, nf: UploadedFile) => {
    try {
      setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "uploading" } : f));
      // 优先使用 multipart FormData 上传（支持大文件，无 Base64 大小限制）
      // 如果 nf.url 已存在（如 sniff 后重新解析），跳过上传步骤
      let url: string;
      if (nf.url) {
        // 文件已上传（如 sniff 后重新解析），跳过上传步骤
        url = nf.url;
        setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "parsing", url } : f));
      } else {
        // 新文件，需要上传
        try {
          const formData = new FormData();
          formData.append('file', file, file.name);
          // Use AbortController with 3-minute timeout for large files
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);
          try {
            const resp = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json() as { url: string; fileKey: string };
            url = data.url;
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (uploadErr) {
          console.warn('[Upload] multipart failed, falling back to base64:', uploadErr);
          // 回退到 Base64 tRPC 上传
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          // [Local] Use local blob URL
          url = URL.createObjectURL(file);
        }
        // 上传完成，更新状态为 parsing
        setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "parsing", url } : f));
      }
      if (!file.name.match(/\.(zip|rar|7z)$/i)) {
        // Use DOC_PARSE_TYPE_MAP for consistent type mapping
        const parseType = nf.parseType || DOC_PARSE_TYPE_MAP[nf.docId] || "contract";
        // [Local] Parse document via local Excel parser (渲染进程直接解析，无需IPC)
        const parsed = await utils.client.loan.parseDocument.mutate({ fileUrl: url, fileType: parseType, docId: nf.docId });
        if (parsed?.data) {
          const d = parsed.data as Record<string, unknown>;
          setAppData(prev => {
            const updates: Partial<AppData> = {};
            const parsedCompanyName = (d.companyName || d.company) as string | undefined;
            // Bug2修复：营业执照解析时强制更新基本信息（不受已有数据限制）
            if (parseType === 'business_license') {
              if (parsedCompanyName) updates.companyName = String(parsedCompanyName);
              if (d.creditCode) updates.creditCode = String(d.creditCode);
              if (d.legalPerson) updates.legalPerson = String(d.legalPerson);
              if (d.registeredCapital) updates.registeredCapital = String(d.registeredCapital);
              if (d.establishDate) updates.establishDate = String(d.establishDate);
              if (d.address) updates.address = String(d.address);
            } else {
              if (parsedCompanyName && !prev.companyName) updates.companyName = String(parsedCompanyName);
              if (d.creditCode && !prev.creditCode) updates.creditCode = String(d.creditCode);
              if (d.legalPerson && !prev.legalPerson) updates.legalPerson = String(d.legalPerson);
              if (d.registeredCapital && !prev.registeredCapital) updates.registeredCapital = String(d.registeredCapital);
              if (d.establishDate && !prev.establishDate) updates.establishDate = String(d.establishDate);
              if (d.address && !prev.address) updates.address = String(d.address);
            }
            if (parseType === 'business_license' && (d.companyName || d.creditCode)) updates.companyDataSource = 'business_license';
            if (d.revenue && !prev.revenue) updates.revenue = String(d.revenue);
            if (d.netProfit && !prev.netProfit) updates.netProfit = String(d.netProfit);
            if (d.totalAssets && !prev.totalAssets) updates.totalAssets = String(d.totalAssets);
            if (d.totalLiabilities && !prev.totalLiabilities) updates.totalLiabilities = String(d.totalLiabilities);
            if (d.operatingCashFlow && !prev.operatingCashFlow) updates.operatingCashFlow = String(d.operatingCashFlow);
            if (d.currentRatio && !prev.currentRatio) updates.currentRatio = String(d.currentRatio);
            if (d.quickRatio && !prev.quickRatio) updates.quickRatio = String(d.quickRatio);
            if (d.roe && !prev.roe) updates.roe = String(d.roe);
            // 存储财务摘要（始终更新为最新解析的摘要）
            if (d.summary && (parseType === 'financial_report' || parseType === 'audit_report')) {
              updates.financialSummary = String(d.summary);
            }
            if (parseType === 'bank_statement' && Object.keys(d).length > 0) {
              // 修复问题4：合并银行流水数据，不直接覆盖，保留所有月份
              const prevBankData = prev.bankData as Record<string, unknown> | undefined;
              if (prevBankData && Array.isArray(prevBankData.monthlyStats) && Array.isArray((d as any).monthlyStats)) {
                const existingMonthsMap = new Map<string, Record<string, unknown>>(
                  (prevBankData.monthlyStats as Array<Record<string, unknown>>).map((m) => [String(m.month || ''), { ...m }])
                );
                for (const m of (d as any).monthlyStats as Array<Record<string, unknown>>) {
                  const mKey = String(m.month || '');
                  if (!mKey) continue;
                  if (existingMonthsMap.has(mKey)) {
                    const ex = existingMonthsMap.get(mKey)!;
                    existingMonthsMap.set(mKey, {
                      ...ex, ...m,
                      income: (parseFloat(String(ex.income ?? ex.inflow ?? 0)) || 0) + (parseFloat(String(m.income ?? m.inflow ?? 0)) || 0),
                      inflow: (parseFloat(String(ex.inflow ?? ex.income ?? 0)) || 0) + (parseFloat(String(m.inflow ?? m.income ?? 0)) || 0),
                      outflow: (parseFloat(String(ex.outflow ?? 0)) || 0) + (parseFloat(String(m.outflow ?? 0)) || 0),
                    });
                  } else {
                    existingMonthsMap.set(mKey, m);
                  }
                }
                const mergedMonthly = Array.from(existingMonthsMap.values()).sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
                const mergedInflow = mergedMonthly.reduce((s, m) => s + (parseFloat(String(m.inflow ?? m.income ?? 0)) || 0), 0);
                const mergedOutflow = mergedMonthly.reduce((s, m) => s + (parseFloat(String(m.outflow ?? 0)) || 0), 0);
                updates.bankData = {
                  ...prevBankData,
                  ...d,
                  monthlyStats: mergedMonthly,
                  totalInflow: mergedInflow || (parseFloat(String(prevBankData.totalInflow ?? 0)) || 0) + (parseFloat(String((d as any).totalInflow ?? 0)) || 0),
                  totalOutflow: mergedOutflow || (parseFloat(String(prevBankData.totalOutflow ?? 0)) || 0) + (parseFloat(String((d as any).totalOutflow ?? 0)) || 0),
                  top5Counterparties: (d as any).top5Counterparties || prevBankData.top5Counterparties,
                };
              } else {
                updates.bankData = prevBankData ? { ...prevBankData, ...d } : d;
              }
            }
            if ((['tax_vat', 'tax_income', 'tax_clearance', 'tax_credit'] as string[]).includes(parseType) && Object.keys(d).length > 0) {
              // 按类型分别存储，避免多次上传互相覆盖
              const typeKey = parseType === 'tax_vat' ? 'vat' : parseType === 'tax_income' ? 'income' : parseType === 'tax_clearance' ? 'clearance' : 'credit';
              updates.taxDataByType = { ...prev.taxDataByType, [typeKey]: { ...d, taxType: parseType } };
              // 同时保留 taxData 兼容旧逻辑
              updates.taxData = { ...prev.taxData, ...d, taxType: parseType };
              // 支持 byYear 多年数据（新版 LLM 返回格式）
              const prevByYear = prev.taxDataByYear || {};
              let newByYear = { ...prevByYear };
              if (Array.isArray((d as any).byYear) && (d as any).byYear.length > 0) {
                // 多年数据：遍历所有年份
                for (const yearData of (d as any).byYear) {
                  const taxYear = String(yearData.taxYear || yearData.year || yearData.reportYear || '未知年份');
                  const prevYearData = newByYear[taxYear] || {};
                  newByYear[taxYear] = { ...prevYearData, [typeKey]: { ...yearData, taxType: parseType } };
                }
              } else {
                // 单年数据（兼容旧格式）
                const taxYear = String((d as any).taxYear || (d as any).year || (d as any).reportYear || (d as any).taxPeriod || '未知年份');
                const prevYearData = newByYear[taxYear] || {};
                newByYear[taxYear] = { ...prevYearData, [typeKey]: { ...d, taxType: parseType } };
              }
              updates.taxDataByYear = newByYear;
            }
            if ((parseType === 'invoice' || parseType === 'contract') && Object.keys(d).length > 0) updates.parsedDocuments = [...(prev.parsedDocuments || []), { fileType: parseType, data: d }];
            // 修复：扩大条件，只要有任何财务数据（三张表或顶层快捷字段）都进入多年份分支
            const hasAnyFinancialData = d.balanceSheet || d.incomeStatement || d.cashFlowStatement ||
              d.revenue != null || d.netProfit != null || d.totalAssets != null || d.totalLiabilities != null ||
              d.operatingCashFlow != null || d.grossMargin != null || d.netProfitMargin != null;
            if ((parseType === 'financial_report' || parseType === 'audit_report') && hasAnyFinancialData) {
              const toStringRecord = (obj: unknown): Record<string, string | null> => {
                if (!obj || typeof obj !== 'object') return {};
                const result: Record<string, string | null> = {};
                for (const [k, v] of Object.entries(obj as Record<string, unknown>)) result[k] = v != null ? String(v) : null;
                return result;
              };
              updates.financialStatements = {
                balanceSheet: d.balanceSheet ? toStringRecord(d.balanceSheet) : prev.financialStatements?.balanceSheet,
                incomeStatement: d.incomeStatement ? toStringRecord(d.incomeStatement) : prev.financialStatements?.incomeStatement,
                cashFlowStatement: d.cashFlowStatement ? toStringRecord(d.cashFlowStatement) : prev.financialStatements?.cashFlowStatement,
              };
              const bs = d.balanceSheet as Record<string, unknown> | null | undefined;
              const is_ = d.incomeStatement as Record<string, unknown> | null | undefined;
              const cf = d.cashFlowStatement as Record<string, unknown> | null | undefined;
              const fileNameForYear = nf.name || "";
              const normalizeYear = (raw: string): string => { if (raw.length === 4) return raw; const n = parseInt(raw); return n >= 90 ? `19${raw}` : `20${raw}`; };
              let yearFromFileName: string | null = null;
              const fn4 = fileNameForYear.match(/(20\d{2})/);
              if (fn4) yearFromFileName = fn4[1];
              else { const fn2 = fileNameForYear.match(/[^\d](\d{2})年/); if (fn2) yearFromFileName = normalizeYear(fn2[1]); else { const fn2b = fileNameForYear.match(/^(\d{2})年/); if (fn2b) yearFromFileName = normalizeYear(fn2b[1]); } }
              const rawDate = String(bs?.reportDate || is_?.reportPeriod || cf?.reportPeriod || "");
              const rawDateYear4 = rawDate.match(/(20\d{2})/);
              const rawDateYear2 = rawDate.match(/[^\d](\d{2})年/) || rawDate.match(/^(\d{2})年/);
              const yearFromDate = rawDateYear4 ? rawDateYear4[1] : (rawDateYear2 ? normalizeYear(rawDateYear2[1]) : null);
              const year = yearFromFileName || yearFromDate || new Date().getFullYear().toString();
              // 提取精确报告期（月/季/年）
              const extractReportPeriod = (rawDateStr: string, yr: string): { period: string; type: 'annual' | 'monthly' | 'quarterly' | 'interim' } => {
                const monthMatch = rawDateStr.match(/(20\d{2})[年-](\d{1,2})[月-]?\d*/);
                if (monthMatch) {
                  const m = parseInt(monthMatch[2]);
                  if (m === 12) return { period: yr, type: 'annual' };
                  if (m === 6) return { period: `${yr}-H1`, type: 'interim' };
                  if (m === 3 || m === 9) return { period: `${yr}-Q${Math.ceil(m/3)}`, type: 'quarterly' };
                  return { period: `${yr}-${String(m).padStart(2, '0')}`, type: 'monthly' };
                }
                const fnMonthMatch = fileNameForYear.match(/(20\d{2})[年-]?(\d{1,2})[月-]/);
                if (fnMonthMatch) {
                  const m = parseInt(fnMonthMatch[2]);
                  if (m === 12) return { period: yr, type: 'annual' };
                  return { period: `${yr}-${String(m).padStart(2, '0')}`, type: 'monthly' };
                }
                return { period: yr, type: 'annual' };
              };
              const { period: reportPeriod, type: periodType } = extractReportPeriod(rawDate, year);
              // 修复：把顶层快捷字段合并进 incomeStatement，防止 incomeStatement 为空时财报分析无数据
              const topLevelIncomeFields: Record<string, string | null> = {};
              if (d.revenue != null) topLevelIncomeFields['revenue'] = String(d.revenue);
              if (d.netProfit != null) topLevelIncomeFields['netProfit'] = String(d.netProfit);
              if (d.operatingCashFlow != null) topLevelIncomeFields['operatingCashFlow'] = String(d.operatingCashFlow);
              if (d.grossMargin != null) topLevelIncomeFields['grossMargin'] = String(d.grossMargin);
              if (d.netProfitMargin != null) topLevelIncomeFields['netProfitMargin'] = String(d.netProfitMargin);
              if (d.roe != null) topLevelIncomeFields['roe'] = String(d.roe);
              const topLevelBsFields: Record<string, string | null> = {};
              if (d.totalAssets != null) topLevelBsFields['totalAssets'] = String(d.totalAssets);
              if (d.totalLiabilities != null) topLevelBsFields['totalLiabilities'] = String(d.totalLiabilities);
              if (d.currentRatio != null) topLevelBsFields['currentRatio'] = String(d.currentRatio);
              if (d.quickRatio != null) topLevelBsFields['quickRatio'] = String(d.quickRatio);
              if (d.debtRatio != null) topLevelBsFields['debtRatio'] = String(d.debtRatio);
              const mergedIncomeStatement = d.incomeStatement
                ? { ...topLevelIncomeFields, ...toStringRecord(d.incomeStatement) }
                : (Object.keys(topLevelIncomeFields).length > 0 ? { ...topLevelIncomeFields, ...(prev.financialStatementsByYear?.[year]?.incomeStatement || {}) } : prev.financialStatementsByYear?.[year]?.incomeStatement);
              const mergedBalanceSheet = d.balanceSheet
                ? { ...topLevelBsFields, ...toStringRecord(d.balanceSheet) }
                : (Object.keys(topLevelBsFields).length > 0 ? { ...topLevelBsFields, ...(prev.financialStatementsByYear?.[year]?.balanceSheet || {}) } : prev.financialStatementsByYear?.[year]?.balanceSheet);
              // BUG1修复：用 hasKeys 检查对象是否有实际内容，防止空对象覆盖已有财务数据
              const hasKeys = (obj: unknown) => obj && typeof obj === 'object' && Object.keys(obj as object).length > 0;
              const mergedCashFlow = hasKeys(d.cashFlowStatement) ? toStringRecord(d.cashFlowStatement) : prev.financialStatementsByYear?.[year]?.cashFlowStatement;
              // 读取后端返回的 _excelMeta.unit，标记数据已是万元单位（防止前端二次换算）
              const excelSourceUnit = (d as any)?._excelMeta?.unit as ('元' | '万元' | '千元' | '百万元') | undefined;
              updates.financialStatementsByYear = { ...prev.financialStatementsByYear, [year]: { year, reportPeriod, periodType, fileName: nf.name, balanceSheet: mergedBalanceSheet, incomeStatement: mergedIncomeStatement, cashFlowStatement: mergedCashFlow, sourceUnit: excelSourceUnit || '万元' } };
              // 修复：从三张表子字段中提取快捷字段（财务摘要），确保数据校核显示正确
              const bsData = d.balanceSheet as Record<string, unknown> | null | undefined;
              const isData = d.incomeStatement as Record<string, unknown> | null | undefined;
              const cfData = d.cashFlowStatement as Record<string, unknown> | null | undefined;
              const extractNum = (obj: Record<string, unknown> | null | undefined, ...keys: string[]): string | undefined => {
                if (!obj) return undefined;
                for (const k of keys) { if (obj[k] != null && obj[k] !== '') return String(obj[k]); }
                return undefined;
              };
              // 字段别名映射（英文 -> 中文，用于 LLM 直接返回中文字段名时的兼容）
              const FIELD_ALIASES: Record<string, string[]> = {
                revenue: ['revenue', 'operatingRevenue', 'totalRevenue', 'is_001', '营业收入', '营业总收入', '主营业务收入'],
                netProfit: ['netProfit', 'netIncome', 'is_020', '净利润', '净利润（亏损）', '净利润(亏损)'],
                totalAssets: ['totalAssets', 'bs_037', '资产总计', '资产合计', '总资产'],
                totalLiabilities: ['totalLiabilities', 'bs_064', '负债合计', '负债总计', '总负债'],
                operatingCashFlow: ['operatingCashFlow', 'netOperatingCashFlow', 'cf_010', '经营活动产生的现金流量净额', '经营活动现金流量净额', '经营活动现金净流量'],
              };
              const extractNumWithAlias = (obj: Record<string, unknown> | null | undefined, primaryKey: string): string | undefined => {
                if (!obj) return undefined;
                const aliases = FIELD_ALIASES[primaryKey] ?? [primaryKey];
                for (const k of aliases) { if (obj[k] != null && obj[k] !== '') return String(obj[k]); }
                return undefined;
              };
              // 单位换算：如果后端 Excel 路径已换算为万元（_excelMeta 存在），跳过兆底换算；
              // 否则（PDF/图片路径），如果数值 > 500万，认为是元单位，自动换算为万元
              const isBackendConverted = !!(d as any)?._excelMeta; // 有 _excelMeta 表示后端已按 unitFactor 换算完毕
              const toWanYuan = (val: string | undefined): string | undefined => {
                if (!val) return val;
                if (isBackendConverted) return val; // 后端已换算，直接返回
                const n = parseFloat(String(val).replace(/,/g, ''));
                if (!isNaN(n) && Math.abs(n) > 5000000) return (n / 10000).toFixed(2);
                return val;
              };
              const newRevenue = toWanYuan(extractNumWithAlias(isData, 'revenue') || extractNum(isData, 'revenue', 'operatingRevenue', 'totalRevenue') || (d.revenue ? String(d.revenue) : undefined));
              const newNetProfit = toWanYuan(extractNumWithAlias(isData, 'netProfit') || extractNum(isData, 'netProfit', 'netIncome') || (d.netProfit ? String(d.netProfit) : undefined));
              const newTotalAssets = toWanYuan(extractNumWithAlias(bsData, 'totalAssets') || extractNum(bsData, 'totalAssets') || (d.totalAssets ? String(d.totalAssets) : undefined));
              const newTotalLiabilities = toWanYuan(extractNumWithAlias(bsData, 'totalLiabilities') || extractNum(bsData, 'totalLiabilities') || (d.totalLiabilities ? String(d.totalLiabilities) : undefined));
              const newOperatingCashFlow = toWanYuan(extractNumWithAlias(cfData, 'operatingCashFlow') || extractNum(cfData, 'operatingCashFlow', 'netOperatingCashFlow', 'cashFromOperations') || (d.operatingCashFlow ? String(d.operatingCashFlow) : undefined));
              // 始终用最新解析的财务报表更新快捷字段（不受 !prev.revenue 限制）
              if (newRevenue) updates.revenue = newRevenue;
              if (newNetProfit) updates.netProfit = newNetProfit;
              if (newTotalAssets) updates.totalAssets = newTotalAssets;
              if (newTotalLiabilities) updates.totalLiabilities = newTotalLiabilities;
              if (newOperatingCashFlow) updates.operatingCashFlow = newOperatingCashFlow;
            }
                        if (parseType === 'audit_report') {
              // 即使某些字段为 null，只要有 auditOpinion 或其他审计相关字段，就保存
              const hasAuditData = d.auditOpinion || d.auditStatus || d.auditor || d.auditFirm || d.auditDate || d.issuedDate;
              if (hasAuditData) {
                updates.auditReport = {
                  reportYear: (d.taxYear || d.reportYear || d.year) as string | undefined,
                  auditOpinion: (d.auditOpinion || d.auditStatus) as string | undefined,
                  auditFirm: (d.auditor || d.auditFirm) as string | undefined,
                  auditDate: (d.auditDate || d.issuedDate) as string | undefined,
                  financialDataFromAudit: d,
                  fileName: nf.name,
                };
              }
            }
            // ─── 新字段映射：高管/资质/经营概况/他行授信/收入构成/银行流水汇总 ───
            if (parseType === 'mgmt_resume' && d) {
              const exec = {
                name: d.name as string | undefined,
                position: d.title as string | undefined,
                gender: d.gender as string | undefined,
                birthDate: d.birthDate as string | undefined,
                education: d.education as string | undefined,
                phone: d.phone as string | undefined,
                workExperience: Array.isArray(d.workHistory) ? (d.workHistory as any[]).map((w: any) => `${w.company || ''} ${w.title || ''} ${w.period || ''}`).join('; ') : undefined,
              };
              updates.keyExecutives = [...(prev.keyExecutives || []), exec];
            }
            if (parseType === 'qualification' && d) {
              const qual = {
                certName: (d.certName || d.name) as string | undefined,
                certNumber: (d.certNo || d.certNumber) as string | undefined,
                certType: (d.certLevel || d.certType) as string | undefined,
                issueDate: d.issueDate as string | undefined,
                expiryDate: d.expiryDate as string | undefined,
                issuingAuthority: d.issuingAuthority as string | undefined,
              };
              updates.qualifications = [...(prev.qualifications || []), qual];
            }
            if (parseType === 'business_intro' && d) {
              updates.companyProfile = {
                companyIntro: (d.mainBusiness || d.description || d.companyIntro) as string | undefined,
                mainProducts: Array.isArray(d.mainProducts) ? d.mainProducts as string[] : undefined,
                upstreamDesc: (d.upstreamDesc || d.upstreamSuppliers) as string | undefined,
                downstreamDesc: (d.targetMarket || d.downstreamDesc || d.downstreamCustomers) as string | undefined,
                coreCompetitiveness: (d.competitiveAdvantage || d.coreCompetitiveness) as string | undefined,
                patentCount: typeof d.patentCount === 'number' ? d.patentCount : undefined,
              };
              // 自动识别并更新所属行业（仅在用户未手动设置时）
              const detectedIndustry = (d.industry || d.industryCategory || d.sector) as string | undefined;
              if (detectedIndustry && !prev.industry) {
                updates.industry = detectedIndustry;
              }
              // 从公司介绍中补充公司名称
              if ((d.companyName as string | undefined) && !prev.companyName) {
                updates.companyName = d.companyName as string;
              }
            }
            if (parseType === 'credit_facility' && d) {
              const facilities = Array.isArray(d.facilities) ? (d.facilities as any[]).map((f: any) => ({
                bankName: f.bank as string | undefined,
                facilityType: f.facilityType as string | undefined,
                creditAmount: typeof f.creditLimit === 'number' ? f.creditLimit : undefined,
                outstandingBalance: typeof f.usedAmount === 'number' ? f.usedAmount : undefined,
                startDate: undefined as string | undefined,
                endDate: f.expiryDate as string | undefined,
                guaranteeType: f.collateral as string | undefined,
              })) : [];
              updates.creditFacilities = [...(prev.creditFacilities || []), ...facilities];
            }
            if (parseType === 'revenue_breakdown' && d) {
              // 支持多年数据（byYear 格式）和单年数据（revenueByProduct 格式）
              let allSegments: any[] = [];
              if (Array.isArray((d as any).byYear) && (d as any).byYear.length > 0) {
                // 直接解析返回的多年格式
                for (const yearData of (d as any).byYear as any[]) {
                  const yr = String(yearData.year || '');
                  const period = yearData.period ? `${yr}(${yearData.period})` : yr;
                  for (const seg of (yearData.segments || []) as any[]) {
                    allSegments.push({
                      segmentName: seg.segmentName as string | undefined,
                      revenue: typeof seg.revenue === 'number' ? seg.revenue * 10000 : undefined,
                      revenueRatio: typeof seg.revenueRatio === 'number' ? seg.revenueRatio : undefined,
                      year: period,
                    });
                  }
                }
              } else if (Array.isArray(d.revenueByProduct)) {
                // LLM 解析返回的单年格式
                allSegments = (d.revenueByProduct as any[]).map((p: any) => ({
                  segmentName: p.product as string | undefined,
                  revenue: typeof p.revenue === 'number' ? p.revenue * 10000 : undefined,
                  revenueRatio: typeof p.ratio === 'number' ? p.ratio : undefined,
                  year: (d.reportYear || '') as string,
                }));
              }
              if (allSegments.length > 0) {
                updates.businessSegments = allSegments;
              }
            }
            if (parseType === 'bank_statement' && d) {
              // 银行流水解析结果单位为「元」，统一换算为「万元」与财务报表对齐
              const toWan = (v: number | undefined) => v != null ? parseFloat((v / 10000).toFixed(4)) : undefined;
              const monthlyData = Array.isArray(d.monthlyStats) ? (d.monthlyStats as any[]).map((m: any) => {
                const rawInflow = typeof m.inflow === 'number' ? m.inflow : (typeof m.income === 'number' ? m.income : (typeof m.creditAmount === 'number' ? m.creditAmount : undefined));
                const rawOutflow = typeof m.outflow === 'number' ? m.outflow : (typeof m.expense === 'number' ? m.expense : (typeof m.debitAmount === 'number' ? m.debitAmount : undefined));
                const rawBalance = typeof m.balance === 'number' ? m.balance : (typeof m.closingBalance === 'number' ? m.closingBalance : undefined);
                return {
                  month: (m.month || m.yearMonth || m.period) as string | undefined,
                  inflow: toWan(rawInflow),
                  outflow: toWan(rawOutflow),
                  balance: toWan(rawBalance),
                };
              }) : undefined;
              const rawNewInflow = typeof d.totalInflow === 'number' ? d.totalInflow : (typeof d.totalInflow === 'string' ? parseFloat(d.totalInflow) : undefined);
              const rawNewOutflow = typeof d.totalOutflow === 'number' ? d.totalOutflow : (typeof d.totalOutflow === 'string' ? parseFloat(d.totalOutflow) : undefined);
              const newInflow = toWan(rawNewInflow);
              const newOutflow = toWan(rawNewOutflow);
              // 累加合并：新月份追加，已有月份保留，汇总 totalInflow/totalOutflow/statementPeriod
              // 累加合并：同一月份的收支累加（可能来自同一账户不同文件段），不同月份追加
              const existingMonths1 = new Map((prev.bankFlowSummary?.monthlyData || []).map((m: any) => [m.month, { ...m }]));
              for (const m of (monthlyData || [])) {
                if (!m.month) continue;
                if (existingMonths1.has(m.month)) {
                  const ex = existingMonths1.get(m.month)!;
                  existingMonths1.set(m.month, { month: m.month, inflow: (ex.inflow ?? 0) + (m.inflow ?? 0), outflow: (ex.outflow ?? 0) + (m.outflow ?? 0), balance: m.balance ?? ex.balance });
                } else { existingMonths1.set(m.month, m); }
              }
              const merged1 = Array.from(existingMonths1.values()).sort((a: any, b: any) => (a.month || '').localeCompare(b.month || ''));
              const mergedInflow1 = merged1.reduce((s: number, m: any) => s + (m.inflow ?? 0), 0);
              const mergedOutflow1 = merged1.reduce((s: number, m: any) => s + (m.outflow ?? 0), 0);
              const months1 = merged1.map((m: any) => m.month).filter(Boolean) as string[];
              const startDate1 = months1.length > 0 ? months1[0] : undefined;
              const endDate1 = months1.length > 0 ? months1[months1.length - 1] : undefined;
              // 保存 top5Counterparties（来自 LLM 解析的 PDF 流水）
              const newTop5 = Array.isArray((d as any).top5Counterparties) ? (d as any).top5Counterparties : undefined;
              updates.bankFlowSummary = {
                totalInflow: mergedInflow1 > 0 ? mergedInflow1 : (newInflow != null ? newInflow : (prev.bankFlowSummary?.totalInflow ?? 0)),
                totalOutflow: mergedOutflow1 > 0 ? mergedOutflow1 : (newOutflow != null ? newOutflow : (prev.bankFlowSummary?.totalOutflow ?? 0)),
                netCashFlow: (mergedInflow1 > 0 ? mergedInflow1 : (newInflow ?? 0)) - (mergedOutflow1 > 0 ? mergedOutflow1 : (newOutflow ?? 0)),
                statementPeriod: startDate1 && endDate1 ? `${startDate1} ~ ${endDate1}` : (d.statementPeriod as string | undefined),
                startDate: startDate1,
                endDate: endDate1,
                monthCount: merged1.length,
                accountName: (d.accountName as string | undefined) || prev.bankFlowSummary?.accountName,
                bankName: (d.bankName as string | undefined) || prev.bankFlowSummary?.bankName,
                monthlyData: merged1,
                top5Counterparties: newTop5 || prev.bankFlowSummary?.top5Counterparties,
              };
            }
            if (parseType === 'bank_permit' && d) {
              // 开户许可证数据存入 parsedDocuments
              updates.parsedDocuments = [...(prev.parsedDocuments || []), { fileType: 'bank_permit', data: d }];
            }
            // ─── TOP5 甲方/供应商数据映射 ───────────────────────────────────────────────────
            if (parseType === 'top5_customer' && d) {
              // 支持多年数据（byYear 格式）和单年数据（top5Customers 格式）
              if (Array.isArray((d as any).byYear) && (d as any).byYear.length > 0) {
                // 直接解析返回的多年格式
                const existingCustomerYears = prev.top5Customers || [];
                const existingSupplierYears = prev.top5Suppliers || [];
                let newCustomerYears = [...existingCustomerYears];
                let newSupplierYears = [...existingSupplierYears];
                for (const yearData of (d as any).byYear as any[]) {
                  const yr = yearData.year as number;
                  const customers = (yearData.customers || []).map((c: any) => ({
                    rank: c.rank, name: c.name, amount: c.amount, ratio: c.ratio, notes: c.notes || '',
                  }));
                  const suppliers = (yearData.suppliers || []).map((s: any) => ({
                    rank: s.rank, name: s.name, amount: s.amount, ratio: s.ratio, notes: s.notes || '',
                  }));
                  if (customers.length > 0) {
                    newCustomerYears = [...newCustomerYears.filter(y => y.year !== yr), { year: yr, items: customers }];
                  }
                  if (suppliers.length > 0) {
                    newSupplierYears = [...newSupplierYears.filter(y => y.year !== yr), { year: yr, items: suppliers }];
                  }
                }
                if (newCustomerYears.length > (prev.top5Customers || []).length || 
                    JSON.stringify(newCustomerYears) !== JSON.stringify(prev.top5Customers)) {
                  updates.top5Customers = newCustomerYears.sort((a, b) => a.year - b.year);
                }
                if (newSupplierYears.length > (prev.top5Suppliers || []).length ||
                    JSON.stringify(newSupplierYears) !== JSON.stringify(prev.top5Suppliers)) {
                  updates.top5Suppliers = newSupplierYears.sort((a, b) => a.year - b.year);
                }
              } else {
                // LLM 解析返回的单年格式
                const year = d.reportYear ? parseInt(String(d.reportYear)) : new Date().getFullYear();
                const customers = Array.isArray(d.top5Customers) ? (d.top5Customers as any[]).map((c: any, idx: number) => ({
                  rank: typeof c.rank === 'number' ? c.rank : idx + 1,
                  name: String(c.name || ''),
                  amount: c.annualRevenue != null ? String(c.annualRevenue) : '',
                  ratio: c.revenueRatio != null ? String(c.revenueRatio) : '',
                  notes: [c.industry, c.creditRating ? `信用${c.creditRating}` : '', c.cooperationYears ? `合作${c.cooperationYears}年` : ''].filter(Boolean).join(' / '),
                })) : [];
                if (customers.length > 0) {
                  const existingYears = prev.top5Customers || [];
                  const filtered = existingYears.filter(y => y.year !== year);
                  updates.top5Customers = [...filtered, { year, items: customers }];
                }
                // 同时提取营收构成数据（如果文件包含）
                if (d.revenueBreakdown && typeof d.revenueBreakdown === 'object' && d.revenueBreakdown !== null) {
                  const rb = d.revenueBreakdown as any;
                  // 支持 revenueByProduct 和 byProduct 两种格式
                  const productList = Array.isArray(rb.revenueByProduct) ? rb.revenueByProduct
                    : Array.isArray(rb.byProduct) ? rb.byProduct : [];
                  const byProduct = productList.map((p: any) => ({
                    segmentName: String(p.product || p.segmentName || p.name || ''),
                    revenue: typeof p.revenue === 'number' ? p.revenue : (typeof p.amount === 'number' ? p.amount : 0),
                    revenueRatio: typeof p.ratio === 'number' ? p.ratio : (typeof p.revenueRatio === 'number' ? p.revenueRatio : 0),
                    year: String(year),
                  }));
                  if (byProduct.length > 0) {
                    // 合并：同年数据覆盖，不同年追加
                    const existingSegs = prev.businessSegments || [];
                    const filteredSegs = existingSegs.filter((s: any) => String(s.year) !== String(year));
                    updates.businessSegments = [...filteredSegs, ...byProduct];
                    setTimeout(() => setUploadedDocs(prev2 => ({ ...prev2, 'revenue-breakdown': true })), 0);
                  }
                }
              }
            }
            if (parseType === 'top5_supplier' && d) {
              const year = d.reportYear ? parseInt(String(d.reportYear)) : new Date().getFullYear();
              const suppliers = Array.isArray(d.top5Suppliers) ? (d.top5Suppliers as any[]).map((s: any, idx: number) => ({
                rank: typeof s.rank === 'number' ? s.rank : idx + 1,
                name: String(s.name || ''),
                amount: s.annualPurchase != null ? String(s.annualPurchase) : '',
                ratio: s.purchaseRatio != null ? String(s.purchaseRatio) : '',
                notes: [s.industry, s.cooperationYears ? `合作${s.cooperationYears}年` : ''].filter(Boolean).join(' / '),
              })) : [];
              if (suppliers.length > 0) {
                const existingYears = prev.top5Suppliers || [];
                const filtered = existingYears.filter(y => y.year !== year);
                updates.top5Suppliers = [...filtered, { year, items: suppliers }];
              }
            }
            return { ...prev, ...updates };
          });
        }
        setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "done", parsedData: parsed?.data as Record<string, unknown> } : f));
      } else {
        setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "done" } : f));
      }
      setUploadedDocs(prev => ({ ...prev, [nf.docId]: true }));
    } catch {
      setUploadedFiles(prev => prev.map(f => f.id === nf.id ? { ...f, status: "error" } : f));
      setUploadedDocs(prev => ({ ...prev, [nf.docId]: true }));
    }
  }, [utils]);

  // ─── 重试解析（有URL时跳过上传直接解析，没有URL时重新上传） ─────────────────────
  const retryParseFile = useCallback(async (fileId: string) => {
    const f = uploadedFilesRef.current.find(f => f.id === fileId);
    if (!f) return;
    // 有原始文件对象且是有效的 Blob → 重新走完整上传+解析流程
    if (f._file && f._file instanceof Blob) {
      const retryNf = { ...f, status: 'uploading' as const };
      setUploadedFiles(prev => prev.map(x => x.id === fileId ? retryNf : x));
      processOneFile(f._file, retryNf);
      return;
    }
    // 有URL但没有原始文件 → 跳过上传，直接重新解析
    if (f.url) {
      setUploadedFiles(prev => prev.map(x => x.id === fileId ? { ...x, status: 'parsing' as const } : x));
      try {
        const parseType = f.parseType || DOC_PARSE_TYPE_MAP[f.docId] || 'contract';
        const parsed = await utils.client.loan.parseDocument.mutate({ fileUrl: f.url!, fileType: parseType as any, docId: f.docId });
        if (parsed?.data) {
          setUploadedFiles(prev => prev.map(x => x.id === fileId ? { ...x, status: 'done' as const, parsedData: parsed.data as Record<string, unknown> } : x));
        } else {
          setUploadedFiles(prev => prev.map(x => x.id === fileId ? { ...x, status: 'done' as const } : x));
        }
      } catch {
        setUploadedFiles(prev => prev.map(x => x.id === fileId ? { ...x, status: 'error' as const } : x));
      }
      return;
    }
    // 既没有文件也没有URL → 提示用户重新上传
    alert('文件已丢失，请重新上传该文件');
  }, [processOneFile, utils]);

  // ─── 文件状态自动持久化：uploadedFiles 或 messages 变化时写回数据库 ─────────────
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentDraftRecordId) return;
    // 防抖：3秒内只写一次，避免频繁写库
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      // 只保存已完成/失败的文件（过滤掉正在上传/解析中的，避免保存中间状态）
      const stableFiles = uploadedFiles.filter(f => f.status === 'done' || f.status === 'error');
      // 去掉 _file 引用（不可序列化）
      const serializableFiles = stableFiles.map(({ _file: _f, ...rest }) => rest);
      // [Local] skip updateFileStateMutation.mutate
      // recordId: currentDraftRecordId, uploadedFilesList: serializableFiles, chatMessages: messages
    }, 3000);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, messages, currentDraftRecordId]);

  // ─── 文件上传处理 ─────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    // 自动创建草稿（首次操作时，若未登录则跳过）
    if (saasAuthenticated && saasUser?.id && !currentDraftRecordId) {
      try {
        const existingCount = historyQuery.data?.records?.length ?? 0;
        const draftName = `新申请${existingCount + 1}`;
        const result = await createDraftMutation.mutateAsync({ companyName: draftName, tenantUserId: saasUser.id });
        if (result.recordId) setCurrentDraftRecordId(result.recordId);
      } catch { /* 静默失败 */ }
    }

    // 分离压缩包和普通文件
    const zipFiles = fileArr.filter(f => /\.(zip)$/i.test(f.name));
    const normalFiles = fileArr.filter(f => !/\.(zip|rar|7z)$/i.test(f.name));

    // ── 处理压缩包 ──
    for (const zipFile of zipFiles) {
      const zipId = Math.random().toString(36).slice(2);
      addMsg("user", `📦 ${zipFile.name}`);
      addMsg("assistant", `正在解压 **${zipFile.name}**，识别内部文件类型...`);

      try {
        // 尝试 UTF-8 解码，失败则回退到 GBK（Windows 中文 ZIP 常见编码）
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(zipFile, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            decodeFileName: (bytes: any) => {
              // 先尝试 UTF-8
              try {
                const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                return text;
              } catch {
                // 回退到 GBK（Windows 中文路径）
                try {
                  return new TextDecoder('gbk').decode(bytes);
                } catch {
                  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                }
              }
            }
          });
        } catch {
          // 如果带 decodeFileName 失败，再尝试默认方式
          zip = await JSZip.loadAsync(zipFile);
        }
        // 过滤掉 macOS 元数据文件和目录
        const innerEntries = Object.entries(zip.files).filter(([name, entry]) =>
          !entry.dir && !name.startsWith('__MACOSX') && !name.startsWith('.') && !name.endsWith('/')
        );

        // 为每个内部文件创建 ZipFileEntry
        const entries: ZipFileEntry[] = await Promise.all(innerEntries.map(async ([name, zipEntry]) => {
          const baseName = name.split('/').pop() || name;
          const arrayBuffer = await zipEntry.async('arraybuffer');
          const mimeType = baseName.endsWith('.pdf') ? 'application/pdf' : baseName.endsWith('.xlsx') || baseName.endsWith('.xls') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : baseName.endsWith('.csv') ? 'text/csv' : baseName.endsWith('.png') ? 'image/png' : baseName.endsWith('.jpg') || baseName.endsWith('.jpeg') ? 'image/jpeg' : 'application/octet-stream';
          // 直接用 Blob，避免 File 构造函数兼容性问题
          const blob = new Blob([arrayBuffer], { type: mimeType });
          // 给 Blob 附加 name 属性，供后续上传使用
          const file = Object.assign(blob, { name: baseName, lastModified: Date.now() }) as File;
          const guessed = guessDocType(baseName);
          const docInfo = guessed || { docId: 'contract', docName: '其他资料', parseType: 'contract' };
          const needsUserSelect = guessed === null; // Excel 且无关键词
          return {
            id: Math.random().toString(36).slice(2),
            name: baseName,
            size: formatFileSize(blob.size),
            docId: docInfo.docId,
            docName: docInfo.docName,
            parseType: docInfo.parseType,
            status: needsUserSelect ? 'pending' as const : 'uploading' as const,
            userSelected: !needsUserSelect,
            file,
          };
        }));

        // 存储 entries 到 state（用于卡片实时更新）
        setZipEntriesMap(prev => ({ ...prev, [zipId]: entries }));

        // 在消息中插入 zipCard（替换最后一条 assistant 消息）
        setMessages(prev => {
          const msgs = [...prev];
          const lastAssistantIdx = msgs.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i >= 0).pop();
          if (lastAssistantIdx !== undefined) {
            msgs[lastAssistantIdx] = {
              ...msgs[lastAssistantIdx],
              content: `📦 已解压 **${zipFile.name}**，共 **${entries.length}** 个文件，正在逐一上传解析：`,
              zipCard: { zipName: zipFile.name, zipId, entries },
            };
          }
          return msgs;
        });

        // 注意：pending 条目不再立即加入 pendingExcelFiles，而是先上传再嗅探，只有嗅探失败才弹窗
        // 并发上传所有文件（包括 pending 条目，让 uploadOneZipEntry 来处理嗅探）
        const uploadableEntries = entries.filter(e => e.file);
        // 初始化 UploadedFile 列表（pending 条目也加入，状态为 uploading）
        const zipNfs: UploadedFile[] = uploadableEntries.map(entry => ({
          id: entry.id,
          name: entry.name,
          size: entry.size,
          docId: entry.docId,
          docName: entry.docName,
          parseType: entry.parseType,
          status: 'uploading' as const,
          fromZip: zipFile.name,
          _file: entry.file!,
        }));
        setUploadedFiles(prev => [...prev, ...zipNfs]);
        const uploadOneZipEntry = async (entry: ZipFileEntry, nf: UploadedFile) => {
          const updateZipEntry = (status: ZipFileEntry['status'], url?: string) => {
            setZipEntriesMap(prev => ({
              ...prev,
              [zipId]: (prev[zipId] || []).map(e => e.id === entry.id ? { ...e, status, url } : e)
            }));
            setMessages(prev => prev.map(msg =>
              msg.zipCard?.zipId === zipId
                ? { ...msg, zipCard: { ...msg.zipCard, entries: (msg.zipCard.entries || []).map(e => e.id === entry.id ? { ...e, status, url } : e) } }
                : msg
            ));
          };
          try {
            updateZipEntry('uploading');
            // [Local] 直接使用 blob URL，跳过服务器上传
            let url: string;
            try {
              const formData = new FormData();
              formData.append('file', entry.file!, entry.name);
              const resp = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
              const data = await resp.json() as { url: string };
              url = data.url;
            } catch {
              // [Local] 服务器上传失败，回退到本地 blob URL
              url = URL.createObjectURL(entry.file!);
            }
            // 如果该条目是 pending（guessDocType 无法识别），先嗅探内容确定类型
            let finalNf = { ...nf, url };
            if (entry.status === 'pending') {
              try {
                const sniffResult = await utils.client.loan.sniffDocType.mutate({ fileUrl: url, fileName: entry.name });
                // skip 类型：材料清单等无需解析的文档，直接标记为 done 跳过
                if (sniffResult?.parseType === 'skip') {
                  updateZipEntry('done', url);
                  setUploadedFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'done', url, docId: 'contract', docName: '材料清单', parseType: 'skip' } : f));
                  return;
                }
                if (sniffResult?.parseType) {
                  const sniffedDocId = PARSE_TYPE_TO_DOC_ID[sniffResult.parseType] || 'contract';
                  const sniffedDoc = DOC_CHECKLIST.find(d => d.id === sniffedDocId);
                  finalNf = {
                    ...finalNf,
                    docId: sniffedDocId,
                    docName: sniffedDoc?.name || sniffedDocId,
                    parseType: sniffResult.parseType,
                  };
                  // 更新 zipEntry 和 uploadedFiles 的类型信息
                  setZipEntriesMap(prev => ({
                    ...prev,
                    [zipId]: (prev[zipId] || []).map(e => e.id === entry.id ? { ...e, docId: sniffedDocId, docName: finalNf.docName, parseType: sniffResult.parseType! } : e)
                  }));
                  setUploadedFiles(prev => prev.map(f => f.id === entry.id ? { ...f, docId: sniffedDocId, docName: finalNf.docName, parseType: sniffResult.parseType! } : f));
                } else {
                  // 嗅探失败，加入 pendingExcelFiles 让用户手动选择
                  setPendingExcelFiles(prev => [...prev, { file: entry.file!, tempId: entry.id }]);
                  updateZipEntry('pending');
                  return;
                }
              } catch {
                // 嗅探出错，加入 pendingExcelFiles 让用户手动选择
                setPendingExcelFiles(prev => [...prev, { file: entry.file!, tempId: entry.id }]);
                updateZipEntry('pending');
                return;
              }
            }
            updateZipEntry('parsing', url);
            setUploadedFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'parsing', url } : f));
            await processOneFile(entry.file!, finalNf);
            updateZipEntry('done', url);
          } catch {
            updateZipEntry('error');
            setUploadedFiles(prev => prev.map(f => f.id === entry.id ? { ...f, status: 'error' } : f));
          }
        };
        // 优化：信号量控制并发（最多 6 个），解压完一个立即上传，不等其他文件
        const ZIP_CONCURRENCY = 6;
        let activeZipCount = 0;
        const zipQueue = uploadableEntries.map((entry, idx) => ({ entry, nf: zipNfs[idx] }));
        await new Promise<void>((resolve) => {
          let completed = 0;
          const total = zipQueue.length;
          if (total === 0) { resolve(); return; }
          const runNext = () => {
            while (activeZipCount < ZIP_CONCURRENCY && zipQueue.length > 0) {
              const item = zipQueue.shift()!;
              activeZipCount++;
              uploadOneZipEntry(item.entry, item.nf).finally(() => {
                activeZipCount--;
                completed++;
                if (completed === total) resolve();
                else runNext();
              });
            }
          };
          runNext();
        });

        // 汇总
        const doneCount = entries.filter(e => e.status !== 'pending').length;
        addMsg('assistant', `✅ 压缩包 **${zipFile.name}** 解析完成（${doneCount} 个文件）。右侧**资料清单**已自动更新。`);
      } catch (zipErr: unknown) {
        const errMsg = zipErr instanceof Error ? zipErr.message : String(zipErr);
        console.error('[ZIP] 解压失败:', zipFile.name, '大小:', zipFile.size, '错误:', errMsg);
        // 尝试判断具体原因
        let hint = '';
        if (errMsg.includes('password') || errMsg.includes('encrypt')) {
          hint = '该压缩包已加密，请先解密后重新上传。';
        } else if (errMsg.includes('corrupted') || errMsg.includes('invalid') || errMsg.includes('Bad local')) {
          hint = '文件可能已损坏或格式不兼容（仅支持标准 ZIP 格式，不支持 RAR/7z）。';
        } else if (zipFile.size > 200 * 1024 * 1024) {
          hint = '文件过大（超过200MB），请解压后分批上传单个文件。';
        } else {
          hint = `错误详情：${errMsg}`;
        }
        addMsg('assistant', `❌ 压缩包 **${zipFile.name}** 解压失败。${hint}`);
      }
    }

    // ── 处理普通文件 ──
    if (normalFiles.length === 0) return;
    const fileArrNormal = normalFiles;

    // 将文件分为可识别和需要用户选择的两组
    const identifiableFiles: Array<{ file: File; docInfo: { docId: string; docName: string; parseType: string } }> = [];
    const ambiguousExcelFiles: Array<{ file: File; tempId: string }> = [];
    fileArrNormal.forEach(f => {
      const guessed = guessDocType(f.name);
      if (guessed === null) {
        ambiguousExcelFiles.push({ file: f, tempId: Math.random().toString(36).slice(2) });
      } else {
        identifiableFiles.push({ file: f, docInfo: guessed });
      }
    });
    // ambiguous 文件：先上传到 S3，再嗅探内容自动识别类型；无法识别才弹窗让用户选择
    if (ambiguousExcelFiles.length > 0) {
      // 异步处理：不阻塞主流程
      (async () => {
        for (const { file, tempId } of ambiguousExcelFiles) {
          try {
            // 1. 先上传到 S3
            const formData = new FormData();
            formData.append('file', file, file.name);
            const resp = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const { url } = await resp.json() as { url: string };
            // 2. 嗅探内容识别类型
            const sniffResult = await utils.client.loan.sniffDocType.mutate({ fileUrl: url, fileName: file.name });
            // skip 类型：材料清单等无需解析的文档，直接跳过
            if (sniffResult?.parseType === 'skip') {
              // 不添加到 uploadedFiles，不触发解析，静默跳过
              return;
            }
            if (sniffResult?.parseType) {
              const sniffedDocId = PARSE_TYPE_TO_DOC_ID[sniffResult.parseType] || 'contract';
              const sniffedDoc = DOC_CHECKLIST.find(d => d.id === sniffedDocId);
              const autoNf: UploadedFile = {
                id: tempId,
                name: file.name,
                size: formatFileSize(file.size),
                docId: sniffedDocId,
                docName: sniffedDoc?.name || sniffedDocId,
                parseType: sniffResult.parseType,
                status: 'parsing',
                url,
                _file: file,
              };
              setUploadedFiles(prev => {
                // 避免重复添加（可能已被 pendingExcelFiles 流程添加）
                if (prev.some(f => f.id === tempId)) return prev;
                return [...prev, autoNf];
              });
              // 3. 直接解析（跳过再次上传）
              await processOneFile(file, autoNf);
            } else {
              // 嗅探失败，回退到用户手动选择
              setPendingExcelFiles(prev => [...prev, { file, tempId }]);
            }
          } catch {
            // 出错，回退到用户手动选择
            setPendingExcelFiles(prev => [...prev, { file, tempId }]);
          }
        }
      })();
    }
    const newFiles: UploadedFile[] = identifiableFiles.map(({ file, docInfo }) => ({
      id: Math.random().toString(36).slice(2),
      name: file.name,
      size: formatFileSize(file.size),
      ...docInfo,
      status: "uploading" as const,
      _file: file,
    }));
    if (newFiles.length === 0 && ambiguousExcelFiles.length > 0) {
      addMsg("assistant", `检测到 **${ambiguousExcelFiles.length}** 个 Excel 文件，无法自动判断类型。请在下方选择文件类型后继续上传。`);
      setActiveTab("docs");
      return;
    }
    if (newFiles.length === 0) return;

    setUploadedFiles(prev => [...prev, ...newFiles]);
    // 添加带文件卡片的消息（与压缩包卡片保持一致的展示体验）
    const normalMsgContent = newFiles.length === 1
      ? `📎 收到 **${newFiles[0].name}**，正在上传并识别...`
      : `📎 收到 **${fileArrNormal.length}** 个文件，正在上传并识别...`;
    addMsg("assistant", normalMsgContent, { uploadedFiles: newFiles.map(f => ({ ...f })) });
    setActiveTab("docs");
    // 并发上传（最多 3 个并发，提升上传速度）
    const CONCURRENCY = 3;
    const chunks: Array<typeof identifiableFiles> = [];
    for (let i = 0; i < identifiableFiles.length; i += CONCURRENCY) {
      chunks.push(identifiableFiles.slice(i, i + CONCURRENCY));
    }
    for (const chunk of chunks) {
      await Promise.all(chunk.map((item, chunkIdx) => {
        const globalIdx = chunks.indexOf(chunk) * CONCURRENCY + chunkIdx;
        return processOneFile(item.file, newFiles[globalIdx]);
      }));
    }

    // 汇总提示
    const doneCount = newFiles.length;
    const docNames = newFiles.map(f => f.name).join("、");
    // 文件上传完成后：若仍在 welcome 步骤，自动进入 company-selected
    // 使用解析到的企业名，或默认为"某企业"（允许用户不搜索企业直接分析上传文件）
    setAppData(prev => {
      if (!prev.companyName) {
        return { ...prev, companyName: "某企业" };
      }
      return prev;
    });
    if (step === "welcome") {
      setStep("company-selected");
    }
    // Bug-B修复：只在首次上传时显示引导语，避免每次上传都重复提示
    setMessages(prev => {
      const hasGuidanceMsg = prev.some(m => m.content.includes('请告诉我申请金额和贷款类型'));
      const summaryMsg = `✅ **${doneCount}** 个文件解析完成（${docNames}）。\n\n右侧**资料清单**已自动更新，**原始数据**面板中已填入提取的信息。${
        !hasGuidanceMsg ? '\n\n请告诉我申请金额和贷款类型，或直接点击「**开始AI分析**」。' : ''
      }`;
      return [...prev, { role: 'assistant' as const, content: summaryMsg, timestamp: new Date().toISOString() }];
    });
    setActiveTab("data-verify");
  }, [addMsg, utils, appData.companyName, step, processOneFile, saasAuthenticated, saasUser, currentDraftRecordId, historyQuery.data, createDraftMutation, setCurrentDraftRecordId]);

  // ─── 发送消息（通用LLM + 信贷引导流程）─────────────────────────────────────
  // ── 语音录音处理 ──────────────────────────────────────────────────────────
  const handleVoiceStart = useCallback(async () => {
    if (isRecording) {
      // 停止录音
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) return; // 太短，忽略
        setIsTranscribing(true);
        try {
          // Step 1: 将音频转为 base64 并上传到 S3
          const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
          const arrayBuffer = await audioBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(Array.from(uint8Array, c => String.fromCharCode(c)).join(''));
          const uploadResult = await (async (args: { fileName: string; fileType: string; fileBase64: string }) => { const blob = await fetch(`data:${args.fileType};base64,${args.fileBase64}`).then(r => r.blob()); return { url: URL.createObjectURL(blob) }; })({
            fileName: `voice_${Date.now()}.${ext}`,
            fileType: mimeType.split(';')[0], // 去掉 codecs 部分
            fileBase64: base64,
          });
          // Step 2: 用 S3 URL 调用语音转写
          const result = await transcribeVoiceLocal({
            audioUrl: uploadResult.url,
            language: 'zh',
          });
          if (result.text) {
            setInput(prev => prev ? prev + ' ' + result.text : result.text);
            // 自动调整 textarea 高度
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                textareaRef.current.focus();
              }
            }, 50);
          }
        } catch (err) {
          console.error('[Voice] Transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorder.start(500); // 每500ms收集一次数据
      setIsRecording(true);
    } catch (err: unknown) {
      console.error('[Voice] Microphone access denied:', err);
      // 检测是否在 iframe 中运行
      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        // 在 iframe 中，麦克风权限无法通过 iframe 传递，提示用户在新标签页打开
        const openNew = window.confirm(
          '当前页面在嵌入式预览中运行，麦克风权限受限。\n\n点击"确定"在新标签页中打开应用以使用语音输入功能。'
        );
        if (openNew) {
          window.open(window.location.href, '_blank');
        }
      } else {
        // 检查具体错误类型
        const errName = (err instanceof Error) ? err.name : String(err);
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          alert('麦克风权限被拒绝。\n\n请在浏览器地址栏左侧点击锁形图标，将麦克风权限设置为"允许"后刷新页面。');
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          alert('未检测到麦克风设备。\n\n请确认已连接麦克风或耳机，然后重试。');
        } else if (errName === 'NotSupportedError') {
          alert('当前浏览器不支持麦克风录音。\n\n请使用 Chrome、Edge 或 Firefox 最新版本。');
        } else {
          alert('无法访问麦克风，请确认浏览器已授权麦克风权限后重试。');
        }
      }
    }
  }, [isRecording]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isAnalyzing || isSearching || isChatLoading) return;
    setInput("");
    addMsg("user", text);

    // 首次发消息时自动创建草稿申请记录
    if (!currentDraftRecordId && saasAuthenticated) {
      try {
        const existingCount = historyQuery.data?.records?.length ?? 0;
        const result = await createDraftMutation.mutateAsync({ companyName: `新申请${existingCount + 1}` });
        if (result?.recordId) {
          setCurrentDraftRecordId(result.recordId);
        }
      } catch { /* 创建失败不阻断主流程 */ }
    }

    // ── 优先判断是否是信贷引导流程的关键词 ──────────────────────────────────
    const hasLoanInfo = /申请|金额|万|贷款|保理|供应链|抖压|期限|用途/.test(text);
    const hasAmount = /(\d+)\s*万/.test(text);
    // 是否是问句/对话：以问句词开头，或包含问句特征词，或包含行业/情况等分析词
    const isQuestion = /^(你|我|他|什么|怎么|为什么|如何|帮我|请|谢谢|好的|是的|对的|不|嵌|哦|啊|哈|呢|吧|吗|？|！|。|这个|那个|这家|这是|那家|那是|分析|评估|解释|说明|介绍|告诉|查询|查看|看看|了解|知道|能|可以|有没有|有什么|是否|是不是|对不对|行不行|能不能|可不可以)/.test(text.slice(0, 4))
      || /行业|情况|怎么样|如何|分析|风险|特点|特征|趋势|前景|前途|发展|竞争|市场|规模|占比|比例|数据|指标|评分|评级|额度|授信|利率|还款|还清|逾期|违约|担保|抵押|质押|保证|信用|征信|黑名单|法院|诉讼|失信|被执行/.test(text)
      || text.endsWith('?') || text.endsWith('？') || text.endsWith('吗') || text.endsWith('呢') || text.endsWith('吧');
    // 是否看起来像企业搜索：不是问句，不以常见问句词开头，长度>=2
    const isCompanySearch = text.length >= 2 && !isQuestion && !hasLoanInfo;

    // 场景1：输入看起来像企业名称 → 搜索企业（仅在 welcome / company-selected 步骤，result 步骤已完成分析，继续对话不触发新搜索）
    if (isCompanySearch && (step === "welcome" || step === "company-selected")) {
      const hasCompanyKeyword = /公司|企业|集团|有限|科技|贸易|制造|实业|股份|控股|投资|化工|汽车|销售|服务|建设|工程|医药|商贸|电子|电气|纳米|生物|林业/.test(text);
      // 短输入（≤ 20字）且含企业关键词，且不是纯数字或纯英文单词，就当作企业搜索
      // 注意：必须含有企业关键词才触发搜索，避免误把普通问题当成企业名
      const looksLikeCompanyName = hasCompanyKeyword && text.length <= 30 && !/^[a-zA-Z0-9\s]+$/.test(text) && !/^\d+$/.test(text);
      if (looksLikeCompanyName) {
        setMessages(prev => prev.slice(0, -1)); // 移除刚加的user消息，让handleSearch自己加
        await handleSearch(text);
        return;
      }
    }

    // 场景2：已选企业，输入贷款信息 → 解析贷款参数
    if ((step === "welcome" || step === "company-selected") && hasLoanInfo && hasAmount && appData.companyName) {
      const amountMatch = text.match(/(\d+)\s*万/);
      const periodMatch = text.match(/(\d+)\s*个月/);
      const typeMap: Array<[RegExp, string]> = [
        [/保理/, "保理融资"], [/供应链/, "供应链金融"], [/抑压/, "抑压"], [/小额|信用/, "小额信贷"],
      ];
      const loanType = typeMap.find(([r]) => r.test(text))?.[1] || "小额信贷";
      setAppData(prev => ({ ...prev, amount: amountMatch?.[1], period: periodMatch?.[1] || "12", loanType, purpose: text }));
      setStep("loan-info");
      // 保理/供应链融资场景：提示录入甲方信息
      if (loanType === "保理融资" || loanType === "供应链金融") {
        addMsg("assistant", `已记录：申请 **${loanType}** **${amountMatch?.[1]}万元**，期限 **${periodMatch?.[1] || 12}个月**。\n\n检测到您申请的是 **${loanType}**，需要录入**甲方（债务人）信息**以完成交易真实性验证。\n\n请告诉我：\n- 🏢 **甲方企业名称**（必填）\n- 📝 统一社会信用代码（可选）\n- 💰 合同金额（万元）\n- ⏳ 历史合作账期（天）\n- ✅ 是否有逾期记录\n\n也可直接点击「**开始AI分析**」跳过甲方信息录入。`);
      } else {
        addMsg("assistant", `已记录：申请 **${loanType}** **${amountMatch?.[1]}万元**，期限 **${periodMatch?.[1] || 12}个月**。\n\n可以开始分析了！点击下方「**开始AI分析**」，或继续上传财务材料以提高分析准确度。`);
      }
      return;
    }

    // 场景2b：用户在 loan-info 步骤输入甲方信息
    if (step === "loan-info" && (appData.loanType === "保理融资" || appData.loanType === "供应链金融") && !appData.counterpartyInfo?.name) {
      // 尝试解析甲方信息
      const cpNameMatch = text.match(/甲方[：:：]?\s*([^\s，,。.]+(?:公司|企业|集团|有限|科技|贸易|制造|实业|股份|控股|投资|化工|汽车|销售|服务|建设|工程|医药|金融|商贸|电子|电气|电商|生物|农业)[^\s，,。.]*)/)?.[1];
      const cpAmountMatch = text.match(/合同[^\d]*(\d+(?:\.\d+)?)万/);
      const cpTermMatch = text.match(/(\d+)天/);
      const cpOverdueMatch = /有逾期|逾期记录/.test(text);
      const cpNoOverdueMatch = /无逾期|从未逾期/.test(text);
      const cpCreditCodeMatch = text.match(/([0-9A-Z]{18})/);

      if (cpNameMatch || cpAmountMatch || cpTermMatch || cpCreditCodeMatch) {
        const counterpartyInfo: AppData['counterpartyInfo'] = {
          ...(appData.counterpartyInfo || {}),
          ...(cpNameMatch ? { name: cpNameMatch } : {}),
          ...(cpCreditCodeMatch ? { creditCode: cpCreditCodeMatch[1] } : {}),
          ...(cpAmountMatch ? { contractAmount: parseFloat(cpAmountMatch[1]) } : {}),
          ...(cpTermMatch ? { paymentTermDays: parseInt(cpTermMatch[1]) } : {}),
          ...(cpOverdueMatch ? { hasOverdueHistory: true } : {}),
          ...(cpNoOverdueMatch ? { hasOverdueHistory: false } : {}),
        };
        setAppData(prev => ({ ...prev, counterpartyInfo }));
        const cpName = counterpartyInfo.name || appData.counterpartyInfo?.name;
        addMsg("assistant", `已记录甲方信息：${cpName ? `**${cpName}**` : ''}。\n\n可以开始分析了！点击「**开始AI分析**」，或继续补充甲方信息（如合同金额、账期、逾期记录等）。`);
        return;
      }
    }

    // ── 其余所有情况：直接调用大模型通用对话 ──────────────────────────────────
    setIsChatLoading(true);
    // 构建企业上下文（如果有的话）
    const companyContext = appData.companyName ? {
      companyName: appData.companyName,
      creditCode: appData.creditCode,
      legalPerson: appData.legalPerson,
      registeredCapital: appData.registeredCapital,
      establishDate: appData.establishDate,
      address: appData.address,
      industry: appData.industry,
      revenue: appData.revenue,
      netProfit: appData.netProfit,
      totalAssets: appData.totalAssets,
      // 使用算法评分卡分数（与右侧评分卡面板保持一致）
      analysisScore: analysisResult?.layer3?.scorecard?.score ?? analysisResult?.creditScore,
      analysisGrade: analysisResult?.layer3?.scorecard?.creditGrade,
      analysisVerdict: analysisResult?.verdict,
      approvedAmount: analysisResult?.layer3?.limitCalculation?.approvedAmount,
      // 38特征详情（含计算公式和数据来源）注入对话AI
      featureDetails: analysisResult?.layer3?.featureSummary?.featureDetails,
      dataCompleteness: analysisResult?.layer3?.featureSummary?.dataCompleteness,
      missingFields: analysisResult?.layer3?.featureSummary?.missingFields,
      // 三法额度结果（字段名与chatRouter schema一致）
      limitCalculation: analysisResult?.layer3?.limitCalculation ? {
        incomeMethod: analysisResult.layer3.limitCalculation.revenueMethodLimit != null
          ? { amount: analysisResult.layer3.limitCalculation.revenueMethodLimit, basis: analysisResult.layer3.limitCalculation.incomeMethodDetail || "收入法" }
          : null,
        assetMethod: analysisResult.layer3.limitCalculation.netAssetMethodLimit != null
          ? { amount: analysisResult.layer3.limitCalculation.netAssetMethodLimit, basis: analysisResult.layer3.limitCalculation.netAssetMethodDetail || "资产法" }
          : null,
        cashFlowMethod: analysisResult.layer3.limitCalculation.cashFlowMethodLimit != null
          ? { amount: analysisResult.layer3.limitCalculation.cashFlowMethodLimit, basis: analysisResult.layer3.limitCalculation.cashFlowMethodDetail || "现金流法" }
          : null,
        recommendedLimit: analysisResult.layer3.limitCalculation.recommendedLimit,
      } : undefined,
      // 数据缺失因果链（让AI能回答“为什么这个评分没有/额度算不出来”）
      missingDataChain: analysisResult?.layer3?.featureSummary?.missingDataChain,
      // 三张表完整财务数据（让AI能回答净利润/资产等具体财务问题）
      financialStatements: appData.financialStatements,
      // 多年度财务数据（让AI能回答2024年/2025年等具体年份的财务数据）
      financialStatementsByYear: appData.financialStatementsByYear,
      // 评分卡结果
      scorecardResult: analysisResult?.layer3?.scorecard ? {
        score: analysisResult.layer3.scorecard.score,
        creditGrade: analysisResult.layer3.scorecard.creditGrade,
        subjectQualityScore: analysisResult.layer3.scorecard.subjectQualityScore,
        financialHealthScore: analysisResult.layer3.scorecard.financialHealthScore,
        operationStabilityScore: analysisResult.layer3.scorecard.operationStabilityScore,
        scorePD: analysisResult.layer3.scorecard.scorePD,
      } : undefined,
    } : undefined;
    // 构建历史记录（过滤掉带searchResults的消息，只保留纯文本）
    const history = messages
      .filter(m => !m.searchResults && !m.uploadedFiles)
      .slice(-16)
      .map(m => ({ role: m.role, content: m.content }));
    try {
      const result = await sendChatMessage(text, history, companyContext as Record<string, unknown> | undefined);
      addMsg("assistant", result.content);
    } catch {
      addMsg("assistant", "抱歉，AI 暂时无法回答，请稍后重试。");
    } finally {
      setIsChatLoading(false);
    }
  }, [input, step, appData, analysisResult, messages, isAnalyzing, isSearching, isChatLoading, handleSearch, addMsg, currentDraftRecordId, saasAuthenticated, historyQuery.data, createDraftMutation, setCurrentDraftRecordId]);

  // ─── 开始分析 ─────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    // 如果没有企业名，自动使用「某企业」作为默认（用户可能只上传了报表而没有搜索企业）
    // 使用局部变量避免 setState 竞态（setState 是异步的，后续代码不能立即读到新值）
    const effectiveCompanyName = appData.companyName || "某企业";
    if (!appData.companyName) {
      setAppData(prev => ({ ...prev, companyName: effectiveCompanyName }));
    }
    // [Local] No login required
    setIsAnalyzing(true);
    setStep("analyzing");
    setActiveTab("analysis-engine");
    addMsg("assistant", "⏳ **开始全面风险分析...**\n\n1. 🔍 硬性规则引擎（8条准入规则）\n2. 🧮 38维特征工程计算\n3. 📊 评分卡模型打分\n4. 💰 三法额度计算\n5. 🤖 AI综合风险评估");

    try {
      const recordId = `APP-${Date.now()}`;
      const result = await runLocalAnalysis({
        recordId,
        companyName: effectiveCompanyName,
        amount: appData.amount,
        loanType: appData.loanType || "小额信贷",
        industry: appData.industry || "综合",
        period: appData.period || "12",
        purpose: appData.purpose || "流动资金周转",
        creditCode: appData.creditCode,
        legalPerson: appData.legalPerson,
        registeredCapital: appData.registeredCapital,
        establishDate: appData.establishDate,
        address: appData.address,
        financialReport: {
          revenue: appData.revenue,
          netProfit: appData.netProfit,
          totalAssets: appData.totalAssets,
          totalLiabilities: appData.totalLiabilities,
          operatingCashFlow: appData.operatingCashFlow,
          currentRatio: appData.currentRatio,
          quickRatio: appData.quickRatio,
          roe: appData.roe,
          summary: appData.financialSummary,
        },
        bankData: appData.bankData as Record<string, unknown> | undefined,
        taxData: appData.taxData as Record<string, unknown> | undefined,
        bankFlowSummary: appData.bankFlowSummary as Record<string, unknown> | undefined,
        financialStatements: appData.financialStatements as Record<string, unknown> | undefined,
        financialStatementsByYear: appData.financialStatementsByYear as Record<string, unknown> | undefined,
        counterpartyInfo: appData.counterpartyInfo as Record<string, unknown> | undefined,
        top5Customers: appData.top5Customers as unknown[],
        top5Suppliers: appData.top5Suppliers as unknown[],
        uploadedFilesList: uploadedFiles as unknown[],
        uploadedDocsMap: uploadedDocs as Record<string, unknown>,
        chatMessages: messages.map(m => ({ role: m.role, content: m.content })),
      });

      const analysis = result.report as AnalysisResult;
      // 将 applicationId 注入到 analysisResult，供知识图谱面板使用
      const analysisWithId = { ...analysis, applicationId: result.applicationId ?? undefined };
      setAnalysisResult(analysisWithId as AnalysisResult);
      // 保留 financialStatements 数据（分析不应清空已解析的财务报表）
      // appData 在 analyze 调用期间不被修改，无需额外操作
      setStep("result");
      // 分析完成后更新左侧列表企业名称（确保显示最新名称）
      if (currentDraftRecordId && effectiveCompanyName) {
        if (currentDraftRecordId) { updateDraftCompany(currentDraftRecordId, effectiveCompanyName); setLocalHistory(getHistory()); }
      }
      // 分析完成后刷新左侧申请记录列表
      setLocalHistory(getHistory());

      const verdict = result.verdict;
      const score = result.score;
      const layer3 = analysis.layer3;
      const grade = layer3?.scorecard?.creditGrade || "BBB";
      const approvedAmt = Math.max(0, layer3?.limitCalculation?.approvedAmount || 0);
      const rulesPassed = layer3?.ruleEngine?.passed;
      const triggeredCount = layer3?.ruleEngine?.triggeredRules?.length || 0;

      const verdictEmoji = verdict === "approved" ? "✅" : verdict === "reduced" ? "⚠️" : "❌";
      const verdictText = verdict === "approved" ? "批准通过" : verdict === "reduced" ? "建议降额通过" : "建议拒绝";

      addMsg("assistant", `${verdictEmoji} **分析完成：${verdictText}**\n\n| 指标 | 结果 |\n|------|------|\n| 信用评分 | **${score}分** |\n| 信用等级 | **${grade}** |\n| 规则引擎 | ${rulesPassed ? "✅ 全部通过" : `❌ 触发${triggeredCount}条规则`} |\n| 建议授信额度 | **${approvedAmt}万元** |\n\n👉 请查看分析面板获取详细指标。`);
      setActiveTab("comprehensive");
      // 移动端自动切换到分析 Tab
      setMobilePage('analysis');
    } catch {
      addMsg("assistant", "❌ 分析失败，请检查输入数据后重试。");
      setStep("loan-info");
    } finally {
      setIsAnalyzing(false);
    }
  }, [appData, addMsg, messages, currentDraftRecordId, updateDraftCompanyMutation, utils]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  // ─── Excel 类型选择弹窗处理 ─────────────────────────────────────────────────
  const handleExcelTypeSelect = useCallback(async (tempId: string, file: File, docId: string, docName: string, parseType: string) => {
    setPendingExcelFiles(prev => prev.filter(p => p.tempId !== tempId));
    // 创建文件对象并走正常上传流程
    const newFile: UploadedFile = {
      id: tempId,
      name: file.name,
      size: formatFileSize(file.size),
      docId,
      docName,
      parseType,
      status: "uploading",
    };
    setUploadedFiles(prev => [...prev, newFile]);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await (async (args: { fileName: string; fileType: string; fileBase64: string }) => { const blob = await fetch(`data:${args.fileType};base64,${args.fileBase64}`).then(r => r.blob()); return { url: URL.createObjectURL(blob) }; })({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileBase64: base64,
      });
      setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "parsing", url } : f));
      const parsed = await utils.client.loan.parseDocument.mutate({ fileUrl: url, fileType: parseType as any });
      if (parsed?.data) {
        const d = parsed.data as Record<string, unknown>;
        setAppData(prev => {
          const updates: Partial<AppData> = {};
          if ((d.companyName || d.company) && !prev.companyName) updates.companyName = String(d.companyName || d.company);
          // 修复：扩大条件，顶层快捷字段也进入多年份分支
          const hasAnyFinancialDataZip = d.balanceSheet || d.incomeStatement || d.cashFlowStatement ||
            d.revenue != null || d.netProfit != null || d.totalAssets != null || d.totalLiabilities != null;
          if ((parseType === 'financial_report' || parseType === 'audit_report') && hasAnyFinancialDataZip) {
            const toStr = (obj: unknown): Record<string, string | null> => {
              if (!obj || typeof obj !== 'object') return {};
              return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, v != null ? String(v) : null]));
            };
            const fn = file.name;
            const fn4 = fn.match(/(20\d{2})/);
            const fn2 = fn.match(/[^\d](\d{2})年/) || fn.match(/^(\d{2})年/);
            const yr = fn4 ? fn4[1] : (fn2 ? (parseInt(fn2[1]) >= 90 ? `19${fn2[1]}` : `20${fn2[1]}`) : new Date().getFullYear().toString());
            // 顶层快捷字段回墙：如果三张表为空，用顶层字段构造最小化incomeStatement
            const fallbackIncome: Record<string, string | null> = {};
            if (d.revenue != null) fallbackIncome['revenue'] = String(d.revenue);
            if (d.netProfit != null) fallbackIncome['netProfit'] = String(d.netProfit);
            if (d.grossMargin != null) fallbackIncome['grossMargin'] = String(d.grossMargin);
            if (d.netProfitMargin != null) fallbackIncome['netProfitMargin'] = String(d.netProfitMargin);
            const fallbackBs: Record<string, string | null> = {};
            if (d.totalAssets != null) fallbackBs['totalAssets'] = String(d.totalAssets);
            if (d.totalLiabilities != null) fallbackBs['totalLiabilities'] = String(d.totalLiabilities);
            const prevYearZip = prev.financialStatementsByYear?.[yr];
            updates.financialStatementsByYear = {
              ...prev.financialStatementsByYear,
              [yr]: { year: yr, fileName: fn,
                balanceSheet: d.balanceSheet ? toStr(d.balanceSheet) : (Object.keys(fallbackBs).length > 0 ? fallbackBs : prevYearZip?.balanceSheet),
                incomeStatement: d.incomeStatement ? toStr(d.incomeStatement) : (Object.keys(fallbackIncome).length > 0 ? fallbackIncome : prevYearZip?.incomeStatement),
                cashFlowStatement: d.cashFlowStatement ? toStr(d.cashFlowStatement) : prevYearZip?.cashFlowStatement,
              },
            };
          }
          if (parseType === 'bank_statement' && d) {
            // 修复问题4：合并银行流水数据，不直接覆盖，保留所有月份
            const prevBankDataZip = prev.bankData as Record<string, unknown> | undefined;
            if (prevBankDataZip && Array.isArray(prevBankDataZip.monthlyStats) && Array.isArray((d as any).monthlyStats)) {
              const existingMonthsMapZip = new Map<string, Record<string, unknown>>(
                (prevBankDataZip.monthlyStats as Array<Record<string, unknown>>).map((m) => [String(m.month || ''), { ...m }])
              );
              for (const m of (d as any).monthlyStats as Array<Record<string, unknown>>) {
                const mKey = String(m.month || '');
                if (!mKey) continue;
                if (existingMonthsMapZip.has(mKey)) {
                  const ex = existingMonthsMapZip.get(mKey)!;
                  existingMonthsMapZip.set(mKey, {
                    ...ex, ...m,
                    income: (parseFloat(String(ex.income ?? ex.inflow ?? 0)) || 0) + (parseFloat(String(m.income ?? m.inflow ?? 0)) || 0),
                    inflow: (parseFloat(String(ex.inflow ?? ex.income ?? 0)) || 0) + (parseFloat(String(m.inflow ?? m.income ?? 0)) || 0),
                    outflow: (parseFloat(String(ex.outflow ?? 0)) || 0) + (parseFloat(String(m.outflow ?? 0)) || 0),
                  });
                } else {
                  existingMonthsMapZip.set(mKey, m);
                }
              }
              const mergedMonthlyZip = Array.from(existingMonthsMapZip.values()).sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
              updates.bankData = {
                ...prevBankDataZip,
                ...d,
                monthlyStats: mergedMonthlyZip,
                top5Counterparties: (d as any).top5Counterparties || prevBankDataZip.top5Counterparties,
              };
            } else {
              updates.bankData = prevBankDataZip ? { ...prevBankDataZip, ...d } : d;
            }
            // Bug6修复：ZIP中的银行流水也更新 bankFlowSummary
            const monthlyData2 = Array.isArray(d.monthlyStats) ? (d.monthlyStats as any[]).map((m: any) => ({
              month: m.month as string | undefined,
              inflow: typeof m.inflow === 'number' ? m.inflow : undefined,
              outflow: typeof m.outflow === 'number' ? m.outflow : undefined,
              balance: typeof m.balance === 'number' ? m.balance : undefined,
            })) : undefined;
            {
              const newInflow2 = typeof d.totalInflow === 'number' ? d.totalInflow : (typeof d.totalInflow === 'string' ? parseFloat(d.totalInflow) : undefined);
              const newOutflow2 = typeof d.totalOutflow === 'number' ? d.totalOutflow : (typeof d.totalOutflow === 'string' ? parseFloat(d.totalOutflow) : undefined);
              // 累加合并：同一月份的收支累加，不同月份追加
              const existingMonths2 = new Map((prev.bankFlowSummary?.monthlyData || []).map((m: any) => [m.month, { ...m }]));
              for (const m of (monthlyData2 || [])) {
                if (!m.month) continue;
                if (existingMonths2.has(m.month)) {
                  const ex = existingMonths2.get(m.month)!;
                  existingMonths2.set(m.month, { month: m.month, inflow: (ex.inflow ?? 0) + (m.inflow ?? 0), outflow: (ex.outflow ?? 0) + (m.outflow ?? 0), balance: m.balance ?? ex.balance });
                } else { existingMonths2.set(m.month, m); }
              }
              const merged2 = Array.from(existingMonths2.values()).sort((a: any, b: any) => (a.month || '').localeCompare(b.month || ''));
              const mergedInflow2 = merged2.reduce((s: number, m: any) => s + (m.inflow ?? 0), 0);
              const mergedOutflow2 = merged2.reduce((s: number, m: any) => s + (m.outflow ?? 0), 0);
              const months2 = merged2.map((m: any) => m.month).filter(Boolean) as string[];
              const startDate2 = months2.length > 0 ? months2[0] : undefined;
              const endDate2 = months2.length > 0 ? months2[months2.length - 1] : undefined;
              const newTop5_2 = Array.isArray((d as any).top5Counterparties) ? (d as any).top5Counterparties : undefined;
              updates.bankFlowSummary = {
                totalInflow: mergedInflow2 || (prev.bankFlowSummary?.totalInflow ?? 0) + (newInflow2 ?? 0),
                totalOutflow: mergedOutflow2 || (prev.bankFlowSummary?.totalOutflow ?? 0) + (newOutflow2 ?? 0),
                netCashFlow: (mergedInflow2 || 0) - (mergedOutflow2 || 0),
                statementPeriod: startDate2 && endDate2 ? `${startDate2} ~ ${endDate2}` : (d.statementPeriod as string | undefined),
                startDate: startDate2,
                endDate: endDate2,
                monthCount: merged2.length,
                accountName: (d.accountName as string | undefined) || prev.bankFlowSummary?.accountName,
                bankName: (d.bankName as string | undefined) || prev.bankFlowSummary?.bankName,
                monthlyData: merged2,
                top5Counterparties: newTop5_2 || prev.bankFlowSummary?.top5Counterparties,
              };
            }
          }
          return { ...prev, ...updates };
        });
      }
      setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "done", parsedData: parsed?.data as Record<string, unknown> } : f));
      setUploadedDocs(prev => ({ ...prev, [docId]: true }));
      addMsg("assistant", `✅ **${file.name}** 已按「${docName}」解析完成。`);
    } catch {
      setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "error" } : f));
    }
  }, [utils, addMsg]);

  // 资料清单条目独立上传：绕过 guessDocType，直接继承条目的 parseType
  const handleFileUploadForDoc = useCallback(async (files: FileList | File[], docId: string, docName: string, parseType: string) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      const tempId = `doc_${docId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const newFile: UploadedFile = {
        id: tempId,
        name: file.name,
        size: formatFileSize(file.size),
        docId,
        docName,
        parseType,
        status: "uploading",
      };
      setUploadedFiles(prev => [...prev, newFile]);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const { url } = await (async (args: { fileName: string; fileType: string; fileBase64: string }) => { const blob = await fetch(`data:${args.fileType};base64,${args.fileBase64}`).then(r => r.blob()); return { url: URL.createObjectURL(blob) }; })({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileBase64: base64,
        });
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "parsing", url } : f));
        const parsed = await utils.client.loan.parseDocument.mutate({ fileUrl: url, fileType: parseType as any });
        if (parsed?.data) {
          const d = parsed.data as Record<string, unknown>;
          setAppData(prev => {
            const updates: Partial<AppData> = {};
            if ((d.companyName || d.company) && !prev.companyName) updates.companyName = String(d.companyName || d.company);
            // 修复：扩大条件，顶层快捷字段也进入多年份分支
            const hasAnyFinancialDataDoc = d.balanceSheet || d.incomeStatement || d.cashFlowStatement ||
              d.revenue != null || d.netProfit != null || d.totalAssets != null || d.totalLiabilities != null;
            if ((parseType === 'financial_report' || parseType === 'audit_report') && hasAnyFinancialDataDoc) {
              const toStr = (obj: unknown): Record<string, string | null> => {
                if (!obj || typeof obj !== 'object') return {};
                return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, v != null ? String(v) : null]));
              };
              const fn = file.name;
              const fn4 = fn.match(/(20\d{2})/);
              const fn2 = fn.match(/[^\d](\d{2})年/) || fn.match(/^(\d{2})年/);
              const yr = fn4 ? fn4[1] : (fn2 ? (parseInt(fn2[1]) >= 90 ? `19${fn2[1]}` : `20${fn2[1]}`) : new Date().getFullYear().toString());
              // 提取精确报告期
              const bsDoc = d.balanceSheet as Record<string, unknown> | null | undefined;
              const isDoc = d.incomeStatement as Record<string, unknown> | null | undefined;
              const cfDoc = d.cashFlowStatement as Record<string, unknown> | null | undefined;
              const rawDateDoc = String(bsDoc?.reportDate || isDoc?.reportPeriod || cfDoc?.reportPeriod || "");
              const monthMatchDoc = rawDateDoc.match(/(20\d{2})[年-](\d{1,2})[月-]?\d*/) || fn.match(/(20\d{2})[年-]?(\d{1,2})[月-]/);
              let reportPeriodDoc = yr; let periodTypeDoc: 'annual' | 'monthly' | 'quarterly' | 'interim' = 'annual';
              if (monthMatchDoc) {
                const m = parseInt(monthMatchDoc[2]);
                if (m !== 12) {
                  if (m === 6) { reportPeriodDoc = `${yr}-H1`; periodTypeDoc = 'interim'; }
                  else if (m === 3 || m === 9) { reportPeriodDoc = `${yr}-Q${Math.ceil(m/3)}`; periodTypeDoc = 'quarterly'; }
                  else { reportPeriodDoc = `${yr}-${String(m).padStart(2,'0')}`; periodTypeDoc = 'monthly'; }
                }
              }
              // BUG1修复：防止空对象覆盖已有财务数据
              const hasKeysDoc = (obj: unknown) => obj && typeof obj === 'object' && Object.keys(obj as object).length > 0;
              const prevYear = prev.financialStatementsByYear?.[yr];
              // 顶层快捷字段fallback：PDF解析时三张表可能为空，用顶层字段构造最小化数据
              const fallbackIncomeDoc: Record<string, string | null> = {};
              if (d.revenue != null) fallbackIncomeDoc['revenue'] = String(d.revenue);
              if (d.netProfit != null) fallbackIncomeDoc['netProfit'] = String(d.netProfit);
              if (d.grossMargin != null) fallbackIncomeDoc['grossMargin'] = String(d.grossMargin);
              if (d.netProfitMargin != null) fallbackIncomeDoc['netProfitMargin'] = String(d.netProfitMargin);
              const fallbackBsDoc: Record<string, string | null> = {};
              if (d.totalAssets != null) fallbackBsDoc['totalAssets'] = String(d.totalAssets);
              if (d.totalLiabilities != null) fallbackBsDoc['totalLiabilities'] = String(d.totalLiabilities);
              const resolvedBs = hasKeysDoc(d.balanceSheet) ? toStr(d.balanceSheet) : (Object.keys(fallbackBsDoc).length > 0 ? fallbackBsDoc : prevYear?.balanceSheet);
              const resolvedIs = hasKeysDoc(d.incomeStatement) ? toStr(d.incomeStatement) : (Object.keys(fallbackIncomeDoc).length > 0 ? fallbackIncomeDoc : prevYear?.incomeStatement);
              const resolvedCf = hasKeysDoc(d.cashFlowStatement) ? toStr(d.cashFlowStatement) : prevYear?.cashFlowStatement;
              updates.financialStatementsByYear = {
                ...prev.financialStatementsByYear,
                [yr]: {
                  year: yr, reportPeriod: reportPeriodDoc, periodType: periodTypeDoc, fileName: fn,
                  balanceSheet: resolvedBs,
                  incomeStatement: resolvedIs,
                  cashFlowStatement: resolvedCf,
                },
              };
            }
            if (parseType === 'bank_statement' && d) {
              // 修复问题4：合并银行流水数据，不直接覆盖，保留所有月份
              const prevBankDataDoc = prev.bankData as Record<string, unknown> | undefined;
              if (prevBankDataDoc && Array.isArray(prevBankDataDoc.monthlyStats) && Array.isArray((d as any).monthlyStats)) {
                const existingMonthsMapDoc = new Map<string, Record<string, unknown>>(
                  (prevBankDataDoc.monthlyStats as Array<Record<string, unknown>>).map((m) => [String(m.month || ''), { ...m }])
                );
                for (const m of (d as any).monthlyStats as Array<Record<string, unknown>>) {
                  const mKey = String(m.month || '');
                  if (!mKey) continue;
                  if (existingMonthsMapDoc.has(mKey)) {
                    const ex = existingMonthsMapDoc.get(mKey)!;
                    existingMonthsMapDoc.set(mKey, {
                      ...ex, ...m,
                      income: (parseFloat(String(ex.income ?? ex.inflow ?? 0)) || 0) + (parseFloat(String(m.income ?? m.inflow ?? 0)) || 0),
                      inflow: (parseFloat(String(ex.inflow ?? ex.income ?? 0)) || 0) + (parseFloat(String(m.inflow ?? m.income ?? 0)) || 0),
                      outflow: (parseFloat(String(ex.outflow ?? 0)) || 0) + (parseFloat(String(m.outflow ?? 0)) || 0),
                    });
                  } else {
                    existingMonthsMapDoc.set(mKey, m);
                  }
                }
                const mergedMonthlyDoc = Array.from(existingMonthsMapDoc.values()).sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
                updates.bankData = {
                  ...prevBankDataDoc,
                  ...d,
                  monthlyStats: mergedMonthlyDoc,
                  top5Counterparties: (d as any).top5Counterparties || prevBankDataDoc.top5Counterparties,
                };
              } else {
                updates.bankData = prevBankDataDoc ? { ...prevBankDataDoc, ...d } : d;
              }
              // Bug6修复：handleFileUploadForDoc 中也更新 bankFlowSummary
              const mData = Array.isArray(d.monthlyStats) ? (d.monthlyStats as any[]).map((m: any) => ({
                month: m.month as string | undefined,
                inflow: typeof m.inflow === 'number' ? m.inflow : undefined,
                outflow: typeof m.outflow === 'number' ? m.outflow : undefined,
                balance: typeof m.balance === 'number' ? m.balance : undefined,
              })) : undefined;
              {
                const newInflow3 = typeof d.totalInflow === 'number' ? d.totalInflow : (typeof d.totalInflow === 'string' ? parseFloat(d.totalInflow) : undefined);
                const newOutflow3 = typeof d.totalOutflow === 'number' ? d.totalOutflow : (typeof d.totalOutflow === 'string' ? parseFloat(d.totalOutflow) : undefined);
                // 累加合并：同一月份的收支累加，不同月份追加
                const existingMonths3 = new Map((prev.bankFlowSummary?.monthlyData || []).map((m: any) => [m.month, { ...m }]));
                for (const m of (mData || [])) {
                  if (!m.month) continue;
                  if (existingMonths3.has(m.month)) {
                    const ex = existingMonths3.get(m.month)!;
                    existingMonths3.set(m.month, { month: m.month, inflow: (ex.inflow ?? 0) + (m.inflow ?? 0), outflow: (ex.outflow ?? 0) + (m.outflow ?? 0), balance: m.balance ?? ex.balance });
                  } else { existingMonths3.set(m.month, m); }
                }
                const merged3 = Array.from(existingMonths3.values()).sort((a: any, b: any) => (a.month || '').localeCompare(b.month || ''));
                const mergedInflow3 = merged3.reduce((s: number, m: any) => s + (m.inflow ?? 0), 0);
                const mergedOutflow3 = merged3.reduce((s: number, m: any) => s + (m.outflow ?? 0), 0);
                const months3 = merged3.map((m: any) => m.month).filter(Boolean) as string[];
                const startDate3 = months3.length > 0 ? months3[0] : undefined;
                const endDate3 = months3.length > 0 ? months3[months3.length - 1] : undefined;
                const newTop5_3 = Array.isArray((d as any).top5Counterparties) ? (d as any).top5Counterparties : undefined;
                updates.bankFlowSummary = {
                  totalInflow: mergedInflow3 || (prev.bankFlowSummary?.totalInflow ?? 0) + (newInflow3 ?? 0),
                  totalOutflow: mergedOutflow3 || (prev.bankFlowSummary?.totalOutflow ?? 0) + (newOutflow3 ?? 0),
                  netCashFlow: (mergedInflow3 || 0) - (mergedOutflow3 || 0),
                  statementPeriod: startDate3 && endDate3 ? `${startDate3} ~ ${endDate3}` : (d.statementPeriod as string | undefined),
                  startDate: startDate3,
                  endDate: endDate3,
                  monthCount: merged3.length,
                  accountName: (d.accountName as string | undefined) || prev.bankFlowSummary?.accountName,
                  bankName: (d.bankName as string | undefined) || prev.bankFlowSummary?.bankName,
                  monthlyData: merged3,
                  top5Counterparties: newTop5_3 || prev.bankFlowSummary?.top5Counterparties,
                };
              }
            }
            if (parseType === 'audit_report') {
              const hasAuditData = d.auditOpinion || d.auditStatus || d.auditor || d.auditFirm || d.auditDate || d.issuedDate;
              if (hasAuditData) {
                updates.auditReport = {
                  reportYear: (d.taxYear || d.reportYear || d.year) as string | undefined,
                  auditOpinion: (d.auditOpinion || d.auditStatus) as string | undefined,
                  auditFirm: (d.auditor || d.auditFirm) as string | undefined,
                  auditDate: (d.auditDate || d.issuedDate) as string | undefined,
                  financialDataFromAudit: d,
                  fileName: file.name,
                };
              }
            }
            if (['tax_vat', 'tax_income', 'tax_clearance', 'tax_credit'].includes(parseType)) {
              // 按类型分别存储
              const typeKey = parseType === 'tax_vat' ? 'vat' : parseType === 'tax_income' ? 'income' : parseType === 'tax_clearance' ? 'clearance' : 'credit';
              updates.taxDataByType = { ...prev.taxDataByType, [typeKey]: { ...d, taxType: parseType } };
              updates.taxData = { ...prev.taxData, ...d, taxType: parseType };
              // 支持 byYear 多年数据（新版 LLM 返回格式）
              const prevByYear2 = prev.taxDataByYear || {};
              let newByYear2 = { ...prevByYear2 };
              if (Array.isArray((d as any).byYear) && (d as any).byYear.length > 0) {
                for (const yearData of (d as any).byYear) {
                  const taxYear2 = String(yearData.taxYear || yearData.year || yearData.reportYear || '未知年份');
                  const prevYearData2 = newByYear2[taxYear2] || {};
                  newByYear2[taxYear2] = { ...prevYearData2, [typeKey]: { ...yearData, taxType: parseType } };
                }
              } else {
                const taxYear2 = String((d as any).taxYear || (d as any).year || (d as any).reportYear || (d as any).taxPeriod || '未知年份');
                const prevYearData2 = newByYear2[taxYear2] || {};
                newByYear2[taxYear2] = { ...prevYearData2, [typeKey]: { ...d, taxType: parseType } };
              }
              updates.taxDataByYear = newByYear2;
            }
            return { ...prev, ...updates };
          });
        }
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "done", parsedData: parsed?.data as Record<string, unknown> } : f));
        setUploadedDocs(prev => ({ ...prev, [docId]: true }));
        addMsg("assistant", `✅ **${file.name}** 已按「${docName}」解析完成。`);
      } catch {
        setUploadedFiles(prev => prev.map(f => f.id === tempId ? { ...f, status: "error" } : f));
        addMsg("assistant", `❌ **${file.name}** 解析失败，请重试。`);
      }
    }
  }, [utils, addMsg]);

  return (
    <div className="h-screen flex flex-col bg-[#f0f2f5] pb-14 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-5 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={MARSBOT_LOGO_PATH} alt="Marsbot" className="w-9 h-9 object-contain flex-shrink-0" />
          <div>
            <div className="font-bold text-gray-900 text-sm leading-tight">Marsbot 火星豹</div>
            <div className="hidden md:block text-xs text-gray-400 leading-tight">AI 企业信用分析平台 · 风险评估 · 授信决策 · 财务体检</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 移动端新建申请按鈕 */}
          <button
            onClick={async () => {
              sessionStorage.removeItem(SESSION_KEY);
              setMessages([{ role: 'assistant', content: `您好！我是 **Marsbot 火星豹** AI 信贷风控助手 🐆\n\n请输入企业名称开始分析，或直接上传材料。` }]);
              setAppData({});
              setAnalysisResult(null);
              setUploadedDocs({});
              setUploadedFiles([]);
              setStep('welcome');
              setActiveTab('docs');
              setCurrentDraftRecordId(null);
              setMobilePage('chat');
              if (saasAuthenticated && saasUser?.id) {
                try {
                  const existingCount = historyQuery.data?.records?.length ?? 0;
                  const draftName = `新申请${existingCount + 1}`;
                  const result = await createDraftMutation.mutateAsync({
                    companyName: draftName,
                    tenantUserId: saasUser.id,
                  });
                  if (result.recordId) setCurrentDraftRecordId(result.recordId);
                } catch { /* 静默失败 */ }
              }
            }}
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-500 active:bg-orange-600 transition"
          >
            <span className="text-sm leading-none">+</span>
            新建
          </button>
          {/* SaaS 登录状态 */}
          {saasAuthenticated && saasUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                <UserCircle size={14} className="text-orange-500" />
                <span className="hidden md:inline max-w-[100px] truncate">{saasUser.name || saasUser.email || '已登录'}</span>
              </div>
              <button
                onClick={() => {
                  saasLogout();
                  window.location.href = '/saas/login';
                }}
                title="退出登录"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
              >
                <LogOut size={12} />
                <span className="hidden md:inline">退出</span>
              </button>
            </div>
          ) : (
            <a
              href="/saas/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 transition"
            >
              登录 / 注册
            </a>
          )}
          {/* 模型选择下拉框 - 移动端隐藏 */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowModelDropdown(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-orange-600 hover:border-orange-200 transition"
            >
              <Sparkles size={12} className="text-orange-500" />
              {currentModelName}
              <ChevronDown size={11} />
            </button>
            {showModelDropdown && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {MODEL_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleModelSelect(preset)}
                    className="w-full text-left px-3 py-2.5 hover:bg-orange-50 transition flex items-start gap-2"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-900">{preset.name}</div>
                      <div className="text-[10px] text-gray-400">{preset.desc}</div>
                    </div>
                    {currentModelName === preset.name && <CheckCircle2 size={12} className="text-orange-500 mt-0.5 flex-shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={() => {
                      setShowModelDropdown(false);
                      // 预填当前配置
                      const configs = configQuery.data?.configs || [];
                      const apiKeyConf = configs.find((c: any) => c.key === 'llm_api_key');
                      const modelConf = configs.find((c: any) => c.key === 'llm_model');
                      const apiUrlConf = configs.find((c: any) => c.key === 'llm_api_url');
                      setModelConfigForm({
                        apiKey: (apiKeyConf as any)?.value || '',
                        model: (modelConf as any)?.value || '',
                        apiUrl: (apiUrlConf as any)?.value || '',
                      });
                      setShowModelConfig(true);
                    }}
                    className="text-[10px] text-orange-500 hover:text-orange-600 transition"
                  >
                    ⚙️ 高级配置（自定义模型）
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setLocation('/industry-ontology')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition"
            title="行业本体库 - 查看和编辑各行业信贷风险知识"
          >
            <BookOpen size={13} />
            行业本体库
          </button>
          <button
            onClick={() => setLocation('/sentiment')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition"
          >
            <Globe size={13} />
            舆情分析
          </button>

        </div>
      </header>

      <div className={`flex-1 flex overflow-hidden ${(mobilePage === 'history' || mobilePage === 'profile') ? 'hidden md:flex' : ''}`}>
        {/* ── Far Left: Application History Sidebar ── */}
        <div className="hidden md:flex w-[200px] flex-shrink-0 bg-[#1a1a2e] flex-col border-r border-[#2a2a4e]">
          {/* 新建申请 */}
          <div className="px-3 py-3 border-b border-[#2a2a4e]">
            <button
              onClick={async () => {
                sessionStorage.removeItem(SESSION_KEY);
                setMessages([{ role: 'assistant', content: `您好！我是 **Marsbot 火星豹** AI 信贷风控助手 🐆\n\n请输入企业名称开始分析，我会自动搜索企业工商信息。您也可以直接上传材料（营业执照、财务报表、銀行流水等），我会自动识别并提取关键数据。\n\n支持的融资类型：**小额信贷 · 保理融资 · 供应链金融 · 抵押贷款**` }]);
                setAppData({});
                setAnalysisResult(null);
                setUploadedDocs({});
                setUploadedFiles([]);
                setStep('welcome');
                setActiveTab('docs');
                setCurrentDraftRecordId(null);
                // 登录状态下立即创建草稿记录，让左侧列表立即出现新申请
                if (saasAuthenticated && saasUser?.id) {
                  try {
                    const existingCount = historyQuery.data?.records?.length ?? 0;
                    const draftName = `新申请${existingCount + 1}`;
                    const result = await createDraftMutation.mutateAsync({
                      companyName: draftName,
                      tenantUserId: saasUser.id,
                    });
                    if (result.recordId) setCurrentDraftRecordId(result.recordId);
                  } catch { /* 静默失败，不影响主流程 */ }
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 transition"
            >
              <span className="text-base leading-none">+</span>
              <span>新建申请</span>
            </button>
          </div>
          {/* 申请列表 */}
          <div className="flex-1 overflow-y-auto py-2 flex flex-col">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider">申请记录</span>
              {historyQuery.data?.records && historyQuery.data.records.length > 0 && (
                <button
                  onClick={() => { setIsSelectMode(v => !v); setSelectedAppIds(new Set()); }}
                  className="text-[10px] text-[#6b7280] hover:text-orange-400 transition"
                >
                  {isSelectMode ? '取消' : '多选'}
                </button>
              )}
            </div>
            {/* 批量删除操作栏 */}
            {isSelectMode && selectedAppIds.size > 0 && (
              <div className="px-3 py-1.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.confirm(`确认删除选中的 ${selectedAppIds.size} 条申请记录？`)) {
                      deleteAppsBatchMutation.mutate({ ids: Array.from(selectedAppIds) });
                    }
                  }}
                  className="flex-1 text-[10px] py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 transition font-medium"
                >
                  删除 {selectedAppIds.size} 条
                </button>
                <button
                  onClick={() => setSelectedAppIds(new Set(historyQuery.data?.records?.map((r: { id: number }) => r.id) || []))}
                  className="text-[10px] text-[#6b7280] hover:text-white transition"
                >
                  全选
                </button>
              </div>
            )}
            {/* 未登录时显示登录提示 */}
            {!saasAuthenticated && (
              <div className="px-3 py-4 text-center">
                <div className="text-xs text-[#6b7280] mb-2">登录后可查看申请记录</div>
                <a
                  href="/saas/login"
                  className="inline-block text-[10px] px-3 py-1.5 rounded bg-orange-600 text-white hover:bg-orange-500 transition"
                >
                  登录 / 注册
                </a>
              </div>
            )}
            {saasAuthenticated && historyQuery.isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={14} className="animate-spin text-gray-500" />
              </div>
            )}
            {saasAuthenticated && !historyQuery.isLoading && (!historyQuery.data?.records || historyQuery.data.records.length === 0) && (
              <div className="px-3 py-4 text-center">
                <div className="text-xs text-[#6b7280]">暂无申请记录</div>
                <div className="text-[10px] text-[#4b5563] mt-1">完成一次分析后显示</div>
              </div>
            )}
            <div className="flex-1">
            {historyQuery.data?.records?.map((app: { id: number; companyName: string | null; aiVerdict: string | null; aiScore: number | null; createdAt: Date }) => (
              <div
                key={app.id}
                className={`relative group flex items-start hover:bg-[#2a2a4e] transition ${
                  currentDraftRecordId === (app as any).recordId ? 'bg-[#2d2d50] border-l-[3px] border-l-orange-500 shadow-[inset_0_0_0_1px_rgba(249,115,22,0.3)]' : 'border-l-[3px] border-l-transparent'
                }`}
              >
                {/* 多选模式下的复选框 */}
                {isSelectMode && (
                  <div className="flex-shrink-0 pl-3 pt-3">
                    <input
                      type="checkbox"
                      checked={selectedAppIds.has(app.id)}
                      onChange={e => {
                        setSelectedAppIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(app.id); else next.delete(app.id);
                          return next;
                        });
                      }}
                      className="w-3 h-3 accent-orange-500"
                    />
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (isSelectMode) {
                      setSelectedAppIds(prev => {
                        const next = new Set(prev);
                        if (next.has(app.id)) next.delete(app.id); else next.add(app.id);
                        return next;
                      });
                      return;
                    }
                    // ─── 切换前：立即强制保存当前所有文件（包括uploading/parsing的，改为error可重试）───
                    if (currentDraftRecordId) {
                      // 清除防抖定时器，避免和即将到来的切换冲突
                      if (persistTimerRef.current) { clearTimeout(persistTimerRef.current); persistTimerRef.current = null; }
                      // 把所有文件（含中间状态）序列化保存，uploading/parsing改为error
                      const allFilesToSave = uploadedFiles.map(({ _file: _f, ...rest }) => ({
                        ...rest,
                        status: (rest.status === 'uploading' || rest.status === 'parsing') ? 'error' : rest.status,
                      }));
                      // 同步规范化 chatMessages 里的文件卡片快照状态（uploading/parsing → error）
                      const normalizedMsgsForSave = messages.map((m: any) => ({
                        ...m,
                        uploadedFiles: m.uploadedFiles?.map((uf: any) => ({
                          ...uf,
                          status: (uf.status === 'uploading' || uf.status === 'parsing') ? 'error' : uf.status,
                          _file: undefined,
                        })),
                        zipEntries: m.zipEntries?.map((ze: any) => ({
                          ...ze,
                          status: (ze.status === 'uploading' || ze.status === 'parsing') ? 'error' : ze.status,
                          file: undefined,
                        })),
                      }));
                      try {
                        await utils.client.loan.updateFileState.mutate({
                          recordId: currentDraftRecordId,
                          uploadedFilesList: allFilesToSave,
                          chatMessages: normalizedMsgsForSave,
                        });
                      } catch { /* 静默失败，不阻塞切换 */ }
                    }
                    // 加载详情并恢复分析结果
                    setSwitchingRecordId(app.id);
                    try {
                      const detail = await utils.client.loan.getApplicationDetail.query({ id: app.id });
                      if (detail) {
                        // 从数据库基础字段恢复 appData
                        const restoredAppData: AppData = {
                          companyName: detail.companyName || undefined,
                          creditCode: detail.creditCode || undefined,
                          legalPerson: detail.legalPerson || undefined,
                          registeredCapital: detail.registeredCapital || undefined,
                          establishDate: detail.establishDate || undefined,
                          address: detail.address || undefined,
                          industry: detail.industry || undefined,
                          amount: detail.amount || undefined,
                          loanType: detail.loanType || undefined,
                          period: detail.period || undefined,
                          purpose: detail.purpose || undefined,
                        };
                        // 从 aiReport 中恢复财务数据
                        const aiReport = detail.aiReport as Record<string, unknown> | null;
                        if (aiReport) {
                          const fr = aiReport.financialReport as Record<string, unknown> | undefined;
                          if (fr) {
                            restoredAppData.revenue = fr.revenue as string | undefined;
                            restoredAppData.netProfit = fr.netProfit as string | undefined;
                            restoredAppData.totalAssets = fr.totalAssets as string | undefined;
                            restoredAppData.totalLiabilities = fr.totalLiabilities as string | undefined;
                            restoredAppData.operatingCashFlow = fr.operatingCashFlow as string | undefined;
                          }
                          // 恢复 financialStatements
                          if (aiReport.financialStatements) {
                            restoredAppData.financialStatements = aiReport.financialStatements as AppData['financialStatements'];
                          }
                          if (aiReport.financialStatementsByYear) {
                            restoredAppData.financialStatementsByYear = aiReport.financialStatementsByYear as AppData['financialStatementsByYear'];
                          }
                          // 恢复银行流水和税务数据
                          if (aiReport.bankData) {
                            restoredAppData.bankData = aiReport.bankData as AppData['bankData'];
                          }
                          if (aiReport.taxData) {
                            restoredAppData.taxData = aiReport.taxData as AppData['taxData'];
                          }
                          if (aiReport.bankFlowSummary) {
                            restoredAppData.bankFlowSummary = aiReport.bankFlowSummary as AppData['bankFlowSummary'];
                          }
                        }
                        setAppData(restoredAppData);
                        // 从 aiReport 恢复分析结果
                        if (aiReport) {
                          const restoredResult: AnalysisResult = {
                            verdict: (detail.aiVerdict as AnalysisResult['verdict']) || 'reduced',
                            creditScore: detail.aiScore || 0,
                            layer3: (aiReport.layer3 as AnalysisResult['layer3']) || undefined,
                          };
                          setAnalysisResult(restoredResult);
                        }
                        // 恢复上传文件列表（从 aiReport 中提取）
                        const aiReportData2 = detail.aiReport as Record<string, unknown> | null;
                        // 对恢复的文件状态做规范化：有url的改为done，没有url的改为error（避免状态卡住）
                        const normalizeRestoredFile = (f: any): UploadedFile => ({
                          ...f,
                          status: f.url ? 'done' : 'error',
                          _file: undefined, // 清除已失效的文件引用
                        });
                        if (aiReportData2 && Array.isArray(aiReportData2.uploadedFilesList) && (aiReportData2.uploadedFilesList as any[]).length > 0) {
                          setUploadedFiles((aiReportData2.uploadedFilesList as any[]).map(normalizeRestoredFile));
                        } else if (aiReportData2 && aiReportData2.uploadedDocsMap && typeof aiReportData2.uploadedDocsMap === 'object') {
                          // BUG3修复：旧记录没有保存 uploadedFilesList，从 uploadedDocsMap 重建文件列表
                          const docsMap = aiReportData2.uploadedDocsMap as Record<string, any>;
                          const reconstructed: UploadedFile[] = Object.entries(docsMap)
                            .filter(([, v]) => v && typeof v === 'object' && (v.fileName || v.url))
                            .map(([docId, v]: [string, any]) => ({
                              id: docId,
                              name: v.fileName || v.name || docId,
                              size: v.fileSize || '',
                              docId,
                              docName: v.docName || docId,
                              parseType: v.parseType,
                              status: v.url ? 'done' as const : 'error' as const,
                              url: v.url,
                            }));
                          setUploadedFiles(reconstructed);
                        } else {
                          setUploadedFiles([]);
                        }
                        if (aiReportData2 && aiReportData2.uploadedDocsMap && typeof aiReportData2.uploadedDocsMap === 'object') {
                          setUploadedDocs(aiReportData2.uploadedDocsMap as Record<string, any>);
                        } else {
                          setUploadedDocs({});
                        }                       // 更新currentDraftRecordId以保持左侧高亮
                        setCurrentDraftRecordId((app as any).recordId || String(app.id));
                        setStep('result');
                        setActiveTab('docs');
                        // 移动端自动切换到分析 Tab
                        setMobilePage('analysis');                        // 恢复对话历史（优先从 aiReport 读取，否则生成摘要提示）
                        const verdictText = detail.aiVerdict === 'approved' ? '批准通过' : detail.aiVerdict === 'rejected' ? '建议拒绝' : '建议降额';
                        const savedChatMessages = (aiReport as any)?.chatMessages as Array<{role: string; content: string; uploadedFiles?: any[]; zipCard?: any}> | undefined;
                        if (savedChatMessages && savedChatMessages.length > 0) {
                          // 同步规范化消息中的 uploadedFiles 状态（避免切换回来后文件状态卡住）
                          const normalizedMessages = savedChatMessages.map((m: any) => ({
                            ...m,
                            uploadedFiles: m.uploadedFiles?.map((uf: any) => ({
                              ...uf,
                              status: uf.url ? 'done' : 'error',
                              _file: undefined,
                            })),
                          }));
                          setMessages(normalizedMessages as typeof messages);
                        } else {
                          setMessages([{ role: 'assistant', content: `📊 已恢复历史申请：**${detail.companyName || '未知企业'}**\n\n| 指标 | 结果 |\n|------|------|\n| 信用评分 | **${detail.aiScore || '--'}分** |\n| 审批结果 | **${verdictText}** |\n\n右侧面板已显示完整分析结果，可切换各个标签查看详情。` }]);
                        }
                        setTimeout(() => setSwitchingRecordId(null), 50);
                      }
                    } catch {
                      setTimeout(() => setSwitchingRecordId(null), 50);
                      const companyName = app.companyName || '未知企业';
                      const verdict = app.aiVerdict;
                      const score = app.aiScore;
                      const verdictText = verdict === 'approved' ? '批准通过' : verdict === 'rejected' ? '建议拒绝' : '建议降额';
                      addMsg('assistant', `📊 历史申请：**${companyName}**\n\n| 指标 | 结果 |\n|------|------|\n| 信用评分 | **${score || '--'}分** |\n| 审批结果 | **${verdictText}** |`);
                    }                  }}
                  className="flex-1 text-left px-3 py-2.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-medium text-gray-200 truncate group-hover:text-white flex-1">{app.companyName || '未命名申请'}</div>
                    {switchingRecordId === app.id && <Loader2 size={11} className="animate-spin text-orange-400 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {switchingRecordId === app.id ? (
                      <span className="text-[10px] text-orange-400">加载中...</span>
                    ) : (
                      <>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          app.aiVerdict === 'approved' ? 'bg-green-900 text-green-300' :
                          app.aiVerdict === 'rejected' ? 'bg-red-900 text-red-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {app.aiScore ? `${app.aiScore}分` : '待评'}
                        </span>
                        <span className="text-[10px] text-[#6b7280]">
                          {new Date(app.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </button>
                {/* 单条删除按鈕（悬浮显示） */}
                {!isSelectMode && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`确认删除「${app.companyName || '未命名申请'}」的申请记录？`)) {
                        deleteAppMutation.mutate({ id: app.id });
                      }
                    }}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-[#9ca3af] hover:text-red-400 hover:bg-red-50 rounded transition mr-1 mt-1.5"
                    title="删除"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            </div>
          </div>
        </div>

        {/* ── Left: Chat ── */}
        <div
          className={`flex-col w-full md:w-[420px] md:flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-300 ease-in-out ${mobilePage === 'chat' ? 'flex' : 'hidden md:flex'} ${switchingRecordId ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <img src={MARSBOT_LOGO_PATH} alt="M" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col gap-1 max-w-[340px]">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-orange-500 text-white rounded-tr-sm"
                      : "bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-100"
                  }`}>
                    {msg.role === "assistant"
                      ? <Streamdown>{msg.content}</Streamdown>
                      : <span className="whitespace-pre-wrap">{msg.content}</span>}
                  </div>
                  {msg.timestamp && (
                    <div className={`text-[10px] text-gray-400 px-1 ${
                      msg.role === "user" ? "text-right" : "text-left"
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}

                  {/* 企业候选列表 */}
                  {msg.searchResults && msg.searchResults.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.searchResults.map(company => (
                        <button
                          key={company.id}
                          onClick={() => handleSelectCompany(company)}
                          className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 transition-all group shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 group-hover:text-orange-700 truncate">{company.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                <span>{company.province}</span>
                                <span>·</span>
                                <span>{company.registeredCapital}</span>
                                <span>·</span>
                                <span className={company.registrationStatus === "存续" ? "text-green-600" : "text-gray-400"}>{company.registrationStatus}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">法人：{company.legalPerson}</div>
                            </div>
                            <div className="text-xs text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">选择 →</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 压缩包解析卡片 */}
                  {msg.zipCard && (
                    <div className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-50 border-b border-orange-100">
                        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-orange-800 truncate">{msg.zipCard.zipName}</div>
                          <div className="text-[10px] text-orange-500">{msg.zipCard.entries.length} 个文件</div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {msg.zipCard.entries.map(entry => {
                          const liveEntry = zipEntriesMap[msg.zipCard!.zipId]?.find(e => e.id === entry.id) || entry;
                          return (
                            <div key={entry.id} className="flex items-center gap-2.5 px-3.5 py-2">
                              <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                                <FileTypeIcon name={entry.name} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-800 truncate">{entry.name}</div>
                                <div className="text-[10px] text-gray-400">{entry.size}</div>
                              </div>
                              {/* 资料类型标签 */}
                              {liveEntry.status === 'pending' ? (
                                <select
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-600 max-w-[90px]"
                                  defaultValue=""
                                  onChange={e => {
                                    const selectedDocId = e.target.value;
                                    if (!selectedDocId) return;
                                    const doc = DOC_CHECKLIST.find(d => d.id === selectedDocId);
                                    if (!doc || !liveEntry.file) return;
                                    const parseType = DOC_PARSE_TYPE_MAP[selectedDocId] || 'contract';
                                    // 更新 zipEntriesMap
                                    setZipEntriesMap(prev => ({
                                      ...prev,
                                      [msg.zipCard!.zipId]: (prev[msg.zipCard!.zipId] || []).map(e =>
                                        e.id === entry.id ? { ...e, docId: selectedDocId, docName: doc.name, parseType, status: 'uploading', userSelected: true } : e
                                      )
                                    }));
                                    // 更新消息中的 zipCard
                                    setMessages(prev => prev.map(m =>
                                      m.zipCard?.zipId === msg.zipCard!.zipId
                                        ? { ...m, zipCard: { ...m.zipCard!, entries: m.zipCard!.entries.map(e => e.id === entry.id ? { ...e, docId: selectedDocId, docName: doc.name, parseType, status: 'uploading', userSelected: true } : e) } }
                                        : m
                                    ));
                                    // 开始上传解析
                                    const nf: UploadedFile = { id: entry.id, name: entry.name, size: entry.size, docId: selectedDocId, docName: doc.name, parseType, status: 'uploading', fromZip: msg.zipCard!.zipName };
                                    setUploadedFiles(prev => [...prev, nf]);
                                    handleFileUploadForDoc([liveEntry.file!], selectedDocId, doc.name, parseType);
                                  }}
                                >
                                  <option value="">选择类型...</option>
                                  {DOC_CHECKLIST.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 max-w-[70px] truncate">{liveEntry.docName}</span>
                              )}
                              {/* 状态 */}
                              <div className="flex-shrink-0">
                                {liveEntry.status === 'pending' && <span className="text-[10px] text-gray-400">待选择</span>}
                                {liveEntry.status === 'uploading' && <Loader2 size={11} className="animate-spin text-blue-500" />}
                                {liveEntry.status === 'parsing' && <Loader2 size={11} className="animate-spin text-orange-500" />}
                                {liveEntry.status === 'done' && <CheckCircle2 size={11} className="text-green-500" />}
                                {liveEntry.status === 'error' && (
                                  <button
                                    onClick={() => {
                                      // 找到对应的 uploadedFile
                                      const uf = uploadedFilesRef.current.find(x => x.id === liveEntry.id);
                                      if (uf) {
                                        // 有记录：走通用重试逻辑（自动判断用URL重解析还是重上传）
                                        retryParseFile(liveEntry.id);
                                      } else if (liveEntry.file && liveEntry.file instanceof Blob) {
                                        // 没有记录且有有效的 Blob → 重新上传
                                        const doc = DOC_CHECKLIST.find(d => d.id === liveEntry.docId);
                                        if (doc) handleFileUploadForDoc([liveEntry.file!], liveEntry.docId, doc.name, liveEntry.parseType);
                                      } else if (liveEntry.url) {
                                        // 没有记录且文件已丢失但有URL → 直接重新解析
                                        const parseType = liveEntry.parseType || DOC_PARSE_TYPE_MAP[liveEntry.docId] || 'contract';
                                        utils.client.loan.parseDocument.mutate({ fileUrl: liveEntry.url, fileType: parseType as any, docId: liveEntry.docId }).catch(console.error);
                                      } else {
                                        alert('文件已丢失，请重新上传压缩包');
                                      }
                                    }}
                                    className="flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-700 transition-colors"
                                    title="点击重试"
                                  >
                                    <RefreshCw size={10} />
                                    <span>重试</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 上传文件卡片（Manus 风格） */}
                  {msg.uploadedFiles && msg.uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {msg.uploadedFiles.map(f => {
                        // 获取最新状态（从 uploadedFiles state 中查找）
                        const liveFile = uploadedFiles.find(uf => uf.id === f.id) || f;
                        const isFinancial = /财务|年报|财务报告|审计|财务表|financial|annual|audit/i.test(liveFile.name);
                        const summaryText = (liveFile.parsedData?.summary as string | undefined) ?? "";
                        const hasThreeTables = !!(liveFile.parsedData?.balanceSheet || liveFile.parsedData?.incomeStatement || liveFile.parsedData?.cashFlowStatement);
                        return (
                          <div key={f.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* 文件头部 */}
                            <div className="flex items-center gap-3 px-3.5 py-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100">
                                <FileTypeIcon name={liveFile.name} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{liveFile.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                  <span>{liveFile.size}</span>
                                  {liveFile.docName && liveFile.docName !== "其他资料" && (
                                    <span className="text-gray-400">· {liveFile.docName}</span>
                                  )}
                                </div>
                              </div>
                              {liveFile.url && (
                                <a
                                  href={liveFile.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                                  title="查看文件"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              {/* Bug4修复：上传/解析中可取消 */}
                              {(liveFile.status === "uploading" || liveFile.status === "parsing") && (
                                <button
                                  onClick={() => {
                                    setUploadedFiles(prev => prev.map(f2 => f2.id === liveFile.id ? { ...f2, status: "error" as const } : f2));
                                    setMessages(prev => prev.map(m => ({
                                      ...m,
                                      uploadedFiles: m.uploadedFiles?.map(uf => uf.id === liveFile.id ? { ...uf, status: "error" as const } : uf)
                                    })));
                                  }}
                                  className="flex-shrink-0 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors border border-red-100"
                                  title="取消处理"
                                >
                                  取消
                                </button>
                              )}
                            </div>
                            {/* Manus 风格解析步骤 */}
                            {(liveFile.status === "uploading" || liveFile.status === "parsing" || liveFile.status === "done" || liveFile.status === "error") && (
                              <div className="px-3.5 pb-3 border-t border-gray-50">
                                {/* 步骤列表 */}
                                <div className="mt-2.5 space-y-1.5">
                                  {getParseSteps(liveFile.parseType || "contract", liveFile.status).map((step, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      {/* 步骤图标 */}
                                      {step.status === "done" && (
                                        <div className="w-3.5 h-3.5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                      )}
                                      {step.status === "active" && (
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                        </div>
                                      )}
                                      {step.status === "pending" && (
                                        <div className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0" />
                                      )}
                                      {step.status === "error" && (
                                        <div className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2 2L6 6M6 2L2 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                        </div>
                                      )}
                                      {/* 步骤文字 */}
                                      <span className={`text-xs leading-tight ${
                                        step.status === "done" ? "text-gray-500" :
                                        step.status === "active" ? "text-blue-600 font-medium" :
                                        step.status === "error" ? "text-red-500" :
                                        "text-gray-300"
                                      }`}>
                                        {step.label}
                                        {step.status === "active" && (
                                          <span className="ml-1 inline-flex gap-0.5">
                                            <span className="w-0.5 h-0.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:"0ms"}} />
                                            <span className="w-0.5 h-0.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:"150ms"}} />
                                            <span className="w-0.5 h-0.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:"300ms"}} />
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {/* 完成结论区块 */}
                                {liveFile.status === "done" && (
                                  <div className="mt-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <CheckCircle2 size={12} className="text-green-600 flex-shrink-0" />
                                      <span className="text-xs font-semibold text-green-700">解析完成</span>
                                    </div>
                                    {/* 财务报表三张表标签 */}
                                    {hasThreeTables && (
                                      <div className="flex flex-wrap gap-1 mb-1.5">
                                        {!!liveFile.parsedData?.balanceSheet ? <span className="text-[10px] bg-white text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">资产负债表</span> : null}
                                        {!!liveFile.parsedData?.incomeStatement ? <span className="text-[10px] bg-white text-green-700 px-1.5 py-0.5 rounded border border-green-100">利润表</span> : null}
                                        {!!liveFile.parsedData?.cashFlowStatement ? <span className="text-[10px] bg-white text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">现金流量表</span> : null}
                                        {(isFinancial && !hasThreeTables) ? <span className="text-[10px] bg-white text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-100">⚠ 表格未识别</span> : null}
                                      </div>
                                    )}
                                    {/* 解析摘要 - 已提取 */}
                                    {/* 营业执照：企业名称 */}
                                    {liveFile.parseType === "business_license" && !!liveFile.parsedData ? (
                                      <p className="text-xs text-green-800 leading-relaxed">
                                        {String((liveFile.parsedData.companyName || liveFile.parsedData.company) ?? "")}
                                        {liveFile.parsedData.creditCode ? ` · ${String(liveFile.parsedData.creditCode)}` : ""}
                                      </p>
                                    ) : null}
                                    {/* 银行流水：月均流水 */}
                                    {liveFile.parseType === "bank_statement" && !!liveFile.parsedData?.avgMonthlyInflow ? (
                                      <p className="text-xs text-green-800 leading-relaxed">
                                        月均流入 {typeof liveFile.parsedData.avgMonthlyInflow === "number"
                                          ? (liveFile.parsedData.avgMonthlyInflow / 10000).toFixed(1) + " 万元"
                                          : String(liveFile.parsedData.avgMonthlyInflow)}
                                      </p>
                                    ) : null}
                                    {/* 增值税申报表 */}
                                    {liveFile.parseType === "tax_vat" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.taxPeriod ? <span className="text-xs text-green-800">期间：{String(liveFile.parsedData.taxPeriod)}</span> : null}
                                        {liveFile.parsedData.salesRevenue != null ? <span className="text-xs text-green-800">含税收入：{Number(liveFile.parsedData.salesRevenue).toFixed(1)}万</span> : null}
                                        {liveFile.parsedData.taxBurdenRate != null ? <span className="text-xs text-green-800">税负率：{Number(liveFile.parsedData.taxBurdenRate).toFixed(2)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 企业所得税 */}
                                    {liveFile.parseType === "tax_income" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.taxYear ? <span className="text-xs text-green-800">年度：{String(liveFile.parsedData.taxYear)}</span> : null}
                                        {liveFile.parsedData.annualRevenue != null ? <span className="text-xs text-green-800">年收入：{Number(liveFile.parsedData.annualRevenue).toFixed(1)}万</span> : null}
                                        {liveFile.parsedData.taxableIncome != null ? <span className="text-xs text-green-800">应税所得：{Number(liveFile.parsedData.taxableIncome).toFixed(1)}万</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 完税证明/纳税信用 */}
                                    {(liveFile.parseType === "tax_clearance" || liveFile.parseType === "tax_credit") && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.creditLevel ? <span className="text-xs text-green-800 font-medium">信用等级：{String(liveFile.parsedData.creditLevel)}</span> : null}
                                        {liveFile.parsedData.clearancePeriod ? <span className="text-xs text-green-800">期间：{String(liveFile.parsedData.clearancePeriod)}</span> : null}
                                        {liveFile.parsedData.hasArrears === false ? <span className="text-xs text-green-700">✓ 无欠税</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 发票 */}
                                    {liveFile.parseType === "invoice" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.sellerName ? <span className="text-xs text-green-800">销方：{String(liveFile.parsedData.sellerName)}</span> : null}
                                        {liveFile.parsedData.totalAmount != null ? <span className="text-xs text-green-800">价税合计：{Number(liveFile.parsedData.totalAmount).toFixed(2)}万</span> : null}
                                        {liveFile.parsedData.taxRate != null ? <span className="text-xs text-green-800">税率：{Number(liveFile.parsedData.taxRate)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 甲方合同 */}
                                    {liveFile.parseType === "customer_contract" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.partyA ? <span className="text-xs text-green-800">甲方：{String(liveFile.parsedData.partyA)}</span> : null}
                                        {liveFile.parsedData.contractAmount != null ? <span className="text-xs text-green-800">合同额：{Number(liveFile.parsedData.contractAmount).toFixed(1)}万</span> : null}
                                        {liveFile.parsedData.performanceStatus ? <span className="text-xs text-green-800">状态：{String(liveFile.parsedData.performanceStatus)}</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 供应商合同 */}
                                    {liveFile.parseType === "supplier_contract" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.supplierName ? <span className="text-xs text-green-800">供应商：{String(liveFile.parsedData.supplierName)}</span> : null}
                                        {liveFile.parsedData.contractAmount != null ? <span className="text-xs text-green-800">合同额：{Number(liveFile.parsedData.contractAmount).toFixed(1)}万</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 公司章程 */}
                                    {liveFile.parseType === "articles" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.registeredCapital != null ? <span className="text-xs text-green-800">注册资本：{Number(liveFile.parsedData.registeredCapital).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.legalPerson ? <span className="text-xs text-green-800">法人：{String(liveFile.parsedData.legalPerson)}</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 抵押资料 */}
                                    {liveFile.parseType === "mortgage" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.mortgageType ? <span className="text-xs text-green-800">类型：{String(liveFile.parsedData.mortgageType)}</span> : null}
                                        {liveFile.parsedData.assessedValue != null ? <span className="text-xs text-green-800">评估值：{Number(liveFile.parsedData.assessedValue).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.mortgageRatio != null ? <span className="text-xs text-green-800">抵押率：{Number(liveFile.parsedData.mortgageRatio).toFixed(2)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* Top5大客户 */}
                                    {liveFile.parseType === "top5_customer" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.top5RevenueRatio != null ? <span className="text-xs text-green-800">Top5占比：{Number(liveFile.parsedData.top5RevenueRatio).toFixed(2)}%</span> : null}
                                        {liveFile.parsedData.top1RevenueRatio != null ? <span className="text-xs text-green-800">Top1占比：{Number(liveFile.parsedData.top1RevenueRatio).toFixed(2)}%</span> : null}
                                        {liveFile.parsedData.hhiIndex != null ? <span className="text-xs text-green-800">HHI：{Number(liveFile.parsedData.hhiIndex).toFixed(3)}</span> : null}
                                      </div>
                                    ) : null}
                                    {/* Top5供应商 */}
                                    {liveFile.parseType === "top5_supplier" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.top5PurchaseRatio != null ? <span className="text-xs text-green-800">Top5占比：{Number(liveFile.parsedData.top5PurchaseRatio).toFixed(2)}%</span> : null}
                                        {liveFile.parsedData.top1PurchaseRatio != null ? <span className="text-xs text-green-800">Top1占比：{Number(liveFile.parsedData.top1PurchaseRatio).toFixed(2)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 营业收入组成 */}
                                    {liveFile.parseType === "revenue_breakdown" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.totalRevenue != null ? <span className="text-xs text-green-800">总收入：{Number(liveFile.parsedData.totalRevenue).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.recurringRevenueRatio != null ? <span className="text-xs text-green-800">复购率：{Number(liveFile.parsedData.recurringRevenueRatio).toFixed(2)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 在手订单 */}
                                    {liveFile.parseType === "open_orders" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.totalOrderAmount != null ? <span className="text-xs text-green-800">在手订单：{Number(liveFile.parsedData.totalOrderAmount).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.expectedPaymentNext3M != null ? <span className="text-xs text-green-800">3月内回款：{Number(liveFile.parsedData.expectedPaymentNext3M).toFixed(0)}万</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 销售台账 */}
                                    {liveFile.parseType === "sales_ledger" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.totalSalesAmount != null ? <span className="text-xs text-green-800">销售额：{Number(liveFile.parsedData.totalSalesAmount).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.collectionRatio != null ? <span className="text-xs text-green-800">回款率：{Number(liveFile.parsedData.collectionRatio).toFixed(2)}%</span> : null}
                                        {liveFile.parsedData.overdueRatio != null ? <span className="text-xs text-green-800">逾期率：{Number(liveFile.parsedData.overdueRatio).toFixed(2)}%</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 他行授信 */}
                                    {liveFile.parseType === "credit_facility" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.totalCreditLimit != null ? <span className="text-xs text-green-800">总授信：{Number(liveFile.parsedData.totalCreditLimit).toFixed(0)}万</span> : null}
                                        {liveFile.parsedData.utilizationRate != null ? <span className="text-xs text-green-800">使用率：{Number(liveFile.parsedData.utilizationRate).toFixed(2)}%</span> : null}
                                        {liveFile.parsedData.hasOverdue === false ? <span className="text-xs text-green-700">✓ 无逾期</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 公司介绍 */}
                                    {liveFile.parseType === "business_intro" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.mainBusiness ? <span className="text-xs text-green-800">主营：{String(liveFile.parsedData.mainBusiness).slice(0, 30)}</span> : null}
                                        {liveFile.parsedData.employeeCount != null ? <span className="text-xs text-green-800">员工：{Number(liveFile.parsedData.employeeCount)}人</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 高管简历 */}
                                    {liveFile.parseType === "mgmt_resume" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.name ? <span className="text-xs text-green-800">{String(liveFile.parsedData.name)} · {String(liveFile.parsedData.title || "")}</span> : null}
                                        {liveFile.parsedData.industryExperience != null ? <span className="text-xs text-green-800">从业{Number(liveFile.parsedData.industryExperience)}年</span> : null}
                                        {liveFile.parsedData.hasAdverseRecord === false ? <span className="text-xs text-green-700">✓ 无不良记录</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 开户许可证 */}
                                    {liveFile.parseType === "bank_permit" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.bankName ? <span className="text-xs text-green-800">开户行：{String(liveFile.parsedData.bankName)}</span> : null}
                                        {liveFile.parsedData.accountType ? <span className="text-xs text-green-800">类型：{String(liveFile.parsedData.accountType)}</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 资质证书 */}
                                    {liveFile.parseType === "qualification" && !!liveFile.parsedData ? (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                        {liveFile.parsedData.certName ? <span className="text-xs text-green-800">{String(liveFile.parsedData.certName)}</span> : null}
                                        {liveFile.parsedData.certLevel ? <span className="text-xs text-green-800">等级：{String(liveFile.parsedData.certLevel)}</span> : null}
                                        {liveFile.parsedData.isValid === true ? <span className="text-xs text-green-700">✓ 有效</span> : null}
                                      </div>
                                    ) : null}
                                    {/* 无任何摘要时的兜底文字 */}
                                    {!liveFile.parsedData?.summary && !hasThreeTables &&
                                      liveFile.parseType !== "business_license" &&
                                      liveFile.parseType !== "bank_statement" &&
                                      liveFile.parseType !== "tax_vat" &&
                                      liveFile.parseType !== "tax_income" &&
                                      liveFile.parseType !== "tax_clearance" &&
                                      liveFile.parseType !== "tax_credit" &&
                                      liveFile.parseType !== "invoice" &&
                                      liveFile.parseType !== "customer_contract" &&
                                      liveFile.parseType !== "supplier_contract" &&
                                      liveFile.parseType !== "articles" &&
                                      liveFile.parseType !== "mortgage" &&
                                      liveFile.parseType !== "top5_customer" &&
                                      liveFile.parseType !== "top5_supplier" &&
                                      liveFile.parseType !== "revenue_breakdown" &&
                                      liveFile.parseType !== "open_orders" &&
                                      liveFile.parseType !== "sales_ledger" &&
                                      liveFile.parseType !== "credit_facility" &&
                                      liveFile.parseType !== "business_intro" &&
                                      liveFile.parseType !== "mgmt_resume" &&
                                      liveFile.parseType !== "bank_permit" &&
                                      liveFile.parseType !== "qualification" && (
                                      <p className="text-xs text-green-700">已提取关键信息，已同步至右侧面板</p>
                                    )}
                                  </div>
                                )}
                                {/* 错误区块 */}
                                {liveFile.status === "error" && (
                                  <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                      <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-medium text-red-700">{liveFile.url ? '解析失败' : '上传失败'}</p>
                                        <p className="text-[10px] text-red-500 mt-0.5">{liveFile.url ? '点击右侧重试按钮重新解析' : '点击右侧重试按钮重新上传'}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => retryParseFile(liveFile.id)}
                                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors"
                                      title={liveFile.url ? '重新解析' : '重新上传'}
                                    >
                                      <RefreshCw size={11} />
                                      {liveFile.url ? '重新解析' : '重新上传'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 分析中动画 */}
            {isAnalyzing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <img src={MARSBOT_LOGO_PATH} alt="M" className="w-full h-full object-cover" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={13} className="animate-spin text-orange-500" />
                    AI 正在分析中...
                  </div>
                </div>
              </div>
            )}
            {/* 通用AI回复中动画 */}
            {isChatLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <img src={MARSBOT_LOGO_PATH} alt="M" className="w-full h-full object-cover" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </span>
                    <span className="text-gray-400">AI 正在思考...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>



          {/* 甲方信息录入区块（仅保理/供应链融资场景显示） */}
          {step === "loan-info" && (appData.loanType === "保理融资" || appData.loanType === "供应链金融") && (
            <div className="mx-4 mb-2 border border-blue-200 rounded-xl bg-blue-50 overflow-hidden">
              <button
                onClick={() => setShowCounterpartyForm(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>甲方（债务人）信息
                    {appData.counterpartyInfo?.name && (
                      <span className="ml-2 font-normal text-blue-500">— {appData.counterpartyInfo.name}</span>
                    )}
                  </span>
                  {!appData.counterpartyInfo?.name && (
                    <span className="ml-1 text-[10px] text-orange-500 font-normal">建议填写</span>
                  )}
                </div>
                {showCounterpartyForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showCounterpartyForm && (
                <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-blue-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">甲方企业名称 *</label>
                      <input
                        type="text"
                        value={appData.counterpartyInfo?.name || ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), name: e.target.value } }))}
                        placeholder="如：华为技术有限公司"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">统一社会信用代码</label>
                      <input
                        type="text"
                        value={appData.counterpartyInfo?.creditCode || ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), creditCode: e.target.value } }))}
                        placeholder="18位代码"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">合同金额（万元）</label>
                      <input
                        type="number"
                        value={appData.counterpartyInfo?.contractAmount ?? ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), contractAmount: e.target.value ? parseFloat(e.target.value) : undefined } }))}
                        placeholder="如：500"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">历史合作账期（天）</label>
                      <input
                        type="number"
                        value={appData.counterpartyInfo?.paymentTermDays ?? ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), paymentTermDays: e.target.value ? parseInt(e.target.value) : undefined } }))}
                        placeholder="如：90"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">应收账款占比（%）</label>
                      <input
                        type="number"
                        min="0" max="100"
                        value={appData.counterpartyInfo?.arConcentrationRatio != null ? (appData.counterpartyInfo.arConcentrationRatio * 100).toFixed(0) : ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), arConcentrationRatio: e.target.value ? parseFloat(e.target.value) / 100 : undefined } }))}
                        placeholder="如：45"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 placeholder-gray-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-medium block mb-1">付款方式</label>
                      <select
                        value={appData.counterpartyInfo?.paymentMethod || ''}
                        onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), paymentMethod: e.target.value || undefined } }))}
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400 text-gray-600"
                      >
                        <option value="">请选择</option>
                        <option value="电汇">电汇</option>
                        <option value="第三方支付">第三方支付</option>
                        <option value="现金">现金</option>
                        <option value="商业汇票">商业汇票</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-[10px] text-blue-600 font-medium">逾期记录</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="radio" name="overdue" checked={appData.counterpartyInfo?.hasOverdueHistory === false}
                          onChange={() => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), hasOverdueHistory: false } }))}
                          className="accent-blue-500" />
                        无逾期
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="radio" name="overdue" checked={appData.counterpartyInfo?.hasOverdueHistory === true}
                          onChange={() => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), hasOverdueHistory: true } }))}
                          className="accent-red-500" />
                        <span className="text-red-500">有逾期</span>
                      </label>
                    </div>
                    {appData.counterpartyInfo?.hasOverdueHistory && (
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-blue-600">逾期天数</label>
                        <input
                          type="number"
                          value={appData.counterpartyInfo?.overdueDays ?? ''}
                          onChange={e => setAppData(prev => ({ ...prev, counterpartyInfo: { ...(prev.counterpartyInfo || {}), overdueDays: e.target.value ? parseInt(e.target.value) : undefined } }))}
                          placeholder="天"
                          className="w-16 text-xs px-2 py-1 rounded-lg border border-blue-200 bg-white focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-blue-400 bg-blue-100 rounded-lg px-3 py-2">
                    ℹ️ 甲方信息用于触发交易真实性验证规则（R-FACT-01/02/03），影响保理风险评估结果。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 快捷操作 */}
          <div className="px-4 pt-2 flex flex-wrap gap-1.5">

            {(step === "company-selected" || step === "loan-info" || (step === "welcome" && uploadedFiles.length > 0)) && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition font-medium"
              >
                <Sparkles size={11} /> 开始AI分析
              </button>
            )}
            {step === "result" && (
              <button onClick={() => {
                setMessages([{ role: "assistant", content: "好的，开始新的申请。请输入企业名称：" }]);
                setStep("welcome"); setAppData({}); setAnalysisResult(null);
                setUploadedFiles([]); setUploadedDocs({}); setActiveTab("docs");
              }} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                <span>↩</span> 新建申请
              </button>
            )}
          </div>

                    {/* 输入框 */}
          <div className="px-4 pb-4 pt-2">
            <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2.5 focus-within:border-orange-300 focus-within:bg-white transition">
              {/* 相机拍照按钮 */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition flex-shrink-0"
                title="拍照上传"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
              />
              {/* 上传文件按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition flex-shrink-0"
                title="上传文件（支持PDF/图片/Excel/压缩包）"
              >
                <Paperclip size={15} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.zip,.rar,.7z"
                className="hidden"
                onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording ? "正在录音，点击停止按钮结束..." :
                  isTranscribing ? "正在识别语音..." :
                  step === "welcome" ? "输入企业名称，或直接问我任何问题..." :
                  step === "company-selected" ? "输入申请金额，或问我任何问题..." :
                  step === "loan-info" ? "可以开始分析了，或继续问我任何问题..." :
                  "继续对话，可问任何问题..."
                }
                rows={1}
                disabled={isAnalyzing || isSearching || isChatLoading || isRecording}
                className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                style={{ minHeight: "24px", maxHeight: "120px" }}
              />
              {/* 语音按钮 */}
              <button
                onClick={handleVoiceStart}
                disabled={isAnalyzing || isSearching || isChatLoading || isTranscribing}
                title={isRecording ? "点击停止录音" : (window.self !== window.top ? "语音输入（在嵌入式预览中可能受限，建议在新标签页打开使用）" : "点击开始语音输入")}
                className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : isTranscribing
                    ? "bg-orange-300 cursor-wait"
                    : "bg-gray-100 hover:bg-orange-50 text-gray-500 hover:text-orange-500"
                } disabled:opacity-40`}
              >
                {isTranscribing
                  ? <Loader2 size={13} className="text-white animate-spin" />
                  : isRecording
                  ? <Square size={11} className="text-white fill-white" />
                  : <Mic size={13} />}
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isAnalyzing || isSearching || isChatLoading}
                className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-orange-600 transition"
              >
                {isSearching || isAnalyzing || isChatLoading
                  ? <Loader2 size={13} className="text-white animate-spin" />
                  : <Send size={13} className="text-white" />}
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1.5 text-center">
              支持拖拽上传 · PDF · 图片 · Excel · 压缩包 · 语音输入
            </div>
          </div>
        </div>

        {/* ── Right: Indicator Panel ── */}
        <div className={`flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${mobilePage === 'analysis' ? 'flex' : 'hidden md:flex'} ${switchingRecordId ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}`}>
          {/* Tab Bar */}
          <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-0.5 flex-shrink-0 shadow-sm overflow-x-auto">
            {PANEL_TABS.filter(t => !t.isAdvanced).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {tab.icon}{tab.label}
                {tab.id === "docs" && Object.values(uploadedDocs).filter(Boolean).length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-[10px] flex items-center justify-center font-bold">
                    {Object.values(uploadedDocs).filter(Boolean).length}
                  </span>
                )}
              </button>
            ))}
            {/* 分析引擎 - 折叠高级Tab */}
            <div className="ml-auto flex-shrink-0 pl-2 border-l border-gray-100">
              <button onClick={() => setActiveTab("analysis-engine")}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium rounded-lg transition-colors ${
                  activeTab === "analysis-engine" ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}>
                <Activity size={11} />分析引擎
                <span className="text-[9px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded">高级</span>
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-3 md:p-5 pb-4 md:pb-5">
            {activeTab === "docs" && <DocChecklistPanel uploadedDocs={uploadedDocs} uploadedFiles={uploadedFiles} onFileUpload={handleFiles} onFileUploadForDoc={handleFileUploadForDoc} appData={appData} onUpdateAppData={(patch) => setAppData(prev => ({ ...prev, ...patch }))} onRemoveFile={(fileId, docId) => { setUploadedFiles(prev => prev.filter(f => f.id !== fileId)); const remaining = uploadedFiles.filter(f => f.id !== fileId && f.docId === docId); if (remaining.length === 0) setUploadedDocs(prev => ({ ...prev, [docId]: false })); }} onRetryFile={(fileId) => { const f = uploadedFilesRef.current.find(f => f.id === fileId); if (f?._file) { const retryNf = { ...f, status: 'uploading' as const }; setUploadedFiles(prev => prev.map(x => x.id === fileId ? retryNf : x)); processOneFile(f._file, retryNf); } else { console.warn('[Retry] No _file found for', fileId, 'available files:', uploadedFilesRef.current.map(f => ({id: f.id, name: f.name, has_file: !!f._file}))); } }} onChangeFileDoc={(fileId, newDocId) => {
                const doc = DOC_CHECKLIST.find(d => d.id === newDocId);
                if (!doc) return;
                const parseType = DOC_PARSE_TYPE_MAP[newDocId] || 'contract';
                // 更新文件的 docId/docName/parseType
                setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, docId: newDocId, docName: doc.name, parseType } : f));
                setUploadedDocs(prev => {
                  const updated = { ...prev };
                  const f = uploadedFiles.find(f => f.id === fileId);
                  if (f) {
                    const oldDocFiles = uploadedFiles.filter(x => x.id !== fileId && x.docId === f.docId);
                    if (oldDocFiles.length === 0) updated[f.docId] = false;
                    updated[newDocId] = true;
                  }
                  return updated;
                });
                // 改类型后立即触发重新解析（如果文件已上传）
                const f = uploadedFilesRef.current.find(f => f.id === fileId);
                if (f?._file && f.url) {
                  const reParseNf = { ...f, docId: newDocId, docName: doc.name, parseType, status: 'parsing' as const };
                  setUploadedFiles(prev => prev.map(x => x.id === fileId ? reParseNf : x));
                  processOneFile(f._file, reParseNf);
                } else if (f?._file) {
                  // 文件存在但未上传，重新上传并解析
                  const reParseNf = { ...f, docId: newDocId, docName: doc.name, parseType, status: 'uploading' as const };
                  setUploadedFiles(prev => prev.map(x => x.id === fileId ? reParseNf : x));
                  processOneFile(f._file, reParseNf);
                }
              }} />}
            {activeTab === "data-verify" && <DataVerifyPanel data={appData} onUpdateAppData={(patch) => { setAppData(prev => ({ ...prev, ...patch })); if (patch.companyName && currentDraftRecordId) { /* [Local] updateDraftCompany */ } }} hasAnalysis={!!analysisResult} onReanalyze={() => setActiveTab("comprehensive")} />}
            {activeTab === "financial-analysis" && <FinancialMultiYearPanel appData={appData} />}
            {activeTab === "bank-flow" && <BankFlowPanel appData={appData} />}
            {activeTab === "tax-analysis" && <TaxAnalysisPanel appData={appData} />}
            {activeTab === "industry-analysis" && <IndustryAnalysisPanel appData={appData} />}
            {activeTab === "cross-analysis" && <CrossAnalysisPanel appData={appData} />}
            {activeTab === "multi-source" && <MultiSourcePanel appData={appData} analysisResult={analysisResult} uploadedFiles={uploadedFiles} />}
            {activeTab === "comprehensive" && <ComprehensivePanel appData={appData} result={analysisResult} />}
            {activeTab === "credit-decision" && <CreditDecisionPanel appData={appData} result={analysisResult} />}
            {activeTab === "analysis-engine" && <AnalysisEnginePanel result={analysisResult} appData={appData} expandedGroups={expandedGroups} onToggleGroup={(g) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }))} />}
          </div>
        </div>
      </div>

      {/* ── 移动端：历史记录页 ── */}
      {mobilePage === 'history' && (
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] md:hidden">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">申请记录</h2>
              {saasAuthenticated && (
                <button
                  onClick={async () => {
                    sessionStorage.removeItem(SESSION_KEY);
                    setMessages([{ role: 'assistant', content: `您好！我是 **Marsbot 火星豹** AI 信贷风控助手 🐆\n\n请输入企业名称开始分析，我会自动搜索企业工商信息。您也可以直接上传材料（营业执照、财务报表、銀行流水等），我会自动识别并提取关键数据。\n\n支持的融资类型：**小额信贷 · 保理融资 · 供应链金融 · 抖压贷款**` }]);
                    setAppData({});
                    setAnalysisResult(null);
                    setUploadedDocs({});
                    setUploadedFiles([]);
                    setStep('welcome');
                    setActiveTab('docs');
                    setCurrentDraftRecordId(null);
                    setMobilePage('chat');
                    if (saasAuthenticated && saasUser?.id) {
                      try {
                        const existingCount = historyQuery.data?.records?.length ?? 0;
                        const draftName = `新申请${existingCount + 1}`;
                        const result = await createDraftMutation.mutateAsync({
                          companyName: draftName,
                          tenantUserId: saasUser.id,
                        });
                        if (result.recordId) setCurrentDraftRecordId(result.recordId);
                      } catch { /* 静默失败 */ }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-500"
                >
                  <span>+</span> 新建申请
                </button>
              )}
            </div>
            {!saasAuthenticated && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserCircle size={32} className="text-orange-400" />
                </div>
                <div className="text-gray-600 font-medium mb-2">登录后查看申请记录</div>
                <a href="/saas/login" className="inline-block mt-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl">登录 / 注册</a>
              </div>
            )}
            {saasAuthenticated && historyQuery.isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-orange-500" />
              </div>
            )}
            {saasAuthenticated && !historyQuery.isLoading && (!historyQuery.data?.records || historyQuery.data.records.length === 0) && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-sm">暂无申请记录</div>
                <div className="text-gray-300 text-xs mt-1">完成一次分析后显示</div>
              </div>
            )}
            {saasAuthenticated && historyQuery.data?.records?.map((app: { id: number; companyName: string | null; aiVerdict: string | null; aiScore: number | null; createdAt: Date }) => (
              <div
                key={app.id}
                onClick={async () => {
                  // 点击历史记录，切换到对话页并加载该申请
                  setMobilePage('chat');
                  setCurrentDraftRecordId((app as any).recordId || String(app.id));
                  const verdictText = app.aiVerdict === 'approved' ? '批准通过' : app.aiVerdict === 'rejected' ? '建议拒绝' : '建议降额';
                  addMsg('assistant', `📊 历史申请：**${app.companyName || '未知企业'}**\n\n| 指标 | 结果 |\n|------|------|\n| 信用评分 | **${app.aiScore || '--'}分** |\n| 审批结果 | **${verdictText}** |`);
                }}
                className={`bg-white rounded-xl p-4 mb-3 shadow-sm border cursor-pointer active:bg-orange-50 transition ${
                  currentDraftRecordId === (app as any).recordId ? 'border-orange-300 bg-orange-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900 text-sm truncate flex-1">{app.companyName || '未命名申请'}</div>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    app.aiVerdict === 'approved' ? 'bg-green-100 text-green-700' :
                    app.aiVerdict === 'rejected' ? 'bg-red-100 text-red-700' :
                    app.aiScore ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {app.aiScore ? `${app.aiScore}分` : '待评'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  {app.aiVerdict && (
                    <span className={`text-xs ${
                      app.aiVerdict === 'approved' ? 'text-green-600' :
                      app.aiVerdict === 'rejected' ? 'text-red-500' : 'text-yellow-600'
                    }`}>
                      {app.aiVerdict === 'approved' ? '✔ 批准通过' : app.aiVerdict === 'rejected' ? '✖ 建议拒绝' : '⚠ 建议降额'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 移动端：个人中心页 ── */}
      {mobilePage === 'profile' && (
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] md:hidden">
          <div className="px-4 py-4">
            {saasAuthenticated && saasUser ? (
              <>
                {/* 用户信息卡片 */}
                <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xl font-bold">{(saasUser.name || saasUser.email || 'U')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base truncate">{saasUser.name || '未设置姓名'}</div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">{saasUser.email || ''}</div>
                      <div className="text-xs text-orange-500 mt-1">剩余次数：{creditsLeft ?? '--'} 次</div>
                    </div>
                  </div>
                </div>
                {/* 功能列表 */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                  <button
                    onClick={() => setLocation('/saas/usage')}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <BarChart3 size={16} className="text-blue-500" />
                    </div>
                    <span className="flex-1 text-sm text-gray-800">用量统计</span>
                    <span className="text-gray-300 text-xs">›</span>
                  </button>
                  <button
                    onClick={() => setLocation('/saas/plans')}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Package size={16} className="text-orange-500" />
                    </div>
                    <span className="flex-1 text-sm text-gray-800">升级套餐</span>
                    <span className="text-gray-300 text-xs">›</span>
                  </button>
                  <button
                    onClick={() => setLocation('/sentiment')}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 active:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <Globe size={16} className="text-red-500" />
                    </div>
                    <span className="flex-1 text-sm text-gray-800">舆情分析</span>
                    <span className="text-gray-300 text-xs">›</span>
                  </button>
                  <button
                    onClick={() => setShowModelConfig(true)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                      <Sparkles size={16} className="text-gray-500" />
                    </div>
                    <span className="flex-1 text-sm text-gray-800">模型配置</span>
                    <span className="text-gray-300 text-xs">›</span>
                  </button>
                </div>
                {/* 退出登录 */}
                <button
                  onClick={() => { saasLogout(); window.location.href = '/saas/login'; }}
                  className="w-full py-3.5 rounded-2xl border border-red-200 text-red-500 text-sm font-medium bg-white shadow-sm"
                >
                  退出登录
                </button>
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                  <UserCircle size={40} className="text-orange-400" />
                </div>
                <div className="text-gray-700 font-bold text-lg mb-2">Marsbot 火星豹</div>
                <div className="text-gray-400 text-sm mb-6">AI 信贷决策系统</div>
                <a href="/saas/login" className="inline-block px-8 py-3 bg-orange-500 text-white font-medium rounded-2xl shadow-md">登录 / 注册</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 移动端底部 Tab 导航 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-40" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
        <button
          onClick={() => setMobilePage('chat')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition ${
            mobilePage === 'chat' ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-[10px] font-medium">对话</span>
        </button>
        <button
          onClick={() => setMobilePage('analysis')}
          className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition ${
            mobilePage === 'analysis' ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span className="text-[10px] font-medium">分析</span>
          {Object.values(uploadedDocs).filter(Boolean).length > 0 && (
            <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] flex items-center justify-center font-bold">
              {Object.values(uploadedDocs).filter(Boolean).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMobilePage('history')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition ${
            mobilePage === 'history' ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-[10px] font-medium">历史</span>
        </button>
        <button
          onClick={() => setMobilePage('profile')}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition ${
            mobilePage === 'profile' ? 'text-orange-500' : 'text-gray-400'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span className="text-[10px] font-medium">我的</span>
        </button>
      </div>

      {/* Excel 类型选择弹窗 */}
      {pendingExcelFiles.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Excel 文件类型选择</div>
                <div className="text-xs text-gray-500">无法自动识别，请手动指定</div>
              </div>
            </div>
            {pendingExcelFiles.map(({ file, tempId }) => (
              <div key={tempId} className="mb-4 last:mb-0">
                <div className="text-xs font-medium text-gray-700 mb-2 truncate">&#128196; {file.name}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { docId: "financial-report", docName: "财务报表", parseType: "financial_report", desc: "资产负债表/利润表/现金流量表" },
                    { docId: "bank-statement", docName: "銀行流水", parseType: "bank_statement", desc: "对公流水明细" },
                    { docId: "vat-return", docName: "纳税申报表", parseType: "tax_vat", desc: "增值税/所得税申报" },
                    { docId: "contract", docName: "其他资料", parseType: "contract", desc: "合同/协议/其他" },
                  ].map(opt => (
                    <button
                      key={opt.docId}
                      onClick={() => handleExcelTypeSelect(tempId, file, opt.docId, opt.docName, opt.parseType)}
                      className="flex flex-col items-start p-3 rounded-xl border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition text-left"
                    >
                      <span className="text-xs font-semibold text-gray-800">{opt.docName}</span>
                      <span className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPendingExcelFiles(prev => prev.filter(p => p.tempId !== tempId))}
                  className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1"
                >跳过此文件</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 模型配置弹窗 */}
      {showModelConfig && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setShowModelConfig(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">⚙️ 模型高级配置</h2>
                <p className="text-xs text-gray-400 mt-0.5">支持 OpenAI 兼容接口（DeepSeek、通义千问、本地 Ollama 等）</p>
              </div>
              <button onClick={() => setShowModelConfig(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">快速填充预设</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '内置模型', model: '', apiUrl: '', desc: '无需配置' },
                    { label: 'DeepSeek', model: 'deepseek-chat', apiUrl: 'https://api.deepseek.com/v1/chat/completions', desc: 'deepseek.com' },
                    { label: '通义千问', model: 'qwen-plus', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', desc: 'aliyun' },
                    { label: 'GPT-4o', model: 'gpt-4o', apiUrl: 'https://api.openai.com/v1/chat/completions', desc: 'openai.com' },
                    { label: 'Ollama 本地', model: 'llama3', apiUrl: 'http://localhost:11434/v1/chat/completions', desc: '本地部署' },
                    { label: 'LM Studio', model: 'local-model', apiUrl: 'http://localhost:1234/v1/chat/completions', desc: '本地部署' },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => setModelConfigForm(f => ({ ...f, model: preset.model, apiUrl: preset.apiUrl }))}
                      className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition"
                    >
                      {preset.label}
                      <span className="text-[9px] text-gray-400 ml-1">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API 地址 <span className="text-gray-400 font-normal">（OpenAI 兼容接口）</span>
                </label>
                <input
                  type="text"
                  value={modelConfigForm.apiUrl}
                  onChange={e => setModelConfigForm(f => ({ ...f, apiUrl: e.target.value }))}
                  placeholder="https://api.deepseek.com/v1/chat/completions"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                />
                <div className="text-[10px] text-gray-400 mt-1">本地模型示例：http://localhost:11434/v1/chat/completions（Ollama）</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">模型名称</label>
                <input
                  type="text"
                  value={modelConfigForm.model}
                  onChange={e => setModelConfigForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="deepseek-chat / gpt-4o / llama3 / qwen-plus"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API Key <span className="text-gray-400 font-normal">（本地模型可留空）</span>
                </label>
                <input
                  type="password"
                  value={modelConfigForm.apiKey}
                  onChange={e => setModelConfigForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                />
              </div>
              {!modelConfigForm.apiUrl && !modelConfigForm.model && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  ℹ️ 当前使用内置模型（Marsbot 1.7），无需配置 API Key。
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setModelConfigForm({ apiKey: '', model: '', apiUrl: '' })}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                重置为内置模型
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModelConfig(false)}
                  className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setModelConfigSaving(true);
                    try {
                      saveConfig({
                        llmApiKey: modelConfigForm.apiKey,
                        llmModel: modelConfigForm.model,
                        llmApiUrl: modelConfigForm.apiUrl,
                      });
                      setShowModelConfig(false);
                    } catch (e) {
                      console.error('保存配置失败', e);
                    } finally {
                      setModelConfigSaving(false);
                    }
                  }}
                  disabled={modelConfigSaving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {modelConfigSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Panels ───────────────────────────────────────────────────────────────

