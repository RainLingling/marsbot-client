/**
 * Layer 3 - Algorithm Decision Layer
 * Module: Hard Rule Engine (硬性准入规则引擎)
 * 
 * 8条一票否决规则，任意一条触发则直接拒件
 */

export interface RuleCheckResult {
  passed: boolean;
  triggeredRules: TriggeredRule[];
  checkTime: Date;
  summary: string;
}

export interface TriggeredRule {
  ruleId: string;
  ruleName: string;
  ruleDesc: string;
  severity: "FATAL" | "WARNING";
  triggeredValue: string;
  threshold: string;
}

export interface CounterpartyInfo {
  name?: string;                        // 甲方企业名称
  creditCode?: string;                  // 统一社会信用代码
  paymentTermDays?: number;             // 历史合作账期（天）
  paymentMethod?: string;               // 付款方式
  contractAmount?: number;              // 合同金额（万元）
  arConcentrationRatio?: number;        // 单一甲方应收账款占比（0-1）
  contractSignDate?: string;            // 合同签订日期（YYYY-MM-DD）
  factoringApplyDate?: string;          // 申请保理日期（YYYY-MM-DD）
  invoiceAmount?: number;               // 发票金额（万元）
  historicalRepaymentAmount?: number;   // 银行流水历史回款金额（万元）
  hasOverdueHistory?: boolean;          // 是否有逾期记录
  overdueDays?: number;                 // 最大逾期天数
}

export interface RuleInputData {
  // 企业基本信息
  companyName: string;
  uscc: string;
  establishDate?: string;
  registeredCapital?: number; // 万元

  // 甲方（债务人）信息 — 保理/供应链融资专用
  counterparty?: CounterpartyInfo;

  // 征信数据
  isBlacklisted?: boolean;          // 失信被执行人
  creditLevel?: string;             // 征信等级
  activeLoanCount?: number;         // 当前贷款笔数
  totalLoanBalance?: number;        // 贷款余额（万元）
  overdueCount?: number;            // 逾期次数（近2年）
  maxOverdueDays?: number;          // 最大逾期天数

  // 税务数据
  taxCreditLevel?: string;          // 纳税信用等级 A/B/C/D/M

  // 财务数据
  debtRatio?: number;               // 资产负债率（0-1）
  relatedPartyTransactionRatio?: number; // 关联交易占收入比（0-1）
  netProfit?: number;               // 净利润（万元）

  // 司法数据
  hasActiveLitigation?: boolean;    // 是否有未结诉讼
  litigationAmount?: number;        // 诉讼金额（万元）
  hasAdminPenalty?: boolean;        // 是否有行政处罚（近2年）

  // 申请信息
  requestAmount?: number;           // 申请金额（万元）
  loanPurpose?: string;             // 贷款用途
}

/**
 * 硬性准入规则（8条一票否决 + 3条保理专项预警）
 */
