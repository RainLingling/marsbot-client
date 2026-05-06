// ── 申请历史记录工具 ──
export interface HistoryRecord {
  id: string;
  createdAt: string; // ISO string
  companyName: string;
  amount: string;
  type: string;
  status: "approved" | "reduced" | "rejected" | "pending";
  score?: number;
  // 完整的申请数据快照
  application: Record<string, unknown>;
  // 决策结果快照（可选）
  decision?: Record<string, unknown>;
}

const STORAGE_KEY = "loanHistory";

export function getHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(record: HistoryRecord): void {
  const list = getHistory();
  // 同一 id 覆盖更新
  const idx = list.findIndex(r => r.id === record.id);
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.unshift(record); // 最新的放最前
  }
  // 最多保留 50 条
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}

export function deleteHistory(id: string): void {
  const list = getHistory().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getStatusLabel(status: HistoryRecord["status"]) {
  switch (status) {
    case "approved": return { text: "已批准", color: "text-green-600 bg-green-50 border-green-200" };
    case "reduced":  return { text: "降额批准", color: "text-blue-600 bg-blue-50 border-blue-200" };
    case "rejected": return { text: "已拒件", color: "text-red-600 bg-red-50 border-red-200" };
    case "pending":  return { text: "分析中", color: "text-amber-600 bg-amber-50 border-amber-200" };
  }
}
