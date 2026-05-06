/**
 * 九维度分析引擎
 * 基于本体模型，计算企业的 9 个维度风险评分和 33+ 个关键指标
 * 
 * 九个维度：
 * 1. 财务报表静态分析（12 个指标）
 * 2. 银行流水动态穿透（11 个指标）
 * 3. 税务申报交叉验证（4 个指标）
 * 4. 他行授信与隐性负债（5 个指标）
 * 5. 业务板块与收入构成（6 个指标）
 * 6. 征信报告与司法涉诉（6 个指标）
 * 7. 关联方与担保圈穿透（5 个指标）
 * 8. 应收账款与客户质量（8 个指标）
 * 9. 经营现金流与偿债能力（8 个指标）
 */

export interface FinancialData {
  // 资产负债表
  totalAssets?: number;
  currentAssets?: number;
  totalLiabilities?: number;
  currentLiabilities?: number;
  netAssets?: number;
  
  // 利润表
  revenue?: number;
  operatingCost?: number;
  operatingProfit?: number;
  netProfit?: number;
  
  // 现金流量表
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  endingCash?: number;
}

export interface BankFlowData {
  dailyAverageBalance?: number;
  minimumBalance?: number;
  maximumBalance?: number;
  incomingAmount?: number;
  outgoingAmount?: number;
  transactionCount?: number;
  monthCount?: number;  // 流水月份数
  monthlyData?: Array<{ month?: string; inflow?: number; outflow?: number; balance?: number }>;
  top5Counterparties?: Array<{
    name: string;
    amount: number;
    direction: 'in' | 'out';
    count: number;
  }>;
}

export interface TaxData {
  declaredRevenue?: number;
  vatAmount?: number;
  citAmount?: number;
  taxPaymentStatus?: string;
}

export interface CreditData {
  totalCredit?: number;
  creditUsage?: number;
  overdueAmount?: number;
  overdueDays?: number;
}

export interface DimensionScore {
  dimensionId: number;
  dimensionName: string;
  score: number; // 0-1
  indicators: Record<string, any>;
  riskLevel: 'low' | 'medium_low' | 'medium' | 'medium_high' | 'high';
}

export interface NineDimensionAnalysisResult {
  dimensions: DimensionScore[];
  compositeScore: number; // 0-1
  riskLevel: 'low' | 'medium_low' | 'medium' | 'medium_high' | 'high';
  oneVoteVetoItems: string[];
  keyRiskIndicators: Record<string, any>;
  creditRecommendation: 'normal' | 'cautious' | 'conditional' | 'restricted' | 'reject';
  creditAmount?: number;
  creditPeriod?: string;
  monitoringFrequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'real_time';
}

export class NineDimensionAnalyzer {
  private dimensionWeights = {
    1: 0.15, // 财务报表
    2: 0.25, // 银行流水
    3: 0.10, // 税务申报
    4: 0.10, // 他行授信
    5: 0.05, // 业务板块
    6: 0.15, // 征信司法
    7: 0.10, // 关联方
    8: 0.05, // 应收账款
    9: 0.15, // 经营现金流
  };

