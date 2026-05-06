/**
 * Layer 3 - Algorithm Decision Layer
 * Module: Limit Calculator (三法额度计算)
 * 
 * 三法取最小值：
 * 1. 收入法：月均经营性收入 × 3-6倍（按信用等级）
 * 2. 净资产法：净资产 × 30%-50%（按信用等级）
 * 3. 现金流法：年经营现金流净额 × 50%-80%（按信用等级）
 */

import type { CreditGrade } from "./scoringCard";

export interface LimitCalculationResult {
  revenueMethodLimit: number;       // 收入法额度（万元）
  netAssetMethodLimit: number;      // 净资产法额度（万元）
  cashFlowMethodLimit: number;      // 现金流法额度（万元）
  recommendedLimit: number;         // 建议额度（三法最小值，万元）
  requestedAmount: number;          // 申请金额（万元）
  approvedAmount: number;           // 批准金额（取建议额度与申请金额的最小值，万元）
  approvalRatio: number;            // 批准比例（0-1）
  methodDetails: MethodDetail[];    // 各方法计算明细
}

export interface MethodDetail {
  method: string;
  formula: string;
  inputValues: Record<string, string>;
  result: number;
  isBinding: boolean;               // 是否为约束性（最小值）
}

// 按信用等级的倍数系数
const GRADE_MULTIPLIERS: Record<CreditGrade, {
  revenueMultiplier: number;        // 收入法倍数（月均收入的倍数）
  netAssetRatio: number;            // 净资产法比例
  cashFlowRatio: number;            // 现金流法比例
}> = {
  "AAA": { revenueMultiplier: 6, netAssetRatio: 0.50, cashFlowRatio: 0.80 },
  "AA":  { revenueMultiplier: 5, netAssetRatio: 0.45, cashFlowRatio: 0.70 },
  "A":   { revenueMultiplier: 4, netAssetRatio: 0.40, cashFlowRatio: 0.60 },
  "BBB": { revenueMultiplier: 3, netAssetRatio: 0.35, cashFlowRatio: 0.50 },
  "BB":  { revenueMultiplier: 2, netAssetRatio: 0.30, cashFlowRatio: 0.40 },
  "B":   { revenueMultiplier: 1, netAssetRatio: 0.20, cashFlowRatio: 0.30 },
};

export interface LimitInputData {
  creditGrade: CreditGrade;
  avgMonthlyRevenue: number;        // 月均经营性收入（万元）
  totalAssets: number;              // 总资产（万元）
  totalLiabilities: number;        // 总负债（万元）
  annualOperatingCashFlow: number;  // 年经营现金流净额（万元）
  requestedAmount: number;          // 申请金额（万元）
}

/**
 * 执行三法额度计算
 */
export function calculateCreditLimit(input: LimitInputData): LimitCalculationResult {
  const multipliers = GRADE_MULTIPLIERS[input.creditGrade];
  const netAsset = Math.max(0, input.totalAssets - input.totalLiabilities);

  // 1. 收入法
  const revenueMethodLimit = Math.round(input.avgMonthlyRevenue * multipliers.revenueMultiplier);

  // 2. 净资产法
  const netAssetMethodLimit = Math.round(netAsset * multipliers.netAssetRatio);

  // 3. 现金流法
  const cashFlowMethodLimit = Math.round(input.annualOperatingCashFlow * multipliers.cashFlowRatio);

  // 三法最小值
  const recommendedLimit = Math.max(0, Math.min(revenueMethodLimit, netAssetMethodLimit, cashFlowMethodLimit));

  // 批准金额 = min(建议额度, 申请金额)
  const approvedAmount = Math.min(recommendedLimit, input.requestedAmount);
  const approvalRatio = input.requestedAmount > 0 ? approvedAmount / input.requestedAmount : 0;

  // 确定约束性方法
  const minLimit = Math.min(revenueMethodLimit, netAssetMethodLimit, cashFlowMethodLimit);

  const methodDetails: MethodDetail[] = [
    {
      method: "收入法",
      formula: `月均经营性收入 × ${multipliers.revenueMultiplier}倍`,
      inputValues: {
        "月均经营性收入": `${input.avgMonthlyRevenue.toFixed(1)}万元`,
        "倍数系数（${input.creditGrade}级）": `${multipliers.revenueMultiplier}倍`,
      },
      result: revenueMethodLimit,
      isBinding: revenueMethodLimit === minLimit,
    },
    {
      method: "净资产法",
      formula: `净资产 × ${(multipliers.netAssetRatio * 100).toFixed(0)}%`,
      inputValues: {
        "总资产": `${input.totalAssets.toFixed(1)}万元`,
        "总负债": `${input.totalLiabilities.toFixed(1)}万元`,
        "净资产": `${netAsset.toFixed(1)}万元`,
        "比例系数（${input.creditGrade}级）": `${(multipliers.netAssetRatio * 100).toFixed(0)}%`,
      },
      result: netAssetMethodLimit,
      isBinding: netAssetMethodLimit === minLimit,
    },
    {
      method: "现金流法",
      formula: `年经营现金流 × ${(multipliers.cashFlowRatio * 100).toFixed(0)}%`,
      inputValues: {
        "年经营现金流净额": `${input.annualOperatingCashFlow.toFixed(1)}万元`,
        "比例系数（${input.creditGrade}级）": `${(multipliers.cashFlowRatio * 100).toFixed(0)}%`,
      },
      result: cashFlowMethodLimit,
      isBinding: cashFlowMethodLimit === minLimit,
    },
  ];

  return {
    revenueMethodLimit,
    netAssetMethodLimit,
    cashFlowMethodLimit,
    recommendedLimit,
    requestedAmount: input.requestedAmount,
    approvedAmount,
    approvalRatio,
    methodDetails,
  };
}
