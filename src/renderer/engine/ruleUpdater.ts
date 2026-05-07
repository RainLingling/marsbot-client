/**
 * ruleUpdater.ts - 规则库在线更新机制
 *
 * 功能：
 * 1. 从 SaaS 服务器拉取最新规则库版本信息
 * 2. 比较本地版本与远端版本
 * 3. 下载并缓存新规则（JSON 格式，存储在 localStorage）
 * 4. 运行时动态注入规则覆盖内置规则
 *
 * 规则库 JSON 格式（由 SaaS 服务器提供）：
 * {
 *   version: "2024.06.01",
 *   publishedAt: "2024-06-01T00:00:00Z",
 *   changelog: "新增保理专项规则 FR004",
 *   hardRules: [ { id, name, desc, threshold, severity, condition } ],
 *   scoringWeights: { ... },
 *   limitParams: { ... }
 * }
 */

import { getRawConfig, saveConfig } from "@/lib/localStore";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface RemoteRuleCondition {
  field: string;           // RuleInputData 中的字段名
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in" | "exists" | "not_exists";
  value?: number | string | boolean | string[];
  // 复合条件（AND/OR）
  and?: RemoteRuleCondition[];
  or?: RemoteRuleCondition[];
}

export interface RemoteHardRule {
  id: string;
  name: string;
  desc: string;
  threshold: string;
  severity: "FATAL" | "WARNING";
  enabled: boolean;
  condition: RemoteRuleCondition;
  triggeredValueTemplate?: string;  // 模板字符串，如 "资产负债率：{debtRatio}%"
}

export interface RemoteScoringWeights {
  cashFlowWeight?: number;
  profitabilityWeight?: number;
  solvencyWeight?: number;
  growthWeight?: number;
  taxComplianceWeight?: number;
  creditHistoryWeight?: number;
  operationStabilityWeight?: number;
  collateralWeight?: number;
  managementWeight?: number;
}

export interface RemoteLimitParams {
  cashFlowMultiplier?: number;       // 现金流法倍数
  revenueRatio?: number;             // 营收法比例
  assetMortgageRatio?: number;       // 资产抵押率
  maxLimitCap?: number;              // 最高额度上限（万元）
  minLimitFloor?: number;            // 最低额度下限（万元）
}

export interface RuleLibrary {
  version: string;
  publishedAt: string;
  changelog: string;
  hardRules?: RemoteHardRule[];
  scoringWeights?: RemoteScoringWeights;
  limitParams?: RemoteLimitParams;
}

export interface RuleUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog?: string;
  publishedAt?: string;
}

// ─── 本地存储 Key ─────────────────────────────────────────────────────────────

const RULE_LIBRARY_KEY = "marsbot_rule_library";
const RULE_VERSION_KEY = "marsbot_rule_version";
const RULE_LAST_CHECK_KEY = "marsbot_rule_last_check";

// ─── 内置规则库版本（与 hardRuleEngine.ts 保持同步） ─────────────────────────

export const BUILTIN_RULE_VERSION = "2024.01.01";

// ─── 核心函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取当前已安装的规则库版本
 */
export function getCurrentRuleVersion(): string {
  try {
    return localStorage.getItem(RULE_VERSION_KEY) || BUILTIN_RULE_VERSION;
  } catch {
    return BUILTIN_RULE_VERSION;
  }
}

/**
 * 获取本地缓存的规则库（如果有）
 */
export function getCachedRuleLibrary(): RuleLibrary | null {
  try {
    const raw = localStorage.getItem(RULE_LIBRARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RuleLibrary;
  } catch {
    return null;
  }
}

/**
 * 检查是否有规则库更新（从 SaaS 服务器）
 * @param saasUrl SaaS 服务器地址
 * @param apiKey API Key
 */
export async function checkRuleUpdate(
  saasUrl: string,
  apiKey: string
): Promise<RuleUpdateCheckResult> {
  const currentVersion = getCurrentRuleVersion();

  const url = `${saasUrl.replace(/\/$/, "")}/api/rules/version`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Version": currentVersion,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    throw new Error(`服务器返回错误: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as {
    version: string;
    publishedAt: string;
    changelog: string;
  };

  const hasUpdate = compareVersions(data.version, currentVersion) > 0;

  return {
    hasUpdate,
    currentVersion,
    latestVersion: data.version,
    changelog: data.changelog,
    publishedAt: data.publishedAt,
  };
}

