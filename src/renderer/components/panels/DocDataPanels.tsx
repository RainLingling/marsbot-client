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
import type { UploadedFile, AppData, ParseStep, Top5Item, Top5YearData } from "./panelTypes";
import { DOC_CHECKLIST, DOC_PARSE_TYPE_MAP, guessDocType, formatFileSize, FileTypeIcon, getParseSteps } from "./panelTypes";
import {
  BALANCE_SHEET_INDICATORS, INCOME_STATEMENT_INDICATORS, CASH_FLOW_INDICATORS,
  BALANCE_SHEET_SECTIONS, INCOME_STATEMENT_SECTIONS, CASH_FLOW_SECTIONS,
  INDICATOR_BY_ID, LEGACY_FIELD_MAP,
} from "../../../../shared/financialStandards";

// 行业本体库标准分类（与 ConfirmPage 和 industryOntology 保持一致）
const INDUSTRY_OPTIONS = [
  "制造业",
  "批发零售",
  "建筑业",
  "科技",
  "农、林、牧、渔业",
  "餐饮住宿",
  "房地产",
  "交通运输、仓储和邮政业",
  "卫生和社会工作",
  "军工/国防科技",
  "综合",
];
const INDUSTRY_NAME_MAP: Record<string, string> = {
  "贸易": "批发零售", "批发和零售业": "批发零售",
  "批发业": "批发零售", "零售业": "批发零售",
  "零售": "批发零售", "贸易业": "批发零售",
  "进出口贸易": "批发零售",
  "建筑": "建筑业", "建筑工程": "建筑业",
  "农业": "农、林、牧、渔业", "农林牧渔": "农、林、牧、渔业",
  "服务业": "餐饮住宿", "餐饮": "餐饮住宿", "住宿": "餐饮住宿",
  "物流": "交通运输、仓储和邮政业", "运输": "交通运输、仓储和邮政业",
  "交通运输": "交通运输、仓储和邮政业", "仓储": "交通运输、仓储和邮政业",
  "医疗": "卫生和社会工作", "医疗健康": "卫生和社会工作",
  "卫生": "卫生和社会工作",
  "军工": "军工/国防科技", "国防": "军工/国防科技",
  "互联网": "科技", "软件": "科技", "信息技术": "科技",
};
function normalizeIndustry(raw: string | undefined): string {
  if (!raw) return "综合";
  if (INDUSTRY_OPTIONS.includes(raw)) return raw;
  return INDUSTRY_NAME_MAP[raw] ?? "综合";
}

