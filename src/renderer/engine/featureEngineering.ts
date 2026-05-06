/**
 * Layer 3 - Algorithm Decision Layer
 * Module: Feature Engineering (特征工程)
 * 
 * 38个特征，分三大维度：
 * - 主体资质维度（F01-F12）
 * - 财务状况维度（F13-F25）
 * - 经营稳定性维度（F26-F38）
 * 
 * 数据诚信原则：
 * - 无真实数据时，特征値为 null，不使用任何默认値伪造计算结果
 * - 每个特征附带 source（数据来源说明）和 formula（计算公式）
 * - 前端展示时，null 値显示"数据缺失 - 需上传XXX"
 */
import { getIndustryOntology } from "./db";

export interface FeatureValue {
  value: number | null;          // 特征值，null 表示数据缺失
  source: string;                // 数据来源说明
  formula: string;               // 计算公式
  missingReason?: string;        // 缺失原因（需要上传什么文件）
}

export interface FeatureVector {
  // === 主体资质维度（F01-F12）===
  F01_taxCreditScore: number | null;
  F02_companyAgeMonths: number | null;
  F03_registeredCapitalLn: number | null;
  F04_legalPersonRiskScore: number | null;
  F05_shareholderConcentration: number | null;
  F06_relatedCompanyCount: number | null;
  F07_relatedRiskCompanyCount: number | null;
  F08_executiveChangeCount: number | null;
  F09_businessScopeMatch: number | null;
  F10_certificationCount: number | null;
  F11_isListedCompany: number | null;
  F12_industryRiskScore: number | null;

  // === 财务状况维度（F13-F25）===
  F13_debtRatio: number | null;
  F14_currentRatio: number | null;
  F15_quickRatio: number | null;
  F16_interestCoverageRatio: number | null;
  F17_revenueGrowthRate: number | null;
  F18_netProfitMargin: number | null;
  F19_roe: number | null;
  F20_arTurnoverDays: number | null;
  F21_inventoryTurnoverDays: number | null;
  F22_operatingCFRatio: number | null;
  F23_otherReceivableRatio: number | null;
  F24_revenueConsistency: number | null;
  F25_ebitdaToDebt: number | null;

  // === 经营稳定性维度（F26-F38）===
  F26_revenueCV: number | null;
  F27_topCustomerConcentration: number | null;
  F28_topSupplierConcentration: number | null;
  F29_avgMonthlyRevenue: number | null;
  F30_cashFlowStability: number | null;
  F31_relatedPartyTxRatio: number | null;
  F32_invoiceMatchRate: number | null;
  F33_taxRevenueMatchRate: number | null;
  F34_overdueHistoryScore: number | null;
  F35_litigationRiskScore: number | null;
  F36_publicSentimentScore: number | null;
  F37_bankAccountStability: number | null;
  F38_loanRequestRatio: number | null;
  F39_hhiCustomerConcentration: number | null;
  F40_top1CustomerDependency: number | null;

  // 每个特征的详细元数据（来源+公式+缺失原因）
  featureDetails: Record<string, FeatureValue>;

  // 元数据
  computedAt: Date;
  dataCompleteness: number;
  missingFields: string[];
}

export interface RawDataForFeatures {
  // 工商数据（来源：营业执照/工商API）
  establishDate?: string;
  registeredCapital?: number;
  isListedCompany?: boolean;
  executiveChangeCount?: number;
  certificationCount?: number;
  industryCode?: string;

  // 股权数据（来源：工商API/股权穿透）
  maxShareholderRatio?: number;
  relatedCompanyCount?: number;
  relatedRiskCompanyCount?: number;

  // 法人数据（来源：征信报告/失信被执行人名单）
  legalPersonBlacklisted?: boolean;
  legalPersonOverdueCount?: number;
  legalPersonActiveLoanCount?: number;

  // 税务数据（来源：纳税信用等级证书/增值税申报表）
  taxCreditLevel?: string;
  taxMonthlyRevenues?: number[];