const HARD_RULES = [
  {
    id: "HR001",
    name: "失信被执行人",
    desc: "企业或实控人在失信被执行人名单中",
    check: (d: RuleInputData) => d.isBlacklisted === true,
    threshold: "不在失信名单",
    getTriggeredValue: (d: RuleInputData) => d.isBlacklisted ? "已列入失信名单" : "正常",
  },
  {
    id: "HR002",
    name: "企业成立年限不足",
    desc: "企业成立不足1年，经营历史过短",
    check: (d: RuleInputData) => {
      if (!d.establishDate) return false;
      const established = new Date(d.establishDate);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - established.getFullYear()) * 12 +
        (now.getMonth() - established.getMonth());
      return monthsDiff < 12;
    },
    threshold: "成立满12个月",
    getTriggeredValue: (d: RuleInputData) => {
      if (!d.establishDate) return "未知";
      const established = new Date(d.establishDate);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - established.getFullYear()) * 12 +
        (now.getMonth() - established.getMonth());
      return `成立${monthsDiff}个月`;
    },
  },
  {
    id: "HR003",
    name: "纳税信用等级D级",
    desc: "纳税信用等级为D级，税务合规风险极高",
    check: (d: RuleInputData) => d.taxCreditLevel === "D",
    threshold: "纳税信用等级≥C",
    getTriggeredValue: (d: RuleInputData) => `纳税信用等级：${d.taxCreditLevel || "未知"}`,
  },
  {
    id: "HR004",
    name: "资产负债率超限",
    desc: "资产负债率超过85%，偿债能力严重不足",
    check: (d: RuleInputData) => d.debtRatio !== undefined && d.debtRatio > 0.85,
    threshold: "资产负债率≤85%",
    getTriggeredValue: (d: RuleInputData) => `资产负债率：${d.debtRatio !== undefined ? (d.debtRatio * 100).toFixed(1) + "%" : "未知"}`,
  },
  {
    id: "HR005",
    name: "关联交易占比超限",
    desc: "关联交易占收入比超过50%，独立经营能力存疑",
    check: (d: RuleInputData) => d.relatedPartyTransactionRatio !== undefined && d.relatedPartyTransactionRatio > 0.5,
    threshold: "关联交易占比≤50%",
    getTriggeredValue: (d: RuleInputData) => `关联交易占比：${d.relatedPartyTransactionRatio !== undefined ? (d.relatedPartyTransactionRatio * 100).toFixed(1) + "%" : "未知"}`,
  },
  {
    id: "HR006",
    name: "近2年严重逾期",
    desc: "近2年内有逾期90天以上记录",
    check: (d: RuleInputData) => d.maxOverdueDays !== undefined && d.maxOverdueDays >= 90,
    threshold: "近2年无逾期90天以上记录",
    getTriggeredValue: (d: RuleInputData) => `最大逾期天数：${d.maxOverdueDays !== undefined ? d.maxOverdueDays + "天" : "未知"}`,
  },
  {
    id: "HR007",
    name: "重大未结诉讼",
    desc: "存在金额超过申请额50%的未结诉讼",
    check: (d: RuleInputData) => {
      if (!d.hasActiveLitigation || !d.litigationAmount || !d.requestAmount) return false;
      return d.litigationAmount > d.requestAmount * 0.5;
    },
    threshold: "未结诉讼金额≤申请额50%",
    getTriggeredValue: (d: RuleInputData) => `未结诉讼金额：${d.litigationAmount || 0}万元，申请额：${d.requestAmount || 0}万元`,
  },
  {
    id: "HR008",
    name: "连续亏损",
    desc: "近2年连续亏损，持续经营能力存疑",
    check: (d: RuleInputData) => d.netProfit !== undefined && d.netProfit < 0,
    threshold: "近期净利润≥0",
    getTriggeredValue: (d: RuleInputData) => `净利润：${d.netProfit !== undefined ? d.netProfit + "万元" : "未知"}`,
  },
  // ─── 保理专项规则（WARNING 级别，不一票否决，但影响评分和授信） ───
  {
    id: "R-FACT-01",
    name: "甲方集中度过高",
    desc: "单一甲方应收账款占比超过60%，集中度风险高，甲方违约将导致全面损失",
    check: (d: RuleInputData) => {
      const ratio = d.counterparty?.arConcentrationRatio;
      return ratio !== undefined && ratio > 0.6;
    },
    threshold: "单一甲方应收账款占比≤60%",
    getTriggeredValue: (d: RuleInputData) => {
      const ratio = d.counterparty?.arConcentrationRatio;
      return ratio !== undefined ? `甲方集中度：${(ratio * 100).toFixed(1)}%（甲方：${d.counterparty?.name || "未知"}）` : "未知";
    },
  },
  {
    id: "R-FACT-02",
    name: "保理申请间隔过短",
    desc: "合同签订到申请保理间隔不足7天，疑似虚假贸易背景或刻意规避审查",
    check: (d: RuleInputData) => {
      const signDate = d.counterparty?.contractSignDate;
      const applyDate = d.counterparty?.factoringApplyDate;
      if (!signDate || !applyDate) return false;
      const sign = new Date(signDate);
      const apply = new Date(applyDate);
      const diffDays = (apply.getTime() - sign.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 7;
    },
    threshold: "合同签订到申请保理间隔≥7天",
    getTriggeredValue: (d: RuleInputData) => {
      const signDate = d.counterparty?.contractSignDate;
      const applyDate = d.counterparty?.factoringApplyDate;
      if (!signDate || !applyDate) return "未知";
      const sign = new Date(signDate);
      const apply = new Date(applyDate);
      const diffDays = Math.round((apply.getTime() - sign.getTime()) / (1000 * 60 * 60 * 24));
      return `合同签订：${signDate}，申请保理：${applyDate}，间隔：${diffDays}天`;
    },
  },
  {
    id: "R-FACT-03",
    name: "发票与回款金额偏差过大",
    desc: "发票金额与银行流水历史回款金额偏差超过20%，交易真实性存疑",
    check: (d: RuleInputData) => {
      const invoice = d.counterparty?.invoiceAmount;
      const repayment = d.counterparty?.historicalRepaymentAmount;
      if (!invoice || !repayment || invoice === 0) return false;
      const deviation = Math.abs(invoice - repayment) / invoice;
      return deviation > 0.2;
    },
    threshold: "发票金额与历史回款偏差≤20%",
    getTriggeredValue: (d: RuleInputData) => {
      const invoice = d.counterparty?.invoiceAmount;
      const repayment = d.counterparty?.historicalRepaymentAmount;
      if (!invoice || !repayment) return "未知";
      const deviation = Math.abs(invoice - repayment) / invoice;
      return `发票金额：${invoice}万元，历史回款：${repayment}万元，偏差：${(deviation * 100).toFixed(1)}%`;
    },
  },
];