  analyze(
    financialData: FinancialData,
    bankFlowData: BankFlowData,
    taxData: TaxData,
    creditData: CreditData,
    relatedPartiesData?: any,
    accountsReceivableData?: any
  ): NineDimensionAnalysisResult {
    const dimensions: DimensionScore[] = [];

    // 维度 1：财务报表静态分析
    dimensions.push(this.analyzeDimension1(financialData));

    // 维度 2：银行流水动态穿透
    dimensions.push(this.analyzeDimension2(bankFlowData, financialData));

    // 维度 3：税务申报交叉验证
    dimensions.push(this.analyzeDimension3(taxData, financialData));

    // 维度 4：他行授信与隐性负债
    dimensions.push(this.analyzeDimension4(creditData, financialData));

    // 维度 5：业务板块与收入构成
    dimensions.push(this.analyzeDimension5(financialData));

    // 维度 6：征信报告与司法涉诉
    dimensions.push(this.analyzeDimension6(creditData));

    // 维度 7：关联方与担保圈穿透
    dimensions.push(this.analyzeDimension7(relatedPartiesData || {}));

    // 维度 8：应收账款与客户质量
    dimensions.push(this.analyzeDimension8(accountsReceivableData || {}));

    // 维度 9：经营现金流与偿债能力
    dimensions.push(this.analyzeDimension9(financialData, bankFlowData));

    // 计算综合评分
    const compositeScore = this.calculateCompositeScore(dimensions);

    // 判定风险等级
    const riskLevel = this.getRiskLevel(compositeScore);

    // 检查一票否决项
    const oneVoteVetoItems = this.checkOneVoteVeto(financialData, bankFlowData, creditData);

    // 如果有一票否决项，直接升级为高风险
    const finalRiskLevel = oneVoteVetoItems.length > 0 ? 'high' : riskLevel;
    const finalCompositeScore = oneVoteVetoItems.length > 0 ? 0.85 : compositeScore;

    // 生成授信建议
    const creditRecommendation = this.getCreditRecommendation(finalRiskLevel);

    return {
      dimensions,
      compositeScore: finalCompositeScore,
      riskLevel: finalRiskLevel,
      oneVoteVetoItems,
      keyRiskIndicators: this.extractKeyRiskIndicators(dimensions),
      creditRecommendation,
      creditAmount: this.calculateCreditAmount(finalRiskLevel, financialData),
      creditPeriod: this.calculateCreditPeriod(finalRiskLevel),
      monitoringFrequency: this.getMonitoringFrequency(finalRiskLevel),
    };
  }

  /**
   * 维度 1：财务报表静态分析（12 个指标）
   */
  private analyzeDimension1(data: FinancialData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 指标 1：资产负债率
    if (data.totalAssets && data.totalLiabilities) {
      const debtRatio = data.totalLiabilities / data.totalAssets;
      indicators.debtRatio = debtRatio;
      indicators.debtRatioScore = debtRatio > 0.6 ? 0.3 : debtRatio > 0.5 ? 0.5 : 0.8;
      totalScore += indicators.debtRatioScore;
      validIndicators++;
    }

    // 指标 2：流动比率
    if (data.currentAssets && data.currentLiabilities) {
      const currentRatio = data.currentAssets / data.currentLiabilities;
      indicators.currentRatio = currentRatio;
      indicators.currentRatioScore = currentRatio < 1.0 ? 0.2 : currentRatio < 1.5 ? 0.5 : 0.8;
      totalScore += indicators.currentRatioScore;
      validIndicators++;
    }

    // 指标 3：速动比率
    if (data.currentAssets && data.currentLiabilities) {
      const quickRatio = (data.currentAssets * 0.7) / data.currentLiabilities; // 假设 70% 为速动资产
      indicators.quickRatio = quickRatio;
      indicators.quickRatioScore = quickRatio < 0.5 ? 0.2 : quickRatio < 1.0 ? 0.5 : 0.8;
      totalScore += indicators.quickRatioScore;
      validIndicators++;
    }

    // 指标 4：利息覆盖倍数
    if (data.operatingProfit) {
      const interestCoverage = data.operatingProfit / Math.max(data.operatingProfit * 0.05, 1); // 假设利息为利润的 5%
      indicators.interestCoverage = interestCoverage;
      indicators.interestCoverageScore = interestCoverage < 2 ? 0.3 : interestCoverage < 5 ? 0.6 : 0.9;
      totalScore += indicators.interestCoverageScore;
      validIndicators++;
    }

    // 指标 5：净利润率
    if (data.revenue && data.netProfit) {
      const netProfitMargin = data.netProfit / data.revenue;
      indicators.netProfitMargin = netProfitMargin;
      indicators.netProfitMarginScore = netProfitMargin < 0.02 ? 0.3 : netProfitMargin < 0.05 ? 0.6 : 0.9;
      totalScore += indicators.netProfitMarginScore;
      validIndicators++;
    }

    // 指标 6：ROA（资产收益率）
    if (data.totalAssets && data.netProfit) {
      const roa = data.netProfit / data.totalAssets;
      indicators.roa = roa;
      indicators.roaScore = roa < 0.02 ? 0.3 : roa < 0.05 ? 0.6 : 0.9;
      totalScore += indicators.roaScore;
      validIndicators++;
    }

    // 指标 7：ROE（股东权益收益率）
    if (data.netAssets && data.netProfit) {
      const roe = data.netProfit / data.netAssets;
      indicators.roe = roe;
      indicators.roeScore = roe < 0.05 ? 0.3 : roe < 0.1 ? 0.6 : 0.9;
      totalScore += indicators.roeScore;
      validIndicators++;
    }

    // 指标 8-12：其他派生指标（简化处理）
    indicators.otherIndicators = 'pending';

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;

    return {
      dimensionId: 1,
      dimensionName: '财务报表静态分析',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
    };
  }

