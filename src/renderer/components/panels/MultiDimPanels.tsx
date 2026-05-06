/**
 * MultiDimPanels.tsx
 * 多维分析面板（使用 recharts）：
 * 1. FinancialMultiYearPanel  — 财报分析（四子Tab：多期对比/趋势图表/异常信号/综合评估）
 * 2. BankFlowPanel            — 银行流水分析
 * 3. TaxAnalysisPanel         — 税务分析
 * 4. IndustryAnalysisPanel    — 行业分析
 * 5. CrossAnalysisPanel       — 交叉分析
 */
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ComposedChart, AreaChart, Area
} from "recharts";
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  Activity, Shield, FileText, Network, Globe,
  AlertCircle, Info, ArrowUp, ArrowDown, Minus,
  Sparkles, Loader2, RefreshCw, ChevronDown
} from "lucide-react";
import type { AppData } from "./panelTypes";

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function parseNum(v: string | number | null | undefined, skipAutoConvert = false): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "none") return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // skipAutoConvert=true 时（后端已换算为万元），跳过兆底换算
  if (!skipAutoConvert && Math.abs(n) > 5000000) return parseFloat((n / 10000).toFixed(4));
  return n;
}

function fmtNum(v: number | null, digits = 0, suffix = "万"): string {
  if (v === null) return "--";
  return `${v.toFixed(digits)}${suffix}`;
}

function fmtPct(v: number | null, digits = 1): string {
  if (v === null) return "--";
  return `${v.toFixed(digits)}%`;
}

function growthColor(v: number | null, goodHigh = true): string {
  if (v === null) return "text-gray-400";
  if (goodHigh) return v >= 0 ? "text-green-600" : "text-red-600";
  return v <= 0 ? "text-green-600" : "text-red-600";
}

function growthIcon(v: number | null, goodHigh = true) {
  if (v === null) return <Minus size={10} className="text-gray-400" />;
  if (goodHigh) return v >= 0 ? <ArrowUp size={10} className="text-green-500" /> : <ArrowDown size={10} className="text-red-500" />;
  return v <= 0 ? <ArrowUp size={10} className="text-green-500" /> : <ArrowDown size={10} className="text-red-500" />;
}

function calcGrowth(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return (curr - prev) / Math.abs(prev) * 100;
}

const KEY_ALIASES: Record<string, string[]> = {
  // 英文字段名 + 标准 ID（mapToStandardFields 会将中文字段名映射为标准 ID）+ 中文字段名（LLM 直接返回时）
  revenue: ["revenue", "operatingRevenue", "totalRevenue", "is_001", "营业收入", "营业总收入", "主营业务收入"],
  netProfit: ["netProfit", "netIncome", "is_020", "净利润", "净利润（亏损）", "净利润(亏损)"],
  operatingCashFlow: ["operatingCashFlow", "netOperatingCashFlow", "cf_010", "经营活动产生的现金流量净额", "经营活动现金流量净额", "经营活动现金净流量", "一、经营活动产生的现金流量净额"],
  investingCashFlow: ["investingCashFlow", "cf_020", "投资活动产生的现金流量净额", "投资活动现金流量净额"],
  financingCashFlow: ["financingCashFlow", "cf_030", "筹资活动产生的现金流量净额", "筹资活动现金流量净额"],
  totalAssets: ["totalAssets", "bs_037", "资产总计", "资产合计", "总资产"],
  totalLiabilities: ["totalLiabilities", "bs_064", "负债合计", "负债总计", "总负债"],
  currentAssets: ["currentAssets", "totalCurrentAssets", "bs_017", "流动资产合计", "流动资产总计"],
  currentLiabilities: ["currentLiabilities", "totalCurrentLiabilities", "bs_053", "流动负债合计", "流动负债总计"],
  inventory: ["inventory", "bs_012", "存货", "存货净额"],
  totalEquity: ["totalEquity", "shareholdersEquity", "bs_075", "所有者权益合计", "股东权益合计", "净资产"],
  costOfRevenue: ["costOfRevenue", "operatingCost", "is_002", "营业成本", "主营业务成本"],
  shortTermLoan: ["shortTermLoan", "shortTermBorrowing", "bs_038", "短期借款"],
  longTermLoan: ["longTermLoan", "longTermBorrowing", "bs_054", "长期借款"],
  accountsReceivable: ["accountsReceivable", "bs_006", "应收账款", "应收账款净额"],
  monetaryFunds: ["monetaryFunds", "cashAndCashEquivalents", "bs_001", "货币资金"],
  financialExpense: ["financialExpense", "financialExpenses", "financeCost", "is_007", "财务费用"],
  // 额外派生字段（直接存储在 incomeStatement 中的快捷字段）
  grossProfit: ["grossProfit", "is_016", "毛利润", "毛利"],
  operatingProfit: ["operatingProfit", "is_017", "营业利润"],
  totalProfit: ["totalProfit", "is_018", "利润总额"],
  // 销售费用、管理费用
  sellingExpense: ["sellingExpense", "is_005", "销售费用"],
  adminExpense: ["adminExpense", "is_006", "管理费用"],
  // 其他应收款（用于关联交易分析）
  otherReceivables: ["otherReceivables", "bs_007", "其他应收款"],
  // 应付账款
  accountsPayable: ["accountsPayable", "bs_044", "应付账款"],
  // 非流动资产合计
  nonCurrentAssets: ["nonCurrentAssets", "bs_036", "非流动资产合计"],
  // 非流动负债合计
  nonCurrentLiabilities: ["nonCurrentLiabilities", "bs_063", "非流动负债合计"],
};

function getYearNum(fsByYear: Record<string, Record<string, unknown>>, year: string, key: string): number | null {
  const fs = fsByYear[year];
  if (!fs) return null;
  // 检查 sourceUnit：后端已换算为万元时跳过前端兆底换算
  const sourceUnit = (fs as any).sourceUnit as string | undefined;
  const skipAutoConvert = !!sourceUnit && sourceUnit !== '元';
  const src: Record<string, unknown> = {
    ...(fs.balanceSheet as Record<string, unknown> ?? {}),
    ...(fs.incomeStatement as Record<string, unknown> ?? {}),
    ...(fs.cashFlowStatement as Record<string, unknown> ?? {}),
  };

  const g = (k: string): number | null => {
    const aliases = KEY_ALIASES[k] ?? [k];
    for (const alias of aliases) {
      const v = src[alias];
      if (v !== null && v !== undefined && v !== "") {
        const n = parseNum(v as string | number, skipAutoConvert);
        if (n !== null) return n;
      }
    }
    return null;
  };

  const direct = g(key);
  if (direct !== null) return direct;

  // 派生指标
  if (key === "debtRatio") {
    const ta = g("totalAssets"), tl = g("totalLiabilities");
    if (ta && tl && ta !== 0) return parseFloat((tl / ta * 100).toFixed(2));
  }
  if (key === "currentRatio") {
    const ca = g("currentAssets"), cl = g("currentLiabilities");
    if (ca !== null && cl !== null && cl !== 0) return parseFloat((ca / cl).toFixed(4));
  }
  if (key === "quickRatio") {
    const ca = g("currentAssets"), inv = g("inventory") ?? 0, cl = g("currentLiabilities");
    if (ca !== null && cl !== null && cl !== 0) return parseFloat(((ca - inv) / cl).toFixed(4));
  }
  if (key === "grossMargin") {
    const rev = g("revenue"), cost = g("costOfRevenue");
    if (rev && cost && rev !== 0) return parseFloat(((rev - cost) / rev * 100).toFixed(2));
  }
  if (key === "netProfitMargin") {
    const rev = g("revenue"), np = g("netProfit");
    if (rev && np !== null && rev !== 0) return parseFloat((np / rev * 100).toFixed(2));
  }
  if (key === "roe") {
    const np = g("netProfit"), eq = g("totalEquity");
    if (np !== null && eq && eq !== 0) return parseFloat((np / eq * 100).toFixed(2));
  }
  if (key === "arDays") {
    const ar = g("accountsReceivable"), rev = g("revenue");
    if (ar !== null && rev && rev !== 0) return parseFloat((ar / (rev / 365)).toFixed(1));
  }
  if (key === "invDays") {
    const inv = g("inventory"), cost = g("costOfRevenue");
    if (inv !== null && cost && cost !== 0) return parseFloat((inv / (cost / 365)).toFixed(1));
  }
  if (key === "cashQuality") {
    const ocf = g("operatingCashFlow"), np = g("netProfit");
    if (ocf !== null && np !== null && np !== 0) return parseFloat((ocf / np).toFixed(4));
  }
  return null;
}

// ─── 1. 财报分析面板（四子Tab）────────────────────────────────────────────────