function DocChecklistPanel({
  uploadedDocs,
  uploadedFiles,
  onFileUpload,
  onFileUploadForDoc,
  appData,
  onUpdateAppData,
  onRemoveFile,
  onRetryFile,
  onChangeFileDoc,
}: {
  uploadedDocs: Record<string, boolean>;
  uploadedFiles: UploadedFile[];
  onFileUpload: (files: FileList | File[]) => void;
  onFileUploadForDoc: (files: FileList | File[], docId: string, docName: string, parseType: string) => void;
  appData: AppData;
  onUpdateAppData: (patch: Partial<AppData>) => void;
  onRemoveFile?: (fileId: string, docId: string) => void;
  onRetryFile?: (fileId: string) => void;
  onChangeFileDoc?: (fileId: string, newDocId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 每个条目的独立上传输入引用
  const itemFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const categories = Array.from(new Set(DOC_CHECKLIST.map(d => d.category)));
  const uploadedCount = Object.values(uploadedDocs).filter(Boolean).length;
  const requiredCount = DOC_CHECKLIST.filter(d => d.required).length;
  const uploadedRequiredCount = DOC_CHECKLIST.filter(d => d.required && uploadedDocs[d.id]).length;

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">资料完整度</span>
          <span className="text-sm text-orange-600 font-bold">{uploadedCount}/{DOC_CHECKLIST.length}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
          <div
            className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(uploadedCount / DOC_CHECKLIST.length) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>必填项：{uploadedRequiredCount}/{requiredCount}</span>
          <span>{Math.round((uploadedCount / DOC_CHECKLIST.length) * 100)}% 完成</span>
        </div>
      </div>

      {/* 上传按钮 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-orange-200 text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition text-sm font-medium"
      >
        <Upload size={15} /> 点击上传文件（支持多选/压缩包）
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.zip,.rar,.7z"
        className="hidden"
        onChange={e => { if (e.target.files) onFileUpload(e.target.files); e.target.value = ""; }}
      />

      {/* 分类清单 */}
      {categories.map(cat => (
        <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cat}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {DOC_CHECKLIST.filter(d => d.category === cat).map(doc => {
              const uploaded = uploadedDocs[doc.id];
              const docFiles = uploadedFiles.filter(f => f.docId === doc.id);
              return (
                <div key={doc.id} className={`px-4 py-3 ${uploaded ? "bg-green-50/30" : ""}`}>
                  {/* 条目头部 */}
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      uploaded ? "bg-green-500" : doc.required ? "border-2 border-orange-300" : "border-2 border-gray-200"
                    }`}>
                      {uploaded && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${uploaded ? "text-green-700" : "text-gray-700"}`}>{doc.name}</span>
                        {doc.required && !uploaded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">必填</span>
                        )}
                      </div>
                      {docFiles.length === 0 && <div className="text-xs text-gray-400">{doc.desc}</div>}
                    </div>
                    {/* 每个条目独立上传按钮 */}
                    <input
                      type="file"
                      className="hidden"
                      ref={el => { itemFileInputRefs.current[doc.id] = el; }}
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          onFileUploadForDoc(e.target.files, doc.id, doc.name, DOC_PARSE_TYPE_MAP[doc.id] || "contract");
                          e.target.value = "";
                        }
                      }}
                    />
                    <button
                      onClick={() => itemFileInputRefs.current[doc.id]?.click()}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition border border-gray-200 hover:border-blue-200 flex-shrink-0"
                      title={`上传${doc.name}`}
                    >
                      <Upload size={10} />
                      <span>上传</span>
                    </button>
                  </div>
                  {/* 已上传文件列表（每个文件一行，支持删除/重试/更改类型） */}
                  {docFiles.length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {docFiles.map(f => (
                        <div key={f.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5 group">
                          <FileText size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={f.name}>{f.name}</span>
                          {/* 解析类型可更改下拉 */}
                          {onChangeFileDoc && f.status === "done" ? (
                            <select
                              value={f.docId}
                              onChange={e => onChangeFileDoc(f.id, e.target.value)}
                              className="text-[10px] border border-gray-200 rounded px-1 py-0.5 text-gray-600 bg-white max-w-[90px] cursor-pointer hover:border-orange-300 focus:outline-none focus:border-orange-400"
                              title="点击更改文件所属类型"
                            >
                              {DOC_CHECKLIST.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          ) : (
                            <div className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              f.status === "done" ? "bg-green-100 text-green-600" :
                              f.status === "error" ? "bg-red-100 text-red-500" :
                              "bg-blue-100 text-blue-500"
                            }`}>
                              {f.status === "done" ? "已解析" : f.status === "error" ? "失败" : "处理中"}
                            </div>
                          )}
                          {/* 上传失败时显示重试按钮 */}
                          {f.status === "error" && onRetryFile && (
                            <button
                              onClick={() => onRetryFile(f.id)}
                              className="flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-700 border border-orange-200 hover:border-orange-400 rounded px-1.5 py-0.5 flex-shrink-0 transition"
                              title="重新上传"
                            >
                              <RefreshCw size={9} />重试
                            </button>
                          )}
                          {f.url && f.status === "done" && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-blue-500 hover:text-blue-700 flex-shrink-0" title="查看">
                              <ExternalLink size={10} />
                            </a>
                          )}
                          {onRemoveFile && (
                            <button
                              onClick={() => onRemoveFile(f.id, doc.id)}
                              className="text-gray-300 hover:text-red-400 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {/* 其他已上传文件（docId 不在标准清单中的文件） */}
      {(() => {
        const knownDocIds = new Set(DOC_CHECKLIST.map(d => d.id));
        const otherFiles = uploadedFiles.filter(f => !knownDocIds.has(f.docId));
        if (otherFiles.length === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700">其他已上传文件</span>
              <span className="text-[10px] text-amber-500">{otherFiles.length} 个文件，可在下方更改类型</span>
            </div>
            <div className="divide-y divide-gray-50">
              {otherFiles.map(f => (
                <div key={f.id} className="flex items-center gap-2 px-4 py-2.5 group">
                  <FileText size={12} className="text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1 min-w-0" title={f.name}>{f.name}</span>
                  {onChangeFileDoc && f.status === 'done' ? (
                    <select
                      value={f.docId}
                      onChange={e => onChangeFileDoc(f.id, e.target.value)}
                      className="text-[10px] border border-gray-200 rounded px-1 py-0.5 text-gray-600 bg-white max-w-[110px] cursor-pointer hover:border-orange-300 focus:outline-none focus:border-orange-400"
                      title="点击更改文件所属类型"
                    >
                      {DOC_CHECKLIST.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : (
                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      f.status === 'done' ? 'bg-green-100 text-green-600' :
                      f.status === 'error' ? 'bg-red-100 text-red-500' :
                      'bg-blue-100 text-blue-500'
                    }`}>
                      {f.status === 'done' ? '已解析' : f.status === 'error' ? '失败' : '处理中'}
                    </div>
                  )}
                  {f.status === 'error' && onRetryFile && (
                    <button onClick={() => onRetryFile(f.id)} className="flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 flex-shrink-0 transition">
                      <RefreshCw size={9} />重试
                    </button>
                  )}
                  {onRemoveFile && (
                    <button onClick={() => onRemoveFile(f.id, f.docId)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {/* TOP5 甲方单位录入 */}
      <Top5EntryBlock
        title="TOP5 甲方单位"
        color="bg-blue-50"
        data={appData.top5Customers ?? []}
        onChange={d => onUpdateAppData({ top5Customers: d })}
      />
      {/* TOP5 供应商单位录入 */}
      <Top5EntryBlock
        title="TOP5 供应商单位"
        color="bg-green-50"
        data={appData.top5Suppliers ?? []}
        onChange={d => onUpdateAppData({ top5Suppliers: d })}
      />
    </div>
  );
}
// ─── TOP5 录入组件件 ─────────────────────────────────────────────────────────────────────────────────
function Top5EntryBlock({
  title, color, data, onChange,
}: {
  title: string;
  color: string; // tailwind bg class for header
  data: Top5YearData[];
  onChange: (newData: Top5YearData[]) => void;
}) {
  const curYear = new Date().getFullYear();
  const years = [curYear - 2, curYear - 1, curYear];
  const [activeYear, setActiveYear] = useState<number>(curYear);

  const yearData = data.find(d => d.year === activeYear);
  const items: Top5Item[] = yearData?.items ?? Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1, name: '', amount: '', ratio: '', notes: ''
  }));

  function updateItem(rank: number, field: keyof Top5Item, value: string) {
    const newItems = items.map(it => it.rank === rank ? { ...it, [field]: value } : it);
    const newData = data.filter(d => d.year !== activeYear);
    newData.push({ year: activeYear, items: newItems });
    onChange(newData);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${color}`}>
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-[10px] text-gray-400 ml-1">（近三年动态）</span>
        <div className="ml-auto flex gap-1">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setActiveYear(y)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                activeYear === y ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}
            >{y}年</button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-8">排名</th>
              <th className="px-3 py-1.5 text-left text-gray-500 font-medium">单位名称</th>
              <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-24">金额（万元）</th>
              <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-20">占比（%）</th>
              <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-28">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map(item => (
              <tr key={item.rank} className="hover:bg-gray-50/50">
                <td className="px-3 py-1.5 text-gray-400 font-medium text-center">{item.rank}</td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-300 text-xs"
                    placeholder="输入单位名称"
                    value={item.name}
                    onChange={e => updateItem(item.rank, 'name', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-300 text-xs"
                    placeholder="0.00"
                    value={item.amount}
                    onChange={e => updateItem(item.rank, 'amount', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-300 text-xs"
                    placeholder="0.0"
                    value={item.ratio}
                    onChange={e => updateItem(item.rank, 'ratio', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-300 text-xs"
                    placeholder="可选"
                    value={item.notes ?? ''}
                    onChange={e => updateItem(item.rank, 'notes', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
   );
}

function Top5DisplayBlock({
  title, color, data,
}: {
  title: string;
  color: string;
  data: Top5YearData[];
}) {
  const sortedYears = [...data].sort((a, b) => b.year - a.year);
  const [activeYear, setActiveYear] = useState<number>(sortedYears[0]?.year ?? new Date().getFullYear());
  const yearData = data.find(d => d.year === activeYear);
  const items = yearData?.items ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${color}`}>
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <div className="ml-auto flex gap-1">
          {sortedYears.map(yd => (
            <button
              key={yd.year}
              onClick={() => setActiveYear(yd.year)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                activeYear === yd.year ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
              }`}
            >{yd.year}年</button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-4 text-xs text-gray-300">暂无数据</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-8">排名</th>
                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">单位名称</th>
                <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-24">金额（万元）</th>
                <th className="px-3 py-1.5 text-left text-gray-500 font-medium w-20">占比（%）</th>
                <th className="px-3 py-1.5 text-left text-gray-500 font-medium">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.filter(it => it.name).map(item => (
                <tr key={item.rank}>
                  <td className="px-3 py-1.5 text-gray-400 text-center">{item.rank}</td>
                  <td className="px-3 py-1.5 text-gray-800 font-medium">{item.name}</td>
                  <td className="px-3 py-1.5 text-gray-600">{item.amount || '--'}</td>
                  <td className="px-3 py-1.5">
                    {item.ratio ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${Math.min(parseFloat(item.ratio) || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-600 text-[10px] w-8 text-right">{item.ratio}%</span>
                      </div>
                    ) : '--'}
                  </td>
                  <td className="px-3 py-1.5 text-gray-400">{item.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 财务报表英文 key → 中文标签映射表
const FINANCIAL_KEY_LABELS: Record<string, string> = {
  // 资产负债表 - 资产类
  reportDate: "报表日期", prevReportDate: "上期报表日期",
  monetaryFunds: "货币资金(本期)", prevMonetaryFunds: "货币资金(上期)",
  tradingFinancialAssets: "交易性金融资产(本期)",
  notesReceivable: "应收票据(本期)",
  accountsReceivable: "应收账款(本期)", prevAccountsReceivable: "应收账款(上期)",
  prepayments: "预付款项(本期)",
  otherReceivables: "其他应收款(本期)",
  inventory: "存货(本期)", prevInventory: "存货(上期)",
  contractAssets: "合同资产(本期)",
  currentAssets: "流动资产合计(本期)", prevCurrentAssets: "流动资产合计(上期)",
  longTermEquityInvestments: "长期股权投资(本期)",
  fixedAssets: "固定资产(本期)", prevFixedAssets: "固定资产(上期)",
  rightOfUseAssets: "使用权资产(本期)",
  intangibleAssets: "无形资产(本期)",
  goodwill: "商誉(本期)",
  deferredTaxAssets: "递延所得税资产(本期)",
  nonCurrentAssets: "非流动资产合计(本期)", prevNonCurrentAssets: "非流动资产合计(上期)",
  totalAssets: "资产总计(本期)", prevTotalAssets: "资产总计(上期)",
  // 资产负债表 - 负债类
  shortTermLoans: "短期借款(本期)", prevShortTermLoans: "短期借款(上期)",
  notesPayable: "应付票据(本期)",
  accountsPayable: "应付账款(本期)", prevAccountsPayable: "应付账款(上期)",
  taxesPayable: "应交税费(本期)",
  otherPayables: "其他应付款(本期)",
  currentLiabilities: "流动负债合计(本期)", prevCurrentLiabilities: "流动负债合计(上期)",
  longTermLoans: "长期借款(本期)", prevLongTermLoans: "长期借款(上期)",
  nonCurrentLiabilities: "非流动负债合计(本期)", prevNonCurrentLiabilities: "非流动负债合计(上期)",
  totalLiabilities: "负债合计(本期)", prevTotalLiabilities: "负债合计(上期)",
  // 资产负债表 - 所有者权益类
  paidInCapital: "实收资本(本期)",
  capitalReserve: "资本公积金(本期)",
  retainedEarnings: "未分配利润(本期)", prevRetainedEarnings: "未分配利润(上期)",
  ownersEquity: "所有者权益合计(本期)", prevOwnersEquity: "所有者权益合计(上期)",
  parentEquity: "归属母公司所有者权益(本期)",
  // 资产负债表 - 计算指标
  debtRatio: "资产负债率(%)", currentRatio: "流动比率", quickRatio: "速动比率",
  // 利润表
  reportPeriod: "报告期间", prevReportPeriod: "上期报告期间",
  revenue: "营业收入(本期)", prevRevenue: "营业收入(上期)",
  costOfRevenue: "营业成本(本期)", prevCostOfRevenue: "营业成本(上期)",
  grossProfit: "毛利润(本期)", grossMargin: "毛利率(%)",
  sellingExpenses: "销售费用(本期)", sellingExpense: "销售费用(本期)",
  adminExpenses: "管理费用(本期)", adminExpense: "管理费用(本期)",
  rdExpenses: "研发费用(本期)", rdExpense: "研发费用(本期)",
  financialExpenses: "财务费用(本期)", financialExpense: "财务费用(本期)",
  creditImpairment: "信用减値损失", assetImpairment: "资产减値损失",
  operatingProfit: "营业利润(本期)", prevOperatingProfit: "营业利润(上期)",
  totalProfit: "利润总额(本期)", incomeTax: "所得税费用(本期)",
  netProfit: "净利润(本期)", prevNetProfit: "净利润(上期)",
  parentNetProfit: "归母净利润(本期)", minorityNetProfit: "少数股东损益(本期)",
  netProfitMargin: "净利润率(%)", yearOnYearGrowth: "营收同比增长率(%)",
  roe: "净资产收益率ROE(%)", roa: "总资产收益率ROA(%)",
  ebitda: "EBITDA(本期)",
  // 现金流量表
  operatingCashInflow: "经营活动现金流入小计", operatingCashOutflow: "经营活动现金流出小计",
  operatingCashFlow: "经营活动现金流量净额(本期)", prevOperatingCashFlow: "经营活动现金流量净额(上期)",
  netOperatingCashFlow: "经营活动现金流量净额(本期)",
  investingCashFlow: "投资活动现金流量净额(本期)", prevInvestingCashFlow: "投资活动现金流量净额(上期)",
  financingCashFlow: "筹资活动现金流量净额(本期)", prevFinancingCashFlow: "筹资活动现金流量净额(上期)",
  netCashIncrease: "现金及现金等价物净增加额",
  endingCashBalance: "期末现金及现金等价物余额(本期)", prevEndingCashBalance: "期末现金余额(上期)",
  netCashFlow: "现金及现金等价物净增加额",
  cashFlowQuality: "现金流质量评价",
  treasuryStock: "库存股(本期)",
  surplusReserve: "盈余公积(本期)",
  minorityInterest: "少数股东权益(本期)",
  ebit: "EBIT(息税前利润)",
  interestExpense: "利息费用(本期)",
  totalExpenses: "营业总成本(本期)",
  operatingRevenue: "营业收入(本期)",
  prevOperatingRevenue: "营业收入(上期)",
  netIncome: "净利润(本期)",
  totalRevenue: "营业总收入(本期)",
  prevTotalRevenue: "营业总收入(上期)",
  netCashFromOperations: "经营活动现金流量净额(本期)",
  capitalExpenditure: "资本支出(本期)",
  freeCashFlow: "自由现金流(本期)",
  workingCapital: "营运资本(本期)",
  netWorkingCapital: "净营运资本(本期)",
  daysReceivable: "应收账款周转天数",
  daysInventory: "存货周转天数",
  daysPayable: "应付账款周转天数",
  assetTurnover: "总资产周转率",
  inventoryTurnover: "存货周转率",
  receivablesTurnover: "应收账款周转率",
  interestCoverage: "利息保障倍数",
  debtToEquity: "债务权益比",
  netDebt: "净负债(本期)",
  cashAndEquivalents: "现金及现金等价物(本期)",
  shortTermDebt: "短期债务(本期)",
  longTermDebt: "长期债务(本期)",
  totalDebt: "有息负债合计(本期)",
};

function FinancialTableSection({ title, data, color }: { title: string; data: Record<string, string | null>; color: string }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 ${color}`}>
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-xs text-gray-400 ml-auto">{entries.length} 项</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center px-4 py-2 gap-3">
            <span className="text-xs text-gray-500 flex-1 min-w-0">{FINANCIAL_KEY_LABELS[k] || k}</span>
            <span className="text-xs text-gray-800 font-medium text-right flex-shrink-0">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 数据核验面板（可编辑本体库）────────────────────────────────────────────────
function DataVerifyPanel({
  data,
  onUpdateAppData,
  hasAnalysis,
  onReanalyze,
}: {
  data: AppData;
  onUpdateAppData: (patch: Partial<AppData>) => void;
  hasAnalysis: boolean;
  onReanalyze: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [editingFsKey, setEditingFsKey] = useState<string | null>(null);
  const [editingFsValue, setEditingFsValue] = useState<string>("");
  const [showOnlyFilled, setShowOnlyFilled] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditingValue(value || "");
  };

  const commitEdit = (key: string, path: string[]) => {
    if (editingValue === (getNestedValue(data, path) ?? "")) {
      setEditingKey(null);
      return;
    }
    // 保存原始值
    if (!modifiedKeys.has(key)) {
      setOriginalValues(prev => ({ ...prev, [key]: getNestedValue(data, path) ?? "" }));
    }
    setModifiedKeys(prev => new Set(Array.from(prev).concat([key])));
    setHasUnsavedChanges(true);
    // 更新 appData
    applyNestedUpdate(path, editingValue);
    setEditingKey(null);
  };

  const resetField = (key: string, path: string[]) => {
    const orig = originalValues[key];
    if (orig !== undefined) {
      applyNestedUpdate(path, orig);
      setModifiedKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      if (modifiedKeys.size <= 1) setHasUnsavedChanges(false);
    }
  };

  const applyNestedUpdate = (path: string[], value: string) => {
    if (path.length === 1) {
      onUpdateAppData({ [path[0]]: value } as Partial<AppData>);
    } else if (path.length === 2) {
      const parent = (data as any)[path[0]] || {};
      onUpdateAppData({ [path[0]]: { ...parent, [path[1]]: value } } as Partial<AppData>);
    } else if (path.length === 3) {
      const grandParent = (data as any)[path[0]] || {};
      const parent = grandParent[path[1]] || {};
      onUpdateAppData({ [path[0]]: { ...grandParent, [path[1]]: { ...parent, [path[2]]: value } } } as Partial<AppData>);
    }
  };

  const getNestedValue = (obj: any, path: string[]): string => {
    let cur = obj;
    for (const k of path) { cur = cur?.[k]; }
    return cur != null ? String(cur) : "";
  };

  // 财务三张表行编辑
  const startFsEdit = (key: string, value: string) => {
    setEditingFsKey(key);
    setEditingFsValue(value || "");
  };

  const commitFsEdit = (year: string, tableKey: string, fieldKey: string) => {
    const fsYear = (data.financialStatementsByYear || {})[year];
    if (!fsYear) return;
    const table = (fsYear as any)[tableKey] || {};
    const newTable = { ...table, [fieldKey]: editingFsValue };
    const newFs = { ...fsYear, [tableKey]: newTable };
    const newFsByYear = { ...(data.financialStatementsByYear || {}), [year]: newFs };
    onUpdateAppData({ financialStatementsByYear: newFsByYear });
    const key = `fs_${year}_${tableKey}_${fieldKey}`;
    setModifiedKeys(prev => new Set(Array.from(prev).concat([key])));
    setHasUnsavedChanges(true);
    setEditingFsKey(null);
  };

  const hasData = Object.values(data).some(v => {
    if (!v) return false;
    if (typeof v === "string") return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  });

  const fsByYear = data.financialStatementsByYear || {};
  const years = Object.keys(fsByYear).sort((a, b) => b.localeCompare(a));
  const activeYear = selectedYear && fsByYear[selectedYear] ? selectedYear : years[0] || null;
  const activeYearData = activeYear ? fsByYear[activeYear] : null;
  const displayFs = activeYearData || data.financialStatements;

  // 可编辑字段定义
  const basicFields: Array<{ label: string; key: string; path: string[]; type?: "number" | "text" }> = [
    { label: "企业名称", key: "companyName", path: ["companyName"] },
    { label: "统一社会信用代码", key: "creditCode", path: ["creditCode"] },
    { label: "法定代表人", key: "legalPerson", path: ["legalPerson"] },
    { label: "注册资本（万元）", key: "registeredCapital", path: ["registeredCapital"] },
    { label: "成立日期", key: "establishDate", path: ["establishDate"] },
    { label: "所属行业", key: "industry", path: ["industry"] },
    { label: "企业类型", key: "companyType", path: ["companyType"] },
    { label: "注册地址", key: "address", path: ["address"] },
  ];
  const applyFields: Array<{ label: string; key: string; path: string[]; suffix?: string }> = [
    { label: "申请金额", key: "amount", path: ["amount"], suffix: "万元" },
    { label: "贷款类型", key: "loanType", path: ["loanType"] },
    { label: "贷款期限", key: "period", path: ["period"], suffix: "个月" },
    { label: "贷款用途", key: "purpose", path: ["purpose"] },
  ];
  // 从 financialStatementsByYear 中提取最新年度的财务摘要数据
  // 优先级：年报（ANNUAL）> 季报 > 月报 > 快捷字段
  // 检查最新年度数据是否标记了 sourceUnit（后端已按单位换算完毕）
  const latestYearSourceUnit = years.length > 0 ? (fsByYear[years[0]] as any)?.sourceUnit : undefined;
  const isDataAlreadyWanYuan = latestYearSourceUnit && latestYearSourceUnit !== '元'; // '万元'|'千元'|'百万元' 都已按对应系数换算完毕
  const toWanYuanDisplay = (val: string | number | null | undefined): string => {
    if (val == null || val === '') return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return String(val);
    // 如果后端已按单位换算完毕（sourceUnit 存在且不是元），跳过兆底换算
    if (isDataAlreadyWanYuan) return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    // 否则（PDF/图片路径）：超过500万的数值认为是元单位，换算为万元
    const wanVal = Math.abs(num) > 5000000 ? num / 10000 : num;
    return wanVal.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  // 从三张表中查找指定字段的值（支持标准ID和英文字段名）
  const getFinFieldFromFsByYear = (stdIds: string[], legacyKeys: string[]): string => {
    // 按年份降序排序，优先取最新年度
    const sortedYears = Object.keys(fsByYear).sort((a, b) => b.localeCompare(a));
    for (const yr of sortedYears) {
      const fs = fsByYear[yr];
      if (!fs) continue;
      const tables = [fs.balanceSheet, fs.incomeStatement, fs.cashFlowStatement].filter(Boolean);
      for (const table of tables) {
        if (!table) continue;
        // 先查标准ID
        for (const sid of stdIds) {
          if (table[sid] != null && table[sid] !== '') return String(table[sid]);
        }
        // 再查英文字段名（通过 LEGACY_FIELD_MAP 反向查找）
        for (const lk of legacyKeys) {
          if (table[lk] != null && table[lk] !== '') return String(table[lk]);
          // 也查 LEGACY_FIELD_MAP 映射后的值
          const mappedId = LEGACY_FIELD_MAP[lk];
          if (mappedId && table[mappedId] != null && table[mappedId] !== '') return String(table[mappedId]);
        }
      }
    }
    return '';
  };

  // 财务摘要快捷字段：优先从三张表读取，回退到快捷字段
  const getFinSummaryValue = (quickPath: string[], stdIds: string[], legacyKeys: string[]): string => {
    // 先从三张表读取
    const fromFs = getFinFieldFromFsByYear(stdIds, legacyKeys);
    if (fromFs) return fromFs;
    // 回退到快捷字段
    return getNestedValue(data, quickPath);
  };

  const finFields: Array<{ label: string; key: string; path: string[]; suffix?: string; stdIds?: string[]; legacyKeys?: string[] }> = [
    { label: "年营业收入", key: "revenue", path: ["revenue"], suffix: "万元", stdIds: ['is_001'], legacyKeys: ['revenue', '营业收入', '营业总收入'] },
    { label: "净利润", key: "netProfit", path: ["netProfit"], suffix: "万元", stdIds: ['is_020', 'is_021', 'is_022'], legacyKeys: ['netProfit', 'netIncome', '净利润', '净利润（亏损）', '六、净利润', '五、净利润', '四、净利润'] },
    { label: "总资产", key: "totalAssets", path: ["totalAssets"], suffix: "万元", stdIds: ['bs_037'], legacyKeys: ['totalAssets', '资产总计', '资产合计'] },
    { label: "总负债", key: "totalLiabilities", path: ["totalLiabilities"], suffix: "万元", stdIds: ['bs_064'], legacyKeys: ['totalLiabilities', '负债合计', '负债总计'] },
    { label: "所有者权益", key: "ownersEquity", path: ["ownersEquity"], suffix: "万元", stdIds: ['bs_075'], legacyKeys: ['ownersEquity', '所有者权益合计', '股东权益合计'] },
    { label: "经营现金流", key: "operatingCashFlow", path: ["operatingCashFlow"], suffix: "万元", stdIds: ['cf_010'], legacyKeys: ['operatingCashFlow', 'netOperatingCashFlow', '经营活动产生的现金流量净额', '一、经营活动产生的现金流量净额', '经营活动现金流量净额'] },
  ];

  const renderEditableField = (
    label: string,
    key: string,
    path: string[],
    suffix?: string,
    placeholder?: string
  ) => {
    const rawVal = getNestedValue(data, path);
    const isEditing = editingKey === key;
    const isModified = modifiedKeys.has(key);
    const displayVal = rawVal ? (suffix ? `${rawVal}${suffix}` : rawVal) : "";

    return (
      <div key={key} className="flex items-center px-4 py-2.5 gap-3 group">
        <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-1.5 flex-1">
            {key === "industry" ? (
              <select
                autoFocus
                value={editingValue}
                onChange={e => {
                  setEditingValue(e.target.value);
                  // 直接提交，不需要点确认按钮
                  const newVal = e.target.value;
                  if (newVal !== (getNestedValue(data, path) ?? "")) {
                    if (!modifiedKeys.has(key)) {
                      setOriginalValues(prev => ({ ...prev, [key]: getNestedValue(data, path) ?? "" }));
                    }
                    setModifiedKeys(prev => new Set(Array.from(prev).concat([key])));
                    setHasUnsavedChanges(true);
                    applyNestedUpdate(path, newVal);
                  }
                  setEditingKey(null);
                }}
                className="flex-1 text-sm text-gray-800 font-medium border border-orange-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50"
              >
                {INDUSTRY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                autoFocus
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") commitEdit(key, path);
                  if (e.key === "Escape") setEditingKey(null);
                }}
                onBlur={() => commitEdit(key, path)}
                className="flex-1 text-sm text-gray-800 font-medium border border-orange-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50"
                placeholder={placeholder || label}
              />
            )}
            {key !== "industry" && <button onClick={() => commitEdit(key, path)} className="text-green-600 hover:text-green-700 text-xs px-1">✓</button>}
            <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isModified ? "text-orange-600" : "text-gray-800"}`}>
              {displayVal || <span className="text-gray-300 text-xs italic">未填写</span>}
            </span>
            {isModified && (
              <span className="text-[10px] text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                ✏️ 已修正
              </span>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => startEdit(key, rawVal)}
                className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition"
                title="编辑"
              >
                <Pencil size={11} />
              </button>
              {isModified && (
                <button
                  onClick={() => resetField(key, path)}
                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                  title="重置为AI解析值"
                >
                  <RefreshCw size={11} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFsTable = (tableData: Record<string, string | null>, tableKey: string, title: string, colorClass: string) => {
    const indicators = tableKey === 'balanceSheet' ? BALANCE_SHEET_INDICATORS
      : tableKey === 'incomeStatement' ? INCOME_STATEMENT_INDICATORS
      : CASH_FLOW_INDICATORS;
    const sections = tableKey === 'balanceSheet' ? BALANCE_SHEET_SECTIONS
      : tableKey === 'incomeStatement' ? INCOME_STATEMENT_SECTIONS
      : CASH_FLOW_SECTIONS;

    const stdValueMap: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(tableData)) {
      if (k === 'reportPeriod' || k === 'reportDate' || k === 'prevReportDate' || k === 'prevReportPeriod') continue;
      if (INDICATOR_BY_ID[k]) {
        if (stdValueMap[k] == null || v != null) stdValueMap[k] = v;
      } else if (LEGACY_FIELD_MAP[k]) {
        const stdId = LEGACY_FIELD_MAP[k];
        if (stdValueMap[stdId] == null || v != null) stdValueMap[stdId] = v;
      } else {
        stdValueMap[`_raw_${k}`] = v;
      }
    }

    const filledCount = indicators.filter(ind => stdValueMap[ind.id] != null && stdValueMap[ind.id] !== '').length;
    const totalCount = indicators.length;

    const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
      'bg-blue-50': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-600' },
      'bg-green-50': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-600' },
      'bg-purple-50': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-600' },
    };
    const colors = colorMap[colorClass] || colorMap['bg-blue-50'];

    return (
      <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
        <div className={`flex items-center gap-2 px-4 py-2.5 ${colors.bg} border-b ${colors.border}`}>
          <FileText size={13} className={colors.text} />
          <span className={`text-xs font-semibold ${colors.text}`}>{title}</span>
          <span className={`ml-auto text-[10px] ${colors.badge} px-1.5 py-0.5 rounded-full`}>
            {filledCount}/{totalCount} 项已填入
          </span>
          <span className="text-[10px] text-gray-400 ml-1">点击数值可编辑</span>
        </div>
        <div className="divide-y divide-gray-100">
          {(sections as readonly { key: string; label: string; color: string }[]).map(sec => {
            const secIndicators = indicators.filter(ind => ind.section === sec.key);
            return (
              <div key={sec.key}>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{sec.label}</span>
                  <span className="text-[9px] text-gray-400">
                    ({secIndicators.filter(ind => stdValueMap[ind.id] != null && stdValueMap[ind.id] !== '').length}/{secIndicators.length})
                  </span>
                </div>
                {secIndicators.filter(ind => !showOnlyFilled || (stdValueMap[ind.id] != null && stdValueMap[ind.id] !== '')).map(ind => {
                  const fsKey = `fs_${activeYear}_${tableKey}_${ind.id}`;
                  const v = stdValueMap[ind.id] ?? null;
                  const isEditing = editingFsKey === fsKey;
                  const isModified = modifiedKeys.has(fsKey);
                  return (
                    <div
                      key={ind.id}
                      className={`flex items-center px-4 py-1.5 gap-3 group hover:bg-gray-50 transition ${ind.isSubtotal ? 'bg-gray-50/80' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs ${ind.isSubtotal ? 'font-semibold text-gray-700' : 'text-gray-500'} truncate`}>
                          {ind.name}
                        </span>
                        <span className="ml-1.5 text-[9px] text-gray-300">{ind.id}</span>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <input
                            autoFocus
                            value={editingFsValue}
                            onChange={e => setEditingFsValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") commitFsEdit(activeYear!, tableKey, ind.id);
                              if (e.key === "Escape") setEditingFsKey(null);
                            }}
                            onBlur={() => commitFsEdit(activeYear!, tableKey, ind.id)}
                            className="w-28 text-xs text-right border border-orange-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50"
                            placeholder="万元"
                          />
                          <button onClick={() => commitFsEdit(activeYear!, tableKey, ind.id)} className="text-green-600 text-xs">✓</button>
                          <button onClick={() => setEditingFsKey(null)} className="text-gray-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span
                            className={`text-xs font-medium cursor-pointer hover:text-orange-500 transition min-w-[60px] text-right ${
                              isModified ? "text-orange-600" : v != null && v !== "" ? (ind.isSubtotal ? "text-gray-800" : "text-gray-600") : "text-gray-200"
                            }`}
                            onClick={() => startFsEdit(fsKey, v || "")}
                          >
                            {v != null && v !== "" ? v : <span className="italic">—</span>}
                          </span>
                          {isModified && <span className="text-[9px] text-orange-500">✏</span>}
                          <button
                            onClick={() => startFsEdit(fsKey, v || "")}
                            className="p-0.5 text-gray-200 hover:text-orange-400 transition opacity-0 group-hover:opacity-100"
                          >
                            <Pencil size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {Object.entries(stdValueMap).filter(([k]) => k.startsWith('_raw_') && stdValueMap[k] != null).length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-50 border-b border-yellow-100">
                <span className="text-[10px] font-semibold text-yellow-600">其他字段（未匹配标准指标）</span>
              </div>
              {Object.entries(stdValueMap)
                .filter(([k]) => k.startsWith('_raw_') && stdValueMap[k] != null)
                .map(([k, v]) => {
                  const rawKey = k.replace('_raw_', '');
                  const fsKey = `fs_${activeYear}_${tableKey}_${rawKey}`;
                  const isEditing = editingFsKey === fsKey;
                  return (
                    <div key={k} className="flex items-center px-4 py-1.5 gap-3 group hover:bg-gray-50">
                      <span className="text-xs text-yellow-600 flex-1 min-w-0 truncate">{rawKey}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editingFsValue}
                            onChange={e => setEditingFsValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") commitFsEdit(activeYear!, tableKey, rawKey);
                              if (e.key === "Escape") setEditingFsKey(null);
                            }}
                            onBlur={() => commitFsEdit(activeYear!, tableKey, rawKey)}
                            className="w-28 text-xs text-right border border-orange-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50"
                          />
                          <button onClick={() => commitFsEdit(activeYear!, tableKey, rawKey)} className="text-green-600 text-xs">✓</button>
                          <button onClick={() => setEditingFsKey(null)} className="text-gray-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span
                            className="text-xs font-medium text-gray-500 cursor-pointer hover:text-orange-500"
                            onClick={() => startFsEdit(fsKey, v || "")}
                          >
                            {v != null && v !== "" ? v : <span className="text-gray-200 italic">—</span>}
                          </span>
                          <button onClick={() => startFsEdit(fsKey, v || "")} className="p-0.5 text-gray-200 hover:text-orange-400 opacity-0 group-hover:opacity-100">
                            <Pencil size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <Info size={32} className="mb-3 opacity-30" />
        <div className="text-sm">尚未录入企业数据</div>
        <div className="text-xs mt-1">请在左侧输入企业名称或上传文件</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 修改提示条 */}
      {hasUnsavedChanges && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-orange-700">数据已修改（{modifiedKeys.size} 个字段），分析结果可能已过期</span>
          </div>
          <button
            onClick={() => { setHasUnsavedChanges(false); onReanalyze(); }}
            className="flex-shrink-0 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition font-medium"
          >
            重新分析
          </button>
        </div>
      )}

      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-start gap-2">
        <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-blue-600">AI 解析结果仅供参考，如有偏差请直接点击字段修改。修改后的数据将用于所有后续分析。</span>
      </div>

      {/* 工商基本信息 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <Building2 size={14} className="text-blue-500" />
          <span className="text-xs font-semibold text-gray-600">工商基本信息</span>
        </div>
        <div className="divide-y divide-gray-50">
          {basicFields.map(f => renderEditableField(f.label, f.key, f.path))}
        </div>
      </div>

      {/* 申请信息 */}
      {(data.amount || data.loanType || data.period || data.purpose) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <DollarSign size={14} className="text-orange-500" />
            <span className="text-xs font-semibold text-gray-600">申请信息</span>
          </div>
          <div className="divide-y divide-gray-50">
            {applyFields.map(f => renderEditableField(f.label, f.key, f.path, f.suffix))}
          </div>
        </div>
      )}

      {/* 财务摘要 */}
      {(() => {
        // 财务摘要显示条件：快捷字段有値，或 financialStatementsByYear 中有数据
        const hasFsYearData = Object.keys(data.financialStatementsByYear || {}).length > 0;
        const hasQuickFields = !!(data.revenue || data.netProfit || data.totalAssets);
        const sortedYears = Object.keys(data.financialStatementsByYear || {}).sort((a, b) => b.localeCompare(a));
        if (!(hasQuickFields || hasFsYearData)) return null;
        return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <BarChart3 size={14} className="text-green-500" />
            <span className="text-xs font-semibold text-gray-600">财务数据摘要</span>
            <span className="ml-auto text-[10px] text-gray-400">来自{sortedYears[0] ? `${sortedYears[0]}年财报` : '最新财报'}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {finFields.map(f => {
              // 财务摘要字段：优先从三张表读取，回退到快捷字段，并做单位换算
              const rawVal = getFinSummaryValue(f.path, f.stdIds || [], f.legacyKeys || []);
              const displayNum = toWanYuanDisplay(rawVal);
              const displayVal = displayNum ? `${displayNum}${f.suffix || ''}` : '';
              const isModified = modifiedKeys.has(f.key);
              const isEditing = editingKey === f.key;
              return (
                <div key={f.key} className="flex items-center px-4 py-2.5 gap-3 group">
                  <span className="text-xs text-gray-400 w-28 flex-shrink-0">{f.label}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(f.key, f.path);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                        onBlur={() => commitEdit(f.key, f.path)}
                        className="flex-1 text-sm text-gray-800 font-medium border border-orange-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50"
                        placeholder={f.label}
                      />
                      <button onClick={() => commitEdit(f.key, f.path)} className="text-green-600 hover:text-green-700 text-xs px-1">✓</button>
                      <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isModified ? 'text-orange-600' : 'text-gray-800'}`}>
                        {displayVal || <span className="text-gray-300 text-xs italic">未填写</span>}
                      </span>
                      {isModified && (
                        <span className="text-[10px] text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          ✏️ 已修正
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(f.key, rawVal)}
                        className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition flex-shrink-0"
                        title="编辑"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {data.financialSummary && (
            <div className="px-4 py-3 bg-green-50 border-t border-green-100">
              <div className="text-[10px] text-green-700 font-semibold mb-1">AI 财务综合评价</div>
              <p className="text-[10px] text-green-800 leading-relaxed">{data.financialSummary}</p>
            </div>
          )}
        </div>
        );
      })()}

      {/* 甲方信息（保理专用） */}
      {data.counterpartyInfo && data.counterpartyInfo.name && (
        <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <Building2 size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">甲方（债务人）信息</span>
            <span className="ml-auto text-[10px] text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">保理专用</span>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { label: "甲方企业名称", key: "cp_name", path: ["counterpartyInfo", "name"] },
              { label: "统一社会信用代码", key: "cp_creditCode", path: ["counterpartyInfo", "creditCode"] },
              { label: "合同金额（万元）", key: "cp_contractAmount", path: ["counterpartyInfo", "contractAmount"] },
              { label: "历史回款金额（万元）", key: "cp_historicalRepayment", path: ["counterpartyInfo", "historicalRepaymentAmount"] },
            ].map(f => renderEditableField(f.label, f.key, f.path))}
          </div>
        </div>
      )}

      {/* 财务三张表完整数据 */}
      <div>
        <div className="flex items-center gap-2 pt-2 mb-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">财务报表完整数据（AI 解析，可逐行修正）</span>
          <button
            onClick={() => setShowOnlyFilled(v => !v)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition ${
              showOnlyFilled
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-500'
            }`}
            title="切换只显示有值的指标"
          >
            <Activity size={10} />
            {showOnlyFilled ? '显示全部' : '只显有值'}
          </button>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        {years.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {years.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeYear === yr ? "bg-orange-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {yr}年
                {fsByYear[yr]?.reportPeriod && fsByYear[yr].reportPeriod !== yr && (
                  <span className="ml-1 opacity-70 text-[10px]">· {fsByYear[yr].reportPeriod}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {displayFs ? (
          <div className="space-y-3">
            {displayFs.balanceSheet && renderFsTable(
              displayFs.balanceSheet as Record<string, string | null>,
              "balanceSheet",
              `资产负债表${activeYear ? ` (${activeYear}年)` : ""}`,
              "bg-blue-50"
            )}
            {displayFs.incomeStatement && renderFsTable(
              displayFs.incomeStatement as Record<string, string | null>,
              "incomeStatement",
              `利润表${activeYear ? ` (${activeYear}年)` : ""}`,
              "bg-green-50"
            )}
            {displayFs.cashFlowStatement && renderFsTable(
              displayFs.cashFlowStatement as Record<string, string | null>,
              "cashFlowStatement",
              `现金流量表${activeYear ? ` (${activeYear}年)` : ""}`,
              "bg-purple-50"
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FileText size={24} className="mb-2 opacity-30" />
            <div className="text-sm">请上传财务报告</div>
            <div className="text-xs mt-1">支持年报、审计报告等 PDF 文件，AI 将自动解析三张表</div>
          </div>
        )}
      </div>

      {/* 审计报告信息 */}
      {data.auditReport && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <FileText size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-700">审计报告</span>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { label: "报告年度", key: "ar_year", path: ["auditReport", "reportYear"] },
              { label: "审计意见", key: "ar_opinion", path: ["auditReport", "auditOpinion"] },
              { label: "审计机构", key: "ar_firm", path: ["auditReport", "auditFirm"] },
              { label: "审计日期", key: "ar_date", path: ["auditReport", "auditDate"] },
            ].map(f => renderEditableField(f.label, f.key, f.path))}
          </div>
        </div>
      )}

      {/* 银行流水总 */}
      {(data.bankFlowSummary || data.bankData) && (
        <div className="bg-white rounded-xl border border-cyan-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 border-b border-cyan-100">
            <DollarSign size={14} className="text-cyan-500" />
            <span className="text-xs font-semibold text-cyan-700">银行流水汇总</span>
            <span className="ml-auto text-[10px] text-cyan-400 bg-cyan-100 px-1.5 py-0.5 rounded-full">来源：银行流水解析</span>
          </div>
          <div className="p-4">
            {(() => {
              const bf = data.bankFlowSummary;
              const bd = data.bankData as Record<string, unknown> | undefined;
              const totalInflow = bf?.totalInflow ?? (bd?.totalInflow != null ? Number(bd.totalInflow) : undefined);
              const totalOutflow = bf?.totalOutflow ?? (bd?.totalOutflow != null ? Number(bd.totalOutflow) : undefined);
              const netCashFlow = bf?.netCashFlow ?? (totalInflow != null && totalOutflow != null ? totalInflow - totalOutflow : undefined);
              const monthlyAvg = bd?.monthlyAvgIncome != null ? Number(bd.monthlyAvgIncome) : (totalInflow != null && bf?.monthlyData && bf.monthlyData.length > 0 ? totalInflow / bf.monthlyData.length : undefined);
              const items = [
                { label: '总流入（万元）', value: totalInflow != null ? totalInflow.toLocaleString() : null },
                { label: '总流出（万元）', value: totalOutflow != null ? totalOutflow.toLocaleString() : null },
                { label: '净现金流（万元）', value: netCashFlow != null ? netCashFlow.toLocaleString() : null },
                { label: '月均流入（万元）', value: monthlyAvg != null ? monthlyAvg.toFixed(2) : null },
              ];
              return (
                <div className="grid grid-cols-2 gap-3">
                  {items.map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                      <div className={`text-sm font-semibold ${item.value ? 'text-gray-800' : 'text-gray-300'}`}>{item.value ?? '—'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {data.bankFlowSummary?.monthlyData && data.bankFlowSummary.monthlyData.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-medium text-gray-500 mb-2">月度明细</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 text-left text-gray-500 font-medium">月份</th>
                        <th className="px-2 py-1 text-right text-gray-500 font-medium">流入</th>
                        <th className="px-2 py-1 text-right text-gray-500 font-medium">流出</th>
                        <th className="px-2 py-1 text-right text-gray-500 font-medium">余额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.bankFlowSummary.monthlyData.slice(0, 12).map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-2 py-1 text-gray-700">{m.month ?? '—'}</td>
                          <td className="px-2 py-1 text-right text-green-600">{m.inflow != null ? m.inflow.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right text-red-500">{m.outflow != null ? m.outflow.toLocaleString() : '—'}</td>
                          <td className="px-2 py-1 text-right text-gray-700">{m.balance != null ? m.balance.toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 税务数据 - 按年份分组显示 */}
      {(data.taxData || data.taxDataByType || data.taxDataByYear) && (
        <div className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border-b border-yellow-100">
            <FileText size={14} className="text-yellow-600" />
            <span className="text-xs font-semibold text-yellow-700">税务数据</span>
            {data.taxDataByYear && Object.keys(data.taxDataByYear).length > 1 && (
              <span className="ml-1 text-[10px] text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">{Object.keys(data.taxDataByYear).length}年</span>
            )}
            <span className="ml-auto text-[10px] text-yellow-500 bg-yellow-100 px-1.5 py-0.5 rounded-full">来源：纳税证明/申报表解析</span>
          </div>
          <div className="p-4 space-y-4">
            {(() => {
              // 优先用 taxDataByYear（多年并排），如果没有则展开 taxDataByType
              const byYear = data.taxDataByYear;
              const td = data.taxDataByType || {};
              const legacy = data.taxData as Record<string, unknown> | undefined;

              // 构建年份列表：优先用 taxDataByYear，如果为空则展开旧结构
              const yearEntries: Array<{ year: string; vat?: Record<string, unknown>; income?: Record<string, unknown>; clearance?: Record<string, unknown>; credit?: Record<string, unknown> }> = [];
              if (byYear && Object.keys(byYear).length > 0) {
                Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a)).forEach(([yr, d]) => yearEntries.push({ year: yr, ...d }));
              } else {
                // 展开旧结构为单年
                const vatData = (td.vat || (legacy && (legacy as any).taxType === 'vat' ? legacy : null)) as Record<string, unknown> | undefined;
                const incomeData = (td.income || (legacy && (legacy as any).taxType === 'income' ? legacy : null)) as Record<string, unknown> | undefined;
                const clearanceData = (td.clearance || (legacy && (legacy as any).taxType === 'clearance' ? legacy : null)) as Record<string, unknown> | undefined;
                const creditData = (td.credit || (legacy && (legacy as any).taxType === 'credit' ? legacy : null)) as Record<string, unknown> | undefined;
                const yr = String((vatData || incomeData || clearanceData || creditData || legacy as any || {}).taxYear || (vatData || incomeData || clearanceData || creditData || legacy as any || {}).year || '未知年份');
                yearEntries.push({ year: yr, vat: vatData, income: incomeData, clearance: clearanceData, credit: creditData });
              }

              const renderTaxSection = (typeKey: string, d: Record<string, unknown> | undefined, yr: string) => {
                if (!d) return null;
                const configs: Record<string, { title: string; color: string; fields: Array<{ label: string; val: string }> }> = {
                  vat: { title: '增值税', color: 'bg-orange-50 border-orange-100', fields: [
                    { label: '应税收入（万元）', val: String((d as any).taxableRevenue ?? (d as any).revenue ?? '—') },
                    { label: '应纳税额（万元）', val: String((d as any).taxPayable ?? (d as any).vatPayable ?? '—') },
                    { label: '实缴税额（万元）', val: String((d as any).taxPaid ?? (d as any).vatPaid ?? '—') },
                    { label: '税率', val: (d as any).taxRate ? `${(d as any).taxRate}%` : '—' },
                  ]},
                  income: { title: '企业所得税', color: 'bg-blue-50 border-blue-100', fields: [
                    { label: '应纳税所得额（万元）', val: String((d as any).taxableIncome ?? '—') },
                    { label: '应纳税额（万元）', val: String((d as any).taxPayable ?? '—') },
                    { label: '实缴税额（万元）', val: String((d as any).taxPaid ?? '—') },
                  ]},
                  clearance: { title: '完税证明', color: 'bg-green-50 border-green-100', fields: [
                    { label: '税款总额（万元）', val: String((d as any).totalTaxAmount ?? (d as any).taxPaid ?? '—') },
                    { label: '税务机关', val: String((d as any).taxAuthority ?? (d as any).issuingAuthority ?? '—') },
                    { label: '开具日期', val: String((d as any).issueDate ?? (d as any).issuedDate ?? '—') },
                  ]},
                  credit: { title: '纳税信用等级', color: 'bg-purple-50 border-purple-100', fields: [
                    { label: '信用等级', val: String((d as any).creditLevel ?? (d as any).rating ?? '—') },
                    { label: '评定机关', val: String((d as any).taxAuthority ?? '—') },
                  ]},
                };
                const cfg = configs[typeKey];
                if (!cfg) return null;
                return (
                  <div key={`${yr}-${typeKey}`} className={`rounded-lg border p-3 ${cfg.color}`}>
                    <div className="text-xs font-semibold text-gray-700 mb-2">{cfg.title}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {cfg.fields.map(f => (
                        <div key={f.label} className="bg-white/70 rounded px-2 py-1">
                          <div className="text-[10px] text-gray-400">{f.label}</div>
                          <div className="text-xs font-medium text-gray-800">{f.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {yearEntries.map(entry => (
                    <div key={entry.year}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{entry.year}年度</span>
                        <div className="flex-1 h-px bg-yellow-100" />
                      </div>
                      <div className="space-y-2">
                        {renderTaxSection('vat', entry.vat, entry.year)}
                        {renderTaxSection('income', entry.income, entry.year)}
                        {renderTaxSection('clearance', entry.clearance, entry.year)}
                        {renderTaxSection('credit', entry.credit, entry.year)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* 前五大客户及供应商 */}
      {(data.top5Customers && data.top5Customers.length > 0 || data.top5Suppliers && data.top5Suppliers.length > 0) && (
        <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
            <TrendingUp size={14} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">前五大客户及供应商</span>
            <span className="ml-auto text-[10px] text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded-full">来源：客户/供应商清单解析</span>
          </div>
          <div className="p-4 space-y-4">
            {data.top5Customers && data.top5Customers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2">前五大客户</div>
                {data.top5Customers.map((yearData, yi) => (
                  <div key={yi} className="mb-3">
                    <div className="text-[10px] text-indigo-500 font-medium mb-1">{yearData.year}年</div>
                    <div className="space-y-1">
                      {yearData.items.map((item, ii) => (
                        <div key={ii} className="flex items-center gap-2 text-xs">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{ii + 1}</span>
                          <span className="flex-1 text-gray-700 truncate">{item.name}</span>
                          {item.amount != null && <span className="text-gray-500 flex-shrink-0">{item.amount.toLocaleString()}万</span>}
                          {item.ratio != null && <span className="text-indigo-600 flex-shrink-0">{item.ratio}%</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.top5Suppliers && data.top5Suppliers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-2">前五大供应商</div>
                {data.top5Suppliers.map((yearData, yi) => (
                  <div key={yi} className="mb-3">
                    <div className="text-[10px] text-indigo-500 font-medium mb-1">{yearData.year}年</div>
                    <div className="space-y-1">
                      {yearData.items.map((item, ii) => (
                        <div key={ii} className="flex items-center gap-2 text-xs">
                          <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{ii + 1}</span>
                          <span className="flex-1 text-gray-700 truncate">{item.name}</span>
                          {item.amount != null && <span className="text-gray-500 flex-shrink-0">{item.amount.toLocaleString()}万</span>}
                          {item.ratio != null && <span className="text-orange-600 flex-shrink-0">{item.ratio}%</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* 营收构成 */}
      {data.businessSegments && data.businessSegments.length > 0 && (
        <div className="bg-white rounded-xl border border-teal-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 border-b border-teal-100">
            <Package size={14} className="text-teal-500" />
            <span className="text-xs font-semibold text-teal-700">营收构成</span>
            <span className="ml-auto text-[10px] text-teal-400 bg-teal-100 px-1.5 py-0.5 rounded-full">来源：营收构成表解析</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">年份</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">业务板块</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">营业收入（万元）</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">占比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.businessSegments.map((seg, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{seg.year ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-800 font-medium">{seg.segmentName ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{seg.revenue != null ? seg.revenue.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {seg.revenueRatio != null ? (
                        <span className="text-teal-600 font-medium">{seg.revenueRatio}%</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* 他行授信 */}
      {data.creditFacilities && data.creditFacilities.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border-b border-purple-100">
            <Building2 size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-700">他行授信</span>
            <span className="ml-auto text-[10px] text-purple-400 bg-purple-100 px-1.5 py-0.5 rounded-full">{data.creditFacilities.length} 条记录</span>
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
                {data.creditFacilities.map((cf, i) => (
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
                    {data.creditFacilities.reduce((s, cf) => s + (cf.creditAmount ?? 0), 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-600">
                    {data.creditFacilities.reduce((s, cf) => s + (cf.outstandingBalance ?? 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {/* 高管信息 */}
      {data.keyExecutives && data.keyExecutives.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <User size={14} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">高管信息</span>
            <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{data.keyExecutives.length} 人</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.keyExecutives.map((exec, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-800">{exec.name ?? '—'}</span>
                  {exec.position && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{exec.position}</span>}
                  {exec.gender && <span className="text-[10px] text-gray-400">{exec.gender}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  {exec.birthDate && <span>出生：{exec.birthDate}</span>}
                  {exec.education && <span>学历：{exec.education}</span>}
                  {exec.phone && <span>联系：{exec.phone}</span>}
                </div>
                {exec.workExperience && (
                  <div className="mt-1 text-xs text-gray-400 line-clamp-2">{exec.workExperience}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 资质证书 */}
      {data.qualifications && data.qualifications.length > 0 && (
        <div className="bg-white rounded-xl border border-teal-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 border-b border-teal-100">
            <CheckCircle2 size={14} className="text-teal-500" />
            <span className="text-xs font-semibold text-teal-700">资质证书</span>
            <span className="ml-auto text-[10px] text-teal-400 bg-teal-100 px-1.5 py-0.5 rounded-full">{data.qualifications.length} 项</span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.qualifications.map((q, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{q.certName ?? '—'}</div>
                    {q.certNumber && <div className="text-[10px] text-gray-400 mt-0.5">证书编号：{q.certNumber}</div>}
                  </div>
                  {q.certType && <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full flex-shrink-0">{q.certType}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 mt-1 text-xs text-gray-500">
                  {q.issueDate && <span>发证：{q.issueDate}</span>}
                  {q.expiryDate && <span>到期：{q.expiryDate}</span>}
                  {q.issuingAuthority && <span className="col-span-2">发证机关：{q.issuingAuthority}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 公司介绍 */}
      {data.companyProfile && (data.companyProfile.companyIntro || (data.companyProfile.mainProducts && data.companyProfile.mainProducts.length > 0)) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <Building2 size={14} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">公司介绍</span>
          </div>
          <div className="p-4 space-y-3">
            {data.companyProfile.companyIntro && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">主营业务</div>
                <div className="text-xs text-gray-700 leading-relaxed">{data.companyProfile.companyIntro}</div>
              </div>
            )}
            {data.companyProfile.mainProducts && data.companyProfile.mainProducts.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">主要产品/服务</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.companyProfile.mainProducts.map((p, i) => (
                    <span key={i} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {data.companyProfile.coreCompetitiveness && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">核心竞争力</div>
                <div className="text-xs text-gray-700">{data.companyProfile.coreCompetitiveness}</div>
              </div>
            )}
            {(data.companyProfile.upstreamDesc || data.companyProfile.downstreamDesc) && (
              <div className="grid grid-cols-2 gap-3">
                {data.companyProfile.upstreamDesc && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">上游供应商</div>
                    <div className="text-xs text-gray-700">{data.companyProfile.upstreamDesc}</div>
                  </div>
                )}
                {data.companyProfile.downstreamDesc && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">下游客户</div>
                    <div className="text-xs text-gray-700">{data.companyProfile.downstreamDesc}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 特征ID → 所需文件映射
const FEATURE_TO_FILE_MAP: Record<string, string> = {
  F01: "纳税证明", F02: "营业执照", F03: "营业执照", F04: "法人身份证",
  F05: "股权结构", F06: "工商数据", F07: "工商数据", F08: "工商数据",
  F09: "营业执照", F10: "资质证书", F11: "工商数据", F12: "工商数据",
  F13: "资产负债表", F14: "资产负债表", F15: "资产负债表", F16: "资产负债表",
  F17: "利润表", F18: "利润表", F19: "利润表", F20: "利润表",
  F21: "利润表", F22: "利润表", F23: "利润表", F24: "利润表",
  F25: "现金流量表", F26: "现金流量表", F27: "现金流量表", F28: "现金流量表",
  F29: "银行流水", F30: "银行流水", F31: "银行流水",
  F32: "纳税证明", F33: "纳税证明", F34: "纳税证明",
  F35: "司法查询", F36: "司法查询", F37: "舆情数据", F38: "舆情数据",
};

export { DocChecklistPanel, Top5EntryBlock, Top5DisplayBlock, FinancialTableSection, DataVerifyPanel, FINANCIAL_KEY_LABELS, FEATURE_TO_FILE_MAP };
