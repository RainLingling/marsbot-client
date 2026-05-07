/**
 * HistoryPage - 历史申请记录页面
 * 功能：列表展示 + 状态筛选 + 搜索 + 删除 + 重新打开
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Trash2, ExternalLink, RefreshCw, FileText,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown,
  Building2, Calendar, DollarSign, BarChart3, Filter, X
} from "lucide-react";
import { getHistory, deleteRecords, type HistoryRecord } from "@/lib/localStore";
import { GraphReader } from "@/engine/graphDb";

type StatusFilter = "all" | "draft" | "analyzing" | "completed" | "rejected";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:     { label: "草稿",   color: "text-gray-500",  bg: "bg-gray-100",   icon: <FileText size={12} /> },
  analyzing: { label: "分析中", color: "text-blue-600",  bg: "bg-blue-50",    icon: <RefreshCw size={12} className="animate-spin" /> },
  completed: { label: "已完成", color: "text-green-600", bg: "bg-green-50",   icon: <CheckCircle2 size={12} /> },
  rejected:  { label: "已拒绝", color: "text-red-600",   bg: "bg-red-50",     icon: <XCircle size={12} /> },
};

const VERDICT_CONFIG: Record<string, { label: string; color: string }> = {
  approved: { label: "建议通过", color: "text-green-600" },
  reduced:  { label: "建议缩减", color: "text-yellow-600" },
  rejected: { label: "建议拒绝", color: "text-red-600" },
};

interface HistoryPageProps {
  onOpenRecord?: (record: HistoryRecord) => void;
}

export default function HistoryPage({ onOpenRecord }: HistoryPageProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [graphStats, setGraphStats] = useState<Record<string, { entityCount: number; relationCount: number }>>({});
  const [sortBy, setSortBy] = useState<"updatedAt" | "score" | "companyName">("updatedAt");
  const [sortDesc, setSortDesc] = useState(true);

  const loadRecords = useCallback(() => {
    const { records: all } = getHistory(200);
    setRecords(all);
    // 异步加载图谱统计
    all.forEach(r => {
      GraphReader.getGraphStats(r.recordId)
        .then(stats => {
          if (stats.entityCount > 0) {
            setGraphStats(prev => ({ ...prev, [r.recordId]: stats }));
          }
        })
        .catch(() => {});
    });
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // 筛选 + 搜索 + 排序
  const filtered = records
    .filter(r => filter === "all" || r.status === filter)
    .filter(r => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return r.companyName.toLowerCase().includes(q) ||
        r.recordId.toLowerCase().includes(q) ||
        (r.verdict || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va: string | number = a[sortBy as keyof HistoryRecord] as string | number ?? "";
      let vb: string | number = b[sortBy as keyof HistoryRecord] as string | number ?? "";
      if (sortBy === "score") { va = a.score ?? 0; vb = b.score ?? 0; }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDesc ? -cmp : cmp;
    });

  const statusCounts = {
    all: records.length,
    draft: records.filter(r => r.status === "draft").length,
    analyzing: records.filter(r => r.status === "analyzing").length,
    completed: records.filter(r => r.status === "completed").length,
    rejected: records.filter(r => r.status === "rejected").length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.recordId)));
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!window.confirm(`确认删除 ${ids.length} 条记录？此操作不可撤销。`)) return;
    setIsDeleting(true);
    try {
      deleteRecords(ids);
      setSelectedIds(new Set());
      loadRecords();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpen = (record: HistoryRecord) => {
    if (onOpenRecord) onOpenRecord(record);
  };

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) + " " +
        d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">历史申请记录</h1>
            <p className="text-xs text-gray-400 mt-0.5">共 {records.length} 条记录，本地存储</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => handleDelete(Array.from(selectedIds))}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition border border-red-200"
              >
                <Trash2 size={12} />
                删除选中 ({selectedIds.size})
              </button>
            )}
            <button
              onClick={loadRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              <RefreshCw size={12} />
              刷新
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索企业名称、申请编号..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* 状态筛选 tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "completed", "draft", "analyzing", "rejected"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition border ${
                filter === s
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"
              }`}
            >
              {s === "all" ? "全部" : STATUS_CONFIG[s]?.label}
              <span className={`ml-0.5 ${filter === s ? "text-orange-100" : "text-gray-400"}`}>
                {statusCounts[s]}
              </span>
            </button>
          ))}
          {/* 排序 */}
          <div className="ml-auto flex items-center gap-1">
            <Filter size={12} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 focus:outline-none"
            >
              <option value="updatedAt">按时间</option>
              <option value="score">按评分</option>
              <option value="companyName">按名称</option>
            </select>
            <button
              onClick={() => setSortDesc(v => !v)}
              className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-600 hover:bg-gray-50"
            >
              {sortDesc ? "↓" : "↑"}
            </button>
          </div>
        </div>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText size={32} className="mb-3 opacity-30" />
            <div className="text-sm">
              {searchQuery ? `未找到包含"${searchQuery}"的记录` : "暂无记录"}
            </div>
            {!searchQuery && filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mt-2 text-xs text-orange-500 hover:underline">
                查看全部
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 全选行 */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <span className="text-xs text-gray-400">
                {selectedIds.size > 0 ? `已选 ${selectedIds.size} 条` : `共 ${filtered.length} 条`}
              </span>
            </div>

            {/* 记录卡片列表 */}
            <div className="space-y-2">
              {filtered.map(record => {
                const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.draft;
                const verdictCfg = record.verdict ? VERDICT_CONFIG[record.verdict] : null;
                const stats = graphStats[record.recordId];
                const isSelected = selectedIds.has(record.recordId);

                return (
                  <div
                    key={record.recordId}
                    className={`bg-white rounded-xl border transition ${
                      isSelected ? "border-orange-400 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(record.recordId)}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 rounded flex-shrink-0"
                      />
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(record)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900 truncate max-w-[200px]">
                            {record.companyName || "未命名企业"}
                          </span>
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </span>
                          {verdictCfg && (
                            <span className={`text-[10px] font-medium ${verdictCfg.color}`}>
                              · {verdictCfg.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {record.score != null && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <BarChart3 size={11} className="text-orange-400" />
                              <span className="font-medium text-orange-600">{record.score}</span>
                              <span className="text-gray-400">分</span>
                            </div>
                          )}
                          {record.amount && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <DollarSign size={11} className="text-green-500" />
                              <span>{record.amount}</span>
                            </div>
                          )}
                          {stats && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <span className="text-blue-400">●</span>
                              <span>{stats.entityCount} 实体 · {stats.relationCount} 关系</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                            <Calendar size={10} />
                            <span>{fmtDate(record.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-300 font-mono truncate">
                          {record.recordId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); handleOpen(record); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition"
                        >
                          <ExternalLink size={11} />
                          打开
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete([record.recordId]); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