export function FinancialMultiYearPanel({ appData }: { appData: AppData }) {
  const [subTab, setSubTab] = useState<"compare" | "trend" | "anomaly" | "summary">("compare");

  const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
  // 保留所有年份数据（包括月报/季报），按年份降序排列
  const allYears = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
  const effectiveYears = allYears;
  const hasData = allYears.length > 0;
  // 每个年份的报告期元数据（periodType: 'annual'|'interim'|'monthly'|'quarterly'，reportPeriod: '2026-02'等）
  const periodMeta: Record<string, { periodType?: string; reportPeriod?: string; monthCount?: number }> = {};
  for (const yr of allYears) {
    const fs = fsByYear[yr] as Record<string, unknown>;
    const pType = (fs?.periodType as string) || 'annual';
    const rPeriod = (fs?.reportPeriod as string) || yr;
    // 推断月数：monthly=1或从 reportPeriod 提取月份，interim=6，annual=12
    let monthCount = 12;
    if (pType === 'monthly') {
      // 从 reportPeriod 提取月份（如 "2026-02" → 2月）
      const mMatch = String(rPeriod).match(/-(\d{1,2})$/);
      monthCount = mMatch ? parseInt(mMatch[1]) : 1;
    } else if (pType === 'interim' || pType === 'quarterly') {
      monthCount = pType === 'quarterly' ? 3 : 6;
    }
    periodMeta[yr] = { periodType: pType, reportPeriod: rPeriod, monthCount };
  }
  // 是否存在月报/季报数据（需要特殊处理同比）
  const hasSubAnnualData = allYears.some(y => periodMeta[y]?.periodType !== 'annual');

  const SUB_TABS = [
    { id: "compare" as const, label: "多期对比", icon: <BarChart3 size={12} /> },
    { id: "trend" as const, label: "趋势图表", icon: <TrendingUp size={12} /> },
    { id: "anomaly" as const, label: "指标分析", icon: <BarChart3 size={12} /> },
    { id: "summary" as const, label: "综合评估", icon: <Shield size={12} /> },
  ];

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <BarChart3 size={32} className="mb-3 opacity-30" />
        <div className="text-sm">请先上传财务报表</div>
        <div className="text-xs mt-1 text-gray-300">支持上传连续三年审计报告或财务报表</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {SUB_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors flex-1 justify-center ${
                subTab === t.id
                  ? "bg-orange-50 text-orange-600 border-b-2 border-orange-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {subTab === "compare" && <MultiYearCompareTab fsByYear={fsByYear} sortedYears={effectiveYears} periodMeta={periodMeta} />}
          {subTab === "trend" && <TrendChartTab fsByYear={fsByYear} sortedYears={effectiveYears} periodMeta={periodMeta} />}
          {subTab === "anomaly" && <AnomalyTab fsByYear={fsByYear} sortedYears={effectiveYears} appData={appData} periodMeta={periodMeta} />}
          {subTab === "summary" && <SummaryTab fsByYear={fsByYear} sortedYears={effectiveYears} appData={appData} />}
        </div>
      </div>
    </div>
  );
}

// ── 子Tab 1：多期对比表格 ──────────────────────────────────────────────────────

function MultiYearCompareTab({ fsByYear, sortedYears, periodMeta }: { fsByYear: Record<string, Record<string, unknown>>; sortedYears: string[]; periodMeta?: Record<string, { periodType?: string; reportPeriod?: string; monthCount?: number }> }) {
  const years = sortedYears.slice(0, 3);
  // 流量指标（需要年化的指标）
  const FLOW_KEYS = new Set(["revenue", "netProfit", "operatingCashFlow", "grossProfit", "operatingProfit", "totalProfit", "costOfRevenue", "financialExpense"]);
  // 获取年份标签（月报/季报加标注）
  const getYearLabel = (y: string) => {
    const meta = periodMeta?.[y];
    if (!meta || meta.periodType === 'annual') return `${y}年`;
    if (meta.periodType === 'monthly') return `${y}年（${meta.reportPeriod?.replace(y + '-', '') || ''}月报）`;
    if (meta.periodType === 'quarterly') return `${y}年（季报）`;
    if (meta.periodType === 'interim') return `${y}年（半年报）`;
    return `${y}年`;
  };
  // 获取年化后的数值（流量指标按月数年化，资产负债表指标直接返回）
  const getAnnualizedNum = (y: string, key: string): number | null => {
    const raw = getYearNum(fsByYear, y, key);
    if (raw === null) return null;
    const meta = periodMeta?.[y];
    if (!meta || meta.periodType === 'annual') return raw;
    if (FLOW_KEYS.has(key) && meta.monthCount && meta.monthCount > 0 && meta.monthCount < 12) {
      return parseFloat((raw * 12 / meta.monthCount).toFixed(2));
    }
    return raw;
  };
  // 判断两个年份是否可以直接同比（都是年报，或都是相同类型）
  const canDirectCompare = (y0: string, y1: string, key: string) => {
    const m0 = periodMeta?.[y0];
    const m1 = periodMeta?.[y1];
    if (!m0 || !m1) return true;
    if (m0.periodType === m1.periodType) return true; // 相同类型可以对比
    if (!FLOW_KEYS.has(key)) return true; // 非流量指标（资产负债表）可以直接对比
    return false; // 流量指标跨类型，需要年化
  };

  const METRICS = [
    { group: "盈利能力", items: [
      { key: "revenue", label: "营业收入（万元）", fmt: (v: number | null) => fmtNum(v, 0, ""), goodHigh: true },
      { key: "netProfit", label: "净利润（万元）", fmt: (v: number | null) => fmtNum(v, 0, ""), goodHigh: true },
      { key: "grossMargin", label: "毛利率", fmt: (v: number | null) => fmtPct(v), goodHigh: true },
      { key: "netProfitMargin", label: "净利率", fmt: (v: number | null) => fmtPct(v), goodHigh: true },
      { key: "roe", label: "ROE（净资产收益率）", fmt: (v: number | null) => fmtPct(v), goodHigh: true },
    ]},
    { group: "偿债能力", items: [
      { key: "debtRatio", label: "资产负债率", fmt: (v: number | null) => fmtPct(v), goodHigh: false },
      { key: "currentRatio", label: "流动比率", fmt: (v: number | null) => v !== null ? v.toFixed(2) : "--", goodHigh: true },
      { key: "quickRatio", label: "速动比率", fmt: (v: number | null) => v !== null ? v.toFixed(2) : "--", goodHigh: true },
    ]},
    { group: "营运能力", items: [
      { key: "arDays", label: "应收账款周转天数", fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}天` : "--", goodHigh: false },
      { key: "invDays", label: "存货周转天数", fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}天` : "--", goodHigh: false },
    ]},
    { group: "现金流质量", items: [
      { key: "operatingCashFlow", label: "经营现金流（万元）", fmt: (v: number | null) => fmtNum(v, 0, ""), goodHigh: true },
      { key: "cashQuality", label: "现金流/净利润", fmt: (v: number | null) => v !== null ? v.toFixed(2) : "--", goodHigh: true },
    ]},
    { group: "资产规模", items: [
      { key: "totalAssets", label: "资产总计（万元）", fmt: (v: number | null) => fmtNum(v, 0, ""), goodHigh: true },
      { key: "totalLiabilities", label: "负债总计（万元）", fmt: (v: number | null) => fmtNum(v, 0, ""), goodHigh: false },
    ]},
  ];

  // ── TTM 计算（当有历史年报 + 当期累计报表时）──────────────────────────────
  // 找到最新的非年报（月报/季报）和最近的年报
  const subAnnualYear = years.find(y => periodMeta?.[y]?.periodType !== 'annual');
  const annualYears = years.filter(y => !periodMeta?.[y]?.periodType || periodMeta?.[y]?.periodType === 'annual');
  const latestAnnualYear = annualYears[0]; // 最近的年报年份（降序排列，第一个最新）
  // TTM = 最近年报 + 当期累计 - 上年同期累计
  // 当只有年报+月报时，TTM 近似 = 最近年报 + 当期月报×(12/月数) - 年报×(月数/12)
  // 简化：TTM ≈ 最近年报 × (1 - 月数/12) + 当期月报 × (12/月数) × (月数/12)
  //       = 最近年报 × (1 - m/12) + 当期月报年化 × (m/12)
  const ttmData: Record<string, number | null> = {};
  if (subAnnualYear && latestAnnualYear) {
    const m = periodMeta?.[subAnnualYear]?.monthCount ?? 1;
    const FLOW_KEYS_ARR = ["revenue", "netProfit", "operatingCashFlow", "grossProfit", "operatingProfit", "totalProfit", "costOfRevenue", "financialExpense"];
    for (const key of FLOW_KEYS_ARR) {
      const annualVal = getYearNum(fsByYear, latestAnnualYear, key);
      const subAnnualVal = getYearNum(fsByYear, subAnnualYear, key);
      if (annualVal !== null && subAnnualVal !== null && m > 0 && m < 12) {
        // TTM = 年报 × (1 - m/12) + 月报年化 × (m/12)
        const annualized = subAnnualVal * 12 / m;
        ttmData[key] = parseFloat((annualVal * (1 - m / 12) + annualized * (m / 12)).toFixed(2));
      } else {
        ttmData[key] = null;
      }
    }
  }
  const hasTTM = subAnnualYear && latestAnnualYear && Object.values(ttmData).some(v => v !== null);
  // ── 趋势拐点预警（连续2期同向恶化）──────────────────────────────────────
  const trendWarnings: string[] = [];
  if (years.length >= 3) {
    const TREND_CHECKS = [
      { key: "grossMargin", label: "毛利率", goodHigh: true },
      { key: "netProfitMargin", label: "净利率", goodHigh: true },
      { key: "debtRatio", label: "资产负债率", goodHigh: false },
      { key: "currentRatio", label: "流动比率", goodHigh: true },
      { key: "arDays", label: "应收账款周转天数", goodHigh: false },
    ];
    for (const check of TREND_CHECKS) {
      const vals = years.slice(0, 3).map(y => getYearNum(fsByYear, y, check.key));
      if (vals[0] !== null && vals[1] !== null && vals[2] !== null) {
        // 降序排列：vals[0]=最新，vals[1]=次新，vals[2]=最旧
        const d1 = vals[0] - vals[1]; // 最新 vs 次新
        const d2 = vals[1] - vals[2]; // 次新 vs 最旧
        const deteriorating = check.goodHigh ? (d1 < 0 && d2 < 0) : (d1 > 0 && d2 > 0);
        if (deteriorating) {
          trendWarnings.push(check.label);
        }
      }
    }
  }
  return (
    <div className="space-y-4">
      {/* 期间不对等警示横幅 */}
      {subAnnualYear && annualYears.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-700">
            <span className="font-semibold">期间不对等提示：</span>
            {getYearLabel(subAnnualYear)}为{periodMeta?.[subAnnualYear]?.periodType === 'monthly' ? '月报' : periodMeta?.[subAnnualYear]?.periodType === 'quarterly' ? '季报' : '半年报'}，
            与{annualYears.map(y => `${y}年报`).join('、')}期间长度不同。
            流量指标（营收/利润/现金流）已按月数年化处理，资产负债表指标（资产负债率等）可直接对比。
            {hasTTM && <span className="ml-1 text-amber-600 font-medium">已自动计算TTM（滚动12个月）数据供参考。</span>}
          </div>
        </div>
      )}
      {/* 趋势拐点预警 */}
      {trendWarnings.length > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-700">
            <span className="font-semibold">趋势拐点预警：</span>
            {trendWarnings.join('、')}连续{years.length >= 3 ? '三期' : '两期'}持续恶化，请重点关注。
          </div>
        </div>
      )}
      {/* TTM 数据卡片 */}
      {hasTTM && subAnnualYear && latestAnnualYear && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">TTM 滚动12个月估算（基于{latestAnnualYear}年报 + {getYearLabel(subAnnualYear)}）</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "revenue", label: "TTM营收" },
              { key: "netProfit", label: "TTM净利润" },
              { key: "operatingCashFlow", label: "TTM经营现金流" },
            ].map(item => (
              <div key={item.key} className="bg-white rounded px-2 py-1.5 text-center">
                <div className="text-[10px] text-gray-500 mb-0.5">{item.label}</div>
                <div className="text-xs font-semibold text-blue-700">
                  {ttmData[item.key] !== null ? `${ttmData[item.key]!.toFixed(0)}万元` : '--'}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-blue-500 mt-1.5">TTM = 最近年报 × (1-月数/12) + 当期月报年化 × (月数/12)，仅供参考</div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500">共 {years.length} 期数据</span>
        {years.length < 3 && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">建议补充上传连续三年报表以获得更准确分析</span>
        )}
      </div>
      {METRICS.map(group => (
        <div key={group.group}>
          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-orange-400 rounded-full inline-block" />
            {group.group}
          </div>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-gray-600 font-medium w-40">指标</th>
                  {years.map(y => (
                    <th key={y} className="text-right px-3 py-2 text-gray-600 font-medium">
                      {getYearLabel(y)}
                      {periodMeta?.[y]?.periodType !== 'annual' && periodMeta?.[y]?.periodType !== undefined && (
                        <span className="ml-1 text-[9px] text-amber-500 font-normal">年化</span>
                      )}
                    </th>
                  ))}
                  {years.length >= 2 && (
                    <th className="text-right px-3 py-2 text-gray-600 font-medium">同比变化</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, idx) => {
                  // 原始值（用于显示）
                  const vals = years.map(y => getYearNum(fsByYear, y, item.key));
                  // 年化值（用于同比计算）
                  const annualizedVals = years.map(y => getAnnualizedNum(y, item.key));
                  const growth = years.length >= 2 ? calcGrowth(annualizedVals[0], annualizedVals[1]) : null;
                  const isSubAnnualCompare = years.length >= 2 && !canDirectCompare(years[0], years[1], item.key);
                  return (
                    <tr key={item.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-3 py-2 text-gray-600">{item.label}</td>
                      {years.map((y, i) => {
                        const rawVal = vals[i];
                        const annualVal = annualizedVals[i];
                        const meta = periodMeta?.[y];
                        const isSubAnnual = meta && meta.periodType !== 'annual';
                        const showAnnualized = isSubAnnual && FLOW_KEYS.has(item.key) && annualVal !== null && annualVal !== rawVal;
                        return (
                          <td key={i} className={`text-right px-3 py-2 font-medium ${rawVal === null ? "text-gray-300" : "text-gray-800"}`}>
                            <div>{item.fmt(rawVal)}</div>
                            {showAnnualized && (
                              <div className="text-[9px] text-amber-500 font-normal">年化≈{item.fmt(annualVal)}</div>
                            )}
                          </td>
                        );
                      })}
                      {years.length >= 2 && (
                        <td className="text-right px-3 py-2">
                          {growth !== null ? (
                            <div>
                              <span className={`flex items-center justify-end gap-0.5 font-medium ${growthColor(growth, item.goodHigh)}`}>
                                {growthIcon(growth, item.goodHigh)}
                                {growth >= 0 ? "+" : ""}{growth.toFixed(2)}%
                              </span>
                              {isSubAnnualCompare && FLOW_KEYS.has(item.key) && (
                                <div className="text-[9px] text-amber-400 text-right">年化估算</div>
                              )}
                            </div>
                          ) : <span className="text-gray-300">--</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 子Tab 2：趋势图表 ──────────────────────────────────────────────────────────

function TrendChartTab({ fsByYear, sortedYears, periodMeta }: { fsByYear: Record<string, Record<string, unknown>>; sortedYears: string[]; periodMeta?: Record<string, { periodType?: string; reportPeriod?: string; monthCount?: number }> }) {
  const years = [...sortedYears].reverse();
  const getYearLabel = (y: string) => {
    const meta = periodMeta?.[y];
    if (!meta || meta.periodType === 'annual') return `${y}年`;
    if (meta.periodType === 'monthly') return `${y}(${meta.reportPeriod?.replace(y + '-', '') || ''}月)`;
    if (meta.periodType === 'quarterly') return `${y}(季)`;
    if (meta.periodType === 'interim') return `${y}(半年)`;
    return `${y}年`;
  };

  const revenueData = years.map(y => ({
    year: getYearLabel(y),
    营业收入: getYearNum(fsByYear, y, "revenue"),
    净利润: getYearNum(fsByYear, y, "netProfit"),
    经营现金流: getYearNum(fsByYear, y, "operatingCashFlow"),
  }));

  const debtData = years.map(y => ({
    year: getYearLabel(y),
    资产负债率: getYearNum(fsByYear, y, "debtRatio"),
  }));

  const ratioData = years.map(y => ({
    year: getYearLabel(y),
    流动比率: getYearNum(fsByYear, y, "currentRatio"),
    速动比率: getYearNum(fsByYear, y, "quickRatio"),
  }));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-blue-500" />营收与利润趋势（万元）
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => [`${value?.toFixed(0)}万`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="营业收入" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="净利润" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="经营现金流" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Shield size={12} className="text-purple-500" />资产负债率趋势（%）
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={debtData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => [`${value?.toFixed(2)}%`, ""]} />
            <Bar dataKey="资产负债率" radius={[4, 4, 0, 0]}>
              {debtData.map((entry, index) => (
                <Cell key={index} fill={(entry.资产负债率 ?? 0) > 70 ? "#ef4444" : (entry.资产负债率 ?? 0) > 60 ? "#f97316" : "#8b5cf6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Activity size={12} className="text-green-500" />流动性比率趋势
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={ratioData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => [value?.toFixed(2), ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="流动比率" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="速动比率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 子Tab 3：异常信号 ──────────────────────────────────────────────────────────

interface AnomalySignal {
  id: string;
  name: string;
  level: "high" | "medium" | "low";
  triggered: boolean;
  detail: string;
}

function AnomalyTab({ fsByYear, sortedYears, appData, periodMeta }: { fsByYear: Record<string, Record<string, unknown>>; sortedYears: string[]; appData: AppData; periodMeta?: Record<string, { periodType?: string; reportPeriod?: string; monthCount?: number }> }) {
  const [activeSet, setActiveSet] = React.useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [onlyTriggered, setOnlyTriggered] = React.useState(false);
  const [expandedRuleId, setExpandedRuleId] = React.useState<string | null>(null);
  const latestYearKey = sortedYears[0];
  const prevYearKey = sortedYears[1];
  const latestFs = latestYearKey ? fsByYear[latestYearKey] : null;
  const prevFs = prevYearKey ? fsByYear[prevYearKey] : null;
  // 判断最新期与上期是否为不同类型（月报 vs 年报），跨期规则不可直接对比
  const latestPeriodType = periodMeta?.[latestYearKey ?? '']?.periodType ?? 'annual';
  const prevPeriodType = periodMeta?.[prevYearKey ?? '']?.periodType ?? 'annual';
  const crossPeriodIncomparable = latestPeriodType !== prevPeriodType && latestPeriodType !== 'annual';

  type FARuleResult = { id: string; name: string; set: 'A' | 'B' | 'C' | 'D'; triggered: boolean; level: 'error' | 'warning'; detail: string };

  function num(fs: Record<string, unknown> | null, key: string): number | null {
    if (!fs) return null;
    const src = { ...(fs.balanceSheet as Record<string, unknown> ?? {}), ...(fs.incomeStatement as Record<string, unknown> ?? {}), ...(fs.cashFlowStatement as Record<string, unknown> ?? {}) } as Record<string, unknown>;
    const KEY_ALIASES: Record<string, string[]> = {
      // 英文字段名 + 标准 ID（mapToStandardFields 会将中文字段名映射为标准 ID）
      'revenue': ['revenue', 'operatingRevenue', 'totalRevenue', 'is_001', '营业收入', '营业总收入', '主营业务收入'],
      'netProfit': ['netProfit', 'netIncome', 'is_020', '净利润', '净利润（亏损）'],
      'operatingCashFlow': ['operatingCashFlow', 'netOperatingCashFlow', 'cf_010', '经营活动产生的现金流量净额', '经营活动现金流量净额'],
      'investingCashFlow': ['investingCashFlow', 'cf_020', '投资活动产生的现金流量净额'],
      'financingCashFlow': ['financingCashFlow', 'cf_030', '筹资活动产生的现金流量净额'],
      'totalAssets': ['totalAssets', 'bs_037', '资产总计', '资产合计', '总资产'],
      'totalLiabilities': ['totalLiabilities', 'bs_064', '负债合计', '负债总计', '总负债'],
      'currentAssets': ['currentAssets', 'totalCurrentAssets', 'bs_017', '流动资产合计', '流动资产总计'],
      'currentLiabilities': ['currentLiabilities', 'totalCurrentLiabilities', 'bs_053', '流动负债合计', '流动负债总计'],
      'inventory': ['inventory', 'bs_012', '存货', '存货净额'],
      'totalEquity': ['totalEquity', 'shareholdersEquity', 'bs_075', '所有者权益合计', '股东权益合计', '净资产'],
      'costOfRevenue': ['costOfRevenue', 'operatingCost', 'is_002', '营业成本', '主营业务成本'],
      'financialExpenses': ['financialExpenses', 'financialExpense', 'is_007', '财务费用'],
      'shortTermLoan': ['shortTermLoan', 'shortTermBorrowing', 'bs_038', '短期借款'],
      'longTermLoan': ['longTermLoan', 'longTermBorrowing', 'bs_054', '长期借款'],
      'accountsReceivable': ['accountsReceivable', 'bs_006', '应收账款'],
      'monetaryFunds': ['monetaryFunds', 'cashAndCashEquivalents', 'bs_001', '货币资金'],
    };
    const sourceUnit = (fs as any)?.sourceUnit as string | undefined;
    const skipAutoConvert = !!sourceUnit && sourceUnit !== '元';
    const keysToTry = KEY_ALIASES[key] ?? [key];
    for (const k of keysToTry) {
      const v = src[k];
      if (v !== null && v !== undefined && v !== '') {
        const sv = String(v).trim();
        if (!sv || sv.toLowerCase() === 'null' || sv.toLowerCase() === 'none') continue;
        const n = parseFloat(sv.replace(/,/g, ''));
        if (!isNaN(n)) {
          if (!skipAutoConvert && Math.abs(n) > 5000000) return parseFloat((n / 10000).toFixed(4)); // 超过500万认为是"元"单位，换算为万元
          return n;
        }
      }
    }
    // 派生指标自动计算
    const g = (k: string) => {
      const val = src[k]; if (val === null || val === undefined || val === '') return null;
      const n2 = parseFloat(String(val).replace(/,/g, '')); return isNaN(n2) ? null : n2;
    };
    if (key === 'debtRatio') { const ta = g('totalAssets'); const tl = g('totalLiabilities'); if (ta && tl && ta !== 0) return parseFloat((tl / ta * 100).toFixed(2)); }
    if (key === 'currentRatio') { const ca = g('currentAssets') ?? g('totalCurrentAssets'); const cl = g('currentLiabilities') ?? g('totalCurrentLiabilities'); if (ca !== null && cl !== null && cl !== 0) return parseFloat((ca / cl).toFixed(4)); }
    if (key === 'quickRatio') { const ca = g('currentAssets') ?? g('totalCurrentAssets'); const inv = g('inventory') ?? 0; const cl = g('currentLiabilities') ?? g('totalCurrentLiabilities'); if (ca !== null && cl !== null && cl !== 0) return parseFloat(((ca - (inv ?? 0)) / cl).toFixed(4)); }
    if (key === 'grossMargin') { const rev = g('revenue') ?? g('operatingRevenue'); const cost = g('costOfRevenue') ?? g('operatingCost'); if (rev && cost && rev !== 0) return parseFloat(((rev - cost) / rev * 100).toFixed(2)); }
    if (key === 'netProfitMargin') { const rev = g('revenue') ?? g('operatingRevenue'); const np = g('netProfit'); if (rev && np !== null && rev !== 0) return parseFloat((np / rev * 100).toFixed(2)); }
    if (key === 'roe') { const np = g('netProfit'); const equity = g('totalEquity') ?? g('shareholdersEquity'); if (np !== null && equity && equity !== 0) return parseFloat((np / equity * 100).toFixed(2)); }
    return null;
  }

  // ── 套A 单期规则（14条）──
  const rulesA: FARuleResult[] = [
    (() => { const revenue = num(latestFs, 'revenue'); const triggered = revenue !== null && revenue <= 0; return { id: 'A01', name: '营业收入为零或负', set: 'A' as const, triggered, level: 'error' as const, detail: revenue !== null ? `营业收入: ${revenue}万元` : '数据缺失' }; })(),
    (() => { const netProfit = num(latestFs, 'netProfit'); const triggered = netProfit !== null && netProfit < 0; return { id: 'A02', name: '净利润为负（亏损）', set: 'A' as const, triggered, level: 'error' as const, detail: netProfit !== null ? `净利润: ${netProfit.toFixed(0)}万元` : '数据缺失' }; })(),
    (() => { const ocf = num(latestFs, 'operatingCashFlow'); const triggered = ocf !== null && ocf < 0; return { id: 'A03', name: '经营现金流为负', set: 'A' as const, triggered, level: 'error' as const, detail: ocf !== null ? `经营现金流: ${ocf.toFixed(0)}万元` : '数据缺失' }; })(),
    (() => { const debtRatio = num(latestFs, 'debtRatio'); const triggered = debtRatio !== null && debtRatio > 70; return { id: 'A04', name: '资产负债率>70%', set: 'A' as const, triggered, level: 'error' as const, detail: debtRatio !== null ? `资产负债率: ${debtRatio.toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const currentRatio = num(latestFs, 'currentRatio'); const triggered = currentRatio !== null && currentRatio < 1; return { id: 'A05', name: '流动比率<1（短期偿债不足）', set: 'A' as const, triggered, level: 'error' as const, detail: currentRatio !== null ? `流动比率: ${currentRatio.toFixed(2)}` : '数据缺失' }; })(),
    (() => { const quickRatio = num(latestFs, 'quickRatio'); const triggered = quickRatio !== null && quickRatio < 0.5; return { id: 'A06', name: '速动比率<0.5', set: 'A' as const, triggered, level: 'warning' as const, detail: quickRatio !== null ? `速动比率: ${quickRatio.toFixed(2)}` : '数据缺失' }; })(),
    (() => { const roe = num(latestFs, 'roe'); const triggered = roe !== null && roe < 0; return { id: 'A07', name: 'ROE为负', set: 'A' as const, triggered, level: 'warning' as const, detail: roe !== null ? `ROE: ${roe.toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const grossMargin = num(latestFs, 'grossMargin'); const triggered = grossMargin !== null && grossMargin < 5; return { id: 'A08', name: '毛利率<5%', set: 'A' as const, triggered, level: 'warning' as const, detail: grossMargin !== null ? `毛利率: ${grossMargin.toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const totalAssets = num(latestFs, 'totalAssets'); const totalLiabilities = num(latestFs, 'totalLiabilities'); const equity = totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null; const triggered = equity !== null && equity < 0; return { id: 'A09', name: '所有者权益为负（资不抵债）', set: 'A' as const, triggered, level: 'error' as const, detail: equity !== null ? `所有者权益: ${equity.toFixed(0)}万元` : '数据缺失' }; })(),
    (() => { const revenue = num(latestFs, 'revenue'); const ocf = num(latestFs, 'operatingCashFlow'); const triggered = revenue !== null && ocf !== null && revenue > 0 && ocf / revenue < 0.05; return { id: 'A10', name: '现金含量比<5%（收入含金量低）', set: 'A' as const, triggered, level: 'warning' as const, detail: revenue !== null && ocf !== null ? `现金含量比: ${(ocf/revenue*100).toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const netProfitMargin = num(latestFs, 'netProfitMargin'); const triggered = netProfitMargin !== null && netProfitMargin < 1; return { id: 'A11', name: '净利润率<1%', set: 'A' as const, triggered, level: 'warning' as const, detail: netProfitMargin !== null ? `净利润率: ${netProfitMargin.toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const financialExpenses = num(latestFs, 'financialExpenses'); const revenue = num(latestFs, 'revenue'); const triggered = financialExpenses !== null && revenue !== null && revenue > 0 && financialExpenses / revenue > 0.1; return { id: 'A12', name: '财务费用占收入>10%', set: 'A' as const, triggered, level: 'warning' as const, detail: financialExpenses !== null && revenue !== null ? `财务费用占比: ${(financialExpenses/revenue*100).toFixed(2)}%` : '数据缺失' }; })(),
    (() => { const investingCashFlow = num(latestFs, 'investingCashFlow'); const ocf = num(latestFs, 'operatingCashFlow'); const triggered = investingCashFlow !== null && ocf !== null && ocf < 0 && investingCashFlow < 0; return { id: 'A13', name: '经营现金流和投资现金流同时为负', set: 'A' as const, triggered, level: 'error' as const, detail: `经营CF: ${ocf ?? '--'}, 投资CF: ${investingCashFlow ?? '--'}` }; })(),
    (() => { const financingCashFlow = num(latestFs, 'financingCashFlow'); const ocf = num(latestFs, 'operatingCashFlow'); const triggered = financingCashFlow !== null && ocf !== null && ocf < 0 && financingCashFlow > 0; return { id: 'A14', name: '经营现金流为负但筹资现金流为正（借新还旧）', set: 'A' as const, triggered, level: 'error' as const, detail: `经营CF: ${ocf ?? '--'}, 筹资CF: ${financingCashFlow ?? '--'}` }; })(),
  ];

  // ── 套B 跨期规则（8条）──
  const rulesB: FARuleResult[] = [
    // 套B跨期规则：如果最新期是月报而上期是年报，流量指标不可直接对比，触发设为false并在detail中说明
    (() => { const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue'); const triggered = !crossPeriodIncomparable && r0 !== null && r1 !== null && r1 > 0 && (r0 - r1) / r1 < -0.2; return { id: 'B01', name: '营业收入同比下降>20%', set: 'B' as const, triggered, level: 'error' as const, detail: crossPeriodIncomparable ? `数据期间不可比（${latestPeriodType}报 vs ${prevPeriodType}报），无法直接同比` : (r0 !== null && r1 !== null ? `收入变动: ${((r0-r1)/r1*100).toFixed(2)}%` : '缺少对比年数据') }; })(),
    (() => { const p0 = num(latestFs, 'netProfit'); const p1 = num(prevFs, 'netProfit'); const triggered = !crossPeriodIncomparable && p0 !== null && p1 !== null && p1 > 0 && (p0 - p1) / p1 < -0.3; return { id: 'B02', name: '净利润同比下降>30%', set: 'B' as const, triggered, level: 'error' as const, detail: crossPeriodIncomparable ? `数据期间不可比（${latestPeriodType}报 vs ${prevPeriodType}报）` : (p0 !== null && p1 !== null ? `利润变动: ${((p0-p1)/p1*100).toFixed(2)}%` : '缺少对比年数据') }; })(),
    (() => { const d0 = num(latestFs, 'debtRatio'); const d1 = num(prevFs, 'debtRatio'); const triggered = d0 !== null && d1 !== null && (d0 - d1) > 10; return { id: 'B03', name: '资产负债率同比上升>10pct', set: 'B' as const, triggered, level: 'warning' as const, detail: d0 !== null && d1 !== null ? `负债率变化: +${(d0-d1).toFixed(1)}pct` : '缺少对比年数据' }; })(),
    (() => { const o0 = num(latestFs, 'operatingCashFlow'); const o1 = num(prevFs, 'operatingCashFlow'); const triggered = !crossPeriodIncomparable && o0 !== null && o1 !== null && o0 < 0 && o1 < 0; return { id: 'B04', name: '经营现金流连续两年为负', set: 'B' as const, triggered, level: 'error' as const, detail: crossPeriodIncomparable ? `数据期间不可比（${latestPeriodType}报 vs ${prevPeriodType}报）` : (o0 !== null && o1 !== null ? `本期: ${o0.toFixed(0)}, 上期: ${o1.toFixed(0)}万元` : '缺少对比年数据') }; })(),
    (() => { const gm0 = num(latestFs, 'grossMargin'); const gm1 = num(prevFs, 'grossMargin'); const triggered = gm0 !== null && gm1 !== null && (gm0 - gm1) < -5; return { id: 'B05', name: '毛利率同比下降>5pct', set: 'B' as const, triggered, level: 'warning' as const, detail: gm0 !== null && gm1 !== null ? `毛利率变化: ${(gm0-gm1).toFixed(1)}pct` : '缺少对比年数据' }; })(),
    (() => { const np0 = num(latestFs, 'netProfit'); const ocf0 = num(latestFs, 'operatingCashFlow'); const np1 = num(prevFs, 'netProfit'); const ocf1 = num(prevFs, 'operatingCashFlow'); const triggered = np0 !== null && ocf0 !== null && np1 !== null && ocf1 !== null && np0 > 0 && ocf0 < 0 && np1 > 0 && ocf1 < 0; return { id: 'B06', name: '利润持续为正但现金流持续为负', set: 'B' as const, triggered, level: 'error' as const, detail: `本期利润: ${np0?.toFixed(0)}, 现金流: ${ocf0?.toFixed(0)}; 上期利润: ${np1?.toFixed(0)}, 现金流: ${ocf1?.toFixed(0)}` }; })(),
    (() => { const ar0 = num(latestFs, 'accountsReceivable') ?? num(latestFs, 'receivables'); const ar1 = num(prevFs, 'accountsReceivable') ?? num(prevFs, 'receivables'); const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue'); const arGrowth = ar0 !== null && ar1 !== null && ar1 > 0 ? (ar0 - ar1) / ar1 * 100 : null; const revGrowth = r0 !== null && r1 !== null && r1 > 0 ? (r0 - r1) / r1 * 100 : null; const triggered = arGrowth !== null && revGrowth !== null && arGrowth > revGrowth * 1.5 && arGrowth > 20; return { id: 'B07', name: '应收账款增速远超收入增速', set: 'B' as const, triggered, level: 'warning' as const, detail: arGrowth !== null && revGrowth !== null ? `应收增速: ${arGrowth.toFixed(2)}%, 收入增速: ${revGrowth.toFixed(2)}%` : '缺少对比年数据' }; })(),
    (() => { const inv0 = num(latestFs, 'inventory'); const inv1 = num(prevFs, 'inventory'); const r0 = num(latestFs, 'revenue'); const r1 = num(prevFs, 'revenue'); const invGrowth = inv0 !== null && inv1 !== null && inv1 > 0 ? (inv0 - inv1) / inv1 * 100 : null; const revGrowth = r0 !== null && r1 !== null && r1 > 0 ? (r0 - r1) / r1 * 100 : null; const triggered = invGrowth !== null && revGrowth !== null && invGrowth > revGrowth * 1.5 && invGrowth > 20; return { id: 'B08', name: '存货增速远超收入增速', set: 'B' as const, triggered, level: 'warning' as const, detail: invGrowth !== null && revGrowth !== null ? `存货增速: ${invGrowth.toFixed(2)}%, 收入增速: ${revGrowth.toFixed(2)}%` : '缺少对比年数据' }; })(),
  ];

  // ── 套C 三源交叉规则（6条）──
  const taxRevenue = appData.taxData ? parseFloat(String((appData.taxData as Record<string,unknown>).totalRevenue ?? '0').replace(/,/g,'')) || null : null;
  const bankData = appData.bankData as Record<string, unknown> | undefined;
  const bankMonthlyAvg = bankData ? parseFloat(String(bankData.monthlyAvgIncome ?? '0').replace(/,/g,'')) || null : null;
  const bankMonthlyAvgFromFlow = (() => {
    const bf = appData.bankFlowSummary;
    if (bf?.totalInflow && bf?.monthCount && bf.monthCount > 0) return bf.totalInflow / bf.monthCount;
    return null;
  })();
  const effectiveBankMonthlyAvg = bankMonthlyAvg ?? bankMonthlyAvgFromFlow;
  const fsRevenue = latestYearKey ? getYearNum(fsByYear, latestYearKey, 'revenue') : null;
  const rulesC: FARuleResult[] = [
    (() => { const triggered = fsRevenue !== null && taxRevenue !== null && taxRevenue > 0 && Math.abs(fsRevenue - taxRevenue) / taxRevenue > 0.3; return { id: 'C01', name: '财务收入与纳税收入差异>30%', set: 'C' as const, triggered, level: 'error' as const, detail: fsRevenue !== null && taxRevenue !== null ? `财务: ${fsRevenue.toFixed(0)}, 纳税: ${taxRevenue.toFixed(0)}, 差异: ${Math.abs(fsRevenue-taxRevenue).toFixed(0)}万元` : '缺少纳税数据' }; })(),
    (() => { const annualBank = effectiveBankMonthlyAvg !== null ? effectiveBankMonthlyAvg * 12 : null; const triggered = fsRevenue !== null && annualBank !== null && annualBank > 0 && Math.abs(fsRevenue - annualBank) / annualBank > 0.5; return { id: 'C02', name: '财务收入与流水年化差异>50%', set: 'C' as const, triggered, level: 'warning' as const, detail: fsRevenue !== null && annualBank !== null ? `财务: ${fsRevenue.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少流水数据' }; })(),
    (() => { const netProfit = num(latestFs, 'netProfit'); const ocf = num(latestFs, 'operatingCashFlow'); const triggered = netProfit !== null && ocf !== null && netProfit > 0 && ocf < 0; return { id: 'C03', name: '利润为正但经营现金流为负（利润质量差）', set: 'C' as const, triggered, level: 'error' as const, detail: `净利润: ${netProfit?.toFixed(0)}, 经营CF: ${ocf?.toFixed(0)}万元` }; })(),
    (() => { const annualTax = taxRevenue; const annualBank = effectiveBankMonthlyAvg !== null ? effectiveBankMonthlyAvg * 12 : null; const triggered = annualTax !== null && annualBank !== null && annualBank > 0 && Math.abs(annualTax - annualBank) / annualBank > 0.4; return { id: 'C04', name: '纳税收入与流水年化差异>40%', set: 'C' as const, triggered, level: 'warning' as const, detail: annualTax !== null && annualBank !== null ? `纳税: ${annualTax.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少纳税或流水数据' }; })(),
    (() => { const totalAssets = num(latestFs, 'totalAssets'); const totalLiabilities = num(latestFs, 'totalLiabilities'); const equity = totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null; const annualBank = effectiveBankMonthlyAvg !== null ? effectiveBankMonthlyAvg * 12 : null; const triggered = equity !== null && annualBank !== null && annualBank > 0 && equity / annualBank > 5; return { id: 'C05', name: '净资产远超流水收入（虚增资产嫌疑）', set: 'C' as const, triggered, level: 'warning' as const, detail: equity !== null && annualBank !== null ? `净资产: ${equity.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少相关数据' }; })(),
    (() => { const netProfit = num(latestFs, 'netProfit'); const annualBank = effectiveBankMonthlyAvg !== null ? effectiveBankMonthlyAvg * 12 : null; const triggered = netProfit !== null && annualBank !== null && annualBank > 0 && netProfit > 0 && netProfit / annualBank > 0.8; return { id: 'C06', name: '利润占流水收入比>80%（利润虚高嫌疑）', set: 'C' as const, triggered, level: 'warning' as const, detail: netProfit !== null && annualBank !== null ? `利润: ${netProfit.toFixed(0)}, 流水年化: ${annualBank.toFixed(0)}万元` : '缺少相关数据' }; })(),
  ];

  // ── 套D 客户集中度与收入稳定性规则（5条）──
  const top5Customers = appData.top5Customers;
  const latestTop5 = top5Customers && top5Customers.length > 0
    ? top5Customers.slice().sort((a: {year?: string | number}, b: {year?: string | number}) => String(b.year).localeCompare(String(a.year)))[0]
    : null;
  const top5Items = (latestTop5 as {items?: Array<{ratio?: string; name?: string}>} | null)?.items ?? [];
  const parseRatio = (r: string | undefined): number => { if (!r) return 0; const v = parseFloat(r.replace('%','').replace(',','').trim()); return isNaN(v) ? 0 : v; };
  const top1Ratio = top5Items.length > 0 ? parseRatio(top5Items[0]?.ratio) : null;
  const top1RatioNorm = top1Ratio !== null ? (top1Ratio > 1 ? top1Ratio / 100 : top1Ratio) : null;
  const hhiVal = top5Items.length > 0 ? top5Items.reduce((s: number, i: {ratio?: string}) => { const r = parseRatio(i.ratio); const rNorm = r > 1 ? r / 100 : r; return s + rNorm * rNorm; }, 0) : null;
  const bankMonthlyRevs = bankData
    ? (() => { const bd = bankData; if (Array.isArray(bd.monthlyStats)) { return (bd.monthlyStats as Array<Record<string,unknown>>).map(m => parseFloat(String(m.income ?? m.inflow ?? '0').replace(/,/g,'')) || 0).filter(v => v > 0); } if (Array.isArray(bd.monthlyRevenues)) { return (bd.monthlyRevenues as unknown[]).map(v => parseFloat(String(v).replace(/,/g,'')) || 0).filter(v => v > 0); } return null; })()
    : (() => {
        const bf = appData.bankFlowSummary;
        if (bf?.monthlyData && Array.isArray(bf.monthlyData)) {
          return (bf.monthlyData as Array<{inflow?: number}>).map(m => m.inflow ?? 0).filter(v => v > 0);
        }
        return null;
      })();
  const bankCV = bankMonthlyRevs && bankMonthlyRevs.length > 0
    ? (() => { const avg = bankMonthlyRevs.reduce((a, b) => a + b, 0) / bankMonthlyRevs.length; const variance = bankMonthlyRevs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / bankMonthlyRevs.length; return avg > 0 ? Math.sqrt(variance) / avg : null; })()
    : null;
  const rulesD: FARuleResult[] = [
    (() => { const triggered = hhiVal !== null && hhiVal > 0.25; return { id: 'D01', name: '客户集中度HHI指数>0.25（高集中度风险）', set: 'D' as const, triggered, level: 'error' as const, detail: hhiVal !== null ? `HHI = ${hhiVal.toFixed(3)}` : '缺少客户集中度数据' }; })(),
    (() => { const triggered = top1RatioNorm !== null && top1RatioNorm > 0.5; const isHard = top1RatioNorm !== null && top1RatioNorm > 0.7; return { id: 'D02', name: `Top1客户依赖度>${isHard ? '70%(硬性风险)' : '50%(扣分预警)'}`, set: 'D' as const, triggered, level: isHard ? 'error' as const : 'warning' as const, detail: top1RatioNorm !== null ? `第一大客户占比: ${(top1RatioNorm * 100).toFixed(2)}%` : '缺少客户占比数据' }; })(),
    (() => { const triggered = bankCV !== null && bankCV > 0.3; return { id: 'D03', name: '月度收入波动率>30%（收入不稳定）', set: 'D' as const, triggered, level: 'warning' as const, detail: bankCV !== null ? `月收入变异系数CV = ${(bankCV * 100).toFixed(2)}%` : '缺少银行流水月度数据' }; })(),
    (() => {
      const annualBank = bankMonthlyRevs && bankMonthlyRevs.length > 0 ? bankMonthlyRevs.reduce((a, b) => a + b, 0) / bankMonthlyRevs.length * 12 : null;
      const diff = fsRevenue !== null && annualBank !== null && annualBank > 0 ? Math.abs(fsRevenue - annualBank) / annualBank : null;
      const triggered = diff !== null && diff > 0.2;
      return { id: 'D04', name: '收入与流水匹配度差异>20%(收入真实性存疑)', set: 'D' as const, triggered, level: triggered ? 'error' as const : 'warning' as const, detail: diff !== null ? `财务收入: ${fsRevenue?.toFixed(0)}万, 流水年化: ${annualBank?.toFixed(0)}万, 差异: ${(diff * 100).toFixed(2)}%` : '缺少财务报表或银行流水数据' };
    })(),
    (() => {
      const invoiceTotal = (() => { const docs = appData.parsedDocuments; if (!docs) return null; const invDoc = docs.find((d: {fileType?: string}) => d.fileType === 'invoice'); if (!invDoc) return null; const d = invDoc.data as Record<string, unknown>; const v = d.totalAmount ?? d.invoiceTotal ?? d.amount; return v != null ? parseFloat(String(v).replace(/,/g,'')) || null : null; })();
      const diff = fsRevenue !== null && invoiceTotal !== null && invoiceTotal > 0 ? Math.abs(fsRevenue - invoiceTotal) / Math.max(fsRevenue, invoiceTotal) : null;
      const triggered = diff !== null && diff > 0.2;
      return { id: 'D05', name: '收入与发票匹配度差异>20%(存在未开票收入或虚开嫌疑)', set: 'D' as const, triggered, level: triggered ? 'error' as const : 'warning' as const, detail: diff !== null ? `财务收入: ${fsRevenue?.toFixed(0)}万, 发票金额: ${invoiceTotal?.toFixed(0)}万, 差异: ${(diff * 100).toFixed(2)}%` : '缺少财务报表或发票数据' };
    })(),
  ];

  // 规则元数据：公式和风险解读
  const RULE_META: Record<string, { formula: string; interpretation: string }> = {
    'A01': { formula: '营业收入 ≤ 0', interpretation: '企业无收入来源，可能已停业或处于亏损状态，贷款风险极高。' },
    'A02': { formula: '净利润 < 0', interpretation: '企业当期亏损，盈利能力不足，还款能力存疑。' },
    'A03': { formula: '经营活动现金流净额 < 0', interpretation: '主营业务造血能力不足，依赖外部融资维持运营，流动性风险高。' },
    'A04': { formula: '资产负债率 = 总负债 / 总资产 > 70%', interpretation: '负债比例过高，财务杠杆风险大，偿债压力沉重。' },
    'A05': { formula: '流动比率 = 流动资产 / 流动负债 < 1', interpretation: '短期偿债能力严重不足，存在流动性危机风险。' },
    'A06': { formula: '速动比率 = (流动资产 - 存货) / 流动负债 < 0.5', interpretation: '扣除存货后的即时偿债能力不足，短期资金紧张。' },
    'A07': { formula: 'ROE = 净利润 / 所有者权益 < 0', interpretation: '股东权益回报为负，资本使用效率低下，企业价值在减损。' },
    'A08': { formula: '毛利率 = (营业收入 - 营业成本) / 营业收入 < 5%', interpretation: '主营业务盈利空间极小，抗风险能力弱，行业竞争力不足。' },
    'A09': { formula: '所有者权益 = 总资产 - 总负债 < 0', interpretation: '资不抵债，企业净资产为负，破产风险极高。' },
    'A10': { formula: '现金含量比 = 经营现金流 / 营业收入 < 5%', interpretation: '收入质量差，大量收入未能转化为现金，应收账款或虚收入风险高。' },
    'A11': { formula: '净利润率 = 净利润 / 营业收入 < 1%', interpretation: '净利润率极低，盈利能力微弱，难以支撑债务偿还。' },
    'A12': { formula: '财务费用 / 营业收入 > 10%', interpretation: '财务成本占收入比例过高，融资成本侵蚀利润，债务负担沉重。' },
    'A13': { formula: '经营现金流 < 0 且 投资现金流 < 0', interpretation: '主营业务和投资活动均消耗现金，企业严重依赖外部融资，资金链风险高。' },
    'A14': { formula: '经营现金流 < 0 且 筹资现金流 > 0', interpretation: '主营业务无法自给，依靠借新还旧维持运营，债务滚动风险极高。' },
    'B01': { formula: '(本期收入 - 上期收入) / 上期收入 < -20%', interpretation: '营业收入大幅下滑，业务萎缩明显，还款能力持续恶化。' },
    'B02': { formula: '(本期净利润 - 上期净利润) / 上期净利润 < -30%', interpretation: '盈利能力急剧下降，经营状况持续恶化，信贷风险上升。' },
    'B03': { formula: '本期资产负债率 - 上期资产负债率 > 10pct', interpretation: '负债率快速上升，财务杠杆持续加大，偿债压力显著增加。' },
    'B04': { formula: '本期经营现金流 < 0 且 上期经营现金流 < 0', interpretation: '连续两年经营现金流为负，主营业务持续失血，资金链断裂风险高。' },
    'B05': { formula: '本期毛利率 - 上期毛利率 < -5pct', interpretation: '毛利率持续下滑，成本上升或价格竞争加剧，盈利空间收窄。' },
    'B06': { formula: '净利润 > 0 且 经营现金流 < 0（连续两期）', interpretation: '利润持续为正但现金流持续为负，利润质量差，存在虚增利润嫌疑。' },
    'B07': { formula: '应收账款增速 > 收入增速 × 1.5 且 应收增速 > 20%', interpretation: '应收账款增速远超收入增速，回款能力下降，坏账风险上升。' },
    'B08': { formula: '存货增速 > 收入增速 × 1.5 且 存货增速 > 20%', interpretation: '存货积压严重，产品滞销或产能过剩，流动资产质量下降。' },
    'C01': { formula: '|财务收入 - 纳税收入| / 纳税收入 > 30%', interpretation: '财务报表收入与纳税申报收入差异过大，存在财务造假或逃税嫌疑。' },
    'C02': { formula: '|财务收入 - 流水年化收入| / 流水年化收入 > 50%', interpretation: '财务收入与银行流水严重不符，收入真实性存疑，需人工核查。' },
    'C03': { formula: '净利润 > 0 且 经营现金流 < 0', interpretation: '利润为正但现金流为负，利润质量差，可能存在应收账款虚增或利润操纵。' },
    'C04': { formula: '|纳税收入 - 流水年化收入| / max(纳税, 流水) > 30%', interpretation: '纳税申报收入与银行流水差异过大，三方数据不一致，存在隐匿收入风险。' },
    'C05': { formula: '净资产 / 流水年化收入 > 5', interpretation: '净资产远超流水收入，资产与经营规模不匹配，存在虚增资产嫌疑。' },
    'C06': { formula: '净利润 / 流水年化收入 > 80%', interpretation: '利润占流水比例异常高，可能存在利润虚高或流水不完整。' },
    'D01': { formula: 'HHI = Σ(客户占比²) > 0.25', interpretation: '客户集中度极高，单一客户流失将对企业经营造成重大冲击。' },
    'D02': { formula: '第一大客户占比 > 50%（或 > 70%）', interpretation: '过度依赖单一客户，客户流失风险直接威胁企业生存。' },
    'D03': { formula: '月收入变异系数 CV = 标准差/均值 > 30%', interpretation: '月度收入波动剧烈，经营稳定性差，现金流不可预测，还款风险高。' },
    'D04': { formula: '|财务收入 - 流水年化| / 流水年化 > 20%', interpretation: '财务报表收入与银行流水不匹配，收入真实性存疑。' },
    'D05': { formula: '|财务收入 - 发票金额| / max(财务收入, 发票金额) > 20%', interpretation: '财务收入与发票金额不匹配，存在未开票收入或虚开发票嫌疑。' },
  };
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
            <span className="text-sm font-semibold text-gray-800">财务指标分析</span>
            <span className="text-xs text-gray-400">共 33 条规则</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all','A','B','C','D'] as const).map(s => (
            <button key={s} onClick={() => setActiveSet(s)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                activeSet === s ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}>
              {s === 'all' ? '全部规则' : s === 'A' ? '套A 单期(14)' : s === 'B' ? '套B 跨期(8)' : s === 'C' ? '套C 三源(6)' : '套D 集中度(5)'}
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
      <div className="space-y-2">
        {displayRules.map(rule => {
          const isExpanded = expandedRuleId === rule.id;
          const meta = RULE_META[rule.id];
          return (
            <div key={rule.id} className={`rounded-xl border overflow-hidden ${
              rule.triggered
                ? rule.level === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                : 'bg-white border-gray-100'
            }`}>
              <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
                onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {rule.triggered
                    ? rule.level === 'error' ? <XCircle size={14} className="text-red-500" /> : <AlertTriangle size={14} className="text-yellow-500" />
                    : <CheckCircle2 size={14} className="text-green-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      rule.set === 'A' ? 'bg-blue-100 text-blue-600' : rule.set === 'B' ? 'bg-purple-100 text-purple-600' : rule.set === 'C' ? 'bg-teal-100 text-teal-600' : 'bg-orange-100 text-orange-600'
                    }`}>{rule.id}</span>
                    <span className={`text-xs font-medium ${rule.triggered ? (rule.level === 'error' ? 'text-red-700' : 'text-yellow-700') : 'text-gray-600'}`}>
                      {rule.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{rule.detail}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`text-[10px] px-2 py-0.5 rounded-full ${
                    rule.triggered
                      ? rule.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {rule.triggered ? '已触发' : '正常'}
                  </div>
                  <ChevronDown size={12} className={`text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {isExpanded && meta && (
                <div className={`px-4 pb-3 pt-0 border-t ${
                  rule.triggered ? (rule.level === 'error' ? 'border-red-100' : 'border-yellow-100') : 'border-gray-100'
                }`}>
                  <div className="space-y-2 mt-2">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">计算公式</span>
                      <div className="mt-0.5 text-[10px] font-mono text-blue-700 bg-blue-50 rounded px-2 py-1">{meta.formula}</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">风险解读</span>
                      <div className={`mt-0.5 text-[10px] rounded px-2 py-1 ${
                        rule.triggered
                          ? rule.level === 'error' ? 'text-red-700 bg-red-50' : 'text-yellow-700 bg-yellow-50'
                          : 'text-gray-600 bg-gray-50'
                      }`}>{meta.interpretation}</div>
                    </div>
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
// ── 子Tab 4：综合评估 ──────────────────────────────────────────────────────────

function SummaryTab({ fsByYear, sortedYears, appData }: { fsByYear: Record<string, Record<string, unknown>>; sortedYears: string[]; appData: AppData }) {
  const years = sortedYears.slice(0, 3);
  const y0 = years[0];
  const latestFs = y0 ? fsByYear[y0] : null;

  const g = (key: string) => getYearNum(fsByYear, y0, key);

  const profitScore = (() => {
    const nm = g("netProfitMargin"), roe = g("roe"), gm = g("grossMargin");
    let score = 50;
    if (nm !== null) score += nm > 10 ? 20 : nm > 5 ? 10 : nm > 0 ? 0 : -20;
    if (roe !== null) score += roe > 15 ? 15 : roe > 8 ? 8 : roe > 0 ? 0 : -15;
    if (gm !== null) score += gm > 30 ? 15 : gm > 15 ? 8 : gm > 0 ? 0 : -15;
    return Math.max(0, Math.min(100, score));
  })();

  const debtScore = (() => {
    const dr = g("debtRatio"), cr = g("currentRatio"), qr = g("quickRatio");
    let score = 50;
    if (dr !== null) score += dr < 40 ? 20 : dr < 60 ? 10 : dr < 70 ? 0 : -20;
    if (cr !== null) score += cr > 2 ? 15 : cr > 1.5 ? 8 : cr > 1 ? 0 : -15;
    if (qr !== null) score += qr > 1 ? 15 : qr > 0.8 ? 8 : qr > 0.5 ? 0 : -15;
    return Math.max(0, Math.min(100, score));
  })();

  const operationScore = (() => {
    const arDays = g("arDays"), invDays = g("invDays");
    let score = 60;
    if (arDays !== null) score += arDays < 60 ? 20 : arDays < 120 ? 10 : arDays < 180 ? 0 : -20;
    if (invDays !== null) score += invDays < 90 ? 20 : invDays < 180 ? 10 : invDays < 365 ? 0 : -20;
    return Math.max(0, Math.min(100, score));
  })();

  const cashScore = (() => {
    const ocf = g("operatingCashFlow"), np = g("netProfit");
    let score = 50;
    if (ocf !== null) score += ocf > 0 ? 30 : -30;
    if (ocf !== null && np !== null && np !== 0) {
      const ratio = ocf / np;
      score += ratio > 1 ? 20 : ratio > 0.8 ? 10 : ratio > 0 ? 0 : -20;
    }
    return Math.max(0, Math.min(100, score));
  })();

  const totalScore = Math.round(profitScore * 0.3 + debtScore * 0.3 + operationScore * 0.2 + cashScore * 0.2);

  const scoreLevel = totalScore >= 75 ? { label: "优秀", color: "text-green-600", bg: "bg-green-50 border-green-200" } :
    totalScore >= 60 ? { label: "良好", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" } :
    totalScore >= 45 ? { label: "一般", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" } :
    { label: "较差", color: "text-red-600", bg: "bg-red-50 border-red-200" };

  const radarData = [
    { subject: "盈利能力", score: profitScore },
    { subject: "偿债能力", score: debtScore },
    { subject: "营运能力", score: operationScore },
    { subject: "现金流", score: cashScore },
  ];

  const CAGR = (() => {
    if (years.length < 2) return null;
    const rev0 = getYearNum(fsByYear, years[0], "revenue");
    const revN = getYearNum(fsByYear, years[years.length - 1], "revenue");
    if (rev0 === null || revN === null || revN <= 0) return null;
    const n = years.length - 1;
    return (Math.pow(rev0 / revN, 1 / n) - 1) * 100;
  })();

  // suppress unused variable warning
  void appData;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${scoreLevel.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 mb-1">财务健康综合评分</div>
            <div className={`text-3xl font-bold ${scoreLevel.color}`}>{totalScore}<span className="text-base font-normal text-gray-400">/100</span></div>
            <div className={`text-sm font-semibold mt-1 ${scoreLevel.color}`}>{scoreLevel.label}</div>
          </div>
          <div className="w-48 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <Radar name="得分" dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "盈利能力", score: profitScore, weight: "30%", color: "bg-blue-400" },
          { label: "偿债能力", score: debtScore, weight: "30%", color: "bg-purple-400" },
          { label: "营运能力", score: operationScore, weight: "20%", color: "bg-green-400" },
          { label: "现金流质量", score: cashScore, weight: "20%", color: "bg-orange-400" },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-600">{item.label}</span>
              <span className="text-[10px] text-gray-400">权重 {item.weight}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${item.score}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-700 w-8 text-right">{item.score}</span>
            </div>
          </div>
        ))}
      </div>
      {/* 四维度展开分析 */}
      {latestFs && (() => {
        const g = (key: string) => getYearNum(fsByYear, years[0], key);
        const revenue = g("revenue"); const netProfit = g("netProfit"); const ocf = g("operatingCashFlow");
        const totalAssets = g("totalAssets"); const totalLiab = g("totalLiabilities");
        const currentAssets = g("currentAssets"); const currentLiab = g("currentLiabilities");
        const inventory = g("inventory"); const costOfRevenue = g("costOfRevenue");
        const debtRatio = (totalAssets && totalLiab && totalAssets !== 0) ? (totalLiab / totalAssets * 100) : null;
        const currentRatio = (currentAssets && currentLiab && currentLiab !== 0) ? (currentAssets / currentLiab) : null;
        const quickRatio = (currentAssets != null && inventory != null && currentLiab && currentLiab !== 0) ? ((currentAssets - inventory) / currentLiab) : null;
        const grossMargin = (revenue && costOfRevenue && revenue !== 0) ? ((revenue - costOfRevenue) / revenue * 100) : null;
        const netMargin = (revenue && netProfit && revenue !== 0) ? (netProfit / revenue * 100) : null;
        const prevRevenue = years.length >= 2 ? getYearNum(fsByYear, years[1], "revenue") : null;
        const prevNetProfit = years.length >= 2 ? getYearNum(fsByYear, years[1], "netProfit") : null;
        const revenueGrowth = (prevRevenue && prevRevenue !== 0 && revenue != null) ? ((revenue - prevRevenue) / Math.abs(prevRevenue) * 100) : null;
        const profitGrowth = (prevNetProfit && prevNetProfit !== 0 && netProfit != null) ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit) * 100) : null;
        const roe = (() => { const eq = totalAssets !== null && totalLiab !== null ? totalAssets - totalLiab : null; return eq && eq !== 0 && netProfit !== null ? netProfit / eq * 100 : null; })();
        return (
          <div className="space-y-3">
            {/* 盈利能力展开 */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
              <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                <TrendingUp size={12} />盈利能力详细指标
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { label: "营业收入", value: revenue != null ? `${revenue.toFixed(0)}万` : "--", sub: revenueGrowth != null ? `同比${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(2)}%` : "", subColor: revenueGrowth != null ? (revenueGrowth >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400" },
                  { label: "净利润", value: netProfit != null ? `${netProfit.toFixed(0)}万` : "--", sub: profitGrowth != null ? `同比${profitGrowth >= 0 ? "+" : ""}${profitGrowth.toFixed(2)}%` : "", subColor: profitGrowth != null ? (profitGrowth >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400" },
                  { label: "毛利率", value: grossMargin != null ? `${grossMargin.toFixed(2)}%` : "--", sub: grossMargin != null ? (grossMargin < 0 ? "主业亏损" : grossMargin < 10 ? "盈利能力弱" : grossMargin < 30 ? "盈利一般" : "盈利较强") : "", subColor: grossMargin != null ? (grossMargin < 0 ? "text-red-600" : grossMargin < 10 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                  { label: "净利率", value: netMargin != null ? `${netMargin.toFixed(2)}%` : "--", sub: netMargin != null ? (netMargin < 1 ? "极弱" : netMargin < 5 ? "偏弱" : netMargin < 10 ? "一般" : "较强") : "", subColor: netMargin != null ? (netMargin < 1 ? "text-red-600" : netMargin < 5 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                  { label: "ROE", value: roe != null ? `${roe.toFixed(2)}%` : "--", sub: roe != null ? (roe < 0 ? "亏损" : roe < 5 ? "偏低" : roe < 15 ? "正常" : "优秀") : "", subColor: roe != null ? (roe < 0 ? "text-red-600" : roe < 5 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-lg px-2.5 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-xs font-bold text-gray-800">{item.value}</div>
                    {item.sub && <div className={`text-[10px] ${item.subColor}`}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-blue-700 leading-relaxed">
                {revenue != null && netProfit != null ? (
                  <>营业收入 <strong>{revenue.toFixed(0)}万元</strong>，净利润 <strong className={netProfit >= 0 ? "text-green-700" : "text-red-700"}>{netProfit.toFixed(0)}万元</strong>。
                  {revenueGrowth != null && <> 收入同比{revenueGrowth >= 0 ? <span className="text-green-700">增长{revenueGrowth.toFixed(2)}%</span> : <span className="text-red-700">下降{Math.abs(revenueGrowth).toFixed(2)}%</span>}。</>}
                  {netProfit < 0 ? <span className="text-red-700"> 企业处于亏损状态，需重点关注亏损原因。</span> : netMargin != null && netMargin < 3 ? <span className="text-amber-700"> 净利润率偏低，盈利能力较弱。</span> : <span className="text-green-700"> 盈利能力尚可。</span>}</>
                ) : "财务报表数据不完整，无法进行盈利能力分析。"}
              </div>
            </div>
            {/* 偿债能力展开 */}
            <div className="bg-purple-50 rounded-xl border border-purple-100 p-3">
              <div className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1.5">
                <Shield size={12} />偿债能力详细指标
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: "资产负债率", value: debtRatio != null ? `${debtRatio.toFixed(2)}%` : "--", sub: debtRatio != null ? (debtRatio > 80 ? "极高风险" : debtRatio > 70 ? "偏高" : debtRatio > 50 ? "适中" : "较低") : "", subColor: debtRatio != null ? (debtRatio > 70 ? "text-red-600" : debtRatio > 50 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                  { label: "流动比率", value: currentRatio != null ? currentRatio.toFixed(2) : "--", sub: currentRatio != null ? (currentRatio < 1 ? "短期偿债不足" : currentRatio < 1.5 ? "偿债一般" : "偿债良好") : "", subColor: currentRatio != null ? (currentRatio < 1 ? "text-red-600" : currentRatio < 1.5 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                  { label: "速动比率", value: quickRatio != null ? quickRatio.toFixed(2) : "--", sub: quickRatio != null ? (quickRatio < 0.5 ? "即时偿债不足" : quickRatio < 1 ? "偏弱" : "良好") : "", subColor: quickRatio != null ? (quickRatio < 0.5 ? "text-red-600" : quickRatio < 1 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-lg px-2.5 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-xs font-bold text-gray-800">{item.value}</div>
                    {item.sub && <div className={`text-[10px] ${item.subColor}`}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-purple-700 leading-relaxed">
                {debtRatio != null ? <>资产负债率 <strong>{debtRatio.toFixed(2)}%</strong>，{debtRatio > 80 ? "财务杠杆极高，偿债压力巨大。" : debtRatio > 70 ? "财务杠杆偏高，需关注债务结构。" : debtRatio > 50 ? "财务杠杆适中，偿债能力尚可。" : "财务杠杆较低，偿债能力较强。"}{currentRatio != null && <> 流动比率 <strong>{currentRatio.toFixed(2)}</strong>，{currentRatio < 1 ? "短期偿债存在缺口。" : "短期偿债能力正常。"}</>}</> : "偿债能力相关数据缺失。"}
              </div>
            </div>
            {/* 营运能力展开 */}
            <div className="bg-green-50 rounded-xl border border-green-100 p-3">
              <div className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <Activity size={12} />营运能力详细指标
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { label: "应收账款周转天数", value: g("arDays") != null ? `${g("arDays")!.toFixed(0)}天` : "--", sub: g("arDays") != null ? (g("arDays")! > 180 ? "回款极慢" : g("arDays")! > 90 ? "回款偏慢" : "回款正常") : "", subColor: g("arDays") != null ? (g("arDays")! > 180 ? "text-red-600" : g("arDays")! > 90 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                  { label: "存货周转天数", value: g("invDays") != null ? `${g("invDays")!.toFixed(0)}天` : "--", sub: g("invDays") != null ? (g("invDays")! > 365 ? "严重积压" : g("invDays")! > 180 ? "积压偏高" : "周转正常") : "", subColor: g("invDays") != null ? (g("invDays")! > 365 ? "text-red-600" : g("invDays")! > 180 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-lg px-2.5 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-xs font-bold text-gray-800">{item.value}</div>
                    {item.sub && <div className={`text-[10px] ${item.subColor}`}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-green-700 leading-relaxed">
                {g("arDays") != null || g("invDays") != null
                  ? <>营运效率{g("arDays") != null ? `，应收账款周转 ${g("arDays")!.toFixed(0)} 天` : ""}{g("invDays") != null ? `，存货周转 ${g("invDays")!.toFixed(0)} 天` : ""}。{(g("arDays") ?? 0) > 180 || (g("invDays") ?? 0) > 365 ? " 资金占用较高，需关注营运效率。" : " 营运效率处于正常水平。"}</>
                  : "营运能力数据缺失，建议补充应收账款和存货数据。"}
              </div>
            </div>
            {/* 现金流质量展开 */}
            <div className="bg-orange-50 rounded-xl border border-orange-100 p-3">
              <div className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                <Activity size={12} />现金流质量详细指标
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { label: "经营现金流", value: ocf != null ? `${ocf.toFixed(0)}万` : "--", sub: ocf != null ? (ocf < 0 ? "现金流异常" : "现金流健康") : "", subColor: ocf != null ? (ocf < 0 ? "text-red-600" : "text-green-600") : "text-gray-400" },
                  { label: "现金流/净利润", value: ocf != null && netProfit != null && netProfit !== 0 ? (ocf / netProfit).toFixed(2) : "--", sub: ocf != null && netProfit != null && netProfit !== 0 ? (ocf / netProfit < 0 ? "利润质量差" : ocf / netProfit < 0.5 ? "利润质量偏低" : "利润质量良好") : "", subColor: ocf != null && netProfit != null && netProfit !== 0 ? (ocf / netProfit < 0 ? "text-red-600" : ocf / netProfit < 0.5 ? "text-amber-600" : "text-green-600") : "text-gray-400" },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-lg px-2.5 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-xs font-bold text-gray-800">{item.value}</div>
                    {item.sub && <div className={`text-[10px] ${item.subColor}`}>{item.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-orange-700 leading-relaxed">
                {ocf != null ? <>经营现金流 <strong className={ocf >= 0 ? "text-green-700" : "text-red-700"}>{ocf.toFixed(0)}万元</strong>。{ocf < 0 ? " 经营现金流为负，依赖外部融资维持运营，流动性风险较高。" : netProfit != null && ocf < netProfit * 0.5 ? " 现金流远低于净利润，利润质量存疑，需核查应收账款回收。" : " 现金流与利润基本匹配，利润质量较好。"}</> : "现金流量表数据缺失，建议补充提供。"}
              </div>
            </div>
          </div>
        );
      })()}

      {CAGR !== null && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">营收 {years.length - 1} 年复合增长率（CAGR）</div>
          <div className={`text-xl font-bold ${CAGR >= 0 ? "text-green-600" : "text-red-600"}`}>
            {CAGR >= 0 ? "+" : ""}{CAGR.toFixed(2)}%
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Info size={12} className="text-blue-500" />综合授信建议
        </div>
        <div className="text-xs text-gray-600 leading-relaxed">
          {totalScore >= 75
            ? "企业财务健康状况良好，各维度指标均表现优秀。建议按正常流程推进授信审批，可适当给予较高授信额度。"
            : totalScore >= 60
            ? "企业财务状况整体良好，但部分指标存在轻微风险。建议有条件授信，加强贷后监控，定期获取财务报表。"
            : totalScore >= 45
            ? "企业财务状况一般，存在一定风险点。建议审慎授信，降低授信额度，要求追加担保措施，并补充尽职调查。"
            : "企业财务健康状况较差，多项指标存在重大风险。建议拒绝授信或大幅降低授信额度，需重点核查财务数据真实性。"}
        </div>
      </div>
    </div>
  );
}

// ─── 2. 银行流水分析面板 ──────────────────────────────────────────────────────

export function BankFlowPanel({ appData }: { appData: AppData }) {
  const [subTab, setSubTab] = useState<"overview" | "income" | "stability" | "concentration" | "anomaly" | "repayment" | "crosscheck">("overview");
  const bankFlow = appData.bankFlowSummary;
  const bankData = appData.bankData as Record<string, unknown> | undefined;
  const bankFromDocs = (() => {
    const docs = appData.parsedDocuments ?? [];
    const bd = docs.find((d) => d.fileType === "bank_statement" || d.fileType === "bank_flow");
    return bd ? (bd.data as Record<string, unknown>) : undefined;
  })();
  const effectiveBankData = bankData ?? bankFromDocs;
  if (!bankFlow && !effectiveBankData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <TrendingUp size={32} className="mb-3 opacity-30" />
        <div className="text-sm">请先上传银行流水</div>
        <div className="text-xs mt-1 text-gray-300">支持上传银行对公账户流水（Excel/PDF）</div>
      </div>
    );
  }
  // ── 基础指标提取 ──────────────────────────────────────────────────────────
  const totalInflow = bankFlow?.totalInflow ?? (effectiveBankData?.totalInflow ? parseNum(effectiveBankData.totalInflow as string | number) : null);
  const totalOutflow = bankFlow?.totalOutflow ?? (effectiveBankData?.totalOutflow ? parseNum(effectiveBankData.totalOutflow as string | number) : null);
  const netCashFlow = bankFlow?.netCashFlow ?? (totalInflow !== null && totalOutflow !== null ? totalInflow - totalOutflow : null);
  const monthCount = bankFlow?.monthCount ?? (effectiveBankData?.statementMonths ? parseNum(effectiveBankData.statementMonths as string | number) : null);
  const avgMonthInflow = totalInflow !== null && monthCount ? totalInflow / monthCount : (effectiveBankData?.avgMonthlyInflow ? parseNum(effectiveBankData.avgMonthlyInflow as string | number) : null);
  const avgMonthOutflow = totalOutflow !== null && monthCount ? totalOutflow / monthCount : null;
  const avgBalance = bankFlow?.avgBalance ?? (effectiveBankData?.avgBalance ? parseNum(effectiveBankData.avgBalance as string | number) : null);
  const minBalance = bankFlow?.minBalance ?? (effectiveBankData?.minBalance ? parseNum(effectiveBankData.minBalance as string | number) : null);
  const period = bankFlow?.statementPeriod ?? (effectiveBankData?.statementPeriod as string | undefined);
  const bankName = bankFlow?.bankName ?? (effectiveBankData?.bankName as string | undefined);
  const monthlyData = bankFlow?.monthlyData ?? (() => {
    const stats = effectiveBankData?.monthlyStats;
    if (stats && Array.isArray(stats)) {
      return (stats as Array<Record<string, unknown>>).map(m => ({
        month: m.month as string | undefined,
        inflow: parseNum(m.income as string | number ?? m.inflow as string | number) ?? 0,
        outflow: parseNum((m.expense ?? m.outflow) as string | number | null | undefined) ?? 0,
        balance: parseNum(m.balance as string | number | null | undefined) ?? undefined,
      }));
    }
    return undefined;
  })();
  // ── 稳定性指标 ─────────────────────────────────────────────────────────────
  const inflowVals = monthlyData?.map(m => m.inflow ?? 0).filter(v => v > 0) ?? [];
  const balanceCoverageDays = avgBalance !== null && avgMonthOutflow && avgMonthOutflow > 0
    ? Math.round(avgBalance / (avgMonthOutflow / 30)) : null;
  const minBalanceCoverageDays = minBalance !== null && avgMonthOutflow && avgMonthOutflow > 0
    ? Math.round(minBalance / (avgMonthOutflow / 30)) : null;
  const inflowCV = (() => {
    if (inflowVals.length < 3) return null;
    const avg = inflowVals.reduce((a, b) => a + b, 0) / inflowVals.length;
    const std = Math.sqrt(inflowVals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / inflowVals.length);
    return avg > 0 ? parseFloat((std / avg * 100).toFixed(1)) : null;
  })();
  // 月末冲量指数（简化：检测月度流入中高于均值1.5倍的月份占比）
  const monthEndSurgeIdx = (() => {
    if (!monthlyData || monthlyData.length < 2) return null;
    if (inflowVals.length < 3) return null;
    const avg = inflowVals.reduce((a, b) => a + b, 0) / inflowVals.length;
    const surgeMonths = inflowVals.filter(v => v > avg * 1.5).length;
    return parseFloat((surgeMonths / inflowVals.length * 100).toFixed(1));
  })();
  // ── TOP5 对手方集中度 ─────────────────────────────────────────────────────
  const top5Raw = (() => {
    // 优先从 bankFlowSummary 读取（LLM 解析路径），再从 bankData/parsedDocuments 读取
    const bfsCp = bankFlow?.top5Counterparties;
    if (bfsCp && Array.isArray(bfsCp) && bfsCp.length > 0) {
      // bankFlowSummary 使用 direction: 'in'/'out' 字段
      return bfsCp.map(c => ({ name: c.name, amount: c.amount, count: c.count, type: c.direction === 'in' ? 'inflow' : 'outflow' }));
    }
    const cp = effectiveBankData?.top5Counterparties;
    if (cp && Array.isArray(cp)) return cp as Array<{ name: string; amount: number; count: number; type?: string }>;
    return null;
  })();
  const top5Inflow = top5Raw?.filter(c => !c.type || c.type === 'inflow' || c.type === 'income' || c.type === 'in');
  const top5Outflow = top5Raw?.filter(c => c.type === 'outflow' || c.type === 'expense' || c.type === 'out');
  const top5InflowConc = totalInflow && top5Inflow && top5Inflow.length > 0
    ? parseFloat((top5Inflow.reduce((a, c) => a + c.amount, 0) / totalInflow * 100).toFixed(2)) : null;
  const top5OutflowConc = totalOutflow && top5Outflow && top5Outflow.length > 0
    ? parseFloat((top5Outflow.reduce((a, c) => a + c.amount, 0) / totalOutflow * 100).toFixed(2)) : null;
  const maxSingleClientPct = totalInflow && top5Inflow && top5Inflow.length > 0
    ? parseFloat((Math.max(...top5Inflow.map(c => c.amount)) / totalInflow * 100).toFixed(2)) : null;
  // ── 异常行为 ─────────────────────────────────────────────────────────────
  const anomalies: Array<{ text: string; level: "high" | "medium" }> = [];
  if (avgMonthInflow !== null && avgMonthInflow < 10) {
    anomalies.push({ text: "月均流入金额极低（<10万元），企业经营规模存疑", level: "high" });
  }
  if (inflowCV !== null && inflowCV > 80) {
    anomalies.push({ text: `月度流入变异系数偏高（CV=${inflowCV.toFixed(1)}%），收入极不稳定，可能存在季节性业务或经营不稳定`, level: "medium" });
  } else if (inflowCV !== null && inflowCV > 50) {
    anomalies.push({ text: `月度流入波动率偏高（CV=${inflowCV.toFixed(1)}%），收入稳定性较差`, level: "medium" });
  }
  if (minBalanceCoverageDays !== null && minBalanceCoverageDays < 3) {
    anomalies.push({ text: `账户余额最低点覆盖天数仅 ${minBalanceCoverageDays} 天，曾经历极度资金紧张，偿债风险高`, level: "high" });
  }
  if (monthEndSurgeIdx !== null && monthEndSurgeIdx > 50) {
    anomalies.push({ text: `月末冲量指数偏高（${monthEndSurgeIdx.toFixed(1)}%），疑似月末冲量操作，需核查月末大额回款后的月初转出情况`, level: "medium" });
  }
  if (top5InflowConc !== null && top5InflowConc > 60) {
    anomalies.push({ text: `TOP5客户收款集中度 ${top5InflowConc.toFixed(2)}%（>60%），客户集中度过高，单一客户流失风险大`, level: "medium" });
  }
  if (maxSingleClientPct !== null && maxSingleClientPct > 40) {
    anomalies.push({ text: `最大单一客户收款占比 ${maxSingleClientPct.toFixed(2)}%（>40%），严重依赖单一客户，议价能力弱`, level: "high" });
  }
  // ── 与财报交叉验证 ────────────────────────────────────────────────────────
  const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
  const latestFsYear = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a))[0];
  const fsRevenue = latestFsYear ? getYearNum(fsByYear, latestFsYear, "revenue") : null;
  const annualizedInflow = avgMonthInflow ? avgMonthInflow * 12 : null;
  const inflowRevenueRatio = annualizedInflow && fsRevenue && fsRevenue > 0
    ? parseFloat((annualizedInflow / fsRevenue).toFixed(2)) : null;
  // ── 还款记录 ──────────────────────────────────────────────────────────────
  const repaymentData = (effectiveBankData?.repaymentRecords ?? bankFlow?.repaymentRecords) as Array<Record<string, unknown>> | undefined;
  const repaymentCount = (effectiveBankData?.repaymentCount as number | undefined) ?? repaymentData?.length ?? null;
  const onTimeRepaymentRate = (effectiveBankData?.onTimeRepaymentRate as number | undefined) ?? null;
  const overdueCount = (effectiveBankData?.overdueCount as number | undefined) ?? null;
  // ── 流水风险评分（0-100分）────────────────────────────────────────────────
  const flowRiskScore = (() => {
    let score = 80;
    if (inflowRevenueRatio !== null) {
      if (inflowRevenueRatio < 0.3) score -= 20;
      else if (inflowRevenueRatio < 0.6) score -= 10;
      else if (inflowRevenueRatio > 1.4) score -= 5;
      else score += 5;
    }
    if (monthEndSurgeIdx !== null && monthEndSurgeIdx > 80) score -= 15;
    else if (monthEndSurgeIdx !== null && monthEndSurgeIdx > 50) score -= 8;
    if (inflowCV !== null && inflowCV > 80) score -= 10;
    else if (inflowCV !== null && inflowCV > 50) score -= 5;
    if (minBalanceCoverageDays !== null && minBalanceCoverageDays < 1) score -= 15;
    else if (minBalanceCoverageDays !== null && minBalanceCoverageDays < 3) score -= 8;
    if (maxSingleClientPct !== null && maxSingleClientPct > 40) score -= 8;
    if (top5InflowConc !== null && top5InflowConc > 60) score -= 5;
    if (overdueCount !== null && overdueCount >= 2) score -= 10;
    return Math.max(0, Math.min(100, score));
  })();
  const riskLevel = flowRiskScore >= 80 ? { label: "低风险", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", arc: "#10b981" }
    : flowRiskScore >= 60 ? { label: "中等风险", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", arc: "#3b82f6" }
    : flowRiskScore >= 40 ? { label: "较高风险", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", arc: "#f59e0b" }
    : flowRiskScore >= 20 ? { label: "高风险", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", arc: "#ef4444" }
    : { label: "极高风险", color: "text-red-700", bg: "bg-red-100", border: "border-red-300", arc: "#b91c1c" };
  // ── 图表数据 ──────────────────────────────────────────────────────────────
  const chartData = monthlyData?.map(m => ({
    month: m.month ?? "",
    月流入: m.inflow ?? null,
    月流出: m.outflow ?? null,
    净流量: (m.inflow ?? 0) - (m.outflow ?? 0),
    余额: m.balance ?? null,
  }));
  // 6维度评分雷达数据（用于概览）
  const dimScores = [
    { dim: "收入真实性", score: inflowRevenueRatio === null ? 50 : inflowRevenueRatio >= 0.6 && inflowRevenueRatio <= 1.4 ? 85 : inflowRevenueRatio < 0.3 ? 20 : 50 },
    { dim: "资金稳定性", score: inflowCV === null ? 50 : inflowCV < 30 ? 90 : inflowCV < 80 ? 65 : 30 },
    { dim: "集中度", score: top5InflowConc === null ? 60 : top5InflowConc < 40 ? 90 : top5InflowConc < 60 ? 70 : 40 },
    { dim: "异常行为", score: anomalies.length === 0 ? 90 : anomalies.some(a => a.level === "high") ? 30 : 60 },
    { dim: "还款记录", score: onTimeRepaymentRate !== null ? Math.round(onTimeRepaymentRate) : overdueCount !== null ? (overdueCount === 0 ? 90 : overdueCount < 2 ? 65 : 30) : 60 },
    { dim: "交叉验证", score: inflowRevenueRatio === null ? 50 : inflowRevenueRatio >= 0.6 && inflowRevenueRatio <= 1.4 ? 85 : 40 },
  ];
  const SUB_TABS = [
    { id: "overview" as const, label: "概览" },
    { id: "income" as const, label: "收入真实性" },
    { id: "stability" as const, label: "资金稳定性" },
    { id: "concentration" as const, label: "集中度" },
    { id: "anomaly" as const, label: "异常行为" },
    { id: "repayment" as const, label: "还款记录" },
    { id: "crosscheck" as const, label: "交叉验证" },
  ];
  return (
    <div className="space-y-3">
      {period && (
        <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span>分析基于 <strong>{period}</strong>{monthCount ? `（${monthCount}个月）` : ""} 流水数据{bankName ? `，开户行：${bankName}` : ""}</span>
        </div>
      )}
      {/* 顶部概览卡片 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "月均流入", value: fmtNum(avgMonthInflow, 0), sub: totalInflow ? `合计${fmtNum(totalInflow, 0)}万` : "", color: "text-green-600" },
          { label: "月均流出", value: fmtNum(avgMonthOutflow, 0), sub: totalOutflow ? `合计${fmtNum(totalOutflow, 0)}万` : "", color: "text-red-500" },
          { label: "月均净流量", value: fmtNum(netCashFlow !== null && monthCount ? netCashFlow / monthCount : null, 0), sub: netCashFlow !== null ? (netCashFlow >= 0 ? "净流入" : "净流出") : "", color: netCashFlow !== null && netCashFlow >= 0 ? "text-green-600" : "text-red-500" },
          { label: "流水风险评分", value: `${flowRiskScore}分`, sub: riskLevel.label, color: riskLevel.color },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5">
            <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
            <div className={`text-sm font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">{item.sub}</div>
          </div>
        ))}
      </div>
      {/* 子Tab导航 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {SUB_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
                subTab === t.id
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {/* ── 概览 Tab ── */}
          {subTab === "overview" && (
            <div className="space-y-4">
              {/* 流水风险评分仪表盘 + 6维度评分 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 风险评分仪表盘 */}
                <div className={`rounded-xl border p-4 ${riskLevel.bg} ${riskLevel.border}`}>
                  <div className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                    <Activity size={12} className="text-blue-500" />流水风险综合评分
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                        <circle
                          cx="40" cy="40" r="32" fill="none"
                          stroke={riskLevel.arc}
                          strokeWidth="8"
                          strokeDasharray={`${flowRiskScore / 100 * 201} 201`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                        <span className={`text-xl font-bold ${riskLevel.color}`}>{flowRiskScore}</span>
                        <span className="text-[9px] text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${riskLevel.color} mb-1`}>{riskLevel.label}</div>
                      <div className="text-[10px] text-gray-500 space-y-0.5">
                        <div>80-100分：低风险</div>
                        <div>60-79分：中等风险</div>
                        <div>40-59分：较高风险</div>
                        <div>20-39分：高风险</div>
                        <div>0-19分：极高风险</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 6维度评分条 */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold text-gray-600 mb-3">六维度评分分布</div>
                  <div className="space-y-2">
                    {dimScores.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-16 flex-shrink-0">{d.dim}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${d.score >= 80 ? "bg-green-500" : d.score >= 60 ? "bg-blue-500" : d.score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${d.score}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium w-6 text-right ${d.score > 79 ? "text-green-600" : d.score > 59 ? "text-blue-600" : d.score > 39 ? "text-amber-600" : "text-red-600"}`}>{d.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* 月均流水折线图 */}
              {chartData && chartData.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-green-500" />月均流水趋势（万元）
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [`${value?.toFixed(0)}万`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="月流入" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="月流出" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* 收支趋势图（柱状+净流量折线） */}
              {chartData && chartData.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-blue-500" />收支趋势与净流量（万元）
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [`${value?.toFixed(0)}万`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="月流入" fill="#10b981" opacity={0.7} />
                      <Bar yAxisId="left" dataKey="月流出" fill="#ef4444" opacity={0.7} />
                      <Line yAxisId="right" type="monotone" dataKey="净流量" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* 异常信号摘要 */}
              {anomalies.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-gray-600">风险信号摘要</div>
                  {anomalies.slice(0, 3).map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                      a.level === "high" ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                      {a.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ── 收入真实性 Tab ── */}
          {subTab === "income" && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">收款规模验证</div>
                <div className="space-y-2">
                  {[
                    { label: "年化流水收款（月均×12）", value: annualizedInflow ? fmtNum(annualizedInflow, 0) + "万元" : "--" },
                    { label: "财报营收（最新年度）", value: fsRevenue ? fmtNum(fsRevenue, 0) + "万元" : "--" },
                    { label: "流水/营收比", value: inflowRevenueRatio !== null ? inflowRevenueRatio.toFixed(2) : "--",
                      status: inflowRevenueRatio !== null ? (inflowRevenueRatio >= 0.6 && inflowRevenueRatio <= 1.4 ? "正常" : "预警") : "无数据",
                      alert: inflowRevenueRatio !== null && (inflowRevenueRatio < 0.6 || inflowRevenueRatio > 1.4) },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${(row as { alert?: boolean }).alert ? "text-amber-600" : "text-gray-800"}`}>{row.value}</span>
                        {(row as { status?: string }).status && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${(row as { alert?: boolean }).alert ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {(row as { status?: string }).status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {inflowRevenueRatio !== null && (
                  <div className={`mt-2 px-2 py-1.5 rounded text-xs ${inflowRevenueRatio >= 0.6 && inflowRevenueRatio <= 1.4 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {inflowRevenueRatio < 0.3 ? "⚠ 流水收款不足财报营收的30%，营收真实性存在重大疑问，建议重点核查。"
                      : inflowRevenueRatio < 0.6 ? "⚠ 流水收款与财报营收偏差较大（<60%），可能存在大量现金交易或赊销未回款，需核查。"
                      : inflowRevenueRatio > 1.4 ? "⚠ 流水收款远超财报营收（>140%），可能包含大量非经营性流入（借款、关联方转入），需剔除后重新核算。"
                      : "✓ 流水收款与财报营收基本匹配（60%-140%区间），营收真实性较高。"}
                  </div>
                )}
              </div>
              {/* 月度流入趋势图 */}
              {chartData && chartData.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 mb-2">月度流入趋势</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [`${value?.toFixed(0)}万`, "月流入"]} />
                      <Line type="monotone" dataKey="月流入" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      {avgMonthInflow && (
                        <Line type="monotone" dataKey={() => avgMonthInflow} stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} name="月均" />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">月末冲量检测</div>
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-gray-500">月末冲量指数（月末大额流入占比）</span>
                  <span className={`font-medium ${monthEndSurgeIdx !== null && monthEndSurgeIdx > 50 ? "text-amber-600" : "text-gray-800"}`}>
                    {monthEndSurgeIdx !== null ? `${monthEndSurgeIdx.toFixed(1)}%` : "--"}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  月末冲量是财务造假的典型特征——月末大额回款、月初大额转出，目的是在月末对账日制造高余额假象。指数持续超过50%需重点关注。
                </div>
              </div>
            </div>
          )}
          {/* ── 资金稳定性 Tab ── */}
          {subTab === "stability" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "月度流入变异系数", value: inflowCV !== null ? `${inflowCV.toFixed(1)}%` : "--",
                    status: inflowCV === null ? "无数据" : inflowCV < 30 ? "稳定" : inflowCV < 80 ? "一般" : "不稳定",
                    alert: inflowCV !== null && inflowCV > 80,
                    desc: "变异系数越低，收款越稳定。>80%说明收款极不稳定" },
                  { label: "余额覆盖天数（均值）", value: balanceCoverageDays !== null ? `${balanceCoverageDays}天` : "--",
                    status: balanceCoverageDays === null ? "无数据" : balanceCoverageDays >= 15 ? "充足" : balanceCoverageDays >= 7 ? "一般" : "偏低",
                    alert: balanceCoverageDays !== null && balanceCoverageDays < 7,
                    desc: "月均余额可支撑的经营天数，越高流动性越好" },
                  { label: "余额最低点覆盖天数", value: minBalanceCoverageDays !== null ? `${minBalanceCoverageDays}天` : "--",
                    status: minBalanceCoverageDays === null ? "无数据" : minBalanceCoverageDays >= 3 ? "正常" : "高风险",
                    alert: minBalanceCoverageDays !== null && minBalanceCoverageDays < 3,
                    desc: "<3天说明曾经历极度资金紧张，偿债风险高" },
                  { label: "统计月数", value: monthCount ? `${monthCount}个月` : "--",
                    status: monthCount ? (monthCount >= 12 ? "充足" : "偏少") : "无数据",
                    alert: monthCount !== null && monthCount < 6,
                    desc: "建议至少12个月流水，数据越多分析越准确" },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${item.alert ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                    <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-sm font-bold mb-1 ${item.alert ? "text-red-600" : "text-gray-800"}`}>{item.value}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.alert ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{item.status}</span>
                    <div className="text-[10px] text-gray-400 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
              {chartData && chartData.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">账户余额趋势</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: number) => [`${value?.toFixed(0)}万`, ""]} />
                      <Area type="monotone" dataKey="余额" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
          {/* ── 集中度分析 Tab ── */}
          {subTab === "concentration" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "TOP5客户收款集中度", value: top5InflowConc !== null ? `${top5InflowConc.toFixed(1)}%` : "--", alert: top5InflowConc !== null && top5InflowConc > 60, threshold: "预警：>60%" },
                  { label: "最大单一客户占比", value: maxSingleClientPct !== null ? `${maxSingleClientPct.toFixed(1)}%` : "--", alert: maxSingleClientPct !== null && maxSingleClientPct > 40, threshold: "预警：>40%" },
                  { label: "TOP5供应商付款集中度", value: top5OutflowConc !== null ? `${top5OutflowConc.toFixed(1)}%` : "--", alert: top5OutflowConc !== null && top5OutflowConc > 70, threshold: "预警：>70%" },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg p-3 border text-center ${item.alert ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
                    <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-base font-bold ${item.alert ? "text-amber-600" : "text-gray-800"}`}>{item.value}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{item.threshold}</div>
                  </div>
                ))}
              </div>
              {(top5InflowConc !== null || top5OutflowConc !== null) && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${(top5InflowConc !== null && top5InflowConc > 60) ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
                  {(top5InflowConc !== null && top5InflowConc > 60) ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {top5InflowConc !== null && `客户收款集中度 ${top5InflowConc.toFixed(1)}%`}
                  {maxSingleClientPct !== null && `，最大单一客户占比 ${maxSingleClientPct.toFixed(1)}%`}
                </div>
              )}
              {top5Raw && top5Raw.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">主要交易对手方（Top 5）</div>
                  <div className="divide-y divide-gray-50">
                    {top5Raw.map((item, i) => {
                      const pct = totalInflow && item.type !== 'outflow' ? item.amount / totalInflow * 100
                        : totalOutflow && item.type === 'outflow' ? item.amount / totalOutflow * 100 : null;
                      return (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                          <span className="flex-1 text-xs text-gray-700 truncate">{item.name}</span>
                          <span className="text-xs text-gray-500">{fmtNum(item.amount, 0)}万</span>
                          {pct !== null && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pct > 40 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                              {pct.toFixed(1)}%
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.type === 'outflow' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                            {item.type === 'outflow' ? "付款" : "收款"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-6">暂无对手方明细数据（需上传含对手方信息的流水）</div>
              )}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="font-semibold text-gray-600 mb-1">集中度预警阈值</div>
                <div>• TOP5客户收款集中度 &gt;60%：客户集中度过高，单一客户流失风险大</div>
                <div>• 最大单一客户收款占比 &gt;40%：严重依赖单一客户，议价能力弱</div>
                <div>• TOP5供应商付款集中度 &gt;70%：供应链集中度过高，断供风险大</div>
              </div>
            </div>
          )}
          {/* ── 异常行为 Tab ── */}
          {subTab === "anomaly" && (
            <div className="space-y-3">
              {anomalies.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2.5 rounded-lg">
                  <CheckCircle2 size={13} />未发现明显异常信号
                </div>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                      a.level === "high" ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      {a.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="font-semibold text-gray-600 mb-1">异常行为识别规则</div>
                <div>• 大额整数转账（≥50万且为整数）：可能为民间借贷或资金拆借</div>
                <div>• 月末冲量（月末大额回款+月初大额转出）：疑似制造高余额假象</div>
                <div>• 频繁小额分散转账（7天内向10+账户转账）：可能为资金分散转移</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700 space-y-1">
                <div className="font-semibold mb-1">一票否决触发条件</div>
                <div>• 月末冲量指数连续6个月超过80%，且月初转出对手方为关联方</div>
                <div>• 账户余额最低点覆盖天数低于1天，且持续出现3次以上</div>
                <div>• 流水收款不足财报营收的30%（收入真实性存疑）</div>
                <div>• 贷款资金3个工作日内向关联方或个人账户转出超过贷款金额的50%</div>
              </div>
            </div>
          )}
          {/* ── 还款记录 Tab ── */}
          {subTab === "repayment" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "历史还款笔数", value: repaymentCount !== null ? `${repaymentCount}笔` : "--", color: "text-gray-800", desc: "流水中识别到的还款记录" },
                  { label: "按时还款率", value: onTimeRepaymentRate !== null ? `${onTimeRepaymentRate.toFixed(1)}%` : "--", color: onTimeRepaymentRate !== null && onTimeRepaymentRate < 80 ? "text-red-600" : "text-green-600", desc: "按时还款笔数/总还款笔数" },
                  { label: "逾期次数", value: overdueCount !== null ? `${overdueCount}次` : "--", color: overdueCount !== null && overdueCount >= 2 ? "text-red-600" : "text-gray-800", desc: "历史逾期还款次数" },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
                    <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
              {repaymentData && repaymentData.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">还款记录明细</div>
                  <div className="divide-y divide-gray-50">
                    {repaymentData.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                        <span className="text-gray-400 w-20 flex-shrink-0">{r.date as string ?? "--"}</span>
                        <span className="flex-1 text-gray-700">{r.description as string ?? "贷款还款"}</span>
                        <span className="text-gray-800 font-medium">{r.amount ? fmtNum(parseNum(r.amount as string | number), 0) + "万" : "--"}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.onTime ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {r.onTime ? "按时" : "逾期"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-400 mb-2">暂无识别到的还款记录</div>
                  <div className="text-[10px] text-gray-300">系统通过流水摘要关键词（还款、贷款归还、本金、利息）自动识别还款记录</div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <div className="font-semibold mb-1">还款能力评估说明</div>
                <div>历史还款记录中，逾期还款超过2次，或平均还款提前天数为负（即经常逾期），应触发预警。按时还款率低于80%建议人工复核。</div>
              </div>
            </div>
          )}
          {/* ── 交叉验证 Tab ── */}
          {subTab === "crosscheck" && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-600 mb-2">流水 × 财报交叉验证</div>
                <div className="space-y-2">
                  {[
                    {
                      label: "流水收款/财报营收",
                      value: inflowRevenueRatio !== null ? inflowRevenueRatio.toFixed(2) : "--",
                      threshold: "正常区间：0.6 ~ 1.4",
                      status: inflowRevenueRatio === null ? "无数据" : (inflowRevenueRatio >= 0.6 && inflowRevenueRatio <= 1.4 ? "正常" : "预警"),
                      alert: inflowRevenueRatio !== null && (inflowRevenueRatio < 0.6 || inflowRevenueRatio > 1.4),
                    },
                    {
                      label: "年化流水收款",
                      value: annualizedInflow ? fmtNum(annualizedInflow, 0) + "万元" : "--",
                      threshold: "基于月均流入×12计算",
                      status: annualizedInflow ? "已计算" : "无数据",
                      alert: false,
                    },
                    {
                      label: "财报营收（最新年度）",
                      value: fsRevenue ? fmtNum(fsRevenue, 0) + "万元" : "--",
                      threshold: "来源：财务报表",
                      status: fsRevenue ? "已获取" : "缺失",
                      alert: !fsRevenue,
                    },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div>
                        <div className="text-gray-700">{row.label}</div>
                        <div className="text-gray-400 text-[10px]">{row.threshold}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${row.alert ? "text-amber-600" : "text-gray-800"}`}>{row.value}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.alert ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <div className="font-semibold mb-1">三方数据一致性说明</div>
                <div>当流水分析、税务分析和财务报表三者之间出现两两不一致时，系统将触发"三方不一致预警"，建议人工复核。完整的三方验证需同时上传银行流水、增值税申报表和财务报表。</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. 税务分析面板 ──────────────────────────────────────────────────────────

export function TaxAnalysisPanel({ appData }: { appData: AppData }) {
  const taxByYear = (appData.taxDataByYear ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  const taxByType = (appData.taxDataByType ?? {}) as Record<string, Record<string, unknown>>;
  const taxData = appData.taxData as Record<string, unknown> | undefined;

  const hasData = Object.keys(taxByYear).length > 0 || Object.keys(taxByType).length > 0 || !!taxData;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <FileText size={32} className="mb-3 opacity-30" />
        <div className="text-sm">请先上传税务资料</div>
        <div className="text-xs mt-1 text-gray-300">支持增值税申报表、企业所得税年报、完税证明</div>
      </div>
    );
  }

  const sortedYears = Object.keys(taxByYear).sort((a, b) => Number(b) - Number(a));

  function getTaxNum(data: Record<string, unknown> | undefined, ...keys: string[]): number | null {
    if (!data) return null;
    for (const k of keys) {
      const v = data[k];
      if (v !== null && v !== undefined && v !== "") {
        const n = parseNum(v as string | number, false);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function getYearTax(year: string) {
    const yd = taxByYear[year] ?? {};
    const vat = yd.vat ?? taxByType.vat ?? taxData;
    const income = yd.income ?? taxByType.income;
    const clearance = yd.clearance ?? taxByType.clearance;
    const credit = yd.credit ?? taxByType.credit;
    return { vat, income, clearance, credit };
  }

  const latestYear = sortedYears[0] ?? "最新";
  const { vat, income, clearance, credit } = getYearTax(latestYear);

  const vatRevenue = getTaxNum(vat as Record<string, unknown>, "taxableRevenue", "salesAmount", "totalSales", "含税销售额", "不含税销售额");
  const vatTax = getTaxNum(vat as Record<string, unknown>, "taxPayable", "vatPayable", "应纳税额", "实缴增值税");
  const vatRate = vatRevenue && vatTax ? (vatTax / vatRevenue * 100) : null;

  const citIncome = getTaxNum(income as Record<string, unknown>, "taxableIncome", "应纳税所得额", "taxableProfit");
  const citTax = getTaxNum(income as Record<string, unknown>, "taxPayable", "应纳税额", "incomeTaxPayable");
  const citRate = citIncome && citTax ? (citTax / citIncome * 100) : null;

  const creditLevel = (credit as Record<string, unknown>)?.creditLevel ?? (credit as Record<string, unknown>)?.taxCreditLevel ?? (taxData as Record<string, unknown>)?.taxCreditLevel;

  const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
  const fsRevenue = latestYear ? getYearNum(fsByYear, latestYear, "revenue") : null;
  const revDiff = fsRevenue && vatRevenue ? Math.abs(fsRevenue - vatRevenue) / Math.max(fsRevenue, vatRevenue) * 100 : null;

  // 增值税核心指标
  const vatInputTax = getTaxNum(vat as Record<string, unknown>, "inputTax", "进项税额", "deductibleInputTax");
  const vatOutputTax = getTaxNum(vat as Record<string, unknown>, "outputTax", "销项税额", "taxableOutputTax");
  const vatCarryover = getTaxNum(vat as Record<string, unknown>, "carryoverTax", "留抵税额", "excessInputTax", "taxCreditCarryforward");
  const inputOutputRatio = vatOutputTax && vatInputTax && vatOutputTax > 0 ? vatInputTax / vatOutputTax : null;
  // 企业所得税核心指标（税会差异分析）
  const fsNetProfit = latestYear ? getYearNum(fsByYear, latestYear, "netProfit") : null;
  const fsTotalProfit = latestYear ? getYearNum(fsByYear, latestYear, "totalProfit") : null;
  const taxAccountDiff = (citIncome !== null && (fsTotalProfit !== null || fsNetProfit !== null))
    ? (() => {
        const fsProfit = fsTotalProfit ?? fsNetProfit;
        if (!fsProfit || fsProfit === 0) return null;
        return ((fsProfit - citIncome) / Math.abs(fsProfit)) * 100;
      })()
    : null;
  // suppress unused variable warning
  void clearance;

  const tableData = sortedYears.map(y => {
    const yt = getYearTax(y);
    const vr = getTaxNum(yt.vat as Record<string, unknown>, "taxableRevenue", "salesAmount", "totalSales");
    const vt = getTaxNum(yt.vat as Record<string, unknown>, "taxPayable", "vatPayable");
    const ct = getTaxNum(yt.income as Record<string, unknown>, "taxPayable");
    const taxBurden = vr && (vt !== null || ct !== null) ? ((vt ?? 0) + (ct ?? 0)) / vr * 100 : null;
    return { year: `${y}年`, vatRevenue: vr, vatTax: vt, citTax: ct, taxBurden };
  });

  return (
    <div className="space-y-4">
      {creditLevel != null && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          ["A", "A+", "AA"].includes(String(creditLevel).toUpperCase())
            ? "bg-green-50 border-green-200"
            : ["B"].includes(String(creditLevel).toUpperCase())
            ? "bg-blue-50 border-blue-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className={`text-2xl font-bold ${
            ["A", "A+", "AA"].includes(String(creditLevel).toUpperCase()) ? "text-green-600" :
            ["B"].includes(String(creditLevel).toUpperCase()) ? "text-blue-600" : "text-amber-600"
          }`}>{String(creditLevel)}</div>
          <div>
            <div className="text-xs font-semibold text-gray-700">纳税信用等级</div>
            <div className="text-[11px] text-gray-500">
              {["A", "A+", "AA"].includes(String(creditLevel).toUpperCase()) ? "优质纳税人，税务合规风险低" :
               ["B"].includes(String(creditLevel).toUpperCase()) ? "良好纳税人，税务合规状况正常" :
               "需关注税务合规情况，建议核查历史记录"}
            </div>
          </div>
        </div>
      )}

      {sortedYears.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-orange-500" />多年度税务数据汇总
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-gray-600 font-medium">指标</th>
                  {sortedYears.map(y => <th key={y} className="text-right px-3 py-2 text-gray-600 font-medium">{y}年</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "增值税应税收入（万元）", key: "vatRevenue" as const },
                  { label: "增值税实缴（万元）", key: "vatTax" as const },
                  { label: "企业所得税（万元）", key: "citTax" as const },
                  { label: "综合税负率", key: "taxBurden" as const },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 text-gray-600">{row.label}</td>
                    {tableData.map((td, j) => {
                      const v = td[row.key];
                      return <td key={j} className="text-right px-3 py-2 font-medium text-gray-800">{v !== null ? (row.key === "taxBurden" ? fmtPct(v) : fmtNum(v, 0, "")) : "--"}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 近三年税务评判指标 */}
      {tableData.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <TrendingUp size={12} className="text-green-500" />近三年税务趋势评判
          </div>
          <div className="space-y-2">
            {(() => {
              const items: Array<{ label: string; status: "pass" | "warn" | "fail" | "nodata"; detail: string }> = [];
              // 1. 税负率趋势
              const burdens = tableData.map(td => td.taxBurden).filter((v): v is number => v !== null);
              if (burdens.length >= 2) {
                const trend = burdens[0] - burdens[burdens.length - 1];
                items.push({
                  label: "综合税负率趋势",
                  status: Math.abs(trend) < 1 ? "pass" : trend > 2 ? "warn" : "pass",
                  detail: `近${burdens.length}年税负率：${burdens.map(b => b.toFixed(1) + "%").join(" → ")}。${Math.abs(trend) < 1 ? "税负率稳定，无异常波动。" : trend > 2 ? "税负率明显上升，需关注税务成本变化。" : "税负率有所下降，可能存在税务优惠或筹划。"}`
                });
              }
              // 2. 增值税收入与财报收入匹配度
              const vatRevs = tableData.map(td => td.vatRevenue).filter((v): v is number => v !== null);
              const fsByYearLocal = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
              const fsYears = Object.keys(fsByYearLocal).sort((a, b) => Number(b) - Number(a));
              if (vatRevs.length > 0 && fsYears.length > 0) {
                const latestFsRev = getYearNum(fsByYearLocal, fsYears[0], "revenue");
                if (latestFsRev !== null && vatRevs[0] !== undefined) {
                  const diff = Math.abs(latestFsRev - vatRevs[0]) / Math.max(latestFsRev, vatRevs[0]) * 100;
                  items.push({
                    label: "财报收入与税务申报匹配度",
                    status: diff < 5 ? "pass" : diff < 20 ? "warn" : "fail",
                    detail: `最新期财报收入 ${latestFsRev.toFixed(0)}万，税务申报 ${vatRevs[0].toFixed(0)}万，差异 ${diff.toFixed(2)}%。${diff < 5 ? "高度吻合，数据可信度高。" : diff < 20 ? "存在轻微差异，建议关注收入确认时间差。" : "差异较大，财务数据真实性存疑，建议重点核查。"}`
                  });
                }
              }
              // 3. 企业所得税实际税率
              const citRates = tableData.map(td => {
                if (td.vatRevenue && td.citTax && td.vatRevenue > 0) return td.citTax / td.vatRevenue * 100;
                return null;
              }).filter((v): v is number => v !== null);
              if (citRates.length > 0) {
                const avgCitRate = citRates.reduce((a, b) => a + b, 0) / citRates.length;
                items.push({
                  label: "企业所得税实际税率",
                  status: avgCitRate < 1 ? "warn" : avgCitRate < 25 ? "pass" : "warn",
                  detail: `近${citRates.length}年企业所得税实际税率均值 ${avgCitRate.toFixed(2)}%。${avgCitRate < 1 ? "实际税率极低，需核查是否享受税收优惠政策及合规性。" : avgCitRate < 25 ? "税率处于正常区间，税务合规性良好。" : "实际税率偏高，建议核查是否存在税务筹划空间。"}`
                });
              }
              if (items.length === 0) {
                return <div className="text-xs text-gray-400">数据不足，无法生成评判指标</div>;
              }
              return items.map((item, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                  item.status === "pass" ? "bg-green-50 border-green-100" :
                  item.status === "warn" ? "bg-amber-50 border-amber-100" :
                  item.status === "fail" ? "bg-red-50 border-red-100" :
                  "bg-gray-50 border-gray-100"
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === "pass" ? <CheckCircle2 size={13} className="text-green-500" /> :
                     item.status === "warn" ? <AlertTriangle size={13} className="text-amber-500" /> :
                     item.status === "fail" ? <XCircle size={13} className="text-red-500" /> :
                     <Info size={13} className="text-gray-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-0.5">{item.label}</div>
                    <div className="text-[11px] text-gray-600 leading-relaxed">{item.detail}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      {/* 增值税核心指标 */}
      {(vatInputTax !== null || vatOutputTax !== null || vatCarryover !== null || inputOutputRatio !== null) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-blue-500" />增值税核心指标
          </div>
          <div className="grid grid-cols-2 gap-3">
            {vatInputTax !== null && (
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-gray-400 mb-1">进项税额</div>
                <div className="text-sm font-bold text-blue-700">{fmtNum(vatInputTax, 1)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">采购端抵扣金额，反映真实采购规模</div>
              </div>
            )}
            {vatOutputTax !== null && (
              <div className="bg-orange-50 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-gray-400 mb-1">销项税额</div>
                <div className="text-sm font-bold text-orange-700">{fmtNum(vatOutputTax, 1)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">销售端税额，与营收高度相关</div>
              </div>
            )}
            {vatCarryover !== null && (
              <div className={`rounded-lg px-3 py-2.5 ${vatCarryover > 0 ? "bg-amber-50" : "bg-green-50"}`}>
                <div className="text-[10px] text-gray-400 mb-1">留抵税额</div>
                <div className={`text-sm font-bold ${vatCarryover > 0 ? "text-amber-700" : "text-green-700"}`}>{fmtNum(vatCarryover, 1)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{vatCarryover > 0 ? "持续留抵需关注业务真实性" : "无留抵，税务状态正常"}</div>
              </div>
            )}
            {inputOutputRatio !== null && (
              <div className={`rounded-lg px-3 py-2.5 ${inputOutputRatio > 0.95 ? "bg-red-50" : inputOutputRatio > 0.8 ? "bg-amber-50" : "bg-green-50"}`}>
                <div className="text-[10px] text-gray-400 mb-1">进项/销项比</div>
                <div className={`text-sm font-bold ${inputOutputRatio > 0.95 ? "text-red-700" : inputOutputRatio > 0.8 ? "text-amber-700" : "text-green-700"}`}>{(inputOutputRatio * 100).toFixed(2)}%</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{inputOutputRatio > 0.95 ? "偏高，疑似虚开进项" : inputOutputRatio > 0.8 ? "偏高，需关注" : "正常范围"}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 企业所得税税会差异分析 */}
      {(citIncome !== null || taxAccountDiff !== null) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Activity size={12} className="text-purple-500" />企业所得税·税会差异分析
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {citIncome !== null && (
              <div className="bg-purple-50 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-gray-400 mb-1">应纳税所得额</div>
                <div className="text-sm font-bold text-purple-700">{fmtNum(citIncome, 0)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">税务口径税前利润</div>
              </div>
            )}
            {(fsTotalProfit !== null || fsNetProfit !== null) && (
              <div className="bg-indigo-50 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-gray-400 mb-1">财报利润总额</div>
                <div className="text-sm font-bold text-indigo-700">{fmtNum(fsTotalProfit ?? fsNetProfit, 0)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">财报口径税前利润</div>
              </div>
            )}
          </div>
          {taxAccountDiff !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              Math.abs(taxAccountDiff) < 15 ? "bg-green-50 text-green-700 border border-green-200" :
              Math.abs(taxAccountDiff) < 30 ? "bg-amber-50 text-amber-700 border border-amber-200" :
              "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {Math.abs(taxAccountDiff) < 15 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              税会差异率 {Math.abs(taxAccountDiff).toFixed(2)}%：
              {Math.abs(taxAccountDiff) < 15 ? "差异在合理范围内，财报利润可信度高" :
               Math.abs(taxAccountDiff) < 30 ? "存在一定差异，可能有合理的税务调整项，建议核查" :
               "差异超过30%警戒线，财报利润存在操纵嫌疑，需重点核查"}
            </div>
          )}
          {taxAccountDiff === null && citIncome !== null && (
            <div className="text-xs text-gray-400">暂无财报利润数据，无法进行税会差异对比。建议上传财务报表以完成交叉验证。</div>
          )}
        </div>
      )}
      {/* 税务综合结论 */}
      {tableData.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Info size={12} className="text-blue-500" />税务综合结论
          </div>
          <div className="text-xs text-gray-600 leading-relaxed">
            {(() => {
              const latestBurden = tableData[0]?.taxBurden;
              const vatRevs = tableData.map(td => td.vatRevenue).filter((v): v is number => v !== null);
              const hasTrend = vatRevs.length >= 2;
              const revTrend = hasTrend ? (vatRevs[0] - vatRevs[vatRevs.length - 1]) / Math.abs(vatRevs[vatRevs.length - 1]) * 100 : null;
              if (!latestBurden && vatRevs.length === 0) return "税务数据不完整，建议补充上传增值税申报表和企业所得税年报。";
              return <>
                {latestBurden !== null && <>综合税负率 <strong>{latestBurden.toFixed(2)}%</strong>，{latestBurden < 1 ? "明显偏低，需核查税务合规性。" : latestBurden < 5 ? "处于正常偏低水平，可能享有税收优惠。" : "处于正常水平。"} </>}
                {revTrend !== null && <>近{vatRevs.length}年税务申报收入{revTrend >= 0 ? <span className="text-green-700">增长{revTrend.toFixed(2)}%</span> : <span className="text-red-700">下降{Math.abs(revTrend).toFixed(2)}%</span>}，{revTrend >= 10 ? "业务规模持续扩张，税务合规风险相对较低。" : revTrend >= 0 ? "业务规模基本稳定。" : "业务规模有所收缩，需关注经营持续性。"}</>}
                {tableData.length < 3 && <span className="text-amber-600"> 建议补充上传近三年完整税务资料以获得更全面分析。</span>}
              </>;
            })()}
          </div>
        </div>
      )}
      {fsRevenue !== null && vatRevenue !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Network size={12} className="text-blue-500" />税务与财报收入交叉验证
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-blue-50 rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-gray-400 mb-1">财报营业收入</div>
              <div className="text-sm font-bold text-blue-700">{fmtNum(fsRevenue, 0)}</div>
            </div>
            <div className="bg-orange-50 rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-gray-400 mb-1">税务申报收入</div>
              <div className="text-sm font-bold text-orange-700">{fmtNum(vatRevenue, 0)}</div>
            </div>
          </div>
          {revDiff !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              revDiff < 5 ? "bg-green-50 text-green-700 border border-green-200" :
              revDiff < 15 ? "bg-amber-50 text-amber-700 border border-amber-200" :
              "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {revDiff < 5 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              差异率 {revDiff.toFixed(2)}%：
              {revDiff < 5 ? "两者高度吻合，数据可信度高" :
               revDiff < 15 ? "存在轻微差异，可能由收入确认时间差引起，建议关注" :
               "差异较大，财务数据真实性存疑，建议重点核查"}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-500" />税务风险提示
        </div>
        <div className="space-y-2 text-xs">
          {vatRate !== null && vatRate < 1 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              增值税有效税率仅 {vatRate.toFixed(2)}%，明显偏低，需核查是否存在进项税额异常或税务筹划
            </div>
          )}
          {citRate !== null && citRate < 5 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              企业所得税实际税率仅 {citRate.toFixed(2)}%，需核查是否享受税收优惠政策及其合规性
            </div>
          )}
          {revDiff !== null && revDiff >= 20 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-red-700">
              <XCircle size={11} className="flex-shrink-0 mt-0.5" />
              财报收入与税务申报收入差异达 {revDiff.toFixed(2)}%，超过20%警戒线，存在财务数据造假风险
            </div>
          )}
          {taxAccountDiff !== null && Math.abs(taxAccountDiff) >= 30 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-red-700">
              <XCircle size={11} className="flex-shrink-0 mt-0.5" />
              税会差异率达 {Math.abs(taxAccountDiff).toFixed(2)}%，超过30%预警线，财报利润与应纳税所得额差异较大，存在利润操纵嫌疑
            </div>
          )}
          {inputOutputRatio !== null && inputOutputRatio > 0.95 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              进项/销项税额比高达 {(inputOutputRatio * 100).toFixed(2)}%，接近1:1，采购端可能存在虚开进项发票风险
            </div>
          )}
          {vatCarryover !== null && vatCarryover > 0 && vatRevenue !== null && vatRevenue > 0 && (vatCarryover / vatRevenue * 100) > 10 && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-700">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              留抵税额占申报收入比 {(vatCarryover / vatRevenue * 100).toFixed(2)}%，持续留抵可能预示业务萎缩或进项虚开
            </div>
          )}
          {(vatRate === null && citRate === null && revDiff === null && taxAccountDiff === null) && (
            <div className="text-gray-400">暂无税务风险信号，数据完整后将自动更新</div>
          )}
          {(vatRate === null || vatRate >= 1) && (citRate === null || citRate >= 5) && (revDiff === null || revDiff < 20) && (taxAccountDiff === null || Math.abs(taxAccountDiff) < 30) && (inputOutputRatio === null || inputOutputRatio <= 0.95) && (vatRate !== null || citRate !== null || revDiff !== null || taxAccountDiff !== null) && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 size={12} />未发现明显税务风险信号
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 4. 行业分析面板 ──────────────────────────────────────────────────────────

// ─── 4. 行业分析面板 ──────────────────────────────────────────────────────────
export function IndustryAnalysisPanel({ appData }: { appData: AppData }) {
  const [customIndustry, setCustomIndustry] = useState<string>("");
  // 当 appData.industry 更新时（来自公司介绍解析），同步到 customIndustry
  const prevIndustryRef = React.useRef<string | undefined>(undefined);
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const industry = customIndustry || appData.industry || "";
  const [aiAnalysisText, setAiAnalysisText] = useState<string>("");
  const [aiAnalysisTriggered, setAiAnalysisTriggered] = useState(false);
  const analyzeFromProfile = trpc.industry.analyzeFromProfile.useMutation({
    onSuccess: (data) => setAiAnalysisText(data.analysisText),
  });
  // 当 appData.industry 更新时（来自公司介绍解析），自动填充行业输入框
  useEffect(() => {
    if (appData.industry && !customIndustry) {
      setCustomIndustry(appData.industry);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.industry]);

  // 自动触发：当有公司介绍或行业名称时，首次进入面板自动生成
  useEffect(() => {
    const hasProfile = !!(appData.companyProfile?.companyIntro || appData.companyName || industry);
    if (hasProfile && !aiAnalysisTriggered && !aiAnalysisText) {
      setAiAnalysisTriggered(true);
      analyzeFromProfile.mutate({
        industryName: industry || "制造业",
        companyProfile: appData.companyProfile?.companyIntro,
        companyName: appData.companyName,
        mainProducts: appData.companyProfile?.mainProducts,
        upstreamDesc: appData.companyProfile?.upstreamDesc,
        downstreamDesc: appData.companyProfile?.downstreamDesc,
        revenue: appData.revenue,
        registeredCapital: appData.registeredCapital,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当 AI 分析文字生成后，自动提取行业名称并填充到所属行业输入框
  useEffect(() => {
    if (!aiAnalysisText || customIndustry) return;
    // 尝试从 AI 分析文字中提取行业名称
    const patterns = [
      /所属行业[：:]\s*([^\n，,。.（(]{2,15})/,
      /行业类别[：:]\s*([^\n，,。.（(]{2,15})/,
      /属于([^\n，,。.（(]{2,10})行业/,
      /([^\n，,。.（(]{2,10})行业的/,
    ];
    for (const pat of patterns) {
      const m = aiAnalysisText.match(pat);
      if (m && m[1]) {
        const extracted = m[1].trim().replace(/^["'""'']+|["'""'']+$/g, '');
        if (extracted.length >= 2 && extracted.length <= 15) {
          setCustomIndustry(extracted);
          break;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAnalysisText]);
  // 行业变化时自动重新生成 AI 分析（带防抖，避免输入时频繁触发）
  const industryDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAnalysisIndustryRef = React.useRef<string>("");
  useEffect(() => {
    // 仅在 industry 真正变化（且已有初始分析）时触发重新生成
    if (!industry || industry === prevAnalysisIndustryRef.current) return;
    if (!aiAnalysisTriggered) return; // 首次触发由上面的 effect 处理
    if (industryDebounceRef.current) clearTimeout(industryDebounceRef.current);
    industryDebounceRef.current = setTimeout(() => {
      prevAnalysisIndustryRef.current = industry;
      analyzeFromProfile.mutate({
        industryName: industry,
        companyProfile: appData.companyProfile?.companyIntro,
        companyName: appData.companyName,
        mainProducts: appData.companyProfile?.mainProducts,
        upstreamDesc: appData.companyProfile?.upstreamDesc,
        downstreamDesc: appData.companyProfile?.downstreamDesc,
        revenue: appData.revenue,
        registeredCapital: appData.registeredCapital,
      });
    }, 1200);
    return () => { if (industryDebounceRef.current) clearTimeout(industryDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  // ── 细分行业 → 一级行业 映射（支持自由文本输入细分领域）──────────────────────
  const SUB_INDUSTRY_MAP: Record<string, string> = {
    // 新能源细分
    "光伏": "新能源", "光伏制造": "新能源", "光伏组件": "新能源", "光伏电站": "新能源",
    "风电": "新能源", "风力发电": "新能源", "储能": "新能源", "锂电池": "新能源",
    "动力电池": "新能源", "新能源汽车": "新能源", "充电桩": "新能源", "氢能": "新能源",
    "碳中和": "新能源", "绿电": "新能源", "电力": "新能源",
    // 制造业细分
    "机械制造": "制造业", "装备制造": "制造业", "精密制造": "制造业", "汽车零部件": "制造业",
    "电子制造": "制造业", "半导体": "制造业", "芯片": "制造业", "PCB": "制造业",
    "化工": "制造业", "塑料": "制造业", "橡胶": "制造业", "钢铁": "制造业",
    "有色金属": "制造业", "纺织": "制造业", "服装": "制造业", "印刷": "制造业",
    "食品加工": "制造业", "饮料": "制造业", "包装": "制造业",
    // 建筑业细分
    "房建": "建筑业", "工程建设": "建筑业", "基础设施": "建筑业", "装修装饰": "建筑业",
    "市政工程": "建筑业", "水利工程": "建筑业", "园林绿化": "建筑业",
    // 信息技术细分
    "软件开发": "信息技术", "SaaS": "信息技术", "云计算": "信息技术", "大数据": "信息技术",
    "人工智能": "信息技术", "AI": "信息技术", "网络安全": "信息技术", "物联网": "信息技术",
    "互联网": "信息技术", "电商平台": "信息技术", "游戏": "信息技术", "数字化": "信息技术",
    // 医疗健康细分
    "医疗器械": "医疗健康", "医药": "医疗健康", "生物医药": "医疗健康", "CRO": "医疗健康",
    "医院": "医疗健康", "诊所": "医疗健康", "健康管理": "医疗健康", "基因检测": "医疗健康",
    // 农林牧渔细分
    "养殖": "农林牧渔", "种植": "农林牧渔", "畜牧": "农林牧渔", "水产": "农林牧渔",
    "农业": "农林牧渔", "林业": "农林牧渔", "渔业": "农林牧渔",
    // 批发零售细分
    "商贸": "批发零售", "贸易": "批发零售", "进出口": "批发零售", "超市": "批发零售",
    "便利店": "批发零售", "母婴": "批发零售", "家居": "批发零售",
    // 物流运输细分
    "快递": "物流运输", "货运": "物流运输", "仓储": "物流运输", "供应链": "物流运输",
    "冷链": "物流运输", "航运": "物流运输",
    // 餐饮酒店细分
    "餐饮": "餐饮酒店", "酒店": "餐饮酒店", "民宿": "餐饮酒店", "外卖": "餐饮酒店",
    "连锁餐饮": "餐饮酒店", "咖啡": "餐饮酒店",
    // 房地产细分
    "开发商": "房地产", "物业": "房地产", "商业地产": "房地产", "工业地产": "房地产",
  };

  // ── 行业基准数据（扩充8维度）────────────────────────────────────────────────
  type IndustryBenchmark = {
    debtRatio: number; currentRatio: number; netMargin: number; arDays: number; invDays: number;
    riskLevel: "低" | "中等" | "中高" | "高";
    prosperity: string;
    seasonality: string;
    risks: string[];
    // 新增维度
    marketSize: string;          // 市场规模
    marketGrowth: string;        // 市场增速
    chainPosition: string;       // 产业链位置描述
    policyEnv: string;           // 政策环境
    competitionLevel: "分散" | "适中" | "集中" | "高度集中"; // 竞争格局
    competitionDesc: string;     // 竞争格局描述
    porter: {                    // 波特五力（1-5分）
      supplierPower: number;
      buyerPower: number;
      newEntrant: number;
      substitute: number;
      rivalry: number;
    };
    creditAdvice: string;        // 信贷建议
    typicalLoanTypes: string[];  // 适合的贷款品种
  };

  const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
    "制造业": {
      debtRatio: 55, currentRatio: 1.4, netMargin: 5, arDays: 90, invDays: 120,
      riskLevel: "中等", prosperity: "稳定",
      seasonality: "季节性较弱，受宏观经济周期影响较大，Q4通常为旺季",
      risks: ["原材料价格波动", "产能过剩风险", "环保政策收紧", "下游需求萎缩", "汇率风险（出口型）"],
      marketSize: "约40万亿元（制造业增加值）", marketGrowth: "年增速3-5%",
      chainPosition: "处于产业链中游，上游依赖原材料供应商，下游面向分销商或终端客户，议价能力中等",
      policyEnv: "国家大力推进制造业转型升级，智能制造、绿色制造获政策支持；传统高耗能行业面临环保压力",
      competitionLevel: "适中", competitionDesc: "行业集中度中等，头部企业市占率约30-40%，中小企业数量众多",
      porter: { supplierPower: 3, buyerPower: 3, newEntrant: 2, substitute: 2, rivalry: 4 },
      creditAdvice: "重点核查应收账款回收周期和存货质量，关注主要客户集中度；适合流动资金贷款和设备融资租赁",
      typicalLoanTypes: ["流动资金贷款", "设备融资租赁", "应收账款保理", "供应链融资"],
    },
    "建筑业": {
      debtRatio: 65, currentRatio: 1.3, netMargin: 3, arDays: 180, invDays: 90,
      riskLevel: "中高", prosperity: "稳定偏弱",
      seasonality: "冬季施工受限，Q1通常为淡季，Q2/Q3为施工旺季",
      risks: ["工程款回收风险", "政策调控影响", "资金占用大", "劳动力成本上升", "垫资压力大"],
      marketSize: "约31万亿元（建筑业总产值）", marketGrowth: "年增速2-4%",
      chainPosition: "处于产业链下游，上游依赖建材、设备供应商，下游面向政府/地产开发商；工程款回收周期长是核心风险",
      policyEnv: "基建投资保持稳定，但房地产下行拖累建筑业；绿色建筑、装配式建筑获政策鼓励",
      competitionLevel: "分散", competitionDesc: "行业高度分散，大型央企占据高端市场，中小企业竞争激烈，利润率持续承压",
      porter: { supplierPower: 3, buyerPower: 4, newEntrant: 2, substitute: 1, rivalry: 5 },
      creditAdvice: "重点核查工程款回收情况和应收账款账龄，关注是否存在大量逾期；建议要求提供工程合同和业主资信证明",
      typicalLoanTypes: ["流动资金贷款", "工程保函", "应收账款保理", "票据融资"],
    },
    "批发零售": {
      debtRatio: 50, currentRatio: 1.5, netMargin: 3, arDays: 45, invDays: 60,
      riskLevel: "中等", prosperity: "稳定",
      seasonality: "Q4（双十一/节假日）为旺季，Q1为淡季，节前备货需求大",
      risks: ["库存积压风险", "电商冲击传统渠道", "消费降级趋势", "资金周转压力", "客户流失风险"],
      marketSize: "约50万亿元（社会消费品零售总额）", marketGrowth: "年增速4-6%",
      chainPosition: "处于流通环节，连接生产商与终端消费者；线上线下融合趋势明显，渠道价值面临重构",
      policyEnv: "促消费政策持续发力，消费券、以旧换新等刺激措施；跨境电商获政策支持",
      competitionLevel: "集中", competitionDesc: "电商平台高度集中（阿里/京东/拼多多），传统零售分散；线下零售面临持续压力",
      porter: { supplierPower: 2, buyerPower: 4, newEntrant: 3, substitute: 4, rivalry: 4 },
      creditAdvice: "重点关注存货周转率和库存结构，核查是否存在滞销品；季节性备货期可适当放宽信贷支持",
      typicalLoanTypes: ["流动资金贷款", "存货质押融资", "供应链融资", "票据贴现"],
    },
    "信息技术": {
      debtRatio: 35, currentRatio: 2.0, netMargin: 12, arDays: 60, invDays: 30,
      riskLevel: "低", prosperity: "扩张",
      seasonality: "季节性较弱，政府采购项目集中于Q4",
      risks: ["技术迭代风险", "核心人才流失", "知识产权保护不足", "市场竞争激烈", "客户集中度高"],
      marketSize: "约10万亿元（数字经济核心产业）", marketGrowth: "年增速10-15%",
      chainPosition: "处于价值链高端，技术壁垒较高；SaaS/云计算企业具备较强的客户粘性和可预期的经常性收入",
      policyEnv: "数字中国战略持续推进，AI、大数据、云计算获重点支持；数据安全监管趋严",
      competitionLevel: "集中", competitionDesc: "头部平台企业高度集中，但垂直细分领域存在大量机会；AI赛道竞争白热化",
      porter: { supplierPower: 2, buyerPower: 3, newEntrant: 3, substitute: 3, rivalry: 4 },
      creditAdvice: "轻资产模式，重点评估经常性收入（ARR）和客户留存率；知识产权可作为补充担保；适合信用类贷款",
      typicalLoanTypes: ["信用贷款", "知识产权质押融资", "应收账款保理", "股权质押融资"],
    },
    "房地产": {
      debtRatio: 75, currentRatio: 1.2, netMargin: 8, arDays: 120, invDays: 360,
      riskLevel: "高", prosperity: "收缩",
      seasonality: "Q2/Q4为传统旺季（金三银四、金九银十），Q1为淡季",
      risks: ["调控政策风险", "流动性危机", "库存去化压力", "融资渠道收紧", "房价下行风险"],
      marketSize: "约12万亿元（商品房销售额）", marketGrowth: "年增速-5%至0%",
      chainPosition: "处于产业链核心，上游连接建材/建筑，下游连接购房者；当前去库存压力大，现金流紧张",
      policyEnv: "因城施策，部分城市放松限购；保交楼政策持续推进；房地产税立法进程影响预期",
      competitionLevel: "集中", competitionDesc: "行业集中度持续提升，TOP10房企市占率超30%；中小房企面临出清压力",
      porter: { supplierPower: 3, buyerPower: 4, newEntrant: 1, substitute: 2, rivalry: 4 },
      creditAdvice: "当前风险较高，建议审慎授信；重点核查预售资金监管情况、土地抵押价值和项目去化率；优先考虑有政府背景的国企",
      typicalLoanTypes: ["开发贷款", "并购贷款", "经营性物业贷款"],
    },
    "农林牧渔": {
      debtRatio: 45, currentRatio: 1.6, netMargin: 6, arDays: 60, invDays: 90,
      riskLevel: "中等", prosperity: "稳定",
      seasonality: "季节性强，受农业生产周期影响，春季播种、秋季收获为资金需求高峰",
      risks: ["自然灾害风险", "价格周期波动", "动植物疫病风险", "政策补贴变化", "劳动力短缺"],
      marketSize: "约9万亿元（农业总产值）", marketGrowth: "年增速4-5%",
      chainPosition: "处于产业链上游，为食品加工、餐饮等提供原材料；受天气、疫病影响大，供给波动性强",
      policyEnv: "国家高度重视粮食安全，农业补贴政策稳定；乡村振兴战略持续推进；绿色农业获政策支持",
      competitionLevel: "分散", competitionDesc: "行业高度分散，规模化程度低；龙头企业（温氏/牧原等）在养殖领域集中度较高",
      porter: { supplierPower: 2, buyerPower: 3, newEntrant: 3, substitute: 2, rivalry: 3 },
      creditAdvice: "重点关注自然灾害和疫病风险，建议要求农业保险作为增信措施；活体资产抵押需谨慎评估",
      typicalLoanTypes: ["农业经营贷款", "农机设备融资", "仓单质押融资", "政策性农业贷款"],
    },
    "新能源": {
      debtRatio: 50, currentRatio: 1.6, netMargin: 8, arDays: 75, invDays: 90,
      riskLevel: "中等", prosperity: "扩张",
      seasonality: "Q2/Q3装机旺季，Q1为淡季；光伏组件价格受硅料周期影响",
      risks: ["政策补贴退坡", "技术迭代加速", "原材料（锂/硅/铜）价格波动", "产能过剩风险", "国际贸易壁垒"],
      marketSize: "约3万亿元（新能源设备+电力）", marketGrowth: "年增速20-30%",
      chainPosition: "产业链长，从上游矿产（锂/硅）→中游制造（电池/组件）→下游电站运营；中游制造竞争最激烈",
      policyEnv: "双碳目标驱动，新能源装机持续高增；光伏/风电进入平价时代，补贴依赖降低；出口面临欧美反补贴调查",
      competitionLevel: "集中", competitionDesc: "光伏组件CR5超70%（隆基/天合/晶澳等），动力电池CR5超80%（宁德时代主导）；竞争白热化导致价格战",
      porter: { supplierPower: 4, buyerPower: 3, newEntrant: 2, substitute: 2, rivalry: 5 },
      creditAdvice: "重点关注产能利用率和订单质量，核查是否存在大客户集中风险；光伏电站可用电费收益权质押；储能项目关注电网并网进度",
      typicalLoanTypes: ["流动资金贷款", "设备融资租赁", "电费收益权质押", "绿色信贷"],
    },
    "医疗健康": {
      debtRatio: 40, currentRatio: 1.8, netMargin: 15, arDays: 90, invDays: 60,
      riskLevel: "低", prosperity: "稳定扩张",
      seasonality: "季节性较弱，流感季（Q1/Q4）略有波动；医疗器械采购集中于Q4",
      risks: ["医保控费政策收紧", "集采降价压力", "研发失败风险", "监管政策变化", "医疗事故风险"],
      marketSize: "约9万亿元（卫生总费用）", marketGrowth: "年增速8-10%",
      chainPosition: "上游为原料药/医疗耗材，中游为药品/器械制造，下游为医院/药店；医保支付方强势，议价能力强",
      policyEnv: "集采政策持续推进，仿制药/耗材价格承压；创新药获优先审批；医疗器械国产替代加速",
      competitionLevel: "适中", competitionDesc: "创新药领域集中度低（研发壁垒高），仿制药/耗材集采后价格竞争激烈；医疗服务区域性强",
      porter: { supplierPower: 2, buyerPower: 4, newEntrant: 2, substitute: 2, rivalry: 3 },
      creditAdvice: "创新药企业关注研发管线价值和现金储备；仿制药企业关注集采中标情况；医疗器械企业关注注册证和市场准入",
      typicalLoanTypes: ["研发贷款", "知识产权质押融资", "应收账款保理", "信用贷款"],
    },
    "教育": {
      debtRatio: 35, currentRatio: 1.5, netMargin: 10, arDays: 30, invDays: 15,
      riskLevel: "中等", prosperity: "稳定",
      seasonality: "Q3（暑期）为旺季，Q1为淡季；职业教育受政策影响较小",
      risks: ["政策监管风险（双减）", "生源竞争加剧", "师资成本上升", "校区租金压力", "口碑风险"],
      marketSize: "约6万亿元（教育总支出）", marketGrowth: "年增速5-8%",
      chainPosition: "直接面向学生/家长，服务属性强；职业教育、成人教育、企业培训受政策影响较小",
      policyEnv: "K12学科培训受双减政策严格限制；职业教育获国家大力支持；高等教育扩招",
      competitionLevel: "分散", competitionDesc: "K12培训集中度下降，职业教育/成人教育分散；头部机构品牌效应明显",
      porter: { supplierPower: 3, buyerPower: 3, newEntrant: 3, substitute: 3, rivalry: 3 },
      creditAdvice: "重点核查业务类型是否符合监管要求；关注学费预收款的资金安全；职业教育企业可重点支持",
      typicalLoanTypes: ["流动资金贷款", "校区装修贷款", "信用贷款"],
    },
    "物流运输": {
      debtRatio: 60, currentRatio: 1.3, netMargin: 4, arDays: 60, invDays: 30,
      riskLevel: "中等", prosperity: "稳定",
      seasonality: "Q4（双十一/年货节）为旺季，春节前后为淡季",
      risks: ["油价波动", "运力过剩", "平台竞争压价", "劳动力成本上升", "安全事故风险"],
      marketSize: "约14万亿元（物流业总收入）", marketGrowth: "年增速5-7%",
      chainPosition: "连接生产端与消费端，是供应链的重要基础设施；快递/快运集中度高，普通货运分散",
      policyEnv: "新能源物流车获补贴支持；冷链物流获政策鼓励；公路货运数字化转型加速",
      competitionLevel: "集中", competitionDesc: "快递CR5超80%（顺丰/三通一达/京东），快运集中度提升；普通货运高度分散",
      porter: { supplierPower: 3, buyerPower: 4, newEntrant: 2, substitute: 3, rivalry: 4 },
      creditAdvice: "重点核查车辆/仓库等固定资产价值，关注大客户集中度；车辆可作为抵押物；冷链物流企业可重点支持",
      typicalLoanTypes: ["车辆抵押贷款", "流动资金贷款", "融资租赁", "应收账款保理"],
    },
    "餐饮酒店": {
      debtRatio: 55, currentRatio: 1.2, netMargin: 6, arDays: 15, invDays: 20,
      riskLevel: "中高", prosperity: "稳定偏弱",
      seasonality: "节假日（春节/五一/国庆）为旺季，工作日为淡季；暑期旅游旺季带动酒店需求",
      risks: ["食品安全风险", "租金成本压力", "消费降级趋势", "疫情等突发事件", "人工成本上升"],
      marketSize: "约5万亿元（餐饮+住宿业收入）", marketGrowth: "年增速5-8%",
      chainPosition: "直接面向终端消费者，现金流较好但利润率低；连锁化率持续提升，品牌溢价明显",
      policyEnv: "促消费政策利好餐饮酒店；食品安全监管趋严；民宿/短租平台监管规范化",
      competitionLevel: "分散", competitionDesc: "行业高度分散，连锁化率约20%；头部连锁品牌（海底捞/麦当劳等）扩张迅速",
      porter: { supplierPower: 2, buyerPower: 4, newEntrant: 4, substitute: 4, rivalry: 5 },
      creditAdvice: "重点核查门店经营数据和现金流，关注租约期限与贷款期限匹配；连锁品牌加盟商可适当放宽",
      typicalLoanTypes: ["流动资金贷款", "装修贷款", "信用贷款"],
    },
  };

  // ── 细分行业匹配逻辑 ──────────────────────────────────────────────────────
  function matchIndustry(input: string): string {
    if (!input) return "制造业";
    // 1. 直接精确匹配
    if (INDUSTRY_BENCHMARKS[input]) return input;
    // 2. 细分行业映射
    for (const [sub, parent] of Object.entries(SUB_INDUSTRY_MAP)) {
      if (input.includes(sub) || sub.includes(input)) return parent;
    }
    // 3. 模糊匹配一级行业名称
    const found = Object.keys(INDUSTRY_BENCHMARKS).find(k =>
      input.includes(k) || k.includes(input.slice(0, 3))
    );
    return found ?? "制造业";
  }

  const matchedIndustry = matchIndustry(industry);
  const benchmark = INDUSTRY_BENCHMARKS[matchedIndustry];

  // 搜索建议：输入时显示匹配的行业和细分行业
  const suggestions = (() => {
    if (!inputValue || inputValue.length < 1) return [];
    const result: string[] = [];
    // 一级行业
    Object.keys(INDUSTRY_BENCHMARKS).forEach(k => {
      if (k.includes(inputValue) || inputValue.includes(k.slice(0, 2))) result.push(k);
    });
    // 细分行业
    Object.keys(SUB_INDUSTRY_MAP).forEach(k => {
      if (k.includes(inputValue) || inputValue.includes(k.slice(0, 2))) {
        const label = `${k}（→${SUB_INDUSTRY_MAP[k]}）`;
        if (!result.includes(label)) result.push(label);
      }
    });
    return result.slice(0, 8);
  })();

  const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
  const sortedYears = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
  const latestYear = sortedYears[0];
  const companyMetrics = latestYear ? {
    debtRatio: getYearNum(fsByYear, latestYear, "debtRatio"),
    currentRatio: getYearNum(fsByYear, latestYear, "currentRatio"),
    netMargin: getYearNum(fsByYear, latestYear, "netProfitMargin"),
    arDays: getYearNum(fsByYear, latestYear, "arDays"),
    invDays: getYearNum(fsByYear, latestYear, "invDays"),
  } : null;

  function getPercentile(company: number | null, bm: number, goodHigh: boolean): { label: string; color: string } {
    if (company === null) return { label: "--", color: "text-gray-400" };
    const ratio = company / bm;
    if (goodHigh) {
      if (ratio > 1.5) return { label: "P75+ 优秀", color: "text-green-600" };
      if (ratio > 1.0) return { label: "P50 良好", color: "text-blue-600" };
      if (ratio > 0.7) return { label: "P25 一般", color: "text-amber-600" };
      return { label: "P25- 偏弱", color: "text-red-600" };
    } else {
      if (ratio < 0.7) return { label: "P75+ 优秀", color: "text-green-600" };
      if (ratio < 1.0) return { label: "P50 良好", color: "text-blue-600" };
      if (ratio < 1.3) return { label: "P25 一般", color: "text-amber-600" };
      return { label: "P25- 偏弱", color: "text-red-600" };
    }
  }

  const comparisonItems = [
    { label: "资产负债率", company: companyMetrics?.debtRatio ?? null, bm: benchmark.debtRatio, fmt: fmtPct, goodHigh: false },
    { label: "流动比率", company: companyMetrics?.currentRatio ?? null, bm: benchmark.currentRatio, fmt: (v: number | null) => v !== null ? v.toFixed(2) : "--", goodHigh: true },
    { label: "净利率", company: companyMetrics?.netMargin ?? null, bm: benchmark.netMargin, fmt: fmtPct, goodHigh: true },
    { label: "应收账款周转", company: companyMetrics?.arDays ?? null, bm: benchmark.arDays, fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}天` : "--", goodHigh: false },
    { label: "存货周转", company: companyMetrics?.invDays ?? null, bm: benchmark.invDays, fmt: (v: number | null) => v !== null ? `${v.toFixed(0)}天` : "--", goodHigh: false },
  ];
  const radarData = comparisonItems.map(item => ({
    subject: item.label.length > 5 ? item.label.slice(0, 5) : item.label,
    企业: item.company !== null ? Math.min(100, Math.round(item.goodHigh ? (item.company / item.bm) * 50 : (2 - item.company / item.bm) * 50)) : 50,
    行业均值: 50,
  }));

  // 波特五力标签
  const porterLabels = ["供应商议价", "买方议价", "新进入者", "替代品威胁", "同业竞争"];
  const porterColors = ["text-blue-600", "text-purple-600", "text-green-600", "text-amber-600", "text-red-600"];
  const porterBgs = ["bg-blue-50", "bg-purple-50", "bg-green-50", "bg-amber-50", "bg-red-50"];
  const porterBarColors = ["bg-blue-400", "bg-purple-400", "bg-green-400", "bg-amber-400", "bg-red-400"];
  const porterValues = [
    benchmark.porter.supplierPower,
    benchmark.porter.buyerPower,
    benchmark.porter.newEntrant,
    benchmark.porter.substitute,
    benchmark.porter.rivalry,
  ];

  return (
    <div className="space-y-4">
      {/* ── 行业识别卡片 ── */}
      {/* ── AI 行业分析文字 ── */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
            <Sparkles size={12} className="text-orange-500" />AI 行业分析
            {(appData.companyProfile?.companyIntro || appData.companyName) && (
              <span className="text-[10px] text-orange-400 font-normal">（基于公司介绍）</span>
            )}
          </div>
          <button
            onClick={() => analyzeFromProfile.mutate({
              industryName: industry || matchedIndustry,
              companyProfile: appData.companyProfile?.companyIntro,
              companyName: appData.companyName,
              mainProducts: appData.companyProfile?.mainProducts,
              upstreamDesc: appData.companyProfile?.upstreamDesc,
              downstreamDesc: appData.companyProfile?.downstreamDesc,
              revenue: appData.revenue,
              registeredCapital: appData.registeredCapital,
            })}
            disabled={analyzeFromProfile.isPending}
            className="text-[10px] px-2 py-1 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition disabled:opacity-50 flex items-center gap-1"
          >
            {analyzeFromProfile.isPending ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {analyzeFromProfile.isPending ? "生成中…" : "重新生成"}
          </button>
        </div>
        {analyzeFromProfile.isPending && !aiAnalysisText && (
          <div className="flex items-center gap-2 text-xs text-orange-500 py-4 justify-center">
            <Loader2 size={14} className="animate-spin" />
            AI 正在分析行业特征，请稍候…
          </div>
        )}
        {analyzeFromProfile.isError && (
          <div className="text-xs text-red-500 py-2">生成失败，请点击"重新生成"重试</div>
        )}
        {aiAnalysisText ? (
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{aiAnalysisText}</div>
        ) : !analyzeFromProfile.isPending && !analyzeFromProfile.isError && (
          <div className="text-xs text-gray-400 py-2 text-center">点击"重新生成"生成行业分析</div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Globe size={18} className="text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {editingIndustry ? (
                <div className="relative flex items-center gap-2 w-full">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => { setInputValue(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="输入行业名称，如：光伏制造、新能源汽车…"
                      className="w-full text-sm border border-orange-300 rounded-lg px-3 py-1.5 bg-white text-gray-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
                      autoFocus
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            onMouseDown={() => {
                              const raw = s.includes("（→") ? s.split("（→")[0] : s;
                              setInputValue(raw);
                              setCustomIndustry(raw);
                              setEditingIndustry(false);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 border-b border-gray-50 last:border-0"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { if (inputValue.trim()) { setCustomIndustry(inputValue.trim()); } setEditingIndustry(false); setShowSuggestions(false); }}
                    className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex-shrink-0"
                  >确定</button>
                  <button
                    onClick={() => { setEditingIndustry(false); setShowSuggestions(false); }}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition flex-shrink-0"
                  >取消</button>
                </div>
              ) : (
                <>
                  <div className="text-sm font-semibold text-gray-800">{industry || "未识别行业"}</div>
                  {industry !== matchedIndustry && industry && (
                    <span className="text-[10px] text-gray-400">→ 参照：{matchedIndustry}</span>
                  )}
                  <button
                    onClick={() => { setInputValue(industry || matchedIndustry); setEditingIndustry(true); setShowSuggestions(false); }}
                    className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-orange-50 hover:text-orange-600 transition"
                  >修改行业</button>
                  {customIndustry && (
                    <button onClick={() => setCustomIndustry("")} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded hover:bg-red-50 hover:text-red-500 transition">重置</button>
                  )}
                </>
              )}
            </div>
            {!editingIndustry && (
              <div className="text-[10px] text-gray-400">支持细分领域输入，如"光伏制造"、"新能源汽车"、"医疗器械"等</div>
            )}
          </div>
          <div className="flex-shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              benchmark.riskLevel === "低" ? "bg-green-100 text-green-700" :
              benchmark.riskLevel === "中等" ? "bg-blue-100 text-blue-700" :
              benchmark.riskLevel === "中高" ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            }`}>
              行业风险：{benchmark.riskLevel}
            </span>
          </div>
        </div>
        {/* 景气度 + 竞争格局 + 市场规模 */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 mb-0.5">景气度</div>
            <div className={`font-medium ${benchmark.prosperity === "扩张" || benchmark.prosperity === "稳定扩张" ? "text-green-600" : benchmark.prosperity === "收缩" ? "text-red-600" : "text-gray-700"}`}>
              {benchmark.prosperity}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 mb-0.5">竞争格局</div>
            <div className={`font-medium ${benchmark.competitionLevel === "高度集中" || benchmark.competitionLevel === "集中" ? "text-amber-600" : "text-gray-700"}`}>
              {benchmark.competitionLevel}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 mb-0.5">市场增速</div>
            <div className="font-medium text-blue-600">{benchmark.marketGrowth}</div>
          </div>
        </div>
      </div>

      {/* ── 市场规模 + 产业链位置 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-blue-500" />市场规模与产业链位置
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-gray-400 mb-1">市场规模</div>
            <div className="text-xs font-bold text-blue-700">{benchmark.marketSize}</div>
            <div className="text-[10px] text-blue-500 mt-0.5">增速 {benchmark.marketGrowth}</div>
          </div>
          <div className="bg-orange-50 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-gray-400 mb-1">竞争格局</div>
            <div className="text-xs font-bold text-orange-700">{benchmark.competitionLevel}</div>
            <div className="text-[10px] text-orange-500 mt-0.5 leading-relaxed line-clamp-2">{benchmark.competitionDesc}</div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 leading-relaxed">
          <span className="font-medium text-gray-700">产业链位置：</span>{benchmark.chainPosition}
        </div>
      </div>

      {/* ── 政策环境 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Shield size={12} className="text-green-500" />政策环境
        </div>
        <div className="text-xs text-gray-600 leading-relaxed bg-green-50 rounded-lg px-3 py-2.5">
          {benchmark.policyEnv}
        </div>
      </div>

      {/* ── 波特五力分析 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Network size={12} className="text-purple-500" />波特五力分析
        </div>
        <div className="grid grid-cols-5 gap-2">
          {porterValues.map((val, i) => (
            <div key={i} className={`${porterBgs[i]} rounded-lg px-2 py-2.5 text-center`}>
              <div className="text-[10px] text-gray-500 mb-1.5 leading-tight">{porterLabels[i]}</div>
              <div className="flex justify-center gap-0.5 mb-1">
                {[1,2,3,4,5].map(n => (
                  <div key={n} className={`w-1.5 h-3 rounded-sm ${n <= val ? porterBarColors[i] : "bg-gray-200"}`} />
                ))}
              </div>
              <div className={`text-[10px] font-bold ${porterColors[i]}`}>{val}/5</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-gray-400 text-center">分值越高代表该力量越强，对行业盈利能力压制越大</div>
      </div>

      {/* ── 企业指标 vs 行业均值 ── */}
      {companyMetrics && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-orange-500" />企业指标 vs 行业均值
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                <Radar name="企业" dataKey="企业" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                <Radar name="行业均值" dataKey="行业均值" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="space-y-2 pt-2">
              {comparisonItems.map(item => {
                const pct = getPercentile(item.company, item.bm, item.goodHigh);
                return (
                  <div key={item.label} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-gray-500 text-[10px]">{item.label}</span>
                      <span className={`text-[10px] font-medium ${pct.color}`}>{pct.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="text-gray-600 font-medium">{item.fmt(item.company)}</span>
                      <span>vs 均值</span>
                      <span>{item.fmt(item.bm)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 季节性特征 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Activity size={12} className="text-blue-500" />季节性特征
        </div>
        <div className="text-xs text-gray-600 leading-relaxed bg-blue-50 rounded-lg px-3 py-2.5">
          {benchmark.seasonality}
        </div>
      </div>

      {/* ── 主要风险因素 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-500" />主要行业风险因素
        </div>
        <div className="space-y-2">
          {benchmark.risks.map((risk, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
              <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-700 text-[10px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
              {risk}
            </div>
          ))}
        </div>
      </div>

      {/* ── 上下游TOP5分析 ── */}
      {((appData.top5Customers && appData.top5Customers.length > 0) || (appData.top5Suppliers && appData.top5Suppliers.length > 0)) && (() => {
        const sortByYear = (arr: typeof appData.top5Customers) =>
          arr ? [...arr].sort((a, b) => Number(b.year) - Number(a.year)) : [];
        const latestCustomers = sortByYear(appData.top5Customers)[0];
        const latestSuppliers = sortByYear(appData.top5Suppliers)[0];
        const calcConcentration = (items: typeof latestCustomers.items) => {
          if (!items || items.length === 0) return null;
          const ratios = items.map(i => {
            const s = String(i.ratio ?? "").replace(/%/g, "").trim();
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n > 1 ? n : n * 100;
          });
          return ratios.reduce((a, b) => a + b, 0);
        };
        const custConc = latestCustomers ? calcConcentration(latestCustomers.items) : null;
        const suppConc = latestSuppliers ? calcConcentration(latestSuppliers.items) : null;
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Network size={12} className="text-blue-500" />上下游 TOP5 分析
              <span className="text-[10px] text-gray-400 font-normal">（客户集中度 · 供应商集中度 · 关联风险）</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* 前5大客户 */}
              {latestCustomers && latestCustomers.items && latestCustomers.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-medium text-gray-600">前5大客户 ({latestCustomers.year}年)</div>
                    {custConc !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        custConc > 60 ? "bg-red-100 text-red-700" :
                        custConc > 40 ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>集中度 {custConc.toFixed(2)}%</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {latestCustomers.items.slice(0, 5).map((item, i) => {
                      const ratioStr = String(item.ratio ?? "").replace(/%/g, "").trim();
                      const ratioNum = parseFloat(ratioStr);
                      const ratioPct = isNaN(ratioNum) ? 0 : ratioNum > 1 ? ratioNum : ratioNum * 100;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] text-gray-700 truncate max-w-[120px]">{item.name || "未知"}</span>
                              <span className="text-[10px] text-blue-600 flex-shrink-0 ml-1">{ratioPct > 0 ? `${ratioPct.toFixed(2)}%` : item.ratio || "--"}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1">
                              <div className="bg-blue-400 h-1 rounded-full" style={{ width: `${Math.min(ratioPct, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {custConc !== null && custConc > 60 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                      <AlertTriangle size={10} />前5大客户集中度超60%，单一客户流失风险高
                    </div>
                  )}
                </div>
              )}
              {/* 前5大供应商 */}
              {latestSuppliers && latestSuppliers.items && latestSuppliers.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-medium text-gray-600">前5大供应商 ({latestSuppliers.year}年)</div>
                    {suppConc !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        suppConc > 70 ? "bg-red-100 text-red-700" :
                        suppConc > 50 ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>集中度 {suppConc.toFixed(2)}%</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {latestSuppliers.items.slice(0, 5).map((item, i) => {
                      const ratioStr = String(item.ratio ?? "").replace(/%/g, "").trim();
                      const ratioNum = parseFloat(ratioStr);
                      const ratioPct = isNaN(ratioNum) ? 0 : ratioNum > 1 ? ratioNum : ratioNum * 100;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] text-gray-700 truncate max-w-[120px]">{item.name || "未知"}</span>
                              <span className="text-[10px] text-orange-600 flex-shrink-0 ml-1">{ratioPct > 0 ? `${ratioPct.toFixed(2)}%` : item.ratio || "--"}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1">
                              <div className="bg-orange-400 h-1 rounded-full" style={{ width: `${Math.min(ratioPct, 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {suppConc !== null && suppConc > 70 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                      <AlertTriangle size={10} />前5大供应商集中度超70%，供应链断供风险高
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* ── 营收构成分析 ── */}
      {appData.businessSegments && appData.businessSegments.length > 0 && (() => {
        const latestYear = appData.businessSegments
          .map(s => s.year)
          .filter(Boolean)
          .sort()
          .reverse()[0];
        const segments = appData.businessSegments.filter(s => !latestYear || s.year === latestYear);
        const totalRevenue = segments.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
        const mainBusiness = segments.filter(s => (s.revenueRatio ?? 0) >= 0.3 || (totalRevenue > 0 && (s.revenue ?? 0) / totalRevenue >= 0.3));
        const nonMainRatio = segments.filter(s => {
          const r = s.revenueRatio ?? (totalRevenue > 0 ? (s.revenue ?? 0) / totalRevenue : 0);
          return r < 0.1;
        }).reduce((sum, s) => {
          const r = s.revenueRatio ?? (totalRevenue > 0 ? (s.revenue ?? 0) / totalRevenue : 0);
          return sum + r;
        }, 0);
        const colors = ["bg-blue-400", "bg-orange-400", "bg-green-400", "bg-purple-400", "bg-pink-400", "bg-teal-400"];
        const textColors = ["text-blue-700", "text-orange-700", "text-green-700", "text-purple-700", "text-pink-700", "text-teal-700"];
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <BarChart3 size={12} className="text-green-500" />营收构成分析
              {latestYear && <span className="text-[10px] text-gray-400 font-normal">（{latestYear}年）</span>}
              <span className="text-[10px] text-gray-400 font-normal">· 收入质量评估</span>
            </div>
            {/* 横向进度条 */}
            <div className="flex w-full h-3 rounded-full overflow-hidden mb-3">
              {segments.slice(0, 6).map((s, i) => {
                const r = s.revenueRatio ?? (totalRevenue > 0 ? (s.revenue ?? 0) / totalRevenue : 0);
                const pct = r > 1 ? r : r * 100;
                return <div key={i} className={`${colors[i % colors.length]} h-full`} style={{ width: `${pct}%` }} title={s.segmentName ?? ""} />;
              })}
            </div>
            {/* 图例 */}
            <div className="space-y-1.5 mb-3">
              {segments.slice(0, 6).map((s, i) => {
                const r = s.revenueRatio ?? (totalRevenue > 0 ? (s.revenue ?? 0) / totalRevenue : 0);
                const pct = r > 1 ? r : r * 100;
                return (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                      <span className="text-gray-700 truncate max-w-[160px]">{s.segmentName || `业务${i + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.revenue != null && <span className="text-gray-400">{s.revenue.toFixed(0)}万</span>}
                      <span className={`font-medium ${textColors[i % textColors.length]}`}>{pct.toFixed(2)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 收入质量评估 */}
            <div className="space-y-1.5">
              {mainBusiness.length === 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={10} />无明显主营业务（占比&gt;30%），收入分散，主业不突出
                </div>
              )}
              {nonMainRatio > 0.3 && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                  <AlertTriangle size={10} />非主营业务占比 {(nonMainRatio * 100).toFixed(2)}%，收入质量偏低，需关注可持续性
                </div>
              )}
              {mainBusiness.length > 0 && nonMainRatio <= 0.3 && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-600 bg-green-50 rounded-lg px-2 py-1.5">
                  <CheckCircle2 size={10} />主营业务集中，收入结构清晰，质量较高
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* ── 信贷建议 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Info size={12} className="text-orange-500" />行业信贷建议
        </div>
        <div className="text-xs text-gray-600 leading-relaxed bg-orange-50 rounded-lg px-3 py-2.5 mb-3">
          {benchmark.creditAdvice}
        </div>
        <div className="text-[10px] text-gray-500 mb-1.5 font-medium">适合的贷款品种：</div>
        <div className="flex flex-wrap gap-1.5">
          {benchmark.typicalLoanTypes.map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-full border border-gray-200">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
// ─── 5. 交叉分析面板（九维度企业信贷风控分析体系）──────────────────────────────
// ─── 5. 交叉分析面板（九维度企业信贷风控分析体系）──────────────────────────────
export function CrossAnalysisPanel({ appData }: { appData: AppData }) {
  const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
  const sortedYears = Object.keys(fsByYear).sort((a, b) => Number(b) - Number(a));
  const latestYear = sortedYears[0];
  const prevYear = sortedYears[1];
  const bankFlow = appData.bankFlowSummary;
  const bankData = appData.bankData as Record<string, unknown> | undefined;
  const taxByYear = (appData.taxDataByYear ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  const taxByType = (appData.taxDataByType ?? {}) as Record<string, Record<string, unknown>>;
  const taxData = appData.taxData as Record<string, unknown> | undefined;

  function getTaxNum(data: Record<string, unknown> | undefined, ...keys: string[]): number | null {
    if (!data) return null;
    for (const k of keys) {
      const v = data[k];
      if (v !== null && v !== undefined && v !== "") {
        const n = parseNum(v as string | number, false);
        if (n !== null) return n;
      }
    }
    return null;
  }

  // ── 财报核心指标 ──
  const fsRevenue = latestYear ? getYearNum(fsByYear, latestYear, "revenue") : null;
  const fsPrevRevenue = prevYear ? getYearNum(fsByYear, prevYear, "revenue") : null;
  const fsNetProfit = latestYear ? getYearNum(fsByYear, latestYear, "netProfit") : null;
  const fsPrevNetProfit = prevYear ? getYearNum(fsByYear, prevYear, "netProfit") : null;
  const fsOcf = latestYear ? getYearNum(fsByYear, latestYear, "operatingCashFlow") : null;
  const fsTotalAssets = latestYear ? getYearNum(fsByYear, latestYear, "totalAssets") : null;
  const fsTotalLiabilities = latestYear ? getYearNum(fsByYear, latestYear, "totalLiabilities") : null;
  const fsCurrentAssets = latestYear ? getYearNum(fsByYear, latestYear, "currentAssets") : null;
  const fsCurrentLiabilities = latestYear ? getYearNum(fsByYear, latestYear, "currentLiabilities") : null;
  const fsInventory = latestYear ? getYearNum(fsByYear, latestYear, "inventory") : null;
  const fsReceivables = latestYear ? getYearNum(fsByYear, latestYear, "accountsReceivable") : null;
  const fsTotalEquity = latestYear ? getYearNum(fsByYear, latestYear, "totalEquity") : null;
  const fsGrossProfit = latestYear ? getYearNum(fsByYear, latestYear, "grossProfit") : null;
  const fsEbit = latestYear ? getYearNum(fsByYear, latestYear, "ebit") : null;
  const fsInterestExpense = latestYear ? getYearNum(fsByYear, latestYear, "interestExpense") : null;

  // ── 银行流水指标 ──
  const bankFlowFromDocs = (() => {
    const docs = appData.parsedDocuments;
    if (!docs) return null;
    const bankDoc = docs.find((d: {fileType?: string; parseType?: string; docId?: string; name?: string}) =>
      d.fileType === "bank_statement" || d.parseType === "bank_statement" ||
      (d.docId && String(d.docId).toLowerCase().includes("bank")) ||
      (d.name && /流水|对账单|bank/i.test(String(d.name)))
    );
    return bankDoc?.data as Record<string, unknown> | undefined;
  })();
  const effectiveBankData = bankData ?? bankFlowFromDocs;
  const bankTotalInflow = bankFlow?.totalInflow ?? (effectiveBankData?.totalInflow ? parseNum(effectiveBankData.totalInflow as string | number) : null);
  const bankMonthCount = bankFlow?.monthCount ?? (effectiveBankData?.statementMonths ? parseNum(effectiveBankData.statementMonths as string | number) : null);
  const bankAnnualInflow = (() => {
    if (bankTotalInflow === null) return null;
    const mc = bankMonthCount ?? 12;
    if (mc < 3) return bankTotalInflow;
    return bankTotalInflow / mc * 12;
  })();

  // ── 税务指标 ──
  const latestTaxYear = Object.keys(taxByYear).sort((a, b) => Number(b) - Number(a))[0];
  const vatData = latestTaxYear
    ? (taxByYear[latestTaxYear]?.vat ?? taxByType.vat ?? taxData)
    : (taxByType.vat ?? taxData);
  const citData = latestTaxYear
    ? (taxByYear[latestTaxYear]?.cit ?? taxByType.cit)
    : taxByType.cit;
  const taxRevenue = getTaxNum(vatData as Record<string, unknown>, "taxableRevenue", "salesAmount", "totalSales");
  const vatInputTax = getTaxNum(vatData as Record<string, unknown>, "inputTax", "inputVat", "deductibleInputTax");
  const vatOutputTax = getTaxNum(vatData as Record<string, unknown>, "outputTax", "outputVat", "salesTax");
  const taxCreditLevel = (taxByType.credit as Record<string, unknown>)?.creditLevel ?? (taxData as Record<string, unknown>)?.taxCreditLevel;
  void citData;

  // ── 客户/供应商集中度 ──
  const top5Customers = appData.top5Customers;
  const top5Suppliers = appData.top5Suppliers;
  const calcTop5Conc = (arr: typeof top5Customers) => {
    if (!arr || arr.length === 0) return null;
    const latest = [...arr].sort((a, b) => Number(b.year) - Number(a.year))[0];
    if (!latest?.items || latest.items.length === 0) return null;
    return latest.items.reduce((sum, i) => {
      const s = String(i.ratio ?? "").replace(/%/g, "").trim();
      const n = parseFloat(s);
      return sum + (isNaN(n) ? 0 : n > 1 ? n : n * 100);
    }, 0);
  };
  const custConc = calcTop5Conc(top5Customers);
  const suppConc = calcTop5Conc(top5Suppliers);

  // ── 九维度评分计算 ──
  interface DimItem {
    id: string;
    name: string;
    shortName: string;
    weight: number;
    score: number | null;
    status: "pass" | "warn" | "fail" | "nodata";
    color: string;
    indicators: Array<{ label: string; value: string; status: "pass" | "warn" | "fail" | "nodata" }>;
    conclusion: string;
  }

  const dims: DimItem[] = [
    // D1: 偿债能力（20%）
    (() => {
      const currentRatio = (fsCurrentAssets !== null && fsCurrentLiabilities !== null && fsCurrentLiabilities > 0)
        ? fsCurrentAssets / fsCurrentLiabilities : null;
      const debtRatio = (fsTotalLiabilities !== null && fsTotalAssets !== null && fsTotalAssets > 0)
        ? fsTotalLiabilities / fsTotalAssets * 100 : null;
      const debtToEquity = (fsTotalLiabilities !== null && fsTotalEquity !== null && fsTotalEquity > 0)
        ? fsTotalLiabilities / fsTotalEquity : null;
      const interestCoverage = (fsEbit !== null && fsInterestExpense !== null && fsInterestExpense > 0)
        ? fsEbit / fsInterestExpense : null;
      const scores: number[] = [];
      if (currentRatio !== null) scores.push(currentRatio >= 2 ? 100 : currentRatio >= 1.5 ? 80 : currentRatio >= 1 ? 60 : 30);
      if (debtRatio !== null) scores.push(debtRatio <= 40 ? 100 : debtRatio <= 60 ? 75 : debtRatio <= 80 ? 50 : 20);
      if (interestCoverage !== null) scores.push(interestCoverage >= 5 ? 100 : interestCoverage >= 3 ? 80 : interestCoverage >= 1.5 ? 60 : 20);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D1", name: "偿债能力", shortName: "偿债", weight: 20, score, color: "blue",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "流动比率", value: currentRatio !== null ? currentRatio.toFixed(2) : "--", status: currentRatio === null ? "nodata" as const : currentRatio >= 2 ? "pass" as const : currentRatio >= 1 ? "warn" as const : "fail" as const },
          { label: "资产负债率", value: debtRatio !== null ? `${debtRatio.toFixed(2)}%` : "--", status: debtRatio === null ? "nodata" as const : debtRatio <= 60 ? "pass" as const : debtRatio <= 80 ? "warn" as const : "fail" as const },
          { label: "利息保障倍数", value: interestCoverage !== null ? interestCoverage.toFixed(1) : "--", status: interestCoverage === null ? "nodata" as const : interestCoverage >= 3 ? "pass" as const : interestCoverage >= 1.5 ? "warn" as const : "fail" as const },
          { label: "产权比率", value: debtToEquity !== null ? debtToEquity.toFixed(2) : "--", status: debtToEquity === null ? "nodata" as const : debtToEquity <= 1 ? "pass" as const : debtToEquity <= 2 ? "warn" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少资产负债表数据" : score >= 80 ? "偿债能力强，短期和长期偿债风险低" : score >= 60 ? "偿债能力一般，需关注流动性和杠杆水平" : "偿债能力偏弱，存在较高违约风险",
      };
    })(),
    // D2: 盈利能力（15%）
    (() => {
      const grossMargin = (fsGrossProfit !== null && fsRevenue !== null && fsRevenue > 0)
        ? fsGrossProfit / fsRevenue * 100 : null;
      const netMargin = (fsNetProfit !== null && fsRevenue !== null && fsRevenue > 0)
        ? fsNetProfit / fsRevenue * 100 : null;
      const roa = (fsNetProfit !== null && fsTotalAssets !== null && fsTotalAssets > 0)
        ? fsNetProfit / fsTotalAssets * 100 : null;
      const roe = (fsNetProfit !== null && fsTotalEquity !== null && fsTotalEquity > 0)
        ? fsNetProfit / fsTotalEquity * 100 : null;
      const scores: number[] = [];
      if (netMargin !== null) scores.push(netMargin >= 10 ? 100 : netMargin >= 5 ? 80 : netMargin >= 2 ? 60 : netMargin >= 0 ? 40 : 10);
      if (roa !== null) scores.push(roa >= 8 ? 100 : roa >= 4 ? 80 : roa >= 1 ? 60 : roa >= 0 ? 40 : 10);
      if (roe !== null) scores.push(roe >= 15 ? 100 : roe >= 8 ? 80 : roe >= 3 ? 60 : roe >= 0 ? 40 : 10);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D2", name: "盈利能力", shortName: "盈利", weight: 15, score, color: "green",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "毛利率", value: grossMargin !== null ? `${grossMargin.toFixed(2)}%` : "--", status: grossMargin === null ? "nodata" as const : grossMargin >= 20 ? "pass" as const : grossMargin >= 10 ? "warn" as const : "fail" as const },
          { label: "净利率", value: netMargin !== null ? `${netMargin.toFixed(2)}%` : "--", status: netMargin === null ? "nodata" as const : netMargin >= 5 ? "pass" as const : netMargin >= 2 ? "warn" as const : "fail" as const },
          { label: "总资产收益率", value: roa !== null ? `${roa.toFixed(2)}%` : "--", status: roa === null ? "nodata" as const : roa >= 4 ? "pass" as const : roa >= 1 ? "warn" as const : "fail" as const },
          { label: "净资产收益率", value: roe !== null ? `${roe.toFixed(2)}%` : "--", status: roe === null ? "nodata" as const : roe >= 8 ? "pass" as const : roe >= 3 ? "warn" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少利润表数据" : score >= 80 ? "盈利能力强，利润质量高" : score >= 60 ? "盈利能力一般，需关注利润率趋势" : "盈利能力偏弱，存在持续亏损风险",
      };
    })(),
    // D3: 现金流质量（15%）
    (() => {
      const profitCashRatio = (fsNetProfit !== null && fsOcf !== null && fsNetProfit !== 0)
        ? fsOcf / fsNetProfit : null;
      const bankVsRevenue = (bankAnnualInflow !== null && fsRevenue !== null && fsRevenue > 0)
        ? Math.abs(bankAnnualInflow - fsRevenue) / fsRevenue * 100 : null;
      const taxVsRevenue = (taxRevenue !== null && fsRevenue !== null && fsRevenue > 0)
        ? Math.abs(taxRevenue - fsRevenue) / fsRevenue * 100 : null;
      const scores: number[] = [];
      if (profitCashRatio !== null) scores.push(profitCashRatio >= 0.8 && profitCashRatio <= 1.5 ? 100 : profitCashRatio >= 0.5 && profitCashRatio <= 2 ? 75 : profitCashRatio >= 0 ? 50 : 20);
      if (bankVsRevenue !== null) scores.push(bankVsRevenue < 5 ? 100 : bankVsRevenue < 15 ? 80 : bankVsRevenue < 30 ? 60 : 30);
      if (taxVsRevenue !== null) scores.push(taxVsRevenue < 5 ? 100 : taxVsRevenue < 15 ? 80 : taxVsRevenue < 30 ? 60 : 30);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D3", name: "现金流质量", shortName: "现金流", weight: 15, score, color: "cyan",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "利润现金含量", value: profitCashRatio !== null ? profitCashRatio.toFixed(2) : "--", status: profitCashRatio === null ? "nodata" as const : (profitCashRatio >= 0.8 && profitCashRatio <= 1.5) ? "pass" as const : profitCashRatio >= 0.5 ? "warn" as const : "fail" as const },
          { label: "流水vs财报收入差异", value: bankVsRevenue !== null ? `${bankVsRevenue.toFixed(2)}%` : "--", status: bankVsRevenue === null ? "nodata" as const : bankVsRevenue < 15 ? "pass" as const : bankVsRevenue < 30 ? "warn" as const : "fail" as const },
          { label: "税务vs财报收入差异", value: taxVsRevenue !== null ? `${taxVsRevenue.toFixed(2)}%` : "--", status: taxVsRevenue === null ? "nodata" as const : taxVsRevenue < 15 ? "pass" as const : taxVsRevenue < 30 ? "warn" as const : "fail" as const },
          { label: "经营现金流", value: fsOcf !== null ? fmtNum(fsOcf, 0) : "--", status: fsOcf === null ? "nodata" as const : fsOcf > 0 ? "pass" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少现金流或银行流水数据" : score >= 80 ? "三方数据高度一致，现金流质量优秀" : score >= 60 ? "存在轻微差异，现金流质量尚可" : "数据差异较大，现金流质量存疑",
      };
    })(),
    // D4: 经营效率（10%）
    (() => {
      const receivableTurnover = (fsRevenue !== null && fsReceivables !== null && fsReceivables > 0)
        ? fsRevenue / fsReceivables : null;
      const inventoryTurnover = (fsRevenue !== null && fsInventory !== null && fsInventory > 0)
        ? fsRevenue / fsInventory : null;
      const assetTurnover = (fsRevenue !== null && fsTotalAssets !== null && fsTotalAssets > 0)
        ? fsRevenue / fsTotalAssets : null;
      const scores: number[] = [];
      if (receivableTurnover !== null) scores.push(receivableTurnover >= 8 ? 100 : receivableTurnover >= 4 ? 80 : receivableTurnover >= 2 ? 60 : 40);
      if (inventoryTurnover !== null) scores.push(inventoryTurnover >= 6 ? 100 : inventoryTurnover >= 3 ? 80 : inventoryTurnover >= 1.5 ? 60 : 40);
      if (assetTurnover !== null) scores.push(assetTurnover >= 1 ? 100 : assetTurnover >= 0.5 ? 80 : assetTurnover >= 0.3 ? 60 : 40);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D4", name: "经营效率", shortName: "效率", weight: 10, score, color: "yellow",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "应收账款周转率", value: receivableTurnover !== null ? `${receivableTurnover.toFixed(1)}次` : "--", status: receivableTurnover === null ? "nodata" as const : receivableTurnover >= 4 ? "pass" as const : receivableTurnover >= 2 ? "warn" as const : "fail" as const },
          { label: "存货周转率", value: inventoryTurnover !== null ? `${inventoryTurnover.toFixed(1)}次` : "--", status: inventoryTurnover === null ? "nodata" as const : inventoryTurnover >= 3 ? "pass" as const : inventoryTurnover >= 1.5 ? "warn" as const : "fail" as const },
          { label: "总资产周转率", value: assetTurnover !== null ? `${assetTurnover.toFixed(2)}次` : "--", status: assetTurnover === null ? "nodata" as const : assetTurnover >= 0.5 ? "pass" as const : assetTurnover >= 0.3 ? "warn" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少资产负债表数据" : score >= 80 ? "资产运营效率高，资金周转良好" : score >= 60 ? "运营效率一般，应关注应收账款回收" : "运营效率偏低，存在资产沉淀风险",
      };
    })(),
    // D5: 成长能力（10%）
    (() => {
      const revenueGrowth = (fsRevenue !== null && fsPrevRevenue !== null && fsPrevRevenue > 0)
        ? (fsRevenue - fsPrevRevenue) / fsPrevRevenue * 100 : null;
      const profitGrowth = (fsNetProfit !== null && fsPrevNetProfit !== null && fsPrevNetProfit > 0)
        ? (fsNetProfit - fsPrevNetProfit) / fsPrevNetProfit * 100 : null;
      const scores: number[] = [];
      if (revenueGrowth !== null) scores.push(revenueGrowth >= 20 ? 100 : revenueGrowth >= 10 ? 85 : revenueGrowth >= 0 ? 65 : revenueGrowth >= -10 ? 45 : 20);
      if (profitGrowth !== null) scores.push(profitGrowth >= 20 ? 100 : profitGrowth >= 10 ? 85 : profitGrowth >= 0 ? 65 : profitGrowth >= -10 ? 45 : 20);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D5", name: "成长能力", shortName: "成长", weight: 10, score, color: "emerald",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "营收增长率", value: revenueGrowth !== null ? `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(2)}%` : "--", status: revenueGrowth === null ? "nodata" as const : revenueGrowth >= 10 ? "pass" as const : revenueGrowth >= 0 ? "warn" as const : "fail" as const },
          { label: "净利润增长率", value: profitGrowth !== null ? `${profitGrowth > 0 ? "+" : ""}${profitGrowth.toFixed(2)}%` : "--", status: profitGrowth === null ? "nodata" as const : profitGrowth >= 10 ? "pass" as const : profitGrowth >= 0 ? "warn" as const : "fail" as const },
          { label: "对比年份", value: prevYear && latestYear ? `${prevYear}→${latestYear}` : "--", status: "nodata" as const },
        ],
        conclusion: score === null ? "缺少多年度财报数据" : score >= 80 ? "成长势头良好，营收利润持续增长" : score >= 60 ? "成长较为平稳，增速有所放缓" : "成长能力不足，存在营收下滑风险",
      };
    })(),
    // D6: 关联风险（10%）
    (() => {
      const custScore = custConc !== null ? (custConc <= 30 ? 100 : custConc <= 50 ? 80 : custConc <= 70 ? 60 : 30) : null;
      const suppScore = suppConc !== null ? (suppConc <= 40 ? 100 : suppConc <= 60 ? 80 : suppConc <= 80 ? 60 : 30) : null;
      const scores: number[] = [];
      if (custScore !== null) scores.push(custScore);
      if (suppScore !== null) scores.push(suppScore);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D6", name: "关联风险", shortName: "关联", weight: 10, score, color: "purple",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "前5大客户集中度", value: custConc !== null ? `${custConc.toFixed(2)}%` : "--", status: custConc === null ? "nodata" as const : custConc <= 50 ? "pass" as const : custConc <= 70 ? "warn" as const : "fail" as const },
          { label: "前5大供应商集中度", value: suppConc !== null ? `${suppConc.toFixed(2)}%` : "--", status: suppConc === null ? "nodata" as const : suppConc <= 60 ? "pass" as const : suppConc <= 80 ? "warn" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少上下游集中度数据" : score >= 80 ? "客户和供应商分散，关联集中风险低" : score >= 60 ? "存在一定集中度，需关注核心客户/供应商变动" : "高度集中，单一关联方风险突出",
      };
    })(),
    // D7: 外部环境（8%）
    (() => {
      const industry = appData.industry || "";
      const highRiskIndustries = ["房地产", "建筑", "煤炭", "钢铁", "化工", "P2P", "小额贷款"];
      const medRiskIndustries = ["零售", "餐饮", "纺织", "印刷", "传统制造"];
      const isHighRisk = highRiskIndustries.some(i => industry.includes(i));
      const isMedRisk = medRiskIndustries.some(i => industry.includes(i));
      const score = !industry ? null : isHighRisk ? 40 : isMedRisk ? 65 : 85;
      return {
        id: "D7", name: "外部环境", shortName: "外部", weight: 8, score, color: "orange",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "所属行业", value: industry || "--", status: !industry ? "nodata" as const : isHighRisk ? "fail" as const : isMedRisk ? "warn" as const : "pass" as const },
          { label: "行业风险等级", value: !industry ? "--" : isHighRisk ? "高风险" : isMedRisk ? "中等风险" : "低风险", status: !industry ? "nodata" as const : isHighRisk ? "fail" as const : isMedRisk ? "warn" as const : "pass" as const },
        ],
        conclusion: score === null ? "缺少行业信息，无法评估外部环境风险" : isHighRisk ? "所属高风险行业，需严格把控授信条件" : isMedRisk ? "所属中等风险行业，需关注行业周期变化" : "所属低风险行业，外部环境较为稳定",
      };
    })(),
    // D8: 合规风险（7%）
    (() => {
      const hasEuqin = !!(taxByType.clearance ?? taxData);
      const creditLevelStr = taxCreditLevel ? String(taxCreditLevel).toUpperCase() : null;
      const vatInputOutputRatio = (vatInputTax !== null && vatOutputTax !== null && vatOutputTax > 0)
        ? vatInputTax / vatOutputTax : null;
      const scores: number[] = [];
      if (creditLevelStr) scores.push(["A", "A+", "AA"].includes(creditLevelStr) ? 100 : ["B"].includes(creditLevelStr) ? 75 : 40);
      if (hasEuqin) scores.push(80);
      if (vatInputOutputRatio !== null) scores.push(vatInputOutputRatio <= 0.85 ? 100 : vatInputOutputRatio <= 0.95 ? 70 : 40);
      const score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null;
      return {
        id: "D8", name: "合规风险", shortName: "合规", weight: 7, score, color: "teal",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "纳税信用等级", value: creditLevelStr ?? "--", status: !creditLevelStr ? "nodata" as const : ["A", "A+", "AA"].includes(creditLevelStr) ? "pass" as const : ["B"].includes(creditLevelStr) ? "warn" as const : "fail" as const },
          { label: "完税证明", value: hasEuqin ? "已上传" : "--", status: hasEuqin ? "pass" as const : "nodata" as const },
          { label: "进项/销项比", value: vatInputOutputRatio !== null ? `${(vatInputOutputRatio * 100).toFixed(2)}%` : "--", status: vatInputOutputRatio === null ? "nodata" as const : vatInputOutputRatio <= 0.85 ? "pass" as const : vatInputOutputRatio <= 0.95 ? "warn" as const : "fail" as const },
        ],
        conclusion: score === null ? "缺少税务合规数据" : score >= 80 ? "税务合规状况良好，无明显合规风险" : score >= 60 ? "存在一定合规风险，需关注税务异常" : "合规风险较高，需重点核查税务问题",
      };
    })(),
    // D9: 管理层风险（5%）
    (() => {
      const companyAge = (() => {
        const d = appData.establishDate || (appData.companyProfile as Record<string, unknown> | undefined)?.establishDate;
        if (!d) return null;
        const year = parseInt(String(d).slice(0, 4));
        if (isNaN(year)) return null;
        return new Date().getFullYear() - year;
      })();
      const hasProfile = !!(appData.companyProfile?.companyIntro || appData.companyName);
      const score = companyAge !== null ? (companyAge >= 10 ? 90 : companyAge >= 5 ? 75 : companyAge >= 3 ? 60 : 45) : hasProfile ? 65 : null;
      return {
        id: "D9", name: "管理层风险", shortName: "管理", weight: 5, score, color: "rose",
        status: score === null ? "nodata" as const : score >= 80 ? "pass" as const : score >= 60 ? "warn" as const : "fail" as const,
        indicators: [
          { label: "企业成立年限", value: companyAge !== null ? `${companyAge}年` : "--", status: companyAge === null ? "nodata" as const : companyAge >= 5 ? "pass" as const : companyAge >= 3 ? "warn" as const : "fail" as const },
          { label: "公司介绍完整度", value: hasProfile ? "已提供" : "未提供", status: hasProfile ? "pass" as const : "nodata" as const },
        ],
        conclusion: score === null ? "缺少企业基本信息" : companyAge !== null && companyAge >= 10 ? "经营历史悠久，管理层稳定性高" : companyAge !== null && companyAge >= 5 ? "经营历史较长，管理层相对稳定" : "经营历史较短，管理层稳定性有待观察",
      };
    })(),
  ];

  // ── 加权综合评分 ──
  const validDims = dims.filter(d => d.score !== null);
  const totalScore = validDims.length > 0
    ? Math.round(validDims.reduce((sum, d) => sum + d.score! * d.weight, 0) / validDims.reduce((sum, d) => sum + d.weight, 0))
    : null;
  const scoreLevel = totalScore === null
    ? { label: "数据不足", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" }
    : totalScore >= 85 ? { label: "综合风险低", color: "text-green-600", bg: "bg-green-50 border-green-200" }
    : totalScore >= 70 ? { label: "综合风险中等", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" }
    : totalScore >= 55 ? { label: "综合风险偏高", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" }
    : { label: "综合风险高", color: "text-red-600", bg: "bg-red-50 border-red-200" };

  const statusIcon = (status: string) =>
    status === "pass" ? <CheckCircle2 size={12} className="text-green-500" /> :
    status === "warn" ? <AlertTriangle size={12} className="text-amber-500" /> :
    status === "fail" ? <XCircle size={12} className="text-red-500" /> :
    <AlertCircle size={12} className="text-gray-300" />;

  const dimColorMap: Record<string, string> = {
    blue: "bg-blue-500", green: "bg-green-500", cyan: "bg-cyan-500",
    yellow: "bg-yellow-500", emerald: "bg-emerald-500", purple: "bg-purple-500",
    orange: "bg-orange-500", teal: "bg-teal-500", rose: "bg-rose-500",
  };
  const dimTextMap: Record<string, string> = {
    blue: "text-blue-600", green: "text-green-600", cyan: "text-cyan-600",
    yellow: "text-yellow-600", emerald: "text-emerald-600", purple: "text-purple-600",
    orange: "text-orange-600", teal: "text-teal-600", rose: "text-rose-600",
  };
  const dimBgMap: Record<string, string> = {
    blue: "bg-blue-50", green: "bg-green-50", cyan: "bg-cyan-50",
    yellow: "bg-yellow-50", emerald: "bg-emerald-50", purple: "bg-purple-50",
    orange: "bg-orange-50", teal: "bg-teal-50", rose: "bg-rose-50",
  };

  // 雷达图数据
  const radarData = dims.map(d => ({
    name: d.shortName,
    score: d.score ?? 0,
    fullMark: 100,
  }));

  const [expandedDim, setExpandedDim] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* ── 综合评分卡 ── */}
      <div className={`rounded-xl border p-4 ${scoreLevel.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 mb-1">九维度综合风险评分</div>
            <div className={`text-4xl font-bold ${scoreLevel.color}`}>
              {totalScore !== null ? totalScore : "--"}
              <span className="text-base font-normal text-gray-400">/100</span>
            </div>
            <div className={`text-sm font-semibold mt-1 ${scoreLevel.color}`}>{scoreLevel.label}</div>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-1">
            <div>已评估维度：{validDims.length}/9</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={10} />{dims.filter(d => d.status === "pass").length}</span>
              <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={10} />{dims.filter(d => d.status === "warn").length}</span>
              <span className="flex items-center gap-1 text-red-600"><XCircle size={10} />{dims.filter(d => d.status === "fail").length}</span>
              <span className="flex items-center gap-1 text-gray-400"><AlertCircle size={10} />{dims.filter(d => d.status === "nodata").length}</span>
            </div>
            <div className="text-[10px] text-gray-400">基于九维度企业信贷风控分析体系</div>
          </div>
        </div>
      </div>

      {/* ── 雷达图 ── */}
      {validDims.length >= 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Activity size={12} className="text-blue-500" />九维度风险雷达图
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Radar name="评分" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip formatter={(v: number) => [`${v}分`, "评分"]} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── 九维度评分概览 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Shield size={12} className="text-blue-500" />九维度评分概览
          <span className="text-[10px] text-gray-400 font-normal">（点击维度查看详细指标）</span>
        </div>
        <div className="space-y-2">
          {dims.map(dim => (
            <div key={dim.id}>
              <button
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                  dim.status === "pass" ? "bg-green-50/30 border-green-100 hover:bg-green-50/60" :
                  dim.status === "warn" ? "bg-amber-50/30 border-amber-100 hover:bg-amber-50/60" :
                  dim.status === "fail" ? "bg-red-50/30 border-red-100 hover:bg-red-50/60" :
                  "bg-gray-50 border-gray-100 hover:bg-gray-100"
                }`}
                onClick={() => setExpandedDim(expandedDim === dim.id ? null : dim.id)}
              >
                <div className="flex items-center gap-2">
                  {statusIcon(dim.status)}
                  <span className="text-xs font-semibold text-gray-700 flex-1">{dim.name}</span>
                  <span className="text-[10px] text-gray-400">权重 {dim.weight}%</span>
                  {dim.score !== null ? (
                    <span className={`text-xs font-bold ${dimTextMap[dim.color]}`}>{dim.score}分</span>
                  ) : (
                    <span className="text-[10px] text-gray-400">数据不足</span>
                  )}
                  <div className="w-16 bg-gray-100 rounded-full h-1.5 ml-1">
                    <div
                      className={`h-1.5 rounded-full ${dimColorMap[dim.color]}`}
                      style={{ width: `${dim.score ?? 0}%` }}
                    />
                  </div>
                </div>
              </button>
              {expandedDim === dim.id && (
                <div className={`mt-1 rounded-lg border px-3 py-3 ${dimBgMap[dim.color]}`}>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    {dim.indicators.map((ind, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        {statusIcon(ind.status)}
                        <span className="text-gray-500">{ind.label}：</span>
                        <span className={`font-medium ${
                          ind.status === "pass" ? "text-green-700" :
                          ind.status === "warn" ? "text-amber-700" :
                          ind.status === "fail" ? "text-red-700" :
                          "text-gray-400"
                        }`}>{ind.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`text-[11px] leading-relaxed ${
                    dim.status === "pass" ? "text-green-700" :
                    dim.status === "warn" ? "text-amber-700" :
                    dim.status === "fail" ? "text-red-700" :
                    "text-gray-500"
                  }`}>{dim.conclusion}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 风险结论 ── */}
      <div className={`rounded-xl border p-4 ${scoreLevel.bg}`}>
        <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Shield size={12} className="text-blue-500" />综合风险结论
        </div>
        <div className="text-xs text-gray-600 leading-relaxed mb-3">
          {totalScore === null
            ? "数据不足，无法进行完整的九维度风险分析。建议补充上传财务报表、银行流水和税务资料，以获得更准确的综合风险评估。"
            : totalScore >= 85
            ? "九维度综合评分优秀，企业财务状况健康，偿债能力强，现金流质量高，合规状况良好。建议按正常流程推进授信审批，可给予较高额度。"
            : totalScore >= 70
            ? "九维度综合评分良好，企业整体风险可控，存在个别维度需关注。建议在正常授信条件下推进，要求企业提供相关说明。"
            : totalScore >= 55
            ? "九维度综合评分偏低，存在多个风险维度需重点关注。建议收紧授信条件，增加抵押担保要求，并进行现场尽职调查。"
            : "九维度综合评分较低，企业存在较高信贷风险。建议暂停授信流程，进行深度尽职调查，必要时拒绝授信或大幅降低额度。"}
        </div>
        {dims.filter(d => d.status === "fail").length > 0 && (
          <div className="space-y-1.5 mb-2">
            <div className="text-[10px] font-medium text-red-600 mb-1">高风险维度：</div>
            {dims.filter(d => d.status === "fail").map(d => (
              <div key={d.id} className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 rounded-lg px-2 py-1.5">
                <XCircle size={10} className="flex-shrink-0 mt-0.5" />
                <span><strong>{d.name}</strong>（{d.score}分）：{d.conclusion}</span>
              </div>
            ))}
          </div>
        )}
        {dims.filter(d => d.status === "warn").length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-amber-600 mb-1">需关注维度：</div>
            {dims.filter(d => d.status === "warn").map(d => (
              <div key={d.id} className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
                <span><strong>{d.name}</strong>（{d.score}分）：{d.conclusion}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
