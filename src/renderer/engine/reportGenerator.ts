/**
 * reportGenerator.ts - 报告生成模块
 * 功能：
 * 1. 生成 Markdown 格式的贷款分析报告
 * 2. 通过 Electron IPC 保存为本地文件（.md 或 .pdf）
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

interface AnalysisResult {
  score?: number;
  verdict?: string;
  recommendedAmount?: string;
  dimensions?: Record<string, { score: number; label: string; issues?: string[] }>;
  triggeredRules?: { code: string; level: string; description: string }[];
  features?: Record<string, number | string | null>;
}

interface AppData {
  business_license?: {
    companyName?: string;
    creditCode?: string;
    legalPerson?: string;
    registeredCapital?: string;
    establishDate?: string;
    address?: string;
    businessScope?: string;
  };
  financial_statements?: {
    totalAssets?: number;
    totalLiabilities?: number;
    ownersEquity?: number;
    revenue?: number;
    netProfit?: number;
    operatingCashFlow?: number;
    year?: string | number;
  }[];
  bank_statements?: {
    month?: string;
    totalInflow?: number;
    totalOutflow?: number;
    netCashFlow?: number;
  }[];
  tax_data?: {
    vatAmount?: number;
    citAmount?: number;
    taxCreditLevel?: string;
    taxPeriod?: string;
  };
  top5_customers?: { name?: string; amount?: number; ratio?: number }[];
  top5_suppliers?: { name?: string; amount?: number; ratio?: number }[];
  audit_report?: {
    opinionType?: string;
    cpaFirm?: string;
    auditYear?: string;
  };
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, unit = "万元"): string {
  if (n == null || isNaN(n)) return "—";
  const val = Math.round(n / 10000);
  return `${val.toLocaleString()} ${unit}`;
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function verdictLabel(v: string | undefined): string {
  if (v === "approved") return "✅ 建议通过";
  if (v === "rejected") return "❌ 建议拒绝";
  if (v === "conditional") return "⚠️ 建议有条件通过";
  return v || "—";
}

function ruleLevel(level: string): string {
  if (level === "P0") return "🔴 P0（一票否决）";
  if (level === "P1") return "🟠 P1（重大风险）";
  return "🟡 P2（一般风险）";
}

// ─── Markdown 报告生成 ────────────────────────────────────────────────────────

export function generateMarkdownReport(
  companyName: string,
  recordId: string,
  appData: AppData,
  analysisResult: AnalysisResult | undefined
): string {
  const now = new Date().toLocaleString("zh-CN");
  const bl = appData.business_license;
  const fs = appData.financial_statements?.[0];
  const bs = appData.bank_statements;
  const tax = appData.tax_data;
  const ar = analysisResult;

  const lines: string[] = [];

  // 封面
  lines.push(`# 贷款申请分析报告`);
  lines.push(``);
  lines.push(`> **企业名称：** ${companyName}`);
  lines.push(`> **申请编号：** ${recordId}`);
  lines.push(`> **生成时间：** ${now}`);
  lines.push(`> **生成工具：** Marsbot 火星豹 v1.0.5`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // 综合结论
  lines.push(`## 一、综合结论`);
  lines.push(``);
  if (ar) {
    lines.push(`| 项目 | 结果 |`);
    lines.push(`|---|---|`);
    lines.push(`| 综合评分 | **${ar.score ?? "—"} 分**（满分 1000 分） |`);
    lines.push(`| 审批建议 | ${verdictLabel(ar.verdict)} |`);
    lines.push(`| 建议额度 | **${ar.recommendedAmount ?? "—"}** |`);
  } else {
    lines.push(`*暂无分析结论，请先完成分析。*`);
  }
  lines.push(``);

  // 九维度评分
  if (ar?.dimensions && Object.keys(ar.dimensions).length > 0) {
    lines.push(`## 二、九维度评分`);
    lines.push(``);
    lines.push(`| 维度 | 得分 | 主要问题 |`);
    lines.push(`|---|---|---|`);
    for (const [, dim] of Object.entries(ar.dimensions)) {
      const issues = dim.issues?.join("；") || "无";
      lines.push(`| ${dim.label} | ${dim.score} | ${issues} |`);
    }
    lines.push(``);
  }

  // 触发规则
  if (ar?.triggeredRules && ar.triggeredRules.length > 0) {
    lines.push(`## 三、触发风险规则`);
    lines.push(``);
    for (const rule of ar.triggeredRules) {
      lines.push(`- ${ruleLevel(rule.level)} \`${rule.code}\` ${rule.description}`);
    }
    lines.push(``);
  }

  // 企业基本信息
  lines.push(`## 四、企业基本信息`);
  lines.push(``);
  if (bl) {
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|---|---|`);
    if (bl.companyName) lines.push(`| 企业名称 | ${bl.companyName} |`);
    if (bl.creditCode) lines.push(`| 统一社会信用代码 | \`${bl.creditCode}\` |`);
    if (bl.legalPerson) lines.push(`| 法定代表人 | ${bl.legalPerson} |`);
    if (bl.registeredCapital) lines.push(`| 注册资本 | ${bl.registeredCapital} |`);
    if (bl.establishDate) lines.push(`| 成立日期 | ${bl.establishDate} |`);
    if (bl.address) lines.push(`| 注册地址 | ${bl.address} |`);
    if (bl.businessScope) lines.push(`| 经营范围 | ${bl.businessScope.slice(0, 100)}${bl.businessScope.length > 100 ? "…" : ""} |`);
  } else {
    lines.push(`*未上传营业执照*`);
  }
  lines.push(``);

  // 财务状况
  lines.push(`## 五、财务状况`);
  lines.push(``);
  if (fs) {
    lines.push(`| 科目 | 金额 |`);
    lines.push(`|---|---|`);
    if (fs.totalAssets) lines.push(`| 总资产 | ${fmt(fs.totalAssets)} |`);
    if (fs.totalLiabilities) lines.push(`| 总负债 | ${fmt(fs.totalLiabilities)} |`);
    if (fs.ownersEquity) lines.push(`| 所有者权益 | ${fmt(fs.ownersEquity)} |`);
    if (fs.revenue) lines.push(`| 营业收入 | ${fmt(fs.revenue)} |`);
    if (fs.netProfit) lines.push(`| 净利润 | ${fmt(fs.netProfit)} |`);
    if (fs.operatingCashFlow) lines.push(`| 经营活动现金流 | ${fmt(fs.operatingCashFlow)} |`);
    if (fs.year) lines.push(`| 报告期 | ${fs.year} |`);
  } else {
    lines.push(`*未上传财务报表*`);
  }
  lines.push(``);

  // 银行流水摘要
  lines.push(`## 六、银行流水摘要`);
  lines.push(``);
  if (bs && bs.length > 0) {
    lines.push(`| 月份 | 收入 | 支出 | 净现金流 |`);
    lines.push(`|---|---|---|---|`);
    for (const row of bs.slice(0, 12)) {
      lines.push(`| ${row.month || "—"} | ${fmt(row.totalInflow)} | ${fmt(row.totalOutflow)} | ${fmt(row.netCashFlow)} |`);
    }
    const totalIn = bs.reduce((s, r) => s + (r.totalInflow || 0), 0);
    const totalOut = bs.reduce((s, r) => s + (r.totalOutflow || 0), 0);
    lines.push(`| **合计** | **${fmt(totalIn)}** | **${fmt(totalOut)}** | **${fmt(totalIn - totalOut)}** |`);
  } else {
    lines.push(`*未上传银行流水*`);
  }
  lines.push(``);

  // 税务数据
  lines.push(`## 七、税务数据`);
  lines.push(``);
  if (tax) {
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|---|---|`);
    if (tax.vatAmount) lines.push(`| 增值税 | ${fmt(tax.vatAmount)} |`);
    if (tax.citAmount) lines.push(`| 企业所得税 | ${fmt(tax.citAmount)} |`);
    if (tax.taxCreditLevel) lines.push(`| 纳税信用等级 | **${tax.taxCreditLevel}** |`);
    if (tax.taxPeriod) lines.push(`| 申报期间 | ${tax.taxPeriod} |`);
  } else {
    lines.push(`*未上传税务数据*`);
  }
  lines.push(``);

  // TOP5 客户/供应商
  if (appData.top5_customers?.length || appData.top5_suppliers?.length) {
    lines.push(`## 八、主要客户与供应商`);
    lines.push(``);
    if (appData.top5_customers?.length) {
      lines.push(`**TOP5 客户：**`);
      lines.push(``);
      lines.push(`| 客户名称 | 销售额 | 占比 |`);
      lines.push(`|---|---|---|`);
      for (const c of appData.top5_customers) {
        lines.push(`| ${c.name || "—"} | ${fmt(c.amount)} | ${fmtPct(c.ratio)} |`);
      }
      lines.push(``);
    }
    if (appData.top5_suppliers?.length) {
      lines.push(`**TOP5 供应商：**`);
      lines.push(``);
      lines.push(`| 供应商名称 | 采购额 | 占比 |`);
      lines.push(`|---|---|---|`);
      for (const s of appData.top5_suppliers) {
        lines.push(`| ${s.name || "—"} | ${fmt(s.amount)} | ${fmtPct(s.ratio)} |`);
      }
      lines.push(``);
    }
  }

  // 审计报告
  if (appData.audit_report) {
    lines.push(`## 九、审计报告`);
    lines.push(``);
    const audit = appData.audit_report;
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|---|---|`);
    if (audit.opinionType) lines.push(`| 审计意见 | ${audit.opinionType} |`);
    if (audit.cpaFirm) lines.push(`| 会计师事务所 | ${audit.cpaFirm} |`);
    if (audit.auditYear) lines.push(`| 审计年度 | ${audit.auditYear} |`);
    lines.push(``);
  }

  // 免责声明
  lines.push(`---`);
  lines.push(``);
  lines.push(`*本报告由 Marsbot 火星豹 AI 辅助生成，仅供参考，不构成最终信贷决策依据。最终决策需由授权信贷人员审核确认。*`);
  lines.push(``);

  return lines.join("\n");
}

// ─── 导出文件 ─────────────────────────────────────────────────────────────────

export async function exportReportAsMarkdown(
  companyName: string,
  recordId: string,
  appData: AppData,
  analysisResult: AnalysisResult | undefined
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const markdown = generateMarkdownReport(companyName, recordId, appData, analysisResult);
  const fileName = `${companyName}_贷款分析报告_${new Date().toISOString().slice(0, 10)}.md`;

  // 通过 Electron IPC 保存文件
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.saveAs) {
    try {
      const result = await electronAPI.saveAs({
        defaultName: fileName,
        filters: [{ name: "Markdown 文件", extensions: ["md"] }],
        content: markdown,
      });
      if (result?.filePath) {
        return { success: true, filePath: result.filePath };
      }
      return { success: false, error: "用户取消保存" };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // 降级：浏览器下载
  try {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function exportReportAsPdf(
  companyName: string,
  recordId: string,
  appData: AppData,
  analysisResult: AnalysisResult | undefined
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const markdown = generateMarkdownReport(companyName, recordId, appData, analysisResult);
  const fileName = `${companyName}_贷款分析报告_${new Date().toISOString().slice(0, 10)}.pdf`;

  // 通过 Electron IPC 保存 PDF（主进程用 puppeteer/electron.webContents.printToPDF）
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.exportPdf) {
    try {
      const result = await electronAPI.exportPdf({
        defaultName: fileName,
        markdownContent: markdown,
      });
      if (result?.filePath) {
        return { success: true, filePath: result.filePath };
      }
      return { success: false, error: "用户取消保存" };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // 降级：触发浏览器打印对话框（Electron 中会弹出系统打印/保存PDF）
  window.print();
  return { success: true };
}