/**
 * 执行硬性准入规则检查
 */
export function runHardRuleEngine(input: RuleInputData): RuleCheckResult {
  const triggeredRules: TriggeredRule[] = [];

  for (const rule of HARD_RULES) {
    if (rule.check(input)) {
      // R-FACT-* 规则为 WARNING 级别，其余为 FATAL
      const severity: "FATAL" | "WARNING" = rule.id.startsWith("R-FACT-") ? "WARNING" : "FATAL";
      triggeredRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleDesc: rule.desc,
        severity,
        triggeredValue: rule.getTriggeredValue(input),
        threshold: rule.threshold,
      });
    }
  }

  // 保理专项规则（R-FACT-*）为 WARNING 级别，不影响 passed
  const fatalRules = triggeredRules.filter(r => r.severity === "FATAL");
  const passed = fatalRules.length === 0;
  const summary = passed
    ? triggeredRules.length > 0
      ? `硬性准入规则通过，但触发${triggeredRules.length}条保理预警：${triggeredRules.map(r => r.ruleName).join("、")}`
      : `硬性准入规则全部通过（共${HARD_RULES.length}条规则）`
    : `触发${fatalRules.length}条一票否决规则：${fatalRules.map(r => r.ruleName).join("、")}${triggeredRules.length > fatalRules.length ? `；另触发${triggeredRules.length - fatalRules.length}条保理预警` : ""}`;

  return {
    passed,
    triggeredRules,
    checkTime: new Date(),
    summary,
  };
}

/**
 * 将LLM返回的分析数据转换为规则引擎输入格式
 */
export function mapLLMDataToRuleInput(llmData: Record<string, unknown>, requestAmount: number): RuleInputData {
  const rawData = llmData as Record<string, unknown>;
  return {
    companyName: String(rawData.companyName || ""),
    uscc: String(rawData.uscc || ""),
    establishDate: rawData.establishDate as string | undefined,
    registeredCapital: rawData.registeredCapital as number | undefined,
    isBlacklisted: rawData.isBlacklisted as boolean | undefined,
    taxCreditLevel: rawData.taxCreditLevel as string | undefined,
    debtRatio: rawData.debtRatio as number | undefined,
    relatedPartyTransactionRatio: rawData.relatedPartyTransactionRatio as number | undefined,
    netProfit: rawData.netProfit as number | undefined,
    maxOverdueDays: rawData.maxOverdueDays as number | undefined,
    hasActiveLitigation: rawData.hasActiveLitigation as boolean | undefined,
    litigationAmount: rawData.litigationAmount as number | undefined,
    hasAdminPenalty: rawData.hasAdminPenalty as boolean | undefined,
    counterparty: rawData.counterparty as CounterpartyInfo | undefined,
    requestAmount,
  };
}