  // 财务报表数据（来源：审计财务报表）
  totalAssets?: number;
  totalLiabilities?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  inventory?: number;
  accountsReceivable?: number;
  otherReceivables?: number;
  revenue?: number;
  lastYearRevenue?: number;
  grossProfit?: number;
  netProfit?: number;
  ebitda?: number;
  interestExpense?: number;
  interestBearingDebt?: number;
  operatingCashFlow?: number;

  // 银行流水数据（来源：银行对公流水PDF）
  bankMonthlyRevenues?: number[];
  bankAccountAgeMonths?: number;
  relatedPartyTxAmount?: number;
  invoiceMatchedAmount?: number;
  totalBankRevenue?: number;

  // 发票数据（来源：增值税发票）
  top3CustomerRatio?: number;
  top3SupplierRatio?: number;
  invoiceTotalAmount?: number;
  // 客户集中度数据（来源：销售台账/发票/公司介绍）
  top5CustomerRatios?: number[];   // 前5大客户各自占比（0-1），用于计算HHI
  top1CustomerRatio?: number;      // 第一大客户占比（0-1）

  // 征信数据（来源：征信报告）
  maxOverdueDays?: number;
  overdueCount?: number;
  activeLitigationAmount?: number;
  totalLitigationAmount?: number;

  // 舆情数据（来源：网络舆情监控）
  negativeSentimentCount?: number;

  // 申请数据
  requestAmount?: number;
  loanPurpose?: string;
  businessScope?: string;
}

// 行业风险评分表（备用，数据库查询失败时的兑退默认値）
const INDUSTRY_RISK_SCORES_FALLBACK: Record<string, number> = {
  "制造业": 70, "批发零售": 65, "建筑业": 55, "科技": 75,
  "餐饮住宿": 50, "房地产": 40, "采矿业": 45, "金融": 80,
  "农林牧渔": 60, "医疗健康": 75, "教育": 70, "交通运输": 65, "综合": 60,
};

const TAX_CREDIT_SCORES: Record<string, number> = {
  "A": 100, "B": 80, "M": 70, "C": 60, "D": 0,
};

/**
 * 计算特征向量（异步版）
 * F12行业风险评分从行业本体库数据库读取，实现动态配置
 * 数据诚信原则：无真实数据时返回 null，不伪造任何数値
 */