  /**
   * 维度 2：银行流水动态穿透（11 个指标）
   */
  private analyzeDimension2(bankData: BankFlowData, financialData: FinancialData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 指标 1：日均余额
    if (bankData.dailyAverageBalance && financialData.totalLiabilities) {
      const balanceCoverage = bankData.dailyAverageBalance / financialData.totalLiabilities;
      indicators.balanceCoverage = balanceCoverage;
      indicators.balanceCoverageScore = balanceCoverage < 0.1 ? 0.2 : balanceCoverage < 0.3 ? 0.5 : 0.8;
      totalScore += indicators.balanceCoverageScore;
      validIndicators++;
    }

    // 指标 2：最低余额
    if (bankData.minimumBalance && financialData.totalLiabilities) {
      const minBalanceCoverage = bankData.minimumBalance / financialData.totalLiabilities;
      indicators.minBalanceCoverage = minBalanceCoverage;
      indicators.minBalanceCoverageScore = minBalanceCoverage < 0.05 ? 0.1 : minBalanceCoverage < 0.15 ? 0.4 : 0.7;
      totalScore += indicators.minBalanceCoverageScore;
      validIndicators++;
    }

    // 指标 3：现金流入出比
    if (bankData.incomingAmount && bankData.outgoingAmount) {
      const cashFlowRatio = bankData.incomingAmount / Math.max(bankData.outgoingAmount, 1);
      indicators.cashFlowRatio = cashFlowRatio;
      indicators.cashFlowRatioScore = cashFlowRatio < 0.8 ? 0.2 : cashFlowRatio < 1.2 ? 0.5 : 0.8;
      totalScore += indicators.cashFlowRatioScore;
      validIndicators++;
    }

    // 指标 4：流水月份覆盖度（流水期间是否足够）
    if (bankData.monthCount != null) {
      const monthCoverage = bankData.monthCount;
      indicators.monthCoverage = monthCoverage;
      indicators.monthCoverageScore = monthCoverage < 3 ? 0.2 : monthCoverage < 6 ? 0.5 : monthCoverage < 12 ? 0.7 : 0.9;
      totalScore += indicators.monthCoverageScore;
      validIndicators++;
    }

    // 指标 5：流水月度稳定性（月均流入变异系数 CV）
    if (bankData.monthlyData && bankData.monthlyData.length >= 3) {
      const inflows = bankData.monthlyData.map(m => m.inflow ?? 0).filter(v => v > 0);
      if (inflows.length >= 3) {
        const avg = inflows.reduce((s, v) => s + v, 0) / inflows.length;
        const variance = inflows.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / inflows.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
        indicators.monthlyInflowCV = parseFloat(cv.toFixed(4));
        indicators.monthlyStabilityScore = cv > 1.0 ? 0.2 : cv > 0.6 ? 0.4 : cv > 0.3 ? 0.7 : 0.9;
        totalScore += indicators.monthlyStabilityScore;
        validIndicators++;
      }
    }

    // 指标 6：流入对手集中度（TOP5 收入方占总流入比例）
    if (bankData.top5Counterparties && bankData.top5Counterparties.length > 0 && bankData.incomingAmount && bankData.incomingAmount > 0) {
      const top5In = bankData.top5Counterparties.filter(c => c.direction === 'in');
      const top5InAmount = top5In.reduce((s, c) => s + c.amount, 0);
      const top5InConcentration = top5InAmount / bankData.incomingAmount;
      indicators.top5InConcentration = parseFloat(top5InConcentration.toFixed(4));
      indicators.top5InConcentrationScore = top5InConcentration > 0.8 ? 0.2 : top5InConcentration > 0.6 ? 0.4 : top5InConcentration > 0.4 ? 0.7 : 0.9;
      totalScore += indicators.top5InConcentrationScore;
      validIndicators++;

      // 指标 7：最大单一对手依赖度
      const top1In = top5In.length > 0 ? top5In.sort((a, b) => b.amount - a.amount)[0] : null;
      if (top1In) {
        const top1Dependency = top1In.amount / bankData.incomingAmount;
        indicators.top1InDependency = parseFloat(top1Dependency.toFixed(4));
        indicators.top1InDependencyScore = top1Dependency > 0.5 ? 0.2 : top1Dependency > 0.3 ? 0.5 : 0.8;
        totalScore += indicators.top1InDependencyScore;
        validIndicators++;
      }

      // 指标 8：流出对手集中度（TOP5 支出方占总流出比例）
      const top5Out = bankData.top5Counterparties.filter(c => c.direction === 'out');
      if (top5Out.length > 0 && bankData.outgoingAmount && bankData.outgoingAmount > 0) {
        const top5OutAmount = top5Out.reduce((s, c) => s + c.amount, 0);
        const top5OutConcentration = top5OutAmount / bankData.outgoingAmount;
        indicators.top5OutConcentration = parseFloat(top5OutConcentration.toFixed(4));
        indicators.top5OutConcentrationScore = top5OutConcentration > 0.8 ? 0.3 : top5OutConcentration > 0.6 ? 0.5 : 0.8;
        totalScore += indicators.top5OutConcentrationScore;
        validIndicators++;
      }
    }

    // 指标 9：流入流出匹配度（流入是否覆盖流出）
    if (bankData.incomingAmount && bankData.outgoingAmount && bankData.outgoingAmount > 0) {
      const coverageRatio = bankData.incomingAmount / bankData.outgoingAmount;
      indicators.inflowCoverageRatio = parseFloat(coverageRatio.toFixed(4));
      indicators.inflowCoverageScore = coverageRatio < 0.9 ? 0.2 : coverageRatio < 1.0 ? 0.4 : coverageRatio < 1.2 ? 0.7 : 0.9;
      totalScore += indicators.inflowCoverageScore;
      validIndicators++;
    }

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;
    return {
      dimensionId: 2,
      dimensionName: '银行流水动态穿透',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
     };
  }