/**
 * 下载并安装最新规则库
 * @param saasUrl SaaS 服务器地址
 * @param apiKey API Key
 * @returns 安装的规则库
 */
export async function downloadAndInstallRuleLibrary(
  saasUrl: string,
  apiKey: string
): Promise<RuleLibrary> {
  const url = `${saasUrl.replace(/\/$/, "")}/api/rules/library`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    throw new Error(`下载规则库失败: ${resp.status} ${resp.statusText}`);
  }

  const library = await resp.json() as RuleLibrary;

  // 验证规则库格式
  if (!library.version || !library.publishedAt) {
    throw new Error("规则库格式无效：缺少 version 或 publishedAt 字段");
  }

  // 存储到 localStorage
  try {
    localStorage.setItem(RULE_LIBRARY_KEY, JSON.stringify(library));
    localStorage.setItem(RULE_VERSION_KEY, library.version);
    localStorage.setItem(RULE_LAST_CHECK_KEY, new Date().toISOString());
  } catch (e) {
    console.warn("[ruleUpdater] localStorage 写入失败:", e);
  }

  // 更新本地配置中的规则库版本
  try {
    const config = getRawConfig();
    saveConfig({ ...config, ruleVersion: library.version });
  } catch {
    // 静默失败
  }

  return library;
}

/**
 * 记录最后检查时间
 */
export function markLastCheckTime(): void {
  try {
    localStorage.setItem(RULE_LAST_CHECK_KEY, new Date().toISOString());
  } catch {
    // 静默失败
  }
}

/**
 * 获取最后检查时间
 */
export function getLastCheckTime(): Date | null {
  try {
    const raw = localStorage.getItem(RULE_LAST_CHECK_KEY);
    if (!raw) return null;
    return new Date(raw);
  } catch {
    return null;
  }
}

/**
 * 清除本地缓存的规则库（回退到内置规则）
 */
export function clearCachedRuleLibrary(): void {
  try {
    localStorage.removeItem(RULE_LIBRARY_KEY);
    localStorage.removeItem(RULE_VERSION_KEY);
    localStorage.removeItem(RULE_LAST_CHECK_KEY);
  } catch {
    // 静默失败
  }
}

// ─── 规则条件求值器 ───────────────────────────────────────────────────────────

/**
 * 对 RuleInputData 中的字段求值（支持嵌套路径，如 "counterparty.arConcentrationRatio"）
 */
function getFieldValue(data: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 对单个条件求值
 */
function evalCondition(data: Record<string, unknown>, cond: RemoteRuleCondition): boolean {
  // 复合条件
  if (cond.and) return cond.and.every(c => evalCondition(data, c));
  if (cond.or) return cond.or.some(c => evalCondition(data, c));

  const fieldVal = getFieldValue(data, cond.field);

  switch (cond.operator) {
    case "exists": return fieldVal !== undefined && fieldVal !== null;
    case "not_exists": return fieldVal === undefined || fieldVal === null;
    case "eq": return fieldVal === cond.value;
    case "ne": return fieldVal !== cond.value;
    case "gt": return typeof fieldVal === "number" && typeof cond.value === "number" && fieldVal > cond.value;
    case "lt": return typeof fieldVal === "number" && typeof cond.value === "number" && fieldVal < cond.value;
    case "gte": return typeof fieldVal === "number" && typeof cond.value === "number" && fieldVal >= cond.value;
    case "lte": return typeof fieldVal === "number" && typeof cond.value === "number" && fieldVal <= cond.value;
    case "in": return Array.isArray(cond.value) && cond.value.includes(fieldVal as string);
    case "not_in": return Array.isArray(cond.value) && !cond.value.includes(fieldVal as string);
    default: return false;
  }
}

/**
 * 渲染触发值模板（将 {fieldName} 替换为实际值）
 */
function renderTriggeredValue(template: string | undefined, data: Record<string, unknown>, fieldName: string): string {
  if (!template) {
    const val = getFieldValue(data, fieldName);
    return val !== undefined ? String(val) : "未知";
  }
  return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path) => {
    const val = getFieldValue(data, path);
    return val !== undefined ? String(val) : "未知";
  });
}

