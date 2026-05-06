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
import type { AnalysisResult, AppData, FeatureItem } from "./panelTypes";
import { FEATURE_GROUPS, formatFeatureValue, getFeatureConclusion } from "./panelTypes";
import { FEATURE_TO_FILE_MAP } from "./DocDataPanels";

// 特征公式元数据
const FEATURE_FORMULA_MAP: Record<string, string> = {
  'F01': '纳税信用等级：A级=100分、B级=80分、C级=60分、D级=40分、M级=20分',
  'F02': '企业成立月数 = (当前日期 - 成立日期) / 30天',
  'F03': '注册资本对数 = ln(注册资本万元)',
  'F04': '法人风险评分 = f(诉讴记录, 失信记录, 司法封禁, 行政处罚)',
  'F05': '股权集中度 = 最大股东持股比例',
  'F06': '关联企业数量 = 天眼查关联企业总数',
  'F07': '关联高风险企业 = 天眼查关联企业中风险级别高的企业数量',
  'F08': '高管变更次数 = 天眼查近三年高管变更记录数',
  'F09': '经营范围匹配度 = 实际经营业务与许可范围的匹配程度',
  'F10': '资质证书数量 = 天眼查已登记资质证书总数',
  'F11': '是否上市公司 = 天眼查上市状态标识',
  'F12': '行业风险评分 = f(行业周期, 不良率, 监管政策)',
  'F13': '资产负债率 = 总负债 / 总资产 × 100%',
  'F14': '流动比率 = 流动资产 / 流动负债',
  'F15': '速动比率 = (流动资产 - 存货) / 流动负债',
  'F16': '利息保障倍数 = EBIT / 财务费用',
  'F17': '资产收益率 ROA = 净利润 / 总资产 × 100%',
  'F18': '净资产收益率 ROE = 净利润 / 所有者权益 × 100%',
  'F19': '毛利率 = (营业收入 - 营业成本) / 营业收入 × 100%',
  'F20': '净利润率 = 净利润 / 营业收入 × 100%',
  'F21': '现金含量比 = 经营现金流 / 营业收入 × 100%',
  'F22': '应收账款周转天数 = 应收账款 / (营业收入 / 365)',
  'F23': '存货周转天数 = 存货 / (营业成本 / 365)',
  'F24': '总资产周转率 = 营业收入 / 总资产',
  'F25': '财务费用占收入比 = 财务费用 / 营业收入 × 100%',
  'F26': '营收增长率 = (本期收入 - 上期收入) / 上期收入 × 100%',
  'F27': '现金流稳定性 = 月度经营现金流变异系数（越低越稳定）',
  'F28': '流水集中度 = TOP5客户入账占比',
  'F29': '平均月入账金额 = 年度入账总金额 / 12（万元）',
  'F30': '平均月出账金额 = 年度出账总金额 / 12（万元）',
  'F31': '净流入比 = 入账总金额 / 出账总金额',
  'F32': '大额单笔占比 = 单笔超过10万的交易占比',
  'F33': '年化营业收入（流水法）= 月均入账 × 12（万元）',
  'F34': '增值税申报营收 = 年度增值税申报表中的计税销售额（万元）',
  'F35': '税财差异度 = |财务营收 - 税务营收| / 财务营收 × 100%',
  'F36': '税负担率 = 已缴税款 / 营业收入 × 100%',
  'F37': '应收账款占比 = 应收账款 / 总资产 × 100%',
  'F38': '应付账款占比 = 应付账款 / 总资产 × 100%',
};

