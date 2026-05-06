/**
 * 本地客户端 DB 存根
 * 替代服务端 db.ts 中的 getIndustryOntology
 * 本地客户端使用内置行业基准数据，无需数据库查询
 */

export interface IndustryOntology {
  id?: number;
  industryCode: string;
  industryName: string;
  // 行业基准指标（用于特征工程比较）
  avgAssetLiabilityRatio?: number | null;
  avgCurrentRatio?: number | null;
  avgQuickRatio?: number | null;
  avgRoe?: number | null;
  avgNetProfitMargin?: number | null;
  avgRevenueGrowthRate?: number | null;
  avgInventoryTurnover?: number | null;
  avgReceivableTurnover?: number | null;
  riskLevel?: string | null;
  description?: string | null;
  f12BaseScore?: number | null;
  dataSource?: string | null;
}

// 内置行业基准数据
const INDUSTRY_BENCHMARKS: IndustryOntology[] = [
  {
    industryCode: "C",
    industryName: "制造业",
    avgAssetLiabilityRatio: 0.55,
    avgCurrentRatio: 1.4,
    avgQuickRatio: 0.9,
    avgRoe: 0.08,
    avgNetProfitMargin: 0.05,
    avgRevenueGrowthRate: 0.08,
    avgInventoryTurnover: 4.5,
    avgReceivableTurnover: 6.0,
    riskLevel: "中",
    f12BaseScore: 70,
    dataSource: "manual",
  },
  {
    industryCode: "F",
    industryName: "批发和零售业",
    avgAssetLiabilityRatio: 0.60,
    avgCurrentRatio: 1.2,
    avgQuickRatio: 0.7,
    avgRoe: 0.10,
    avgNetProfitMargin: 0.03,
    avgRevenueGrowthRate: 0.10,
    avgInventoryTurnover: 8.0,
    avgReceivableTurnover: 10.0,
    riskLevel: "中",
    f12BaseScore: 65,
    dataSource: "manual",
  },
  {
    industryCode: "E",
    industryName: "建筑业",
    avgAssetLiabilityRatio: 0.70,
    avgCurrentRatio: 1.3,
    avgQuickRatio: 1.1,
    avgRoe: 0.12,
    avgNetProfitMargin: 0.04,
    avgRevenueGrowthRate: 0.06,
    avgInventoryTurnover: 3.0,
    avgReceivableTurnover: 3.5,
    riskLevel: "中高",
    f12BaseScore: 55,
    dataSource: "manual",
  },
  {
    industryCode: "I",
    industryName: "信息传输、软件和信息技术服务业",
    avgAssetLiabilityRatio: 0.35,
    avgCurrentRatio: 2.5,
    avgQuickRatio: 2.3,
    avgRoe: 0.15,
    avgNetProfitMargin: 0.12,
    avgRevenueGrowthRate: 0.20,
    avgInventoryTurnover: 15.0,
    avgReceivableTurnover: 8.0,
    riskLevel: "低",
    f12BaseScore: 80,
    dataSource: "manual",
  },
  {
    industryCode: "A",
    industryName: "农、林、牧、渔业",
    avgAssetLiabilityRatio: 0.45,
    avgCurrentRatio: 1.5,
    avgQuickRatio: 0.8,
    avgRoe: 0.06,
    avgNetProfitMargin: 0.08,
    avgRevenueGrowthRate: 0.05,
    avgInventoryTurnover: 3.0,
    avgReceivableTurnover: 5.0,
    riskLevel: "中",
    f12BaseScore: 60,
    dataSource: "manual",
  },
  {
    industryCode: "H",
    industryName: "住宿和餐饮业",
    avgAssetLiabilityRatio: 0.65,
    avgCurrentRatio: 0.9,
    avgQuickRatio: 0.7,
    avgRoe: 0.08,
    avgNetProfitMargin: 0.06,
    avgRevenueGrowthRate: 0.08,
    avgInventoryTurnover: 20.0,
    avgReceivableTurnover: 30.0,
    riskLevel: "中高",
    f12BaseScore: 50,
    dataSource: "manual",
  },
  {
    industryCode: "K",
    industryName: "房地产业",
    avgAssetLiabilityRatio: 0.75,
    avgCurrentRatio: 1.1,
    avgQuickRatio: 0.5,
    avgRoe: 0.10,
    avgNetProfitMargin: 0.10,
    avgRevenueGrowthRate: 0.05,
    avgInventoryTurnover: 0.5,
    avgReceivableTurnover: 2.0,
    riskLevel: "高",
    f12BaseScore: 40,
    dataSource: "manual",
  },
  {
    industryCode: "G",
    industryName: "交通运输、仓储和邮政业",
    avgAssetLiabilityRatio: 0.60,
    avgCurrentRatio: 1.2,
    avgQuickRatio: 1.0,
    avgRoe: 0.08,
    avgNetProfitMargin: 0.07,
    avgRevenueGrowthRate: 0.07,
    avgInventoryTurnover: 10.0,
    avgReceivableTurnover: 8.0,
    riskLevel: "中",
    f12BaseScore: 65,
    dataSource: "manual",
  },
  {
    industryCode: "Q",
    industryName: "卫生和社会工作",
    avgAssetLiabilityRatio: 0.40,
    avgCurrentRatio: 1.8,
    avgQuickRatio: 1.5,
    avgRoe: 0.08,
    avgNetProfitMargin: 0.08,
    avgRevenueGrowthRate: 0.10,
    avgInventoryTurnover: 5.0,
    avgReceivableTurnover: 6.0,
    riskLevel: "低",
    f12BaseScore: 75,
    dataSource: "manual",
  },
  {
    industryCode: "综合",
    industryName: "综合",
    avgAssetLiabilityRatio: 0.55,
    avgCurrentRatio: 1.5,
    avgQuickRatio: 1.0,
    avgRoe: 0.10,
    avgNetProfitMargin: 0.07,
    avgRevenueGrowthRate: 0.08,
    avgInventoryTurnover: 6.0,
    avgReceivableTurnover: 7.0,
    riskLevel: "中",
    f12BaseScore: 60,
    dataSource: "manual",
  },
];