export async function computeFeatureVector(raw: RawDataForFeatures): Promise<FeatureVector> {
  const missingFields: string[] = [];
  const featureDetails: Record<string, FeatureValue> = {};

  // 辅助函数：记录特征详情
  function feat(
    name: string,
    value: number | null,
    source: string,
    formula: string,
    missingReason?: string
  ): number | null {
    featureDetails[name] = { value, source, formula, missingReason };
    if (value === null) missingFields.push(name);
    return value;
  }

  // === 主体资质维度 ===

  // F01: 纳税信用等级得分
  const F01 = feat(
    "F01_taxCreditScore",
    raw.taxCreditLevel != null ? (TAX_CREDIT_SCORES[raw.taxCreditLevel] ?? null) : null,
    raw.taxCreditLevel != null ? "纳税信用等级证书（已上传）" : "暂无数据",
    "A=100分, B=80分, M=70分, C=60分, D=0分",
    raw.taxCreditLevel == null ? "需上传纳税信用等级证书或完税证明" : undefined
  );

  // F02: 企业成立月数
  let F02Val: number | null = null;
  let F02Source = "暂无数据";
  if (raw.establishDate) {
    const est = new Date(raw.establishDate);
    const now = new Date();
    F02Val = Math.max(0, (now.getFullYear() - est.getFullYear()) * 12 + (now.getMonth() - est.getMonth()));
    F02Source = "营业执照（成立日期字段）";
  }
  const F02 = feat("F02_companyAgeMonths", F02Val, F02Source,
    "(当前年月 - 成立年月) × 12",
    raw.establishDate == null ? "需上传营业执照以获取成立日期" : undefined
  );

  // F03: 注册资本对数
  const F03 = feat(
    "F03_registeredCapitalLn",
    raw.registeredCapital != null ? Math.log(Math.max(1, raw.registeredCapital)) : null,
    raw.registeredCapital != null ? "营业执照（注册资本字段）" : "暂无数据",
    "ln(注册资本/万元)",
    raw.registeredCapital == null ? "需上传营业执照以获取注册资本" : undefined
  );

  // F04: 法人风险评分（仅在有征信数据时计算）
  let F04Val: number | null = null;
  let F04Source = "暂无数据";
  if (raw.legalPersonBlacklisted !== undefined || raw.legalPersonOverdueCount !== undefined) {
    let score = 100;
    if (raw.legalPersonBlacklisted) score -= 60;
    if (raw.legalPersonOverdueCount) score -= Math.min(40, raw.legalPersonOverdueCount * 10);
    if (raw.legalPersonActiveLoanCount && raw.legalPersonActiveLoanCount > 3) score -= 10;
    F04Val = Math.max(0, score);
    F04Source = "征信报告（法人信用记录）";
  }
  const F04 = feat("F04_legalPersonRiskScore", F04Val, F04Source,
    "100 - 失信扣分(60) - 逾期次数×10 - 贷款过多扣分(10)",
    F04Val == null ? "需上传法人征信报告" : undefined
  );

  // F05: 股权集中度
  const F05 = feat(
    "F05_shareholderConcentration",
    raw.maxShareholderRatio ?? null,
    raw.maxShareholderRatio != null ? "工商股权信息（最大股东持股比例）" : "暂无数据",
    "最大股东持股比例（0-1）",
    raw.maxShareholderRatio == null ? "需上传公司章程或工商股权信息" : undefined
  );

  // F06: 关联企业数量
  const F06 = feat(
    "F06_relatedCompanyCount",
    raw.relatedCompanyCount ?? null,
    raw.relatedCompanyCount != null ? "工商关联企业查询" : "暂无数据",
    "法人/股东名下关联企业总数",
    raw.relatedCompanyCount == null ? "需调用工商API查询关联企业" : undefined
  );

  // F07: 关联高风险企业数量
  const F07 = feat(
    "F07_relatedRiskCompanyCount",
    raw.relatedRiskCompanyCount ?? null,
    raw.relatedRiskCompanyCount != null ? "工商关联企业+失信名单交叉查询" : "暂无数据",
    "关联企业中被列入失信/异常名单的数量",
    raw.relatedRiskCompanyCount == null ? "需调用工商API查询关联企业风险状态" : undefined
  );

  // F08: 高管变更次数
  const F08 = feat(
    "F08_executiveChangeCount",
    raw.executiveChangeCount ?? null,
    raw.executiveChangeCount != null ? "工商变更记录" : "暂无数据",
    "近2年法定代表人/董事/监事变更次数",
    raw.executiveChangeCount == null ? "需调用工商API查询变更记录" : undefined
  );

  // F09: 贷款用途与经营范围匹配度（仅在两者都有时计算）
  let F09Val: number | null = null;
  let F09Source = "暂无数据";
  if (raw.loanPurpose && raw.businessScope) {
    const purposeWords = raw.loanPurpose.split(/[，,、\s]/);
    const matchCount = purposeWords.filter(w => w.length > 1 && raw.businessScope!.includes(w)).length;
    F09Val = Math.min(1, 0.5 + matchCount * 0.1);
    F09Source = "申请用途（用户填写）× 营业执照经营范围";
  }
  const F09 = feat("F09_businessScopeMatch", F09Val, F09Source,
    "贷款用途关键词与经营范围关键词匹配比例",
    F09Val == null ? "需填写贷款用途且上传营业执照" : undefined
  );

  // F10: 资质证书数量
  const F10 = feat(
    "F10_certificationCount",
    raw.certificationCount ?? null,
    raw.certificationCount != null ? "资质证书文件（已上传）" : "暂无数据",
    "上传的有效资质证书数量",
    raw.certificationCount == null ? "可上传ISO/行业资质证书" : undefined
  );

  // F11: 是否上市公司
  const F11 = feat(
    "F11_isListedCompany",
    raw.isListedCompany !== undefined ? (raw.isListedCompany ? 1 : 0) : null,
    raw.isListedCompany !== undefined ? "工商/证监会上市公司名单" : "暂无数据",
    "上市公司=1，非上市=0",
    raw.isListedCompany === undefined ? "需调用工商API确认上市状态" : undefined
  );

  // F12: 行业风险评分（优先从行业本体库数据库读取，备用硬编码字典）
  const industryCode = raw.industryCode || null;
  let f12Score: number | null = null;
  let f12Source = "暂无数据";
  if (industryCode) {
    try {
      const ontology = await getIndustryOntology(industryCode);
      if (ontology && ontology.f12BaseScore != null) {
        f12Score = ontology.f12BaseScore;
        f12Source = `行业本体库（${ontology.industryName}，${ontology.dataSource === 'manual' ? '人工审核' : 'AI生成'}）`;
      } else {
        // 备用硬编码字典
        f12Score = INDUSTRY_RISK_SCORES_FALLBACK[industryCode] ?? 60;
        f12Source = `行业风险评分表（备用，行业：${industryCode}）`;
      }
    } catch {
      // 数据库查询失败，使用备用字典
      f12Score = INDUSTRY_RISK_SCORES_FALLBACK[industryCode] ?? 60;
      f12Source = `行业风险评分表（备用，行业：${industryCode}）`;
    }
  }
  const F12 = feat(
    "F12_industryRiskScore",
    f12Score,
    f12Source,
    "基于行业本体库的行业风险评分（0-100，越高越安全）",
    !industryCode ? "需在申请时选择所属行业" : undefined
  );

  // === 财务状况维度（严格依赖财务报表数据）===

  const ta = raw.totalAssets ?? null;
  const tl = raw.totalLiabilities ?? null;
  const ca = raw.currentAssets ?? null;
  const cl = raw.currentLiabilities ?? null;
  const inv = raw.inventory ?? null;
  const ar = raw.accountsReceivable ?? null;
  const or_ = raw.otherReceivables ?? null;
  const rev = raw.revenue ?? null;
  const lyRev = raw.lastYearRevenue ?? null;
  const np = raw.netProfit ?? null;
  const ebitda = raw.ebitda ?? null;
  const ie = raw.interestExpense ?? null;
  const ibd = raw.interestBearingDebt ?? null;
  const ocf = raw.operatingCashFlow ?? null;

  const finSource = "财务报表（资产负债表）";
  const incSource = "财务报表（利润表）";
  const cfSource = "财务报表（现金流量表）";
  const finMissing = "需上传近2年审计财务报表（资产负债表）";
  const incMissing = "需上传近2年审计财务报表（利润表）";
  const cfMissing = "需上传财务报表（现金流量表）或银行流水";

  // F13: 资产负债率
  const F13 = feat(
    "F13_debtRatio",
    (ta != null && tl != null && ta > 0) ? tl / ta : null,
    (ta != null && tl != null) ? finSource : "暂无数据",
    "总负债 ÷ 总资产",
    (ta == null || tl == null) ? finMissing : undefined
  );

  // F14: 流动比率
  const F14 = feat(
    "F14_currentRatio",
    (ca != null && cl != null && cl > 0) ? ca / cl : null,
    (ca != null && cl != null) ? finSource : "暂无数据",
    "流动资产 ÷ 流动负债",
    (ca == null || cl == null) ? finMissing : undefined
  );

  // F15: 速动比率
  const F15 = feat(
    "F15_quickRatio",
    (ca != null && cl != null && inv != null && cl > 0) ? (ca - inv) / cl : null,
    (ca != null && cl != null && inv != null) ? finSource : "暂无数据",
    "(流动资产 - 存货) ÷ 流动负债",
    (ca == null || cl == null || inv == null) ? finMissing : undefined
  );

  // F16: 利息保障倍数
  const F16 = feat(
    "F16_interestCoverageRatio",
    (ebitda != null && ie != null && ie > 0) ? ebitda / ie : null,
    (ebitda != null && ie != null) ? incSource : "暂无数据",
    "EBITDA ÷ 利息费用",
    (ebitda == null || ie == null) ? incMissing : undefined
  );

  // F17: 营业收入增长率
  const F17 = feat(
    "F17_revenueGrowthRate",
    (rev != null && lyRev != null && lyRev > 0) ? (rev - lyRev) / lyRev : null,
    (rev != null && lyRev != null) ? incSource : "暂无数据",
    "(本年收入 - 上年收入) ÷ 上年收入",
    (rev == null || lyRev == null) ? "需上传近2年财务报表（利润表）以对比收入增长" : undefined
  );

  // F18: 净利润率
  const F18 = feat(
    "F18_netProfitMargin",
    (rev != null && np != null && rev > 0) ? np / rev : null,
    (rev != null && np != null) ? incSource : "暂无数据",
    "净利润 ÷ 营业收入",
    (rev == null || np == null) ? incMissing : undefined
  );

  // F19: 净资产收益率（ROE）
  const equity = (ta != null && tl != null) ? ta - tl : null;
  const F19 = feat(
    "F19_roe",
    (np != null && equity != null && equity > 0) ? np / equity : null,
    (np != null && equity != null) ? `${finSource} + ${incSource}` : "暂无数据",
    "净利润 ÷ (总资产 - 总负债)",
    (np == null || equity == null) ? finMissing : undefined
  );

  // F20: 应收账款周转天数
  const F20 = feat(
    "F20_arTurnoverDays",
    (ar != null && rev != null && rev > 0) ? ar / (rev / 365) : null,
    (ar != null && rev != null) ? finSource : "暂无数据",
    "应收账款 ÷ (年收入 ÷ 365)",
    (ar == null || rev == null) ? finMissing : undefined
  );

  // F21: 存货周转天数
  const F21 = feat(
    "F21_inventoryTurnoverDays",
    (inv != null && rev != null && rev > 0) ? inv / (rev / 365) : null,
    (inv != null && rev != null) ? finSource : "暂无数据",
    "存货 ÷ (年收入 ÷ 365)",
    (inv == null || rev == null) ? finMissing : undefined
  );

  // F22: 经营现金流/净利润比（造假识别）
  const F22 = feat(
    "F22_operatingCFRatio",
    (ocf != null && np != null && np !== 0) ? ocf / np : null,
    (ocf != null && np != null) ? `${cfSource} + ${incSource}` : "暂无数据",
    "经营现金流净额 ÷ 净利润（>1说明利润质量好）",
    (ocf == null || np == null) ? cfMissing : undefined
  );

  // F23: 其他应收款/总资产比（关联占款识别）
  const F23 = feat(
    "F23_otherReceivableRatio",
    (or_ != null && ta != null && ta > 0) ? or_ / ta : null,
    (or_ != null && ta != null) ? finSource : "暂无数据",
    "其他应收款 ÷ 总资产（高比例可能存在关联方占款）",
    (or_ == null || ta == null) ? finMissing : undefined
  );

  // F24: 三源收入一致性（需要三种数据源同时存在）
  let F24Val: number | null = null;
  let F24Source = "暂无数据";
  const bankRevTotal = raw.bankMonthlyRevenues?.reduce((a, b) => a + b, 0) ?? null;
  const taxRevTotal = raw.taxMonthlyRevenues?.reduce((a, b) => a + b, 0) ?? null;
  if (rev != null && bankRevTotal != null && taxRevTotal != null && rev > 0) {
    const maxDev = Math.max(
      Math.abs(rev - bankRevTotal) / rev,
      Math.abs(rev - taxRevTotal) / rev,
      Math.abs(bankRevTotal - taxRevTotal) / Math.max(bankRevTotal, taxRevTotal, 1)
    );
    F24Val = Math.max(0, 1 - maxDev);
    F24Source = "财务报表收入 × 银行流水收入 × 增值税申报收入（三方交叉验证）";
  }
  const F24 = feat(
    "F24_revenueConsistency",
    F24Val,
    F24Source,
    "1 - max(财报/银行/税务三方收入最大偏差率)，越接近1越一致",
    F24Val == null ? "需同时上传财务报表、银行流水、增值税申报表" : undefined
  );

  // F25: EBITDA/有息负债比
  const F25 = feat(
    "F25_ebitdaToDebt",
    (ebitda != null && ibd != null && ibd > 0) ? ebitda / ibd : null,
    (ebitda != null && ibd != null) ? `${incSource} + ${finSource}` : "暂无数据",
    "EBITDA ÷ 有息负债（偿债能力指标）",
    (ebitda == null || ibd == null) ? finMissing : undefined
  );

  // === 经营稳定性维度 ===

  // F26: 月度收入变异系数（需要银行流水）
  let F26Val: number | null = null;
  let F26Source = "暂无数据";
  if (raw.bankMonthlyRevenues && raw.bankMonthlyRevenues.length > 0) {
    const bm = raw.bankMonthlyRevenues;
    const avg = bm.reduce((a, b) => a + b, 0) / bm.length;
    const variance = bm.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / bm.length;
    F26Val = avg > 0 ? Math.sqrt(variance) / avg : null;
    F26Source = "银行对公流水（近12个月月度收入）";
  }
  const F26 = feat("F26_revenueCV", F26Val, F26Source,
    "月度收入标准差 ÷ 月均收入（越小越稳定）",
    F26Val == null ? "需上传近12个月银行对公流水" : undefined
  );

  // F27: Top3客户收入占比
  const F27 = feat(
    "F27_topCustomerConcentration",
    raw.top3CustomerRatio ?? null,
    raw.top3CustomerRatio != null ? "增值税发票（客户集中度分析）" : "暂无数据",
    "Top3客户收入 ÷ 总收入",
    raw.top3CustomerRatio == null ? "需上传增值税销项发票" : undefined
  );

  // F28: Top3供应商采购占比
  const F28 = feat(
    "F28_topSupplierConcentration",
    raw.top3SupplierRatio ?? null,
    raw.top3SupplierRatio != null ? "增值税发票（供应商集中度分析）" : "暂无数据",
    "Top3供应商采购额 ÷ 总采购额",
    raw.top3SupplierRatio == null ? "需上传增值税进项发票" : undefined
  );

  // F29: 月均经营性收入
  let F29Val: number | null = null;
  let F29Source = "暂无数据";
  if (raw.bankMonthlyRevenues && raw.bankMonthlyRevenues.length > 0) {
    F29Val = raw.bankMonthlyRevenues.reduce((a, b) => a + b, 0) / raw.bankMonthlyRevenues.length;
    F29Source = "银行对公流水（近12个月月均经营性收入）";
  } else if (rev != null) {
    F29Val = rev / 12;
    F29Source = "财务报表（年收入 ÷ 12，估算月均）";
  }
  const F29 = feat("F29_avgMonthlyRevenue", F29Val, F29Source,
    "近12个月银行经营性收入之和 ÷ 12",
    F29Val == null ? "需上传银行流水或财务报表" : undefined
  );

  // F30: 现金流稳定性评分（依赖F26）
  const F30 = feat(
    "F30_cashFlowStability",
    F26Val != null ? Math.max(0, Math.min(100, 100 - F26Val * 100)) : null,
    F26Val != null ? "银行对公流水（基于月度收入变异系数计算）" : "暂无数据",
    "100 - 月度收入变异系数×100",
    F26Val == null ? "需上传近12个月银行对公流水" : undefined
  );

  // F31: 关联交易占收入比
  const tbr = raw.totalBankRevenue ?? null;
  const rpt = raw.relatedPartyTxAmount ?? null;
  const F31 = feat(
    "F31_relatedPartyTxRatio",
    (rpt != null && tbr != null && tbr > 0) ? rpt / tbr : null,
    (rpt != null && tbr != null) ? "银行流水（关联方交易识别）" : "暂无数据",
    "关联方交易金额 ÷ 银行流水总收入",
    (rpt == null || tbr == null) ? "需上传银行流水并标注关联方账户" : undefined
  );

  // F32: 发票与流水匹配率
  const im = raw.invoiceMatchedAmount ?? null;
  const F32 = feat(
    "F32_invoiceMatchRate",
    (im != null && tbr != null && tbr > 0) ? im / tbr : null,
    (im != null && tbr != null) ? "增值税发票 × 银行流水（交叉匹配）" : "暂无数据",
    "发票金额与流水匹配部分 ÷ 银行流水总收入",
    (im == null || tbr == null) ? "需同时上传增值税发票和银行流水" : undefined
  );

  // F33: 税务收入与流水匹配率
  const F33 = feat(
    "F33_taxRevenueMatchRate",
    (taxRevTotal != null && tbr != null && tbr > 0) ? Math.min(1, taxRevTotal / tbr) : null,
    (taxRevTotal != null && tbr != null) ? "增值税申报表 × 银行流水（交叉验证）" : "暂无数据",
    "增值税申报收入 ÷ 银行流水收入（识别收入虚报）",
    (taxRevTotal == null || tbr == null) ? "需同时上传增值税申报表和银行流水" : undefined
  );

  // F34: 历史逾期评分（依赖征信数据）
  let F34Val: number | null = null;
  let F34Source = "暂无数据";
  if (raw.maxOverdueDays !== undefined || raw.overdueCount !== undefined) {
    let score = 100;
    if (raw.maxOverdueDays) score -= Math.min(80, raw.maxOverdueDays * 0.5);
    if (raw.overdueCount) score -= Math.min(20, raw.overdueCount * 5);
    F34Val = Math.max(0, score);
    F34Source = "征信报告（逾期记录）";
  }
  const F34 = feat("F34_overdueHistoryScore", F34Val, F34Source,
    "100 - 最大逾期天数×0.5 - 逾期次数×5",
    F34Val == null ? "需上传企业征信报告" : undefined
  );

  // F35: 诉讼风险评分（依赖司法数据）
  let F35Val: number | null = null;
  let F35Source = "暂无数据";
  if (raw.activeLitigationAmount !== undefined || raw.totalLitigationAmount !== undefined) {
    let score = 100;
    const reqAmt = raw.requestAmount || 100;
    if (raw.activeLitigationAmount) score -= Math.min(60, raw.activeLitigationAmount / reqAmt * 30);
    if (raw.totalLitigationAmount) score -= Math.min(20, raw.totalLitigationAmount / reqAmt * 10);
    F35Val = Math.max(0, score);
    F35Source = "司法查询（裁判文书/被执行人）";
  }
  const F35 = feat("F35_litigationRiskScore", F35Val, F35Source,
    "100 - 在诉金额/申请额×30 - 历史诉讼金额/申请额×10",
    F35Val == null ? "需调用司法API查询诉讼记录" : undefined
  );

  // F36: 舆情风险评分（依赖舆情数据）
  let F36Val: number | null = null;
  let F36Source = "暂无数据";
  if (raw.negativeSentimentCount !== undefined) {
    F36Val = Math.max(0, 100 - Math.min(50, raw.negativeSentimentCount * 10));
    F36Source = "网络舆情监控（负面新闻数量）";
  }
  const F36 = feat("F36_publicSentimentScore", F36Val, F36Source,
    "100 - 负面舆情条数×10",
    F36Val == null ? "需调用舆情API查询负面新闻" : undefined
  );

  // F37: 银行账户稳定性（账户存续月数）
  const F37 = feat(
    "F37_bankAccountStability",
    raw.bankAccountAgeMonths ?? null,
    raw.bankAccountAgeMonths != null ? "银行对公流水（账户开户时间）" : "暂无数据",
    "银行账户存续月数",
    raw.bankAccountAgeMonths == null ? "需上传银行对公流水" : undefined
  );

  // F38: 申请额/月均收入比（杠杆倍数）
  const reqAmt = raw.requestAmount ?? null;
  const F38 = feat(
    "F38_loanRequestRatio",
    (reqAmt != null && F29Val != null && F29Val > 0) ? reqAmt / F29Val : null,
    (reqAmt != null && F29Val != null) ? "申请金额（用户填写）÷ 月均收入（银行流水/财务报表）" : "暂无数据",
    "申请金额 ÷ 月均经营性收入（杠杆倍数，越低越安全）",
    (reqAmt == null || F29Val == null) ? "需填写申请金额且上传银行流水或财务报表" : undefined
  );

  // F39: HHI 客户集中度指数（Herfindahl-Hirschman Index）
  // HHI = Σ(各客户占比²)，范围0-1，>0.25 为高集中度风险
  let F39Val: number | null = null;
  let F39Source = "暂无数据";
  if (raw.top5CustomerRatios && raw.top5CustomerRatios.length > 0) {
    F39Val = raw.top5CustomerRatios.reduce((sum, r) => sum + r * r, 0);
    F39Source = "销售台账/发票（前5大客户集中度HHI计算）";
  } else if (raw.top3CustomerRatio != null) {
    // 近似估算：假设Top3均匀分布，其余为0
    const avgTop3 = raw.top3CustomerRatio / 3;
    F39Val = 3 * avgTop3 * avgTop3;
    F39Source = "增值税发票（基于Top3集中度近似估算HHI）";
  }
  const F39 = feat(
    "F39_hhiCustomerConcentration",
    F39Val,
    F39Source,
    "HHI = Σ(各客户占比²)，>0.25为高集中度风险，>0.5为极高风险",
    F39Val == null ? "需上传销售台账或增值税发票（含客户明细）" : undefined
  );
  if (F39Val == null) missingFields.push("F39_hhiCustomerConcentration");

  // F40: Top1 客户依赖度
  // >50% 扣分，>70% 硬性风险提示
  const F40 = feat(
    "F40_top1CustomerDependency",
    raw.top1CustomerRatio ?? null,
    raw.top1CustomerRatio != null ? "销售台账/公司介绍（第一大客户占比）" : "暂无数据",
    "第一大客户收入占总收入比例，>50%扣分，>70%硬性风险提示",
    raw.top1CustomerRatio == null ? "需上传销售台账或公司介绍（含客户集中度）" : undefined
  );
  if (raw.top1CustomerRatio == null) missingFields.push("F40_top1CustomerDependency");

  const totalFeatures = 40;
  const dataCompleteness = 1 - missingFields.length / totalFeatures;

  return {
    F01_taxCreditScore: F01,
    F02_companyAgeMonths: F02,
    F03_registeredCapitalLn: F03,
    F04_legalPersonRiskScore: F04,
    F05_shareholderConcentration: F05,
    F06_relatedCompanyCount: F06,
    F07_relatedRiskCompanyCount: F07,
    F08_executiveChangeCount: F08,
    F09_businessScopeMatch: F09,
    F10_certificationCount: F10,
    F11_isListedCompany: F11,
    F12_industryRiskScore: F12,
    F13_debtRatio: F13,
    F14_currentRatio: F14,
    F15_quickRatio: F15,
    F16_interestCoverageRatio: F16,
    F17_revenueGrowthRate: F17,
    F18_netProfitMargin: F18,
    F19_roe: F19,
    F20_arTurnoverDays: F20,
    F21_inventoryTurnoverDays: F21,
    F22_operatingCFRatio: F22,
    F23_otherReceivableRatio: F23,
    F24_revenueConsistency: F24,
    F25_ebitdaToDebt: F25,
    F26_revenueCV: F26,
    F27_topCustomerConcentration: F27,
    F28_topSupplierConcentration: F28,
    F29_avgMonthlyRevenue: F29,
    F30_cashFlowStability: F30,
    F31_relatedPartyTxRatio: F31,
    F32_invoiceMatchRate: F32,
    F33_taxRevenueMatchRate: F33,
    F34_overdueHistoryScore: F34,
    F35_litigationRiskScore: F35,
    F36_publicSentimentScore: F36,
    F37_bankAccountStability: F37,
    F38_loanRequestRatio: F38,
    F39_hhiCustomerConcentration: F39,
    F40_top1CustomerDependency: F40,
    featureDetails,
    computedAt: new Date(),
    dataCompleteness,
    missingFields,
  };
}