function FeaturesPanel({
  result,
  expandedGroups,
  onToggleGroup,
}: {
  result: AnalysisResult | null;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (group: string) => void;
}) {
  const completeness = result?.layer3?.featureSummary?.dataCompleteness ?? 0;
  const missingFields = result?.layer3?.featureSummary?.missingFields ?? [];
  const featureValues = result?.layer3?.featureSummary?.values ?? {};
  const [expandedFeature, setExpandedFeature] = React.useState<string | null>(null);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Activity size={32} className="mb-3 opacity-30" />
        <div className="text-sm">等待分析完成</div>
        <div className="text-xs mt-1">完成AI分析后显示38维特征向量</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 完整度 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">特征数据完整度</span>
          <span className="text-sm font-bold text-orange-600">{Math.round(completeness * 100)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all"
            style={{ width: `${completeness * 100}%` }}
          />
        </div>
        {missingFields.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            缺失字段：{missingFields.slice(0, 5).join("、")}{missingFields.length > 5 ? `等${missingFields.length}项` : ""}
          </div>
        )}
      </div>

      {/* 数据缺失因果链警告 */}
      {result?.layer3?.featureSummary?.missingDataChain?.missingItems &&
        result.layer3.featureSummary.missingDataChain.missingItems.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">数据缺失因果链 — 以下文件未上传，导致对应特征无法计算</span>
          </div>
          <div className="space-y-2">
            {result.layer3.featureSummary.missingDataChain.missingItems.map(item => (
              <div key={item.fileType} className="text-xs">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    item.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    item.severity === 'important' ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {item.severity === 'critical' ? '必须' : item.severity === 'important' ? '重要' : '可选'}
                  </span>
                  <span className="font-medium text-gray-700">缺少：{item.fileName}</span>
                </div>
                {item.affectedFeatures.length > 0 && (
                  <div className="ml-8 text-gray-500">→ 无法计算：{item.affectedFeatures.slice(0, 3).join('、')}{item.affectedFeatures.length > 3 ? `等${item.affectedFeatures.length}项` : ''}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 特征分组 */}
      {FEATURE_GROUPS.map(group => (
        <div key={group.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => onToggleGroup(group.name)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
          >
            <span className="text-xs font-semibold text-gray-700">{group.name}</span>
            {expandedGroups[group.name] ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {expandedGroups[group.name] && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {group.features.map(feat => {
                const isMissing = missingFields.includes(feat.id);
                const rawVal = featureValues?.[feat.key];
                const hasValue = rawVal !== undefined && rawVal !== null && !isMissing;
                const conclusion = hasValue ? getFeatureConclusion(feat, rawVal as number) : null;
                const levelColors = {
                  good: "bg-green-100 text-green-700",
                  warn: "bg-yellow-100 text-yellow-700",
                  bad: "bg-red-100 text-red-600",
                  neutral: "bg-gray-100 text-gray-500",
                };
                const isExpanded = expandedFeature === feat.id;
                const formula = FEATURE_FORMULA_MAP[feat.id];
                return (
                  <div key={feat.id} className={`${conclusion?.level === "bad" ? "bg-red-50/40" : ""}`}>
                    <button
                      onClick={() => setExpandedFeature(isExpanded ? null : feat.id)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/80 transition text-left"
                    >
                      <span className="text-[11px] text-gray-400 font-mono w-8 flex-shrink-0">{feat.id}</span>
                      <span className="text-xs text-gray-700 flex-1">{feat.name}</span>
                      {hasValue ? (
                        <span className="text-sm font-bold text-gray-800 flex-shrink-0">
                          {formatFeatureValue(feat, rawVal as number)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 flex-shrink-0">—</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        isMissing
                          ? "bg-gray-100 text-gray-400"
                          : !hasValue
                          ? "bg-gray-100 text-gray-400"
                          : conclusion
                          ? levelColors[conclusion.level]
                          : "bg-green-100 text-green-600"
                      }`}>
                        {isMissing
                          ? "缺失"
                          : !hasValue
                          ? "未知"
                          : conclusion?.level === "bad"
                          ? "⚠ 风险"
                          : conclusion?.level === "warn"
                          ? "关注"
                          : "正常"}
                      </span>
                      {isExpanded ? <ChevronUp size={11} className="text-gray-300 flex-shrink-0" /> : <ChevronDown size={11} className="text-gray-300 flex-shrink-0" />}
                    </button>
                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="px-4 pb-3 ml-11 space-y-1.5 border-t border-gray-50 pt-2">
                        {formula && (
                          <div className="text-[11px] text-gray-500">
                            <span className="text-gray-400 mr-1">公式：</span>
                            <span className="font-mono text-blue-600">{formula}</span>
                          </div>
                        )}
                        {hasValue && (
                          <div className="text-[11px] text-gray-500">
                            <span className="text-gray-400 mr-1">实际值：</span>
                            <strong className="text-gray-700">{formatFeatureValue(feat, rawVal as number)}</strong>
                          </div>
                        )}
                        {!hasValue && FEATURE_TO_FILE_MAP[feat.id] && (
                          <div className="text-[11px] text-amber-600 flex items-center gap-1">
                            <span className="opacity-60">→</span>
                            <span>需要：{FEATURE_TO_FILE_MAP[feat.id]}</span>
                          </div>
                        )}
                        {conclusion && (
                          <div className={`text-[11px] ${
                            conclusion.level === "bad" ? "text-red-500" :
                            conclusion.level === "warn" ? "text-yellow-600" :
                            conclusion.level === "good" ? "text-green-600" : "text-gray-400"
                          }`}>
                            <span className="text-gray-400 mr-1">解读：</span>{conclusion.text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RulesPanel({ result }: { result: AnalysisResult | null }) {
  if (!result?.layer3?.ruleEngine) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Shield size={32} className="mb-3 opacity-30" />
        <div className="text-sm">等待规则引擎运行</div>
        <div className="text-xs mt-1">完成AI分析后显示8条硬性规则结果</div>
      </div>
    );
  }

  const { passed, triggeredRules, summary } = result.layer3.ruleEngine;

  // 每条规则的数据来源说明
  const ALL_RULES = [
    { id: "HR001", name: "企业存续状态", desc: "企业必须处于存续/正常经营状态",
      source: "工商登记信息", sourceDoc: "营业执照、天眼查实时数据", needsUpload: false },
    { id: "HR002", name: "成立年限", desc: "企业成立满1年（保理/供应链满6个月）",
      source: "工商登记信息", sourceDoc: "营业执照成立日期", needsUpload: false },
    { id: "HR003", name: "法人失信", desc: "法定代表人无失信被执行人记录",
      source: "失信被执行人名单", sourceDoc: "最高人民法院官方数据库", needsUpload: false },
    { id: "HR004", name: "企业失信", desc: "企业本身无失信被执行人记录",
      source: "失信被执行人名单", sourceDoc: "最高人民法院官方数据库", needsUpload: false },
    { id: "HR005", name: "重大司法风险", desc: "近1年无重大未结诉讼（标的>申请额50%）",
      source: "司法诉讼记录", sourceDoc: "中国裁判文书网、天眼查诉讼信息", needsUpload: false },
    { id: "HR006", name: "行业禁入", desc: "非禁止性行业（赌博/色情/高污染等）",
      source: "工商登记信息", sourceDoc: "营业执照经营范围", needsUpload: false },
    { id: "HR007", name: "资产负债率", desc: "资产负债率≤85%（制造业≤80%）",
      source: "财务报表", sourceDoc: "上传财务报表 → 资产负债表", needsUpload: true, uploadFile: "财务报表（资产负债表）" },
    { id: "HR008", name: "最低营收", desc: "近12个月月均营收≥申请额10%",
      source: "财务报表/销售流水", sourceDoc: "上传财务报表 → 利润表", needsUpload: true, uploadFile: "财务报表（利润表）或银行流水" },
  ];

  const missingChain = result?.layer3?.featureSummary?.missingDataChain;

  return (
    <div className="space-y-3">
      {/* 数据缺失因果链警告（规则引擎相关） */}
      {missingChain && missingChain.missingItems.some(i =>
        i.affectedScoring.some(s => s.includes('规则引擎'))
      ) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">数据缺失警告 — 以下文件未上传，导致部分规则无法验证</span>
          </div>
          {missingChain.missingItems
            .filter(i => i.affectedScoring.some(s => s.includes('规则引擎')))
            .map(item => (
              <div key={item.fileType} className="text-xs mt-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5 ${
                  item.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {item.severity === 'critical' ? '必须' : '重要'}
                </span>
                <span className="font-medium text-gray-700">{item.fileName}</span>
                <div className="ml-8 text-gray-500 mt-0.5">
                  {item.affectedScoring.filter(s => s.includes('规则引擎')).join('；')}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 总结 */}
      <div className={`rounded-xl border p-4 ${passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-center gap-2 mb-1">
          {passed
            ? <CheckCircle2 size={16} className="text-green-600" />
            : <XCircle size={16} className="text-red-500" />}
          <span className={`text-sm font-bold ${passed ? "text-green-700" : "text-red-600"}`}>
            {passed ? "✅ 全部规则通过" : `❌ 触发 ${triggeredRules.length} 条规则`}
          </span>
        </div>
        <p className="text-xs text-gray-600">{summary}</p>
      </div>

      {/* 规则列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-600">8条硬性准入规则</span>
        </div>
        <div className="divide-y divide-gray-50">
          {ALL_RULES.map(rule => {
            const triggered = triggeredRules.find(t => t.ruleId === rule.id);
            // 判断数据来源状态：需要上传文件的规则，检查是否有对应文件缺失
            const isDataMissing = rule.needsUpload &&
              missingChain?.missingItems.some(item =>
                rule.uploadFile && item.fileName.includes(rule.uploadFile.split('（')[0])
              );
            const dataStatus = triggered ? 'triggered' :
              isDataMissing ? 'missing' : 'verified';
            return (
              <div key={rule.id} className={`flex items-start gap-3 px-4 py-3 ${
                triggered ? "bg-red-50/50" : isDataMissing ? "bg-amber-50/30" : ""
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  triggered ? "bg-red-500" : isDataMissing ? "bg-amber-400" : "bg-green-500"
                }`}>
                  {triggered
                    ? <XCircle size={11} className="text-white" />
                    : isDataMissing
                    ? <AlertTriangle size={9} className="text-white" />
                    : <CheckCircle2 size={11} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-gray-400">{rule.id}</span>
                    <span className={`text-sm font-medium ${
                      triggered ? "text-red-700" : isDataMissing ? "text-amber-700" : "text-gray-700"
                    }`}>{rule.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{triggered ? triggered.detail : rule.desc}</div>
                  {/* 数据来源状态标签 */}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <Info size={9} className="text-blue-400 flex-shrink-0" />
                    <span className="text-[10px] text-blue-500">来源：{rule.source}</span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400">{rule.sourceDoc}</span>
                    {/* 数据状态标签 */}
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      dataStatus === 'verified' ? 'bg-green-50 text-green-600' :
                      dataStatus === 'missing' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {dataStatus === 'verified' ? '✓ 已验证' :
                       dataStatus === 'missing' ? '⚠ 数据缺失' : '✕ 已触发'}
                    </span>
                  </div>
                  {/* 数据缺失时显示需要哪个文件 */}
                  {isDataMissing && rule.uploadFile && (
                    <div className="mt-1 text-[11px] text-amber-600">
                      → 需要上传：{rule.uploadFile}，才能验证此规则
                    </div>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  triggered ? "bg-red-100 text-red-600" :
                  isDataMissing ? "bg-amber-100 text-amber-600" :
                  "bg-green-100 text-green-600"
                }`}>
                  {triggered ? "触发" : isDataMissing ? "无法核实" : "通过"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScorecardPanel({ result }: { result: AnalysisResult | null }) {
  if (!result?.layer3?.scorecard) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <BarChart3 size={32} className="mb-3 opacity-30" />
        <div className="text-sm">等待评分卡计算</div>
        <div className="text-xs mt-1">完成AI分析后显示信用评分详情</div>
      </div>
    );
  }

  const sc = result.layer3.scorecard;
  const gradeColor = (g: string) => {
    if (["AAA", "AA", "A"].includes(g)) return "text-green-600 bg-green-50 border-green-200";
    if (["BBB", "BB"].includes(g)) return "text-blue-600 bg-blue-50 border-blue-200";
    if (["B", "CCC"].includes(g)) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const breakdown = sc.scoreBreakdown;
  const subScores = [
    { label: "主体资质评分", value: sc.subjectQualityScore, max: 100, color: "bg-blue-400", contribution: breakdown?.subjectContribution,
      source: "工商登记 + 司法数据", sourceDetail: "营业执照、天眼查工商信息、法人身份证、诉讼失信记录",
      features: "F01纳税信用、F02成立年限、F03注册资本、F04法人风险、F05-F12主体特征" },
    { label: "财务健康评分", value: sc.financialHealthScore, max: 100, color: "bg-green-400", contribution: breakdown?.financialContribution,
      source: "财务报表 + 销售流水", sourceDetail: "上传财务报表（资产负债表、利润表）、销售流水数据",
      features: "F13资产负债率、F14流动比率、F15速动比率、F16-F25财务特征" },
    { label: "经营稳定性评分", value: sc.operationStabilityScore, max: 100, color: "bg-purple-400", contribution: breakdown?.operationContribution,
      source: "销售流水 + 天眼查经营数据", sourceDetail: "销售流水月度数据、天眼查经营状况、行业风险指数",
      features: "F26营收增长率、F27现金流稳定性、F28-F38经营特征" },
  ];

  const missingChain = result?.layer3?.featureSummary?.missingDataChain;

  return (
    <div className="space-y-4">
      {/* 数据缺失因果链警告（评分维度相关） */}
      {missingChain && missingChain.missingItems.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">评分不完整警告 — 以下文件缺失导致评分维度受影响</span>
          </div>
          <div className="space-y-2">
            {missingChain.missingItems.map(item => (
              <div key={item.fileType} className="text-xs">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    item.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    item.severity === 'important' ? 'bg-amber-100 text-amber-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {item.severity === 'critical' ? '必须' : item.severity === 'important' ? '重要' : '可选'}
                  </span>
                  <span className="font-medium text-gray-700">缺少：{item.fileName}</span>
                </div>
                {item.affectedScoring.length > 0 && (
                  <div className="ml-8 text-gray-500">→ 影响评分：{item.affectedScoring.join('；')}</div>
                )}
              </div>
            ))}
          </div>
          {missingChain.unavailableDimensions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <div className="text-[11px] text-amber-600 font-medium">当前无法评估的维度：</div>
              {missingChain.unavailableDimensions.map(d => (
                <div key={d} className="text-[11px] text-amber-700 mt-0.5">• {d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 总分 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-1">综合信用评分</div>
            <div className="text-4xl font-bold text-gray-900">{sc.score}</div>
            <div className="text-xs text-gray-400 mt-1">满分 1000 分</div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold px-4 py-2 rounded-xl border ${gradeColor(sc.creditGrade)}`}>
              {sc.creditGrade}
            </div>
            <div className="text-xs text-gray-400 mt-1">信用等级</div>
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all"
            style={{ width: `${(sc.score / 1000) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>违约概率 PD：<strong className="text-red-500">{(sc.scorePD * 100).toFixed(2)}%</strong></span>
          <span className="text-gray-600">{sc.recommendation}</span>
        </div>
      </div>

      {/* 三维子分 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-3">三维评分明细</div>
        <div className="space-y-3">
          {subScores.map(s => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{typeof s.value === 'number' ? s.value.toFixed(2) : s.value}<span className="text-xs text-gray-400">/{s.max}</span></span>
                  {s.contribution !== undefined && (
                    <span className="text-xs text-gray-400">贡献 {s.contribution.toFixed(0)}分</span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${s.color} h-2 rounded-full transition-all`} style={{ width: `${(s.value / s.max) * 100}%` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-500">
                {s.value >= 80 ? `✅ 评分优秀，对总分贡献显著` :
                 s.value >= 60 ? `⚠️ 评分中等，有改善空间` :
                 `❌ 评分偏低，是主要风险因素`}
              </div>
              {/* 数据来源标签 */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <div className="flex items-center gap-1">
                  <Info size={9} className="text-blue-400" />
                  <span className="text-[10px] text-blue-500">{s.source}</span>
                </div>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400">{s.features}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-400 pl-3">{s.sourceDetail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 惩罚分说明 */}
      {sc.scoreBreakdown && sc.scoreBreakdown.penaltyPoints !== 0 && (
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">惩罚项说明</span>
          </div>
          <div className="text-xs text-orange-600">
            本次评分共惩罚 <strong>{Math.abs(sc.scoreBreakdown.penaltyPoints).toFixed(0)}</strong> 分，包括：关联高风险企业、诉讼记录、舆情风险等因素导致分数降低。
          </div>
        </div>
      )}

      {/* 综合评价 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">综合评价与建议</div>
        <p className="text-sm text-gray-700 leading-relaxed">{sc.recommendation}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-800">{(sc.scorePD * 100).toFixed(2)}%</div>
            <div className="text-[11px] text-gray-400">预期违约概率PD</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{sc.score}</div>
            <div className="text-[11px] text-gray-400">综合信用分</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${["AAA","AA","A"].includes(sc.creditGrade) ? "text-green-600" : ["BBB","BB"].includes(sc.creditGrade) ? "text-blue-600" : "text-red-600"}`}>{sc.creditGrade}</div>
            <div className="text-[11px] text-gray-400">信用等级</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitPanel({ result }: { result: AnalysisResult | null }) {
  if (!result?.layer3?.limitCalculation) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <DollarSign size={32} className="mb-3 opacity-30" />
        <div className="text-sm">等待额度计算</div>
        <div className="text-xs mt-1">完成AI分析后显示三法额度对比</div>
      </div>
    );
  }

  const lc = result.layer3.limitCalculation;
  // methodDetails是数组，按method名称建立映射
  const detailMap: Record<string, typeof lc.methodDetails extends Array<infer T> | undefined ? T : never> = {};
  if (lc.methodDetails) {
    for (const d of lc.methodDetails) {
      detailMap[d.method] = d;
    }
  }
  const methods = [
    { name: "收入法", value: lc.revenueMethodLimit, noDataMsg: lc.incomeMethodDetail || "需上传财务报表或增值税申报表", desc: "基于年营业收入xd7授信系数", color: "bg-blue-400", methodKey: "收入法",
      sourceLabel: "财务报表利润表", sourceDetail: "年营业收入来自上传财务报表，系数根据行业和贷款类型确定" },
    { name: "净资产法", value: lc.netAssetMethodLimit, noDataMsg: lc.netAssetMethodDetail || "需上传财务报表资产负债表", desc: "基于净资产xd7保守系数", color: "bg-green-400", methodKey: "净资产法",
      sourceLabel: "财务报表资产负债表", sourceDetail: "净资产=总资产-总负债，数据来自上传财务报表" },
    { name: "现金流法", value: lc.cashFlowMethodLimit, noDataMsg: lc.cashFlowMethodDetail || "需上传销售流水或现金流量表", desc: lc.cashFlowMethodLimit != null && lc.cashFlowMethodLimit < 0 ? "经营现金流为负，建议额度为0（现金流法不适用）" : "基于月均经营现金流×期限", color: "bg-purple-400", methodKey: "现金流法",
      sourceLabel: "销售流水/现金流量表", sourceDetail: "经营现金流来自销售流水数据或现金流量表" },
  ];
  const validValues = methods.map(m => m.value).filter((v): v is number => v !== null && v > 0);
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 1;
  const missingChain = result?.layer3?.featureSummary?.missingDataChain;

  return (
    <div className="space-y-4">
      {/* 数据缺失因果链警告（额度计算相关） */}
      {missingChain && missingChain.missingItems.some(i => i.affectedLimits.length > 0) && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700">额度计算不完整 — 以下文件缺失导致部分额度无法计算</span>
          </div>
          <div className="space-y-2">
            {missingChain.missingItems
              .filter(i => i.affectedLimits.length > 0)
              .map(item => (
                <div key={item.fileType} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {item.severity === 'critical' ? '必须' : '重要'}
                    </span>
                    <span className="font-medium text-gray-700">缺少：{item.fileName}</span>
                  </div>
                  <div className="ml-8 text-gray-500">→ 无法计算：{item.affectedLimits.join('；')}</div>
                  <div className="ml-8 text-gray-400 mt-0.5">缺失数据：{item.missingData.join('、')}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 最终额度 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400 mb-1">建议授信额度</div>
            {lc.recommendedLimit !== null && lc.recommendedLimit !== undefined ? (
              <div className="text-4xl font-bold text-orange-600">{Math.max(0, lc.recommendedLimit)}<span className="text-lg text-gray-400 ml-1">万元</span></div>
            ) : (
              <div className="text-xl font-medium text-gray-400">需上传财务文件后计算</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">{lc.approvedAmount != null ? Math.max(0, lc.approvedAmount) : '--'}<span className="text-sm text-gray-400 ml-1">万元</span></div>
            <div className="text-xs text-gray-400 mt-1">最终批准额度</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
              style={{ width: `${lc.approvalRatio * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">批准比例 {Math.round(lc.approvalRatio * 100)}%</span>
        </div>
      </div>

      {/* 授信为0原因分析 */}
      {lc.approvedAmount === 0 && lc.zeroAmountReasons && lc.zeroAmountReasons.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-700">授信额度为0 — 原因分析</span>
          </div>
          <div className="space-y-3">
            {lc.zeroAmountReasons.map((r, i) => (
              <div key={i} className="bg-white rounded-lg border border-red-100 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">{r.category}</span>
                </div>
                <div className="text-xs font-medium text-red-700 mb-1">{r.reason}</div>
                <div className="text-[11px] text-gray-600 mb-1.5 leading-relaxed">{r.detail}</div>
                <div className="flex items-start gap-1.5 bg-blue-50 rounded p-2">
                  <Info size={10} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-blue-600">{r.suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 三法对比 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-600 mb-4">三法额度对比（万元）</div>
        <div className="space-y-4">
          {methods.map(m => {
            const detail = detailMap[m.methodKey];
            const hasData = m.value !== null && m.value !== undefined;
            return (
              <div key={m.name} className={`rounded-lg border p-3 ${
                !hasData ? "border-gray-100 bg-gray-50/50" :
                detail?.isBinding ? "border-orange-200 bg-orange-50/30" : "border-gray-100 bg-gray-50/30"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{m.name}</span>
                    {hasData && detail?.isBinding && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">约束方法</span>
                    )}
                    {!hasData && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full">暂无数据</span>
                    )}
                  </div>
                  {hasData ? (
                    <span className="text-base font-bold text-gray-800">{m.value}万</span>
                  ) : (
                    <span className="text-sm text-gray-300">--</span>
                  )}
                </div>
                {hasData ? (
                  <>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                      <div
                        className={`${m.color} h-2 rounded-full transition-all`}
                        style={{ width: `${((m.value as number) / maxVal) * 100}%` }}
                      />
                    </div>
                    {detail ? (
                      <div className="text-[11px] text-gray-500 space-y-0.5">
                        <div>公式：<span className="font-mono text-gray-600">{detail.formula}</span></div>
                        <div>输入参数：{Object.entries(detail.inputValues).map(([k, v]) => `${k}=${v}`).join("、")}</div>
                        <div>计算结果：<strong>{detail.result}万元</strong></div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400">{m.desc}</div>
                    )}
                    {/* 数据来源标签 */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                      <Info size={9} className="text-blue-400 flex-shrink-0" />
                      <span className="text-[10px] text-blue-500">来源：{m.sourceLabel}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{m.sourceDetail}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-1.5 mt-1">
                    <AlertCircle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] text-amber-600">{m.noDataMsg}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>取三法最小值作为建议额度</span>
            <span className="font-medium text-orange-600">推荐：{lc.recommendedLimit !== null && lc.recommendedLimit !== undefined ? `${lc.recommendedLimit}万元` : '需财务数据'}</span>
          </div>
          <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
            最终批准额度取三法计算结果的最小值，再结合信用评分和风险等级进行最终调整。
          </div>
        </div>
      </div>
    </div>
  );
}

// 实体类型中文映射
const ENTITY_TYPE_LABELS: Record<string, string> = {
  ApplyingEnterprise: "申请企业",
  NaturalPerson: "自然人",
  RelatedEnterprise: "关联企业",
  BalanceSheetSnapshot: "资产负债表",
  IncomeStatementSnapshot: "利润表",
  CashFlowStatementSnapshot: "现金流量表",
  TaxRecord: "纳税记录",
  BankAccount: "银行账户",
  LoanApplication: "贷款申请",
  CreditAssessment: "信用评估",
};

// 属性字段中文映射
const PROP_LABELS: Record<string, string> = {
  companyName: "企业名称", uscc: "信用代码", legalPerson: "法定代表人",
  registeredCapital: "注册资本", establishDate: "成立日期", registeredAddress: "注册地址",
  businessScope: "经营范围", companyType: "企业类型", operatingStatus: "经营状态",
  taxCreditLevel: "纳税信用等级", isBlacklisted: "是否失信", industryCode: "行业代码",
  reportDate: "报告日期", totalAssets: "资产总计", totalLiabilities: "负债合计",
  totalEquity: "所有者权益", currentAssets: "流动资产", currentLiabilities: "流动负债",
  monetaryFunds: "货币资金", accountsReceivable: "应收账款", inventory: "存货",
  otherReceivables: "其他应收款", fixedAssets: "固定资产", shortTermLoans: "短期借款",
  longTermLoans: "长期借款", debtRatio: "资产负债率", currentRatio: "流动比率",
  revenue: "营业收入", costOfRevenue: "营业成本", grossProfit: "毛利润",
  sellingExpense: "销售费用", adminExpense: "管理费用", rdExpense: "研发费用",
  financialExpense: "财务费用", operatingProfit: "营业利润", netProfit: "净利润",
  ebitda: "EBITDA", grossMargin: "毛利率", netMargin: "净利率",
  operatingCashFlow: "经营现金流", investingCashFlow: "投资现金流", financingCashFlow: "筹资现金流",
  netCashFlow: "现金流净额", endingCashBalance: "期末现金余额",
  name: "姓名", role: "职务", idNumber: "身份证号", phone: "联系电话",
  shareholdingRatio: "持股比例", shareholdingAmount: "持股金额", investmentType: "出资方式",
  requestAmount: "申请金额", loanType: "贷款类型", loanPeriod: "贷款期限", loanPurpose: "贷款用途",
  score: "信用评分", creditGrade: "信用等级", scorePD: "违约概率",
  approvedAmount: "建议授信额度", recommendation: "授信建议",
};

// 实体颜色
const ENTITY_COLORS: Record<string, string> = {
  ApplyingEnterprise: "bg-orange-500",
  NaturalPerson: "bg-purple-500",
  RelatedEnterprise: "bg-blue-500",
  BalanceSheetSnapshot: "bg-green-500",
  IncomeStatementSnapshot: "bg-teal-500",
  CashFlowStatementSnapshot: "bg-cyan-500",
  TaxRecord: "bg-yellow-500",
  BankAccount: "bg-indigo-500",
  LoanApplication: "bg-red-500",
  CreditAssessment: "bg-pink-500",
};

// ─── 数据查询面板 ─────────────────────────────────────────────────────────────

export { FeaturesPanel, RulesPanel, ScorecardPanel, LimitPanel };
