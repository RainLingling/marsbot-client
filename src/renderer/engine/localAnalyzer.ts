/**
 * Marsbot Client - Local Analysis Engine
 * 整合 Layer1-4 的本地离线分析引擎
 * 替代云端 tRPC 调用，在渲染进程中直接运行
 */
import { computeFeatureVector, type RawDataForFeatures } from "./featureEngineering";
import { runHardRuleEngine, type RuleInputData } from "./hardRuleEngine";
import { runDynamicRuleEngine } from "./ruleUpdater";
import { computeScorecardResult } from "./scoringCard";
import { calculateCreditLimit, type LimitInputData } from "./limitCalculator";
import { type CreditGrade } from "./scoringCard";
import { writeAppDataToGraph, writeAnalysisResultToGraph } from "./graphDb";

// ─── 输入类型 ─────────────────────────────────────────────────────────────────
export interface LocalAnalyzeInput {
  recordId?: string;
  companyName: string;
  amount?: string;
  loanType?: string;
  industry?: string;
  period?: string;
  purpose?: string;
  creditCode?: string;
  legalPerson?: string;
  registeredCapital?: string;
  establishDate?: string;
  address?: string;
  financialReport?: {
    revenue?: string;
    netProfit?: string;
    totalAssets?: string;
    totalLiabilities?: string;
    operatingCashFlow?: string;
    currentRatio?: string;
    quickRatio?: string;
    roe?: string;
    summary?: string;
  };
  bankData?: Record<string, unknown>;
  taxData?: Record<string, unknown>;
  bankFlowSummary?: Record<string, unknown>;
  financialStatements?: Record<string, unknown>;
  financialStatementsByYear?: Record<string, unknown>;
  counterpartyInfo?: Record<string, unknown>;
  top5Customers?: unknown[];
  top5Suppliers?: unknown[];
  uploadedFilesList?: unknown[];
  uploadedDocsMap?: Record<string, unknown>;
  chatMessages?: { role: string; content: string }[];
}

// ─── 输出类型 ─────────────────────────────────────────────────────────────────
export interface LocalAnalyzeResult {
  applicationId: string;
  verdict: "approved" | "reduced" | "rejected";
  score: number;
  report: AnalysisReport;
}

export interface AnalysisReport {
  companyName: string;
  applicationId: string;
  analysisTime: string;
  layer1?: Record<string, unknown>;
  layer2?: Record<string, unknown>;
  layer3?: {
    ruleEngine?: {
      passed: boolean;
      triggeredRules?: { ruleId: string; ruleName: string; ruleDesc: string; severity: string; triggeredValue: string }[];
      summary?: string;
    };
    features?: Record<string, unknown>;
    scorecard?: {
      totalScore: number;
      creditGrade: string;
      dimensionScores?: Record<string, number>;
    };
    limitCalculation?: {
      approvedAmount: number;
      maxAmount: number;
      recommendedAmount: number;
      calculationBasis?: string;
    };
    nineDimension?: Record<string, unknown>;
  };
  layer4?: {
    aiSummary?: string;
    riskFactors?: string[];
    suggestions?: string[];
  };
  // 原始数据（用于面板展示）
  rawAppData?: Record<string, unknown>;
}