// ─── 动态规则注入 ─────────────────────────────────────────────────────────────

export interface DynamicRuleCheckResult {
  passed: boolean;
  triggeredRules: Array<{
    ruleId: string;
    ruleName: string;
    ruleDesc: string;
    severity: "FATAL" | "WARNING";
    triggeredValue: string;
    threshold: string;
  }>;
  summary: string;
}

/**
 * 运行远端规则库中的规则（动态求值，不依赖内置规则引擎）
 * 如果没有远端规则库，返回 null（调用方应降级到内置规则引擎）
 */
export function runDynamicRuleEngine(
  inputData: Record<string, unknown>
): DynamicRuleCheckResult | null {
  const library = getCachedRuleLibrary();
  if (!library || !library.hardRules || library.hardRules.length === 0) {
    return null; // 没有远端规则，降级到内置
  }

  const triggeredRules: DynamicRuleCheckResult["triggeredRules"] = [];

  for (const rule of library.hardRules) {
    if (!rule.enabled) continue;
    try {
      const triggered = evalCondition(inputData, rule.condition);
      if (triggered) {
        triggeredRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleDesc: rule.desc,
          severity: rule.severity,
          triggeredValue: renderTriggeredValue(rule.triggeredValueTemplate, inputData, rule.condition.field),
          threshold: rule.threshold,
        });
      }
    } catch (e) {
      console.warn(`[ruleUpdater] 规则 ${rule.id} 求值失败:`, e);
    }
  }

  const fatalRules = triggeredRules.filter(r => r.severity === "FATAL");
  const passed = fatalRules.length === 0;

  const summary = passed
    ? `规则检查通过（共检查 ${library.hardRules.filter(r => r.enabled).length} 条规则，版本 ${library.version}）`
    : `触发 ${fatalRules.length} 条一票否决规则：${fatalRules.map(r => r.ruleName).join("、")}`;

  return { passed, triggeredRules, summary };
}

/**
 * 获取远端规则库的评分权重（如果有）
 */
export function getRemoteScoringWeights(): RemoteScoringWeights | null {
  const library = getCachedRuleLibrary();
  return library?.scoringWeights || null;
}

/**
 * 获取远端规则库的额度参数（如果有）
 */
export function getRemoteLimitParams(): RemoteLimitParams | null {
  const library = getCachedRuleLibrary();
  return library?.limitParams || null;
}

// ─── 版本比较工具 ─────────────────────────────────────────────────────────────

/**
 * 比较两个版本号（格式：YYYY.MM.DD 或 YYYY.MM.DD.patch）
 * 返回：1（a > b）、0（a == b）、-1（a < b）
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] || 0;
    const pb = partsB[i] || 0;
    if (pa > pb) return 1;
    if (pa < pb) return -1;
  }
  return 0;
}

/**
 * 获取规则库状态摘要（用于 SettingsPage 展示）
 */
export function getRuleLibraryStatus(): {
  version: string;
  isBuiltin: boolean;
  publishedAt: string | null;
  lastCheckTime: Date | null;
  ruleCount: number;
} {
  const library = getCachedRuleLibrary();
  const lastCheckTime = getLastCheckTime();

  if (!library) {
    return {
      version: BUILTIN_RULE_VERSION,
      isBuiltin: true,
      publishedAt: null,
      lastCheckTime,
      ruleCount: 11, // 内置 8 条 FATAL + 3 条 WARNING
    };
  }

  return {
    version: library.version,
    isBuiltin: false,
    publishedAt: library.publishedAt,
    lastCheckTime,
    ruleCount: library.hardRules?.filter(r => r.enabled).length ?? 0,
  };
}
