/**
 * Marsbot Client - SQLite 图谱层（Layer 2）
 *
 * 架构原则：图谱即总线
 *   - 所有解析结果经 GraphWriter 写入 SQLite
 *   - 所有引擎层模块经 GraphReader 读取数据
 *   - 渲染进程使用 sql.js（WASM），通过 IPC 持久化到主进程文件系统
 *
 * 表结构：
 *   entities   (id, type, company_id, application_id, properties JSON)
 *   relations  (id, type, source_id, target_id, application_id, properties JSON)
 *   applications (id, company_name, status, analysis_result JSON, created_at, updated_at)
 */

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type EntityType =
  | "Company"              // 申请企业
  | "LegalRepresentative"  // 法定代表人
  | "ActualController"     // 实际控制人
  | "Shareholder"          // 股东
  | "BankAccount"          // 银行账户
  | "BankTransaction"      // 银行交易（月度汇总）
  | "BalanceSheet"         // 资产负债表（某一期）
  | "IncomeStatement"      // 利润表（某一期）
  | "CashFlowStatement"    // 现金流量表（某一期）
  | "TaxDeclaration"       // 税务申报
  | "TaxCertificate"       // 完税证明
  | "TaxCredit"            // 纳税信用等级
  | "AuditReport"          // 审计报告
  | "BusinessLicense"      // 营业执照
  | "Top5Customer"         // TOP5 客户
  | "Top5Supplier"         // TOP5 供应商
  | "GuaranteeRecord"      // 担保记录
  | "CreditFacility"       // 他行授信
  | "FeatureVector"        // 特征向量（引擎层产出）
  | "AnalysisResult";      // 分析结论（引擎层产出）

export type RelationType =
  | "HAS_LEGAL_REP"        // 企业 → 法定代表人
  | "HAS_CONTROLLER"       // 企业 → 实际控制人
  | "HAS_SHAREHOLDER"      // 企业 → 股东
  | "OWNS_ACCOUNT"         // 企业 → 银行账户
  | "HAS_TRANSACTION"      // 银行账户 → 月度交易
  | "HAS_BALANCE_SHEET"    // 企业 → 资产负债表
  | "HAS_INCOME_STMT"      // 企业 → 利润表
  | "HAS_CASHFLOW_STMT"    // 企业 → 现金流量表
  | "HAS_TAX_DECL"         // 企业 → 税务申报
  | "HAS_TAX_CERT"         // 企业 → 完税证明
  | "HAS_TAX_CREDIT"       // 企业 → 纳税信用
  | "HAS_AUDIT_REPORT"     // 企业 → 审计报告
  | "HAS_BUSINESS_LICENSE" // 企业 → 营业执照
  | "TOP5_CUSTOMER"        // 企业 → TOP5客户
  | "TOP5_SUPPLIER"        // 企业 → TOP5供应商
  | "HAS_GUARANTEE"        // 企业 → 担保记录
  | "HAS_CREDIT_FACILITY"  // 企业 → 他行授信
  | "HAS_FEATURE_VECTOR"   // 企业 → 特征向量
  | "HAS_ANALYSIS_RESULT"; // 企业 → 分析结论

export interface GraphEntity {
  id: string;
  type: EntityType;
  companyId: string;
  applicationId: string;
  properties: Record<string, unknown>;
  createdAt?: string;
}

export interface GraphRelation {
  id: string;
  type: RelationType;
  sourceId: string;
  targetId: string;
  applicationId: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
}

// ─── IPC 桥接（渲染进程 → 主进程文件系统）────────────────────────────────────

