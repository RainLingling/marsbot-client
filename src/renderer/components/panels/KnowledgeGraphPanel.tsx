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
import type { AnalysisResult, AppData, UploadedFile } from "./panelTypes";
import { GraphReader, type GraphEntity } from "@/engine/graphDb";

function KnowledgeGraphPanel({ appData, analysisResult, uploadedFiles }: { appData: AppData; analysisResult: AnalysisResult | null; uploadedFiles?: UploadedFile[] }) {
  const [selectedEntityId, setSelectedEntityId] = React.useState<string>("ApplicantEnterprise");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set([
    "LegalSubject", "FinancialStatement", "TaxRecord", "CreditReport", "LegalEvent"
  ]));
  // 舆情搜索状态
  const [sentimentResults, setSentimentResults] = React.useState<Array<{ title: string; url: string; snippet: string; source: string; date?: string }>>([]); 
  const [sentimentLlmSummary, setSentimentLlmSummary] = React.useState<{ summary: string; riskSignals: string[]; positiveSignals: string[]; dataNote: string; isRealtime: boolean } | null>(null);
  const [sentimentSearched, setSentimentSearched] = React.useState(false);
  const searchSentimentMutation = trpc.chat.searchCompanyWeb.useMutation({
    onSuccess: (data) => {
      setSentimentResults(data.results || []);
      setSentimentLlmSummary(data.llmSummary || null);
      setSentimentSearched(true);
    },
  });
  // 司法搜索状态
  const [legalResults, setLegalResults] = React.useState<Array<{ title: string; url: string; snippet: string; source: string; date?: string }>>([]); 
  const [legalLlmSummary, setLegalLlmSummary] = React.useState<{ summary: string; riskSignals: string[]; positiveSignals: string[]; dataNote: string; isRealtime: boolean } | null>(null);
  const [legalSearched, setLegalSearched] = React.useState(false);
  const searchLegalMutation = trpc.chat.searchCompanyWeb.useMutation({
    onSuccess: (data) => {
      setLegalResults(data.results || []);
      setLegalLlmSummary(data.llmSummary || null);
      setLegalSearched(true);
    },
  });

  // 如果没有企业名，默认使用"某企业"，避免知识图谱显示undefined
  const companyName = appData.companyName || '某企业';
  const applicationId = (analysisResult as (AnalysisResult & { applicationId?: number }) | null)?.applicationId;
  // ── 从 uploadedFiles 中按 parseType 提取解析数据 ──
  const getFileParsedData = (parseType: string): Record<string, unknown> | null => {
    const file = (uploadedFiles || []).find(f => f.parseType === parseType && f.status === 'done' && f.parsedData);
    return file?.parsedData || null;
  };
  const getFileParsedDataByDocId = (docId: string): Record<string, unknown> | null => {
    const file = (uploadedFiles || []).find(f => f.docId === docId && f.status === 'done' && f.parsedData);
    return file?.parsedData || null;
  };
  // 九种文档类型的解析数据
  const bizLicenseData = getFileParsedData('business_license');
  const idCardData = getFileParsedDataByDocId('id-card');
  const bankStatementData = getFileParsedData('bank_statement') || (appData.bankData as Record<string, unknown> | null);
  const vatReturnData = getFileParsedData('tax_vat') || ((appData.taxData as Record<string, unknown> | undefined)?.taxType === 'tax_vat' ? appData.taxData as Record<string, unknown> : null);
  const citReturnData = getFileParsedData('tax_income') || ((appData.taxData as Record<string, unknown> | undefined)?.taxType === 'tax_income' ? appData.taxData as Record<string, unknown> : null);
  const taxClearanceData = getFileParsedData('tax_clearance') || ((appData.taxData as Record<string, unknown> | undefined)?.taxType === 'tax_clearance' ? appData.taxData as Record<string, unknown> : null);
  const taxCreditData = getFileParsedData('tax_credit') || ((appData.taxData as Record<string, unknown> | undefined)?.taxType === 'tax_credit' ? appData.taxData as Record<string, unknown> : null);
  const invoiceData = getFileParsedData('invoice') || (appData.parsedDocuments?.find(d => d.fileType === 'invoice')?.data || null);
  const contractData = getFileParsedData('contract') || (appData.parsedDocuments?.find(d => d.fileType === 'contract')?.data || null);
  // 扩展文档类型解析数据
  const bankPermitData = getFileParsedDataByDocId('bank-permit');
  const qualificationData = getFileParsedDataByDocId('qualification');
  const businessIntroData = getFileParsedDataByDocId('business-intro');
  const revenueBreakdownData = getFileParsedDataByDocId('revenue-breakdown');
  const creditFacilityData = getFileParsedDataByDocId('credit-facility');
  const openOrdersData = getFileParsedDataByDocId('open-orders');
  const salesLedgerData = getFileParsedDataByDocId('sales-ledger');
  const mgmtResumeData = getFileParsedDataByDocId('mgmt-resume');
  const top5CustomerData = getFileParsedDataByDocId('top5-customer');
  const top5SupplierData = getFileParsedDataByDocId('top5-supplier');
  const graphQuery = trpc.loan.getApplicationGraph.useQuery(
    { applicationId: applicationId! },
    { enabled: !!applicationId }
  );
  // 本地图谱查询（优先使用本地 SQLite，不依赖云端）
  const [localGraphEntities, setLocalGraphEntities] = React.useState<GraphEntity[]>([]);
  const [localGraphStats, setLocalGraphStats] = React.useState<{ entityCount: number; relationCount: number; entityTypes: Record<string, number>; relationTypes: Record<string, number> } | null>(null);
  React.useEffect(() => {
    if (!applicationId) return;
    const appIdStr = String(applicationId);
    GraphReader.getEntities(appIdStr)
      .then(entities => setLocalGraphEntities(entities))
      .catch(e => console.warn('[KnowledgeGraphPanel] Local graph query failed:', e));
    GraphReader.getGraphStats(appIdStr)
      .then(stats => setLocalGraphStats(stats))
      .catch(e => console.warn('[KnowledgeGraphPanel] Local graph stats failed:', e));
  }, [applicationId]);

  // ── 完整44类实体本体结构 ──────────────────────
  type OntologyNode = {
    id: string; label: string; parent?: string; color: string; dataSource: string;
    properties: { name: string; description: string; unit?: string; required: boolean; derivedFrom?: string }[];
  };

  const ONTOLOGY: OntologyNode[] = [
    // 顶层抽象类
    { id: "LegalSubject", label: "法律主体", color: "#6366f1", dataSource: "D1/D3/D4",
      properties: [{ name: "name", description: "主体名称", required: true }, { name: "status", description: "主体状态", required: true }] },
    // 企业类
    { id: "Enterprise", label: "企业", parent: "LegalSubject", color: "#3b82f6", dataSource: "D1",
      properties: [
        { name: "uscc", description: "统一社会信用代码", required: true }, { name: "companyName", description: "企业名称", required: true },
        { name: "companyType", description: "企业类型", required: true }, { name: "registeredCapital", description: "注册资本", required: true, unit: "万元" },
        { name: "paidInCapital", description: "实缴资本", required: false, unit: "万元" }, { name: "establishDate", description: "成立日期", required: true },
        { name: "companyAgeYears", description: "成立年限", required: false, derivedFrom: "establishDate" },
        { name: "businessScope", description: "经营范围", required: true }, { name: "address", description: "注册地址", required: true },
        { name: "operatingStatus", description: "经营状态", required: true }, { name: "industry", description: "所属行业", required: false },
        { name: "taxCreditRating", description: "纳税信用等级", required: false }, { name: "isNewCompany", description: "是否成立不足1年", required: false },
      ]
    },
    { id: "ApplicantEnterprise", label: "申请企业", parent: "Enterprise", color: "#1d4ed8", dataSource: "D1/D2/D3/D4/D5/D6/D7",
      properties: [
        { name: "applicationId", description: "关联贷款申请ID", required: true }, { name: "creditScore", description: "综合信用评分（300-850）", required: false },
        { name: "riskLevel", description: "风险等级", required: false },
      ]
    },
    { id: "AssociatedEnterprise", label: "关联企业", parent: "Enterprise", color: "#60a5fa", dataSource: "D1/D4",
      properties: [{ name: "associationType", description: "关联类型", required: true }, { name: "shareholdingRatio", description: "持股比例", required: false, unit: "%" }]
    },
    { id: "CustomerEnterprise", label: "甲方/客户企业", parent: "Enterprise", color: "#93c5fd", dataSource: "D7",
      properties: [
        { name: "companyName", description: "甲方企业名称", required: false },
        { name: "creditCode", description: "统一社会信用代码", required: false },
        { name: "totalTransactionAmount", description: "合同金额", required: false, unit: "万元" },
        { name: "concentrationRatio", description: "应收账款集中度", required: false, unit: "%" },
        { name: "paymentTermDays", description: "历史合作账期", required: false, unit: "天" },
        { name: "paymentMethod", description: "付款方式", required: false },
        { name: "hasOverdueHistory", description: "逾期记录", required: false },
        { name: "creditRating", description: "信用资质评估", required: false },
        { name: "concentrationRisk", description: "集中度风险等级", required: false },
        { name: "dataSource", description: "数据来源", required: false },
      ]
    },
    { id: "SupplierEnterprise", label: "供应商企业", parent: "Enterprise", color: "#bfdbfe", dataSource: "D7",
      properties: [{ name: "totalTransactionAmount", description: "累计采购金额", required: false, unit: "万元" }, { name: "invoiceCount", description: "发票张数", required: false }, { name: "isKeySupplier", description: "是否核心供应商", required: false }]
    },
    // 自然人类
    { id: "NaturalPerson", label: "自然人", parent: "LegalSubject", color: "#8b5cf6", dataSource: "D1/D3",
      properties: [{ name: "name", description: "姓名", required: true }, { name: "idCard", description: "身份证号（脱敏）", required: false }, { name: "gender", description: "性别", required: false }, { name: "age", description: "年龄", required: false }, { name: "nationality", description: "国籍", required: false }]
    },
    { id: "LegalRepresentative", label: "法定代表人", parent: "NaturalPerson", color: "#a78bfa", dataSource: "D1/D3",
      properties: [{ name: "appointDate", description: "任职日期", required: false }, { name: "hasPersonalCreditReport", description: "是否提供个人征信报告", required: false }]
    },
    { id: "ActualController", label: "实际控制人", parent: "NaturalPerson", color: "#c4b5fd", dataSource: "D1/D3/D8",
      properties: [{ name: "controlRatio", description: "实际控制比例", required: false, unit: "%" }, { name: "phoneAgeMonths", description: "手机号使用年限（月）", required: false }, { name: "isRealNamePhone", description: "手机号是否实名认证", required: false }]
    },
    { id: "Shareholder", label: "股东", parent: "NaturalPerson", color: "#ddd6fe", dataSource: "D1",
      properties: [{ name: "shareholdingRatio", description: "持股比例", required: true, unit: "%" }, { name: "investmentAmount", description: "认缴出资额", required: false, unit: "万元" }, { name: "paidInAmount", description: "实缴出资额", required: false, unit: "万元" }]
    },
    // 金融资产类
    { id: "FinancialAsset", label: "金融资产", color: "#10b981", dataSource: "D3/D5",
      properties: []
    },
    { id: "BankAccount", label: "银行账户", parent: "FinancialAsset", color: "#10b981", dataSource: "D5",
      properties: [
        { name: "accountNo", description: "账号（脱敏）", required: true }, { name: "bankName", description: "开户银行", required: true },
        { name: "currency", description: "币种", required: true }, { name: "statementPeriod", description: "流水期间", required: true },
        { name: "avgMonthlyBalance", description: "月均余额", required: false, unit: "万元" }, { name: "annualOperatingIncome", description: "年度经营性收入", required: false, unit: "万元" },
        { name: "relatedPartyRatio", description: "关联方往来占比", required: false, unit: "%" }, { name: "cashFlowVolatility", description: "现金流波动系数(CV)", required: false },
      ]
    },
    { id: "LoanAccount", label: "贷款账户", parent: "FinancialAsset", color: "#34d399", dataSource: "D3",
      properties: [{ name: "lender", description: "贷款机构", required: true }, { name: "loanType", description: "贷款类型", required: true }, { name: "balance", description: "贷款余额", required: true, unit: "万元" }, { name: "limit", description: "授信额度", required: false, unit: "万元" }, { name: "status", description: "账户状态", required: true }, { name: "overdueMonths", description: "逾期月数", required: false }]
    },
    // 财务报表类
    { id: "FinancialStatement", label: "财务报表", color: "#f59e0b", dataSource: "D6",
      properties: [{ name: "reportPeriod", description: "报告期间", required: true }, { name: "auditStatus", description: "审计状态", required: true }, { name: "auditor", description: "审计机构", required: false }]
    },
    { id: "BalanceSheet", label: "资产负债表", parent: "FinancialStatement", color: "#fbbf24", dataSource: "D6",
      properties: [
        { name: "cashAndEquivalents", description: "货币资金", required: true, unit: "万元" }, { name: "accountsReceivableGross", description: "应收账款账面余额", required: true, unit: "万元" },
        { name: "badDebtProvision", description: "坏账准备", required: true, unit: "万元" }, { name: "accountsReceivableNet", description: "应收账款净额", required: true, unit: "万元" },
        { name: "notesReceivable", description: "应收票据", required: false, unit: "万元" }, { name: "advancePayments", description: "预付款项", required: false, unit: "万元" },
        { name: "otherReceivables", description: "其他应收款（关联方占款预警）", required: true, unit: "万元" }, { name: "inventory", description: "存货", required: true, unit: "万元" },
        { name: "totalCurrentAssets", description: "流动资产合计", required: true, unit: "万元" }, { name: "longTermInvestments", description: "长期股权投资", required: false, unit: "万元" },
        { name: "fixedAssetsNet", description: "固定资产净值", required: true, unit: "万元" }, { name: "intangibleAssets", description: "无形资产", required: false, unit: "万元" },
        { name: "totalNonCurrentAssets", description: "非流动资产合计", required: true, unit: "万元" }, { name: "totalAssets", description: "资产总计", required: true, unit: "万元" },
        { name: "shortTermLoans", description: "短期借款", required: true, unit: "万元" }, { name: "accountsPayable", description: "应付账款", required: true, unit: "万元" },
        { name: "taxesPayable", description: "应交税费", required: false, unit: "万元" }, { name: "otherPayables", description: "其他应付款", required: false, unit: "万元" },
        { name: "totalCurrentLiabilities", description: "流动负债合计", required: true, unit: "万元" }, { name: "longTermLoans", description: "长期借款", required: false, unit: "万元" },
        { name: "totalNonCurrentLiabilities", description: "非流动负债合计", required: false, unit: "万元" }, { name: "totalLiabilities", description: "负债合计", required: true, unit: "万元" },
        { name: "paidInCapital", description: "实收资本", required: true, unit: "万元" }, { name: "retainedEarnings", description: "未分配利润", required: true, unit: "万元" },
        { name: "totalEquity", description: "所有者权益合计", required: true, unit: "万元" },
        { name: "debtToAssetRatio", description: "资产负债率（>85%触发硬性准入）", required: false, unit: "%", derivedFrom: "总负债/总资产" },
        { name: "currentRatio", description: "流动比率（<1预警）", required: false, derivedFrom: "流动资产/流动负债" },
        { name: "quickRatio", description: "速动比率", required: false, derivedFrom: "(流动资产-存货)/流动负债" },
        { name: "otherReceivablesRatio", description: "其他应收款/总资产（>15%预警）", required: false, unit: "%", derivedFrom: "其他应收款/总资产" },
        { name: "netAssets", description: "净资产（所有者权益）", required: false, unit: "万元", derivedFrom: "总资产-总负债" },
        { name: "interestBearingDebt", description: "有息负债（短期+长期借款）", required: false, unit: "万元", derivedFrom: "短期借款+长期借款" },
        { name: "interestBearingDebtRatio", description: "有息负债/总资产", required: false, unit: "%", derivedFrom: "有息负债/总资产" },
      ]
    },
    { id: "IncomeStatement", label: "利润表", parent: "FinancialStatement", color: "#f59e0b", dataSource: "D6",
      properties: [
        { name: "revenue", description: "营业收入", required: true, unit: "万元" }, { name: "costOfRevenue", description: "营业成本", required: true, unit: "万元" },
        { name: "grossProfit", description: "毛利润", required: true, unit: "万元" }, { name: "grossMargin", description: "毛利率", required: true, unit: "%" },
        { name: "sellingExpenses", description: "销售费用", required: false, unit: "万元" }, { name: "adminExpenses", description: "管理费用", required: false, unit: "万元" },
        { name: "rdExpenses", description: "研发费用", required: false, unit: "万元" }, { name: "financialExpenses", description: "财务费用", required: false, unit: "万元" },
        { name: "interestExpense", description: "利息支出", required: false, unit: "万元" }, { name: "operatingProfit", description: "营业利润", required: true, unit: "万元" },
        { name: "netProfit", description: "净利润", required: true, unit: "万元" }, { name: "ebitda", description: "EBITDA", required: false, unit: "万元", derivedFrom: "营业利润+折旧+摊销" },
        { name: "netProfitMargin", description: "净利率", required: false, unit: "%", derivedFrom: "净利润/营业收入" },
        { name: "roe", description: "净资产收益率ROE", required: false, unit: "%", derivedFrom: "净利润/所有者权益" },
        { name: "roa", description: "总资产收益率ROA", required: false, unit: "%", derivedFrom: "净利润/总资产" },
      ]
    },
    { id: "CashFlowStatement", label: "现金流量表", parent: "FinancialStatement", color: "#d97706", dataSource: "D6",
      properties: [
        { name: "netOperatingCashFlow", description: "经营活动净现金流", required: true, unit: "万元" }, { name: "operatingCashInflow", description: "经营活动现金流入", required: true, unit: "万元" },
        { name: "operatingCashOutflow", description: "经营活动现金流出", required: true, unit: "万元" }, { name: "netInvestingCashFlow", description: "投资活动净现金流", required: false, unit: "万元" },
        { name: "netFinancingCashFlow", description: "筹资活动净现金流", required: false, unit: "万元" }, { name: "endingCashBalance", description: "期末现金余额", required: true, unit: "万元" },
        { name: "cashFlowToNetProfitRatio", description: "经营现金流/净利润（<0.8预警）", required: false, derivedFrom: "经营现金流/净利润" },
        { name: "balanceSheetCrossCheck", description: "与资产负债表货币资金交叉验证", required: false, derivedFrom: "交叉验证" },
      ]
    },
    { id: "FinancialIndicatorSet", label: "财务指标集", color: "#92400e", dataSource: "D6（衍生）",
      properties: [
        { name: "reportPeriod", description: "指标计算期间", required: true },
        { name: "debtToAssetRatio", description: "资产负债率（>85%触发硬性准入）", required: true, unit: "%", derivedFrom: "总负债/总资产" },
        { name: "currentRatio", description: "流动比率（<1预警）", required: true, derivedFrom: "流动资产/流动负债" },
        { name: "quickRatio", description: "速动比率", required: true, derivedFrom: "(流动资产-存货)/流动负债" },
        { name: "interestCoverageRatio", description: "利息保障倍数（<1.5预警）", required: false, derivedFrom: "EBIT/利息支出" },
        { name: "roe", description: "净资产收益率ROE", required: true, unit: "%" },
        { name: "roa", description: "总资产收益率ROA", required: true, unit: "%" },
        { name: "grossMargin", description: "毛利率", required: true, unit: "%" },
        { name: "netProfitMargin", description: "净利率", required: true, unit: "%" },
        { name: "ebitda", description: "EBITDA", required: false, unit: "万元" },
        { name: "arTurnoverDays", description: "应收账款周转天数", required: true, derivedFrom: "应收账款净额×365/营业收入" },
        { name: "inventoryTurnoverDays", description: "存货周转天数", required: false, derivedFrom: "存货×365/营业成本" },
        { name: "cashConversionCycle", description: "现金转换周期（天）", required: false, derivedFrom: "应收+存货-应付周转天数" },
        { name: "cashFlowToNetProfitRatio", description: "经营现金流/净利润（<0.8预警）", required: true },
        { name: "otherReceivablesRatio", description: "其他应收款/总资产（>15%预警）", required: true, unit: "%" },
        { name: "revenueThreeSrcDeviation", description: "三源收入最大偏差率（>20%预警）", required: false, unit: "%" },
        { name: "grossMarginStability", description: "毛利率稳定性（年度波动>15%预警）", required: false, unit: "%" },
      ]
    },
    // 税务记录类
    { id: "TaxRecord", label: "税务记录", color: "#ef4444", dataSource: "D2",
      properties: [{ name: "period", description: "申报期间", required: true }, { name: "taxType", description: "税种", required: true }, { name: "actualTaxPaid", description: "实际缴纳税额", required: true, unit: "万元" }]
    },
    { id: "VatReturn", label: "增值税申报", parent: "TaxRecord", color: "#f87171", dataSource: "D2",
      properties: [{ name: "salesRevenue", description: "销售收入（含税）", required: true, unit: "万元" }, { name: "taxableRevenue", description: "应税收入（不含税）", required: true, unit: "万元" }, { name: "outputTax", description: "销项税额", required: true, unit: "万元" }, { name: "inputTax", description: "进项税额", required: true, unit: "万元" }, { name: "taxPayable", description: "应纳税额", required: true, unit: "万元" }, { name: "taxBurdenRate", description: "税负率", required: false, unit: "%", derivedFrom: "实缴税/含税收入" }]
    },
    { id: "CitReturn", label: "企业所得税申报", parent: "TaxRecord", color: "#fca5a5", dataSource: "D2",
      properties: [{ name: "year", description: "申报年度", required: true }, { name: "totalRevenue", description: "营业总收入", required: true, unit: "万元" }, { name: "taxableIncome", description: "应纳税所得额", required: true, unit: "万元" }, { name: "taxRate", description: "适用税率", required: true, unit: "%" }, { name: "revenueGrowthRate", description: "收入增长率（同比）", required: false, unit: "%" }]
    },
    { id: "TaxClearanceCert", label: "完税证明", parent: "TaxRecord", color: "#fecaca", dataSource: "D2",
      properties: [{ name: "certNo", description: "证明编号", required: true }, { name: "issueDate", description: "出具日期", required: true }, { name: "amount", description: "完税金额", required: true, unit: "万元" }]
    },
    // 征信报告类
    { id: "CreditReport", label: "征信报告", color: "#06b6d4", dataSource: "D3",
      properties: [{ name: "reportDate", description: "报告日期", required: true }, { name: "reportType", description: "报告类型", required: true }]
    },
    { id: "EnterpriseCreditReport", label: "企业征信报告", parent: "CreditReport", color: "#22d3ee", dataSource: "D3",
      properties: [{ name: "totalLoanBalance", description: "贷款余额合计", required: true, unit: "万元" }, { name: "totalLoanLimit", description: "授信额度合计", required: true, unit: "万元" }, { name: "loanAccountCount", description: "贷款账户数", required: true }, { name: "guaranteeBalance", description: "担保余额", required: false, unit: "万元" }, { name: "overdueCount", description: "逾期次数（近2年）", required: true }, { name: "overdueAmount", description: "最大逾期金额", required: false, unit: "万元" }, { name: "badDebtFlag", description: "呆账标志", required: true }, { name: "guaranteeLeverageRatio", description: "担保杠杆率（>3倍预警）", required: false, derivedFrom: "担保余额/净资产" }]
    },
    { id: "PersonalCreditReport", label: "个人征信报告", parent: "CreditReport", color: "#67e8f9", dataSource: "D3",
      properties: [{ name: "totalLoanBalance", description: "贷款余额合计", required: true, unit: "万元" }, { name: "creditCardBalance", description: "信用卡余额", required: false, unit: "万元" }, { name: "overdueCount", description: "逾期次数", required: true }, { name: "queryCount6M", description: "近6个月查询次数", required: true }, { name: "queryCount3M", description: "近3个月查询次数（>3次多头借贷预警）", required: true }, { name: "multiLoanFlag", description: "多头借贷标志", required: false }]
    },
    // 发票类
    { id: "Invoice", label: "发票", color: "#84cc16", dataSource: "D7",
      properties: [{ name: "invoiceNo", description: "发票号码", required: true }, { name: "invoiceType", description: "发票类型", required: true }, { name: "invoiceDate", description: "开票日期", required: true }, { name: "goodsOrService", description: "货物/服务描述", required: true }, { name: "amountExcludingTax", description: "不含税金额", required: true, unit: "万元" }, { name: "taxRate", description: "税率", required: true, unit: "%" }, { name: "totalAmount", description: "价税合计", required: true, unit: "万元" }, { name: "verificationStatus", description: "验真状态", required: false }, { name: "matchedBankFlowDate", description: "匹配到的银行流水日期", required: false }]
    },
    // 法律事件类
    { id: "LegalEvent", label: "法律事件", color: "#dc2626", dataSource: "D4",
      properties: [{ name: "caseNo", description: "案件编号", required: true }, { name: "court", description: "法院/执行机关", required: false }, { name: "amount", description: "涉案金额", required: false, unit: "万元" }, { name: "status", description: "案件状态", required: true }, { name: "eventDate", description: "事件日期", required: true }]
    },
    { id: "Litigation", label: "诉讼记录", parent: "LegalEvent", color: "#ef4444", dataSource: "D4",
      properties: [{ name: "caseType", description: "诉讼角色", required: true }, { name: "filingDate", description: "立案日期", required: true }]
    },
    { id: "Enforcement", label: "被执行记录", parent: "LegalEvent", color: "#b91c1c", dataSource: "D4",
      properties: [{ name: "executeDate", description: "执行日期", required: true }, { name: "executionStatus", description: "执行状态", required: true }]
    },
    { id: "DishonestExecution", label: "失信被执行", parent: "LegalEvent", color: "#7f1d1d", dataSource: "D4",
      properties: [{ name: "registerDate", description: "列入日期", required: true }, { name: "reason", description: "失信原因", required: true }, { name: "isActive", description: "是否仍在名单中（true=触发一票否决）", required: true }]
    },
    { id: "AdministrativePenalty", label: "行政处罚", parent: "LegalEvent", color: "#fca5a5", dataSource: "D4",
      properties: [{ name: "penaltyType", description: "处罚类型", required: true }, { name: "authority", description: "处罚机关", required: true }, { name: "reason", description: "处罚原因", required: true }, { name: "penaltyDate", description: "处罚日期", required: true }]
    },
    // 担保与抵押类
    { id: "GuaranteeRecord", label: "担保记录", color: "#f97316", dataSource: "D3/D4",
      properties: [{ name: "guaranteeType", description: "担保类型", required: true }, { name: "guaranteeAmount", description: "担保金额", required: true, unit: "万元" }, { name: "guaranteeBalance", description: "担保余额", required: true, unit: "万元" }, { name: "startDate", description: "担保起始日期", required: false }, { name: "endDate", description: "担保到期日期", required: false }, { name: "status", description: "担保状态", required: true }]
    },
    { id: "MortgageRecord", label: "抵押记录", parent: "GuaranteeRecord", color: "#fb923c", dataSource: "D4",
      properties: [{ name: "mortgageType", description: "抵押物类型（房产/土地/设备）", required: true }, { name: "mortgageAmount", description: "抵押金额", required: true, unit: "万元" }, { name: "mortgagee", description: "抵押权人（贷款机构）", required: true }, { name: "registerDate", description: "登记日期", required: true }, { name: "status", description: "抵押状态", required: true }]
    },
    // 业务经营类
    { id: "RevenueBreakdown", label: "营业收入组成", color: "#0d9488", dataSource: "D7",
      properties: [
        { name: "totalRevenue", description: "年度总营收（万元）", required: true, unit: "万元" },
        { name: "top1CustomerShare", description: "第一大客户占比", required: false, unit: "%" },
        { name: "top3CustomerShare", description: "前三大客户合计占比", required: false, unit: "%" },
        { name: "hhiIndex", description: "客户集中度HHI指数", required: false },
        { name: "revenueStabilityScore", description: "收入稳定性评分（0-100）", required: false },
        { name: "invoiceMatchRate", description: "收入与发票匹配率", required: false, unit: "%" },
        { name: "bankFlowMatchRate", description: "收入与流水匹配率", required: false, unit: "%" },
      ]
    },
    { id: "CreditFacility", label: "他行授信", color: "#0891b2", dataSource: "D3/D5",
      properties: [
        { name: "totalCreditLine", description: "总授信额度（万元）", required: true, unit: "万元" },
        { name: "usedCreditLine", description: "已用额度（万元）", required: false, unit: "万元" },
        { name: "creditUtilizationRate", description: "授信使用率", required: false, unit: "%" },
        { name: "lenderCount", description: "授信银行家数", required: false },
        { name: "multiLoanRisk", description: "多头借贷风险（>5家警告）", required: false },
        { name: "debtToRevenueRatio", description: "负债收入比", required: false, unit: "%" },
        { name: "annualRepaymentPressure", description: "年化还款压力（万元）", required: false, unit: "万元" },
        { name: "creditVsReportedDiff", description: "征信负债与申报差异", required: false, unit: "%" },
      ]
    },
    { id: "OpenOrders", label: "在手订单", color: "#7c3aed", dataSource: "D7",
      properties: [
        { name: "totalOrderAmount", description: "在手订单总额（万元）", required: true, unit: "万元" },
        { name: "confirmedOrderRatio", description: "已确认订单占比", required: false, unit: "%" },
        { name: "maxSingleOrderRatio", description: "最大单笔订单集中度", required: false, unit: "%" },
        { name: "orderToLoanCoverageRatio", description: "订单与贷款额覆盖比", required: false },
        { name: "expectedRepaymentDate", description: "预计最早回款日期", required: false },
        { name: "repaymentSourceSufficient", description: "还款来源是否充分（≥1.5倍）", required: false },
      ]
    },
    { id: "SalesLedger", label: "销售台账", color: "#6d28d9", dataSource: "D7",
      properties: [
        { name: "annualSalesAmount", description: "年度销售总额（万元）", required: true, unit: "万元" },
        { name: "monthlyRevenueVolatility", description: "月度收入波动率", required: false, unit: "%" },
        { name: "accountsReceivableRecoveryRate", description: "应收账款回收率", required: false, unit: "%" },
        { name: "top5CustomerConcentration", description: "前5大客户集中度", required: false, unit: "%" },
        { name: "newCustomerRatio", description: "新客户占比", required: false, unit: "%" },
        { name: "ledgerVsFinancialMatchRate", description: "台账与财报匹配率", required: false, unit: "%" },
      ]
    },
    { id: "BankPermit", label: "开户许可证", color: "#0369a1", dataSource: "D5",
      properties: [
        { name: "accountName", description: "开户名称", required: true },
        { name: "accountNumber", description: "银行账号", required: true },
        { name: "bankName", description: "开户行名称", required: true },
        { name: "permitNo", description: "许可证编号", required: false },
        { name: "issueDate", description: "核准日期", required: false },
        { name: "isConsistentWithBizLicense", description: "与营业执照信息是否一致", required: false },
      ]
    },
    { id: "Qualification", label: "资质证明", color: "#15803d", dataSource: "D1",
      properties: [
        { name: "certName", description: "资质证书名称", required: true },
        { name: "certNo", description: "证书编号", required: false },
        { name: "issuingAuthority", description: "发证机关", required: false },
        { name: "validFrom", description: "有效期起", required: false },
        { name: "validTo", description: "有效期止", required: false },
        { name: "certCount", description: "证书数量", required: false },
        { name: "industryCategory", description: "所属行业类别", required: false },
      ]
    },
    { id: "BusinessIntro", label: "公司介绍", color: "#92400e", dataSource: "D1",
      properties: [
        { name: "industryRiskLevel", description: "行业风险系数（1-5级）", required: false },
        { name: "businessCycleStage", description: "行业景气度（上升/平稳/下行）", required: false },
        { name: "collectionCycleDays", description: "收款周期预估（天）", required: false, unit: "天" },
        { name: "top1CustomerShare", description: "最大客户占比", required: false, unit: "%" },
        { name: "marketPosition", description: "市场地位（领先/跟随/边缘）", required: false },
        { name: "policyRiskRating", description: "政策风险评级", required: false },
        { name: "businessModel", description: "商业模式描述", required: false },
      ]
    },
    { id: "MgmtResume", label: "高管简历", color: "#7f1d1d", dataSource: "D1/D3",
      properties: [
        { name: "name", description: "姓名", required: true },
        { name: "position", description: "职务", required: true },
        { name: "yearsOfExperience", description: "从业年限", required: false, unit: "年" },
        { name: "industryBackground", description: "行业背景", required: false },
        { name: "creditRecord", description: "个人征信记录", required: false },
        { name: "hasBlacklist", description: "是否在失信名单", required: false },
        { name: "previousCompanies", description: "历史任职企业", required: false },
      ]
    },
    // 申请与合同类
    { id: "LoanApplication", label: "贷款申请", color: "#7c3aed", dataSource: "系统",
      properties: [{ name: "applicationId", description: "申请编号", required: true }, { name: "applyAmount", description: "申请金额", required: true, unit: "万元" }, { name: "loanType", description: "贷款类型", required: true }, { name: "loanPeriodMonths", description: "贷款期限（月）", required: true }, { name: "purpose", description: "贷款用途", required: true }, { name: "status", description: "申请状态", required: true }, { name: "submittedAt", description: "提交时间", required: true }]
    },
    { id: "RiskReport", label: "风控报告", color: "#6d28d9", dataSource: "L3算法层",
      properties: [{ name: "reportId", description: "报告编号", required: true }, { name: "creditScore", description: "综合信用评分（300-850）", required: true }, { name: "riskLevel", description: "风险等级", required: true }, { name: "aiVerdict", description: "AI决策建议", required: true }, { name: "recommendedAmount", description: "建议授信额度", required: false, unit: "万元" }, { name: "annualRate", description: "建议年化利率区间", required: false }, { name: "hardRulesPassed", description: "硬性准入规则是否全部通过", required: true }, { name: "subjectQualityScore", description: "主体资质评分（0-100）", required: false }, { name: "financialHealthScore", description: "财务状况评分（0-100）", required: false }, { name: "operationStabilityScore", description: "经营稳定性评分（0-100）", required: false }, { name: "gnnRiskScore", description: "GNN关联风险评分（0-100）", required: false }, { name: "generatedAt", description: "报告生成时间", required: true }]
    },
    { id: "LoanContract", label: "贷款合同", color: "#5b21b6", dataSource: "系统",
      properties: [{ name: "contractNo", description: "合同编号", required: true }, { name: "approvedAmount", description: "批准金额", required: true, unit: "万元" }, { name: "annualRate", description: "年化利率", required: true, unit: "%" }, { name: "loanPeriodMonths", description: "贷款期限（月）", required: true }, { name: "disbursementDate", description: "放款日期", required: false }, { name: "maturityDate", description: "到期日期", required: false }, { name: "repaymentMethod", description: "还款方式", required: true }]
    },
    // 贷后监控类
    { id: "MonitorSnapshot", label: "贷后监控快照", color: "#0891b2", dataSource: "D9",
      properties: [{ name: "snapshotDate", description: "快照日期", required: true }, { name: "overallAlertLevel", description: "综合预警等级", required: true }, { name: "alertCount", description: "预警事件数量", required: true }, { name: "bizChangeCount", description: "工商变更次数（近30天）", required: false }, { name: "newJudicialCount", description: "新增司法事件数", required: false }]
    },
    { id: "AlertEvent", label: "预警事件", color: "#0e7490", dataSource: "D9",
      properties: [{ name: "alertType", description: "预警类型", required: true }, { name: "alertLevel", description: "预警级别", required: true }, { name: "alertDate", description: "预警日期", required: true }, { name: "description", description: "预警描述", required: true }, { name: "isResolved", description: "是否已处置", required: true }]
    },
    { id: "SentimentEvent", label: "舆情事件", color: "#164e63", dataSource: "D9",
      properties: [{ name: "title", description: "新闻标题", required: true }, { name: "source", description: "来源媒体", required: true }, { name: "publishDate", description: "发布日期", required: true }, { name: "sentiment", description: "情感倾向", required: true }, { name: "riskKeywords", description: "风险关键词", required: false }]
    },
    // 设备与共享节点
    { id: "DeviceRecord", label: "设备记录", color: "#475569", dataSource: "D8",
      properties: [{ name: "deviceId", description: "设备指纹ID", required: true }, { name: "deviceType", description: "设备类型", required: false }, { name: "isVpn", description: "是否使用VPN", required: false }, { name: "isProxy", description: "是否使用代理", required: false }, { name: "deviceRiskScore", description: "设备风险评分（0-100）", required: false }, { name: "sharedDeviceCount", description: "该设备关联申请数（>3预警）", required: false }]
    },
    { id: "PhoneNode", label: "电话号码节点", color: "#64748b", dataSource: "D1/D8",
      properties: [{ name: "phoneNo", description: "电话号码（脱敏）", required: true }, { name: "linkedEntityCount", description: "关联实体数量（>3预警）", required: false }, { name: "isRealName", description: "是否实名认证", required: false }]
    },
    { id: "AddressNode", label: "地址节点", color: "#94a3b8", dataSource: "D1",
      properties: [{ name: "address", description: "标准化地址", required: true }, { name: "linkedEntityCount", description: "关联企业数量（>5预警）", required: false }, { name: "isVirtualAddress", description: "是否虚拟注册地址", required: false }]
    },
    // ── 新增实体类（FRO v4.0 扩展）──
    { id: "AuditReport", label: "审计报告", parent: "FinancialStatement", color: "#b45309", dataSource: "D6",
      properties: [
        { name: "reportYear", description: "审计年度", required: true },
        { name: "auditFirm", description: "审计事务所", required: true },
        { name: "auditOpinion", description: "审计意见类型（标准无保留/保留/否定/无法表示）", required: true },
        { name: "totalAssets", description: "总资产", required: false, unit: "万元" },
        { name: "totalLiabilities", description: "总负债", required: false, unit: "万元" },
        { name: "revenue", description: "营业收入", required: false, unit: "万元" },
        { name: "netProfit", description: "净利润", required: false, unit: "万元" },
        { name: "keyFindings", description: "关键发现与风险提示", required: false },
      ]
    },
    { id: "TopCustomer", label: "前五大客户", parent: "CustomerEnterprise", color: "#0ea5e9", dataSource: "D6/D7",
      properties: [
        { name: "customerName", description: "客户名称", required: true },
        { name: "salesAmount", description: "销售金额", required: true, unit: "万元" },
        { name: "salesRatio", description: "占营业收入比例", required: true, unit: "%" },
        { name: "cooperationYears", description: "合作年限", required: false },
        { name: "receivableDays", description: "平均回款天数", required: false },
        { name: "isRelatedParty", description: "是否关联方", required: false },
      ]
    },
    { id: "TopSupplier", label: "前五大供应商", parent: "SupplierEnterprise", color: "#14b8a6", dataSource: "D6/D7",
      properties: [
        { name: "supplierName", description: "供应商名称", required: true },
        { name: "purchaseAmount", description: "采购金额", required: true, unit: "万元" },
        { name: "purchaseRatio", description: "占采购总额比例", required: true, unit: "%" },
        { name: "cooperationYears", description: "合作年限", required: false },
        { name: "paymentDays", description: "平均付款天数", required: false },
        { name: "isRelatedParty", description: "是否关联方", required: false },
      ]
    },
    { id: "BankTransactionDetail", label: "银行流水明细", parent: "BankAccount", color: "#0d9488", dataSource: "D5",
      properties: [
        { name: "transactionDate", description: "交易日期", required: true },
        { name: "amount", description: "交易金额", required: true, unit: "元" },
        { name: "direction", description: "收入/支出", required: true },
        { name: "counterparty", description: "对手方", required: true },
        { name: "summary", description: "摘要", required: false },
        { name: "balance", description: "余额", required: false, unit: "元" },
      ]
    },
    { id: "MonthlyCashFlowSummary", label: "月度现金流汇总", parent: "BankAccount", color: "#0f766e", dataSource: "D5",
      properties: [
        { name: "month", description: "月份", required: true },
        { name: "totalInflow", description: "总流入", required: true, unit: "万元" },
        { name: "totalOutflow", description: "总流出", required: true, unit: "万元" },
        { name: "netFlow", description: "净流量", required: true, unit: "万元" },
        { name: "endBalance", description: "月末余额", required: true, unit: "万元" },
        { name: "transactionCount", description: "交易笔数", required: false },
        { name: "largeTransactionCount", description: "大额交易笔数（≥100万）", required: false },
      ]
    },
    { id: "KeyExecutive", label: "关键高管", parent: "NaturalPerson", color: "#7c3aed", dataSource: "D1",
      properties: [
        { name: "name", description: "姓名", required: true },
        { name: "position", description: "职务", required: true },
        { name: "education", description: "学历", required: false },
        { name: "workExperience", description: "工作经历", required: false },
        { name: "industryYears", description: "行业从业年限", required: false },
        { name: "otherPositions", description: "兼任其他职务", required: false },
      ]
    },
    { id: "NineDimensionAnalysis", label: "九维度分析", parent: "LoanApplication", color: "#dc2626", dataSource: "D1-D9",
      properties: [
        { name: "d1_financialScore", description: "D1-财务报表静态分析得分", required: true, unit: "分" },
        { name: "d2_bankFlowScore", description: "D2-银行流水动态穿透得分", required: true, unit: "分" },
        { name: "d3_taxScore", description: "D3-税务申报交叉验证得分", required: true, unit: "分" },
        { name: "d4_creditFacilityScore", description: "D4-他行授信与隐性负债得分", required: true, unit: "分" },
        { name: "d5_businessScore", description: "D5-业务板块与收入构成得分", required: true, unit: "分" },
        { name: "d6_creditReportScore", description: "D6-征信报告与司法涉诉得分", required: true, unit: "分" },
        { name: "d7_customerScore", description: "D7-前五大甲方穿透得分", required: true, unit: "分" },
        { name: "d8_supplierScore", description: "D8-前五大乙方穿透得分", required: true, unit: "分" },
        { name: "d9_invoiceScore", description: "D9-发票两流合一验证得分", required: true, unit: "分" },
        { name: "compositeScore", description: "综合加权得分", required: true, unit: "分" },
        { name: "riskLevel", description: "风险等级（低/中/高/极高）", required: true },
        { name: "creditSuggestion", description: "授信建议", required: false },
      ]
    },
  ];

  // ── 构建真实数据映射 ──────────────────────────
  const fs = appData.financialStatements;
  const fsByYear = appData.financialStatementsByYear || {};
  const latestYear = Object.keys(fsByYear).sort().reverse()[0];
  const latestFs = latestYear ? fsByYear[latestYear] : fs;
  // 精确报告期显示标签（如 "2026-02（月报）"、"2025-Q3（季报）"、"2025（年报）"）
  const latestPeriodLabel = (() => {
    if (!latestYear || !fsByYear[latestYear]) return latestYear || '—';
    const { reportPeriod, periodType } = fsByYear[latestYear];
    if (!reportPeriod || reportPeriod === latestYear) return `${latestYear}（年报）`;
    const typeLabel = periodType === 'monthly' ? '月报' : periodType === 'quarterly' ? '季报' : periodType === 'interim' ? '半年报' : '年报';
    return `${reportPeriod}（${typeLabel}）`;
  })();
  const sc = analysisResult?.layer3?.scorecard;
  const lc = analysisResult?.layer3?.limitCalculation;
  const dbNodes = graphQuery.data?.nodes || [];

  const REAL_DATA_MAP: Record<string, Record<string, unknown>> = {
    ApplicantEnterprise: {
      applicationId: applicationId || "—",
      creditScore: sc?.score,
      riskLevel: sc?.creditGrade,
      uscc: (bizLicenseData?.creditCode as string) || appData.creditCode,
      companyName: (bizLicenseData?.company as string) || appData.companyName,
      legalPerson: (bizLicenseData?.legalPerson as string) || appData.legalPerson,
      registeredCapital: (bizLicenseData?.registeredCapital as string) || appData.registeredCapital,
      establishDate: (bizLicenseData?.establishDate as string) || appData.establishDate,
      address: (bizLicenseData?.address as string) || appData.address,
      businessScope: bizLicenseData?.businessScope as string || '—',
      industry: appData.industry,
      // 数据来源标记
      dataSource: bizLicenseData ? '营业执照PDF解析' :
                  appData.companyDataSource === 'business_license' ? '营业执照PDF解析' :
                  appData.companyDataSource === 'ai_generated' ? 'AI生成（模拟）' : '用户手动输入',
    },
    BalanceSheet: (() => {
      const bs = latestFs?.balanceSheet as Record<string, unknown> || {};
      // 中英文字段名映射（兼容 AI 解析的中文 key 和英文 key）
      const pick = (...keys: string[]): unknown => {
        for (const k of keys) { if (bs[k] != null && bs[k] !== '' && bs[k] !== '0') return bs[k]; }
        return undefined;
      };
      // 计算衍生指标
      const toN2 = (v: unknown): number | null => { if (v == null) return null; const n = parseFloat(String(v).replace(/,/g,'')); return isNaN(n) ? null : n; };
      const totalAssetsN = toN2(appData.totalAssets ?? pick('totalAssets','资产总计','资产合计'));
      const totalLiabN = toN2(appData.totalLiabilities ?? pick('totalLiabilities','负债合计','负债总计'));
      const totalCurAssetsN = toN2(pick('currentAssets','totalCurrentAssets','流动资产合计','流动资产总计','流动资产合计本期'));
      const totalCurLiabN = toN2(pick('currentLiabilities','totalCurrentLiabilities','流动负债合计','流动负债总计','流动负债合计本期'));
      const inventoryN = toN2(pick('inventory','存货','存货净额'));
      const otherRecN = toN2(pick('otherReceivables','其他应收款','其他应收款净额'));
      const debtRatio = (totalAssetsN && totalLiabN && totalAssetsN !== 0) ? parseFloat((totalLiabN / totalAssetsN * 100).toFixed(2)) : null;
      const currentRatio = (totalCurAssetsN && totalCurLiabN && totalCurLiabN !== 0) ? parseFloat((totalCurAssetsN / totalCurLiabN).toFixed(2)) : null;
      const quickRatio = (totalCurAssetsN != null && inventoryN != null && totalCurLiabN && totalCurLiabN !== 0) ? parseFloat(((totalCurAssetsN - inventoryN) / totalCurLiabN).toFixed(2)) : null;
      const otherRecRatio = (otherRecN != null && totalAssetsN && totalAssetsN !== 0) ? parseFloat((otherRecN / totalAssetsN * 100).toFixed(2)) : null;
      // 净资产 = 总资产 - 总负债（也等于所有者权益）
      const netAssetsN = (totalAssetsN != null && totalLiabN != null) ? parseFloat((totalAssetsN - totalLiabN).toFixed(2)) : null;
      // 有息负债 = 短期借款 + 长期借款
      const shortLoansN = toN2(pick('shortTermLoans','短期借款'));
      const longLoansN = toN2(pick('longTermLoans','长期借款'));
      const interestBearingDebtN = (shortLoansN != null || longLoansN != null) ? parseFloat(((shortLoansN || 0) + (longLoansN || 0)).toFixed(2)) : null;
      const interestBearingDebtRatioN = (interestBearingDebtN != null && totalAssetsN && totalAssetsN !== 0) ? parseFloat((interestBearingDebtN / totalAssetsN * 100).toFixed(2)) : null;
      return {
        ...bs,
        // 字段名映射：优先用解析器实际输出的英文 key，其次用中文 key
        // 货币资金：parser 输出 key = monetaryFunds
        cashAndEquivalents: pick('monetaryFunds','cashAndEquivalents','货币资金','现金及现金等价物'),
        // 应收账款：parser 输出 key = accountsReceivable（未区分账面余额和净额）
        accountsReceivableGross: pick('accountsReceivable','accountsReceivableGross','应收账款','应收账款账面余额'),
        // 坏账准备：解析器没有独立字段，显示为暂无
        badDebtProvision: pick('badDebtProvision','坏账准备','应收账款坏账准备'),
        // 应收账款净额：和账面余额同一字段（小微企业财务报表不分）
        accountsReceivableNet: pick('accountsReceivable','accountsReceivableNet','应收账款净额','应收账款'),
        // 应收票据：parser 输出 key = notesReceivable
        notesReceivable: pick('notesReceivable','应收票据','应收票据及应收账款'),
        // 预付款项：parser 输出 key = prepayments
        advancePayments: pick('prepayments','advancePayments','预付款项','预付账款'),
        // 其他应收款：parser 输出 key = otherReceivables
        otherReceivables: pick('otherReceivables','其他应收款'),
        // 存货：parser 输出 key = inventory
        inventory: pick('inventory','存货'),
        // 流动资产合计：parser 输出 key = currentAssets
        totalCurrentAssets: pick('currentAssets','totalCurrentAssets','流动资产合计','流动资产总计'),
        // 长期股权投资：parser 输出 key = longTermEquityInvestments
        longTermInvestments: pick('longTermEquityInvestments','longTermInvestments','长期股权投资','长期投资'),
        // 固定资产：parser 输出 key = fixedAssets（已是净额）
        fixedAssetsNet: pick('fixedAssets','fixedAssetsNet','固定资产','固定资产净值','固定资产净额'),
        // 无形资产：parser 输出 key = intangibleAssets
        intangibleAssets: pick('intangibleAssets','无形资产'),
        // 非流动资产合计：parser 输出 key = nonCurrentAssets
        totalNonCurrentAssets: pick('nonCurrentAssets','totalNonCurrentAssets','非流动资产合计','非流动资产总计'),
        // 资产总计：parser 输出 key = totalAssets
        totalAssets: appData.totalAssets ?? pick('totalAssets','资产总计','资产合计'),
        // 短期借款：parser 输出 key = shortTermLoans
        shortTermLoans: pick('shortTermLoans','短期借款'),
        // 应付账款：parser 输出 key = accountsPayable
        accountsPayable: pick('accountsPayable','应付账款'),
        // 应交税费：parser 输出 key = taxesPayable
        taxesPayable: pick('taxesPayable','应交税费','应交税金'),
        // 其他应付款：parser 输出 key = otherPayables
        otherPayables: pick('otherPayables','其他应付款'),
        // 流动负债合计：parser 输出 key = currentLiabilities
        totalCurrentLiabilities: pick('currentLiabilities','totalCurrentLiabilities','流动负债合计','流动负债总计'),
        // 长期借款：parser 输出 key = longTermLoans
        longTermLoans: pick('longTermLoans','长期借款','长期贷款'),
        // 非流动负债合计：parser 输出 key = nonCurrentLiabilities
        totalNonCurrentLiabilities: pick('nonCurrentLiabilities','totalNonCurrentLiabilities','非流动负债合计','非流动负债总计'),
        // 负债合计：parser 输出 key = totalLiabilities
        totalLiabilities: appData.totalLiabilities ?? pick('totalLiabilities','负债合计','负债总计'),
        // 实收资本：parser 输出 key = paidInCapital
        paidInCapital: pick('paidInCapital','实收资本','股本'),
        // 未分配利润：parser 输出 key = retainedEarnings
        retainedEarnings: pick('retainedEarnings','未分配利润'),
        // 所有者权益合计：parser 输出 key = ownersEquity
        totalEquity: (appData as Record<string,unknown>).totalEquity ?? pick('ownersEquity','totalEquity','parentEquity','所有者权益合计','股东权益合计'),
        // 衍生指标
        debtToAssetRatio: debtRatio,
        currentRatio: currentRatio,
        quickRatio: quickRatio,
        otherReceivablesRatio: otherRecRatio,
        netAssets: netAssetsN,
        interestBearingDebt: interestBearingDebtN,
        interestBearingDebtRatio: interestBearingDebtRatioN,
        reportPeriod: latestPeriodLabel || '—',
      };
    })(),
    IncomeStatement: (() => {
      const isRaw = latestFs?.incomeStatement as Record<string, unknown> || {};
      // 从各种字段名称提取营业收入和营业成本
      const revenueRaw = appData.revenue ?? isRaw['revenue'] ?? isRaw['\u8425\u4e1a\u6536\u5165'] ?? isRaw['\u4e00\u3001\u8425\u4e1a\u6536\u5165'] ?? isRaw['\u4e00\u3001\u8425\u4e1a\u603b\u6536\u5165'];
      const costRaw = isRaw['costOfRevenue'] ?? isRaw['\u8425\u4e1a\u6210\u672c'] ?? isRaw['\u4e8c\u3001\u8425\u4e1a\u6210\u672c'] ?? isRaw['\u4e8c\u3001\u8425\u4e1a\u603b\u6210\u672c'];
      const netProfitRaw = appData.netProfit ?? isRaw['netProfit'] ?? isRaw['\u51c0\u5229\u6da6'] ?? isRaw['\u516d\u3001\u51c0\u5229\u6da6'];
      const operatingProfitRaw = isRaw['operatingProfit'] ?? isRaw['\u8425\u4e1a\u5229\u6da6'] ?? isRaw['\u4e09\u3001\u8425\u4e1a\u5229\u6da6'];
      const depAmortRaw = isRaw['depreciationAmortization'] ?? isRaw['\u6298\u65e7\u6446\u9500'] ?? isRaw['\u8d44\u4ea7\u51cf\u5024\u51c6\u5907'];
      const equityRaw = (appData as Record<string, unknown>).totalEquity ?? (latestFs?.balanceSheet as Record<string, unknown> | undefined)?.totalEquity ?? (latestFs?.balanceSheet as Record<string, unknown> | undefined)?.['所有者权益合计'] ?? (latestFs?.balanceSheet as Record<string, unknown> | undefined)?.['所有者权益合计（所有者权益总计）'];
      const totalAssetsRaw = appData.totalAssets ?? (latestFs?.balanceSheet as Record<string, unknown> | undefined)?.totalAssets ?? (latestFs?.balanceSheet as Record<string, unknown> | undefined)?.['资产总计'];

      const toNum = (v: unknown): number | null => {
        if (v == null) return null;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return isNaN(n) ? null : n;
      };
      const revenue = toNum(revenueRaw);
      const cost = toNum(costRaw);
      const netProfit = toNum(netProfitRaw);
      const operatingProfit = toNum(operatingProfitRaw);
      const depAmort = toNum(depAmortRaw);
      const equity = toNum(equityRaw);
      const totalAssets = toNum(totalAssetsRaw);

      // 计算毛利润和毛利率
      const grossProfit = (revenue != null && cost != null) ? parseFloat((revenue - cost).toFixed(2)) : null;
      const grossMargin = (grossProfit != null && revenue != null && revenue !== 0) ? parseFloat((grossProfit / revenue * 100).toFixed(2)) : null;
      // 计算净利率
      const netProfitMargin = (netProfit != null && revenue != null && revenue !== 0) ? parseFloat((netProfit / revenue * 100).toFixed(2)) : null;
      // 计算 ROE（净利润/所有者权益）
      const roe = (netProfit != null && equity != null && equity !== 0) ? parseFloat((netProfit / equity * 100).toFixed(2)) : null;
      // 计算 ROA（净利润/总资产）
      const roa = (netProfit != null && totalAssets != null && totalAssets !== 0) ? parseFloat((netProfit / totalAssets * 100).toFixed(2)) : null;
      // 计算 EBITDA（营业利润 + 折旧摆销）
      const ebitda = (operatingProfit != null && depAmort != null) ? parseFloat((operatingProfit + depAmort).toFixed(2))
                   : (operatingProfit != null) ? operatingProfit : null;

      return {
        ...isRaw,
        revenue: revenueRaw,
        netProfit: netProfitRaw,
        reportPeriod: latestPeriodLabel || "—",
        // 计算字段（仅在原始数据中没有时才覆盖）
        grossProfit: isRaw['grossProfit'] != null ? isRaw['grossProfit'] : grossProfit,
        grossMargin: isRaw['grossMargin'] != null ? isRaw['grossMargin'] : grossMargin,
        netProfitMargin: isRaw['netProfitMargin'] != null ? isRaw['netProfitMargin'] : netProfitMargin,
        roe: isRaw['roe'] != null ? isRaw['roe'] : roe,
        roa: isRaw['roa'] != null ? isRaw['roa'] : roa,
        ebitda: isRaw['ebitda'] != null ? isRaw['ebitda'] : ebitda,
      };
    })(),
    CashFlowStatement: (() => {
      const cf = latestFs?.cashFlowStatement as Record<string, unknown> || {};
      const bs = latestFs?.balanceSheet as Record<string, unknown> || {};
      const pickCf = (...keys: string[]): unknown => {
        for (const k of keys) { if (cf[k] != null && cf[k] !== '' && cf[k] !== '0') return cf[k]; }
        return undefined;
      };
      const toN3 = (v: unknown): number | null => { if (v == null) return null; const n = parseFloat(String(v).replace(/,/g,'')); return isNaN(n) ? null : n; };
      const netOpCF = toN3(appData.operatingCashFlow ?? pickCf('operatingCashFlow','netOperatingCashFlow','经营活动产生的现金流量净额','经营活动现金流量净额','一、经营活动产生的现金流量净额'));
      const netInvCF = toN3(pickCf('investingCashFlow','netInvestingCashFlow','投资活动产生的现金流量净额','投资活动现金流量净额','二、投资活动产生的现金流量净额'));
      const netFinCF = toN3(pickCf('financingCashFlow','netFinancingCashFlow','筹资活动产生的现金流量净额','筹资活动现金流量净额','三、筹资活动产生的现金流量净额','筹资活动产生的现金流量净额'));
      const endCash = toN3(pickCf('endingCashBalance','期末现金及现金等价物余额','期末现金余额','现金及现金等价物期末余额','期未现金及现金等价物余额'));
      // 计算经营现金流/净利润比率
      const isRaw2 = latestFs?.incomeStatement as Record<string, unknown> || {};
      const netProfitN = toN3(appData.netProfit ?? isRaw2['netProfit'] ?? isRaw2['净利润'] ?? isRaw2['六、净利润']);
      const cfRatio = (netOpCF != null && netProfitN != null && netProfitN !== 0) ? parseFloat((netOpCF / netProfitN).toFixed(2)) : null;
      // 货币资金与期未现金交叉验证
      const bsCash = toN3(bs['cashAndEquivalents'] ?? bs['货币资金'] ?? bs['现金及现金等价物']);
      let crossCheck: string;
      if (endCash != null && bsCash != null) {
        const diff = Math.abs(endCash - bsCash);
        const pct = bsCash !== 0 ? diff / Math.abs(bsCash) * 100 : 0;
        if (pct < 1) crossCheck = `✅ 一致（资产负债表货币资金 ${bsCash}万元 vs 现金流量表期未余额 ${endCash}万元，差异${diff.toFixed(2)}万元）`;
        else crossCheck = `⚠️ 差异较大（资产负债表货币资金 ${bsCash}万元 vs 现金流量表期未余额 ${endCash}万元，差异${diff.toFixed(2)}万元/${pct.toFixed(2)}%，建议核查）`;
      } else if (bsCash != null) {
        crossCheck = `货币资金 ${bsCash}万元（现金流量表期未余额未解析，无法交叉验证）`;
      } else {
        crossCheck = '数据不足（需上传财务报表）';
      }
      return {
        ...cf,
        netOperatingCashFlow: appData.operatingCashFlow ?? pickCf('netOperatingCashFlow','经营活动产生的现金流量净额','经营活动现金流量净额'),
        operatingCashInflow: pickCf('operatingCashInflow','经营活动现金流入小计','经营活动产生现金流入小计'),
        operatingCashOutflow: pickCf('operatingCashOutflow','经营活动现金流出小计','经营活动产生现金流出小计'),
        netInvestingCashFlow: netInvCF,
        netFinancingCashFlow: netFinCF,
        endingCashBalance: endCash,
        cashFlowToNetProfitRatio: cfRatio,
        balanceSheetCrossCheck: crossCheck,
        reportPeriod: latestPeriodLabel || '—',
      };
    })(),
    LegalRepresentative: {
      name: (idCardData?.name as string) || (bizLicenseData?.legalPerson as string) || appData.legalPerson,
      idNumber: idCardData?.idNumber as string || idCardData?.id_number as string || '未提供',
      gender: idCardData?.gender as string || idCardData?.sex as string || '—',
      nationality: idCardData?.nationality as string || '—',
      birthDate: idCardData?.birthDate as string || idCardData?.birth_date as string || '—',
      address: idCardData?.address as string || '—',
      role: '法定代表人',
      hasPersonalCreditReport: '未提供',
      dataSource: idCardData ? '法人身份证PDF解析' : bizLicenseData ? '营业执照PDF解析' : '用户输入',
    },
    NaturalPerson: {
      name: appData.legalPerson,
      role: '法定代表人',
      dataSource: '营业执照解析',
    },
    ActualController: {
      name: appData.legalPerson,
      role: '实际控制人',
      controlRatio: '100%',
      dataSource: '营业执照解析',
    },
    Shareholder: {
      name: appData.legalPerson,
      shareholdingRatio: '100%',
      investmentAmount: appData.registeredCapital,
      dataSource: '营业执照解析',
    },
    Enterprise: {
      uscc: appData.creditCode,
      companyName: appData.companyName,
      companyType: appData.companyType,
      registeredCapital: appData.registeredCapital,
      establishDate: appData.establishDate,
      address: appData.address,
      industry: appData.industry,
      operatingStatus: '存续',
      dataSource: appData.companyDataSource === 'business_license' ? '营业执照PDF解析' :
                  appData.companyDataSource === 'ai_generated' ? 'AI生成（模拟）' : '用户输入',
    },
    AssociatedEnterprise: {
      companyName: appData.companyName ? `${appData.companyName}关联企业` : '未关联',
      associationType: '关联企业',
      dataSource: '工商数据',
    },
    CustomerEnterprise: (() => {
      // 优先使用Top5甲方清单解析数据
      if (top5CustomerData && Object.keys(top5CustomerData).length > 0) {
        return { ...top5CustomerData, dataSource: 'Top5甲方清单解析' };
      }
      const cp = appData.counterpartyInfo;
      if (!cp?.name) return { totalTransactionAmount: '未上传发票数据', dataSource: '发票数据（未上传）' };
      // 计算信用资质评估
      let qualScore = 60;
      if (cp.hasOverdueHistory === false) qualScore += 15;
      if (cp.hasOverdueHistory === true) qualScore -= 25;
      if (cp.paymentTermDays && cp.paymentTermDays >= 30 && cp.paymentTermDays <= 180) qualScore += 10;
      if (cp.arConcentrationRatio !== undefined && cp.arConcentrationRatio <= 0.3) qualScore += 15;
      if (cp.arConcentrationRatio !== undefined && cp.arConcentrationRatio > 0.6) qualScore -= 20;
      qualScore = Math.max(0, Math.min(100, qualScore));
      const qualLabel = qualScore >= 75 ? '优质' : qualScore >= 55 ? '良好' : qualScore >= 40 ? '一般' : '较差';
      const concRiskLabel = cp.arConcentrationRatio === undefined ? '未知' : cp.arConcentrationRatio <= 0.3 ? '低风险' : cp.arConcentrationRatio <= 0.6 ? '中等风险' : '高风险';
      return {
        companyName: cp.name,
        creditCode: cp.creditCode || '未提供',
        totalTransactionAmount: cp.contractAmount ? `${cp.contractAmount}万元` : '未设置',
        concentrationRatio: cp.arConcentrationRatio !== undefined ? `${(cp.arConcentrationRatio * 100).toFixed(2)}%` : '未知',
        paymentTermDays: cp.paymentTermDays ? `${cp.paymentTermDays}天` : '未知',
        paymentMethod: cp.paymentMethod || '未知',
        hasOverdueHistory: cp.hasOverdueHistory !== undefined ? (cp.hasOverdueHistory ? `有逾期${cp.overdueDays ? `（${cp.overdueDays}天）` : ''}` : '无逾期') : '未确认',
        creditRating: `${qualLabel}（${qualScore}/100）`,
        concentrationRisk: concRiskLabel,
        dataSource: '用户输入（甲方信息表单）',
      };
    })(),
    SupplierEnterprise: top5SupplierData && Object.keys(top5SupplierData).length > 0 ? {
      ...top5SupplierData,
      dataSource: 'Top5供应商清单解析',
    } : {
      totalTransactionAmount: '未上传采购数据',
      dataSource: '发票数据（未上传）',
    },
    LoanApplication: {
      requestAmount: appData.amount ? `${appData.amount}万元` : '未设置',
      loanType: appData.loanType,
      loanPeriod: appData.period ? `${appData.period}个月` : '未设置',
      loanPurpose: appData.purpose,
      dataSource: '用户输入',
    },
    CreditAssessment: {
      score: sc?.score,
      creditGrade: sc?.creditGrade,
      scorePD: sc?.scorePD,
      approvedAmount: lc?.approvedAmount != null ? Math.max(0, lc.approvedAmount) : undefined,
      recommendation: sc?.recommendation,
      dataSource: 'AI评分卡模型',
    },
    // 银行账户节点（数据来源于银行流水PDF解析）
    BankAccount: bankStatementData ? {
      bankName: bankStatementData.bankName,
      accountNumber: bankStatementData.accountNumber,
      accountName: bankStatementData.accountName,
      accountType: '对公账户',
      statementPeriod: bankStatementData.statementPeriod,
      openingBalance: bankStatementData.openingBalance,
      closingBalance: bankStatementData.closingBalance,
      totalInflow: bankStatementData.totalInflow,
      totalOutflow: bankStatementData.totalOutflow,
      avgMonthlyInflow: bankStatementData.avgMonthlyInflow,
      maxSingleTransaction: bankStatementData.maxSingleTransaction,
      loanRepaymentCount: Array.isArray(bankStatementData.loanRepaymentRecords) ? bankStatementData.loanRepaymentRecords.length : '—',
      top5CounterpartiesCount: Array.isArray(bankStatementData.top5Counterparties) ? bankStatementData.top5Counterparties.length : '—',
      abnormalTransactionCount: Array.isArray(bankStatementData.abnormalTransactions) ? bankStatementData.abnormalTransactions.length : 0,
      dataSource: '银行流水PDF解析',
    } : { dataSource: '未上传银行流水' },
    // 纳税申报记录节点（数据来源于纳税申报表PDF解析）
    VatReturn: vatReturnData ? {
      taxPeriod: vatReturnData.taxPeriod || vatReturnData.period,
      taxYear: vatReturnData.taxYear,
      salesRevenue: vatReturnData.salesRevenue,
      taxableRevenue: vatReturnData.taxableRevenue,
      outputTax: vatReturnData.outputTax,
      inputTax: vatReturnData.inputTax,
      taxPayable: vatReturnData.taxPayable,
      taxBurdenRate: vatReturnData.taxBurdenRate,
      avgMonthlyRevenue: vatReturnData.avgMonthlyRevenue,
      totalRevenue12M: vatReturnData.totalRevenue12M,
      totalTaxPaid: vatReturnData.totalTaxPaid,
      taxRate: vatReturnData.taxRate,
      hasArrears: vatReturnData.hasArrears,
      monthlyRevenueCount: Array.isArray(vatReturnData.monthlyRevenues) ? vatReturnData.monthlyRevenues.length : '—',
      dataSource: '增值税纳税申报表PDF解析',
    } : { dataSource: '未上传增值税申报表' },
    TaxClearanceCert: taxClearanceData ? {
      companyName: taxClearanceData.companyName,
      creditCode: taxClearanceData.creditCode,
      taxAuthority: taxClearanceData.taxAuthority,
      clearancePeriod: taxClearanceData.clearancePeriod,
      hasArrears: taxClearanceData.hasArrears,
      arrearAmount: taxClearanceData.arrearAmount,
      issuedDate: taxClearanceData.issuedDate,
      validUntil: taxClearanceData.validUntil,
      dataSource: '完税证明PDF解析',
    } : (taxCreditData ? {
      creditLevel: taxCreditData.creditLevel,
      evaluationYear: taxCreditData.evaluationYear,
      taxAuthority: taxCreditData.taxAuthority,
      issuedDate: taxCreditData.issuedDate,
      validUntil: taxCreditData.validUntil,
      riskNote: taxCreditData.riskNote,
      dataSource: '纳税信用等级证书PDF解析',
    } : { dataSource: '未上传完税证明' }),
    // 财务指标集（从三张表计算）
    FinancialIndicatorSet: (() => {
      const bs = latestFs?.balanceSheet as Record<string, unknown> | undefined;
      const is_ = latestFs?.incomeStatement as Record<string, unknown> | undefined;
      const cf = latestFs?.cashFlowStatement as Record<string, unknown> | undefined;
      const toN = (v: unknown): number | null => {
        if (v == null) return null;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return isNaN(n) ? null : n;
      };
      const totalAssets = toN(bs?.totalAssets ?? bs?.['资产总计'] ?? appData.totalAssets);
      const totalLiab = toN(bs?.totalLiabilities ?? bs?.['负债合计'] ?? appData.totalLiabilities);
      const totalEquity = toN(bs?.totalEquity ?? bs?.['所有者权益合计'] ?? (appData as Record<string, unknown>).totalEquity);
      const currentAssets = toN(bs?.currentAssets ?? bs?.['流动资产合计']);
      const currentLiab = toN(bs?.currentLiabilities ?? bs?.['流动负债合计']);
      const inventory = toN(bs?.inventory ?? bs?.['存货']);
      const accountsReceivable = toN(bs?.accountsReceivable ?? bs?.['应收账款']);
      const otherReceivables = toN(bs?.otherReceivables ?? bs?.['其他应收款']);
      const revenue = toN(is_?.revenue ?? is_?.['营业收入'] ?? appData.revenue);
      const costOfRevenue = toN(is_?.costOfRevenue ?? is_?.['营业成本']);
      const netProfit = toN(is_?.netProfit ?? is_?.['净利润'] ?? appData.netProfit);
      const operatingProfit = toN(is_?.operatingProfit ?? is_?.['营业利润']);
      const interestExpense = toN(is_?.interestExpense ?? is_?.['利息支出']);
      const netOpCF = toN(cf?.netOperatingCashFlow ?? cf?.['经营活动产生的现金流量净额'] ?? appData.operatingCashFlow);
      // 计算各指标
      const debtToAsset = (totalLiab != null && totalAssets != null && totalAssets !== 0) ? parseFloat((totalLiab / totalAssets * 100).toFixed(2)) : null;
      const currentRatio = (currentAssets != null && currentLiab != null && currentLiab !== 0) ? parseFloat((currentAssets / currentLiab).toFixed(2)) : toN(appData.currentRatio);
      const quickRatio = (currentAssets != null && inventory != null && currentLiab != null && currentLiab !== 0) ? parseFloat(((currentAssets - inventory) / currentLiab).toFixed(2)) : toN(appData.quickRatio);
      const grossProfit = (revenue != null && costOfRevenue != null) ? parseFloat((revenue - costOfRevenue).toFixed(2)) : null;
      const grossMargin = (grossProfit != null && revenue != null && revenue !== 0) ? parseFloat((grossProfit / revenue * 100).toFixed(2)) : null;
      const netProfitMargin = (netProfit != null && revenue != null && revenue !== 0) ? parseFloat((netProfit / revenue * 100).toFixed(2)) : null;
      const roe = (netProfit != null && totalEquity != null && totalEquity !== 0) ? parseFloat((netProfit / totalEquity * 100).toFixed(2)) : toN(appData.roe);
      const roa = (netProfit != null && totalAssets != null && totalAssets !== 0) ? parseFloat((netProfit / totalAssets * 100).toFixed(2)) : null;
      const ebit = operatingProfit;
      const interestCoverage = (ebit != null && interestExpense != null && interestExpense !== 0) ? parseFloat((ebit / interestExpense).toFixed(2)) : null;
      const arTurnoverDays = (accountsReceivable != null && revenue != null && revenue !== 0) ? parseFloat((accountsReceivable * 365 / revenue).toFixed(1)) : null;
      const invTurnoverDays = (inventory != null && costOfRevenue != null && costOfRevenue !== 0) ? parseFloat((inventory * 365 / costOfRevenue).toFixed(1)) : null;
      const cfToNetProfit = (netOpCF != null && netProfit != null && netProfit !== 0) ? parseFloat((netOpCF / netProfit).toFixed(2)) : null;
      const otherRecRatio = (otherReceivables != null && totalAssets != null && totalAssets !== 0) ? parseFloat((otherReceivables / totalAssets * 100).toFixed(2)) : null;
      return {
        reportPeriod: latestPeriodLabel || '—',
        debtToAssetRatio: debtToAsset != null ? `${debtToAsset}%` : '数据不足',
        currentRatio: currentRatio != null ? currentRatio : '数据不足',
        quickRatio: quickRatio != null ? quickRatio : '数据不足',
        interestCoverageRatio: interestCoverage != null ? interestCoverage : (interestExpense === 0 ? '无利息支出' : '数据不足'),
        roe: roe != null ? `${roe}%` : '数据不足',
        roa: roa != null ? `${roa}%` : '数据不足',
        grossMargin: grossMargin != null ? `${grossMargin}%` : '数据不足',
        netProfitMargin: netProfitMargin != null ? `${netProfitMargin}%` : '数据不足',
        ebitda: (() => {
          // EBITDA = 营业利润 + 折旧 + 摊销（无折旧摊销数据时以营业利润近似，标注为近似值）
          const depreciation = toN(cf?.depreciationAmortization ?? cf?.['固定资产折旧、油气资产折耗、生产性生物资产折旧'] ?? cf?.['折旧与摊销']);
          if (operatingProfit != null && depreciation != null) return `${parseFloat((operatingProfit + depreciation).toFixed(2))}万元`;
          if (operatingProfit != null) return `${operatingProfit}万元（近似，未含折旧摊销）`;
          return '数据不足';
        })(),
        arTurnoverDays: arTurnoverDays != null ? `${arTurnoverDays}天` : '数据不足',
        inventoryTurnoverDays: invTurnoverDays != null ? `${invTurnoverDays}天` : '数据不足',
        cashFlowToNetProfitRatio: cfToNetProfit != null ? cfToNetProfit : '数据不足',
        otherReceivablesRatio: otherRecRatio != null ? `${otherRecRatio}%` : '数据不足',
        dataSource: '财务报表三张表计算',
      };
    })(),
    // 企业征信报告（来源于征信系统）
    EnterpriseCreditReport: {
      totalLoanBalance: '未接入征信系统',
      overdueCount: '未接入征信系统',
      badDebtFlag: '未接入征信系统',
      dataSource: '征信系统（未接入）',
    },
    // 个人征信报告
    PersonalCreditReport: {
      totalLoanBalance: '未提供个人征信报告',
      overdueCount: '未提供',
      queryCount3M: '未提供',
      dataSource: '个人征信报告（未提供）',
    },
    // 诉讼记录
    Litigation: {
      dataSource: '司法数据（未接入）',
    },
    // 被执行记录
    Enforcement: {
      dataSource: '司法数据（未接入）',
    },
    // 失信被执行
    DishonestExecution: {
      dataSource: '司法数据（未接入）',
    },
    // 工商变更
    BizChange: {
      companyName: appData.companyName,
      dataSource: '工商数据（历史变更）',
    },
    // 行政处罚
    AdministrativePenalty: {
      dataSource: '行政处罚数据（未接入）',
    },
    // 法律主体（顶层）
    LegalSubject: {
      name: appData.companyName || '—',
      status: '存续',
      dataSource: '工商数据',
    },
    // 金融资产（顶层）
    FinancialAsset: {
      dataSource: '银行/征信数据',
    },
    // 财务报表（顶层）
    FinancialStatement: {
      reportPeriod: latestPeriodLabel || '—',
      auditStatus: (latestFs?.incomeStatement as Record<string, unknown> | undefined)?.auditOpinion ? '已审计' : '未知',
      dataSource: '财务报表PDF解析',
    },
    // 税务记录（顶层）
    TaxRecord: (() => {
      const taxSources = [vatReturnData, citReturnData, taxClearanceData, taxCreditData].filter(Boolean);
      if (taxSources.length === 0) return { dataSource: '未上传纳税申报表' };
      const merged: Record<string, unknown> = {};
      taxSources.forEach(d => { if (d) Object.assign(merged, d); });
      return {
        period: merged.taxPeriod || merged.period || merged.taxYear || '—',
        taxType: [vatReturnData && '增值税', citReturnData && '企业所得税', taxClearanceData && '完税证明', taxCreditData && '纳税信用'].filter(Boolean).join('/'),
        totalTaxPaid: merged.totalTaxPaid || merged.incomeTaxPaid || '—',
        taxCreditLevel: (taxCreditData?.creditLevel as string) || (taxClearanceData?.taxCreditLevel as string) || '—',
        hasArrears: merged.hasArrears ?? '—',
        uploadedDocCount: taxSources.length,
        dataSource: '纳税申报表PDF解析（' + taxSources.length + '份）',
      };
    })(),
    // 贷款账户
    LoanAccount: {
      dataSource: '征信系统（未接入）',
    },
    // 发票
    Invoice: invoiceData ? {
      ...invoiceData,
      dataSource: '应收账款发票PDF解析',
    } : { dataSource: '发票数据（未上传）' },
    // 企业所得税申报（CitReturn）
    CitReturn: citReturnData ? {
      taxYear: citReturnData.taxYear,
      totalRevenue: citReturnData.totalRevenue,
      totalCost: citReturnData.totalCost,
      grossProfit: citReturnData.grossProfit,
      netProfit: citReturnData.netProfit,
      taxableIncome: citReturnData.taxableIncome,
      taxRate: citReturnData.taxRate,
      taxPayable: citReturnData.taxPayable,
      incomeTaxPaid: citReturnData.incomeTaxPaid,
      effectiveTaxRate: citReturnData.effectiveTaxRate,
      profitMargin: citReturnData.profitMargin,
      revenueGrowthRate: citReturnData.revenueGrowthRate,
      hasArrears: citReturnData.hasArrears,
      dataSource: '企业所得税年度申报表PDF解析',
    } : { dataSource: '未上传企业所得税年报' },
    // 担保记录
    GuaranteeRecord: contractData ? {
      ...contractData,
      dataSource: '合同/担保资料PDF解析',
    } : { dataSource: '担保数据（未上传）' },
    // 抵押记录
    MortgageRecord: (() => {
      const mortgageFile = (uploadedFiles || []).find(f => f.docId === 'mortgage' && f.status === 'done' && f.parsedData);
      return mortgageFile?.parsedData ? {
        ...mortgageFile.parsedData,
        dataSource: '抵押资料PDF解析',
      } : { dataSource: '抵押资料（未上传）' };
    })(),
    // 法律事件（顶层）
    LegalEvent: {
      dataSource: '司法数据（未接入）',
    },
    // 风控报告
    RiskReport: {
      creditScore: sc?.score,
      riskLevel: sc?.creditGrade,
      aiVerdict: sc?.recommendation,
      recommendedAmount: lc?.approvedAmount != null ? Math.max(0, lc.approvedAmount) : undefined,
      hardRulesPassed: (analysisResult?.layer3 as Record<string, unknown> | undefined)?.hardRules ? ((analysisResult?.layer3 as Record<string, unknown>).hardRules as Record<string, unknown>)?.allPassed : analysisResult?.layer3?.ruleEngine?.passed,
      subjectQualityScore: sc?.subjectQualityScore,
      financialHealthScore: sc?.financialHealthScore,
      operationStabilityScore: sc?.operationStabilityScore,
      generatedAt: new Date().toLocaleDateString('zh-CN'),
      dataSource: 'AI风控模型',
    },
    // 贷后监控快照
    MonitorSnapshot: {
      snapshotDate: new Date().toLocaleDateString('zh-CN'),
      overallAlertLevel: '正常',
      alertCount: 0,
      dataSource: '贷后监控系统（未接入）',
    },
    // 预警事件
    AlertEvent: {
      dataSource: '贷后监控系统（未接入）',
    },
    // 舆情事件
    SentimentEvent: {
      dataSource: '舆情监控系统（未接入）',
    },
    // 设备记录
    DeviceRecord: {
      dataSource: '设备指纹系统（未接入）',
    },
    // 电话号码节点
    PhoneNode: {
      dataSource: '手机号验证系统（未接入）',
    },
    // 地址节点
    AddressNode: {
      address: appData.address || '—',
      dataSource: '工商注册地址',
    },
    // 贷款合同
    LoanContract: {
      dataSource: '合同系统（待签约）',
    },
    // 营业收入组成
    RevenueBreakdown: revenueBreakdownData ? {
      ...revenueBreakdownData,
      dataSource: '营业收入组成文件解析',
    } : {
      dataSource: '未上传营业收入组成',
    },
    // 他行授信
    CreditFacility: creditFacilityData ? {
      totalCreditLine: creditFacilityData.totalCreditLine,
      usedCreditLine: creditFacilityData.usedCreditLine,
      creditUtilizationRate: creditFacilityData.creditUtilizationRate,
      lenderCount: creditFacilityData.lenderCount,
      debtToRevenueRatio: creditFacilityData.debtToRevenueRatio,
      annualRepaymentPressure: creditFacilityData.annualRepaymentPressure,
      dataSource: '他行授信文件解析',
    } : {
      dataSource: '未上传他行授信资料',
    },
    // 在手订单
    OpenOrders: openOrdersData ? {
      totalOrderAmount: openOrdersData.totalOrderAmount,
      confirmedOrderRatio: openOrdersData.confirmedOrderRatio,
      maxSingleOrderRatio: openOrdersData.maxSingleOrderRatio,
      orderToLoanCoverageRatio: openOrdersData.orderToLoanCoverageRatio,
      expectedRepaymentDate: openOrdersData.expectedRepaymentDate,
      dataSource: '在手订单文件解析',
    } : {
      dataSource: '未上传在手订单',
    },
    // 销售台账
    SalesLedger: salesLedgerData ? {
      annualSalesAmount: salesLedgerData.annualSalesAmount,
      monthlyRevenueVolatility: salesLedgerData.monthlyRevenueVolatility,
      accountsReceivableRecoveryRate: salesLedgerData.accountsReceivableRecoveryRate,
      top5CustomerConcentration: salesLedgerData.top5CustomerConcentration,
      newCustomerRatio: salesLedgerData.newCustomerRatio,
      dataSource: '销售台账文件解析',
    } : {
      dataSource: '未上传销售台账',
    },
    // 开户许可证
    BankPermit: bankPermitData ? {
      accountName: bankPermitData.accountName,
      accountNumber: bankPermitData.accountNumber,
      bankName: bankPermitData.bankName,
      permitNo: bankPermitData.permitNo,
      issueDate: bankPermitData.issueDate,
      isConsistentWithBizLicense: bankPermitData.isConsistentWithBizLicense,
      dataSource: '开户许可证文件解析',
    } : {
      dataSource: '未上传开户许可证',
    },
    // 资质证明
    Qualification: qualificationData ? {
      certName: qualificationData.certName,
      certNo: qualificationData.certNo,
      issuingAuthority: qualificationData.issuingAuthority,
      validFrom: qualificationData.validFrom,
      validTo: qualificationData.validTo,
      certCount: qualificationData.certCount,
      industryCategory: qualificationData.industryCategory,
      dataSource: '资质证明文件解析',
    } : {
      dataSource: '未上传资质证明',
    },
    // 公司介绍
    BusinessIntro: businessIntroData ? {
      industryRiskLevel: businessIntroData.industryRiskLevel,
      businessCycleStage: businessIntroData.businessCycleStage,
      collectionCycleDays: businessIntroData.collectionCycleDays,
      top1CustomerShare: businessIntroData.top1CustomerShare,
      marketPosition: businessIntroData.marketPosition,
      policyRiskRating: businessIntroData.policyRiskRating,
      businessModel: businessIntroData.businessModel,
      dataSource: '公司介绍文件解析',
    } : {
      dataSource: '未上传公司介绍',
    },
    // 高管简历
    MgmtResume: mgmtResumeData ? {
      name: mgmtResumeData.name,
      position: mgmtResumeData.position,
      yearsOfExperience: mgmtResumeData.yearsOfExperience,
      industryBackground: mgmtResumeData.industryBackground,
      creditRecord: mgmtResumeData.creditRecord,
      hasBlacklist: mgmtResumeData.hasBlacklist,
      dataSource: '高管简历文件解析',
    } : {
      dataSource: '未上传高管简历',
    },
  };

  // 从云端 DB 节点补充真实数据
  dbNodes.forEach(n => {
    const typeKey = n.type?.replace("Snapshot", "").replace("Applying", "Applicant");
    if (typeKey && n.properties) {
      REAL_DATA_MAP[typeKey] = { ...(REAL_DATA_MAP[typeKey] || {}), ...(n.properties as Record<string, unknown>) };
    }
  });

  // 从本地 SQLite 图谱节点补充真实数据（优先级高于云端，覆盖同名字段）
  localGraphEntities.forEach(entity => {
    // 将图谱实体类型映射到本体 ID
    const typeMap: Record<string, string> = {
      Company: 'ApplicantEnterprise',
      LegalRepresentative: 'LegalRepresentative',
      ActualController: 'ActualController',
      Shareholder: 'Shareholder',
      BankAccount: 'BankAccount',
      BankTransaction: 'BankAccount', // 月度流水合并到账户节点
      BalanceSheet: 'BalanceSheet',
      IncomeStatement: 'IncomeStatement',
      CashFlowStatement: 'CashFlowStatement',
      TaxDeclaration: 'VatReturn',
      TaxCertificate: 'TaxClearanceCertificate',
      TaxCredit: 'TaxCreditRating',
      AuditReport: 'AuditReport',
      BusinessLicense: 'ApplicantEnterprise', // 营业执照数据合并到企业节点
      Top5Customer: 'CustomerEnterprise',
      Top5Supplier: 'SupplierEnterprise',
      FeatureVector: 'ApplicantEnterprise', // 特征向量合并到企业节点
      AnalysisResult: 'ApplicantEnterprise', // 分析结论合并到企业节点
    };
    const ontologyId = typeMap[entity.type];
    if (ontologyId && entity.properties && Object.keys(entity.properties).length > 0) {
      REAL_DATA_MAP[ontologyId] = { ...(REAL_DATA_MAP[ontologyId] || {}), ...entity.properties };
    }
  });

  // ── 构建层次树 ────────────────────────────────
  const topLevel = ONTOLOGY.filter(e => !e.parent);
  const childrenOf = (parentId: string) => ONTOLOGY.filter(e => e.parent === parentId);

  const selectedEntity = ONTOLOGY.find(e => e.id === selectedEntityId) || ONTOLOGY[0];
  const realData = REAL_DATA_MAP[selectedEntityId] || {};

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 如果没有企业名但有财务报表或其他数据，允许显示知识图谱（用"某企业"作为默认名称）
  const hasSomeData = !!companyName || Object.keys(appData.financialStatementsByYear || {}).length > 0 ||
    !!appData.bankData || !!appData.taxData || !!appData.creditCode;
  if (!hasSomeData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Network size={32} className="mb-3 opacity-30" />
        <div className="text-sm">请先上传文件或输入企业信息</div>
        <div className="text-xs mt-1">上传财务报表、营业执照或陆输入企业名称后将自动构建知识图谱</div>
      </div>
    );
  }

  return (
    <div className="flex gap-3" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
      {/* 左侧：44类实体层次树 */}
      <div className="w-48 flex-shrink-0 overflow-y-auto" style={{ height: '100%' }}>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
          实体类 ({ONTOLOGY.length}) · 关系 46种
        </div>
        {topLevel.map(top => {
          const children = childrenOf(top.id);
          const isExpanded = expandedGroups.has(top.id);
          const isTopSelected = selectedEntityId === top.id;
          return (
            <div key={top.id} className="mb-0.5">
              <button
                onClick={() => { setSelectedEntityId(top.id); if (children.length > 0) toggleGroup(top.id); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  isTopSelected ? "bg-orange-50 border border-orange-200" : "hover:bg-gray-50"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: top.color }} />
                <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{top.label}</span>
                {children.length > 0 && (
                  <span className="text-[10px] text-gray-400">{isExpanded ? "▾" : "▸"}</span>
                )}
              </button>
              {isExpanded && children.map(child => {
                const grandchildren = childrenOf(child.id);
                const isChildExpanded = expandedGroups.has(child.id);
                const isChildSelected = selectedEntityId === child.id;
                return (
                  <div key={child.id} className="ml-3">
                    <button
                      onClick={() => { setSelectedEntityId(child.id); if (grandchildren.length > 0) toggleGroup(child.id); }}
                      className={`w-full text-left px-2 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                        isChildSelected ? "bg-orange-50 border border-orange-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                      <span className="text-xs text-gray-600 flex-1 truncate">{child.label}</span>
                      {grandchildren.length > 0 && (
                        <span className="text-[10px] text-gray-400">{isChildExpanded ? "▾" : "▸"}</span>
                      )}
                    </button>
                    {isChildExpanded && grandchildren.map(gc => (
                      <div key={gc.id} className="ml-3">
                        <button
                          onClick={() => setSelectedEntityId(gc.id)}
                          className={`w-full text-left px-2 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                            selectedEntityId === gc.id ? "bg-orange-50 border border-orange-200" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: gc.color }} />
                          <span className="text-[11px] text-gray-500 flex-1 truncate">{gc.label}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 右侧：属性定义 + 真实值 */}
      <div className="flex-1 min-w-0" style={{ height: '100%' }}>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '100%' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50 flex-shrink-0">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEntity.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900">{selectedEntity.label}</div>
              <div className="text-[10px] text-gray-400">{selectedEntity.id} · 数据来源: {selectedEntity.dataSource}</div>
            </div>
            <span className="text-[10px] text-gray-400 flex-shrink-0 bg-white px-2 py-0.5 rounded-full border border-gray-200">
              属性定义 {selectedEntity.properties.length} 个
            </span>
          </div>
          {/* 舆情搜索区域 */}
          {(selectedEntityId === 'SentimentEvent' || selectedEntityId.startsWith('Sentiment')) && companyName && (
            <div className="mx-4 mt-3 mb-0 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={13} className="text-cyan-600" />
                <span className="text-xs font-semibold text-gray-700">互联网舆情搜索</span>
                <button
                  onClick={() => searchSentimentMutation.mutate({ companyName, searchType: 'all' })}
                  disabled={searchSentimentMutation.isPending}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 transition"
                >
                  {searchSentimentMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  {searchSentimentMutation.isPending ? '搜索中...' : '搜索舆情'}
                </button>
              </div>
              {sentimentSearched && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sentimentLlmSummary && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                      <div className="text-[10px] text-yellow-600 mb-1">{sentimentLlmSummary.dataNote}</div>
                      <div className="text-xs text-gray-700 leading-relaxed">{sentimentLlmSummary.summary}</div>
                      {sentimentLlmSummary.riskSignals.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sentimentLlmSummary.riskSignals.map((s, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {sentimentResults.map((r, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-lg p-2.5">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline line-clamp-2">{r.title}</a>
                      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{r.snippet}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">{r.source}</span>
                        {r.date && <span className="text-[10px] text-gray-300">{r.date}</span>}
                      </div>
                    </div>
                  ))}
                  {sentimentResults.length === 0 && !sentimentLlmSummary && (
                    <div className="text-xs text-gray-400 text-center py-3">未找到相关舆情信息</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 法律事件搜索区域 */}
          {(selectedEntityId === 'LegalEvent' || selectedEntityId.startsWith('Legal')) && selectedEntityId !== 'LegalSubject' && companyName && (
            <div className="mx-4 mt-3 mb-0 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={13} className="text-red-600" />
                <span className="text-xs font-semibold text-gray-700">司法事件搜索</span>
                <button
                  onClick={() => searchLegalMutation.mutate({ companyName, searchType: 'all' })}
                  disabled={searchLegalMutation.isPending}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {searchLegalMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  {searchLegalMutation.isPending ? '搜索中...' : '搜索司法信息'}
                </button>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-2">
                <div className="text-[10px] text-amber-700 font-semibold mb-1">⚠️ 数据待接入说明</div>
                <div className="text-[10px] text-amber-600 leading-relaxed">
                  司法判决、失信被执行人、强制执行等正式数据需对接以下 API：
                  <strong className="text-amber-700">天眼查</strong>（企业风险数据）、<strong className="text-amber-700">中国裁判文书网</strong>（判决文书）、
                  <strong className="text-amber-700">最高人民法院失信被执行人名单</strong>。
                  当前点击“搜索司法信息”可通过互联网公开信息兑换参考，但不能替代官方司法数据库查询。
                </div>
              </div>
              {legalSearched && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {legalLlmSummary && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                      <div className="text-[10px] text-red-600 mb-1">{legalLlmSummary.dataNote}</div>
                      <div className="text-xs text-gray-700 leading-relaxed">{legalLlmSummary.summary}</div>
                      {legalLlmSummary.riskSignals.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {legalLlmSummary.riskSignals.map((s, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {legalResults.map((r, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-lg p-2.5">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline line-clamp-2">{r.title}</a>
                      <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{r.snippet}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">{r.source}</span>
                        {r.date && <span className="text-[10px] text-gray-300">{r.date}</span>}
                      </div>
                    </div>
                  ))}
                  {legalResults.length === 0 && !legalLlmSummary && (
                    <div className="text-xs text-gray-400 text-center py-3">未找到相关司法信息</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 数据来源警告 */}
          {typeof realData.dataSource === 'string' && realData.dataSource.includes('AI生成') && (
            <div className="mx-4 mt-2 mb-0 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2 flex-shrink-0">
              <span className="text-yellow-500 text-sm flex-shrink-0">⚠️</span>
              <div className="text-[11px] text-yellow-700">
                <span className="font-medium">模拟数据</span>：此实体的工商数据由AI模拟生成，仅供演示。实际业务请上传营业执照或接入天眼查/企查查API获取真实数据。
              </div>
            </div>
          )}
          {/* TOP5 甲方单位卡片展示 */}
          {selectedEntityId === 'CustomerEnterprise' && appData.top5Customers && appData.top5Customers.length > 0 && (() => {
            const sortedYears = [...appData.top5Customers].sort((a, b) => b.year - a.year);
            const latestYearData = sortedYears[0];
            const items = latestYearData?.items.filter(it => it.name) ?? [];
            return items.length > 0 ? (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">甲方单位 TOP5（{latestYearData.year}年）</div>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <div key={item.rank} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-blue-400 w-4">{item.rank}</span>
                      <span className="text-xs text-gray-800 font-medium flex-1 truncate">{item.name}</span>
                      {item.ratio && (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-blue-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(parseFloat(item.ratio)||0,100)}%` }} />
                          </div>
                          <span className="text-[10px] text-blue-500">{item.ratio}%</span>
                        </div>
                      )}
                      {item.amount && <span className="text-[10px] text-gray-400">{item.amount}万</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
          {/* TOP5 供应商单位卡片展示 */}
          {selectedEntityId === 'SupplierEnterprise' && appData.top5Suppliers && appData.top5Suppliers.length > 0 && (() => {
            const sortedYears = [...appData.top5Suppliers].sort((a, b) => b.year - a.year);
            const latestYearData = sortedYears[0];
            const items = latestYearData?.items.filter(it => it.name) ?? [];
            return items.length > 0 ? (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">供应商单位 TOP5（{latestYearData.year}年）</div>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <div key={item.rank} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-[10px] text-green-400 w-4">{item.rank}</span>
                      <span className="text-xs text-gray-800 font-medium flex-1 truncate">{item.name}</span>
                      {item.ratio && (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-green-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(parseFloat(item.ratio)||0,100)}%` }} />
                          </div>
                          <span className="text-[10px] text-green-500">{item.ratio}%</span>
                        </div>
                      )}
                      {item.amount && <span className="text-[10px] text-gray-400">{item.amount}万</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
          {/* 资产负债表：以年份为列头的横向对比表格 */}
          {selectedEntityId === 'BalanceSheet' && appData.financialStatementsByYear && Object.keys(appData.financialStatementsByYear).length > 0 && (() => {
            const fsByYear = appData.financialStatementsByYear!;
            const years = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
            const metrics = [
              { key: 'totalAssets', label: '资产总计(万)' },
              { key: 'totalCurrentAssets', label: '流动资产(万)' },
              { key: 'totalNonCurrentAssets', label: '非流动资产(万)' },
              { key: 'totalLiabilities', label: '负债合计(万)' },
              { key: 'totalCurrentLiabilities', label: '流动负债(万)' },
              { key: 'totalNonCurrentLiabilities', label: '非流动负债(万)' },
              { key: 'totalEquity', label: '所有者权益(万)' },
              { key: 'shortTermLoans', label: '短期借款(万)' },
              { key: 'longTermLoans', label: '长期借款(万)' },
              { key: 'accountsReceivable', label: '应收账款(万)' },
              { key: 'inventory', label: '存货(万)' },
              { key: 'monetaryFunds', label: '货币资金(万)' },
            ];
            // 字段别名映射：LLM可能输出不同的key名称
            const FIELD_ALIASES: Record<string, string[]> = {
              'totalCurrentAssets': ['currentAssets', 'totalCurrentAssets', '流动资产合计'],
              'totalNonCurrentAssets': ['nonCurrentAssets', 'totalNonCurrentAssets', '非流动资产合计'],
              'totalCurrentLiabilities': ['currentLiabilities', 'totalCurrentLiabilities', '流动负债合计'],
              'totalNonCurrentLiabilities': ['nonCurrentLiabilities', 'totalNonCurrentLiabilities', '非流动负债合计'],
              'totalEquity': ['totalEquity', 'ownersEquity', '所有者权益合计'],
            };
            const getVal = (yr: string, key: string) => {
              const fs = fsByYear[yr];
              const src = { ...fs?.balanceSheet } as Record<string, string|null>;
              // 先尝试原始key，再尝试别名
              const aliases = FIELD_ALIASES[key] ?? [key];
              let v: string|null = null;
              for (const alias of aliases) {
                if (src[alias] != null) { v = src[alias]; break; }
              }
              const n = v ? parseFloat(String(v).replace(/,/g,'')) : null;
              return n !== null && !isNaN(n) ? n.toFixed(0) : '--';
            };
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">资产负债表多年横向对比</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-amber-50">
                      <th className="px-2 py-1 text-left text-gray-500 font-medium">科目</th>
                      {years.map(y => {
                const yd2 = fsByYear[y];
                const pLabel2 = yd2?.reportPeriod && yd2.reportPeriod !== y
                  ? `${yd2.reportPeriod}${yd2.periodType === 'monthly' ? '(月)' : yd2.periodType === 'quarterly' ? '(季)' : yd2.periodType === 'interim' ? '(半年)' : ''}`
                  : `${y}年`;
                return <th key={y} className="px-2 py-1 text-right text-gray-500 font-medium">{pLabel2}</th>;
              })}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {metrics.map(m => (
                        <tr key={m.key}>
                          <td className="px-2 py-1 text-gray-600">{m.label}</td>
                          {years.map(y => <td key={y} className="px-2 py-1 text-right text-gray-800">{getVal(y, m.key)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 利润表：以年份为列头的横向对比表格 */}
          {selectedEntityId === 'IncomeStatement' && appData.financialStatementsByYear && Object.keys(appData.financialStatementsByYear).length > 0 && (() => {
            const fsByYear = appData.financialStatementsByYear!;
            const years = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
            const metrics = [
              { key: 'revenue', label: '营业收入(万)' },
              { key: 'costOfRevenue', label: '营业成本(万)' },
              { key: 'grossProfit', label: '毛利润(万)' },
              { key: 'sellingExpenses', label: '销售费用(万)' },
              { key: 'adminExpenses', label: '管理费用(万)' },
              { key: 'rdExpenses', label: '研发费用(万)' },
              { key: 'financialExpenses', label: '财务费用(万)' },
              { key: 'operatingProfit', label: '营业利润(万)' },
              { key: 'netProfit', label: '净利润(万)' },
            ];
            const getVal = (yr: string, key: string) => {
              const fs = fsByYear[yr];
              const src = { ...fs?.incomeStatement } as Record<string, string|null>;
              const v = src[key];
              const n = v ? parseFloat(String(v).replace(/,/g,'')) : null;
              return n !== null && !isNaN(n) ? n.toFixed(0) : '--';
            };
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">利润表多年横向对比</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-amber-50">
                      <th className="px-2 py-1 text-left text-gray-500 font-medium">科目</th>
                      {years.map(y => <th key={y} className="px-2 py-1 text-right text-gray-500 font-medium">{y}年</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {metrics.map(m => (
                        <tr key={m.key}>
                          <td className="px-2 py-1 text-gray-600">{m.label}</td>
                          {years.map(y => <td key={y} className="px-2 py-1 text-right text-gray-800">{getVal(y, m.key)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 现金流量表：以年份为列头的横向对比表格 */}
          {selectedEntityId === 'CashFlowStatement' && appData.financialStatementsByYear && Object.keys(appData.financialStatementsByYear).length > 0 && (() => {
            const fsByYear = appData.financialStatementsByYear!;
            const years = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
            const metrics = [
              { key: 'netOperatingCashFlow', label: '经营活动净现金流(万)' },
              { key: 'operatingCashInflow', label: '经营现金流入(万)' },
              { key: 'operatingCashOutflow', label: '经营现金流出(万)' },
              { key: 'netInvestingCashFlow', label: '投资活动净现金流(万)' },
              { key: 'netFinancingCashFlow', label: '筹资活动净现金流(万)' },
              { key: 'endingCashBalance', label: '期末现金余额(万)' },
            ];
            const getVal = (yr: string, key: string) => {
              const fs = fsByYear[yr];
              const src = { ...fs?.cashFlowStatement } as Record<string, string|null>;
              const v = src[key];
              const n = v ? parseFloat(String(v).replace(/,/g,'')) : null;
              return n !== null && !isNaN(n) ? n.toFixed(0) : '--';
            };
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">现金流量表多年横向对比</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-amber-50">
                      <th className="px-2 py-1 text-left text-gray-500 font-medium">科目</th>
                      {years.map(y => <th key={y} className="px-2 py-1 text-right text-gray-500 font-medium">{y}年</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {metrics.map(m => (
                        <tr key={m.key}>
                          <td className="px-2 py-1 text-gray-600">{m.label}</td>
                          {years.map(y => <td key={y} className="px-2 py-1 text-right text-gray-800">{getVal(y, m.key)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* 增值税申报：以年份为列头的横向对比（从taxData.vatByYear或taxData中提取） */}
          {selectedEntityId === 'VatReturn' && vatReturnData && (() => {
            const vd = vatReturnData;
            const fmtN = (v: unknown, dec = 2) => {
              if (v == null) return '--';
              const n = parseFloat(String(v).replace(/,/g,''));
              return !isNaN(n) ? n.toFixed(dec) : String(v);
            };
            const metrics = [
              { key: 'salesRevenue', label: '销售收入（含税）', unit: '万元' },
              { key: 'taxableRevenue', label: '应税收入（不含税）', unit: '万元' },
              { key: 'outputTax', label: '销项税额', unit: '万元' },
              { key: 'inputTax', label: '进项税额', unit: '万元' },
              { key: 'taxPayable', label: '应纳税额', unit: '万元' },
              { key: 'taxBurdenRate', label: '税负率', unit: '%' },
              { key: 'totalRevenue12M', label: '近12月累计收入', unit: '万元' },
              { key: 'totalTaxPaid', label: '近12月实缴税额', unit: '万元' },
              { key: 'avgMonthlyRevenue', label: '月均收入', unit: '万元' },
              { key: 'taxRate', label: '适用税率', unit: '%' },
            ];
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">
                  增值税申报 · {String(vd.taxPeriod || vd.taxYear || '—')}
                  {vd.hasArrears ? <span className="ml-2 text-red-500 font-medium">⚠ 有欠税</span> : <span className="ml-2 text-green-600">✓ 无欠税</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {metrics.map(m => vd[m.key] != null ? (
                    <div key={m.key} className="flex justify-between text-[10px] py-0.5 border-b border-gray-50">
                      <span className="text-gray-500">{m.label}</span>
                      <span className="text-gray-800 font-medium">{fmtN(vd[m.key])} {m.unit}</span>
                    </div>
                  ) : null)}
                </div>
                {Array.isArray(vd.monthlyRevenues) && vd.monthlyRevenues.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-gray-400 mb-1">月度收入明细（近{vd.monthlyRevenues.length}期）</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead><tr className="bg-red-50">
                          <th className="px-1.5 py-1 text-left text-gray-500">月份</th>
                          <th className="px-1.5 py-1 text-right text-gray-500">收入(万)</th>
                          <th className="px-1.5 py-1 text-right text-gray-500">税额(万)</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {(vd.monthlyRevenues as Array<Record<string,unknown>>).slice(0, 12).map((row, i) => (
                            <tr key={i}>
                              <td className="px-1.5 py-0.5 text-gray-600">{String(row.month || '—')}</td>
                              <td className="px-1.5 py-0.5 text-right text-gray-800">{fmtN(row.revenue)}</td>
                              <td className="px-1.5 py-0.5 text-right text-gray-800">{fmtN(row.taxAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 企业所得税申报：详情展示 */}
          {selectedEntityId === 'CitReturn' && citReturnData && (() => {
            const cd = citReturnData;
            const fmtN = (v: unknown, dec = 2) => {
              if (v == null) return '--';
              const n = parseFloat(String(v).replace(/,/g,''));
              return !isNaN(n) ? n.toFixed(dec) : String(v);
            };
            const metrics = [
              { key: 'totalRevenue', label: '营业总收入', unit: '万元' },
              { key: 'totalCost', label: '成本费用合计', unit: '万元' },
              { key: 'grossProfit', label: '毛利润', unit: '万元' },
              { key: 'netProfit', label: '净利润', unit: '万元' },
              { key: 'taxableIncome', label: '应纳税所得额', unit: '万元' },
              { key: 'taxRate', label: '适用税率', unit: '%' },
              { key: 'taxPayable', label: '应缴税额', unit: '万元' },
              { key: 'incomeTaxPaid', label: '实缴所得税', unit: '万元' },
              { key: 'effectiveTaxRate', label: '实际税率', unit: '%' },
              { key: 'profitMargin', label: '净利润率', unit: '%' },
              { key: 'revenueGrowthRate', label: '收入同比增长', unit: '%' },
            ];
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">
                  企业所得税年报 · {String(cd.taxYear || '—')}
                  {cd.hasArrears ? <span className="ml-2 text-red-500 font-medium">⚠ 有欠税</span> : <span className="ml-2 text-green-600">✓ 无欠税</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {metrics.map(m => cd[m.key] != null ? (
                    <div key={m.key} className="flex justify-between text-[10px] py-0.5 border-b border-gray-50">
                      <span className="text-gray-500">{m.label}</span>
                      <span className={`font-medium ${m.key === 'revenueGrowthRate' ? (parseFloat(String(cd[m.key])) >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-800'}`}>
                        {fmtN(cd[m.key])} {m.unit}
                      </span>
                    </div>
                  ) : null)}
                </div>
              </div>
            );
          })()}

          {/* 财务报表父节点选中时显示多年对比表格 */}
          {selectedEntityId === 'FinancialStatement' && appData.financialStatementsByYear && Object.keys(appData.financialStatementsByYear).length > 0 && (() => {
            const fsByYear = appData.financialStatementsByYear!;
            const years = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
            const keyMetrics = [
              { key: 'revenue', label: '营业收入(万)' },
              { key: 'netProfit', label: '净利润(万)' },
              { key: 'totalAssets', label: '总资产(万)' },
              { key: 'debtRatio', label: '负债率(%)' },
              { key: 'grossMargin', label: '毛利率(%)' },
              { key: 'netOperatingCashFlow', label: '经营CF(万)' },
            ];
            return (
              <div className="mx-4 mt-2 mb-0 flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">三张表关键指标多年对比</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 text-left text-gray-500 font-medium">指标</th>
                        {years.map(y => <th key={y} className="px-2 py-1 text-right text-gray-500 font-medium">{y}年</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {keyMetrics.map(m => (
                        <tr key={m.key}>
                          <td className="px-2 py-1 text-gray-600">{m.label}</td>
                          {years.map(y => {
                            const fs = fsByYear[y];
                            const src = { ...fs?.balanceSheet, ...fs?.incomeStatement, ...fs?.cashFlowStatement } as Record<string, string|null>;
                            const v = src[m.key];
                            const n = v ? parseFloat(String(v).replace(/,/g,'')) : null;
                            return <td key={y} className="px-2 py-1 text-right text-gray-800">{n !== null && !isNaN(n) ? n.toFixed(0) : '--'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          {/* 发票节点：显示发票解析数据 */}
          {selectedEntityId === 'Invoice' && invoiceData && (() => {
            const inv = invoiceData as Record<string, unknown>;
            const fields = Object.entries(inv).filter(([k]) => k !== 'dataSource' && k !== 'raw');
            if (fields.length === 0) return null;
            return (
              <div className="mx-4 mt-2 mb-0 p-3 bg-green-50 rounded-lg flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">应收账款发票解析数据</div>
                {fields.map(([k, v]) => (
                  v != null ? <div key={k} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-800 max-w-[60%] text-right truncate">{String(v)}</span>
                  </div> : null
                ))}
              </div>
            );
          })()}
          {/* 抵押记录节点：显示抵押资料解析数据 */}
          {selectedEntityId === 'MortgageRecord' && (() => {
            const mortgageFile = (uploadedFiles || []).find(f => f.docId === 'mortgage' && f.status === 'done' && f.parsedData);
            if (!mortgageFile?.parsedData) return null;
            const fields = Object.entries(mortgageFile.parsedData as Record<string, unknown>).filter(([k]) => k !== 'dataSource' && k !== 'raw');
            return (
              <div className="mx-4 mt-2 mb-0 p-3 bg-orange-50 rounded-lg flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">抵押资料解析数据</div>
                {fields.map(([k, v]) => (
                  v != null ? <div key={k} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-800 max-w-[60%] text-right truncate">{String(v)}</span>
                  </div> : null
                ))}
              </div>
            );
          })()}
          {/* 法定代表人节点：显示身份证解析数据 */}
          {selectedEntityId === 'LegalRepresentative' && idCardData && (() => {
            const fields = Object.entries(idCardData as Record<string, unknown>).filter(([k]) => k !== 'dataSource' && k !== 'raw');
            if (fields.length === 0) return null;
            return (
              <div className="mx-4 mt-2 mb-0 p-3 bg-purple-50 rounded-lg flex-shrink-0">
                <div className="text-[10px] text-gray-400 mb-1.5">法人身份证解析数据</div>
                {fields.map(([k, v]) => (
                  v != null ? <div key={k} className="flex justify-between text-[10px] py-0.5">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-800 max-w-[60%] text-right truncate">{String(v)}</span>
                  </div> : null
                ))}
              </div>
            );
          })()}
          <div className="divide-y divide-gray-50 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {selectedEntity.properties.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-300">此实体类为抽象基类，无独立属性</div>
            ) : (
              selectedEntity.properties.map(prop => {
                const rawVal = realData[prop.name];
                const hasVal = rawVal !== null && rawVal !== undefined && rawVal !== "" && String(rawVal) !== "null" && String(rawVal) !== "undefined";
                const displayVal = hasVal
                  ? (typeof rawVal === "number"
                      ? (prop.unit === "%" ? `${rawVal.toFixed(2)}%` : rawVal.toLocaleString() + (prop.unit ? ` ${prop.unit}` : ""))
                      : String(rawVal))
                  : "—";
                const isKey = ["revenue", "netProfit", "totalAssets", "creditScore", "debtToAssetRatio", "grossMargin", "netOperatingCashFlow", "recommendedAmount"].includes(prop.name);
                return (
                  <div key={prop.name} className="flex items-start px-4 py-2.5 gap-3 hover:bg-gray-50/50">
                    <div className="w-36 flex-shrink-0">
                      <div className="text-xs text-gray-700 font-medium">{prop.description}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${prop.required ? "bg-orange-400" : "bg-gray-300"}`} />
                        {prop.required ? "必填" : "可选"}
                        {prop.derivedFrom && <span className="text-blue-400 ml-1">衍生</span>}
                      </div>
                    </div>
                    <div className={`flex-1 text-xs ${hasVal ? (isKey ? "font-semibold text-orange-600" : "text-gray-800") : "text-gray-300"}`}>
                      {displayVal}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 九维度分析面板 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const INDICATOR_LABEL_MAP: Record<string, string> = {
  debtRatio: '资产负债率',
  currentRatio: '流动比率',
  quickRatio: '速动比率',
  interestCoverage: '利息保障倍数',
  netProfitMargin: '净利润率',
  roa: '总资产收益率',
  roe: '净资产收益率',
  balanceCoverage: '余额覆盖率',
  minBalanceCoverage: '最低余额覆盖率',
  cashFlowRatio: '现金流比率',
  cashFlowQuality: '现金流质量',
  freeCashFlow: '自由现金流',
  vatRate: '增值税税负率',
  revenueDiff: '收入差异率',
  creditRatio: '授信集中度',
  usageRate: '授信使用率',
  overdueRecord: '逾期记录',
  overdueAmount: '逾期金额',
  otherIndicators: '其他指标',
  dailyAvgBalance: '日均余额',
  monthlyInflow: '月均流入',
  monthlyOutflow: '月均流出',
  netCashFlow: '净现金流',
  loanRepayment: '贷款还款',
  taxPayment: '税款缴纳',
  revenueGrowth: '营收增长率',
  profitGrowth: '利润增长率',
  grossMargin: '毛利率',
  netMargin: '净利润率',
  operatingMargin: '营业利润率',
  assetTurnover: '资产周转率',
  receivablesDays: '应收账款周转天数',
  inventoryDays: '存货周转天数',
};
const DIMENSION_NAMES: Record<number, { name: string; icon: string; color: string; desc: string }> = {
  1: { name: '财务报表静态分析', icon: '📊', color: 'bg-blue-500', desc: '资产负债率、流动比率、速动比率、ROE等12个指标' },
  2: { name: '银行流水动态穿透', icon: '🏦', color: 'bg-green-500', desc: '日均余额、流入流出比、交易频率等11个指标' },
  3: { name: '税务申报交叉验证', icon: '📋', color: 'bg-red-500', desc: '税收收入比、增值税负率、所得税贡献率等4个指标' },
  4: { name: '他行授信与隐性负债', icon: '🏛️', color: 'bg-purple-500', desc: '授信集中度、使用率、隐性负债识别等5个指标' },
  5: { name: '业务板块与收入构成', icon: '📈', color: 'bg-yellow-500', desc: '收入集中度、业务多元化、增长稳定性等6个指标' },
  6: { name: '征信报告与司法涉诉', icon: '⚖️', color: 'bg-orange-500', desc: '逾期记录、诉讼案件、失信被执行等6个指标' },
  7: { name: '关联方与担保圈穿透', icon: '🔗', color: 'bg-pink-500', desc: '关联交易占比、担保链深度、资金占用等5个指标' },
  8: { name: '应收账款与客户质量', icon: '💰', color: 'bg-cyan-500', desc: '应收账款周转率、客户集中度、账龄分布等8个指标' },
  9: { name: '经营现金流与偿债能力', icon: '💵', color: 'bg-teal-500', desc: '经营现金流覆盖率、DSCR、利息保障倍数等8个指标' },
};
const RISK_LEVEL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: '低风险', color: 'text-green-700', bg: 'bg-green-100' },
  medium_low: { label: '中低风险', color: 'text-blue-700', bg: 'bg-blue-100' },
  medium: { label: '中等风险', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  medium_high: { label: '中高风险', color: 'text-orange-700', bg: 'bg-orange-100' },
  high: { label: '高风险', color: 'text-red-700', bg: 'bg-red-100' },
};
const CREDIT_REC_LABELS: Record<string, string> = {
  normal: '正常授信', cautious: '审慎授信', conditional: '有条件授信', restricted: '限制授信', reject: '拒绝授信',
};
const MONITOR_LABELS: Record<string, string> = {
  annual: '年度', semi_annual: '半年度', quarterly: '季度', monthly: '月度', real_time: '实时',
};

export { KnowledgeGraphPanel };
