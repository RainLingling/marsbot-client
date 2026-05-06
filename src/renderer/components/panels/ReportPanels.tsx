import { MARSBOT_LOGO_PATH } from "@/lib/brand";
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
import type { AnalysisResult, AppData } from "./panelTypes";

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


function NineDimensionPanel({ appData }: { appData: AppData }) {
  const [expandedDim, setExpandedDim] = React.useState<number | null>(null);
  const _analyzeDimensions = (trpc.loan.analyzeDimensions as any);
  const analysisResult = _analyzeDimensions.useMutation();
  const data = analysisResult.data as any;
  const isLoading = analysisResult.isPending;
  React.useEffect(() => {
    if (appData) {
      analysisResult.mutate({ applicationId: 0, appData });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(appData)]);
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Loader2 size={24} className="animate-spin mb-3" />
        <div className="text-sm">正在计算九维度指标…</div>
      </div>
    );
  }
  if (!data || !data.success) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <BarChart3 size={32} className="mb-3 opacity-30" />
        <div className="text-sm">请先上传文件以进行九维度分析</div>
        <div className="text-xs mt-1">需要财务报表、银行流水、纳税资料等数据</div>
      </div>
    );
  }
  const dims = data.dimensions || [];
  const riskInfo = RISK_LEVEL_LABELS[data.riskLevel] || RISK_LEVEL_LABELS.medium;
  const compositePercent = Math.round((data.compositeScore || 0) * 100);
  return (
    <div className="space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
      {/* 综合评分卡片 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-gray-900">九维度综合评估</div>
            <div className="text-[10px] text-gray-400 mt-0.5">基于 {dims.reduce((s: number, d: any) => s + Object.keys(d.indicators || {}).length, 0)} 个指标计算</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-700">{compositePercent}<span className="text-sm font-normal text-gray-400">/100</span></div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskInfo.bg} ${riskInfo.color} font-medium`}>{riskInfo.label}</span>
          </div>
        </div>
        {/* 综合评分条 */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${compositePercent}%`,
            backgroundColor: compositePercent >= 70 ? '#22c55e' : compositePercent >= 50 ? '#eab308' : compositePercent >= 30 ? '#f97316' : '#ef4444',
          }} />
        </div>
        {/* 授信建议 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg px-2 py-2 border border-gray-100">
            <div className="text-[10px] text-gray-400">授信建议</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5">{CREDIT_REC_LABELS[data.creditRecommendation || ''] || '—'}</div>
          </div>
          <div className="bg-white rounded-lg px-2 py-2 border border-gray-100">
            <div className="text-[10px] text-gray-400">建议额度</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5">{data.creditAmount ? `${(data.creditAmount / 10000).toFixed(0)}万` : '—'}</div>
          </div>
          <div className="bg-white rounded-lg px-2 py-2 border border-gray-100">
            <div className="text-[10px] text-gray-400">监控频率</div>
            <div className="text-xs font-semibold text-gray-800 mt-0.5">{MONITOR_LABELS[data.monitoringFrequency || ''] || '—'}</div>
          </div>
        </div>
      </div>
      {/* 一票否决项 */}
      {data.oneVoteVetoItems && data.oneVoteVetoItems.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-red-500">🚫</span>
            <span className="text-xs font-bold text-red-700">一票否决项 ({data.oneVoteVetoItems.length})</span>
          </div>
          <div className="space-y-1">
            {data.oneVoteVetoItems.map((item: string, i: number) => (
              <div key={i} className="text-xs text-red-600 bg-red-100 rounded-lg px-3 py-1.5">{item}</div>
            ))}
          </div>
        </div>
      )}
      {/* 九个维度卡片 */}
      <div className="space-y-2">
        {dims.map((dim: { dimensionId: number; dimensionName: string; score: number; indicators: Record<string, any>; riskLevel: string }) => {
          const dimInfo = DIMENSION_NAMES[dim.dimensionId] || { name: `维度${dim.dimensionId}`, icon: '📌', color: 'bg-gray-500', desc: '' };
          const dimRisk = RISK_LEVEL_LABELS[dim.riskLevel] || RISK_LEVEL_LABELS.medium;
          const scorePercent = Math.round((dim.score || 0) * 100);
          const isExpanded = expandedDim === dim.dimensionId;
          const indicators = dim.indicators || {};
          const indicatorEntries = Object.entries(indicators).filter(([k]) => !k.endsWith('Score'));
          return (
            <div key={dim.dimensionId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedDim(isExpanded ? null : dim.dimensionId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
              >
                <span className="text-base flex-shrink-0">{dimInfo.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{dimInfo.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{dimInfo.desc}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${scorePercent}%`,
                      backgroundColor: scorePercent >= 70 ? '#22c55e' : scorePercent >= 50 ? '#eab308' : scorePercent >= 30 ? '#f97316' : '#ef4444',
                    }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-8 text-right">{scorePercent}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${dimRisk.bg} ${dimRisk.color}`}>{dimRisk.label}</span>
                  <span className="text-gray-400 text-xs">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </button>
              {isExpanded && (() => {
                // 专业解读：根据实际指标数值生成动态解读
                const fmtPct = (v: number | undefined) => v != null ? (v * 100).toFixed(1) + '%' : null;
                const fmtX = (v: number | undefined) => v != null ? v.toFixed(2) + '倍' : null;
                const fmtNum = (v: number | undefined, unit = '') => v != null ? v.toFixed(2) + unit : null;
                const parts: string[] = [];
                const id = dim.dimensionId;
                const ind = dim.indicators || {};
                if (id === 1) {
                  if (ind.debtRatio != null) parts.push(`资产负债率 ${fmtPct(ind.debtRatio)}（安全线<60%，${ind.debtRatio > 0.75 ? '严重超标，偿债风险极高' : ind.debtRatio > 0.6 ? '偏高，存在偿债压力' : '合理'}）`);
                  if (ind.currentRatio != null) parts.push(`流动比率 ${fmtX(ind.currentRatio)}（${ind.currentRatio < 1.0 ? '低于1.0，短期偿债能力不足' : ind.currentRatio < 1.5 ? '1.0-1.5之间，偿债能力一般' : '大于1.5，短期偿债能力良好'}）`);
                  if (ind.quickRatio != null) parts.push(`速动比率 ${fmtX(ind.quickRatio)}（${ind.quickRatio < 0.5 ? '极低，流动性严重不足' : ind.quickRatio < 1.0 ? '偏低，需关注变现能力' : '正常'}）`);
                  if (ind.netProfitMargin != null) parts.push(`净利润率 ${fmtPct(ind.netProfitMargin)}（${ind.netProfitMargin < 0.02 ? '低于2%，盈利能力弱' : ind.netProfitMargin < 0.05 ? '2%-5%，盈利能力一般' : '超过5%，盈利能力较强'}）`);
                  if (ind.roe != null) parts.push(`ROE ${fmtPct(ind.roe)}（${ind.roe < 0.05 ? '低于5%，股东回报率差' : ind.roe < 0.1 ? '5%-10%，回报率一般' : '超过10%，股东回报率良好'}）`);
                  if (ind.roa != null) parts.push(`ROA ${fmtPct(ind.roa)}（${ind.roa < 0.02 ? '低于2%，资产利用效率低' : ind.roa < 0.05 ? '2%-5%，资产利用效率一般' : '超过5%，资产利用效率高'}）`);
                } else if (id === 2) {
                  if (ind.balanceCoverage != null) parts.push(`余额覆盖率 ${fmtX(ind.balanceCoverage)}（${ind.balanceCoverage < 0.5 ? '极低，资金链紧张' : ind.balanceCoverage < 1.0 ? '偏低，流动性一般' : '充足，流动性良好'}）`);
                  if (ind.incomeExpenseRatio != null) parts.push(`收支比 ${fmtX(ind.incomeExpenseRatio)}（${ind.incomeExpenseRatio < 1.0 ? '入不敷出，资金净流出' : ind.incomeExpenseRatio < 1.2 ? '略有盈余，资金状况偏紧' : '收入大于支出，资金状况良好'}）`);
                  if (ind.revenueMatchRate != null) parts.push(`流水与财报收入吻合度 ${fmtPct(ind.revenueMatchRate)}（${ind.revenueMatchRate < 0.6 ? '严重不符，存在虚假交易嫌疑' : ind.revenueMatchRate < 0.8 ? '存在一定偏差，需进一步核实' : '高度吻合，数据真实性高'}）`);
                } else if (id === 3) {
                  if (ind.taxRevenueRatio != null) parts.push(`税收收入比 ${fmtPct(ind.taxRevenueRatio)}（${ind.taxRevenueRatio < 0.01 ? '税负率极低，存在逃税嫌疑' : ind.taxRevenueRatio < 0.03 ? '税负率偏低，需关注申报合规性' : '税负率合理，纳税合规'}）`);
                  if (ind.taxRevenueMatchRate != null) parts.push(`申报收入与财报吻合度 ${fmtPct(ind.taxRevenueMatchRate)}（${ind.taxRevenueMatchRate < 0.7 ? '严重不符，财务数据可信度低' : ind.taxRevenueMatchRate < 0.85 ? '存在差异，需核实原因' : '高度吻合，数据可信'}）`);
                  if (ind.hasArrears != null) parts.push(ind.hasArrears ? '存在欠税记录，纳税合规性差' : '无欠税记录，纳税合规');
                } else if (id === 4) {
                  if (ind.creditUsageRate != null) parts.push(`他行授信使用率 ${fmtPct(ind.creditUsageRate)}（${ind.creditUsageRate > 0.8 ? '超过80%，授信高度饱和，多头借贷风险高' : ind.creditUsageRate > 0.6 ? '60%-80%，授信使用偏高，还款压力较大' : '低于60%，授信使用合理'}）`);
                  if (ind.hiddenLiabilityRatio != null) parts.push(`隐性负债比率 ${fmtPct(ind.hiddenLiabilityRatio)}（${ind.hiddenLiabilityRatio > 0.3 ? '超过30%，真实负债率远高于账面' : ind.hiddenLiabilityRatio > 0.1 ? '10%-30%，存在一定表外负债' : '较低，账面负债基本真实'}）`);
                } else if (id === 5) {
                  if (ind.customerConcentration != null) parts.push(`客户集中度 ${fmtPct(ind.customerConcentration)}（${ind.customerConcentration > 0.6 ? '超过60%，严重依赖单一客户，业务风险极高' : ind.customerConcentration > 0.4 ? '40%-60%，客户集中度偏高，存在流失风险' : '低于40%，客户分散，业务稳健'}）`);
                  if (ind.revenueGrowth != null) parts.push(`营收增长率 ${fmtPct(ind.revenueGrowth)}（${ind.revenueGrowth < -0.1 ? '营收下滑超10%，业务萎缩明显' : ind.revenueGrowth < 0 ? '营收轻微下滑，需关注业务趋势' : ind.revenueGrowth < 0.1 ? '营收基本持平，增长动力不足' : '营收增长良好，业务扩张中'}）`);
                } else if (id === 6) {
                  if (ind.overdueCount != null) parts.push(`逾期记录 ${ind.overdueCount} 次（${ind.overdueCount > 3 ? '多次逾期，信用严重受损' : ind.overdueCount > 0 ? '存在逾期记录，需关注还款意愿' : '无逾期记录，信用良好'}）`);
                  if (ind.litigationCount != null) parts.push(`涉诉案件 ${ind.litigationCount} 件（${ind.litigationCount > 5 ? '涉诉较多，法律风险高' : ind.litigationCount > 0 ? '存在诉讼，需关注案件性质' : '无诉讼记录，法律风险低'}）`);
                  if (ind.isBlacklisted != null) parts.push(ind.isBlacklisted ? '已被列为失信被执行人，高风险拒件' : '未列入失信名单，信用状况正常');
                } else if (id === 7) {
                  if (ind.relatedPartyTransactionRatio != null) parts.push(`关联交易占比 ${fmtPct(ind.relatedPartyTransactionRatio)}（${ind.relatedPartyTransactionRatio > 0.3 ? '超过30%，关联交易占比过高，存在利益输送嫌疑' : ind.relatedPartyTransactionRatio > 0.1 ? '10%-30%，关联交易较多，需关注公允性' : '低于10%，关联交易合理'}）`);
                  if (ind.guaranteeChainDepth != null) parts.push(`担保链深度 ${ind.guaranteeChainDepth} 层（${ind.guaranteeChainDepth > 3 ? '担保链过深，连带风险极高' : ind.guaranteeChainDepth > 1 ? '存在多层担保，需穿透核查' : '担保结构简单，风险可控'}）`);
                } else if (id === 8) {
                  if (ind.receivablesTurnoverDays != null) parts.push(`应收账款周转天数 ${fmtNum(ind.receivablesTurnoverDays, '天')}（${ind.receivablesTurnoverDays > 180 ? '超过180天，回款极慢，坏账风险高' : ind.receivablesTurnoverDays > 90 ? '90-180天，回款偏慢，需关注账龄' : '低于90天，回款及时，资产质量好'}）`);
                  if (ind.badDebtRatio != null) parts.push(`坏账率 ${fmtPct(ind.badDebtRatio)}（${ind.badDebtRatio > 0.1 ? '超过10%，坏账风险极高' : ind.badDebtRatio > 0.05 ? '5%-10%，坏账风险中等' : '低于5%，坏账风险可控'}）`);
                } else if (id === 9) {
                  if (ind.cashFlowCoverageRatio != null) parts.push(`现金流覆盖率 ${fmtX(ind.cashFlowCoverageRatio)}（${ind.cashFlowCoverageRatio < 0 ? '经营现金流为负，资金链极度紧张' : ind.cashFlowCoverageRatio < 1.0 ? '低于1.0，现金流无法覆盖短期债务' : ind.cashFlowCoverageRatio < 1.5 ? '1.0-1.5倍，偿债能力一般' : '超过1.5倍，偿债能力强'}）`);
                  if (ind.dscr != null) parts.push(`偿债覆盖率(DSCR) ${fmtX(ind.dscr)}（${ind.dscr < 1.0 ? '低于1.0，无法覆盖债务本息，违约风险高' : ind.dscr < 1.25 ? '1.0-1.25，偿债能力偏弱' : '超过1.25，偿债能力充足'}）`);
                  if (ind.cashToNetProfitRatio != null) parts.push(`现金净利润比 ${fmtX(ind.cashToNetProfitRatio)}（${ind.cashToNetProfitRatio < 0.5 ? '低于0.5，利润质量差，存在虚增利润嫌疑' : ind.cashToNetProfitRatio < 0.8 ? '0.5-0.8，利润质量一般' : '超过0.8，利润质量高，现金含量充足'}）`);
                }
                // 如果没有实际指标数据，显示预设解读
                const rl = dim.riskLevel;
                const isLow = rl === 'low' || rl === 'medium_low';
                const isMed = rl === 'medium';
                const bgCls = isLow ? 'bg-green-50 border-green-200' : isMed ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
                const textCls = isLow ? 'text-green-700' : isMed ? 'text-yellow-700' : 'text-red-700';
                const labelCls = isLow ? 'text-green-800' : isMed ? 'text-yellow-800' : 'text-red-800';
                const label = isLow ? '✅ 低风险解读' : isMed ? '△ 中等风险解读' : '⚠️ 高风险解读';
                const hasDynamicData = parts.length > 0;
                return (
                  <div className={`border-t border-gray-100 px-4 py-3`}>
                    <div className={`rounded-lg p-3 border ${bgCls}`}>
                      <div className={`text-[10px] font-semibold ${labelCls} mb-2`}>{label}</div>
                      {hasDynamicData ? (
                        <ul className={`space-y-1 text-[10px] leading-relaxed ${textCls}`}>
                          {parts.map((p, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="flex-shrink-0 mt-0.5">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`text-[10px] leading-relaxed ${textCls} opacity-70`}>暂无足够指标数据，请上传相关文件后重新分析</p>
                      )}
                    </div>
                  </div>
                );
              })()}
              {isExpanded && indicatorEntries.length > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <div className="text-[10px] text-gray-400 mb-2">指标明细 ({indicatorEntries.length} 个)</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {indicatorEntries.map(([key, value]) => {
                      const scoreKey = key + 'Score';
                      const score = indicators[scoreKey];
                      const READABLE_MAP: Record<string, string> = {
                        'pending': '待评估', 'false': '正常/未触发', 'true': '已触发/异常',
                        'low': '低风险', 'medium': '中等风险', 'high': '高风险', 'very_high': '极高风险',
                        'normal': '正常', 'abnormal': '异常', 'unknown': '未知',
                      };
                      const displayVal = typeof value === 'number' ? (value < 1 && value > -1 ? (value * 100).toFixed(1) + '%' : value.toFixed(2)) : (READABLE_MAP[String(value)] ?? String(value ?? '—'));
                      return (
                        <div key={key} className="flex items-center justify-between text-[10px] py-0.5 border-b border-gray-100">
                          <span className="text-gray-500 truncate max-w-[120px]">{INDICATOR_LABEL_MAP[key] || key}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-800 font-medium">{displayVal}</span>
                            {score != null && (
                              <span className={`w-1.5 h-1.5 rounded-full ${score >= 0.7 ? 'bg-green-400' : score >= 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── 财报分析面板 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type FARuleResult = { id: string; name: string; set: 'A' | 'B' | 'C' | 'D'; triggered: boolean; detail: string; level: 'warning' | 'info' | 'error' };

function FinancialAnalysisPanel({ appData }: { appData: AppData }) {
  const [activeSet, setActiveSet] = React.useState<'all' | 'A' | 'B' | 'C'>('all');
  const [onlyTriggered, setOnlyTriggered] = React.useState(false);

  const fsByYear = appData.financialStatementsByYear ?? {};
  const sortedYears = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
  // 优先选择年报（periodType = 'annual' 或 undefined），其次选最新报告
  const annualYears = sortedYears.filter(y => {
    const pt = fsByYear[y]?.periodType;
    return !pt || pt === 'annual';
  });
  const latestYearKey = annualYears[0] ?? sortedYears[0];
  const prevYearKey = annualYears[1] ?? (annualYears[0] ? sortedYears.find(y => y !== annualYears[0]) : sortedYears[1]);
  const latestFs = latestYearKey ? fsByYear[latestYearKey] : null;
  const prevFs = prevYearKey ? fsByYear[prevYearKey] : null;
  // 精确报告期显示标签（如 "2026-02（月报）"、"2025-Q3（季报）"、"2025（年报）"）
  const latestPeriodLabel = (() => {
    if (!latestYearKey || !fsByYear[latestYearKey]) return latestYearKey || '—';
    const { reportPeriod, periodType } = fsByYear[latestYearKey];
    if (!reportPeriod || reportPeriod === latestYearKey) return `${latestYearKey}（年报）`;
    const typeLabel = periodType === 'monthly' ? '月报' : periodType === 'quarterly' ? '季报' : periodType === 'interim' ? '半年报' : '年报';
    return `${reportPeriod}（${typeLabel}）`;
  })();

  function num(fs: typeof latestFs, key: string): number | null {
    if (!fs) return null;
    const src = { ...fs.balanceSheet, ...fs.incomeStatement, ...fs.cashFlowStatement } as Record<string, string | null>;
    // 字段名别名映射：兼容不同LLM解析器输出的key名称
    const KEY_ALIASES: Record<string, string[]> = {
      'revenue': ['revenue', 'operatingRevenue', 'totalRevenue', '营业收入', '营业总收入', '主营业务收入'],
      'netProfit': ['netProfit', 'netIncome', '净利润', '净利润（亏损）'],
      'operatingCashFlow': ['operatingCashFlow', 'netOperatingCashFlow', '经营活动产生的现金流量净额', '经营活动现金流量净额'],
      'totalAssets': ['totalAssets', '资产总计', '资产合计', '总资产'],
      'totalLiabilities': ['totalLiabilities', '负债合计', '负债总计', '总负债'],
      'currentAssets': ['currentAssets', 'totalCurrentAssets', '流动资产合计', '流动资产总计'],
      'currentLiabilities': ['currentLiabilities', 'totalCurrentLiabilities', '流动负债合计', '流动负债总计'],
      'inventory': ['inventory', '存货', '存货净额'],
      'totalEquity': ['totalEquity', 'shareholdersEquity', '所有者权益合计', '股东权益合计', '净资产'],
      'costOfRevenue': ['costOfRevenue', 'operatingCost', '营业成本', '主营业务成本'],
    };
    // 检查 sourceUnit：后端已换算为万元时跳过前端兆底换算
    const sourceUnit = (fs as any)?.sourceUnit as string | undefined;
    const skipAutoConvert = !!sourceUnit && sourceUnit !== '元';
    const keysToTry = KEY_ALIASES[key] ?? [key];
    for (const k of keysToTry) {
      const v = src[k];
      if (v !== null && v !== undefined && v !== '') {
        const sv = String(v).trim();
        if (sv === '' || sv.toLowerCase() === 'null' || sv.toLowerCase() === 'none') continue;
        const n = parseFloat(sv.replace(/,/g, ''));
        if (!isNaN(n)) {
          // 单位自动换算：如果数值绝对值 > 5亿，认为是"元"单位，换算为万元（后端已换算时跳过）
          if (!skipAutoConvert && Math.abs(n) > 5000000) return parseFloat((n / 10000).toFixed(4));
          return n;
        }
      }
    }
    // Bug9修复：对缺失的派生指标自动计算
    const g = (k: string) => {
      const val = src[k];
      if (val === null || val === undefined || val === '') return null;
      const n2 = parseFloat(String(val).replace(/,/g, ''));
      return isNaN(n2) ? null : n2;
    };
    if (key === 'debtRatio') {
      const totalAssets = g('totalAssets'); const totalLiab = g('totalLiabilities');
      if (totalAssets && totalLiab && totalAssets !== 0) return parseFloat((totalLiab / totalAssets * 100).toFixed(2));
    }
    if (key === 'currentRatio') {
      const ca = g('currentAssets') ?? g('totalCurrentAssets'); const cl = g('currentLiabilities') ?? g('totalCurrentLiabilities');
      if (ca !== null && cl !== null && cl !== 0) return parseFloat((ca / cl).toFixed(4));
    }
    if (key === 'quickRatio') {
      const ca = g('currentAssets') ?? g('totalCurrentAssets'); const inv = g('inventory') ?? 0; const cl = g('currentLiabilities') ?? g('totalCurrentLiabilities');
      if (ca !== null && cl !== null && cl !== 0) return parseFloat(((ca - (inv ?? 0)) / cl).toFixed(4));
    }
    if (key === 'grossMargin') {
      const rev = g('revenue') ?? g('operatingRevenue'); const cost = g('costOfRevenue') ?? g('operatingCost');
      if (rev && cost && rev !== 0) return parseFloat(((rev - cost) / rev * 100).toFixed(2));
    }
    if (key === 'netProfitMargin') {
      const rev = g('revenue') ?? g('operatingRevenue'); const np = g('netProfit');
      if (rev && np !== null && rev !== 0) return parseFloat((np / rev * 100).toFixed(2));
    }
    if (key === 'roe') {
      const np = g('netProfit'); const equity = g('totalEquity') ?? g('shareholdersEquity');
      if (np !== null && equity && equity !== 0) return parseFloat((np / equity * 100).toFixed(2));
    }
    if (key === 'grossProfit') {
      const rev = g('revenue') ?? g('operatingRevenue'); const cost = g('costOfRevenue') ?? g('operatingCost');
      if (rev !== null && cost !== null) return rev - cost;
    }
    return null;
  }

  // 套A 单期规则（14条）
  const rulesA: FARuleResult[] = [
    (() => {
      const revenue = num(latestFs, 'revenue');
      const triggered = revenue !== null && revenue <= 0;
      return { id: 'A01', name: '营业收入为零或负', set: 'A' as const, triggered, level: 'error' as const,
        detail: revenue !== null ? `营业收入: ${revenue}万元` : '数据缺失' };
    })(),
    (() => {
      const netProfit = num(latestFs, 'netProfit');
      const triggered = netProfit !== null && netProfit < 0;
      return { id: 'A02', name: '净利润为负（亏损）', set: 'A' as const, triggered, level: 'error' as const,
        detail: netProfit !== null ? `净利润: ${netProfit}万元` : '数据缺失' };
    })(),
    (() => {
      const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const triggered = ocf !== null && ocf < 0;
      return { id: 'A03', name: '经营现金流为负', set: 'A' as const, triggered, level: 'warning' as const,
        detail: ocf !== null ? `经营现金流: ${ocf}万元` : '数据缺失' };
    })(),
    (() => {
      const debtRatio = num(latestFs, 'debtRatio');
      const triggered = debtRatio !== null && debtRatio > 70;
      return { id: 'A04', name: '资产负债率>70%', set: 'A' as const, triggered, level: 'error' as const,
        detail: debtRatio !== null ? `资产负债率: ${debtRatio.toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const currentRatio = num(latestFs, 'currentRatio');
      const triggered = currentRatio !== null && currentRatio < 1;
      return { id: 'A05', name: '流动比率<1', set: 'A' as const, triggered, level: 'error' as const,
        detail: currentRatio !== null ? `流动比率: ${currentRatio.toFixed(2)}` : '数据缺失' };
    })(),
    (() => {
      const quickRatio = num(latestFs, 'quickRatio');
      const triggered = quickRatio !== null && quickRatio < 0.5;
      return { id: 'A06', name: '速动比率<0.5', set: 'A' as const, triggered, level: 'warning' as const,
        detail: quickRatio !== null ? `速动比率: ${quickRatio.toFixed(2)}` : '数据缺失' };
    })(),
    (() => {
      const roe = num(latestFs, 'roe');
      const triggered = roe !== null && roe < 0;
      return { id: 'A07', name: 'ROE为负', set: 'A' as const, triggered, level: 'warning' as const,
        detail: roe !== null ? `ROE: ${roe.toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const grossMargin = num(latestFs, 'grossMargin');
      const triggered = grossMargin !== null && grossMargin < 5;
      return { id: 'A08', name: '毛利率<5%', set: 'A' as const, triggered, level: 'warning' as const,
        detail: grossMargin !== null ? `毛利率: ${grossMargin.toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const totalAssets = num(latestFs, 'totalAssets');
      const totalLiabilities = num(latestFs, 'totalLiabilities');
      const equity = totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null;
      const triggered = equity !== null && equity < 0;
      return { id: 'A09', name: '所有者权益为负（资不抵债）', set: 'A' as const, triggered, level: 'error' as const,
        detail: equity !== null ? `所有者权益: ${equity.toFixed(0)}万元` : '数据缺失' };
    })(),
    (() => {
      const revenue = num(latestFs, 'revenue');
      const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const triggered = revenue !== null && ocf !== null && revenue > 0 && ocf / revenue < 0.05;
      return { id: 'A10', name: '现金含量比<5%（收入含金量低）', set: 'A' as const, triggered, level: 'warning' as const,
        detail: revenue !== null && ocf !== null ? `现金含量比: ${(ocf/revenue*100).toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const netProfitMargin = num(latestFs, 'netProfitMargin');
      const triggered = netProfitMargin !== null && netProfitMargin < 1;
      return { id: 'A11', name: '净利润率<1%', set: 'A' as const, triggered, level: 'warning' as const,
        detail: netProfitMargin !== null ? `净利润率: ${netProfitMargin.toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const financialExpenses = num(latestFs, 'financialExpenses') ?? num(latestFs, 'financialExpense');
      const revenue = num(latestFs, 'revenue');
      const triggered = financialExpenses !== null && revenue !== null && revenue > 0 && financialExpenses / revenue > 0.1;
      return { id: 'A12', name: '财务费用占收入>10%', set: 'A' as const, triggered, level: 'warning' as const,
        detail: financialExpenses !== null && revenue !== null ? `财务费用占比: ${(financialExpenses/revenue*100).toFixed(2)}%` : '数据缺失' };
    })(),
    (() => {
      const investingCashFlow = num(latestFs, 'investingCashFlow');
      const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const triggered = investingCashFlow !== null && ocf !== null && ocf < 0 && investingCashFlow < 0;
      return { id: 'A13', name: '经营现金流和投资现金流同时为负', set: 'A' as const, triggered, level: 'error' as const,
        detail: `经营CF: ${ocf ?? '--'}, 投资CF: ${investingCashFlow ?? '--'}` };
    })(),
    (() => {
      const financingCashFlow = num(latestFs, 'financingCashFlow');
      const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const triggered = financingCashFlow !== null && ocf !== null && ocf < 0 && financingCashFlow > 0;
      return { id: 'A14', name: '经营现金流为负但筹资现金流为正（借新还旧）', set: 'A' as const, triggered, level: 'error' as const,
        detail: `经营CF: ${ocf ?? '--'}, 筹资CF: ${financingCashFlow ?? '--'}` };
    })(),
  ];

  // 套B 跨期规则（8条）
  const rulesB: FARuleResult[] = [
    (() => {
      const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue');
      const triggered = r0 !== null && r1 !== null && r1 > 0 && (r0 - r1) / r1 < -0.2;
      return { id: 'B01', name: '营业收入同比下降>20%', set: 'B' as const, triggered, level: 'error' as const,
        detail: r0 !== null && r1 !== null ? `收入变动: ${((r0-r1)/r1*100).toFixed(2)}%` : '缺少对比年数据' };
    })(),
    (() => {
      const p0 = num(latestFs, 'netProfit'); const p1 = num(prevFs, 'netProfit');
      const triggered = p0 !== null && p1 !== null && p1 > 0 && (p0 - p1) / p1 < -0.3;
      return { id: 'B02', name: '净利润同比下降>30%', set: 'B' as const, triggered, level: 'error' as const,
        detail: p0 !== null && p1 !== null ? `利润变动: ${((p0-p1)/p1*100).toFixed(2)}%` : '缺少对比年数据' };
    })(),
    (() => {
      const d0 = num(latestFs, 'debtRatio'); const d1 = num(prevFs, 'debtRatio');
      const triggered = d0 !== null && d1 !== null && (d0 - d1) > 10;
      return { id: 'B03', name: '资产负债率同比上升>10pct', set: 'B' as const, triggered, level: 'warning' as const,
        detail: d0 !== null && d1 !== null ? `负债率变化: +${(d0-d1).toFixed(1)}pct` : '缺少对比年数据' };
    })(),
    (() => {
      const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue');
      const p0 = num(latestFs, 'netProfit'); const p1 = num(prevFs, 'netProfit');
      const revenueUp = r0 !== null && r1 !== null && r0 > r1;
      const profitDown = p0 !== null && p1 !== null && p0 < p1;
      const triggered = revenueUp && profitDown;
      return { id: 'B04', name: '收入增但利润降（成本失控）', set: 'B' as const, triggered, level: 'warning' as const,
        detail: `收入: ${r1?.toFixed(0)}→${r0?.toFixed(0)}, 利润: ${p1?.toFixed(0)}→${p0?.toFixed(0)}` };
    })(),
    (() => {
      const ocf0 = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const ocf1 = num(prevFs, 'operatingCashFlow') ?? num(prevFs, 'netOperatingCashFlow');
      const triggered = ocf0 !== null && ocf1 !== null && ocf1 > 0 && (ocf0 - ocf1) / ocf1 < -0.3;
      return { id: 'B05', name: '经营现金流同比下降>30%', set: 'B' as const, triggered, level: 'warning' as const,
        detail: ocf0 !== null && ocf1 !== null ? `现金流变动: ${((ocf0-ocf1)/Math.abs(ocf1)*100).toFixed(2)}%` : '缺少对比年数据' };
    })(),
    (() => {
      const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue');
      const ocf0 = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const ocf1 = num(prevFs, 'operatingCashFlow') ?? num(prevFs, 'netOperatingCashFlow');
      const revenueUp = r0 !== null && r1 !== null && r0 > r1;
      const cashDown = ocf0 !== null && ocf1 !== null && ocf0 < ocf1;
      const triggered = revenueUp && cashDown;
      return { id: 'B06', name: '收入增但现金流降（回款质量下降）', set: 'B' as const, triggered, level: 'warning' as const,
        detail: `收入: ${r1?.toFixed(0)}→${r0?.toFixed(0)}, 现金流: ${ocf1?.toFixed(0)}→${ocf0?.toFixed(0)}` };
    })(),
    (() => {
      const eq0 = num(latestFs, 'ownersEquity'); const eq1 = num(prevFs, 'ownersEquity');
      const triggered = eq0 !== null && eq1 !== null && eq1 > 0 && (eq0 - eq1) / eq1 < -0.2;
      return { id: 'B07', name: '所有者权益同比下降>20%', set: 'B' as const, triggered, level: 'error' as const,
        detail: eq0 !== null && eq1 !== null ? `权益变动: ${((eq0-eq1)/eq1*100).toFixed(2)}%` : '缺少对比年数据' };
    })(),
    (() => {
      const gm0 = num(latestFs, 'grossMargin'); const gm1 = num(prevFs, 'grossMargin');
      const triggered = gm0 !== null && gm1 !== null && (gm0 - gm1) < -5;
      return { id: 'B08', name: '毛利率同比下降>5pct', set: 'B' as const, triggered, level: 'warning' as const,
        detail: gm0 !== null && gm1 !== null ? `毛利率变化: ${(gm0-gm1).toFixed(1)}pct` : '缺少对比年数据' };
    })(),
  ];

  // 套C 三源交叉规则（6条）
  const taxRevenue = appData.taxData ? parseFloat(String((appData.taxData as Record<string,unknown>).totalRevenue ?? '0').replace(/,/g,'')) || null : null;
  const bankMonthlyAvg = appData.bankData ? parseFloat(String((appData.bankData as Record<string,unknown>).monthlyAvgIncome ?? '0').replace(/,/g,'')) || null : null;
  const fsRevenue = num(latestFs, 'revenue');
  const rulesC: FARuleResult[] = [
    (() => {
      const triggered = fsRevenue !== null && taxRevenue !== null && taxRevenue > 0 && Math.abs(fsRevenue - taxRevenue) / taxRevenue > 0.3;
      return { id: 'C01', name: '财务收入与纳税收入差异>30%', set: 'C' as const, triggered, level: 'error' as const,
        detail: fsRevenue !== null && taxRevenue !== null ? `财务: ${fsRevenue.toFixed(0)}, 纳税: ${taxRevenue.toFixed(0)}, 差异: ${Math.abs(fsRevenue-taxRevenue).toFixed(0)}万元` : '缺少纳税数据' };
    })(),
    (() => {
      const annualBank = bankMonthlyAvg !== null ? bankMonthlyAvg * 12 : null;
      const triggered = fsRevenue !== null && annualBank !== null && annualBank > 0 && Math.abs(fsRevenue - annualBank) / annualBank > 0.5;
      return { id: 'C02', name: '财务收入与流水年化差异>50%', set: 'C' as const, triggered, level: 'warning' as const,
        detail: fsRevenue !== null && annualBank !== null ? `财务: ${fsRevenue.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少流水数据' };
    })(),
    (() => {
      const netProfit = num(latestFs, 'netProfit');
      const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
      const triggered = netProfit !== null && ocf !== null && netProfit > 0 && ocf < 0;
      return { id: 'C03', name: '利润为正但经营现金流为负（利润质量差）', set: 'C' as const, triggered, level: 'error' as const,
        detail: `净利润: ${netProfit?.toFixed(0)}, 经营CF: ${ocf?.toFixed(0)}万元` };
    })(),
    (() => {
      const annualTax = taxRevenue;
      const annualBank = bankMonthlyAvg !== null ? bankMonthlyAvg * 12 : null;
      const triggered = annualTax !== null && annualBank !== null && annualBank > 0 && Math.abs(annualTax - annualBank) / annualBank > 0.4;
      return { id: 'C04', name: '纳税收入与流水年化差异>40%', set: 'C' as const, triggered, level: 'warning' as const,
        detail: annualTax !== null && annualBank !== null ? `纳税: ${annualTax.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少纳税或流水数据' };
    })(),
    (() => {
      const totalAssets = num(latestFs, 'totalAssets');
      const totalLiabilities = num(latestFs, 'totalLiabilities');
      const equity = totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null;
      const annualBank = bankMonthlyAvg !== null ? bankMonthlyAvg * 12 : null;
      const triggered = equity !== null && annualBank !== null && annualBank > 0 && equity / annualBank > 5;
      return { id: 'C05', name: '净资产远超流水收入（虚增资产嫌疑）', set: 'C' as const, triggered, level: 'warning' as const,
        detail: equity !== null && annualBank !== null ? `净资产: ${equity.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少相关数据' };
    })(),
    (() => {
      const netProfit = num(latestFs, 'netProfit');
      const annualBank = bankMonthlyAvg !== null ? bankMonthlyAvg * 12 : null;
      const triggered = netProfit !== null && annualBank !== null && annualBank > 0 && netProfit > 0 && netProfit / annualBank > 0.8;
      return { id: 'C06', name: '利润占流水收入比>80%（利润虚高嫌疑）', set: 'C' as const, triggered, level: 'warning' as const,
        detail: netProfit !== null && annualBank !== null ? `利润: ${netProfit.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少相关数据' };
    })(),
  ];

  // 套D 客户集中度与收入稳定性规则（5条）
  const top5Customers = appData.top5Customers;
  const latestTop5 = top5Customers && top5Customers.length > 0
    ? top5Customers.slice().sort((a, b) => String(b.year).localeCompare(String(a.year)))[0]
    : null;
  const top5Items = latestTop5?.items ?? [];
  // Top5Item.ratio is a string (e.g. "35.2" or "35.2%"), need to parse
  const parseRatio = (r: string | undefined): number => {
    if (!r) return 0;
    const v = parseFloat(r.replace('%','').replace(',','').trim());
    return isNaN(v) ? 0 : v;
  };
  const top1Ratio = top5Items.length > 0 ? parseRatio(top5Items[0]?.ratio) : null;
  const top1RatioNorm = top1Ratio !== null ? (top1Ratio > 1 ? top1Ratio / 100 : top1Ratio) : null;
  const top3RatioNorm = top5Items.length >= 3
    ? (() => {
        const total = top5Items.slice(0, 3).reduce((s, i) => s + parseRatio(i.ratio), 0);
        return total > 1 ? total / 100 : total;
      })()
    : null;
  // HHI 计算
  const hhiVal = top5Items.length > 0
    ? top5Items.reduce((s, i) => {
        const r = parseRatio(i.ratio);
        const rNorm = r > 1 ? r / 100 : r;
        return s + rNorm * rNorm;
      }, 0)
    : null;
  // 收入稳定性：与上一年对比
  const bankMonthlyRevs = appData.bankData
    ? (() => {
        const bd = appData.bankData as Record<string, unknown>;
        if (Array.isArray(bd.monthlyStats)) {
          return (bd.monthlyStats as any[]).map(m => parseFloat(String(m.income ?? m.inflow ?? '0').replace(/,/g,'')) || 0).filter(v => v > 0);
        }
        if (Array.isArray(bd.monthlyRevenues)) {
          return (bd.monthlyRevenues as any[]).map(v => parseFloat(String(v).replace(/,/g,'')) || 0).filter(v => v > 0);
        }
        return null;
      })()
    : null;
  const bankCV = bankMonthlyRevs && bankMonthlyRevs.length > 0
    ? (() => {
        const avg = bankMonthlyRevs.reduce((a, b) => a + b, 0) / bankMonthlyRevs.length;
        const variance = bankMonthlyRevs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / bankMonthlyRevs.length;
        return avg > 0 ? Math.sqrt(variance) / avg : null;
      })()
    : null;
  // 收入与发票匹配度
  const invoiceTotal = (() => {
    const docs = appData.parsedDocuments;
    if (!docs) return null;
    const invDoc = docs.find(d => d.fileType === 'invoice');
    if (!invDoc) return null;
    const d = invDoc.data as Record<string, unknown>;
    const v = d.totalAmount ?? d.invoiceTotal ?? d.amount;
    return v != null ? parseFloat(String(v).replace(/,/g,'')) || null : null;
  })();
  const rulesD: FARuleResult[] = [
    (() => {
      const triggered = hhiVal !== null && hhiVal > 0.25;
      return { id: 'D01', name: `客户集中度HHI指数 > 0.25（高集中度风险）`, set: 'D' as const, triggered, level: 'error' as const,
        detail: hhiVal !== null ? `HHI = ${hhiVal.toFixed(3)}（HHI = Σ各客户占比²，>0.25为高集中度，>0.5为极高集中度）` : '缺少客户集中度数据（需上传销售台账或公司介绍）' };
    })(),
    (() => {
      const triggered = top1RatioNorm !== null && top1RatioNorm > 0.5;
      const isHard = top1RatioNorm !== null && top1RatioNorm > 0.7;
      return { id: 'D02', name: `Top1客户依赖度 > ${isHard ? '70%(硬性风险)' : '50%(扣分预警)'}`, set: 'D' as const, triggered, level: isHard ? 'error' as const : 'warning' as const,
        detail: top1RatioNorm !== null ? `第一大客户占比: ${(top1RatioNorm * 100).toFixed(2)}%（>50%扣分，>70%硬性风险提示）` : '缺少客户占比数据' };
    })(),
    (() => {
      const triggered = bankCV !== null && bankCV > 0.3;
      return { id: 'D03', name: '月度收入波动率 > 30%（收入不稳定）', set: 'D' as const, triggered, level: 'warning' as const,
        detail: bankCV !== null ? `月收入变异系数CV = ${(bankCV * 100).toFixed(2)}%（>30%为收入不稳定警告，基于${bankMonthlyRevs?.length ?? 0}个月流水数据）` : '缺少银行流水月度数据' };
    })(),
    (() => {
      const annualBank = bankMonthlyRevs && bankMonthlyRevs.length > 0
        ? bankMonthlyRevs.reduce((a, b) => a + b, 0) / bankMonthlyRevs.length * 12
        : null;
      const fsRevNum2 = fsRevenue != null ? Number(fsRevenue) : null;
      const diff = fsRevNum2 !== null && annualBank !== null && annualBank > 0
        ? Math.abs(fsRevNum2 - annualBank) / annualBank
        : null;
      const triggered = diff !== null && diff > 0.2;
      return { id: 'D04', name: '收入与流水匹配度差异 > 20%(收入真实性存疑)', set: 'D' as const, triggered, level: triggered ? 'error' as const : 'warning' as const,
        detail: diff !== null ? `财务收入: ${fsRevenue != null ? Number(fsRevenue).toFixed(0) : '--'}万, 流水年化: ${annualBank?.toFixed(0)}万, 差异: ${(diff * 100).toFixed(2)}%(>20%触发"收入真实性存疑")` : '缺少财务报表或银行流水数据' };
    })(),
    (() => {
      const fsRevNum = fsRevenue != null ? Number(fsRevenue) : null;
      const diff = fsRevNum !== null && invoiceTotal !== null && invoiceTotal > 0
        ? Math.abs(fsRevNum - invoiceTotal) / Math.max(fsRevNum, invoiceTotal)
        : null;
      const triggered = diff !== null && diff > 0.2;
      return { id: 'D05', name: '收入与发票匹配度差异 > 20%(存在未开票收入或虚开嫌疑)', set: 'D' as const, triggered, level: triggered ? 'error' as const : 'warning' as const,
        detail: diff !== null ? `财务收入: ${fsRevNum?.toFixed(0)}万, 发票金额: ${invoiceTotal?.toFixed(0)}万, 差异: ${(diff * 100).toFixed(2)}%(>20%触发"存在未开票收入或虚开嫌疑")` : '缺少财务报表或发票数据' };
    })(),
  ];
  const allRules = [...rulesA, ...rulesB, ...rulesC, ...rulesD];
  const displayRules = allRules
    .filter(r => activeSet === 'all' || r.set === activeSet)
    .filter(r => !onlyTriggered || r.triggered);
  const triggeredCount = allRules.filter(r => r.triggered).length;
  const noData = !latestFs;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-orange-500" />
            <span className="text-sm font-semibold text-gray-800">财务报表分析</span>
            <span className="text-xs text-gray-400">共 33 条规则</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            <Download size={12} /> 导出 PDF
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all','A','B','C'] as const).map(s => (
            <button key={s} onClick={() => setActiveSet(s)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                activeSet === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}>
              {s === 'all' ? '全部规则' : s === 'A' ? '套A 单期(14)' : s === 'B' ? '套B 跨期(8)' : '套C 三源(6)'}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={onlyTriggered} onChange={e => setOnlyTriggered(e.target.checked)} className="rounded" />
            仅显示触发项
          </label>
        </div>
        {triggeredCount > 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600 font-medium">共触发 {triggeredCount} 条风险规则，请重点关注</span>
          </div>
        )}
        {triggeredCount === 0 && !noData && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
            <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
            <span className="text-xs text-green-600 font-medium">所有规则均未触发，财务状况良好</span>
          </div>
        )}
        {noData && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-100 rounded-lg">
            <AlertCircle size={13} className="text-yellow-500 flex-shrink-0" />
            <span className="text-xs text-yellow-600">请先上传财务报表文件，解析完成后自动运行分析</span>
          </div>
        )}
      </div>
      {/* 财务报表综合分析报告 */}
      {!noData && (() => {
        const revenue = num(latestFs, 'revenue');
        const netProfit = num(latestFs, 'netProfit');
        const totalAssets = num(latestFs, 'totalAssets');
        const totalLiab = num(latestFs, 'totalLiabilities');
        const ocf = num(latestFs, 'operatingCashFlow') ?? num(latestFs, 'netOperatingCashFlow');
        const currentAssets = num(latestFs, 'currentAssets') ?? num(latestFs, 'totalCurrentAssets');
        const currentLiab = num(latestFs, 'currentLiabilities') ?? num(latestFs, 'totalCurrentLiabilities');
        const inventory = num(latestFs, 'inventory');
        const costOfRevenue = num(latestFs, 'costOfRevenue');
        const prevRevenue = num(prevFs, 'revenue');
        const prevNetProfit = num(prevFs, 'netProfit');

        const debtRatio = (totalAssets && totalLiab && totalAssets !== 0) ? (totalLiab / totalAssets * 100) : null;
        const currentRatio = (currentAssets && currentLiab && currentLiab !== 0) ? (currentAssets / currentLiab) : null;
        const quickRatio = (currentAssets != null && inventory != null && currentLiab && currentLiab !== 0) ? ((currentAssets - inventory) / currentLiab) : null;
        const grossMargin = (revenue && costOfRevenue && revenue !== 0) ? ((revenue - costOfRevenue) / revenue * 100) : null;
        const netMargin = (revenue && netProfit && revenue !== 0) ? (netProfit / revenue * 100) : null;
        const revenueGrowth = (prevRevenue && prevRevenue !== 0 && revenue != null) ? ((revenue - prevRevenue) / Math.abs(prevRevenue) * 100) : null;
        const profitGrowth = (prevNetProfit && prevNetProfit !== 0 && netProfit != null) ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit) * 100) : null;

        const triggeredErrors = allRules.filter(r => r.triggered && r.level === 'error');
        const triggeredWarnings = allRules.filter(r => r.triggered && r.level === 'warning');

        const overallRisk = triggeredErrors.length >= 3 ? '高风险' : triggeredErrors.length >= 1 ? '中高风险' : triggeredWarnings.length >= 2 ? '中等风险' : '低风险';
        const riskColor = overallRisk === '高风险' ? 'text-red-700 bg-red-50 border-red-200' : overallRisk === '中高风险' ? 'text-orange-700 bg-orange-50 border-orange-200' : overallRisk === '中等风险' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' : 'text-green-700 bg-green-50 border-green-200';

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-gray-800">财务报表综合分析报告</span>
              <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${riskColor}`}>{overallRisk}</span>
            </div>

            {/* 核心指标摘要 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: '营业收入', value: revenue != null ? `${revenue.toFixed(0)}万` : '--', sub: revenueGrowth != null ? `同比${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(2)}%` : '', subColor: revenueGrowth != null ? (revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400' },
                { label: '净利润', value: netProfit != null ? `${netProfit.toFixed(0)}万` : '--', sub: profitGrowth != null ? `同比${profitGrowth >= 0 ? '+' : ''}${profitGrowth.toFixed(2)}%` : '', subColor: profitGrowth != null ? (profitGrowth >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400' },
                { label: '经营现金流', value: ocf != null ? `${ocf.toFixed(0)}万` : '--', sub: ocf != null ? (ocf >= 0 ? '现金流健康' : '现金流异常') : '', subColor: ocf != null ? (ocf >= 0 ? 'text-green-500' : 'text-red-500') : 'text-gray-400' },
                { label: '资产负债率', value: debtRatio != null ? `${debtRatio.toFixed(2)}%` : '--', sub: debtRatio != null ? (debtRatio > 70 ? '偏高，需关注' : debtRatio > 50 ? '适中' : '较低') : '', subColor: debtRatio != null ? (debtRatio > 70 ? 'text-red-500' : debtRatio > 50 ? 'text-yellow-500' : 'text-green-500') : 'text-gray-400' },
                { label: '流动比率', value: currentRatio != null ? currentRatio.toFixed(2) : '--', sub: currentRatio != null ? (currentRatio < 1 ? '短期偿债不足' : currentRatio < 1.5 ? '偿债能力一般' : '偿债能力良好') : '', subColor: currentRatio != null ? (currentRatio < 1 ? 'text-red-500' : currentRatio < 1.5 ? 'text-yellow-500' : 'text-green-500') : 'text-gray-400' },
                { label: '毛利率', value: grossMargin != null ? `${grossMargin.toFixed(2)}%` : '--', sub: grossMargin != null ? (grossMargin < 0 ? '主业亏损' : grossMargin < 10 ? '盈利能力弱' : grossMargin < 30 ? '盈利能力一般' : '盈利能力较强') : '', subColor: grossMargin != null ? (grossMargin < 0 ? 'text-red-500' : grossMargin < 10 ? 'text-yellow-500' : 'text-green-500') : 'text-gray-400' },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                  <div className="text-sm font-bold text-gray-800">{item.value}</div>
                  <div className={`text-[10px] mt-0.5 ${item.subColor}`}>{item.sub}</div>
                </div>
              ))}
            </div>

            {/* 盈利能力分析 */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><TrendingUp size={12} className="text-blue-500" />盈利能力分析</div>
              <div className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2.5">
                {revenue != null && netProfit != null ? (
                  <>
                    企业{latestPeriodLabel ? latestPeriodLabel : '最近报告期'}营业收入为 <span className="font-semibold text-blue-700">{revenue.toFixed(0)}万元</span>，
                    净利润为 <span className={`font-semibold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{netProfit.toFixed(0)}万元</span>，
                    净利润率为 <span className="font-semibold">{netMargin != null ? `${netMargin.toFixed(2)}%` : '--'}</span>。
                    {revenueGrowth != null && (
                      <> 与上年同期相比，营业收入{revenueGrowth >= 0 ? <span className="text-green-700">增长{revenueGrowth.toFixed(2)}%</span> : <span className="text-red-700">下降{Math.abs(revenueGrowth).toFixed(2)}%</span>}。</>
                    )}
                    {netProfit < 0 && <span className="text-red-700 font-medium"> 企业处于亏损状态，需重点关注亏损原因及持续性。</span>}
                    {netProfit >= 0 && netMargin != null && netMargin < 3 && <span className="text-yellow-700"> 净利润率偏低，盈利能力较弱，抗风险能力有限。</span>}
                    {netProfit >= 0 && netMargin != null && netMargin >= 3 && <span className="text-green-700"> 盈利能力尚可，具备一定的债务偿还能力。</span>}
                  </>
                ) : '财务报表数据不完整，无法进行盈利能力分析。'}
              </div>
            </div>

            {/* 偿债能力分析 */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Shield size={12} className="text-purple-500" />偿债能力分析</div>
              <div className="text-xs text-gray-600 leading-relaxed bg-purple-50 rounded-lg px-3 py-2.5">
                {debtRatio != null || currentRatio != null || quickRatio != null ? (
                  <>
                    {debtRatio != null && <>资产负债率为 <span className={`font-semibold ${debtRatio > 70 ? 'text-red-700' : debtRatio > 50 ? 'text-yellow-700' : 'text-green-700'}`}>{debtRatio.toFixed(2)}%</span>，{debtRatio > 80 ? '财务杠杆极高，偿债压力巨大，存在较高违约风险。' : debtRatio > 70 ? '财务杠杆偏高，需关注债务结构和到期安排。' : debtRatio > 50 ? '财务杠杆适中，偿债能力尚可。' : '财务杠杆较低，偿债能力较强。'} </>
                    }{currentRatio != null && <>流动比率为 <span className={`font-semibold ${currentRatio < 1 ? 'text-red-700' : 'text-gray-700'}`}>{currentRatio.toFixed(2)}</span>，{currentRatio < 1 ? '流动资产无法覆盖流动负债，短期偿债存在缺口。' : currentRatio < 1.5 ? '短期偿债能力一般，需关注流动性风险。' : '短期偿债能力良好。'} </>
                    }{quickRatio != null && <>速动比率为 <span className={`font-semibold ${quickRatio < 0.5 ? 'text-red-700' : 'text-gray-700'}`}>{quickRatio.toFixed(2)}</span>，{quickRatio < 0.5 ? '即时偿债能力严重不足，存在流动性危机风险。' : quickRatio < 1 ? '即时偿债能力偏弱。' : '即时偿债能力良好。'}</>
                    }
                  </>
                ) : '偿债能力相关数据缺失，无法进行分析。'}
              </div>
            </div>

            {/* 现金流质量分析 */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Activity size={12} className="text-green-500" />现金流质量分析</div>
              <div className="text-xs text-gray-600 leading-relaxed bg-green-50 rounded-lg px-3 py-2.5">
                {ocf != null ? (
                  <>
                    经营活动现金流净额为 <span className={`font-semibold ${ocf >= 0 ? 'text-green-700' : 'text-red-700'}`}>{ocf.toFixed(0)}万元</span>。
                    {ocf < 0 && ' 经营现金流为负，企业日常经营无法产生正向现金，依赖外部融资维持运营，流动性风险较高。'}
                    {ocf >= 0 && netProfit != null && ocf < netProfit * 0.5 && ' 经营现金流远低于净利润，利润质量存疑，需核查应收账款回收情况。'}
                    {ocf >= 0 && netProfit != null && ocf >= netProfit * 0.5 && ' 经营现金流与利润基本匹配，利润质量较好，资金回收能力正常。'}
                    {ocf >= 0 && netProfit == null && ' 经营现金流为正，企业具备基本的自我造血能力。'}
                  </>
                ) : '现金流量表数据缺失，建议要求企业补充提供。'}
              </div>
            </div>

            {/* 风险汇总与建议 */}
            {(triggeredErrors.length > 0 || triggeredWarnings.length > 0) && (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-orange-500" />风险汇总与授信建议</div>
                <div className={`text-xs leading-relaxed rounded-lg px-3 py-2.5 border ${riskColor}`}>
                  <div className="font-semibold mb-1.5">综合评估：{overallRisk}</div>
                  {triggeredErrors.length > 0 && (
                    <div className="mb-1.5">
                      <span className="font-medium text-red-700">严重风险项（{triggeredErrors.length}条）：</span>
                      {triggeredErrors.map(r => r.name).join('、')}。
                    </div>
                  )}
                  {triggeredWarnings.length > 0 && (
                    <div className="mb-1.5">
                      <span className="font-medium text-yellow-700">警示项（{triggeredWarnings.length}条）：</span>
                      {triggeredWarnings.map(r => r.name).join('、')}。
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <span className="font-medium">授信建议：</span>
                    {triggeredErrors.length >= 3 ? '建议拒绝授信，财务风险过高。' :
                     triggeredErrors.length >= 1 ? '建议审慎授信，需补充尽职调查材料，并考虑降低授信额度或要求追加担保。' :
                     triggeredWarnings.length >= 2 ? '可考虑有条件授信，建议加强贷后监控，定期获取财务报表。' :
                     '财务风险可控，可按正常流程推进授信审批。'}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <div className="space-y-2">
        {displayRules.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-300">{onlyTriggered ? '无触发项' : '无规则'}</div>
        )}
        {displayRules.map(rule => (
          <div key={rule.id} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
            rule.triggered
              ? rule.level === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
              : 'bg-white border-gray-100'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {rule.triggered
                ? rule.level === 'error' ? <XCircle size={14} className="text-red-500" /> : <AlertTriangle size={14} className="text-yellow-500" />
                : <CheckCircle2 size={14} className="text-green-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  rule.set === 'A' ? 'bg-blue-100 text-blue-600' : rule.set === 'B' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'
                }`}>{rule.id}</span>
                <span className={`text-xs font-medium ${rule.triggered ? (rule.level === 'error' ? 'text-red-700' : 'text-yellow-700') : 'text-gray-600'}`}>
                  {rule.name}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{rule.detail}</div>
              {/* 触发项的完整风险解读 */}
              {rule.triggered && (() => {
                const interpretations: Record<string, string> = {
                  'A01': '营业收入为零或负，说明企业在报告期内几乎没有正常经营活动，可能存在停产、歇业或虚报收入的情况。这是最严重的财务风险信号之一，贷款机构通常会直接拒绝此类申请。建议核实企业是否仍在正常运营，并要求提供银行流水佐证。',
                  'A02': '净利润为负表明企业当期处于亏损状态，主营业务盈利能力不足或费用控制失当。持续亏损将侵蚀企业净资产，削弱偿债能力。需重点分析亏损原因：是行业周期性下行、一次性损失，还是结构性问题。若为结构性亏损，贷款风险较高。',
                  'A03': '经营现金流为负意味着企业日常经营活动消耗现金而非产生现金，即使账面盈利也可能面临流动性危机（"纸面富贵"）。这通常预示应收账款回收困难、存货积压或预付款过大。需结合利润表判断是否存在利润与现金流严重背离的情况。',
                  'A04': '资产负债率超过70%，说明企业超过70%的资产依赖负债融资，财务杠杆偏高，抗风险能力较弱。一旦经营出现波动，可能面临债务偿还压力。需进一步分析负债结构：有息负债占比、短期债务到期压力，以及是否存在隐性负债。',
                  'A05': '流动比率低于1，说明企业流动资产不足以覆盖流动负债，短期偿债能力存在缺口，存在流动性风险。若同时伴随经营现金流为负，则短期违约风险显著上升。建议核查是否存在银行授信额度可用于应急周转。',
                  'A06': '速动比率低于0.5，在剔除存货后，企业的即时偿债能力严重不足。这对于存货变现能力差的行业（如制造业、零售业）尤为危险。需评估存货的实际变现价值和账龄结构。',
                  'A07': '其他应收款占总资产比例过高（>15%），通常是资金体外循环、关联方占款或虚构资产的重要信号。需要求企业提供其他应收款明细，核实款项性质及回收可能性。',
                  'A08': '毛利率为负，说明企业产品售价低于直接成本，主营业务本身处于亏损状态。这是极为严重的经营风险，可能反映产品竞争力丧失、原材料成本暴涨或恶意低价竞争。',
                  'A09': '净利润率低于1%，企业盈利能力极弱，几乎无法积累资本。在面临任何不利因素时，极易转为亏损。需分析是否存在费用虚增或收入压低的情况。',
                  'A10': '有息负债占总资产比例超过50%，企业承担了大量付息债务，财务费用负担重。需计算利息保障倍数，评估企业是否有足够的经营利润覆盖利息支出。',
                  'A11': '应收账款周转天数超过180天，说明企业货款回收极为缓慢，存在大量坏账风险或关联方虚假交易。需核查前五大应收账款客户的资质及账龄分布。',
                  'A12': '存货周转天数超过365天，存货积压严重，可能存在滞销、质量问题或虚增存货的情况。需实地核查存货实物，评估其实际可变现价值。',
                  'A13': '现金流与净利润比值为负（经营现金流/净利润<0），说明账面利润无法转化为实际现金，利润质量极差。这是财务造假的重要预警信号，需重点核查收入确认政策和应收账款真实性。',
                  'A14': '净资产为负（资不抵债），企业已处于技术性破产状态，所有者权益为负值。在此情况下，债权人的权益无法得到保障，贷款风险极高，通常应直接拒绝。',
                  'B01': '营业收入连续下滑，说明企业市场竞争力持续减弱或所在行业景气度下行。需分析下滑原因，判断是否为周期性调整还是结构性衰退，并评估未来收入恢复的可能性。',
                  'B02': '净利润连续下滑，盈利能力持续恶化，企业经营质量趋势向下。需结合收入变化分析是收入下滑导致还是成本费用上升所致，前者更为严重。',
                  'B03': '资产负债率持续上升，企业杠杆率不断提高，财务风险积累。若伴随盈利能力下滑，则债务偿还压力将快速上升，需关注是否存在债务滚动困难的迹象。',
                  'B04': '经营现金流持续为负，企业长期无法通过经营活动产生正向现金流，依赖外部融资维持运营。这种模式不可持续，需评估企业商业模式的根本可行性。',
                  'B05': '毛利率持续下滑，定价能力或成本控制能力持续恶化。需分析行业竞争格局变化，判断企业是否面临不可逆的竞争劣势。',
                  'B06': '净利润与经营现金流长期背离（利润持续为正但现金流持续为负），是财务报表粉饰的典型特征。需要求提供银行流水进行交叉验证。',
                  'B07': '应收账款持续增加且增速超过收入增速，可能存在放宽信用政策冲量或虚增收入的情况。需核查新增应收账款的客户质量和账龄。',
                  'B08': '存货持续增加且增速超过收入增速，存货积压风险上升。需评估存货跌价准备是否充分，以及是否存在存货虚增。',
                  'C01': '财务报表收入与增值税申报收入差异超过20%，是财务数据真实性存疑的重要信号。差异可能源于收入确认时间差、税务筹划，也可能是财务造假。需要求企业提供详细解释和佐证材料。',
                  'C02': '财务报表收入与银行流水回款差异超过30%，说明账面收入与实际资金流入严重不符，财务数据可信度低。这是贷款欺诈的高风险信号，需重点核查。',
                  'C03': '税负率异常偏低（低于行业均值50%以上），可能存在虚开发票、少报收入或过度税务筹划的情况，需要求企业提供合理解释。',
                  'C04': '财务报表与工商登记注册资本差异过大，可能存在实缴资本不足或虚假出资的情况，影响企业信用评估。',
                  'C05': '三方数据交叉验证不通过，多个数据来源之间存在矛盾，财务数据整体可信度存疑，建议进行现场尽职调查。',
                  'C06': '银行流水与申报收入严重不符，实际资金流动与申报数据脱节，存在隐匿收入或资金体外循环的可能。',
                };
                const text = interpretations[rule.id];
                return text ? (
                  <div className={`mt-2 text-[11px] leading-relaxed rounded-lg px-3 py-2 ${
                    rule.level === 'error' ? 'bg-red-100/60 text-red-800' : 'bg-yellow-100/60 text-yellow-800'
                  }`}>
                    <span className="font-semibold">风险解读：</span>{text}
                  </div>
                ) : null;
              })()}
            </div>
            <div className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
              rule.triggered
                ? rule.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                : 'bg-green-100 text-green-600'
            }`}>
              {rule.triggered ? '触发' : '正常'}
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}

// ─── 信贷分析报告面板 ─────────────────────────────────────────────────────────────
function CreditReportPanel({ appData, result }: { appData: AppData; result: AnalysisResult | null }) {
  const reportDate = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const reportNo = `MB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <FileText size={40} className="mb-4 opacity-20" />
        <div className="text-sm font-medium">尚未生成信贷报告</div>
        <div className="text-xs mt-1.5 text-gray-300">完成 AI 分析后，系统将自动生成完整信贷分析报告</div>
      </div>
    );
  }

  const sc = result.layer3?.scorecard;
  const lc = result.layer3?.limitCalculation;
  const re = result.layer3?.ruleEngine;
  const fs = result.layer3?.featureSummary;

  const verdictConfig = {
    approved:  { label: "建议批准",   color: "text-green-700",  bg: "bg-green-50 border-green-300",  badge: "bg-green-600" },
    reduced:   { label: "建议降额通过", color: "text-amber-700", bg: "bg-amber-50 border-amber-300",  badge: "bg-amber-500" },
    rejected:  { label: "建议拒绝",   color: "text-red-700",    bg: "bg-red-50 border-red-300",      badge: "bg-red-600" },
  }[result.verdict];

  const gradeColor = (g?: string) => {
    if (!g) return "text-gray-500 bg-gray-100";
    if (["AAA", "AA", "A"].includes(g)) return "text-green-700 bg-green-100";
    if (["BBB", "BB"].includes(g)) return "text-blue-700 bg-blue-100";
    if (["B", "CCC"].includes(g)) return "text-orange-700 bg-orange-100";
    return "text-red-700 bg-red-100";
  };

  // 财务指标辅助
  const fv = fs?.values || {};
  const fd = fs?.featureDetails || {};
  const fmt = (v: number | null | undefined, unit = "", dec = 2) =>
    v === null || v === undefined ? "—" : `${v.toFixed(dec)}${unit}`;
  const fmtPct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`;

  // 多年财务数据
  const yearlyData = appData.financialStatementsByYear;
  const years = yearlyData ? Object.keys(yearlyData).sort().reverse() : [];

  return (
    <div className="space-y-0 text-gray-800 font-sans">
      {/* ── 报告封面 ── */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-orange-900 rounded-xl p-6 mb-4 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={MARSBOT_LOGO_PATH} alt="Marsbot" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-orange-400 text-lg font-bold tracking-widest">MARSBOT</span>
                </div>
                <span className="text-gray-400 text-xs border border-gray-600 px-1.5 py-0.5 rounded">AI 信贷决策系统</span>
              </div>
              <h1 className="text-white text-xl font-bold leading-tight">企业信贷综合分析报告</h1>
              <p className="text-gray-400 text-xs mt-1">Corporate Credit Comprehensive Analysis Report</p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold text-white ${verdictConfig.badge}`}>
              {verdictConfig.label}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300">
            <div><span className="text-gray-500">申请主体：</span><span className="text-white font-medium">{appData.companyName || "—"}</span></div>
            <div><span className="text-gray-500">统一信用代码：</span><span className="font-mono">{appData.creditCode || "—"}</span></div>
            <div><span className="text-gray-500">报告编号：</span><span className="font-mono text-orange-300">{reportNo}</span></div>
            <div><span className="text-gray-500">报告日期：</span><span>{reportDate}</span></div>
            <div><span className="text-gray-500">申请金额：</span><span className="text-orange-300 font-medium">{appData.amount ? `${appData.amount} 万元` : "—"}</span></div>
            <div><span className="text-gray-500">贷款类型：</span><span>{appData.loanType || "—"}</span></div>
          </div>
        </div>
      </div>

      {/* ── 一、综合结论 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">一</span>
          <span className="text-sm font-bold text-gray-800">综合结论与授信建议</span>
        </div>
        <div className="p-5">
          <div className={`rounded-xl border-2 p-4 mb-4 ${verdictConfig.bg}`}>
            <div className="flex items-center gap-3 mb-2">
              {result.verdict === "approved" ? <CheckCircle2 size={20} className="text-green-600" /> :
               result.verdict === "reduced" ? <AlertTriangle size={20} className="text-amber-500" /> :
               <XCircle size={20} className="text-red-500" />}
              <span className={`text-base font-bold ${verdictConfig.color}`}>{verdictConfig.label}</span>
              {sc && <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full ${gradeColor(sc.creditGrade)}`}>{sc.creditGrade} 级</span>}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{sc?.recommendation || "综合评估意见待生成。"}</p>
          </div>

          {/* 核心指标摘要 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "综合信用评分", value: sc ? `${sc.score}` : "—", sub: "满分1000分", color: "text-orange-600" },
              { label: "违约概率 PD", value: sc ? `${(sc.scorePD * 100).toFixed(2)}%` : "—", sub: "预期违约概率", color: sc && sc.scorePD < 0.05 ? "text-green-600" : "text-red-600" },
              { label: "建议授信额度", value: lc?.recommendedLimit != null ? `${Math.max(0, lc.recommendedLimit)}万` : "—", sub: "三法取最小值", color: "text-blue-600" },
              { label: "规则引擎", value: re?.passed ? "全部通过" : `触发${re?.triggeredRules?.length || 0}条`, sub: "8条硬性准入规则", color: re?.passed ? "text-green-600" : "text-red-600" },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 二、申请主体基本情况 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">二</span>
          <span className="text-sm font-bold text-gray-800">申请主体基本情况</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              { label: "企业名称", value: appData.companyName },
              { label: "统一社会信用代码", value: appData.creditCode },
              { label: "法定代表人", value: appData.legalPerson },
              { label: "注册资本", value: appData.registeredCapital },
              { label: "成立日期", value: appData.establishDate },
              { label: "注册地址", value: appData.address },
              { label: "所属行业", value: appData.industry },
              { label: "企业类型", value: appData.companyType || "有限责任公司" },
              { label: "申请金额", value: appData.amount ? `${appData.amount} 万元` : undefined },
              { label: "贷款类型", value: appData.loanType },
              { label: "贷款期限", value: appData.period ? `${appData.period} 个月` : undefined },
              { label: "贷款用途", value: appData.purpose },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2 py-1.5 border-b border-gray-50">
                <span className="text-gray-400 text-xs w-28 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="text-gray-800 text-xs font-medium flex-1">{item.value || <span className="text-gray-300">未提供</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 三、准入规则审查 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">三</span>
          <span className="text-sm font-bold text-gray-800">准入规则审查结果</span>
          {re && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${re.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {re.passed ? "✓ 全部通过" : `✗ 触发 ${re.triggeredRules.length} 条`}
            </span>
          )}
        </div>
        <div className="p-5">
          {!re ? (
            <div className="text-xs text-gray-400 text-center py-4">规则引擎数据待加载</div>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed bg-gray-50 rounded-lg px-3 py-2">{re.summary}</p>
              {re.triggeredRules.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-red-600 mb-2">已触发规则明细：</div>
                  {re.triggeredRules.map(rule => (
                    <div key={rule.ruleId} className="flex items-start gap-3 bg-red-50 rounded-lg p-3 border border-red-100">
                      <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-red-700">[{rule.ruleId}] {rule.ruleName}</div>
                        <div className="text-xs text-red-600 mt-0.5">{rule.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {re.passed && (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3 border border-green-100">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-xs text-green-700">所有 8 条硬性准入规则均已通过，申请主体符合基本准入条件。</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── 四、甲方（债务人）评估 — 保理/供应链融资专项 ── */}
      {appData.counterpartyInfo?.name && (
        <section className="bg-white rounded-xl border border-indigo-200 overflow-hidden mb-4">
          <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">四</span>
            <span className="text-sm font-bold text-gray-800">甲方（债务人）评估</span>
            <span className="ml-auto text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">保理/供应链融资专项</span>
          </div>
          <div className="p-5">
            {/* 甲方基本信息 */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-5">
              {[
                { label: "甲方企业名称", value: appData.counterpartyInfo.name },
                { label: "统一社会信用代码", value: appData.counterpartyInfo.creditCode },
                { label: "企业类型", value: appData.counterpartyInfo.enterpriseType },
                { label: "行业地位", value: appData.counterpartyInfo.industryPosition },
                { label: "合同金额", value: appData.counterpartyInfo.contractAmount ? `${appData.counterpartyInfo.contractAmount}万元` : undefined },
                { label: "历史合作账期", value: appData.counterpartyInfo.paymentTermDays ? `${appData.counterpartyInfo.paymentTermDays}天` : undefined },
                { label: "付款方式", value: appData.counterpartyInfo.paymentMethod },
                { label: "甲方集中度", value: appData.counterpartyInfo.arConcentrationRatio !== undefined ? `${(appData.counterpartyInfo.arConcentrationRatio * 100).toFixed(2)}%` : undefined },
                { label: "合同签订日期", value: appData.counterpartyInfo.contractSignDate },
                { label: "申请保理日期", value: appData.counterpartyInfo.factoringApplyDate },
                { label: "发票金额", value: appData.counterpartyInfo.invoiceAmount ? `${appData.counterpartyInfo.invoiceAmount}万元` : undefined },
                { label: "历史回款金额", value: appData.counterpartyInfo.historicalRepaymentAmount ? `${appData.counterpartyInfo.historicalRepaymentAmount}万元` : undefined },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 py-1.5 border-b border-gray-50">
                  <span className="text-gray-400 text-xs w-28 flex-shrink-0 pt-0.5">{item.label}</span>
                  <span className="text-gray-800 text-xs font-medium flex-1">{item.value || <span className="text-gray-300">未提供</span>}</span>
                </div>
              ))}
            </div>

            {/* 甲方资质评估 */}
            {(() => {
              const cp = appData.counterpartyInfo;
              const hasOverdue = cp.hasOverdueHistory;
              const concentration = cp.arConcentrationRatio;
              const paymentTerm = cp.paymentTermDays;
              // 资质评分：0-100
              let qualScore = 60; // 基础分
              if (hasOverdue === false) qualScore += 15;
              if (hasOverdue === true) qualScore -= 25;
              if (paymentTerm && paymentTerm >= 30 && paymentTerm <= 180) qualScore += 10;
              if (concentration !== undefined && concentration <= 0.3) qualScore += 15;
              if (concentration !== undefined && concentration > 0.6) qualScore -= 20;
              qualScore = Math.max(0, Math.min(100, qualScore));
              const qualLevel = qualScore >= 75 ? { label: '优质', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
                : qualScore >= 55 ? { label: '良好', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' }
                : qualScore >= 40 ? { label: '一般', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
                : { label: '较差', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
              // 集中度风险等级
              const concRisk = concentration === undefined ? { label: '未知', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' }
                : concentration <= 0.3 ? { label: '低风险', color: 'text-green-700', bg: 'bg-green-50 border-green-200' }
                : concentration <= 0.6 ? { label: '中等风险', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
                : { label: '高风险', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
              return (
                <div className="space-y-4">
                  {/* 甲方资质评估卡 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl border p-3 ${qualLevel.bg}`}>
                      <div className="text-[10px] text-gray-500 mb-1">甲方信用资质评估</div>
                      <div className={`text-xl font-bold ${qualLevel.color}`}>{qualLevel.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">资质分：{qualScore}/100</div>
                    </div>
                    <div className={`rounded-xl border p-3 ${concRisk.bg}`}>
                      <div className="text-[10px] text-gray-500 mb-1">甲方集中度风险</div>
                      <div className={`text-xl font-bold ${concRisk.color}`}>{concRisk.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">占比：{concentration !== undefined ? `${(concentration * 100).toFixed(2)}%` : '未提供'}</div>
                    </div>
                  </div>

                  {/* 逾期记录评估 */}
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${hasOverdue === true ? 'bg-red-50 border-red-200' : hasOverdue === false ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    {hasOverdue === true ? <AlertTriangle size={14} className="text-red-500 flex-shrink-0" /> : hasOverdue === false ? <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" /> : <AlertTriangle size={14} className="text-gray-400 flex-shrink-0" />}
                    <div>
                      <div className={`text-xs font-semibold ${hasOverdue === true ? 'text-red-700' : hasOverdue === false ? 'text-green-700' : 'text-gray-500'}`}>
                        {hasOverdue === true ? `甲方存在逾期记录${cp.overdueDays ? `（逾期${cp.overdueDays}天）` : ''}` : hasOverdue === false ? '甲方无逾期记录' : '逾期记录未确认'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {hasOverdue === true ? '建议加强资金封闭条件，降低保理比例至应收账款的 70%以下' : hasOverdue === false ? '历史付款记录良好，交易真实性评估加分' : '建议通过企查查或征信报告核实甲方信用历史'}
                      </div>
                    </div>
                  </div>

                  {/* 交易真实性验证规则 */}
                  {re && re.triggeredRules.filter(r => r.ruleId.startsWith('R-FACT-')).length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-amber-600 mb-2">交易真实性验证预警：</div>
                      {re.triggeredRules.filter(r => r.ruleId.startsWith('R-FACT-')).map(rule => (
                        <div key={rule.ruleId} className="flex items-start gap-3 bg-amber-50 rounded-lg p-3 border border-amber-100">
                          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-semibold text-amber-700">[{rule.ruleId}] {rule.ruleName}</div>
                            <div className="text-xs text-amber-600 mt-0.5">{rule.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3 border border-green-100">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-xs text-green-700">交易真实性验证通过：发票金额与回款匹配、甲方集中度、保理间隔均符合要求。</span>
                    </div>
                  )}

                  {/* 综合结论 */}
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <div className="text-xs font-semibold text-indigo-700 mb-1.5">甲方评估综合结论</div>
                    <div className="text-xs text-indigo-600 leading-relaxed">
                      {cp.name}作为保理申请的债务人，经综合评估其信用资质为「{qualLevel.label}」级别。
                      {concentration !== undefined && <span>单一甲方应收账款集中度{(concentration * 100).toFixed(2)}%，属{concRisk.label}。</span>}
                      {hasOverdue === false && <span>历史付款记录良好，交易真实性评估加分。</span>}
                      {hasOverdue === true && <span>存在逾期记录，建议强化资金封闭条件。</span>}
                      {re && re.triggeredRules.filter(r => r.ruleId.startsWith('R-FACT-')).length > 0
                        ? `触发${re.triggeredRules.filter(r => r.ruleId.startsWith('R-FACT-')).length}条交易验证预警，建议进行进一步尽调核实。`
                        : '交易真实性验证全部通过，保理申请基本符合要求。'}
                    </div>
                  </div>

                  {cp.notes && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-xs font-semibold text-gray-600 mb-1">备注说明</div>
                      <div className="text-xs text-gray-600 leading-relaxed">{cp.notes}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ── 五、信用评分卡分析 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">五</span>
          <span className="text-sm font-bold text-gray-800">信用评分卡分析</span>
        </div>
        <div className="p-5">
          {!sc ? (
            <div className="text-xs text-gray-400 text-center py-4">评分卡数据待加载</div>
          ) : (
            <>
              {/* 总分 */}
              <div className="flex items-center gap-6 mb-5 pb-4 border-b border-gray-100">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">{sc.score}</div>
                  <div className="text-xs text-gray-400 mt-1">综合信用分（满分1000）</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold px-4 py-1.5 rounded-xl ${gradeColor(sc.creditGrade)}`}>{sc.creditGrade}</div>
                  <div className="text-xs text-gray-400 mt-1">信用等级</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{(sc.scorePD * 100).toFixed(2)}%</div>
                  <div className="text-xs text-gray-400 mt-1">预期违约概率 PD</div>
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                    <div className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full" style={{ width: `${(sc.score / 1000) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>0</span><span>250</span><span>500</span><span>750</span><span>1000</span>
                  </div>
                </div>
              </div>

              {/* 三维评分 */}
              <div className="text-xs font-semibold text-gray-600 mb-3">三维评分明细</div>
              <div className="space-y-3 mb-4">
                {[
                  { label: "主体资质评分", value: sc.subjectQualityScore, contrib: sc.scoreBreakdown?.subjectContribution, color: "bg-blue-500",
                    desc: "基于工商登记、司法记录、法人信用等维度综合评估企业主体资质。", weight: sc.scoreBreakdown?.subjectWeight },
                  { label: "财务健康评分", value: sc.financialHealthScore, contrib: sc.scoreBreakdown?.financialContribution, color: "bg-green-500",
                    desc: "基于财务报表（资产负债率、流动比率、盈利能力等）评估财务健康状况。", weight: sc.scoreBreakdown?.financialWeight },
                  { label: "经营稳定性评分", value: sc.operationStabilityScore, contrib: sc.scoreBreakdown?.operationContribution, color: "bg-purple-500",
                    desc: "基于营收增长、现金流稳定性、行业风险等评估经营持续稳定性。", weight: sc.scoreBreakdown?.operationWeight },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                        {item.weight !== undefined && (
                          <span className="ml-2 text-xs text-gray-400">权重 {(item.weight * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-bold text-gray-800">{item.value}<span className="text-xs text-gray-400">/100</span></span>
                        {item.contrib !== undefined && (
                          <span className="ml-2 text-xs text-gray-500">贡献 {item.contrib.toFixed(0)}分</span>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.value}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                    <div className="mt-1.5 text-[11px]">
                      {item.value >= 80 ? <span className="text-green-600">✓ 评分优秀，风险较低</span> :
                       item.value >= 60 ? <span className="text-amber-600">△ 评分中等，存在一定风险</span> :
                       <span className="text-red-600">✗ 评分偏低，是主要风险因素</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 惩罚分 */}
              {sc.scoreBreakdown && sc.scoreBreakdown.penaltyPoints !== 0 && (
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <div className="text-xs font-semibold text-orange-700 mb-1">⚠ 惩罚扣分项</div>
                  <div className="text-xs text-orange-600">本次评分因风险因素扣除 <strong>{Math.abs(sc.scoreBreakdown.penaltyPoints)}</strong> 分，主要原因：数据不完整或存在负面指标。</div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── 六、财务状况分析 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">六</span>
          <span className="text-sm font-bold text-gray-800">财务状况分析</span>
        </div>
        <div className="p-5">
          {/* 核心财务指标 */}
          <div className="text-xs font-semibold text-gray-600 mb-3">核心财务指标（来源：上传财务报表）</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {[
              { label: "年营业收入", value: fv.revenue != null ? `${(fv.revenue as number).toFixed(2)} 万元` : (appData.revenue ? `${appData.revenue} 万元` : "—"), good: true },
              { label: "净利润", value: fv.netProfit != null ? `${(fv.netProfit as number).toFixed(2)} 万元` : (appData.netProfit ? `${appData.netProfit} 万元` : "—"), good: true },
              { label: "总资产", value: fv.totalAssets != null ? `${(fv.totalAssets as number).toFixed(2)} 万元` : (appData.totalAssets ? `${appData.totalAssets} 万元` : "—"), good: true },
              { label: "总负债", value: fv.totalLiabilities != null ? `${(fv.totalLiabilities as number).toFixed(2)} 万元` : (appData.totalLiabilities ? `${appData.totalLiabilities} 万元` : "—"), good: false },
              { label: "资产负债率", value: fv.F13_debtRatio != null ? `${(fv.F13_debtRatio as number).toFixed(2)}%` : (fv.totalAssets && fv.totalLiabilities ? `${((fv.totalLiabilities as number) / (fv.totalAssets as number) * 100).toFixed(2)}%` : "—"), good: false },
              { label: "流动比率", value: fv.F14_currentRatio != null ? fmt(fv.F14_currentRatio) : (appData.currentRatio ? `${appData.currentRatio}` : "—"), good: true },
              { label: "速动比率", value: fv.F15_quickRatio != null ? fmt(fv.F15_quickRatio) : (appData.quickRatio ? `${appData.quickRatio}` : "—"), good: true },
              { label: "净资产收益率 ROE", value: fv.F19_roe != null ? `${(fv.F19_roe as number).toFixed(2)}%` : (appData.roe ? `${appData.roe}%` : "—"), good: true },
              { label: "经营现金流", value: fv.operatingCashFlow != null ? `${(fv.operatingCashFlow as number).toFixed(2)} 万元` : (appData.operatingCashFlow ? `${appData.operatingCashFlow} 万元` : "—"), good: true },
              { label: "毛利率", value: fv.F18_netProfitMargin != null ? fmtPct(fv.F18_netProfitMargin) : "—", good: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className={`text-xs font-semibold ${item.value === "—" ? "text-gray-300" : "text-gray-800"}`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* 多年财务对比 */}
          {years.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-3">多年度财务数据对比</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium border border-gray-100 w-32">指标</th>
                      {years.map(y => {
                        const yd = yearlyData![y];
                        const pLabel = yd?.reportPeriod && yd.reportPeriod !== y
                          ? `${yd.reportPeriod}${yd.periodType === 'monthly' ? '(月报)' : yd.periodType === 'quarterly' ? '(季报)' : yd.periodType === 'interim' ? '(半年报)' : ''}`
                          : `${y}年`;
                        return <th key={y} className="text-right px-3 py-2 text-gray-700 font-semibold border border-gray-100">{pLabel}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "营业收入（万元）", key: "revenue" },
                      { label: "净利润（万元）", key: "netProfit" },
                      { label: "总资产（万元）", key: "totalAssets" },
                      { label: "资产负债率（%）", key: "debtRatio" },
                    ].map((row, ri) => (
                      <tr key={row.key} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 text-gray-600 border border-gray-100">{row.label}</td>
                        {years.map(y => {
                          const yd = yearlyData![y];
                          const bs = yd?.balanceSheet || {};
                          const is = yd?.incomeStatement || {};
                          const val = row.key === "revenue" ? (is.revenue || is.营业收入 || is.营业总收入) :
                                      row.key === "netProfit" ? (is.netProfit || is.净利润) :
                                      row.key === "totalAssets" ? (bs.totalAssets || bs.资产合计 || bs.总资产) :
                                      row.key === "debtRatio" ? (bs.debtToAssetRatio || bs.资产负债率) : null;
                          return (
                            <td key={y} className="px-3 py-2 text-right text-gray-700 font-medium border border-gray-100">
                              {val || <span className="text-gray-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {years.length === 0 && !appData.revenue && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle size={12} className="inline mr-1" />
              未上传财务报表，财务分析数据不完整。建议上传近2年审计报告以获取完整财务评估。
            </div>
          )}
        </div>
      </section>

      {/* ── 七、授信额度测算 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">七</span>
          <span className="text-sm font-bold text-gray-800">授信额度测算（三法）</span>
        </div>
        <div className="p-5">
          {!lc ? (
            <div className="text-xs text-gray-400 text-center py-4">额度测算数据待加载</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { name: "收入法", value: lc.revenueMethodLimit, desc: "年营业收入 × 授信系数", color: "border-blue-200 bg-blue-50" },
                  { name: "净资产法", value: lc.netAssetMethodLimit, desc: "净资产 × 保守系数", color: "border-green-200 bg-green-50" },
                  { name: "现金流法", value: lc.cashFlowMethodLimit != null && lc.cashFlowMethodLimit < 0 ? 0 : lc.cashFlowMethodLimit, desc: lc.cashFlowMethodLimit != null && lc.cashFlowMethodLimit < 0 ? `经营现金流为负（原始值${lc.cashFlowMethodLimit?.toFixed(0)}万），建议额度按0处理` : "月均经营现金流 × 期限", color: "border-purple-200 bg-purple-50" },
                ].map(m => (
                  <div key={m.name} className={`rounded-xl border-2 p-4 ${m.color}`}>
                    <div className="text-xs text-gray-500 mb-1">{m.name}</div>
                    {m.value !== null && m.value !== undefined ? (
                      <div className="text-xl font-bold text-gray-800">{m.value}<span className="text-sm text-gray-400 ml-1">万元</span></div>
                    ) : (
                      <div className="text-sm text-gray-400">数据不足</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">{m.desc}</div>
                  </div>
                ))}
              </div>

              {/* 计算公式明细 */}
              {lc.methodDetails && lc.methodDetails.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="text-xs font-semibold text-gray-600 mb-2">计算公式明细</div>
                  <div className="space-y-2">
                    {lc.methodDetails.map(d => (
                      <div key={d.method} className="text-xs">
                        <span className="font-medium text-gray-700">{d.method}：</span>
                        <span className="font-mono text-gray-500">{d.formula}</span>
                        <span className="text-gray-400 ml-2">= {d.result} 万元</span>
                        {d.isBinding && <span className="ml-2 text-orange-600 font-medium">（约束方法）</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 最终额度 */}
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200 p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">建议授信额度（三法取最小值）</div>
                    <div className="text-3xl font-bold text-orange-600">
                      {lc.recommendedLimit !== null && lc.recommendedLimit !== undefined ? Math.max(0, lc.recommendedLimit) : "—"}
                      <span className="text-base text-gray-400 ml-1">万元</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">最终批准额度</div>
                    <div className="text-2xl font-bold text-gray-800">
                      {lc.approvedAmount != null ? Math.max(0, lc.approvedAmount) : "—"}
                      <span className="text-sm text-gray-400 ml-1">万元</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">批准比例 {Math.round(lc.approvalRatio * 100)}%</div>
                  </div>
                </div>
              </div>

              {/* 授信为0原因详细分析 */}
              {lc.approvedAmount === 0 && lc.zeroAmountReasons && lc.zeroAmountReasons.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={14} className="text-red-500" />
                    <span className="text-sm font-bold text-red-700">授信额度为0元 — 具体原因分析</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 leading-relaxed bg-white rounded-lg px-3 py-2 border border-red-100">
                    尽管申请人综合信用分达到 <strong>{sc?.score}</strong> 分（{sc?.creditGrade}级），但授信额度为0元的根本原因如下。这不是评分系统的失误，而是授信额度测算三法（收入法/净资产法/现金流法）均无法计算出有效额度。
                  </p>
                  <div className="space-y-3">
                    {lc.zeroAmountReasons.map((r, i) => (
                      <div key={i} className="bg-white rounded-lg border border-red-100 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">{r.category}</span>
                          <span className="text-xs font-semibold text-red-700">{r.reason}</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 leading-relaxed">{r.detail}</p>
                        <div className="flex items-start gap-1.5 bg-blue-50 rounded-lg p-2">
                          <Info size={10} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          <span className="text-[11px] text-blue-700"><strong>建议：</strong>{r.suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">ℹ️ 小贷公司风控层建议</div>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      评分系统显示申请人具备基本信用资质，但授信额度测算需要进一步数据支撑。
                      <strong>下一步行动：</strong>请要求申请人补传近两年审计财务报表、鈣章版银行流水及纳税申报表，
                      如数据完整则可重新评估授信额度。建议人工复核。
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── 八、主要风险提示 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">八</span>
          <span className="text-sm font-bold text-gray-800">主要风险提示</span>
        </div>
        <div className="p-5 space-y-3">
          {/* 数据缺失风险 */}
          {fs?.missingDataChain && fs.missingDataChain.missingItems.length > 0 && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
              <div className="text-xs font-semibold text-amber-700 mb-2">⚠ 数据缺失风险（影响评估准确性）</div>
              <div className="space-y-1.5">
                {fs.missingDataChain.missingItems.map(item => (
                  <div key={item.fileType} className="flex items-start gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      item.severity === "critical" ? "bg-red-100 text-red-600" :
                      item.severity === "important" ? "bg-amber-100 text-amber-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {item.severity === "critical" ? "必须" : item.severity === "important" ? "重要" : "可选"}
                    </span>
                    <div>
                      <span className="font-medium text-gray-700">缺少 {item.fileName}</span>
                      {item.affectedScoring.length > 0 && (
                        <div className="text-gray-500 mt-0.5">→ 影响：{item.affectedScoring.join("；")}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 规则触发风险 */}
          {re && !re.passed && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-3">
              <div className="text-xs font-semibold text-red-700 mb-2">✗ 准入规则触发风险</div>
              <div className="text-xs text-red-600">已触发 {re.triggeredRules.length} 条硬性准入规则，建议在审批前核实相关情况。</div>
            </div>
          )}

          {/* 评分偏低风险 */}
          {sc && sc.score < 600 && (
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-3">
              <div className="text-xs font-semibold text-orange-700 mb-2">△ 信用评分偏低风险</div>
              <div className="text-xs text-orange-600">综合信用评分 {sc.score} 分，低于 600 分警戒线，建议加强担保措施或降低授信额度。</div>
            </div>
          )}

          {/* 无风险提示 */}
          {(!fs?.missingDataChain || fs.missingDataChain.missingItems.length === 0) && re?.passed && sc && sc.score >= 600 && (
            <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3 border border-green-100">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-xs text-green-700">未发现重大风险提示，申请主体整体风险可控。</span>
            </div>
          )}
        </div>
      </section>

      {/* ── 九、决策依据 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">九</span>
          <span className="text-sm font-bold text-gray-800">决策依据（关键因素逐条说明）</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            以下列出影响本次授信决策的所有关键因素，每项均标注数据来源、对评分的贡献及对最终额度的影响，供审批人员复核参考。
          </p>
          {/* 规则引擎触发情决 */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">硬性准入规则</span>
              {re ? (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  re.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>{re.passed ? "✓ 全部通过" : `✗ 触发 ${re.triggeredRules.length} 条`}</span>
              ) : <span className="ml-auto text-[10px] text-gray-400">数据缺失</span>}
            </div>
            <div className="px-3 py-2">
              {re && !re.passed && re.triggeredRules.length > 0 ? (
                <div className="space-y-1.5">
                  {re.triggeredRules.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-red-500 flex-shrink-0 mt-0.5">✗</span>
                      <div>
                        <span className="font-medium text-gray-800">{r.ruleName}</span>
                        <span className="text-gray-500 ml-2">{r.detail}</span>
                        <div className="text-[10px] text-red-600 mt-0.5">→ 影响：触发硬性拒绝规则，直接导致授信拒绝或降额</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-green-600">✓ 8条硬性准入规则全部通过，无强制拒绝触发。</div>
              )}
            </div>
          </div>
          {/* 评分卡三维贡献 */}
          {sc && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">信用评分卡（综合得分 {sc.score} / 1000，{sc.creditGrade} 级）</span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {[
                  { label: "主体资质", score: sc.subjectQualityScore, weight: sc.scoreBreakdown?.subjectWeight, contrib: sc.scoreBreakdown?.subjectContribution,
                    desc: "工商登记年限、注册资本实缴、法人信用、司法记录等", color: "text-blue-600" },
                  { label: "财务健康", score: sc.financialHealthScore, weight: sc.scoreBreakdown?.financialWeight, contrib: sc.scoreBreakdown?.financialContribution,
                    desc: "资产负债率、流动比率、净利润率、毛利率、现金流覆盖等", color: "text-green-600" },
                  { label: "经营稳定性", score: sc.operationStabilityScore, weight: sc.scoreBreakdown?.operationWeight, contrib: sc.scoreBreakdown?.operationContribution,
                    desc: "营收增长率、利润稳定性、行业风险、经营年限等", color: "text-purple-600" },
                ].map(dim => (
                  <div key={dim.label} className="flex items-start gap-3 text-xs">
                    <div className="w-20 flex-shrink-0">
                      <div className={`font-semibold ${dim.color}`}>{dim.label}</div>
                      <div className="text-gray-400 text-[10px]">{dim.weight != null ? `权重 ${Math.round(dim.weight * 100)}%` : ""}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-800">{dim.score != null ? `${dim.score.toFixed(2)} 分` : "数据缺失"}</span>
                        {dim.contrib != null && <span className="text-gray-400">→ 贡献 <strong className={dim.color}>{dim.contrib.toFixed(0)}</strong> 分</span>}
                      </div>
                      <div className="text-gray-500">{dim.desc}</div>
                    </div>
                  </div>
                ))}
                {sc.scoreBreakdown?.penaltyPoints != null && sc.scoreBreakdown.penaltyPoints !== 0 && (
                  <div className="flex items-start gap-3 text-xs border-t border-gray-100 pt-2">
                    <div className="w-20 flex-shrink-0">
                      <div className="font-semibold text-red-600">惩罚项</div>
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-red-600">{sc.scoreBreakdown.penaltyPoints.toFixed(0)} 分</span>
                      <span className="text-gray-500 ml-2">关联高风险企业、诉讼记录、舆情风险等因素</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 额度测算决策依据 */}
          {lc && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">额度测算（三法取最小值）</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {[
                  { label: "收入法", value: lc.revenueMethodLimit, detail: lc.incomeMethodDetail },
                  { label: "净资产法", value: lc.netAssetMethodLimit, detail: lc.netAssetMethodDetail },
                  { label: "现金流法", value: lc.cashFlowMethodLimit != null && lc.cashFlowMethodLimit < 0 ? 0 : lc.cashFlowMethodLimit, detail: lc.cashFlowMethodLimit != null && lc.cashFlowMethodLimit < 0 ? `经营现金流为负（${lc.cashFlowMethodLimit?.toFixed(0)}万），现金流法不适用，额度取0` : lc.cashFlowMethodDetail },
                ].map(m => (
                  <div key={m.label} className="flex items-start gap-2 text-xs">
                    <span className="w-16 text-gray-500 flex-shrink-0">{m.label}</span>
                    <span className={`font-medium flex-shrink-0 ${
                      m.value === null ? "text-gray-300" :
                      m.value === 0 ? "text-red-600" : "text-gray-800"
                    }`}>
                      {m.value === null ? "无法计算" : m.value === 0 ? "0 万元" : `${m.value} 万元`}
                    </span>
                    {m.detail && <span className="text-gray-400 text-[10px]">{m.detail}</span>}
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-1.5 flex items-center gap-2 text-xs">
                  <span className="w-16 text-gray-500 flex-shrink-0 font-semibold">建议额度</span>
                  <span className="font-bold text-orange-600">{lc.recommendedLimit != null ? `${Math.max(0, lc.recommendedLimit)} 万元` : "—"}</span>
                  <span className="text-gray-400 text-[10px]">（三法取最小值，再乘批准比例 {Math.round(lc.approvalRatio * 100)}%）</span>
                </div>
              </div>
            </div>
          )}
          {/* 数据完整性对决策的影响 */}
          {fs?.missingDataChain && fs.missingDataChain.missingItems.length > 0 && (
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <div className="bg-amber-50 px-3 py-2">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">数据完整性对决策的影响</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {fs.missingDataChain.missingItems.filter(i => i.severity !== "optional").map(item => (
                  <div key={item.fileType} className="flex items-start gap-2 text-xs">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
                      item.severity === "critical" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                    }`}>{item.severity === "critical" ? "必须" : "重要"}</span>
                    <div>
                      <span className="font-medium text-gray-700">缺少 {item.fileName}</span>
                      {item.affectedScoring.length > 0 && (
                        <div className="text-gray-500 mt-0.5">→ 影响评估：{item.affectedScoring.join("；")}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 十、审批建议 ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">十</span>
          <span className="text-sm font-bold text-gray-800">审批建议</span>
        </div>
        <div className="p-5">
          <div className={`rounded-xl border p-4 mb-4 ${verdictConfig.bg}`}>
            <div className={`text-base font-bold mb-2 ${verdictConfig.color}`}>
              {result.verdict === "approved" ? "✅ 建议批准" :
               result.verdict === "reduced" ? "⚠️ 建议降额通过" : "❌ 建议拒绝"}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{sc?.recommendation || "请参考以上各项分析结果进行综合判断。"}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500 mb-1">建议授信额度</div>
              <div className="text-lg font-bold text-orange-600">{lc?.recommendedLimit != null ? `${Math.max(0, lc.recommendedLimit)} 万元` : "—"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-gray-500 mb-1">建议贷款期限</div>
              <div className="text-lg font-bold text-gray-800">{appData.period ? `${appData.period} 个月` : "—"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 报告声明 ── */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
        <div className="text-[11px] text-gray-400 leading-relaxed">
          <strong className="text-gray-500">免责声明：</strong>
          本报告由 Marsbot 火星豹 AI 信贷决策系统自动生成，基于申请人提供的材料及公开数据进行分析，仅供参考。
          最终授信决策须由具备资质的信贷审批人员依据机构内部政策及监管规定作出。
          本系统不承担因使用本报告而产生的任何法律责任。
          报告生成时间：{reportDate}，报告编号：{reportNo}。
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel Components ─────────────────────────────────────────────────────

export { NineDimensionPanel, FinancialAnalysisPanel, CreditReportPanel };
