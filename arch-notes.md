# Marsbot 本地客户端技术架构方案 v1.0 关键要点

## 1. 产品定位
- 云端 SaaS 的离线对等版本，面向数据安全严格的金融机构
- 完全断网环境下完成：数据采集 → 图谱构建 → 规则引擎分析 → 结果可视化
- 云端 SaaS 仅作为 AI 深度分析的可选增值服务

## 2. 四大核心设计原则
1. **图谱即总线（Graph as Bus）**：所有数据访问均通过图谱查询接口，原始文件经数据层解析后写入图谱
2. **最小化数据出境（Data Minimization）**：原始文件永不离开本地，向云端传输的仅为结构化指标 JSON
3. **离线优先（Offline First）**：四层架构在无网络环境下完整可用
4. **四层继承（Layer Inheritance）**：完整继承 Marsbot 云端的四层架构设计

## 3. 四层架构
- Layer 1（数据层）：文件解析 | 银行流水 | 财务报表 | 增值税申报 | 完税证明 | 营业执照
- Layer 2（图谱层）：本体模型（44实体/46关系）| 图谱写入 | 图谱查询 | 关联方识别
- Layer 3（引擎层）：规则引擎（33条）| 特征工程（38指标）| 九维度评分 | 三法额度计算
- Layer 4（应用层）：申请管理 | 分析报告 | 评分可视化 | 额度测算 | 历史记录 | 云端推送

## 4. 技术栈
- 桌面框架：Electron 32+
- 渲染进程：React 19 + TypeScript + Tailwind CSS 4
- 主进程：Node.js（文件系统、SQLite图谱、Python桥接、云端HTTP）
- 规则引擎/解析：Python 3.11（内嵌），openpyxl + pdfplumber + xlrd
- 进程间通信：Electron IPC + Python subprocess
- 本地图谱存储：SQLite（via better-sqlite3）
- 图谱查询接口：TypeScript 查询层（GraphReader）
- 数据可视化：Recharts + D3.js
- 打包分发：electron-builder + GitHub Actions

## 5. Layer 1 支持的文件类型
| 文件类型 | 格式 | 解析库 | 输出图谱实体类型 |
|---------|------|--------|----------------|
| 银行流水 | Excel（各行格式）/ PDF | openpyxl + xlrd + pdfplumber | BankTransaction, BankAccount |
| 资产负债表 | Excel / PDF | openpyxl + xlrd | BalanceSheetItem |
| 利润表 | Excel / PDF | openpyxl + xlrd | IncomeStatementItem |
| 现金流量表 | Excel / PDF | openpyxl + xlrd | CashFlowItem |
| 增值税申报表 | PDF（标准格式）| pdfplumber + 坐标定位 | TaxDeclaration |
| 完税证明 | PDF | pdfplumber + 正则 | TaxPaymentCertificate |
| 营业执照 | PDF / 图片 | pdfplumber + OCR | Company, LegalPerson |
| 审计报告 | PDF | pdfplumber + NLP | AuditReport |
| 压缩包 | ZIP / RAR | zipfile / rarfile | 自动递归解析内部文件 |

## 6. Layer 2 图谱存储结构（SQLite）
- entities 表：id, type, company_id, properties(JSON), created_at, updated_at
- relations 表：id, type, source_id, target_id, properties(JSON)
- applications 表：id, company_name, created_at, status, analysis_result(JSON)

## 7. 规则引擎（33条）示例
| 规则ID | 规则名称 | 维度 | 阈值 | 严重级别 |
|--------|---------|------|------|---------|
| R-01 | 资产负债率过高 | 财务健康 | >85% | P0 |
| R-07 | 连续亏损年数 | 盈利能力 | ≥2年 | P0 |
| R-12 | 现金流量比率 | 现金流 | <0.5 | P1 |
| R-18 | 关联担保圈风险 | 关联风险 | 存在 | P0 |
| R-25 | 税务异常 | 合规风险 | 存在 | P1 |

## 8. 当前实现状态 vs 架构要求
- ✅ 已实现：Electron 框架、React UI、本地分析引擎（TypeScript）
- ⚠️ 架构要求 Python 内嵌进程处理文件解析，当前用 xlsx.js（TypeScript）替代
- ⚠️ 架构要求 SQLite 图谱存储，当前用 localStorage 替代
- ⚠️ 架构要求 GraphReader 查询接口，当前直接读取内存数据

## 9. 近期优先任务（基于架构方案）
1. 移植 Excel 解析函数到渲染进程（xlsx.js，不依赖 Python）
2. 完善 parseDocument 存根，调用本地解析引擎
3. 构建并发布 v1.0.2
4. 后续可考虑：SQLite 图谱层、Python 子进程桥接