  /**
   * 维度 3：税务申报交叉验证（4 个指标）
   */
  private analyzeDimension3(taxData: TaxData, financialData: FinancialData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 指标 1：收入一致性
    if (taxData.declaredRevenue && financialData.revenue) {
      const revenueDiff = Math.abs(taxData.declaredRevenue - financialData.revenue) / financialData.revenue;
      indicators.revenueDiff = revenueDiff;
      indicators.revenueDiffScore = revenueDiff > 0.1 ? 0.3 : revenueDiff > 0.05 ? 0.6 : 0.9;
      totalScore += indicators.revenueDiffScore;
      validIndicators++;
    }

    // 指标 2：增值税合理性
    if (taxData.vatAmount && taxData.declaredRevenue) {
      const vatRate = taxData.vatAmount / Math.max(taxData.declaredRevenue, 1);
      indicators.vatRate = vatRate;
      indicators.vatRateScore = vatRate < 0.03 || vatRate > 0.15 ? 0.3 : 0.8;
      totalScore += indicators.vatRateScore;
      validIndicators++;
    }

    // 指标 3-4：其他指标
    indicators.otherIndicators = 'pending';

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;

    return {
      dimensionId: 3,
      dimensionName: '税务申报交叉验证',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
    };
  }

  /**
   * 维度 4：他行授信与隐性负债（5 个指标）
   */
  private analyzeDimension4(creditData: CreditData, financialData: FinancialData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 指标 1：他行授信占比
    if (creditData.totalCredit && financialData.netAssets) {
      const creditRatio = creditData.totalCredit / financialData.netAssets;
      indicators.creditRatio = creditRatio;
      indicators.creditRatioScore = creditRatio > 0.5 ? 0.2 : creditRatio > 0.3 ? 0.5 : 0.8;
      totalScore += indicators.creditRatioScore;
      validIndicators++;
    }

    // 指标 2：授信使用率
    if (creditData.creditUsage && creditData.totalCredit) {
      const usageRate = creditData.creditUsage / creditData.totalCredit;
      indicators.usageRate = usageRate;
      indicators.usageRateScore = usageRate > 0.8 ? 0.2 : usageRate > 0.6 ? 0.5 : 0.8;
      totalScore += indicators.usageRateScore;
      validIndicators++;
    }

    // 指标 3：逾期贷款
    if (creditData.overdueAmount) {
      indicators.overdueAmount = creditData.overdueAmount;
      indicators.overdueScore = creditData.overdueAmount > 0 ? 0.1 : 0.9;
      totalScore += indicators.overdueScore;
      validIndicators++;
    }

    // 指标 4-5：其他指标
    indicators.otherIndicators = 'pending';

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;

    return {
      dimensionId: 4,
      dimensionName: '他行授信与隐性负债',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
    };
  }

