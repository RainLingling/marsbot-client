/**
 * ForceGraphPanel - D3 力导向图实例视图
 * 基于真实解析数据渲染企业知识图谱（企业→法人→关联方→账户→税务等）
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw, Info } from "lucide-react";
import { GraphReader, type GraphEntity } from "@/engine/graphDb";
import type { AppData, AnalysisResult } from "./panelTypes";

// ─── 图谱节点/边类型 ──────────────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  color: string;
  radius: number;
  properties?: Record<string, unknown>;
  isCore?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  label: string;
  type: string;
  color: string;
}

// ─── 节点类型配置 ─────────────────────────────────────────────────────────────

const NODE_STYLES: Record<string, { color: string; radius: number; emoji: string }> = {
  Company:              { color: "#1d4ed8", radius: 28, emoji: "🏢" },
  BusinessLicense:      { color: "#2563eb", radius: 20, emoji: "📄" },
  LegalRepresentative:  { color: "#7c3aed", radius: 22, emoji: "👤" },
  ActualController:     { color: "#9333ea", radius: 20, emoji: "👑" },
  Shareholder:          { color: "#a855f7", radius: 18, emoji: "💼" },
  BankAccount:          { color: "#059669", radius: 22, emoji: "🏦" },
  BankTransaction:      { color: "#10b981", radius: 14, emoji: "💳" },
  BalanceSheet:         { color: "#0891b2", radius: 20, emoji: "📊" },
  IncomeStatement:      { color: "#0ea5e9", radius: 20, emoji: "📈" },
  CashFlowStatement:    { color: "#38bdf8", radius: 20, emoji: "💵" },
  TaxDeclaration:       { color: "#dc2626", radius: 18, emoji: "🧾" },
  TaxCertificate:       { color: "#ef4444", radius: 18, emoji: "✅" },
  TaxCredit:            { color: "#f97316", radius: 18, emoji: "⭐" },
  AuditReport:          { color: "#d97706", radius: 18, emoji: "📋" },
  Top5Customer:         { color: "#16a34a", radius: 16, emoji: "🤝" },
  Top5Supplier:         { color: "#15803d", radius: 16, emoji: "📦" },
  AnalysisResult:       { color: "#be123c", radius: 24, emoji: "🎯" },
  FeatureVector:        { color: "#9f1239", radius: 16, emoji: "🔢" },
  default:              { color: "#6b7280", radius: 16, emoji: "⬡" },
};

const LINK_STYLES: Record<string, { color: string; label: string }> = {
  HAS_LICENSE:          { color: "#93c5fd", label: "持有" },
  HAS_LEGAL_REP:        { color: "#c4b5fd", label: "法定代表人" },
  HAS_CONTROLLER:       { color: "#d8b4fe", label: "实际控制人" },
  HAS_SHAREHOLDER:      { color: "#e9d5ff", label: "股东" },
  HAS_BANK_ACCOUNT:     { color: "#6ee7b7", label: "开户" },
  HAS_TRANSACTION:      { color: "#a7f3d0", label: "流水" },
  HAS_BALANCE_SHEET:    { color: "#7dd3fc", label: "资产负债表" },
  HAS_INCOME_STMT:      { color: "#93c5fd", label: "利润表" },
  HAS_CASHFLOW_STMT:    { color: "#bae6fd", label: "现金流量表" },
  HAS_TAX_DECL:         { color: "#fca5a5", label: "税务申报" },
  HAS_TAX_CERT:         { color: "#fca5a5", label: "完税证明" },
  HAS_TAX_CREDIT:       { color: "#fdba74", label: "纳税信用" },
  HAS_AUDIT_REPORT:     { color: "#fde68a", label: "审计报告" },
  HAS_CUSTOMER:         { color: "#86efac", label: "客户" },
  HAS_SUPPLIER:         { color: "#6ee7b7", label: "供应商" },
  HAS_ANALYSIS:         { color: "#fda4af", label: "分析结论" },
  default:              { color: "#d1d5db", label: "" },
};

// ─── 从 AppData 构建图谱数据 ──────────────────────────────────────────────────

function buildGraphFromAppData(
  appData: AppData,
  analysisResult: AnalysisResult | null,
  localEntities: GraphEntity[]
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const addedIds = new Set<string>();

  const addNode = (node: GraphNode) => {
    if (!addedIds.has(node.id)) {
      addedIds.add(node.id);
      nodes.push(node);
    }
  };

  const addLink = (link: GraphLink) => {
    links.push(link);
  };

  const companyName = appData.companyName || "申请企业";
  const coreId = "company_core";

  // 核心企业节点
  addNode({
    id: coreId,
    label: companyName.length > 12 ? companyName.slice(0, 12) + "…" : companyName,
    type: "Company",
    color: NODE_STYLES.Company.color,
    radius: NODE_STYLES.Company.radius,
    isCore: true,
    properties: { companyName, creditCode: appData.creditCode },
  });

  // 从本地图谱实体构建节点
  if (localEntities.length > 0) {
    for (const entity of localEntities) {
      const style = NODE_STYLES[entity.type] || NODE_STYLES.default;
      const label = (() => {
        const p = entity.properties || {};
        if (p.companyName) return String(p.companyName).slice(0, 12);
        if (p.name) return String(p.name).slice(0, 12);
        if (p.month) return String(p.month);
        if (p.year) return String(p.year);
        return entity.type;
      })();

      const nodeId = `entity_${entity.entityId}`;
      addNode({
        id: nodeId,
        label,
        type: entity.type,
        color: style.color,
        radius: style.radius,
        properties: entity.properties || {},
      });

      // 根据实体类型建立与核心企业的关系
      const relTypeMap: Record<string, string> = {
        BusinessLicense: "HAS_LICENSE",
        LegalRepresentative: "HAS_LEGAL_REP",
        ActualController: "HAS_CONTROLLER",
        Shareholder: "HAS_SHAREHOLDER",
        BankAccount: "HAS_BANK_ACCOUNT",
        BankTransaction: "HAS_TRANSACTION",
        BalanceSheet: "HAS_BALANCE_SHEET",
        IncomeStatement: "HAS_INCOME_STMT",
        CashFlowStatement: "HAS_CASHFLOW_STMT",
        TaxDeclaration: "HAS_TAX_DECL",
        TaxCertificate: "HAS_TAX_CERT",
        TaxCredit: "HAS_TAX_CREDIT",
        AuditReport: "HAS_AUDIT_REPORT",
        Top5Customer: "HAS_CUSTOMER",
        Top5Supplier: "HAS_SUPPLIER",
        AnalysisResult: "HAS_ANALYSIS",
      };
      const relType = relTypeMap[entity.type] || "default";
      const relStyle = LINK_STYLES[relType] || LINK_STYLES.default;
      addLink({
        id: `link_${coreId}_${nodeId}`,
        source: coreId,
        target: nodeId,
        label: relStyle.label,
        type: relType,
        color: relStyle.color,
      });
    }
    return { nodes, links };
  }

  // 降级：从 appData 直接构建（无图谱数据时）
  const bl = (appData as any).business_license || (appData as any).bizLicense;
  if (bl?.legalPerson) {
    const lrId = "legal_rep";
    addNode({ id: lrId, label: bl.legalPerson, type: "LegalRepresentative", color: NODE_STYLES.LegalRepresentative.color, radius: NODE_STYLES.LegalRepresentative.radius });
    addLink({ id: `link_${coreId}_${lrId}`, source: coreId, target: lrId, label: "法定代表人", type: "HAS_LEGAL_REP", color: LINK_STYLES.HAS_LEGAL_REP.color });
  }

  const bankData = (appData as any).bankData || (appData as any).bank_statements;
  if (bankData) {
    const bankId = "bank_account";
    addNode({ id: bankId, label: "银行账户", type: "BankAccount", color: NODE_STYLES.BankAccount.color, radius: NODE_STYLES.BankAccount.radius });
    addLink({ id: `link_${coreId}_${bankId}`, source: coreId, target: bankId, label: "开户", type: "HAS_BANK_ACCOUNT", color: LINK_STYLES.HAS_BANK_ACCOUNT.color });
  }

  const fsData = (appData as any).financial_statements || (appData as any).financialStatements;
  if (fsData) {
    const bsId = "balance_sheet";
    addNode({ id: bsId, label: "资产负债表", type: "BalanceSheet", color: NODE_STYLES.BalanceSheet.color, radius: NODE_STYLES.BalanceSheet.radius });
    addLink({ id: `link_${coreId}_${bsId}`, source: coreId, target: bsId, label: "资产负债表", type: "HAS_BALANCE_SHEET", color: LINK_STYLES.HAS_BALANCE_SHEET.color });
  }

  const taxData = (appData as any).taxData || (appData as any).tax_data;
  if (taxData) {
    const taxId = "tax_decl";
    addNode({ id: taxId, label: "税务数据", type: "TaxDeclaration", color: NODE_STYLES.TaxDeclaration.color, radius: NODE_STYLES.TaxDeclaration.radius });
    addLink({ id: `link_${coreId}_${taxId}`, source: coreId, target: taxId, label: "税务申报", type: "HAS_TAX_DECL", color: LINK_STYLES.HAS_TAX_DECL.color });
  }

  if (analysisResult) {
    const arId = "analysis_result";
    const score = (analysisResult as any).score;
    addNode({ id: arId, label: score ? `评分 ${score}` : "分析结论", type: "AnalysisResult", color: NODE_STYLES.AnalysisResult.color, radius: NODE_STYLES.AnalysisResult.radius });
    addLink({ id: `link_${coreId}_${arId}`, source: coreId, target: arId, label: "分析结论", type: "HAS_ANALYSIS", color: LINK_STYLES.HAS_ANALYSIS.color });
  }

  return { nodes, links };
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

interface ForceGraphPanelProps {
  appData: AppData;
  analysisResult: AnalysisResult | null;
}

export function ForceGraphPanel({ appData, analysisResult }: ForceGraphPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [localEntities, setLocalEntities] = useState<GraphEntity[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);

  // 加载本地图谱数据
  const applicationId = (analysisResult as any)?.applicationId;
  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    GraphReader.getEntities(String(applicationId))
      .then(entities => setLocalEntities(entities))
      .catch(e => console.warn("[ForceGraphPanel] Failed to load local entities:", e))
      .finally(() => setLoading(false));
  }, [applicationId]);

  // 渲染 D3 力导向图
  const renderGraph = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;

    const { nodes, links } = buildGraphFromAppData(appData, analysisResult, localEntities);
    setNodeCount(nodes.length);
    setLinkCount(links.length);

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // 清空 SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // 缩放层
    const g = svg.append("g");

    // 缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // 箭头标记
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#d1d5db");

    // 力模拟
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
          const target = d.target as GraphNode;
          return target.isCore ? 80 : 120;
        })
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius(d => d.radius + 10));

    simulationRef.current = simulation;

    // 绘制边
    const link = g.append("g").selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", d => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.7)
      .attr("marker-end", "url(#arrow)");

    // 边标签
    const linkLabel = g.append("g").selectAll("text")
      .data(links.filter(l => l.label))
      .enter().append("text")
      .attr("font-size", 9)
      .attr("fill", "#9ca3af")
      .attr("text-anchor", "middle")
      .text(d => d.label);

    // 绘制节点组
    const nodeGroup = g.append("g").selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (_, d) => setSelectedNode(d));

    // 节点圆形背景
    nodeGroup.append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("fill-opacity", d => d.isCore ? 1 : 0.85)
      .attr("stroke", d => d.isCore ? "#fff" : "transparent")
      .attr("stroke-width", d => d.isCore ? 3 : 0);

    // 节点 emoji
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", d => d.radius * 0.7)
      .attr("y", -3)
      .text(d => NODE_STYLES[d.type]?.emoji || "⬡");

    // 节点标签
    nodeGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("y", d => d.radius + 12)
      .attr("font-size", 10)
      .attr("fill", "#374151")
      .attr("font-weight", d => d.isCore ? "600" : "400")
      .text(d => d.label);

    // 力模拟 tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x || 0)
        .attr("y1", d => (d.source as GraphNode).y || 0)
        .attr("x2", d => (d.target as GraphNode).x || 0)
        .attr("y2", d => (d.target as GraphNode).y || 0);

      linkLabel
        .attr("x", d => (((d.source as GraphNode).x || 0) + ((d.target as GraphNode).x || 0)) / 2)
        .attr("y", d => (((d.source as GraphNode).y || 0) + ((d.target as GraphNode).y || 0)) / 2);

      nodeGroup.attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // 初始缩放适配
    setTimeout(() => {
      const bounds = (g.node() as SVGGElement)?.getBBox();
      if (bounds && bounds.width > 0) {
        const scale = Math.min(0.9, Math.min(width / bounds.width, height / bounds.height) * 0.8);
        const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
        const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;
        svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }, 800);
  }, [appData, analysisResult, localEntities]);

  useEffect(() => {
    renderGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [renderGraph]);

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().call(
      (d3.zoom<SVGSVGElement, unknown>() as any).scaleBy, 1.4
    );
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().call(
      (d3.zoom<SVGSVGElement, unknown>() as any).scaleBy, 0.7
    );
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().call(
      (d3.zoom<SVGSVGElement, unknown>() as any).transform, d3.zoomIdentity
    );
  };

  const companyName = appData.companyName || "申请企业";

  return (
    <div className="flex flex-col h-full">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-orange-500" />
          <span className="text-xs font-semibold text-gray-700">{companyName} — 知识图谱实例</span>
          {loading && <RefreshCw size={12} className="text-gray-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-400">{nodeCount} 节点 · {linkCount} 关系</span>
          <div className="flex items-center gap-1">
            <button onClick={handleZoomIn} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition">
              <ZoomIn size={13} />
            </button>
            <button onClick={handleZoomOut} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition">
              <ZoomOut size={13} />
            </button>
            <button onClick={handleReset} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition">
              <Maximize2 size={13} />
            </button>
            <button onClick={renderGraph} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 图谱区域 */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 relative bg-white">
          <svg ref={svgRef} className="w-full h-full" />

          {/* 无数据提示 */}
          {nodeCount <= 1 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none">
              <Network size={40} className="mb-3 opacity-20" />
              <div className="text-sm">完成分析后将自动构建图谱实例</div>
              <div className="text-xs mt-1">节点数据来源：营业执照、银行流水、财务报表、税务数据</div>
            </div>
          )}
        </div>

        {/* 右侧节点详情 */}
        {selectedNode && (
          <div className="w-56 flex-shrink-0 border-l border-gray-100 bg-gray-50 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">节点详情</span>
                <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">
                  <Info size={12} />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ backgroundColor: selectedNode.color }}
                >
                  {NODE_STYLES[selectedNode.type]?.emoji || "⬡"}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-800">{selectedNode.label}</div>
                  <div className="text-[10px] text-gray-400">{selectedNode.type}</div>
                </div>
              </div>
              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(selectedNode.properties).slice(0, 15).map(([key, val]) => (
                    <div key={key} className="flex gap-1.5">
                      <span className="text-[10px] text-gray-400 flex-shrink-0 w-20 truncate">{key}</span>
                      <span className="text-[10px] text-gray-700 flex-1 break-all">
                        {val == null ? "—" : typeof val === "number" ? val.toLocaleString() : String(val).slice(0, 50)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex-wrap">
        {[
          { type: "Company", label: "申请企业" },
          { type: "LegalRepresentative", label: "法人" },
          { type: "BankAccount", label: "银行账户" },
          { type: "BalanceSheet", label: "财务报表" },
          { type: "TaxDeclaration", label: "税务" },
          { type: "AnalysisResult", label: "分析结论" },
          { type: "Top5Customer", label: "客户/供应商" },
        ].map(item => (
          <div key={item.type} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_STYLES[item.type]?.color || "#6b7280" }}
            />
            <span className="text-[10px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ForceGraphPanel;
