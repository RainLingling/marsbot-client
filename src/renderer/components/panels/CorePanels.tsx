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
import type { AnalysisResult, AppData, UploadedFile, PanelTab } from "./panelTypes";
import { PANEL_TABS } from "./panelTypes";
import { FeaturesPanel, RulesPanel, ScorecardPanel, LimitPanel } from "./AnalysisPanels";
import { NineDimensionPanel, CreditReportPanel } from "./ReportPanels";

function AnalysisEnginePanel({
  result,
  appData,
  expandedGroups,
  onToggleGroup,
}: {
  result: AnalysisResult | null;
  appData: AppData;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (g: string) => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>("features");
  const toggle = (s: string) => setOpenSection(prev => prev === s ? null : s);

  const sections = [
    { id: "features", label: "38特征向量", icon: <Activity size={14} className="text-blue-500" />, desc: "38个量化特征，覆盖主体资质、财务健康、偿债能力等维度" },
    { id: "rules", label: "规则引擎", icon: <Shield size={14} className="text-red-500" />, desc: "一票否决规则 + 风险预警规则" },
    { id: "scorecard", label: "评分卡明细", icon: <BarChart3 size={14} className="text-purple-500" />, desc: "1000分制信用评分，三维子分明细" },
    { id: "limit", label: "三法额度测算", icon: <DollarSign size={14} className="text-green-500" />, desc: "现金流法、偿债能力法、资产抵押法" },
  ];

  return (
    <div className="space-y-3">
      {/* 说明横幅 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Info size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-gray-500">分析引擎是系统内部计算过程，供技术审查使用。综合评估和信贷决策已整合最终结论，日常使用无需查看此模块。</span>
      </div>

      {sections.map(sec => (
        <div key={sec.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggle(sec.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
          >
            {sec.icon}
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-gray-800">{sec.label}</div>
              <div className="text-[11px] text-gray-400">{sec.desc}</div>
            </div>
            <span className="text-gray-400 text-sm">{openSection === sec.id ? "▾" : "▸"}</span>
          </button>
          {openSection === sec.id && (
            <div className="border-t border-gray-100 p-4">
              {sec.id === "features" && <FeaturesPanel result={result} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} />}
              {sec.id === "rules" && <RulesPanel result={result} />}
              {sec.id === "scorecard" && <ScorecardPanel result={result} />}
              {sec.id === "limit" && <LimitPanel result={result} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 综合评估面板（九维度 + 评分卡合并，一票否决置顶）────────────────────────────
function ComprehensivePanel({ appData, result }: { appData: AppData; result: AnalysisResult | null }) {
  const re = result?.layer3?.ruleEngine;
  const sc = result?.layer3?.scorecard;
  const vetoRules = re?.triggeredRules?.filter((r: any) => r.type === "veto") || [];
  const warningRules = re?.triggeredRules?.filter((r: any) => r.type === "warning") || [];

  return (
    <div className="space-y-4">
      {/* 一票否决项置顶 */}
      {vetoRules.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="text-sm font-bold text-red-700">一票否决项（{vetoRules.length} 项）— 建议拒绝</span>
          </div>
          <div className="space-y-2">
            {vetoRules.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-red-200">
                <span className="text-red-500 text-xs mt-0.5">✕</span>
                <div>
                  <div className="text-xs font-semibold text-red-700">{r.ruleName || r.name}</div>
                  <div className="text-[11px] text-red-500 mt-0.5">{r.detail || r.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 风险预警 */}
      {warningRules.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-700">风险预警（{warningRules.length} 项）</span>
          </div>
          <div className="space-y-1.5">
            {warningRules.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="text-amber-400 flex-shrink-0">⚠</span>
                <span>{r.ruleName || r.name}：{r.detail || r.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 综合评分卡 */}
      {sc && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-gray-400 mb-1">综合信用评分（1000分制）</div>
              <div className="text-4xl font-bold text-gray-900">{sc.score}</div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold px-4 py-2 rounded-xl border ${
                ["AAA","AA","A"].includes(sc.creditGrade) ? "text-green-700 bg-green-50 border-green-200" :
                ["BBB","BB"].includes(sc.creditGrade) ? "text-blue-700 bg-blue-50 border-blue-200" :
                "text-red-700 bg-red-50 border-red-200"
              }`}>{sc.creditGrade}</div>
              <div className="text-xs text-gray-400 mt-1">信用等级</div>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
            <div className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full" style={{ width: `${(sc.score / 1000) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>违约概率 PD：<strong className="text-red-500">{(sc.scorePD * 100).toFixed(2)}%</strong></span>
            <span className="text-gray-600">{sc.recommendation}</span>
          </div>
        </div>
      )}

      {/* 九维度分析 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <BarChart3 size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">九维度风险分析</span>
        </div>
        <div className="p-4">
          <NineDimensionPanel appData={appData} />
        </div>
      </div>

      {/* 无数据提示 */}
      {!result && !appData.companyName && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <Shield size={40} className="mb-4 opacity-20" />
          <div className="text-sm">尚未完成分析</div>
          <div className="text-xs mt-1">请先上传资料并触发 AI 分析</div>
        </div>
      )}
    </div>
  );
}

// ─── 信贷决策面板（决策摘要卡 + 三法额度 + 完整报告）─────────────────────────────
function CreditDecisionPanel({ appData, result }: { appData: AppData; result: AnalysisResult | null }) {
  const sc = result?.layer3?.scorecard;
  const lc = result?.layer3?.limitCalculation;
  const applicationId = (result as any)?.applicationId as number | undefined;
  const [reportTab, setReportTab] = React.useState<'ai-report' | 'limit' | 'summary'>('ai-report');
  const [aiReportContent, setAiReportContent] = React.useState<string | null>(null);
  const [aiReportLoading, setAiReportLoading] = React.useState(false);
  const [aiReportError, setAiReportError] = React.useState<string | null>(null);
  const generateCreditRiskReportMutation = (trpc.loan.generateCreditRiskReport as any).useMutation();
  // hasAutoTriggered ref 用于确保每次 result 变化只自动触发一次报告生成
  const hasAutoTriggered = React.useRef(false);

  const verdictConfig = result ? ({
    approved:  { label: "建议批准",    color: "text-green-700",  bg: "bg-green-50 border-green-300",  badge: "bg-green-600",  dot: "bg-green-500" },
    reduced:   { label: "建议降额通过", color: "text-amber-700", bg: "bg-amber-50 border-amber-300",  badge: "bg-amber-500",  dot: "bg-amber-500" },
    rejected:  { label: "建议拒绝",    color: "text-red-700",    bg: "bg-red-50 border-red-300",      badge: "bg-red-600",    dot: "bg-red-500" },
  } as Record<string, {label:string;color:string;bg:string;badge:string;dot:string}>)[result.verdict] : null;

  const handleGenerateAiReport = React.useCallback(async () => {
    if (!appData.companyName && !applicationId) return;
    setAiReportLoading(true);
    setAiReportError(null);
    try {
      // 构建 analysisData fallback，当 applicationId=0 时服务端直接使用
      // aiReport 包含财务数据（从 appData 读取），其余字段从 result 读取
      const analysisData = result ? {
        companyName: appData.companyName,
        creditCode: appData.creditCode,
        legalPerson: appData.legalPerson,
        registeredCapital: appData.registeredCapital,
        establishDate: appData.establishDate,
        address: appData.address,
        industry: appData.industry,
        loanType: appData.loanType,
        amount: appData.amount,
        period: appData.period,
        purpose: appData.purpose,
        // 构建 aiReport 结构，包含财务数据
        aiReport: {
          financialStatementsByYear: appData.financialStatementsByYear || {},
          bankStatements: appData.bankFlowSummary ? [appData.bankFlowSummary] : [],
          vatDeclarations: appData.taxDataByType?.vat ? [appData.taxDataByType.vat] : [],
          taxClearanceCerts: appData.taxDataByType?.clearance ? [appData.taxDataByType.clearance] : [],
          creditFacility: appData.creditFacilities?.[0],
          businessIntro: undefined,
          revenueBreakdown: undefined,
          layer3: result.layer3,
          report: {
            summary: (result as any).summary,
            hardRuleHits: result.layer3?.ruleEngine?.triggeredRules?.map((r: any) => r.ruleId) || [],
            riskFactors: [],
            positiveFactors: [],
          },
        },
        aiVerdict: result.verdict,
        aiScore: result.creditScore || result.layer3?.scorecard?.score,
        layer3: result.layer3,
        nineDimensionResult: (result as any).nineDimensionResult,
        ruleCheckResult: result.layer3?.ruleEngine ? {
          passed: result.layer3.ruleEngine.passed,
          failedRules: result.layer3.ruleEngine.triggeredRules || [],
          allResults: result.layer3.ruleEngine,
        } : undefined,
        featureVector: (result as any).rawFeatures,
        relatedParties: [],
      } : undefined;
      const res = await generateCreditRiskReportMutation.mutateAsync({
        applicationId: applicationId || 0,
        companyName: appData.companyName || '企业',
        analysisData,
      });
      if (res?.success && res?.report?.markdownReport) {
        setAiReportContent(res.report.markdownReport);
      } else if (res?.success) {
        // 报告生成成功但无 markdownReport（默认分支），提示用户先完成分析
        setAiReportError('请先完成 AI 分析，再生成完整报告');
      } else {
        setAiReportError('AI 报告生成失败，请稍后重试');
      }
    } catch (e: any) {
      setAiReportError(e?.message || 'AI 报告生成失败，请稍后重试');
    } finally {
      setAiReportLoading(false);
    }
  }, [applicationId, appData, result, generateCreditRiskReportMutation]);
  // 当分析结果 result 出现时，自动触发 AI 报告生成（只触发一次）
  React.useEffect(() => {
    if (result && !aiReportContent && !aiReportLoading && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      handleGenerateAiReport();
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) {
    // 即使没有 AI 分析结果，也显示已有的基础数据摘要
    const fsByYear = (appData.financialStatementsByYear ?? {}) as Record<string, Record<string, unknown>>;
    const yearKeys = Object.keys(fsByYear).sort((a, b) => b.localeCompare(a));
    const latestYear = yearKeys[0];
    const latestFs = latestYear ? fsByYear[latestYear] : null;
    const bankFlow = appData.bankFlowSummary || appData.bankData;
    const taxData = appData.taxDataByType;
    // 与 getYearNum 相同的查找逻辑：合并所有子表字段，支持多别名
    const KEY_ALIASES_CREDIT: Record<string, string[]> = {
      revenue: ["revenue", "operatingRevenue", "totalRevenue", "is_001", "mainRevenue"],
      netProfit: ["netProfit", "is_020", "netProfitAttr", "netProfitLoss"],
      totalAssets: ["totalAssets", "bs_037", "totalAsset"],
      totalLiabilities: ["totalLiabilities", "bs_028", "totalLiability"],
      totalEquity: ["totalEquity", "bs_036", "ownerEquity", "shareholdersEquity"],
      operatingCashFlow: ["operatingCashFlow", "cf_001", "netCashFromOperating"],
      currentAssets: ["currentAssets", "bs_014", "totalCurrentAssets"],
      currentLiabilities: ["currentLiabilities", "bs_024", "totalCurrentLiabilities"],
    };
    // 检查最新年度 sourceUnit，后端已换算为万元时跳过前端兆底换算
    const latestFsData = latestYear ? fsByYear[latestYear] : null;
    const latestSourceUnit = (latestFsData as any)?.sourceUnit as string | undefined;
    const skipAutoConvertCredit = !!latestSourceUnit && latestSourceUnit !== '元';
    const parseNumCredit = (v: unknown, skipConvert = skipAutoConvertCredit): number | null => {
      if (v == null || v === '') return null;
      const n = parseFloat(String(v).replace(/,/g, ''));
      if (isNaN(n)) return null;
      // 单位换算：超过500万认为是"元"单位，换算为万元（后端已换算时跳过）
      if (!skipConvert && Math.abs(n) > 5000000) return parseFloat((n / 10000).toFixed(2));
      return n;
    };
    const num = (fsObj: Record<string, unknown> | null | undefined, ...keys: string[]): number | null => {
      if (!fsObj) return null;
      // 合并所有子表字段到一个扁平对象
      const src: Record<string, unknown> = {
        ...(fsObj as any),
        ...((fsObj.balanceSheet as Record<string, unknown>) ?? {}),
        ...((fsObj.incomeStatement as Record<string, unknown>) ?? {}),
        ...((fsObj.cashFlowStatement as Record<string, unknown>) ?? {}),
      };
      for (const k of keys) {
        const aliases = KEY_ALIASES_CREDIT[k] ?? [k];
        for (const alias of aliases) {
          const v = src[alias];
          if (v !== null && v !== undefined && v !== '') {
            const n = parseNumCredit(v);
            if (n !== null) return n;
          }
        }
      }
      return null;
    };
    const hasAnyData = yearKeys.length > 0 || !!bankFlow || !!(taxData?.vat) || !!(appData.taxData);
    if (!hasAnyData) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <FileText size={40} className="mb-4 opacity-20" />
          <div className="text-sm">尚未生成信贷决策</div>
          <div className="text-xs mt-1">请先上传财务材料，完成 AI 分析后系统将自动生成决策摘要</div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {/* 提示横幅 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-blue-700">已上传数据摘要如下。请在对话框中发送"开始分析"以生成完整信贷决策报告。</span>
        </div>
        {/* 财务数据摘要 */}
        {yearKeys.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-orange-50">
              <BarChart3 size={13} className="text-orange-500" />
              <span className="text-xs font-semibold text-gray-700">财务数据（{yearKeys.length}个年度）</span>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {yearKeys.slice(0, 3).map(yr => {
                const fs = fsByYear[yr];
                const revenue = num(fs as Record<string, unknown>, 'revenue');
                const netProfit = num(fs as Record<string, unknown>, 'netProfit');
                const totalAssets = num(fs as Record<string, unknown>, 'totalAssets');
                return (
                  <div key={yr} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <div className="font-semibold text-gray-700 mb-1">{yr}年{(fs as any)?.reportPeriod && (fs as any).reportPeriod !== yr ? `（${(fs as any).reportPeriod}）` : ''}</div>
                    {revenue != null && <div className="text-gray-500">营收：<span className="text-gray-800 font-medium">{revenue.toFixed(0)}万</span></div>}
                    {netProfit != null && <div className="text-gray-500">净利：<span className={`font-medium ${netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{netProfit.toFixed(0)}万</span></div>}
                    {totalAssets != null && <div className="text-gray-500">总资产：<span className="text-gray-800 font-medium">{totalAssets.toFixed(0)}万</span></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* 银行流水摘要 */}
        {bankFlow && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-green-50">
              <Activity size={13} className="text-green-500" />
              <span className="text-xs font-semibold text-gray-700">银行流水摘要</span>
              {(bankFlow as any).statementPeriod && <span className="text-xs text-gray-400 ml-1">· {(bankFlow as any).statementPeriod}</span>}
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {(bankFlow as any).totalInflow != null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-gray-400 mb-0.5">总流入</div>
                  <div className="font-semibold text-gray-800">{parseFloat(String((bankFlow as any).totalInflow)).toFixed(0)} 万元</div>
                </div>
              )}
              {(bankFlow as any).totalOutflow != null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-gray-400 mb-0.5">总流出</div>
                  <div className="font-semibold text-gray-800">{parseFloat(String((bankFlow as any).totalOutflow)).toFixed(0)} 万元</div>
                </div>
              )}
              {(bankFlow as any).monthlyAvgIncome != null && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-gray-400 mb-0.5">月均流入</div>
                  <div className="font-semibold text-gray-800">{parseFloat(String((bankFlow as any).monthlyAvgIncome)).toFixed(0)} 万元</div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* 税务数据摘要 */}
        {(taxData?.vat || taxData?.income) && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-yellow-50">
              <Shield size={13} className="text-yellow-500" />
              <span className="text-xs font-semibold text-gray-700">税务数据</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 text-xs">
              {taxData.vat && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500 mb-0.5">增值税申报</div>
                  <div className="font-medium text-gray-800">
                    {(taxData.vat as any).salesRevenue != null ? `销售额：${parseFloat(String((taxData.vat as any).salesRevenue)).toFixed(0)}万` : '已上传'}
                  </div>
                </div>
              )}
              {taxData.income && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-gray-500 mb-0.5">企业所得税</div>
                  <div className="font-medium text-gray-800">
                    {(taxData.income as any).totalIncome != null ? `收入：${parseFloat(String((taxData.income as any).totalIncome)).toFixed(0)}万` : '已上传'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 决策摘要卡 */}
      {verdictConfig && (
        <div className={`rounded-xl border-2 p-4 ${verdictConfig.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${verdictConfig.dot}`} />
              <span className={`text-base font-bold ${verdictConfig.color}`}>{verdictConfig.label}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {sc && <span>信用等级：<strong className="text-gray-800">{sc.creditGrade}</strong></span>}
              {sc && <span>评分：<strong className="text-gray-800">{sc.score}/1000</strong></span>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <div className="text-gray-400 mb-0.5">建议授信额度</div>
              <div className="text-base font-bold text-gray-800">
                {lc?.recommendedLimit != null ? `${Math.max(0, lc.recommendedLimit)} 万元` : "—"}
              </div>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <div className="text-gray-400 mb-0.5">申请金额</div>
              <div className="text-base font-bold text-gray-800">
                {appData.amount ? `${appData.amount} 万元` : "—"}
              </div>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <div className="text-gray-400 mb-0.5">贷款类型</div>
              <div className="text-base font-bold text-gray-800">{appData.loanType || "—"}</div>
            </div>
          </div>
          {sc?.recommendation && (
            <div className="mt-3 text-xs text-gray-600 bg-white/50 rounded-lg px-3 py-2 leading-relaxed">
              {sc.recommendation}
            </div>
          )}
        </div>
      )}

      {/* 报告 Tab 切换 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'ai-report' as const, label: 'AI 信贷报告', icon: '🤖' },
            { key: 'limit' as const, label: '三法额度测算', icon: '💰' },
            { key: 'summary' as const, label: '结构化报告', icon: '📋' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setReportTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                reportTab === tab.key
                  ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* AI 信贷报告 */}
          {reportTab === 'ai-report' && (
            <div>
              {!aiReportContent && !aiReportLoading && !aiReportError && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">🤖</div>
                  <div className="text-sm font-medium text-gray-600 mb-1">AI 叙述性信贷分析报告</div>
                  <div className="text-xs text-gray-400 mb-4 text-center max-w-xs">
                    基于所有上传文件和分析结果，生成专业的信贷风险分析报告（格式参考银行风控报告标准）
                  </div>
                  <button
                    onClick={handleGenerateAiReport}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    <Sparkles size={14} />
                    生成 AI 信贷报告
                  </button>
                </div>
              )}
              {aiReportLoading && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Loader2 size={24} className="animate-spin mb-3 text-orange-500" />
                  <div className="text-sm">AI 正在生成信贷分析报告…</div>
                  <div className="text-xs mt-1 text-gray-400">通常需要 30-60 秒，请耐心等待</div>
                </div>
              )}
              {aiReportError && (
                <div className="flex flex-col items-center justify-center py-6 text-red-400">
                  <div className="text-sm mb-2">{aiReportError}</div>
                  <button onClick={handleGenerateAiReport} className="text-xs text-orange-500 hover:underline">重试</button>
                </div>
              )}
              {aiReportContent && (
                <div className="prose prose-sm max-w-none">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={handleGenerateAiReport}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      <RefreshCw size={11} />
                      重新生成
                    </button>
                  </div>
                  <Streamdown>{aiReportContent}</Streamdown>
                </div>
              )}
            </div>
          )}

          {/* 三法额度测算 */}
          {reportTab === 'limit' && <LimitPanel result={result} />}

          {/* 结构化报告 */}
          {reportTab === 'summary' && <CreditReportPanel appData={appData} result={result} />}
        </div>
      </div>
    </div>
  );
}
// ─── 多源数据面板（原数据查询更名，整合三源交叉验证）──────────────────────────────
function MultiSourcePanel({ appData, analysisResult, uploadedFiles }: { appData: AppData; analysisResult: AnalysisResult | null; uploadedFiles?: UploadedFile[] }) {
  const [activeSection, setActiveSection] = React.useState<'business' | 'judicial' | 'financial' | 'bank' | 'tax' | 'credit' | 'customers' | 'revenue' | 'cross'>('business');

  // 工商数据（来自本体库 appData）
  const bizData = {
    companyName: appData.companyName || '—',
    creditCode: appData.creditCode || '—',
    legalPerson: appData.legalPerson || '—',
    registeredCapital: appData.registeredCapital || '—',
    establishDate: appData.establishDate || '—',
    industry: appData.industry || '—',
    address: appData.address || '—',
    companyType: appData.companyType || '—',
    operatingStatus: appData.operatingStatus || '正常',
    dataSource: appData.companyDataSource === 'business_license' ? '营业执照PDF解析' :
                appData.companyDataSource === 'ai_generated' ? '工商信息搜索（AI）' :
                appData.companyDataSource === 'user_input' ? '用户手动输入' : '未知来源',
  };

  // 司法/舆情数据（来自 analysisResult.layer2 AI推断）
  const layer2 = (analysisResult as any)?.layer2;
  const litigationRisk = layer2?.litigationRisk || layer2?.judicialRisk;
  const sentimentRisk = layer2?.sentimentRisk || layer2?.publicOpinionRisk;
  const F35 = (analysisResult as any)?.rawFeatures?.F35_litigationRiskScore;

  // 财务报表数据（来自本体库 appData.financialStatementsByYear）
  const fsYears = Object.keys(appData.financialStatementsByYear || {}).sort().reverse();

  // 三源交叉验证
  const cv = (analysisResult as any)?.layer2?.crossValidation;

  const sections = [
    { key: 'business' as const, label: '工商信息', icon: '🏢', badge: bizData.companyName !== '—' ? '已接入' : '待录入' },
    { key: 'judicial' as const, label: '司法/舆情', icon: '⚖️', badge: F35 != null ? 'AI推断' : '未接入' },
    { key: 'financial' as const, label: '财报数据', icon: '📊', badge: fsYears.length > 0 ? `${fsYears.length}期` : '未上传' },
    { key: 'bank' as const, label: '银行流水', icon: '🏦', badge: (appData.bankFlowSummary || appData.bankData) ? '已解析' : '未上传' },
    { key: 'tax' as const, label: '税务数据', icon: '🧾', badge: (appData.taxData || appData.taxDataByType) ? '已解析' : '未上传' },
    { key: 'credit' as const, label: '他行授信', icon: '💳', badge: appData.creditFacilities && appData.creditFacilities.length > 0 ? `${appData.creditFacilities.length}条` : '未上传' },
    { key: 'customers' as const, label: '客户/供应商', icon: '🤝', badge: (appData.top5Customers?.length || appData.top5Suppliers?.length) ? '已录入' : '未录入' },
    { key: 'revenue' as const, label: '营收构成', icon: '📈', badge: appData.businessSegments && appData.businessSegments.length > 0 ? `${appData.businessSegments.length}项` : '未上传' },
    { key: 'cross' as const, label: '三源交叉', icon: '🔗', badge: cv ? '已验证' : '待分析' },
  ];

  return (
    <div className="space-y-3">
      {/* 数据来源说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 flex items-start gap-2">
        <span className="mt-0.5">ℹ️</span>
        <span>多源数据均来自<strong>本体库（appData）</strong>，由文件解析和工商搜索自动填充。司法/舆情数据为AI推断，外部数据库接口待接入。</span>
      </div>

      {/* 分类导航 */}
      <div className="flex gap-1.5 flex-wrap">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeSection === s.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{s.badge}</span>
          </button>
        ))}
      </div>

      {/* 工商信息 */}
      {activeSection === 'business' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">🏢 工商基本信息</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">来源：{bizData.dataSource}</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: '企业名称', value: bizData.companyName },
              { label: '统一社会信用代码', value: bizData.creditCode },
              { label: '法定代表人', value: bizData.legalPerson },
              { label: '注册资本', value: bizData.registeredCapital },
              { label: '成立日期', value: bizData.establishDate },
              { label: '所属行业', value: bizData.industry },
              { label: '企业类型', value: bizData.companyType },
              { label: '经营状态', value: bizData.operatingStatus },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                <div className="text-xs font-medium text-gray-800 truncate">{item.value}</div>
              </div>
            ))}
            <div className="col-span-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400 mb-0.5">注册地址</div>
              <div className="text-xs font-medium text-gray-800">{bizData.address}</div>
            </div>
          </div>
          {/* 工商异常/变更记录 */}
          <div className="px-4 pb-4">
            <div className="text-[11px] font-medium text-gray-500 mb-2">工商异常 / 变更记录</div>
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 text-center">
              外部工商数据库未接入，暂无异常/变更记录
            </div>
          </div>
        </div>
      )}

      {/* 司法/舆情 */}
      {activeSection === 'judicial' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">⚖️ 司法风险</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">来源：AI推断（外部司法数据库未接入）</span>
            </div>
            <div className="p-4">
              {F35 != null ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className={`rounded-xl p-3 text-center ${F35 >= 70 ? 'bg-green-50' : F35 >= 40 ? 'bg-amber-50' : 'bg-red-50'}`}>
                    <div className={`text-2xl font-bold ${F35 >= 70 ? 'text-green-600' : F35 >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{F35.toFixed(0)}</div>
                    <div className="text-[11px] text-gray-500 mt-1">诉讼风险评分（F35）</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-gray-400">—</div>
                    <div className="text-[11px] text-gray-500 mt-1">被执行记录</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-gray-400">—</div>
                    <div className="text-[11px] text-gray-500 mt-1">失信被执行</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">
                  司法风险评分需完成AI分析后生成<br/>
                  <span className="text-[10px]">外部司法数据库（法院/执行）接口待接入</span>
                </div>
              )}
              {litigationRisk && (
                <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                  <strong>AI推断：</strong>{typeof litigationRisk === 'string' ? litigationRisk : JSON.stringify(litigationRisk)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">📰 舆情风险</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">来源：AI推断（舆情监控未接入）</span>
            </div>
            <div className="p-4">
              {sentimentRisk ? (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                  <strong>AI推断：</strong>{typeof sentimentRisk === 'string' ? sentimentRisk : JSON.stringify(sentimentRisk)}
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">
                  舆情监控系统未接入<br/>
                  <span className="text-[10px]">可接入：天眼查/企查查舆情API、百度新闻监控</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 财报数据 */}
      {activeSection === 'financial' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">📊 财务报表数据</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">来源：财务报表PDF解析（本体库）</span>
          </div>
          <div className="p-4">
            {fsYears.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">
                未上传财务报表，暂无数据<br/>
                <span className="text-[10px]">请在资料清单中上传财务报表</span>
              </div>
            ) : (
              <div className="space-y-3">
                {fsYears.map(year => {
                  const fs = appData.financialStatementsByYear![year];
                  const period = (fs as any).reportPeriod || year;
                  const periodType = (fs as any).periodType;
                  const periodLabel = periodType === 'monthly' ? `${period}（月报）` :
                                      periodType === 'quarterly' ? `${period}（季报）` :
                                      periodType === 'interim' ? `${period}（半年报）` :
                                      `${period}（年报）`;
                  return (
                    <div key={year} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 flex items-center justify-between">
                        <span>📅 {periodLabel}</span>
                        <span className="text-[10px] text-gray-400">{(fs as any).fileName || '财务报表'}</span>
                      </div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(() => {
                          // 修复：从三张表子对象中提取数据，而非顶层字段
                          const bs = (fs as any).balanceSheet || {};
                          const is_ = (fs as any).incomeStatement || {};
                          const cf = (fs as any).cashFlowStatement || {};
                          const getVal = (obj: any, ...keys: string[]) => { for (const k of keys) { if (obj[k] != null && obj[k] !== '') return obj[k]; } return null; };
                          const items = [
                            { label: '营业收入', value: getVal(is_, 'revenue', 'operatingRevenue', 'totalRevenue') || getVal(fs as any, 'revenue', 'operatingRevenue') },
                            { label: '净利润', value: getVal(is_, 'netProfit', 'netIncome') || getVal(fs as any, 'netProfit') },
                            { label: '总资产', value: getVal(bs, 'totalAssets') || getVal(fs as any, 'totalAssets') },
                            { label: '总负债', value: getVal(bs, 'totalLiabilities') || getVal(fs as any, 'totalLiabilities') },
                            { label: '净资产', value: getVal(bs, 'netAssets', 'totalEquity', 'shareholdersEquity') || getVal(fs as any, 'totalEquity') },
                            { label: '流动资产', value: getVal(bs, 'currentAssets', 'totalCurrentAssets') || getVal(fs as any, 'currentAssets') },
                          ];
                          return items.map(item => (
                            <div key={item.label} className="text-center">
                              <div className="text-[10px] text-gray-400">{item.label}</div>
                              <div className="text-xs font-semibold text-gray-800">
                                {item.value != null ? `${Number(item.value).toLocaleString()} 万` : '—'}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 银行流水 */}
      {activeSection === 'bank' && (
        <div className="bg-white rounded-xl border border-cyan-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-cyan-100 bg-cyan-50">
            <span className="text-sm font-semibold text-gray-700">🏦 银行流水数据</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">来源：银行流水解析</span>
          </div>
          <div className="p-4">
            {(appData.bankFlowSummary || appData.bankData) ? (() => {
              const bf = appData.bankFlowSummary;
              const bd = appData.bankData as Record<string, unknown> | undefined;
              const totalInflow = bf?.totalInflow ?? (bd?.totalInflow != null ? Number(bd.totalInflow) : undefined);
              const totalOutflow = bf?.totalOutflow ?? (bd?.totalOutflow != null ? Number(bd.totalOutflow) : undefined);
              const netCashFlow = bf?.netCashFlow ?? (totalInflow != null && totalOutflow != null ? totalInflow - totalOutflow : undefined);
              const monthlyAvg = bd?.monthlyAvgIncome != null ? Number(bd.monthlyAvgIncome) : (totalInflow != null && bf?.monthlyData && bf.monthlyData.length > 0 ? totalInflow / bf.monthlyData.length : undefined);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: '总流入（万元）', value: totalInflow != null ? totalInflow.toLocaleString() : null, color: 'text-green-600' },
                      { label: '总流出（万元）', value: totalOutflow != null ? totalOutflow.toLocaleString() : null, color: 'text-red-500' },
                      { label: '净现金流（万元）', value: netCashFlow != null ? netCashFlow.toLocaleString() : null, color: netCashFlow != null && netCashFlow >= 0 ? 'text-green-600' : 'text-red-500' },
                      { label: '月均流入（万元）', value: monthlyAvg != null ? monthlyAvg.toFixed(2) : null, color: 'text-blue-600' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                        <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                        <div className={`text-lg font-bold ${item.value ? item.color : 'text-gray-300'}`}>{item.value ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                  {bf?.monthlyData && bf.monthlyData.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-2">月度流水明细</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-3 py-2 text-left text-gray-500 font-medium">月份</th>
                              <th className="px-3 py-2 text-right text-gray-500 font-medium">流入（万）</th>
                              <th className="px-3 py-2 text-right text-gray-500 font-medium">流出（万）</th>
                              <th className="px-3 py-2 text-right text-gray-500 font-medium">余额（万）</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bf.monthlyData.map((m, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{m.month ?? '—'}</td>
                                <td className="px-3 py-2 text-right text-green-600">{m.inflow != null ? m.inflow.toLocaleString() : '—'}</td>
                                <td className="px-3 py-2 text-right text-red-500">{m.outflow != null ? m.outflow.toLocaleString() : '—'}</td>
                                <td className="px-3 py-2 text-right text-gray-700">{m.balance != null ? m.balance.toLocaleString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* TOP5 交易对手集中度 */}
                  {bf?.top5Counterparties && bf.top5Counterparties.length > 0 && (() => {
                    const totalIn = bf.totalInflow ?? 1;
                    const totalOut = bf.totalOutflow ?? 1;
                    // 兼容 direction('in'|'out') 和 type('inflow'|'outflow') 两种字段格式
                    const getDir = (c: any): 'in' | 'out' => {
                      if (c.direction === 'in' || c.type === 'inflow') return 'in';
                      if (c.direction === 'out' || c.type === 'outflow') return 'out';
                      return 'out';
                    };
                    // amount 单位处理：Excel路径已换算为万元（<500万），LLM路径是元（>500万需换算）
                    const getAmtWan = (c: any): number => {
                      const raw = Math.abs(c.amount ?? 0);
                      return raw > 5000000 ? raw / 10000 : raw;
                    };
                    const inList = bf.top5Counterparties!.filter((c: any) => getDir(c) === 'in');
                    const outList = bf.top5Counterparties!.filter((c: any) => getDir(c) === 'out');
                    const top5InAmount = inList.reduce((s: number, c: any) => s + getAmtWan(c), 0);
                    const top5OutAmount = outList.reduce((s: number, c: any) => s + getAmtWan(c), 0);
                    const inConc = totalIn > 0 ? (top5InAmount / totalIn * 100) : null;
                    const outConc = totalOut > 0 ? (top5OutAmount / totalOut * 100) : null;
                    return (
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-2">交易对手集中度分析</div>
                        {inConc != null && (
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 w-28 shrink-0">流入TOP5集中度</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(inConc, 100)}%` }} />
                            </div>
                            <span className={`text-[10px] font-semibold w-12 text-right ${inConc > 80 ? 'text-red-600' : inConc > 60 ? 'text-yellow-600' : 'text-green-600'}`}>{inConc.toFixed(1)}%</span>
                          </div>
                        )}
                        {outConc != null && (
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 w-28 shrink-0">流出TOP5集中度</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-red-400 h-2 rounded-full" style={{ width: `${Math.min(outConc, 100)}%` }} />
                            </div>
                            <span className={`text-[10px] font-semibold w-12 text-right ${outConc > 80 ? 'text-red-600' : outConc > 60 ? 'text-yellow-600' : 'text-green-600'}`}>{outConc.toFixed(1)}%</span>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-3 py-2 text-left text-gray-500 font-medium">交易对手</th>
                                <th className="px-3 py-2 text-right text-gray-500 font-medium">方向</th>
                                <th className="px-3 py-2 text-right text-gray-500 font-medium">金额（万元）</th>
                                <th className="px-3 py-2 text-right text-gray-500 font-medium">笔数</th>
                                <th className="px-3 py-2 text-right text-gray-500 font-medium">占比</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {bf.top5Counterparties!.map((c: any, i: number) => {
                                const amtWan = getAmtWan(c);
                                const dir = getDir(c);
                                const base = dir === 'in' ? totalIn : totalOut;
                                const pct = base > 0 ? (amtWan / base * 100) : null;
                                return (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{c.name}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dir === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                        {dir === 'in' ? '流入' : '流出'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">{amtWan.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-3 py-2 text-right text-gray-500">{c.count}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className={`text-[10px] font-semibold ${pct != null && pct > 30 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {pct != null ? pct.toFixed(1) + '%' : '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })() : (
              <div className="text-xs text-gray-400 text-center py-8">
                <div className="text-2xl mb-2">🏦</div>
                <div>银行流水尚未上传或解析</div>
                <div className="text-[10px] mt-1">请在资料清单中上传银行流水文件</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 税务数据 */}
      {activeSection === 'tax' && (
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-yellow-100 bg-yellow-50">
            <span className="text-sm font-semibold text-gray-700">🧾 税务数据</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">来源：纳税证明/申报表解析</span>
          </div>
          <div className="p-4">
            {(appData.taxData || appData.taxDataByType) ? (() => {
              const td = appData.taxDataByType || {};
              const legacy = appData.taxData as Record<string, unknown> | undefined;
              const vatData = (td.vat || (legacy && (legacy as any).taxType === 'vat' ? legacy : null)) as Record<string, unknown> | undefined;
              const incomeData = (td.income || (legacy && (legacy as any).taxType === 'income' ? legacy : null)) as Record<string, unknown> | undefined;
              const clearanceData = (td.clearance || (legacy && (legacy as any).taxType === 'clearance' ? legacy : null)) as Record<string, unknown> | undefined;
              const creditData = (td.credit || (legacy && (legacy as any).taxType === 'credit' ? legacy : null)) as Record<string, unknown> | undefined;
              const generalData = legacy && !(legacy as any).taxType ? legacy : null;
              const sections2: Array<{ title: string; color: string; fields: Array<{ label: string; val: string }> }> = [];
              if (vatData || generalData) {
                const src = (vatData || generalData)!;
                sections2.push({ title: '增值税申报', color: 'bg-orange-50 border-orange-200', fields: [
                  { label: '申报年度', val: String((src as any).taxYear || (src as any).year || '—') },
                  { label: '应税收入（万元）', val: String((src as any).taxableRevenue ?? (src as any).revenue ?? '—') },
                  { label: '应纳税额（万元）', val: String((src as any).taxPayable ?? (src as any).vatPayable ?? '—') },
                  { label: '实缴税额（万元）', val: String((src as any).taxPaid ?? (src as any).vatPaid ?? '—') },
                  { label: '税率', val: (src as any).taxRate ? `${(src as any).taxRate}%` : '—' },
                ]});
              }
              if (incomeData) {
                sections2.push({ title: '企业所得税', color: 'bg-blue-50 border-blue-200', fields: [
                  { label: '申报年度', val: String((incomeData as any).taxYear || (incomeData as any).year || '—') },
                  { label: '应纳税所得额（万元）', val: String((incomeData as any).taxableIncome ?? '—') },
                  { label: '应纳税额（万元）', val: String((incomeData as any).taxPayable ?? '—') },
                  { label: '实缴税额（万元）', val: String((incomeData as any).taxPaid ?? '—') },
                ]});
              }
              if (clearanceData) {
                sections2.push({ title: '完税证明', color: 'bg-green-50 border-green-200', fields: [
                  { label: '纳税期间', val: String((clearanceData as any).taxPeriod || (clearanceData as any).taxYear || '—') },
                  { label: '税款总额（万元）', val: String((clearanceData as any).totalTaxAmount ?? (clearanceData as any).taxPaid ?? '—') },
                  { label: '税务机关', val: String((clearanceData as any).taxAuthority ?? (clearanceData as any).issuingAuthority ?? '—') },
                  { label: '开具日期', val: String((clearanceData as any).issueDate ?? (clearanceData as any).issuedDate ?? '—') },
                ]});
              }
              if (creditData) {
                sections2.push({ title: '纳税信用等级', color: 'bg-purple-50 border-purple-200', fields: [
                  { label: '信用等级', val: String((creditData as any).creditLevel ?? (creditData as any).rating ?? '—') },
                  { label: '评定年度', val: String((creditData as any).year ?? (creditData as any).taxYear ?? '—') },
                  { label: '评定机关', val: String((creditData as any).taxAuthority ?? '—') },
                ]});
              }
              if (sections2.length === 0 && generalData) {
                const entries = Object.entries(generalData).filter(([k]) => !['taxType', 'dataSource', 'rawText'].includes(k)).slice(0, 8);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entries.map(([k, v]) => (
                      <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-gray-400 mb-0.5">{k}</div>
                        <div className="text-xs font-medium text-gray-800">{String(v ?? '—')}</div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {sections2.map(sec => (
                    <div key={sec.title} className={`rounded-xl border p-4 ${sec.color}`}>
                      <div className="text-sm font-semibold text-gray-700 mb-3">{sec.title}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sec.fields.map(f => (
                          <div key={f.label} className="bg-white/70 rounded-lg px-3 py-2">
                            <div className="text-[10px] text-gray-400">{f.label}</div>
                            <div className="text-xs font-semibold text-gray-800">{f.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : (
              <div className="text-xs text-gray-400 text-center py-8">
                <div className="text-2xl mb-2">🧾</div>
                <div>税务数据尚未上传或解析</div>
                <div className="text-[10px] mt-1">请在资料清单中上传纳税证明/申报表文件</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 他行授信 */}
      {activeSection === 'credit' && (
        <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100 bg-purple-50">
            <span className="text-sm font-semibold text-gray-700">💳 他行授信</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">来源：他行授信Excel解析</span>
          </div>
          <div className="p-4">
            {appData.creditFacilities && appData.creditFacilities.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-purple-50 rounded-xl px-4 py-3 text-center">
                    <div className="text-[10px] text-gray-400 mb-1">授信机构数</div>
                    <div className="text-2xl font-bold text-purple-600">{appData.creditFacilities.length}</div>
                  </div>
                  <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                    <div className="text-[10px] text-gray-400 mb-1">总授信额（万）</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {appData.creditFacilities.reduce((s, cf) => s + (cf.creditAmount ?? 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">银行</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">类型</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">授信额（万）</th>
                        <th className="px-3 py-2 text-right text-gray-500 font-medium">余额（万）</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">到期日</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">担保方式</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {appData.creditFacilities.map((cf, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800 font-medium">{cf.bankName ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{cf.facilityType ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{cf.creditAmount != null ? cf.creditAmount.toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 text-right text-orange-600">{cf.outstandingBalance != null ? cf.outstandingBalance.toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{cf.endDate ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{cf.guaranteeType ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={2} className="px-3 py-2 text-gray-500 font-medium">合计</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">
                          {appData.creditFacilities.reduce((s, cf) => s + (cf.creditAmount ?? 0), 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-orange-600">
                          {appData.creditFacilities.reduce((s, cf) => s + (cf.outstandingBalance ?? 0), 0).toLocaleString()}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 text-center py-8">
                <div className="text-2xl mb-2">💳</div>
                <div>他行授信数据尚未上传或解析</div>
                <div className="text-[10px] mt-1">请在资料清单中上传他行授信Excel文件</div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 前五大客户/供应商 */}
      {activeSection === 'customers' && (
        <div className="space-y-3">
          {/* 前五大客户 */}
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-100 bg-blue-50">
              <span className="text-sm font-semibold text-gray-700">🤝 前五大甲方客户</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">来源：Top5客户清单解析</span>
            </div>
            <div className="p-4">
              {appData.top5Customers && appData.top5Customers.length > 0 ? (() => {
                const sortedYears = [...appData.top5Customers].sort((a, b) => b.year - a.year);
                const latestYear = sortedYears[0];
                const items = latestYear?.items?.filter(it => it.name) ?? [];
                const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                return (
                  <div className="space-y-3">
                    {/* 年份切换 */}
                    {sortedYears.length > 1 && (
                      <div className="flex gap-1 flex-wrap">
                        {sortedYears.map(yd => (
                          <span key={yd.year} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">{yd.year}年</span>
                        ))}
                      </div>
                    )}
                    {/* 汇总指标 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">客户数量</div>
                        <div className="text-lg font-bold text-blue-600">{items.length}</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">合计金额（万）</div>
                        <div className="text-lg font-bold text-orange-600">{totalAmount > 0 ? totalAmount.toLocaleString() : '—'}</div>
                      </div>
                      <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">Top1占比</div>
                        <div className="text-lg font-bold text-green-600">{items[0]?.ratio ? `${items[0].ratio}%` : '—'}</div>
                      </div>
                    </div>
                    {/* 明细表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">排名</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">客户名称</th>
                            <th className="px-3 py-2 text-right text-gray-500 font-medium w-24">金额（万元）</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium w-32">占比</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">备注</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {items.map(item => (
                            <tr key={item.rank} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-center font-medium">{item.rank}</td>
                              <td className="px-3 py-2 text-gray-800 font-medium">{item.name}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{item.amount || '—'}</td>
                              <td className="px-3 py-2">
                                {item.ratio ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(parseFloat(item.ratio) || 0, 100)}%` }} />
                                    </div>
                                    <span className="text-gray-600 text-[10px] w-10 text-right">{item.ratio}%</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-[10px]">{item.notes || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-[10px] text-gray-400 text-right">统计年度：{latestYear.year}年</div>
                  </div>
                );
              })() : (
                <div className="text-xs text-gray-400 text-center py-8">
                  <div className="text-2xl mb-2">🤝</div>
                  <div>前五大客户数据尚未上传或解析</div>
                  <div className="text-[10px] mt-1">请在资料清单中上传Top5甲方清单文件，或在数据核验页手动录入</div>
                </div>
              )}
            </div>
          </div>

          {/* 前五大供应商 */}
          <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-green-100 bg-green-50">
              <span className="text-sm font-semibold text-gray-700">🏭 前五大供应商</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">来源：Top5供应商清单解析</span>
            </div>
            <div className="p-4">
              {appData.top5Suppliers && appData.top5Suppliers.length > 0 ? (() => {
                const sortedYears = [...appData.top5Suppliers].sort((a, b) => b.year - a.year);
                const latestYear = sortedYears[0];
                const items = latestYear?.items?.filter(it => it.name) ?? [];
                const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
                return (
                  <div className="space-y-3">
                    {/* 汇总指标 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">供应商数量</div>
                        <div className="text-lg font-bold text-green-600">{items.length}</div>
                      </div>
                      <div className="bg-orange-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">合计金额（万）</div>
                        <div className="text-lg font-bold text-orange-600">{totalAmount > 0 ? totalAmount.toLocaleString() : '—'}</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl px-3 py-2 text-center">
                        <div className="text-[10px] text-gray-400 mb-0.5">Top1占比</div>
                        <div className="text-lg font-bold text-blue-600">{items[0]?.ratio ? `${items[0].ratio}%` : '—'}</div>
                      </div>
                    </div>
                    {/* 明细表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-2 text-left text-gray-500 font-medium w-8">排名</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">供应商名称</th>
                            <th className="px-3 py-2 text-right text-gray-500 font-medium w-24">金额（万元）</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium w-32">占比</th>
                            <th className="px-3 py-2 text-left text-gray-500 font-medium">备注</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {items.map(item => (
                            <tr key={item.rank} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-center font-medium">{item.rank}</td>
                              <td className="px-3 py-2 text-gray-800 font-medium">{item.name}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{item.amount || '—'}</td>
                              <td className="px-3 py-2">
                                {item.ratio ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(parseFloat(item.ratio) || 0, 100)}%` }} />
                                    </div>
                                    <span className="text-gray-600 text-[10px] w-10 text-right">{item.ratio}%</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-[10px]">{item.notes || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-[10px] text-gray-400 text-right">统计年度：{latestYear.year}年</div>
                  </div>
                );
              })() : (
                <div className="text-xs text-gray-400 text-center py-8">
                  <div className="text-2xl mb-2">🏭</div>
                  <div>前五大供应商数据尚未上传或解析</div>
                  <div className="text-[10px] mt-1">请在资料清单中上传Top5供应商清单文件，或在数据核验页手动录入</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 营业收入构成 */}
      {activeSection === 'revenue' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-100 bg-indigo-50">
              <span className="text-sm font-semibold text-gray-700">📈 营业收入构成分析</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">来源：营收构成分析表解析</span>
            </div>
            <div className="p-4">
              {appData.businessSegments && appData.businessSegments.length > 0 ? (() => {
                // 按年度分组
                const byYear: Record<string, typeof appData.businessSegments> = {};
                (appData.businessSegments || []).forEach(seg => {
                  const yr = String(seg.year || '未知年度');
                  if (!byYear[yr]) byYear[yr] = [];
                  byYear[yr]!.push(seg);
                });
                const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
                const latestYear = years[0];
                const segments = byYear[latestYear] || [];
                const totalRevenue = segments.reduce((s, seg) => s + (seg.revenue || 0), 0);
                return (
                  <div className="space-y-4">
                    {/* 年度切换 */}
                    {years.length > 1 && (
                      <div className="flex gap-2 flex-wrap">
                        {years.map(yr => (
                          <span key={yr} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{yr}年</span>
                        ))}
                      </div>
                    )}
                    {/* 汇总指标 */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-indigo-700">{segments.length}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">业务线数量</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-indigo-700">
                          {totalRevenue >= 10000 ? `${(totalRevenue / 10000).toFixed(1)}亿` : `${(totalRevenue / 10000).toFixed(0)}万`}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">总营收（元）</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-indigo-700">
                          {segments[0]?.segmentName ? segments[0].segmentName.slice(0, 6) : '—'}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">主要业务线</div>
                      </div>
                    </div>
                    {/* 分类明细表 */}
                    <div className="space-y-2">
                      {segments.map((seg, idx) => {
                        const ratio = seg.revenueRatio ?? (totalRevenue > 0 && seg.revenue ? (seg.revenue / totalRevenue * 100) : 0);
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-gray-600 truncate flex-shrink-0">{seg.segmentName || `业务${idx + 1}`}</div>
                            <div className="flex-1">
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-indigo-500"
                                  style={{ width: `${Math.min(ratio, 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-xs font-medium text-gray-700 w-10 text-right">{ratio.toFixed(2)}%</div>
                            <div className="text-[10px] text-gray-400 w-20 text-right">
                              {seg.revenue ? (seg.revenue >= 10000 ? `${(seg.revenue / 10000).toFixed(1)}亿` : `${(seg.revenue / 10000).toFixed(0)}万`) : '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 数据来源说明 */}
                    <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">
                      数据来源：营业收入组成分析表（revenue_breakdown）解析结果，年度：{latestYear}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <span className="text-2xl mb-2">📄</span>
                  <div className="text-xs font-medium">暂无营收构成数据</div>
                  <div className="text-[10px] mt-1">请在资料清单中上传「营业收入组成分析」文件（revenue_breakdown）</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 三源交叉验证 */}
      {activeSection === 'cross' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <CheckCircle2 size={14} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">三源交叉验证</span>
            <span className="ml-auto text-[10px] text-gray-400">工商 · 财务 · 税务</span>
          </div>
          <div className="p-4">
            {(() => {
              if (!cv) return (
                <div className="text-xs text-gray-400 text-center py-4">
                  需完成AI分析后生成交叉验证结果
                </div>
              );
              const items = [
                { label: "工商-财务一致性", value: cv.businessFinancialConsistency, key: "bfc" },
                { label: "财务-税务一致性", value: cv.financialTaxConsistency, key: "ftc" },
                { label: "工商-税务一致性", value: cv.businessTaxConsistency, key: "btc" },
              ];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {items.map(item => {
                    const pct = typeof item.value === 'number' ? Math.round(item.value * 100) : null;
                    const color = pct === null ? "text-gray-400" : pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
                    const bg = pct === null ? "bg-gray-50" : pct >= 80 ? "bg-green-50" : pct >= 60 ? "bg-amber-50" : "bg-red-50";
                    return (
                      <div key={item.key} className={`${bg} rounded-xl p-3 text-center`}>
                        <div className={`text-2xl font-bold ${color}`}>{pct !== null ? `${pct}%` : "—"}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{item.label}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}





export { AnalysisEnginePanel, ComprehensivePanel, CreditDecisionPanel, MultiSourcePanel };