  /**
   * 维度 5：业务板块与收入构成（6 个指标）
   */
  private analyzeDimension5(data: FinancialData): DimensionScore {
    const indicators: Record<string, any> = {};
    // 简化处理，返回中等评分
    return {
      dimensionId: 5,
      dimensionName: '业务板块与收入构成',
      score: 0.7,
      indicators,
      riskLevel: 'medium',
    };
  }

  /**
   * 维度 6：征信报告与司法涉诉（6 个指标）
   */
  private analyzeDimension6(creditData: CreditData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 检查逾期记录
    if (creditData.overdueAmount && creditData.overdueAmount > 0) {
      indicators.overdueRecord = true;
      indicators.overdueRecordScore = 0.2;
      totalScore += 0.2;
    } else {
      indicators.overdueRecord = false;
      indicators.overdueRecordScore = 0.9;
      totalScore += 0.9;
    }
    validIndicators++;

    // 其他指标
    indicators.otherIndicators = 'pending';

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;

    return {
      dimensionId: 6,
      dimensionName: '征信报告与司法涉诉',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
    };
  }

  /**
   * 维度 7：关联方与担保圈穿透（5 个指标）
   */
  private analyzeDimension7(relatedPartiesData: any): DimensionScore {
    const indicators: Record<string, any> = {};
    // 简化处理
    return {
      dimensionId: 7,
      dimensionName: '关联方与担保圈穿透',
      score: 0.7,
      indicators,
      riskLevel: 'medium',
    };
  }

  /**
   * 维度 8：应收账款与客户质量（8 个指标）
   */
  private analyzeDimension8(accountsReceivableData: any): DimensionScore {
    const indicators: Record<string, any> = {};
    // 简化处理
    return {
      dimensionId: 8,
      dimensionName: '应收账款与客户质量',
      score: 0.7,
      indicators,
      riskLevel: 'medium',
    };
  }

  /**
   * 维度 9：经营现金流与偿债能力（8 个指标）
   */
  private analyzeDimension9(financialData: FinancialData, bankData: BankFlowData): DimensionScore {
    const indicators: Record<string, any> = {};
    let totalScore = 0;
    let validIndicators = 0;

    // 指标 1：经营现金流
    if (financialData.operatingCashFlow && financialData.netProfit) {
      const cashFlowQuality = financialData.operatingCashFlow / financialData.netProfit;
      indicators.cashFlowQuality = cashFlowQuality;
      indicators.cashFlowQualityScore = cashFlowQuality < 0.5 ? 0.3 : cashFlowQuality < 1.0 ? 0.6 : 0.9;
      totalScore += indicators.cashFlowQualityScore;
      validIndicators++;
    }

    // 指标 2：自由现金流
    if (financialData.operatingCashFlow && financialData.investingCashFlow) {
      const freeCashFlow = financialData.operatingCashFlow - Math.abs(financialData.investingCashFlow);
      indicators.freeCashFlow = freeCashFlow;
      indicators.freeCashFlowScore = freeCashFlow < 0 ? 0.2 : 0.7;
      totalScore += indicators.freeCashFlowScore;
      validIndicators++;
    }

    // 指标 3-8：其他指标
    indicators.otherIndicators = 'pending';

    const score = validIndicators > 0 ? totalScore / validIndicators : 0.5;

    return {
      dimensionId: 9,
      dimensionName: '经营现金流与偿债能力',
      score: Math.min(score, 1),
      indicators,
      riskLevel: this.getIndicatorRiskLevel(score),
    };
  }

  /**
   * 计算综合评分
   */
  private calculateCompositeScore(dimensions: DimensionScore[]): number {
    let totalScore = 0;
    for (const dim of dimensions) {
      totalScore += dim.score * this.dimensionWeights[dim.dimensionId as keyof typeof this.dimensionWeights];
    }
    return Math.min(totalScore, 1);
  }