// ─── 核心分析函数 ─────────────────────────────────────────────────────────────
export async function runLocalAnalysis(input: LocalAnalyzeInput): Promise<LocalAnalyzeResult> {
  const applicationId = input.recordId || `LOCAL-${Date.now()}`;
  const analysisTime = new Date().toISOString();

  // ── 解析财务数据 ──────────────────────────────────────────────────────────
  const fr = input.financialReport || {};
  const parseNum = (v?: string | number | null): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,，万]/g, ""));
    return isNaN(n) ? undefined : n;
  };

  const revenue = parseNum(fr.revenue);
  const netProfit = parseNum(fr.netProfit);
  const totalAssets = parseNum(fr.totalAssets);
  const totalLiabilities = parseNum(fr.totalLiabilities);
  const operatingCashFlow = parseNum(fr.operatingCashFlow);
  const currentRatioVal = parseNum(fr.currentRatio);
  const quickRatioVal = parseNum(fr.quickRatio);
  const roeVal = parseNum(fr.roe);
  const registeredCapital = parseNum(input.registeredCapital);

  // 从银行流水摘取月度收入
  const bankFlowSummary = input.bankFlowSummary as Record<string, unknown> | undefined;
  const bankMonthlyRevenues: number[] = [];
  if (bankFlowSummary?.monthlyData && Array.isArray(bankFlowSummary.monthlyData)) {
    for (const m of bankFlowSummary.monthlyData as { inflow?: number }[]) {
      if (typeof m.inflow === "number") bankMonthlyRevenues.push(m.inflow);
    }
  }

  // 从税务数据提取纳税信用等级
  const taxData = input.taxData as Record<string, unknown> | undefined;
  const taxCreditLevel = (taxData?.taxCreditLevel as string) || undefined;

  // ── 构建特征工程输入 ──────────────────────────────────────────────────────
  const rawFeatures: RawDataForFeatures = {
    establishDate: input.establishDate,
    registeredCapital,
    industryCode: input.industry || "综合",
    revenue,
    netProfit,
    totalAssets,
    totalLiabilities,
    operatingCashFlow,
    taxCreditLevel,
    bankMonthlyRevenues: bankMonthlyRevenues.length > 0 ? bankMonthlyRevenues : undefined,
    requestAmount: parseNum(input.amount),
    loanPurpose: input.purpose,
  };

  // 如果有currentRatio直接传入，则计算currentAssets/currentLiabilities（近似）
  if (currentRatioVal != null && totalLiabilities != null) {
    rawFeatures.currentLiabilities = totalLiabilities * 0.5; // 近似：流动负债约为总负债50%
    rawFeatures.currentAssets = rawFeatures.currentLiabilities * currentRatioVal;
  }

  // ── Layer 3: 特征工程 ─────────────────────────────────────────────────────
  let featureVector;
  try {
    featureVector = await computeFeatureVector(rawFeatures);
  } catch (e) {
    console.error("[LocalAnalyzer] Feature engineering error:", e);
    featureVector = null;
  }

  // ── Layer 3: 硬性规则引擎 ─────────────────────────────────────────────────
  const ruleInput: RuleInputData = {
    uscc: input.creditCode || "000000000000000000",
    companyName: input.companyName,
    establishDate: input.establishDate,
    registeredCapital,
    taxCreditLevel,
    netProfit,
    requestAmount: parseNum(input.amount),
    // 从财务数据计算资产负债率
    debtRatio: (totalAssets && totalLiabilities && totalAssets > 0)
      ? totalLiabilities / totalAssets
      : undefined,
  };

  let ruleResult;
  try {
    // 优先使用远端动态规则库（如果已下载）
    const dynamicResult = runDynamicRuleEngine(ruleInput as unknown as Record<string, unknown>);
    if (dynamicResult) {
      ruleResult = dynamicResult;
    } else {
      // 降级到内置规则引擎
      ruleResult = runHardRuleEngine(ruleInput as RuleInputData);
    }
  } catch (e) {
    console.error("[LocalAnalyzer] Rule engine error:", e);
    ruleResult = { passed: true, triggeredRules: [], summary: "规则引擎运行异常，已跳过" };
  }

  // ── Layer 3: 评分卡 ───────────────────────────────────────────────────────
  let scorecardResult;
  try {
    scorecardResult = featureVector ? computeScorecardResult(featureVector) : null;
  } catch (e) {
    console.error("[LocalAnalyzer] Scorecard error:", e);
    scorecardResult = { score: 60, creditGrade: "BBB" as CreditGrade, subjectQualityScore: 50, financialHealthScore: 50, operationStabilityScore: 50, scorePD: 0.5, scoreBreakdown: { subjectWeight: 0.35, financialWeight: 0.40, operationWeight: 0.25, subjectContribution: 0, financialContribution: 0, operationContribution: 0, penaltyPoints: 0 }, recommendation: "数据不足" };
  }

  // ── Layer 3: 额度计算 ─────────────────────────────────────────────────────
  let limitResult;
  try {
    const grade = (scorecardResult?.creditGrade ?? "BBB") as CreditGrade;
    const avgMonthlyRevenue = bankMonthlyRevenues.length > 0
      ? bankMonthlyRevenues.reduce((a, b) => a + b, 0) / bankMonthlyRevenues.length
      : (revenue ? revenue / 12 : 0);
    const limitInput: LimitInputData = {
      creditGrade: grade,
      avgMonthlyRevenue,
      totalAssets: totalAssets ?? 0,
      totalLiabilities: totalLiabilities ?? 0,
      annualOperatingCashFlow: operatingCashFlow ?? 0,
      requestedAmount: parseNum(input.amount) ?? 100,
    };
    limitResult = calculateCreditLimit(limitInput);
  } catch (e) {
    console.error("[LocalAnalyzer] Limit calculation error:", e);
    limitResult = { approvedAmount: 0, maxAmount: 0, recommendedAmount: 0, calculationBasis: "计算异常" };
  }

  // ── 综合裁决 ──────────────────────────────────────────────────────────────
  const score = scorecardResult?.score ?? 60;
  const rulesPassed = ruleResult?.passed ?? true;
  const approvedAmount = limitResult?.approvedAmount ?? 0;

  let verdict: "approved" | "reduced" | "rejected";
  if (!rulesPassed) {
    verdict = "rejected";
  } else if (score >= 70 && approvedAmount > 0) {
    verdict = "approved";
  } else if (score >= 50 && approvedAmount > 0) {
    verdict = "reduced";
  } else {
    verdict = "rejected";
  }

  // ── Layer 4: AI 综合评估（本地版：基于规则生成文字摘要）────────────────────
  const aiSummary = generateLocalAISummary({
    companyName: input.companyName,
    verdict,
    score,
    ruleResult,
    scorecardResult,
    limitResult,
    featureVector,
    industry: input.industry,
  });

  // ── 构建报告 ──────────────────────────────────────────────────────────────
  const report: AnalysisReport = {
    companyName: input.companyName,
    applicationId,
    analysisTime,
    layer3: {
      ruleEngine: {
        passed: ruleResult?.passed ?? true,
        triggeredRules: ruleResult?.triggeredRules ?? [],
        summary: ruleResult?.summary ?? "",
      },
      features: featureVector ?? undefined,
      scorecard: scorecardResult ? { totalScore: scorecardResult.score, creditGrade: scorecardResult.creditGrade, dimensionScores: { subjectQuality: scorecardResult.subjectQualityScore, financialHealth: scorecardResult.financialHealthScore, operationStability: scorecardResult.operationStabilityScore } } : undefined,
      limitCalculation: limitResult ?? undefined,
    },
    layer4: {
      aiSummary,
      riskFactors: extractRiskFactors(ruleResult, featureVector, score),
      suggestions: generateSuggestions(verdict, score, ruleResult),
    },
    rawAppData: input as unknown as Record<string, unknown>,
  };

  // ── Layer 2: 写入图谱（异步，不阻塞返回）────────────────────────────────────
  try {
    await writeAppDataToGraph({
      applicationId,
      companyName: input.companyName,
      appData: input as unknown as Record<string, unknown>,
    });
    await writeAnalysisResultToGraph({
      applicationId,
      companyName: input.companyName,
      verdict,
      score,
      featureVector: (featureVector ?? {}) as Record<string, unknown>,
      analysisReport: report as unknown as Record<string, unknown>,
    });
  } catch (e) {
    // 图谱写入失败不影响主流程
    console.warn("[LocalAnalyzer] Graph write failed (non-fatal):", e);
  }

  return { applicationId, verdict, score, report };
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function generateLocalAISummary(params: {
  companyName: string;
  verdict: string;
  score: number;
  ruleResult: { passed: boolean; triggeredRules?: { ruleName: string }[] } | null | undefined;
  scorecardResult: { totalScore: number; creditGrade: string } | null | undefined;
  limitResult: { approvedAmount: number; recommendedAmount: number } | null | undefined;
  featureVector: { dataCompleteness?: number } | null | undefined;
  industry?: string;
}): string {
  const { companyName, verdict, score, ruleResult, scorecardResult, limitResult, featureVector, industry } = params;
  const grade = scorecardResult?.creditGrade ?? "BBB";
  const approvedAmt = limitResult?.approvedAmount ?? 0;
  const completeness = featureVector?.dataCompleteness ?? 0;
  const verdictText = verdict === "approved" ? "建议批准" : verdict === "reduced" ? "建议降额通过" : "建议拒绝";
  const triggeredCount = ruleResult?.triggeredRules?.length ?? 0;

  let summary = `**综合评估结论：${verdictText}**\n\n`;
  summary += `${companyName}（行业：${industry ?? "综合"}）经本地风控引擎全面分析，综合信用评分 **${score}分**，信用等级 **${grade}**。\n\n`;

  if (!ruleResult?.passed && triggeredCount > 0) {
    const rules = ruleResult?.triggeredRules?.map((r) => r.ruleName).join("、") ?? "";
    summary += `⚠️ **硬性规则触发**：触发了 ${triggeredCount} 条准入规则（${rules}），建议拒绝本次申请。\n\n`;
  } else {
    summary += `✅ **规则引擎**：全部 8 条硬性准入规则通过。\n\n`;
  }

  if (approvedAmt > 0) {
    summary += `💰 **建议授信额度**：${approvedAmt} 万元。\n\n`;
  }

  summary += `📊 **数据完整度**：${Math.round(completeness * 100)}%。`;
  if (completeness < 0.6) {
    summary += "建议补充更多资料以提高分析准确性。";
  }

  return summary;
}