async function ipcReadDb(): Promise<Uint8Array | null> {
  try {
    const electronAPI = (window as unknown as { electronAPI?: { invoke?: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electronAPI;
    if (!electronAPI?.invoke) return null;
    const result = await electronAPI.invoke("db:readFile") as { success: boolean; data: string | null };
    if (!result.success || !result.data) return null;
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function ipcWriteDb(db: SqlJsDatabase): Promise<void> {
  try {
    const electronAPI = (window as unknown as { electronAPI?: { invoke?: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electronAPI;
    if (!electronAPI?.invoke) return;
    const data = db.export();
    const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(binary);
    await electronAPI.invoke("db:writeFile", base64);
  } catch (e) {
    console.error("[GraphDB] Failed to persist db:", e);
  }
}

// ─── sql.js 类型（轻量声明，避免引入完整类型包）─────────────────────────────

interface SqlJsStmt {
  step(): boolean;
  getAsObject(params?: Record<string, unknown>): Record<string, unknown>;
  free(): void;
  run(params?: unknown[]): void;
  reset(): void;
}

interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  prepare(sql: string): SqlJsStmt;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatic {
  Database(data?: Uint8Array | null): SqlJsDatabase;
}

// ─── 单例数据库实例 ───────────────────────────────────────────────────────────

let _db: SqlJsDatabase | null = null;
let _initPromise: Promise<SqlJsDatabase> | null = null;

const DDL = `
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  analysis_result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  company_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE INDEX IF NOT EXISTS idx_entities_app ON entities(application_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type, application_id);
CREATE INDEX IF NOT EXISTS idx_entities_company ON entities(company_id, application_id);
CREATE INDEX IF NOT EXISTS idx_relations_app ON relations(application_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
`;

export async function getGraphDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // 动态加载 sql.js（WASM）
    const initSqlJs = (await import("sql.js")).default as (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
    });

    // 尝试从主进程读取已有数据库文件
    const existingData = await ipcReadDb();
    const db: SqlJsDatabase = existingData
      ? SQL.Database(existingData)
      : SQL.Database();

    // 建表（幂等）
    db.run(DDL);

    // 持久化（写回文件）
    await ipcWriteDb(db);

    _db = db;
    return db;
  })();

  return _initPromise;
}

/** 重置单例（测试用 / 重新加载） */
export function resetGraphDb(): void {
  _db = null;
  _initPromise = null;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function toJson(obj: unknown): string {
  try { return JSON.stringify(obj ?? {}); } catch { return '{}'; }
}

function fromJson(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

// ─── GraphWriter ──────────────────────────────────────────────────────────────

export const GraphWriter = {
  /** 写入或更新 application 记录 */
  async upsertApplication(params: {
    applicationId: string;
    companyName: string;
    status?: string;
    analysisResult?: Record<string, unknown>;
  }): Promise<void> {
    const db = await getGraphDb();
    const ts = now();
    db.run(`
      INSERT INTO applications (id, company_name, status, analysis_result, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company_name = excluded.company_name,
        status = excluded.status,
        analysis_result = excluded.analysis_result,
        updated_at = excluded.updated_at
    `, [
      params.applicationId,
      params.companyName,
      params.status ?? 'draft',
      params.analysisResult ? toJson(params.analysisResult) : null,
      ts, ts,
    ]);
    await ipcWriteDb(db);
  },

  /** 写入单个实体（upsert by id） */
  async upsertEntity(entity: Omit<GraphEntity, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
    const db = await getGraphDb();
    const id = entity.id ?? genId(entity.type.toLowerCase());
    const ts = now();
    db.run(`
      INSERT INTO entities (id, type, company_id, application_id, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        properties = excluded.properties
    `, [id, entity.type, entity.companyId, entity.applicationId, toJson(entity.properties), ts]);
    await ipcWriteDb(db);
    return id;
  },

  /** 批量写入实体 */
  async upsertEntities(entities: (Omit<GraphEntity, 'id' | 'createdAt'> & { id?: string })[]): Promise<string[]> {
    if (entities.length === 0) return [];
    const db = await getGraphDb();
    const ts = now();
    const ids: string[] = [];
    for (const entity of entities) {
      const id = entity.id ?? genId(entity.type.toLowerCase());
      ids.push(id);
      db.run(`
        INSERT INTO entities (id, type, company_id, application_id, properties, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET properties = excluded.properties
      `, [id, entity.type, entity.companyId, entity.applicationId, toJson(entity.properties), ts]);
    }
    await ipcWriteDb(db);
    return ids;
  },

  /** 写入关系 */
  async upsertRelation(relation: Omit<GraphRelation, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
    const db = await getGraphDb();
    const id = relation.id ?? genId('rel');
    const ts = now();
    db.run(`
      INSERT INTO relations (id, type, source_id, target_id, application_id, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET properties = excluded.properties
    `, [id, relation.type, relation.sourceId, relation.targetId, relation.applicationId, toJson(relation.properties ?? {}), ts]);
    await ipcWriteDb(db);
    return id;
  },

  /** 批量写入关系 */
  async upsertRelations(relations: (Omit<GraphRelation, 'id' | 'createdAt'> & { id?: string })[]): Promise<void> {
    if (relations.length === 0) return;
    const db = await getGraphDb();
    const ts = now();
    for (const rel of relations) {
      const id = rel.id ?? genId('rel');
      db.run(`
        INSERT INTO relations (id, type, source_id, target_id, application_id, properties, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET properties = excluded.properties
      `, [id, rel.type, rel.sourceId, rel.targetId, rel.applicationId, toJson(rel.properties ?? {}), ts]);
    }
    await ipcWriteDb(db);
  },

  /** 删除某申请的所有图谱数据 */
  async deleteApplication(applicationId: string): Promise<void> {
    const db = await getGraphDb();
    db.run(`DELETE FROM relations WHERE application_id = ?`, [applicationId]);
    db.run(`DELETE FROM entities WHERE application_id = ?`, [applicationId]);
    db.run(`DELETE FROM applications WHERE id = ?`, [applicationId]);
    await ipcWriteDb(db);
  },
};

// ─── GraphReader ──────────────────────────────────────────────────────────────

export const GraphReader = {
  /** 查询某申请的所有实体 */
  async getEntities(applicationId: string, type?: EntityType): Promise<GraphEntity[]> {
    const db = await getGraphDb();
    const sql = type
      ? `SELECT * FROM entities WHERE application_id = ? AND type = ? ORDER BY created_at`
      : `SELECT * FROM entities WHERE application_id = ? ORDER BY created_at`;
    const params = type ? [applicationId, type] : [applicationId];
    const stmt = db.prepare(sql);
    stmt.run(params);
    const rows: GraphEntity[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        id: String(row.id),
        type: String(row.type) as EntityType,
        companyId: String(row.company_id),
        applicationId: String(row.application_id),
        properties: fromJson(row.properties),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return rows;
  },

  /** 查询某申请的所有关系 */
  async getRelations(applicationId: string, type?: RelationType): Promise<GraphRelation[]> {
    const db = await getGraphDb();
    const sql = type
      ? `SELECT * FROM relations WHERE application_id = ? AND type = ? ORDER BY created_at`
      : `SELECT * FROM relations WHERE application_id = ? ORDER BY created_at`;
    const params = type ? [applicationId, type] : [applicationId];
    const stmt = db.prepare(sql);
    stmt.run(params);
    const rows: GraphRelation[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        id: String(row.id),
        type: String(row.type) as RelationType,
        sourceId: String(row.source_id),
        targetId: String(row.target_id),
        applicationId: String(row.application_id),
        properties: fromJson(row.properties),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return rows;
  },

  /** 获取企业实体（主节点） */
  async getCompanyEntity(applicationId: string): Promise<GraphEntity | null> {
    const entities = await GraphReader.getEntities(applicationId, "Company");
    return entities[0] ?? null;
  },

  /** 获取银行流水月度汇总 */
  async getTransactions(applicationId: string): Promise<Record<string, unknown>[]> {
    const entities = await GraphReader.getEntities(applicationId, "BankTransaction");
    return entities.map(e => e.properties);
  },

  /** 获取财务报表（最新一期或指定期间） */
  async getFinancialStatement(applicationId: string, period?: string): Promise<{
    balanceSheet: Record<string, unknown> | null;
    incomeStatement: Record<string, unknown> | null;
    cashFlowStatement: Record<string, unknown> | null;
  }> {
    const bsEntities = await GraphReader.getEntities(applicationId, "BalanceSheet");
    const isEntities = await GraphReader.getEntities(applicationId, "IncomeStatement");
    const cfEntities = await GraphReader.getEntities(applicationId, "CashFlowStatement");

    const filterByPeriod = (entities: GraphEntity[]) => {
      if (!period) return entities[entities.length - 1] ?? null;
      return entities.find(e => e.properties.period === period) ?? entities[entities.length - 1] ?? null;
    };

    return {
      balanceSheet: filterByPeriod(bsEntities)?.properties ?? null,
      incomeStatement: filterByPeriod(isEntities)?.properties ?? null,
      cashFlowStatement: filterByPeriod(cfEntities)?.properties ?? null,
    };
  },

  /** 获取税务数据 */
  async getTaxData(applicationId: string): Promise<{
    declarations: Record<string, unknown>[];
    certificates: Record<string, unknown>[];
    creditRatings: Record<string, unknown>[];
  }> {
    const decls = await GraphReader.getEntities(applicationId, "TaxDeclaration");
    const certs = await GraphReader.getEntities(applicationId, "TaxCertificate");
    const credits = await GraphReader.getEntities(applicationId, "TaxCredit");
    return {
      declarations: decls.map(e => e.properties),
      certificates: certs.map(e => e.properties),
      creditRatings: credits.map(e => e.properties),
    };
  },

  /** 获取关联方信息（法人、实控人、股东） */
  async getRelatedParties(applicationId: string): Promise<{
    legalRep: Record<string, unknown> | null;
    actualController: Record<string, unknown> | null;
    shareholders: Record<string, unknown>[];
  }> {
    const legalReps = await GraphReader.getEntities(applicationId, "LegalRepresentative");
    const controllers = await GraphReader.getEntities(applicationId, "ActualController");
    const shareholders = await GraphReader.getEntities(applicationId, "Shareholder");
    return {
      legalRep: legalReps[0]?.properties ?? null,
      actualController: controllers[0]?.properties ?? null,
      shareholders: shareholders.map(e => e.properties),
    };
  },

  /** 获取 TOP5 客户/供应商 */
  async getCounterparties(applicationId: string): Promise<{
    top5Customers: Record<string, unknown>[];
    top5Suppliers: Record<string, unknown>[];
  }> {
    const customers = await GraphReader.getEntities(applicationId, "Top5Customer");
    const suppliers = await GraphReader.getEntities(applicationId, "Top5Supplier");
    return {
      top5Customers: customers.map(e => e.properties),
      top5Suppliers: suppliers.map(e => e.properties),
    };
  },

  /**
   * 获取引擎层所需的完整数据包（替代直接读 appData）
   * 这是"图谱即总线"原则的核心接口
   */
  async getEngineDataPackage(applicationId: string): Promise<{
    company: Record<string, unknown> | null;
    financialStatement: Awaited<ReturnType<typeof GraphReader.getFinancialStatement>>;
    transactions: Record<string, unknown>[];
    taxData: Awaited<ReturnType<typeof GraphReader.getTaxData>>;
    relatedParties: Awaited<ReturnType<typeof GraphReader.getRelatedParties>>;
    counterparties: Awaited<ReturnType<typeof GraphReader.getCounterparties>>;
    auditReport: Record<string, unknown> | null;
    businessLicense: Record<string, unknown> | null;
    featureVector: Record<string, unknown> | null;
    analysisResult: Record<string, unknown> | null;
  }> {
    const [
      companyEntity,
      financialStatement,
      transactions,
      taxData,
      relatedParties,
      counterparties,
      auditReports,
      businessLicenses,
      featureVectors,
      analysisResults,
    ] = await Promise.all([
      GraphReader.getCompanyEntity(applicationId),
      GraphReader.getFinancialStatement(applicationId),
      GraphReader.getTransactions(applicationId),
      GraphReader.getTaxData(applicationId),
      GraphReader.getRelatedParties(applicationId),
      GraphReader.getCounterparties(applicationId),
      GraphReader.getEntities(applicationId, "AuditReport"),
      GraphReader.getEntities(applicationId, "BusinessLicense"),
      GraphReader.getEntities(applicationId, "FeatureVector"),
      GraphReader.getEntities(applicationId, "AnalysisResult"),
    ]);

    return {
      company: companyEntity?.properties ?? null,
      financialStatement,
      transactions,
      taxData,
      relatedParties,
      counterparties,
      auditReport: auditReports[0]?.properties ?? null,
      businessLicense: businessLicenses[0]?.properties ?? null,
      featureVector: featureVectors[0]?.properties ?? null,
      analysisResult: analysisResults[0]?.properties ?? null,
    };
  },

  /** 获取所有申请列表（用于历史记录页） */
  async listApplications(limit = 50): Promise<Array<{
    id: string;
    companyName: string;
    status: string;
    analysisResult: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  }>> {
    const db = await getGraphDb();
    const stmt = db.prepare(
      `SELECT id, company_name, status, analysis_result, created_at, updated_at
       FROM applications ORDER BY updated_at DESC LIMIT ?`
    );
    stmt.run([limit]);
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        id: String(row.id),
        companyName: String(row.company_name),
        status: String(row.status),
        analysisResult: row.analysis_result ? fromJson(row.analysis_result) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      });
    }
    stmt.free();
    return rows;
  },

  /** 获取图谱统计（用于图谱视图页） */
  async getGraphStats(applicationId: string): Promise<{
    entityCount: number;
    relationCount: number;
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  }> {
    const db = await getGraphDb();

    const countEntities = db.exec(
      `SELECT COUNT(*) as cnt FROM entities WHERE application_id = '${applicationId.replace(/'/g, "''")}'`
    );
    const countRelations = db.exec(
      `SELECT COUNT(*) as cnt FROM relations WHERE application_id = '${applicationId.replace(/'/g, "''")}'`
    );
    const entityTypeRows = db.exec(
      `SELECT type, COUNT(*) as cnt FROM entities WHERE application_id = '${applicationId.replace(/'/g, "''")}' GROUP BY type`
    );
    const relationTypeRows = db.exec(
      `SELECT type, COUNT(*) as cnt FROM relations WHERE application_id = '${applicationId.replace(/'/g, "''")}' GROUP BY type`
    );

    const entityTypes: Record<string, number> = {};
    if (entityTypeRows[0]) {
      for (const row of entityTypeRows[0].values) {
        entityTypes[String(row[0])] = Number(row[1]);
      }
    }
    const relationTypes: Record<string, number> = {};
    if (relationTypeRows[0]) {
      for (const row of relationTypeRows[0].values) {
        relationTypes[String(row[0])] = Number(row[1]);
      }
    }

    return {
      entityCount: Number(countEntities[0]?.values[0]?.[0] ?? 0),
      relationCount: Number(countRelations[0]?.values[0]?.[0] ?? 0),
      entityTypes,
      relationTypes,
    };
  },
};

// ─── 解析结果写入图谱的高层接口 ───────────────────────────────────────────────

/**
 * 将 appData（前端状态）批量写入图谱
 * 这是 Layer 1 → Layer 2 的主要入口
 */
export async function writeAppDataToGraph(params: {
  applicationId: string;
  companyName: string;
  appData: Record<string, unknown>;
}): Promise<void> {
  const { applicationId, companyName, appData } = params;
  const companyId = `company_${applicationId}`;

  // 1. 确保 application 记录存在
  await GraphWriter.upsertApplication({ applicationId, companyName, status: 'analyzing' });

  // 2. 企业主节点
  await GraphWriter.upsertEntity({
    id: companyId,
    type: "Company",
    companyId,
    applicationId,
    properties: {
      companyName,
      creditCode: appData.creditCode,
      legalPerson: appData.legalPerson,
      registeredCapital: appData.registeredCapital,
      establishDate: appData.establishDate,
      address: appData.address,
      industry: appData.industry,
      businessScope: appData.businessScope,
    },
  });

  const entities: (Omit<GraphEntity, 'id' | 'createdAt'> & { id?: string })[] = [];
  const relations: (Omit<GraphRelation, 'id' | 'createdAt'> & { id?: string })[] = [];

  // 3. 法定代表人
  if (appData.legalPerson) {
    const legalRepId = `legalrep_${applicationId}`;
    entities.push({ id: legalRepId, type: "LegalRepresentative", companyId, applicationId, properties: { name: appData.legalPerson } });
    relations.push({ type: "HAS_LEGAL_REP", sourceId: companyId, targetId: legalRepId, applicationId });
  }

  // 4. 营业执照
  const bizLicense = appData.businessLicense as Record<string, unknown> | undefined;
  if (bizLicense && Object.keys(bizLicense).length > 0) {
    const blId = `biz_license_${applicationId}`;
    entities.push({ id: blId, type: "BusinessLicense", companyId, applicationId, properties: bizLicense });
    relations.push({ type: "HAS_BUSINESS_LICENSE", sourceId: companyId, targetId: blId, applicationId });
  }

  // 5. 审计报告
  const auditReport = appData.auditReport as Record<string, unknown> | undefined;
  if (auditReport && Object.keys(auditReport).length > 0) {
    const arId = `audit_report_${applicationId}`;
    entities.push({ id: arId, type: "AuditReport", companyId, applicationId, properties: auditReport });
    relations.push({ type: "HAS_AUDIT_REPORT", sourceId: companyId, targetId: arId, applicationId });
  }

  // 6. 财务报表（多期）
  const fsByYear = appData.financialStatementsByYear as Record<string, Record<string, unknown>> | undefined;
  if (fsByYear) {
    for (const [year, stmts] of Object.entries(fsByYear)) {
      const bs = (stmts as Record<string, unknown>).balanceSheet as Record<string, unknown> | undefined;
      const is = (stmts as Record<string, unknown>).incomeStatement as Record<string, unknown> | undefined;
      const cf = (stmts as Record<string, unknown>).cashFlow as Record<string, unknown> | undefined;

      if (bs) {
        const bsId = `bs_${year}_${applicationId}`;
        entities.push({ id: bsId, type: "BalanceSheet", companyId, applicationId, properties: { ...bs, period: year } });
        relations.push({ type: "HAS_BALANCE_SHEET", sourceId: companyId, targetId: bsId, applicationId, properties: { period: year } });
      }
      if (is) {
        const isId = `is_${year}_${applicationId}`;
        entities.push({ id: isId, type: "IncomeStatement", companyId, applicationId, properties: { ...is, period: year } });
        relations.push({ type: "HAS_INCOME_STMT", sourceId: companyId, targetId: isId, applicationId, properties: { period: year } });
      }
      if (cf) {
        const cfId = `cf_${year}_${applicationId}`;
        entities.push({ id: cfId, type: "CashFlowStatement", companyId, applicationId, properties: { ...cf, period: year } });
        relations.push({ type: "HAS_CASHFLOW_STMT", sourceId: companyId, targetId: cfId, applicationId, properties: { period: year } });
      }
    }
  }

  // 7. 银行账户 + 月度流水
  const bankFlowSummary = appData.bankFlowSummary as Record<string, unknown> | undefined;
  if (bankFlowSummary) {
    const accountId = `bank_account_${applicationId}`;
    entities.push({
      id: accountId,
      type: "BankAccount",
      companyId,
      applicationId,
      properties: {
        accountName: bankFlowSummary.accountName,
        bankName: bankFlowSummary.bankName,
        accountNo: bankFlowSummary.accountNo,
      },
    });
    relations.push({ type: "OWNS_ACCOUNT", sourceId: companyId, targetId: accountId, applicationId });

    const monthly = bankFlowSummary.monthly as Record<string, unknown>[] | undefined;
    if (monthly) {
      for (const m of monthly) {
        const txId = `tx_${m.month}_${applicationId}`;
        entities.push({ id: txId, type: "BankTransaction", companyId, applicationId, properties: m });
        relations.push({ type: "HAS_TRANSACTION", sourceId: accountId, targetId: txId, applicationId, properties: { month: m.month } });
      }
    }
  }

  // 8. 税务数据
  const taxData = appData.taxData as Record<string, unknown> | undefined;
  if (taxData) {
    const taxDeclId = `tax_decl_${applicationId}`;
    entities.push({ id: taxDeclId, type: "TaxDeclaration", companyId, applicationId, properties: taxData });
    relations.push({ type: "HAS_TAX_DECL", sourceId: companyId, targetId: taxDeclId, applicationId });
  }

  // 9. TOP5 客户/供应商
  const top5Customers = appData.top5Customers as Record<string, unknown>[] | undefined;
  if (top5Customers) {
    for (let i = 0; i < top5Customers.length; i++) {
      const custId = `customer_${i}_${applicationId}`;
      entities.push({ id: custId, type: "Top5Customer", companyId, applicationId, properties: top5Customers[i] });
      relations.push({ type: "TOP5_CUSTOMER", sourceId: companyId, targetId: custId, applicationId, properties: { rank: i + 1 } });
    }
  }
  const top5Suppliers = appData.top5Suppliers as Record<string, unknown>[] | undefined;
  if (top5Suppliers) {
    for (let i = 0; i < top5Suppliers.length; i++) {
      const suppId = `supplier_${i}_${applicationId}`;
      entities.push({ id: suppId, type: "Top5Supplier", companyId, applicationId, properties: top5Suppliers[i] });
      relations.push({ type: "TOP5_SUPPLIER", sourceId: companyId, targetId: suppId, applicationId, properties: { rank: i + 1 } });
    }
  }

  // 批量写入
  await GraphWriter.upsertEntities(entities);
  await GraphWriter.upsertRelations(relations);
}

/**
 * 将分析结论写入图谱（Layer 3 产出 → Layer 2）
 */
export async function writeAnalysisResultToGraph(params: {
  applicationId: string;
  companyName: string;
  verdict: string;
  score: number;
  featureVector: Record<string, unknown>;
  analysisReport: Record<string, unknown>;
}): Promise<void> {
  const { applicationId, companyName, verdict, score, featureVector, analysisReport } = params;
  const companyId = `company_${applicationId}`;

  // 更新 application 状态
  await GraphWriter.upsertApplication({
    applicationId,
    companyName,
    status: verdict === 'rejected' ? 'rejected' : 'completed',
    analysisResult: { verdict, score, ...analysisReport },
  });

  // 写入特征向量实体
  const fvId = `feature_vector_${applicationId}`;
  await GraphWriter.upsertEntity({
    id: fvId,
    type: "FeatureVector",
    companyId,
    applicationId,
    properties: featureVector,
  });
  await GraphWriter.upsertRelation({
    type: "HAS_FEATURE_VECTOR",
    sourceId: companyId,
    targetId: fvId,
    applicationId,
  });

  // 写入分析结论实体
  const arId = `analysis_result_${applicationId}`;
  await GraphWriter.upsertEntity({
    id: arId,
    type: "AnalysisResult",
    companyId,
    applicationId,
    properties: { verdict, score, ...analysisReport },
  });
  await GraphWriter.upsertRelation({
    type: "HAS_ANALYSIS_RESULT",
    sourceId: companyId,
    targetId: arId,
    applicationId,
  });
}
