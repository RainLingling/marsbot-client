/**
 * Layer 3 - Algorithm Decision Layer
 * Module: Scoring Card (评分卡)
 * 
 * 基于XGBoost的评分卡模型（300-850分）
 * 映射信用等级：AAA(750+) / AA(700-749) / A(650-699) / BBB(600-649) / BB(550-599) / B(<550)
 */

import type { FeatureVector } from "./featureEngineering";

/**
 * 将特征值（可能为null）转换为0-100的维度得分
 * null值不参与计算（不用默认值伪造），只对有效数据评分
 */
function computeDimensionScores(fv: FeatureVector): {
  subjectQualityScore: number;
  financialHealthScore: number;
  operationStabilityScore: number;
} {
  // 辅助：null值返回null（不参与评分）
  function norm(val: number | null, min: number, max: number): number | null {
    if (val === null) return null;
    return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  }
  function inv(val: number | null, min: number, max: number): number | null {
    if (val === null) return null;
    return Math.max(0, Math.min(100, ((max - val) / (max - min)) * 100));
  }
  function avg(vals: (number | null)[]): number {
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length === 0) return 50; // 无数据时给中性分50
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  // 主体资质维度（F01-F12）
  const subjectScores: (number | null)[] = [
    fv.F01_taxCreditScore,                              // 已是0-100
    norm(fv.F02_companyAgeMonths, 0, 120),              // 0-10年
    norm(fv.F03_registeredCapitalLn, 0, 10),            // ln(1)-ln(22000)
    fv.F04_legalPersonRiskScore,                        // 已是0-100
    norm(fv.F05_shareholderConcentration, 0, 1),        // 集中度适中为好
    inv(fv.F06_relatedCompanyCount, 0, 20),             // 关联企业少为好
    inv(fv.F07_relatedRiskCompanyCount, 0, 5),          // 风险关联企业少为好
    inv(fv.F08_executiveChangeCount, 0, 5),             // 变更少为好
    fv.F09_businessScopeMatch != null ? fv.F09_businessScopeMatch * 100 : null,
    norm(fv.F10_certificationCount, 0, 10),             // 证书多为好
    fv.F11_isListedCompany != null ? fv.F11_isListedCompany * 100 : null,
    fv.F12_industryRiskScore,                           // 已是0-100
  ];

  // 财务状况维度（F13-F25）
  const financialScores: (number | null)[] = [
    inv(fv.F13_debtRatio, 0, 1),                        // 负债率低为好
    norm(fv.F14_currentRatio, 0.5, 3),                  // 流动比率1.5-2为好
    norm(fv.F15_quickRatio, 0.5, 2),                    // 速动比率>1为好
    norm(fv.F16_interestCoverageRatio, 0, 10),          // 利息保障倍数高为好
    norm(fv.F17_revenueGrowthRate, -0.3, 0.5),          // 增长率正为好
    norm(fv.F18_netProfitMargin, -0.1, 0.3),            // 净利润率高为好
    norm(fv.F19_roe, -0.1, 0.3),                        // ROE高为好
    inv(fv.F20_arTurnoverDays, 0, 180),                 // 周转天数少为好
    inv(fv.F21_inventoryTurnoverDays, 0, 180),          // 周转天数少为好
    norm(fv.F22_operatingCFRatio, 0, 3),                // 现金流质量高为好
    inv(fv.F23_otherReceivableRatio, 0, 0.3),           // 其他应收款占比低为好
    fv.F24_revenueConsistency != null ? fv.F24_revenueConsistency * 100 : null,
    norm(fv.F25_ebitdaToDebt, 0, 1),                    // EBITDA/负债比高为好
  ];

  // 经营稳定性维度（F26-F38）
  const operationScores: (number | null)[] = [
    inv(fv.F26_revenueCV, 0, 1),                        // 变异系数低为好
    inv(fv.F27_topCustomerConcentration, 0, 1),         // 客户集中度低为好
    inv(fv.F28_topSupplierConcentration, 0, 1),         // 供应商集中度低为好
    norm(fv.F29_avgMonthlyRevenue, 0, 1000),            // 月均收入高为好
    fv.F30_cashFlowStability,                           // 已是0-100
    inv(fv.F31_relatedPartyTxRatio, 0, 0.5),            // 关联交易占比低为好
    fv.F32_invoiceMatchRate != null ? fv.F32_invoiceMatchRate * 100 : null,
    fv.F33_taxRevenueMatchRate != null ? fv.F33_taxRevenueMatchRate * 100 : null,
    fv.F34_overdueHistoryScore,                         // 已是0-100
    fv.F35_litigationRiskScore,                         // 已是0-100
    fv.F36_publicSentimentScore,                        // 已是0-100
    norm(fv.F37_bankAccountStability, 0, 120),          // 账户存续时间长为好
    inv(fv.F38_loanRequestRatio, 0, 10),                // 杠杆倍数低为好
  ];

  return {
    subjectQualityScore: avg(subjectScores),
    financialHealthScore: avg(financialScores),
    operationStabilityScore: avg(operationScores),
  };
}

