/**
 * Marsbot Client - Local Storage Module
 * 替代云端 tRPC 调用的本地持久化存储
 * 使用 localStorage 存储历史记录、草稿、配置等
 */

const HISTORY_KEY = "marsbot_history";
const CONFIG_KEY = "marsbot_config";

// ─── 历史记录类型 ─────────────────────────────────────────────────────────────
export interface HistoryRecord {
  id: number;
  recordId: string;
  companyName: string;
  status: "draft" | "analyzing" | "completed" | "rejected";
  verdict?: string;
  score?: number;
  amount?: string;
  createdAt: string;
  updatedAt: string;
  // 存储完整的分析数据（用于恢复）
  appData?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
  messages?: { role: string; content: string }[];
  uploadedFilesList?: unknown[];
  uploadedDocsMap?: Record<string, unknown>;
  financialStatements?: Record<string, unknown>;
  financialStatementsByYear?: Record<string, unknown>;
}

// ─── 配置类型 ─────────────────────────────────────────────────────────────────
export interface LocalConfig {
  llmApiKey?: string;
  llmModel?: string;
  llmApiUrl?: string;
}

// ─── 历史记录操作 ─────────────────────────────────────────────────────────────

export function getHistory(limit = 50): { records: HistoryRecord[] } {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return { records: [] };
    const records: HistoryRecord[] = JSON.parse(raw);
    return { records: records.slice(0, limit) };
  } catch {
    return { records: [] };
  }
}

export function saveHistory(records: HistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("[LocalStore] Failed to save history:", e);
  }
}

export function createDraft(companyName: string): HistoryRecord {
  const { records } = getHistory();
  const newRecord: HistoryRecord = {
    id: Date.now(),
    recordId: `LOCAL-${Date.now()}`,
    companyName,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveHistory([newRecord, ...records]);
  return newRecord;
}

export function updateDraftCompany(recordId: string, companyName: string): void {
  const { records } = getHistory();
  const updated = records.map(r =>
    r.recordId === recordId
      ? { ...r, companyName, updatedAt: new Date().toISOString() }
      : r
  );
  saveHistory(updated);
}

export function updateRecordWithResult(
  recordId: string,
  data: Partial<HistoryRecord>
): void {
  const { records } = getHistory();
  const updated = records.map(r =>
    r.recordId === recordId
      ? { ...r, ...data, updatedAt: new Date().toISOString() }
      : r
  );
  saveHistory(updated);
}

export function deleteRecord(recordId: string): void {
  const { records } = getHistory();
  saveHistory(records.filter(r => r.recordId !== recordId));
}

export function deleteRecordsBatch(recordIds: string[]): void {
  const { records } = getHistory();
  const idSet = new Set(recordIds);
  saveHistory(records.filter(r => !idSet.has(r.recordId)));
}

export function getRecordById(recordId: string): HistoryRecord | null {
  const { records } = getHistory();
  return records.find(r => r.recordId === recordId) ?? null;
}

// ─── 配置操作 ─────────────────────────────────────────────────────────────────

export function getConfig(): { configs: { key: string; value?: string | null; configured: boolean; description: string | null }[] } {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const config: LocalConfig = raw ? JSON.parse(raw) : {};
    return {
      configs: [
        {
          key: "llm_api_key",
          value: config.llmApiKey || null,
          configured: !!config.llmApiKey,
          description: "LLM API Key",
        },
        {
          key: "llm_model",
          value: config.llmModel || null,
          configured: !!config.llmModel,
          description: "LLM Model",
        },
        {
          key: "llm_api_url",
          value: config.llmApiUrl || null,
          configured: !!config.llmApiUrl,
          description: "LLM API URL",
        },
      ],
    };
  } catch {
    return { configs: [] };
  }
}

export function saveConfig(config: LocalConfig): void {
  try {
    const existing: LocalConfig = (() => {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    })();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...existing, ...config }));
  } catch (e) {
    console.error("[LocalStore] Failed to save config:", e);
  }
}

// ─── 文件上传（本地版：直接读取File对象，不上传到服务器）────────────────────

export async function uploadFileLocal(file: File): Promise<{ url: string; docId?: string }> {
  // 本地版：将文件转为 blob URL 供预览
  const url = URL.createObjectURL(file);
  return { url };
}

// ─── 文档解析（本地版：使用 IPC 调用主进程的解析能力）──────────────────────

export async function parseDocumentLocal(
  fileUrl: string,
  fileType: string,
  docId: string,
  file?: File
): Promise<{ data: Record<string, unknown> | null }> {
  // 本地版：通过 Electron IPC 调用主进程解析
  if (window.electronAPI?.parseDocument) {
    try {
      const result = await window.electronAPI.parseDocument({ fileUrl, fileType, docId, fileName: file?.name });
      return { data: result };
    } catch (e) {
      console.error("[LocalStore] parseDocument IPC error:", e);
    }
  }
  // 降级：返回空数据
  return { data: null };
}

// ─── AI 聊天（本地版：使用配置的 LLM 或内置简单回复）────────────────────────

export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  companyContext?: Record<string, unknown>
): Promise<{ content: string }> {
  const config: LocalConfig = (() => {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  })();

  // 如果配置了外部 LLM，使用外部 API
  if (config.llmApiKey && config.llmApiUrl) {
    try {
      const systemPrompt = companyContext
        ? `你是 Marsbot 火星豹 AI 信贷助手。当前分析企业：${JSON.stringify(companyContext)}`
        : "你是 Marsbot 火星豹 AI 信贷助手，专注于企业信贷风险分析。";
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-8),
        { role: "user", content: message },
      ];
      const resp = await fetch(config.llmApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llmApiKey}`,
        },
        body: JSON.stringify({
          model: config.llmModel || "gpt-3.5-turbo",
          messages,
          max_tokens: 1000,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "AI 暂无回复";
        return { content };
      }
    } catch (e) {
      console.error("[LocalStore] External LLM error:", e);
    }
  }

  // 降级：本地简单回复
  return {
    content: "本地离线模式下，AI 对话功能需要配置外部 LLM API（支持 DeepSeek、通义千问、GPT 等）。请点击右上角⚙️配置 API Key。",
  };
}

// ─── 语音转写（本地版：使用 IPC 或降级提示）────────────────────────────────

export async function transcribeVoiceLocal(
  audioUrl: string
): Promise<{ text: string }> {
  if (window.electronAPI?.transcribeVoice) {
    try {
      const result = await window.electronAPI.transcribeVoice({ audioUrl });
      return { text: result.text || "" };
    } catch (e) {
      console.error("[LocalStore] transcribeVoice IPC error:", e);
    }
  }
  return { text: "" };
}

// ─── 企业搜索（本地版：通过 IPC 调用主进程的网络请求）────────────────────────

export async function searchCompanyLocal(
  query: string
): Promise<{ candidates: unknown[] }> {
  if (window.electronAPI?.searchCompany) {
    try {
      const result = await window.electronAPI.searchCompany({ query });
      return { candidates: result.candidates || [] };
    } catch (e) {
      console.error("[LocalStore] searchCompany IPC error:", e);
    }
  }
  return { candidates: [] };
}
