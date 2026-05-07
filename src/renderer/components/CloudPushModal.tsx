/**
 * CloudPushModal - 云端推送确认对话框
 * 展示推送摘要 + 脱敏预览 + 字段勾选 + 确认推送
 */
import React, { useState, useEffect } from "react";
import {
  Upload, Shield, CheckCircle2, AlertCircle, X,
  ChevronDown, ChevronRight, RefreshCw, Globe
} from "lucide-react";
import {
  buildPushSummary, pushToSaas, type PushSummary, type PushResult
} from "@/engine/cloudPush";
import { getRawConfig } from "@/lib/localStore";

interface CloudPushModalProps {
  open: boolean;
  onClose: () => void;
  recordId: string;
  companyName: string;
  appData: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
}

export default function CloudPushModal({
  open, onClose, recordId, companyName, appData, analysisResult
}: CloudPushModalProps) {
  const [step, setStep] = useState<"confirm" | "pushing" | "done">("confirm");
  const [summary, setSummary] = useState<PushSummary | null>(null);
  const [desensitize, setDesensitize] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const config = getRawConfig();
    setDesensitize(config.autoDesensitize ?? true);
    setStep("confirm");
    setResult(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const s = buildPushSummary(recordId, companyName, appData, analysisResult, desensitize);
    setSummary(s);
    // 默认勾选有数据的字段
    setEnabledFields(new Set(s.includedFields.filter(f => f.hasData).map(f => f.key)));
  }, [open, desensitize, recordId, companyName, appData, analysisResult]);

  const hasSaasConfig = !!getRawConfig().saasUrl;

  const handlePush = async () => {
    if (!summary) return;
    setStep("pushing");

    // 只推送勾选的字段
    const filteredPayload: Record<string, unknown> = {
      recordId: summary.desensitizedPayload.recordId,
      companyName: summary.desensitizedPayload.companyName,
      timestamp: summary.desensitizedPayload.timestamp,
      clientVersion: summary.desensitizedPayload.clientVersion,
    };
    for (const key of enabledFields) {
      if (summary.desensitizedPayload[key] !== undefined) {
        filteredPayload[key] = summary.desensitizedPayload[key];
      }
    }

    const r = await pushToSaas(filteredPayload);
    setResult(r);
    setStep("done");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-orange-500" />
            <span className="font-semibold text-gray-900">推送到云端</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5">
          {step === "confirm" && summary && (
            <>
              {/* 企业信息 */}
              <div className="bg-orange-50 rounded-xl p-4 mb-4">
                <div className="text-sm font-semibold text-gray-900">{summary.companyName}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {summary.score != null && <span>评分 <strong className="text-orange-600">{summary.score}</strong> 分</span>}
                  {summary.amount && <span>建议额度 <strong className="text-green-600">{summary.amount}</strong></span>}
                  {summary.verdict && (
                    <span className={
                      summary.verdict === "approved" ? "text-green-600" :
                      summary.verdict === "rejected" ? "text-red-600" : "text-yellow-600"
                    }>
                      {summary.verdict === "approved" ? "建议通过" : summary.verdict === "rejected" ? "建议拒绝" : "建议缩减"}
                    </span>
                  )}
                </div>
              </div>

              {/* SaaS 未配置警告 */}
              {!hasSaasConfig && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                  <AlertCircle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-700">
                    尚未配置云端 SaaS 地址，推送将失败。请先在<strong>设置 → 云端同步</strong>中配置。
                  </div>
                </div>
              )}

              {/* 脱敏开关 */}
              <label className="flex items-center gap-2.5 cursor-pointer mb-4 p-3 rounded-xl border border-gray-200 hover:border-orange-300 transition">
                <input
                  type="checkbox"
                  checked={desensitize}
                  onChange={e => setDesensitize(e.target.checked)}
                  className="rounded"
                />
                <Shield size={14} className="text-orange-500" />
                <div>
                  <div className="text-sm font-medium text-gray-800">推送前脱敏处理</div>
                  <div className="text-xs text-gray-400">身份证号、手机号、银行账号将被模糊处理</div>
                </div>
              </label>

              {/* 字段勾选 */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2">选择推送内容</div>
                <div className="space-y-1.5">
                  {summary.includedFields.map(field => (
                    <label
                      key={field.key}
                      className={`flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg transition ${
                        field.hasData ? "hover:bg-gray-50" : "opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabledFields.has(field.key)}
                        onChange={e => {
                          const next = new Set(enabledFields);
                          if (e.target.checked) next.add(field.key); else next.delete(field.key);
                          setEnabledFields(next);
                        }}
                        disabled={!field.hasData}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                      {!field.hasData && <span className="text-xs text-gray-400 ml-auto">无数据</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* 数据预览折叠 */}
              <button
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3"
              >
                {showPreview ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {desensitize ? "查看脱敏后数据预览" : "查看推送数据预览"}
              </button>
              {showPreview && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-40 overflow-y-auto">
                  <pre className="text-[10px] text-gray-500 whitespace-pre-wrap break-all">
                    {JSON.stringify(summary.desensitizedPayload, null, 2).slice(0, 2000)}
                  </pre>
                </div>
              )}
            </>
          )}

          {step === "pushing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw size={32} className="text-orange-500 animate-spin mb-3" />
              <div className="text-sm text-gray-600">正在推送到云端...</div>
            </div>
          )}

          {step === "done" && result && (
            <div className="flex flex-col items-center justify-center py-6">
              {result.success ? (
                <>
                  <CheckCircle2 size={40} className="text-green-500 mb-3" />
                  <div className="text-base font-semibold text-gray-900 mb-1">推送成功</div>
                  {result.remoteId && (
                    <div className="text-xs text-gray-400 font-mono">云端 ID: {result.remoteId}</div>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle size={40} className="text-red-500 mb-3" />
                  <div className="text-base font-semibold text-gray-900 mb-1">推送失败</div>
                  <div className="text-xs text-red-500 text-center max-w-xs">{result.message}</div>
                  {result.error && (
                    <div className="mt-2 text-xs text-gray-400 text-center max-w-xs break-all">{result.error}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          {step === "confirm" && (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition">
                取消
              </button>
              <button
                onClick={handlePush}
                disabled={enabledFields.size === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={13} />
                确认推送
              </button>
            </>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