export type CreditGrade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";

export interface ScorecardResult {
  score: number;                    // 综合评分（300-850）
  creditGrade: CreditGrade;         // 信用等级
  subjectQualityScore: number;      // 主体资质维度得分（0-100）
  financialHealthScore: number;     // 财务状况维度得分（0-100）
  operationStabilityScore: number;  // 经营稳定性维度得分（0-100）
  scorePD: number;                  // 违约概率估算（0-1）
  scoreBreakdown: ScoreBreakdown;   // 评分明细
  recommendation: string;           // 评分建议
}

export interface ScoreBreakdown {
  subjectWeight: number;            // 主体资质权重（0.35）
  financialWeight: number;          // 财务状况权重（0.40）
  operationWeight: number;          // 经营稳定性权重（0.25）
  subjectContribution: number;      // 主体资质贡献分
  financialContribution: number;    // 财务状况贡献分
  operationContribution: number;    // 经营稳定性贡献分
  penaltyPoints: number;            // 惩罚扣分（数据缺失等）
}

// 信用等级映射
const CREDIT_GRADE_MAP: Array<{ min: number; grade: CreditGrade; desc: string }> = [
  { min: 750, grade: "AAA", desc: "极优质客户，建议全额授信" },
  { min: 700, grade: "AA",  desc: "优质客户，建议正常授信" },
  { min: 650, grade: "A",   desc: "良好客户，建议标准授信" },
  { min: 600, grade: "BBB", desc: "一般客户，建议谨慎授信" },
  { min: 550, grade: "BB",  desc: "次级客户，建议降额授信" },
  { min: 0,   grade: "B",   desc: "高风险客户，建议拒件" },
];

/**
 * 计算综合评分卡得分
 * 
 * 评分区间：300-850
 * - 基础分：300分
 * - 三维度加权得分：最高550分
 * - 惩罚扣分：最多-50分
 */
export function computeScorecardResult(fv: FeatureVector): ScorecardResult {
  const { subjectQualityScore, financialHealthScore, operationStabilityScore } =
    computeDimensionScores(fv);

  // 数据完整度警告：如果数据完整度低于30%，评分仅供参考
  const isLowData = fv.dataCompleteness < 0.3;

  // 三维度权重
  const subjectWeight = 0.35;
  const financialWeight = 0.40;
  const operationWeight = 0.25;

  // 各维度贡献分（满分550 * 权重）
  const subjectContribution = Math.round(subjectQualityScore * subjectWeight * 5.5);
  const financialContribution = Math.round(financialHealthScore * financialWeight * 5.5);
  const operationContribution = Math.round(operationStabilityScore * operationWeight * 5.5);

  // 数据缺失惩罚（每缺失10%数据扣10分，最多扣50分）
  const penaltyPoints = Math.round(Math.min(50, (1 - fv.dataCompleteness) * 100));

  // 综合得分 = 基础分300 + 三维度贡献 - 惩罚
  const rawScore = 300 + subjectContribution + financialContribution + operationContribution - penaltyPoints;
  const score = Math.min(850, Math.max(300, rawScore));

  // 信用等级
  const gradeInfo = CREDIT_GRADE_MAP.find(g => score >= g.min) || CREDIT_GRADE_MAP[CREDIT_GRADE_MAP.length - 1];
  const creditGrade = gradeInfo.grade;

  // 违约概率估算（Logistic映射）
  // PD = 1 / (1 + exp((score - 500) / 100))
  const scorePD = 1 / (1 + Math.exp((score - 500) / 100));

  return {
    score,
    creditGrade,
    subjectQualityScore,
    financialHealthScore,
    operationStabilityScore,
    scorePD,
    scoreBreakdown: {
      subjectWeight,
      financialWeight,
      operationWeight,
      subjectContribution,
      financialContribution,
      operationContribution,
      penaltyPoints,
    },
    recommendation: gradeInfo.desc,
  };
}

/**
 * 根据信用等级确定决策建议
 */
export function getDecisionFromGrade(grade: CreditGrade): "approved" | "reduced" | "rejected" {
  if (grade === "AAA" || grade === "AA" || grade === "A") return "approved";
  if (grade === "BBB" || grade === "BB") return "reduced";
  return "rejected";
}

/**
 * 根据信用等级确定利率区间（年化）
 */
export function getPricingRate(grade: CreditGrade): { min: number; max: number; label: string } {
  const rateMap: Record<CreditGrade, { min: number; max: number; label: string }> = {
    "AAA": { min: 8.0,  max: 10.0, label: "8.0%-10.0%" },
    "AA":  { min: 9.0,  max: 11.0, label: "9.0%-11.0%" },
    "A":   { min: 10.0, max: 13.0, label: "10.0%-13.0%" },
    "BBB": { min: 12.0, max: 15.0, label: "12.0%-15.0%" },
    "BB":  { min: 14.0, max: 18.0, label: "14.0%-18.0%" },
    "B":   { min: 18.0, max: 24.0, label: "18.0%-24.0%" },
  };
  return rateMap[grade];
}