const KEYWORD_MAP: Record<string, string> = {
  "制造": "制造业", "工厂": "制造业", "加工": "制造业", "生产": "制造业",
  "贸易": "批发和零售业", "零售": "批发和零售业", "批发": "批发和零售业", "商贸": "批发和零售业",
  "建筑": "建筑业", "施工": "建筑业", "工程": "建筑业", "装修": "建筑业",
  "科技": "信息传输、软件和信息技术服务业", "软件": "信息传输、软件和信息技术服务业",
  "互联网": "信息传输、软件和信息技术服务业", "IT": "信息传输、软件和信息技术服务业",
  "农业": "农、林、牧、渔业", "农林": "农、林、牧、渔业", "养殖": "农、林、牧、渔业",
  "餐饮": "住宿和餐饮业", "酒店": "住宿和餐饮业", "住宿": "住宿和餐饮业",
  "房地产": "房地产业", "地产": "房地产业", "物业": "房地产业",
  "物流": "交通运输、仓储和邮政业", "运输": "交通运输、仓储和邮政业", "仓储": "交通运输、仓储和邮政业",
  "医疗": "卫生和社会工作", "医院": "卫生和社会工作", "健康": "卫生和社会工作",
};

export async function getIndustryOntology(industryName: string): Promise<IndustryOntology | null> {
  if (!industryName) return null;
  const normalized = industryName.trim();

  // 精确匹配
  const exact = INDUSTRY_BENCHMARKS.find(
    (b) => b.industryCode === normalized || b.industryName === normalized
  );
  if (exact) return exact;

  // 模糊匹配
  const fuzzy = INDUSTRY_BENCHMARKS.find(
    (b) => b.industryName.includes(normalized) || normalized.includes(b.industryName)
  );
  if (fuzzy) return fuzzy;

  // 关键词映射
  const lowerInput = normalized.toLowerCase();
  for (const [keyword, targetName] of Object.entries(KEYWORD_MAP)) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      const mapped = INDUSTRY_BENCHMARKS.find((b) => b.industryName === targetName);
      if (mapped) return mapped;
    }
  }

  // 返回综合行业基准
  return INDUSTRY_BENCHMARKS.find((b) => b.industryCode === "综合") ?? null;
}