function extractRiskFactors(
  ruleResult: { triggeredRules?: { ruleName: string; ruleDesc: string }[] } | null | undefined,
  featureVector: Record<string, unknown> | null | undefined,
  score: number
): string[] {
  const factors: string[] = [];

  if (ruleResult?.triggeredRules?.length) {
    for (const rule of ruleResult.triggeredRules) {
      factors.push(`${rule.ruleName}：${rule.ruleDesc}`);
    }
  }

  if (score < 50) factors.push("综合信用评分偏低（< 50分）");
  if (score >= 50 && score < 70) factors.push("综合信用评分中等（50-70分），存在一定风险");

  if (featureVector) {
    const fv = featureVector as Record<string, number | null>;
    if (fv.F13_debtRatio != null && fv.F13_debtRatio > 0.75) {
      factors.push(`资产负债率偏高（${(fv.F13_debtRatio * 100).toFixed(1)}%）`);
    }
    if (fv.F14_currentRatio != null && fv.F14_currentRatio < 1.0) {
      factors.push(`流动比率偏低（${fv.F14_currentRatio.toFixed(2)}），短期偿债能力不足`);
    }
    if (fv.F18_netProfitMargin != null && fv.F18_netProfitMargin < 0) {
      factors.push("净利润率为负，企业亏损");
    }
  }

  return factors;
}

function generateSuggestions(
  verdict: string,
  score: number,
  ruleResult: { passed: boolean; triggeredRules?: { ruleName: string }[] } | null | undefined
): string[] {
  const suggestions: string[] = [];

  if (verdict === "rejected") {
    if (!ruleResult?.passed) {
      suggestions.push("建议企业整改触发的硬性规则后重新申请");
    }
    if (score < 50) {
      suggestions.push("建议提升企业财务健康度后重新申请");
    }
  } else if (verdict === "reduced") {
    suggestions.push("建议降额审批，加强贷后管理");
    suggestions.push("建议要求企业提供额外担保或抵押");
  } else {
    suggestions.push("建议按正常流程推进审批");
    suggestions.push("建议定期跟踪企业经营状况");
  }

  suggestions.push("建议上传更多资料（银行流水、税务申报表）以提高分析精度");

  return suggestions;
}


