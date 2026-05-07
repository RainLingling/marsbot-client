/**
 * SettingsPage - 系统设置页面
 * 功能：LLM 配置 + SaaS 云端 + 规则库更新 + 隐私设置 + 关于
 */
import React, { useState, useEffect } from "react";
import {
  Settings, Key, Globe, RefreshCw, Shield, Eye, EyeOff,
  CheckCircle2, AlertCircle, ExternalLink,
  Cpu, Database, Save, Server
} from "lucide-react";
import { getRawConfig, saveConfig, type LocalConfig } from "@/lib/localStore";

type TabKey = "llm" | "saas" | "rules" | "privacy" | "about";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "llm",     label: "AI 模型",   icon: <Cpu size={14} /> },
  { key: "saas",    label: "云端同步",   icon: <Server size={14} /> },
  { key: "rules",   label: "规则库",     icon: <Database size={14} /> },
  { key: "privacy", label: "隐私安全",   icon: <Shield size={14} /> },
  { key: "about",   label: "关于",       icon: <Settings size={14} /> },
];

const LLM_PRESETS = [
  { name: "DeepSeek",    url: "https://api.deepseek.com/v1/chat/completions",       model: "deepseek-chat" },
  { name: "通义千问",    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-plus" },
  { name: "OpenAI GPT",  url: "https://api.openai.com/v1/chat/completions",          model: "gpt-4o-mini" },
  { name: "Claude",      url: "https://api.anthropic.com/v1/messages",               model: "claude-3-haiku-20240307" },
  { name: "硅基流动",    url: "https://api.siliconflow.cn/v1/chat/completions",       model: "deepseek-ai/DeepSeek-V3" },
  { name: "自定义",      url: "",                                                     model: "" },
];

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-5 first:mt-0 ${className || ""}`}>
      {children}
    </h3>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("llm");
  const [config, setConfig] = useState<LocalConfig>({});
  const [saved, setSaved] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checkingRules, setCheckingRules] = useState(false);
  const [rulesResult, setRulesResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testingSaas, setTestingSaas] = useState(false);
  const [saasTestResult, setSaasTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setConfig(getRawConfig());
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setField = <K extends keyof LocalConfig>(key: K, val: LocalConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const applyPreset = (preset: typeof LLM_PRESETS[0]) => {
    setConfig(prev => ({ ...prev, llmApiUrl: preset.url, llmModel: preset.model }));
  };

  const testLlm = async () => {
    if (!config.llmApiKey || !config.llmApiUrl) {
      setLlmTestResult({ ok: false, msg: "请先填写 API Key 和 API URL" });
      return;
    }
    setTestingLlm(true);
    setLlmTestResult(null);
    try {
      const resp = await fetch(config.llmApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.llmApiKey}` },
        body: JSON.stringify({
          model: config.llmModel || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Reply with: OK" }],
          max_tokens: 10,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || "";
        setLlmTestResult({ ok: true, msg: `连接成功！模型回复：${content}` });
      } else {
        const err = await resp.text();
        setLlmTestResult({ ok: false, msg: `HTTP ${resp.status}: ${err.slice(0, 100)}` });
      }
    } catch (e) {
      setLlmTestResult({ ok: false, msg: `连接失败：${String(e)}` });
    } finally {
      setTestingLlm(false);
    }
  };

  const testSaas = async () => {
    if (!config.saasUrl) {
      setSaasTestResult({ ok: false, msg: "请先填写 SaaS 地址" });
      return;
    }
    setTestingSaas(true);
    setSaasTestResult(null);
    try {
      const url = config.saasUrl.replace(/\/$/, "") + "/api/health";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.saasApiKey) headers["Authorization"] = `Bearer ${config.saasApiKey}`;
      const resp = await fetch(url, { method: "GET", headers });
      if (resp.ok) {
        setSaasTestResult({ ok: true, msg: "连接成功！服务器状态正常" });
      } else {
        setSaasTestResult({ ok: false, msg: `HTTP ${resp.status}` });
      }
    } catch (e) {
      setSaasTestResult({ ok: false, msg: `连接失败：${String(e)}` });
    } finally {
      setTestingSaas(false);
    }
  };

  const checkRuleUpdate = async () => {
    setCheckingRules(true);
    setRulesResult(null);
    try {
      const updateUrl = config.ruleUpdateUrl ||
        (config.saasUrl ? config.saasUrl.replace(/\/$/, "") + "/api/rules/version" : null);
      if (!updateUrl) {
        setRulesResult({ ok: false, msg: "请先配置 SaaS 地址或规则更新 URL" });
        return;
      }
      const headers: Record<string, string> = {};
      if (config.saasApiKey) headers["Authorization"] = `Bearer ${config.saasApiKey}`;
      const resp = await fetch(updateUrl, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const remoteVer = data.version || data.ruleVersion || "未知";
        const localVer = config.ruleVersion || "v1.0.0";
        if (remoteVer !== localVer) {
          setRulesResult({ ok: true, msg: `发现新版本 ${remoteVer}（当前 ${localVer}），请升级应用程序以更新规则库` });
        } else {
          setRulesResult({ ok: true, msg: `已是最新版本 ${localVer}` });
        }
      } else {
        setRulesResult({ ok: false, msg: `检查失败 HTTP ${resp.status}` });
      }
    } catch (e) {
      setRulesResult({ ok: false, msg: `请求失败：${String(e)}` });
    } finally {
      setCheckingRules(false);
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左侧 Tab 导航 */}
      <div className="w-44 bg-white border-r border-gray-200 flex flex-col py-4">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-semibold text-gray-900">系统设置</h1>
        </div>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition ${
              activeTab === tab.key
                ? "bg-orange-50 text-orange-600 font-medium border-r-2 border-orange-500"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-6">

          {/* ── LLM 配置 ── */}
          {activeTab === "llm" && (
            <div>
              <SectionTitle>快速选择预设</SectionTitle>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {LLM_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                      config.llmApiUrl === p.url && p.url
                        ? "bg-orange-50 border-orange-400 text-orange-600"
                        : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <SectionTitle>API 配置</SectionTitle>
              <FormRow label="API Key" hint="支持 OpenAI 兼容格式（sk-... 或其他格式）">
                <PasswordInput
                  value={config.llmApiKey || ""}
                  onChange={v => setField("llmApiKey", v)}
                  placeholder="sk-..."
                />
              </FormRow>
              <FormRow label="API URL" hint="大模型请求地址">
                <input
                  type="url"
                  value={config.llmApiUrl || ""}
                  onChange={e => setField("llmApiUrl", e.target.value)}
                  placeholder="https://api.deepseek.com/v1/chat/completions"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </FormRow>
              <FormRow label="模型名称">
                <input
                  type="text"
                  value={config.llmModel || ""}
                  onChange={e => setField("llmModel", e.target.value)}
                  placeholder="deepseek-chat"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </FormRow>

              <div className="flex items-center gap-3">
                <button
                  onClick={testLlm}
                  disabled={testingLlm}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  {testingLlm ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  测试连接
                </button>
                {llmTestResult && (
                  <span className={`text-xs flex items-center gap-1 ${
                    llmTestResult.ok ? "text-green-600" : "text-red-500"
                  }`}>
                    {llmTestResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {llmTestResult.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── SaaS 云端 ── */}
          {activeTab === "saas" && (
            <div>
              <SectionTitle>云端 SaaS 连接</SectionTitle>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                配置后可将本地分析结果推送到 Marsbot 云端平台，实现多端协同和数据备份。
              </p>
              <FormRow label="SaaS 地址" hint="例如：https://your-org.marsbot.ai">
                <input
                  type="url"
                  value={config.saasUrl || ""}
                  onChange={e => setField("saasUrl", e.target.value)}
                  placeholder="https://your-org.marsbot.ai"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </FormRow>
              <FormRow label="API Key" hint="在 SaaS 控制台生成">
                <PasswordInput
                  value={config.saasApiKey || ""}
                  onChange={v => setField("saasApiKey", v)}
                  placeholder="mbt-..."
                />
              </FormRow>
              <FormRow label="机构 ID" hint="可选，用于多机构环境">
                <input
                  type="text"
                  value={config.saasOrgId || ""}
                  onChange={e => setField("saasOrgId", e.target.value)}
                  placeholder="org-xxxx"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </FormRow>

              <div className="flex items-center gap-3">
                <button
                  onClick={testSaas}
                  disabled={testingSaas}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  {testingSaas ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />}
                  测试连接
                </button>
                {saasTestResult && (
                  <span className={`text-xs flex items-center gap-1 ${
                    saasTestResult.ok ? "text-green-600" : "text-red-500"
                  }`}>
                    {saasTestResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {saasTestResult.msg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── 规则库 ── */}
          {activeTab === "rules" && (
            <div>
              <SectionTitle>规则库版本</SectionTitle>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">当前版本</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono">{config.ruleVersion || "v1.0.0 (内置)"}</div>
                  </div>
                  <button
                    onClick={checkRuleUpdate}
                    disabled={checkingRules}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  >
                    {checkingRules ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    检查更新
                  </button>
                </div>
                {rulesResult && (
                  <div className={`mt-3 text-xs flex items-start gap-1.5 ${
                    rulesResult.ok ? "text-green-600" : "text-red-500"
                  }`}>
                    {rulesResult.ok ? <CheckCircle2 size={12} className="mt-0.5" /> : <AlertCircle size={12} className="mt-0.5" />}
                    {rulesResult.msg}
                  </div>
                )}
              </div>

              <SectionTitle>更新源</SectionTitle>
              <FormRow label="规则更新 URL" hint="留空则使用 SaaS 地址自动推断">
                <input
                  type="url"
                  value={config.ruleUpdateUrl || ""}
                  onChange={e => setField("ruleUpdateUrl", e.target.value)}
                  placeholder="https://your-org.marsbot.ai/api/rules/version"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </FormRow>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoCheckRules ?? true}
                  onChange={e => setField("autoCheckRules", e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">启动时自动检查规则库更新</span>
              </label>
            </div>
          )}

          {/* ── 隐私安全 ── */}
          {activeTab === "privacy" && (
            <div>
              <SectionTitle>数据处理</SectionTitle>
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl border border-gray-200 bg-white hover:border-orange-300 transition">
                  <input
                    type="checkbox"
                    checked={config.autoDesensitize ?? true}
                    onChange={e => setField("autoDesensitize", e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">推送前自动脱敏</div>
                    <div className="text-xs text-gray-400 mt-0.5">将身份证号、手机号、账号等敏感信息进行模糊处理后再推送</div>
                  </div>
                </label>
              </div>

              <SectionTitle>本地数据</SectionTitle>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-yellow-700">
                    所有分析数据仅存储在本地设备，不会自动上传到任何服务器。云端推送需要您手动确认。
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 关于 ── */}
          {activeTab === "about" && (
            <div>
              <SectionTitle>应用信息</SectionTitle>
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">🐆</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Marsbot 火星豹</div>
                    <div className="text-xs text-gray-400">企业信贷风控本地客户端</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-gray-400">版本</div><div className="text-gray-700 font-mono">v1.0.5</div>
                  <div className="text-gray-400">规则库</div><div className="text-gray-700 font-mono">{config.ruleVersion || "v1.0.0"}</div>
                  <div className="text-gray-400">引擎</div><div className="text-gray-700">Electron + React + sql.js</div>
                  <div className="text-gray-400">分析模型</div><div className="text-gray-700">33条规则 + 38个指标 + 9维度</div>
                </div>
              </div>

              <SectionTitle>技术支持</SectionTitle>
              <div className="space-y-2">
                {[
                  { label: "官方网站", url: "https://marsbot.ai" },
                  { label: "使用文档", url: "https://docs.marsbot.ai" },
                  { label: "技术支持", url: "mailto:support@marsbot.ai" },
                ].map(link => (
                  <button
                    key={link.label}
                    onClick={() => (window as any).electronAPI?.openExternal?.(link.url)}
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition text-sm text-gray-700"
                  >
                    {link.label}
                    <ExternalLink size={13} className="text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 保存按钮 */}
          {activeTab !== "about" && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition ${
                  saved
                    ? "bg-green-500 text-white"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saved ? "已保存" : "保存设置"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