  /**
   * 根据评分判定风险等级
   */
  private getRiskLevel(score: number): 'low' | 'medium_low' | 'medium' | 'medium_high' | 'high' {
    if (score < 0.2) return 'low';
    if (score < 0.4) return 'medium_low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'medium_high';
    return 'high';
  }

  /**
   * 根据指标评分判定风险等级
   */
  private getIndicatorRiskLevel(score: number): 'low' | 'medium_low' | 'medium' | 'medium_high' | 'high' {
    return this.getRiskLevel(1 - score); // 反向，因为指标分越高风险越低
  }

  /**
   * 检查一票否决项
   */
  private checkOneVoteVeto(
    financialData: FinancialData,
    bankData: BankFlowData,
    creditData: CreditData
  ): string[] {
    const items: string[] = [];

    // 一票否决项 1：资产负债率 > 90%
    if (financialData.totalAssets && financialData.totalLiabilities) {
      const debtRatio = financialData.totalLiabilities / financialData.totalAssets;
      if (debtRatio > 0.9) {
        items.push('资产负债率超过 90%');
      }
    }

    // 一票否决项 2：逾期贷款余额 > 0
    if (creditData.overdueAmount && creditData.overdueAmount > 0) {
      items.push('存在逾期贷款');
    }

    // 一票否决项 3：经营现金流连续 2 年负值（简化处理）
    if (financialData.operatingCashFlow && financialData.operatingCashFlow < 0) {
      items.push('经营现金流为负值');
    }

    // 一票否决项 4：三层还款能力都不足（简化处理）
    const layer1 = financialData.operatingCashFlow && financialData.operatingCashFlow > 0 ? true : false;
    const layer2 = financialData.currentAssets && financialData.totalLiabilities && (financialData.currentAssets / financialData.totalLiabilities) > 0.5 ? true : false;
    const layer3 = financialData.netAssets && financialData.totalLiabilities && (financialData.netAssets / financialData.totalLiabilities) > 1.0 ? true : false;

    if (!layer1 && !layer2 && !layer3) {
      items.push('三层还款能力都不足');
    }

    return items;
  }

  /**
   * 获取授信建议
   */
  private getCreditRecommendation(riskLevel: string): 'normal' | 'cautious' | 'conditional' | 'restricted' | 'reject' {
    switch (riskLevel) {
      case 'low':
        return 'normal';
      case 'medium_low':
        return 'cautious';
      case 'medium':
        return 'conditional';
      case 'medium_high':
        return 'restricted';
      case 'high':
        return 'reject';
      default:
        return 'cautious';
    }
  }

  /**
   * 计算建议授信额度
   */
  private calculateCreditAmount(riskLevel: string, financialData: FinancialData): number | undefined {
    if (!financialData.netAssets) return undefined;

    const baseAmount = financialData.netAssets;
    const ratios: Record<string, number> = {
      low: 1.0,
      medium_low: 0.7,
      medium: 0.5,
      medium_high: 0.3,
      high: 0,
    };

    return baseAmount * (ratios[riskLevel] || 0.5);
  }

  /**
   * 计算建议授信期限
   */
  private calculateCreditPeriod(riskLevel: string): string {
    const periods: Record<string, string> = {
      low: '24 个月',
      medium_low: '18 个月',
      medium: '12 个月',
      medium_high: '6 个月',
      high: '不建议授信',
    };

    return periods[riskLevel] || '12 个月';
  }

  /**
   * 获取监控频率
   */
  private getMonitoringFrequency(riskLevel: string): 'annual' | 'semi_annual' | 'quarterly' | 'monthly' | 'real_time' {
    switch (riskLevel) {
      case 'low':
        return 'annual';
      case 'medium_low':
        return 'semi_annual';
      case 'medium':
        return 'quarterly';
      case 'medium_high':
        return 'monthly';
      case 'high':
        return 'real_time';
      default:
        return 'quarterly';
    }
  }

  /**
   * 提取关键风险指标
   */
  private extractKeyRiskIndicators(dimensions: DimensionScore[]): Record<string, any> {
    const indicators: Record<string, any> = {};

    for (const dim of dimensions) {
      indicators[`dimension_${dim.dimensionId}`] = {
        name: dim.dimensionName,
        score: dim.score,
        riskLevel: dim.riskLevel,
      };
    }

    return indicators;
  }
}
