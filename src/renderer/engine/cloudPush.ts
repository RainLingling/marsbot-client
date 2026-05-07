/**
 * cloudPush.ts - 云端推送模块
 * 功能：
 * 1. 脱敏处理（身份证号、手机号、银行账号等）
 * 2. 生成推送摘要（供用户确认）
 * 3. HTTPS POST 到 SaaS API
 */

import { getRawConfig } from "@/lib/localStore";

// ─── 脱敏规则 ─────────────────────────────────────────────────────────────────

/** 对字符串中的敏感信息进行模糊处理 */
export function desensitizeString(val: string): string {
  if (typeof val !== "string") return val;
  // 身份证号（18位）
  val = val.replace(/\b(\d{6})\d{8}(\d{4})\b/g, "$1********$2");
  // 手机号（11位，1开头）
  val = val.replace(/\b(1[3-9]\d)\d{4}(\d{4})\b/g, "$1****$2");
  // 银行账号（16-19位纯数字）
  val = val.replace(/\b(\d{4})\d{8,11}(\d{4})\b/g, "$1****$2");
  // 统一社会信用代码（18位，字母数字混合）
  val = val.replace(/\b([A-Z0-9]{4})[A-Z0-9]{10}([A-Z0-9]{4})\b/g, "$1**********$2");
  return val;
}

/** 递归对对象/数组中的字符串值进行脱敏 */
export function desensitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return desensitizeString(obj);
  if (Array.isArray(obj)) return obj.map(desensitizeObject);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      // 对敏感字段名直接置空
      const sensitiveKeys = [
        "idCard", "id_card", "idNumber", "id_number",
        "phone", "mobile", "telephone",
        "bankAccount", "bank_account", "accountNumber", "account_number",
        "password", "passwd", "secret",
      ];
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = "***";
      } else {
        result[key] = desensitizeObject(val);
      }
    }
    return result;
  }
  return obj;
}

// ─── 推送摘要生成 ─────────────────────────────────────────────────────────────

export interface PushSummary {
  companyName: string;
  recordId: string;
  score?: number;
  verdict?: string;
  amount?: string;
  /** 推送数据包中包含的字段列表（供用户确认） */
  includedFields: { key: string; label: string; hasData: boolean }[];
  /** 脱敏后的推送数据（用于预览） */
  desensitizedPayload: Record<string, unknown>;
}

export function buildPushSummary(
  recordId: string,
  companyName: string,
  appData: Record<string, unknown>,
  analysisResult: Record<string, unknown> | undefined,
  autoDesensitize: boolean
): PushSummary {
  const payload: Record<string, unknown> = {
    recordId,
    companyName,
    analysisResult: analysisResult || null,
    // 只包含结构化数据，不包含原始文件内容
    businessLicense: appData.business_license || null,
    financialStatements: appData.financial_statements || null,
    bankStatements: appData.bank_statements || null,
    taxData: appData.tax_data || null,
    top5Customers: appData.top5_customers || null,
    top5Suppliers: appData.top5_suppliers || null,
    revenueBreakdown: appData.revenue_breakdown || null,
    auditReport: appData.audit_report || null,
    timestamp: new Date().toISOString(),
    clientVersion: "1.0.5",
  };

  const desensitizedPayload = autoDesensitize
    ? (desensitizeObject(payload) as Record<string, unknown>)
    : payload;

  const includedFields = [
    { key: "analysisResult", label: "分析结论（评分/额度/规则）", hasData: !!analysisResult },
    { key: "businessLicense", label: "营业执照信息", hasData: !!appData.business_license },
    { key: "financialStatements", label: "财务报表数据", hasData: !!appData.financial_statements },
    { key: "bankStatements", label: "银行流水摘要", hasData: !!appData.bank_statements },
    { key: "taxData", label: "税务数据", hasData: !!appData.tax_data },
    { key: "top5Customers", label: "TOP5 客户/供应商", hasData: !!(appData.top5_customers || appData.top5_suppliers) },
    { key: "revenueBreakdown", label: "营业收入构成", hasData: !!appData.revenue_breakdown },
    { key: "auditReport", label: "审计报告摘要", hasData: !!appData.audit_report },
  ];

  return {
    companyName,
    recordId,
    score: (analysisResult as any)?.score,
    verdict: (analysisResult as any)?.verdict,
    amount: (analysisResult as any)?.recommendedAmount,
    includedFields,
    desensitizedPayload,
  };
}

// ─── 推送执行 ─────────────────────────────────────────────────────────────────

export interface PushResult {
  success: boolean;
  message: string;
  remoteId?: string;
  error?: string;
}

export async function pushToSaas(
  payload: Record<string, unknown>
): Promise<PushResult> {
  const config = getRawConfig();

  if (!config.saasUrl) {
    return { success: false, message: "未配置 SaaS 地址，请先在设置中配置云端连接", error: "NO_SAAS_URL" };
  }

  const url = config.saasUrl.replace(/\/$/, "") + "/api/loan-applications/import";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.saasApiKey) {
    headers["Authorization"] = `Bearer ${config.saasApiKey}`;
  }
  if (config.saasOrgId) {
    headers["X-Org-Id"] = config.saasOrgId;
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return {
        success: true,
        message: "推送成功",
        remoteId: data.id || data.recordId || data.applicationId,
      };
    } else {
      const errText = await resp.text().catch(() => "");
      return {
        success: false,
        message: `推送失败：HTTP ${resp.status}`,
        error: errText.slice(0, 200),
      };
    }
  } catch (e) {
    return {
      success: false,
      message: `网络错误：${String(e)}`,
      error: String(e),
    };
  }
}

// ─── 一键推送（含脱敏 + 推送） ────────────────────────────────────────────────

export async function pushRecordToSaas(
  recordId: string,
  companyName: string,
  appData: Record<string, unknown>,
  analysisResult: Record<string, unknown> | undefined
): Promise<PushResult> {
  const config = getRawConfig();
  const autoDesensitize = config.autoDesensitize ?? true;

  const summary = buildPushSummary(recordId, companyName, appData, analysisResult, autoDesensitize);
  return pushToSaas(summary.desensitizedPayload);
}
