/**
 * 中国会计准则财务报表标准指标全集
 * 依据：《企业会计准则》（财政部，2006年及历次修订）
 * 版本：v2.1 — 基于两份真实报表补充（北京国电光宇2022审报告 + 集团202509Excel）
 * 共 165 项：资产负债表 84 项 · 利润表 43 项 · 现金流量表 35 项 · 其他综合收益子项 3 项
 */

export interface FinancialIndicator {
  id: string;          // 标准 ID，如 bs_001
  name: string;        // 标准字段名
  aliases: string[];   // 常见别名 / 同义词
  unit: string;        // 单位
  isSubtotal?: boolean; // 是否为小计/合计行
  isSubItem?: boolean;  // 是否为子项（缩进显示）
  section: string;     // 所属分组（如 "流动资产"）
  table: 'balanceSheet' | 'incomeStatement' | 'cashFlow'; // 所属报表
  category?: string;   // 大类（如 "营业成本"）
  deprecated?: boolean; // 是否为旧准则科目（仍保留用于兼容）
}

// ============================================================
// 一、资产负债表（Balance Sheet）共 84 项
// ============================================================

export const BALANCE_SHEET_INDICATORS: FinancialIndicator[] = [
  // 1.1 流动资产（17项）
  { id: 'bs_001', name: '货币资金', aliases: ['现金及现金等价物', '现金', '银行存款', '库存现金', '现金及银行存款'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_002', name: '交易性金融资产', aliases: ['以公允价值计量且其变动计入当期损益的金融资产', '交易性金融资产（流动）'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_003', name: '以公允价值计量且其变动计入其他综合收益的金融资产', aliases: ['其他权益工具投资（流动）', '债权投资（流动）'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_004', name: '衍生金融资产', aliases: ['衍生工具资产', '衍生金融工具资产'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_005', name: '应收票据', aliases: ['票据应收', '应收商业票据', '应收汇票'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_006', name: '应收账款', aliases: ['应收款项', '客户应收款', '贸易应收款', '应收账款净额', '应收账款账面余额'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_007', name: '应收款项融资', aliases: ['应收款项融资（流动）', '票据及应收款项融资'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_008', name: '预付款项', aliases: ['预付账款', '预付款', '预付供应商款', '预付货款'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_009', name: '应收利息', aliases: ['利息应收', '应收利息收入', '利息应收款', '应收利息（流动）'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_010', name: '应收股利', aliases: ['股利应收', '应收红利', '股利应收款', '应收股利（流动）'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_011', name: '其他应收款', aliases: ['其他应收', '杂项应收款', '其他应收款项'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_012', name: '存货', aliases: ['库存', '存货净额', '原材料及产成品', '库存商品', '原材料', '在产品', '产成品'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_013', name: '合同资产', aliases: ['合同资产（流动）', '已完工未结算资产'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_014', name: '持有待售资产', aliases: ['待售资产', '持有待售的非流动资产', '持有待售资产（流动）'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_015', name: '一年内到期的非流动资产', aliases: ['一年内到期非流动资产', '流动部分非流动资产'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_016', name: '其他流动资产', aliases: ['其他流动资产', '其他流动资产合计'], unit: '元', section: '流动资产', table: 'balanceSheet' },
  { id: 'bs_017', name: '流动资产合计', aliases: ['流动资产总计', '流动资产小计', '总流动资产', '流动资产合计（元）'], unit: '元', section: '流动资产', table: 'balanceSheet', isSubtotal: true },

  // 1.2 非流动资产（27项，含新增旧准则兼容科目）
  { id: 'bs_018', name: '债权投资', aliases: ['持有至到期投资', '债权投资（非流动）', '持有到期投资'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_019', name: '其他债权投资', aliases: ['可供出售金融资产', '其他债权投资（非流动）', '可供出售投资'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_020', name: '长期应收款', aliases: ['长期应收款项', '非流动应收款', '长期应收账款'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_021', name: '长期股权投资', aliases: ['长期投资', '权益法核算投资', '联营及合营投资', '股权投资'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_022', name: '其他权益工具投资', aliases: ['其他权益投资', '非交易性权益工具投资', '其他权益工具投资（非流动）'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_023', name: '其他非流动金融资产', aliases: ['其他非流动金融资产', '非流动金融资产'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_024', name: '投资性房地产', aliases: ['投资房地产', '出租物业', '投资性房产'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_025', name: '固定资产', aliases: ['固定资产净值', '财产设备净额', 'PP&E', '固定资产账面净值', '固定资产净额', '固定资产（净）'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_025a', name: '累计折旧', aliases: ['固定资产累计折旧', '折旧累计', '已提折旧', '减：累计折旧'], unit: '元', section: '非流动资产', table: 'balanceSheet', isSubItem: true },
  { id: 'bs_025b', name: '固定资产清理', aliases: ['固定资产处置', '清理固定资产', '固定资产清理净值'], unit: '元', section: '非流动资产', table: 'balanceSheet', isSubItem: true },
  { id: 'bs_026', name: '在建工程', aliases: ['建设中工程', '在建项目', '工程在建'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_026a', name: '工程物资', aliases: ['建设工程物资', '工程备料', '工程用物资'], unit: '元', section: '非流动资产', table: 'balanceSheet', isSubItem: true },
  { id: 'bs_027', name: '生产性生物资产', aliases: ['生物资产', '生产性生物资产（非流动）'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_028', name: '油气资产', aliases: ['石油天然气资产', '油气田资产'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_029', name: '使用权资产', aliases: ['租赁资产', '经营租赁使用权资产', '租赁使用权资产'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_030', name: '无形资产', aliases: ['无形资产净值', '专利及商标', '知识产权', '无形资产账面净值'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_031', name: '开发支出', aliases: ['研发支出资本化', '开发阶段支出', '资本化研发支出'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_032', name: '商誉', aliases: ['并购商誉', '收购溢价', '商誉净值'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_033', name: '长期待摊费用', aliases: ['递延费用', '长期预付费用', '长期摊销费用'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_034', name: '递延所得税资产', aliases: ['递延税项资产', '递延税资产', '递延所得税资产（非流动）'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_035', name: '其他非流动资产', aliases: ['其他非流动资产', '其他长期资产'], unit: '元', section: '非流动资产', table: 'balanceSheet' },
  { id: 'bs_036', name: '非流动资产合计', aliases: ['非流动资产总计', '非流动资产小计', '长期资产合计'], unit: '元', section: '非流动资产', table: 'balanceSheet', isSubtotal: true },
  { id: 'bs_037', name: '资产总计', aliases: ['总资产', '资产合计', '资产总额', '资产总计（元）'], unit: '元', section: '非流动资产', table: 'balanceSheet', isSubtotal: true },

  // 1.3 流动负债（17项）
  { id: 'bs_038', name: '短期借款', aliases: ['短期贷款', '银行短期借款', '一年内到期借款', '短期银行贷款'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_039', name: '交易性金融负债', aliases: ['以公允价值计量且其变动计入当期损益的金融负债', '交易性金融负债（流动）'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_040', name: '衍生金融负债', aliases: ['衍生工具负债', '衍生金融工具负债'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_041', name: '应付票据', aliases: ['票据应付', '应付商业票据', '应付汇票'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_042', name: '应付账款', aliases: ['贸易应付款', '应付供应商款', '应付款项', '应付货款'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_043', name: '预收款项', aliases: ['预收账款', '预收客户款', '预收款'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_044', name: '合同负债', aliases: ['合同负债（流动）', '预收收入', '预收款项（新准则）', '合同预收款'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_045', name: '应付职工薪酬', aliases: ['应付工资', '应付薪酬', '职工薪酬负债', '应付员工薪酬'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_046', name: '应交税费', aliases: ['应付税款', '税费应付', '应缴税款', '应交税金'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_047', name: '应付利息', aliases: ['利息应付', '应计利息', '应付利息（流动）', '应付借款利息'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_048', name: '应付股利', aliases: ['股利应付', '应付红利', '应付股利（流动）', '应付现金股利'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_049', name: '其他应付款', aliases: ['其他应付', '杂项应付款', '其他应付款项'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_050', name: '持有待售负债', aliases: ['待售负债', '持有待售的负债'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_051', name: '一年内到期的非流动负债', aliases: ['一年内到期非流动负债', '即将到期长期债务', '一年内到期长期负债'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_052', name: '其他流动负债', aliases: ['其他流动负债', '其他流动负债合计'], unit: '元', section: '流动负债', table: 'balanceSheet' },
  { id: 'bs_053', name: '流动负债合计', aliases: ['流动负债总计', '流动负债小计', '总流动负债'], unit: '元', section: '流动负债', table: 'balanceSheet', isSubtotal: true },

  // 1.4 非流动负债（11项，含新增专项应付款）
  { id: 'bs_054', name: '长期借款', aliases: ['长期贷款', '银行长期借款', '长期债务', '长期银行贷款'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_055', name: '应付债券', aliases: ['债券负债', '公司债券', '应付债券（非流动）'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_056', name: '租赁负债', aliases: ['融资租赁负债', '经营租赁负债', '使用权负债'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_057', name: '长期应付款', aliases: ['长期应付款项', '非流动应付款', '长期应付账款'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_057a', name: '专项应付款', aliases: ['专项资金负债', '政府专项应付款', '专项拨款负债'], unit: '元', section: '非流动负债', table: 'balanceSheet', isSubItem: true },
  { id: 'bs_058', name: '长期应付职工薪酬', aliases: ['长期职工福利', '退休金负债', '长期员工福利'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_059', name: '预计负债', aliases: ['预提负债', '或有负债准备', '预计负债（非流动）'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_060', name: '递延收益', aliases: ['递延收入', '政府补助递延', '递延政府补助'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_061', name: '递延所得税负债', aliases: ['递延税项负债', '递延税负债', '递延所得税负债（非流动）'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_062', name: '其他非流动负债', aliases: ['其他非流动负债', '其他长期负债'], unit: '元', section: '非流动负债', table: 'balanceSheet' },
  { id: 'bs_063', name: '非流动负债合计', aliases: ['非流动负债总计', '非流动负债小计', '长期负债合计'], unit: '元', section: '非流动负债', table: 'balanceSheet', isSubtotal: true },

  // 1.5 负债合计 & 所有者权益（13项）
  { id: 'bs_064', name: '负债合计', aliases: ['总负债', '负债总计', '负债总额', '负债合计（元）'], unit: '元', section: '所有者权益', table: 'balanceSheet', isSubtotal: true },
  { id: 'bs_065', name: '实收资本（股本）', aliases: ['股本', '注册资本', '实收资本', '股份资本', '实收资本（或股本）', '股本（或实收资本）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_066', name: '其他权益工具', aliases: ['优先股', '永续债', '其他权益工具（权益）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_067', name: '资本公积', aliases: ['资本溢价', '股本溢价', '资本公积金', '资本公积（权益）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_068', name: '减：库存股', aliases: ['库存股', '回购股票', '库存股（减项）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_069', name: '其他综合收益', aliases: ['其他综合损益', '综合收益储备', '其他综合收益（权益）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_070', name: '专项储备', aliases: ['专项储备（权益）', '安全生产准备金'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_071', name: '盈余公积', aliases: ['法定盈余公积', '任意盈余公积', '盈余储备', '盈余公积金'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_072', name: '未分配利润', aliases: ['留存收益', '累积未分配利润', '未分配盈余', '未分配利润（亏损）'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_073', name: '归属于母公司所有者权益合计', aliases: ['母公司股东权益', '归属母公司净资产', '归属于母公司的所有者权益'], unit: '元', section: '所有者权益', table: 'balanceSheet', isSubtotal: true },
  { id: 'bs_074', name: '少数股东权益', aliases: ['非控制性权益', '少数权益', '少数股东利益'], unit: '元', section: '所有者权益', table: 'balanceSheet' },
  { id: 'bs_075', name: '所有者权益合计', aliases: ['股东权益合计', '净资产', '所有者权益总计', '所有者权益（或股东权益）合计', '股东权益（或所有者权益）合计'], unit: '元', section: '所有者权益', table: 'balanceSheet', isSubtotal: true },
  { id: 'bs_076', name: '负债和所有者权益总计', aliases: ['负债及股东权益合计', '资产负债表总计', '负债和所有者权益（或股东权益）总计', '负债和股东权益总计'], unit: '元', section: '所有者权益', table: 'balanceSheet', isSubtotal: true },
];

// ============================================================
// 二、利润表（Income Statement）共 43 项
// ============================================================

export const INCOME_STATEMENT_INDICATORS: FinancialIndicator[] = [
  { id: 'is_001', name: '营业收入', aliases: ['收入', '主营业务收入', '销售收入', '总收入', '营业总收入', '一、营业收入'], unit: '元', section: '营业收入', table: 'incomeStatement', category: '营业收入' },
  { id: 'is_002', name: '营业成本', aliases: ['主营业务成本', '销售成本', '营业总成本', '减：营业成本'], unit: '元', section: '营业成本', table: 'incomeStatement', category: '营业成本' },
  { id: 'is_003', name: '税金及附加', aliases: ['营业税金及附加', '税费及附加', '消费税及附加', '税金及附加费', '减：税金及附加'], unit: '元', section: '营业成本', table: 'incomeStatement', category: '营业成本' },
  { id: 'is_004', name: '销售费用', aliases: ['营销费用', '销售及分销费用', '市场费用', '减：销售费用'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用' },
  { id: 'is_005', name: '管理费用', aliases: ['行政费用', '一般及行政费用', '管理及行政费用', '减：管理费用'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用' },
  { id: 'is_006', name: '研发费用', aliases: ['研究与开发费用', '研发支出', 'R&D费用', '减：研发费用'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用' },
  { id: 'is_007', name: '财务费用', aliases: ['利息费用净额', '融资成本', '财务成本', '减：财务费用'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用' },
  { id: 'is_007a', name: '其中：利息费用', aliases: ['利息支出', '借款利息', '财务费用-利息支出'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用', isSubItem: true },
  { id: 'is_007b', name: '其中：利息收入', aliases: ['利息收入', '存款利息收入', '财务费用-利息收入'], unit: '元', section: '期间费用', table: 'incomeStatement', category: '期间费用', isSubItem: true },
  { id: 'is_008', name: '其他收益', aliases: ['其他经营收益', '政府补助收益', '加：其他收益'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_009', name: '投资收益', aliases: ['投资收入', '投资损益', '权益法投资收益', '加：投资收益'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_009a', name: '其中：对联营企业和合营企业的投资收益', aliases: ['联营合营收益', '权益法核算收益'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益', isSubItem: true },
  { id: 'is_010', name: '公允价值变动损益', aliases: ['以公允价值计量且其变动计入当期损益的金融资产收益', '公允价值变动收益', '公允价值变动（损失以"-"填列）', '加：公允价值变动收益'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_011', name: '净敞口套期收益', aliases: ['套期损益', '套期保值收益'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_012', name: '资产处置收益', aliases: ['资产处置损益', '固定资产处置收益', '资产处置收益（损失以"-"填列）'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_013', name: '信用减值损失', aliases: ['信用损失', '应收款减值', '减：信用减值损失'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_014', name: '资产减值损失', aliases: ['减值损失', '资产减值准备', '减：资产减值损失'], unit: '元', section: '其他损益', table: 'incomeStatement', category: '其他损益' },
  { id: 'is_015', name: '营业利润', aliases: ['经营利润', '营业利润合计', '二、营业利润', '营业利润（亏损以"-"号填列）'], unit: '元', section: '营业利润', table: 'incomeStatement', isSubtotal: true, category: '营业利润' },
  { id: 'is_016', name: '加：营业外收入', aliases: ['营业外收入', '非经营性收入', '其他营业外收入'], unit: '元', section: '利润总额', table: 'incomeStatement', category: '利润总额' },
  { id: 'is_017', name: '减：营业外支出', aliases: ['营业外支出', '非经营性支出', '其他营业外支出'], unit: '元', section: '利润总额', table: 'incomeStatement', category: '利润总额' },
  { id: 'is_017a', name: '其中：非流动资产处置损失', aliases: ['固定资产处置损失', '长期资产处置损失', '非流动资产处置净损失'], unit: '元', section: '利润总额', table: 'incomeStatement', category: '利润总额', isSubItem: true },
  { id: 'is_018', name: '利润总额', aliases: ['税前利润', '税前收益', 'EBT', '三、利润总额', '利润总额（亏损总额以"-"号填列）'], unit: '元', section: '利润总额', table: 'incomeStatement', isSubtotal: true, category: '利润总额' },
  { id: 'is_019', name: '减：所得税费用', aliases: ['所得税', '企业所得税', '所得税支出', '所得税费用'], unit: '元', section: '净利润', table: 'incomeStatement', category: '净利润' },
  { id: 'is_020', name: '净利润', aliases: ['税后利润', '净收益', '净盈利', '四、净利润', '净利润（净亏损以"-"号填列）'], unit: '元', section: '净利润', table: 'incomeStatement', isSubtotal: true, category: '净利润' },
  { id: 'is_020a', name: '持续经营净利润', aliases: ['（一）持续经营净利润', '来自持续经营的净利润', '继续经营净利润'], unit: '元', section: '净利润', table: 'incomeStatement', category: '净利润', isSubItem: true },
  { id: 'is_020b', name: '终止经营净利润', aliases: ['（二）终止经营净利润', '来自终止经营的净利润', '停止经营净利润'], unit: '元', section: '净利润', table: 'incomeStatement', category: '净利润', isSubItem: true },
  { id: 'is_021', name: '其中：归属于母公司所有者的净利润', aliases: ['归母净利润', '母公司净利润', '归属于母公司的净利润'], unit: '元', section: '净利润', table: 'incomeStatement', category: '净利润', isSubItem: true },
  { id: 'is_022', name: '少数股东损益', aliases: ['非控制性权益损益', '少数股东利润', '归属于少数股东的净利润'], unit: '元', section: '净利润', table: 'incomeStatement', category: '净利润', isSubItem: true },

  // 其他综合收益（税后）及子项
  { id: 'is_023', name: '其他综合收益（税后）', aliases: ['其他综合损益', '税后其他综合收益', '五、其他综合收益的税后净额'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益' },
  { id: 'is_023a', name: '不能重分类进损益的其他综合收益', aliases: ['（一）不能重分类进损益的其他综合收益', '永久性其他综合收益'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023a1', name: '重新计量设定受益计划变动额', aliases: ['1.重新计量设定受益计划变动额', '养老金精算损益'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023a2', name: '权益法下不能转损益的其他综合收益', aliases: ['2.权益法下不能转损益的其他综合收益'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023a3', name: '其他权益工具投资公允价值变动', aliases: ['3.其他权益工具投资公允价值变动', '权益工具公允价值变动'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023a4', name: '企业自身信用风险公允价值变动', aliases: ['4.企业自身信用风险公允价值变动', '自身信用风险变动'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b', name: '将重分类进损益的其他综合收益', aliases: ['（二）将重分类进损益的其他综合收益', '可重分类其他综合收益'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b1', name: '权益法下可转损益的其他综合收益', aliases: ['1.权益法下可转损益的其他综合收益'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b2', name: '其他债权投资公允价值变动', aliases: ['2.其他债权投资公允价值变动', '债权投资公允价值变动'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b3', name: '金融资产重分类计入其他综合收益的金额', aliases: ['3.金融资产重分类计入其他综合收益的金额'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b4', name: '其他债权投资信用减值准备', aliases: ['4.其他债权投资信用减值准备'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b5', name: '现金流量套期储备', aliases: ['5.现金流量套期储备', '套期保值储备'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },
  { id: 'is_023b6', name: '外币财务报表折算差额', aliases: ['6.外币财务报表折算差额', '外币报表折算差额', '汇兑折算差额'], unit: '元', section: '其他综合收益', table: 'incomeStatement', category: '其他综合收益', isSubItem: true },

  { id: 'is_024', name: '综合收益总额', aliases: ['总综合收益', '综合收益', '六、综合收益总额'], unit: '元', section: '综合收益总额', table: 'incomeStatement', isSubtotal: true, category: '综合收益总额' },
  { id: 'is_025', name: '归属于母公司所有者的综合收益总额', aliases: ['归母综合收益', '归属于母公司的综合收益'], unit: '元', section: '综合收益总额', table: 'incomeStatement', category: '综合收益总额', isSubItem: true },
  { id: 'is_026', name: '归属于少数股东的综合收益总额', aliases: ['少数股东综合收益', '归属于少数股东的综合收益'], unit: '元', section: '综合收益总额', table: 'incomeStatement', category: '综合收益总额', isSubItem: true },
  { id: 'is_027', name: '基本每股收益', aliases: ['基本EPS', '每股基本收益', '（一）基本每股收益'], unit: '元/股', section: '每股收益', table: 'incomeStatement', category: '每股收益' },
  { id: 'is_028', name: '稀释每股收益', aliases: ['稀释EPS', '每股稀释收益', '（二）稀释每股收益'], unit: '元/股', section: '每股收益', table: 'incomeStatement', category: '每股收益' },
];

// ============================================================
// 三、现金流量表（Cash Flow Statement）共 35 项
// ============================================================

export const CASH_FLOW_INDICATORS: FinancialIndicator[] = [
  // 3.1 经营活动（10项）
  { id: 'cf_001', name: '销售商品、提供劳务收到的现金', aliases: ['经营收款', '销售收款', '客户收款', '收到销售款'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_002', name: '收到的税费返还', aliases: ['税费退还', '退税收款', '税费返还'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_003', name: '收到其他与经营活动有关的现金', aliases: ['其他经营收款', '其他经营活动现金流入', '其他经营收入现金'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_004', name: '经营活动现金流入小计', aliases: ['经营现金流入合计', '经营活动现金流入', '现金流入小计（经营）'], unit: '元', section: '经营活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_005', name: '购买商品、接受劳务支付的现金', aliases: ['采购付款', '供应商付款', '购货付款', '支付采购款'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_006', name: '支付给职工以及为职工支付的现金', aliases: ['工资支付', '员工薪酬支付', '人工成本支付', '支付员工工资'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_007', name: '支付的各项税费', aliases: ['税费支付', '缴纳税款', '税款支出', '支付税费'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_008', name: '支付其他与经营活动有关的现金', aliases: ['其他经营支付', '其他经营活动现金流出', '其他经营支出现金'], unit: '元', section: '经营活动', table: 'cashFlow' },
  { id: 'cf_009', name: '经营活动现金流出小计', aliases: ['经营现金流出合计', '经营活动现金流出', '现金流出小计（经营）'], unit: '元', section: '经营活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_010', name: '经营活动产生的现金流量净额', aliases: ['经营现金流净额', '经营活动净现金流', 'CFO', '经营活动净现金'], unit: '元', section: '经营活动', table: 'cashFlow', isSubtotal: true },

  // 3.2 投资活动（12项）
  { id: 'cf_011', name: '收回投资收到的现金', aliases: ['投资回收款', '处置投资收款', '收回投资款'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_012', name: '取得投资收益收到的现金', aliases: ['投资收益收款', '股息及利息收款', '取得投资收益'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_013', name: '处置固定资产、无形资产和其他长期资产收回的现金净额', aliases: ['处置长期资产收款', '资产处置收款', '处置固定资产收款'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_014', name: '处置子公司及其他营业单位收到的现金净额', aliases: ['处置子公司收款', '出售子公司收款', '处置子公司净收款'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_015', name: '收到其他与投资活动有关的现金', aliases: ['其他投资收款', '其他投资活动现金流入', '其他投资收入现金'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_016', name: '投资活动现金流入小计', aliases: ['投资现金流入合计', '投资活动现金流入', '现金流入小计（投资）'], unit: '元', section: '投资活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_017', name: '购建固定资产、无形资产和其他长期资产支付的现金', aliases: ['资本支出', '购置长期资产支付', 'CAPEX', '购建固定资产支付'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_018', name: '投资支付的现金', aliases: ['投资付款', '购买投资支付', '对外投资支付'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_019', name: '取得子公司及其他营业单位支付的现金净额', aliases: ['收购子公司支付', '并购支付', '取得子公司净支付'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_020', name: '支付其他与投资活动有关的现金', aliases: ['其他投资支付', '其他投资活动现金流出', '其他投资支出现金'], unit: '元', section: '投资活动', table: 'cashFlow' },
  { id: 'cf_021', name: '投资活动现金流出小计', aliases: ['投资现金流出合计', '投资活动现金流出', '现金流出小计（投资）'], unit: '元', section: '投资活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_022', name: '投资活动产生的现金流量净额', aliases: ['投资现金流净额', '投资活动净现金流', 'CFI', '投资活动净现金'], unit: '元', section: '投资活动', table: 'cashFlow', isSubtotal: true },

  // 3.3 筹资活动（9项）
  { id: 'cf_023', name: '吸收投资收到的现金', aliases: ['融资收款', '股权融资收款', '增资收款', '吸收股权投资收款'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_024', name: '取得借款收到的现金', aliases: ['借款收款', '贷款收款', '债务融资收款', '取得借款'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_025', name: '收到其他与筹资活动有关的现金', aliases: ['其他筹资收款', '其他筹资活动现金流入', '其他筹资收入现金'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_026', name: '筹资活动现金流入小计', aliases: ['筹资现金流入合计', '筹资活动现金流入', '现金流入小计（筹资）'], unit: '元', section: '筹资活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_027', name: '偿还债务支付的现金', aliases: ['还款支付', '债务偿还支付', '偿债支付', '偿还借款支付'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_028', name: '分配股利、利润或偿付利息支付的现金', aliases: ['股利支付', '利息支付', '分红支付', '股利及利息支付'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_029', name: '支付其他与筹资活动有关的现金', aliases: ['其他筹资支付', '其他筹资活动现金流出', '其他筹资支出现金'], unit: '元', section: '筹资活动', table: 'cashFlow' },
  { id: 'cf_030', name: '筹资活动现金流出小计', aliases: ['筹资现金流出合计', '筹资活动现金流出', '现金流出小计（筹资）'], unit: '元', section: '筹资活动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_031', name: '筹资活动产生的现金流量净额', aliases: ['筹资现金流净额', '筹资活动净现金流', 'CFF', '筹资活动净现金'], unit: '元', section: '筹资活动', table: 'cashFlow', isSubtotal: true },

  // 3.4 现金净变动（4项）
  { id: 'cf_032', name: '汇率变动对现金及现金等价物的影响', aliases: ['汇率影响', '外汇影响', '四、汇率变动对现金的影响', '汇率变动影响'], unit: '元', section: '现金净变动', table: 'cashFlow' },
  { id: 'cf_033', name: '现金及现金等价物净增加额', aliases: ['现金净增加', '现金净变动', '净现金变动', '五、现金及现金等价物净增加额'], unit: '元', section: '现金净变动', table: 'cashFlow', isSubtotal: true },
  { id: 'cf_034', name: '期初现金及现金等价物余额', aliases: ['期初现金', '年初现金余额', '加：期初现金及现金等价物余额'], unit: '元', section: '现金净变动', table: 'cashFlow' },
  { id: 'cf_035', name: '期末现金及现金等价物余额', aliases: ['期末现金', '年末现金余额', '六、期末现金及现金等价物余额'], unit: '元', section: '现金净变动', table: 'cashFlow', isSubtotal: true },
];

// 全量指标合集
export const ALL_FINANCIAL_INDICATORS: FinancialIndicator[] = [
  ...BALANCE_SHEET_INDICATORS,
  ...INCOME_STATEMENT_INDICATORS,
  ...CASH_FLOW_INDICATORS,
];

// 按 ID 快速查找
export const INDICATOR_BY_ID: Record<string, FinancialIndicator> = Object.fromEntries(
  ALL_FINANCIAL_INDICATORS.map(ind => [ind.id, ind])
);

/**
 * 三级映射规则：将原始字段名映射到标准 ID
 * 第一级：精确匹配标准名
 * 第二级：精确匹配别名
 * 第三级：模糊包含匹配（标准名或别名包含原始名，或原始名包含标准名/别名）
 */
export function mapFieldToStandardId(rawFieldName: string): string | null {
  const raw = rawFieldName.trim();
  if (!raw) return null;

  // 第一级：精确匹配标准名
  for (const ind of ALL_FINANCIAL_INDICATORS) {
    if (ind.name === raw) return ind.id;
  }

  // 第二级：精确匹配别名
  for (const ind of ALL_FINANCIAL_INDICATORS) {
    if (ind.aliases.includes(raw)) return ind.id;
  }

  // 第三级：模糊包含匹配
  for (const ind of ALL_FINANCIAL_INDICATORS) {
    const allNames = [ind.name, ...ind.aliases];
    for (const name of allNames) {
      if (name.includes(raw) || raw.includes(name)) return ind.id;
    }
  }

  return null;
}

/**
 * 将 LLM 解析的财务数据（任意字段名）映射到标准 ID 结构
 * 返回 Record<standardId, value>，未匹配项以 _raw_ 前缀保留
 */
export function mapToStandardFields(
  rawData: Record<string, string | null | undefined>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [rawKey, value] of Object.entries(rawData)) {
    if (rawKey === 'reportDate' || rawKey === 'reportPeriod' || rawKey === 'prevReportDate' || rawKey === 'prevReportPeriod') {
      result[rawKey] = value ?? null;
      continue;
    }
    const stdId = mapFieldToStandardId(rawKey);
    if (stdId) {
      // 若已有值且当前为 null，不覆盖
      if (result[stdId] == null || value != null) {
        result[stdId] = value ?? null;
      }
    } else {
      // 未匹配项保留原始 key（加前缀避免冲突）
      result[`_raw_${rawKey}`] = value ?? null;
    }
  }
  return result;
}

/**
 * 资产负债表分组结构（用于前端渲染）
 */
export const BALANCE_SHEET_SECTIONS = [
  { key: '流动资产', label: '流动资产', color: 'blue' },
  { key: '非流动资产', label: '非流动资产', color: 'indigo' },
  { key: '流动负债', label: '流动负债', color: 'red' },
  { key: '非流动负债', label: '非流动负债', color: 'orange' },
  { key: '所有者权益', label: '所有者权益', color: 'green' },
] as const;

/**
 * 利润表分组结构
 */
export const INCOME_STATEMENT_SECTIONS = [
  { key: '营业收入', label: '营业收入', color: 'green' },
  { key: '营业成本', label: '营业成本', color: 'red' },
  { key: '期间费用', label: '期间费用', color: 'orange' },
  { key: '其他损益', label: '其他损益', color: 'yellow' },
  { key: '营业利润', label: '营业利润', color: 'blue' },
  { key: '利润总额', label: '利润总额', color: 'indigo' },
  { key: '净利润', label: '净利润', color: 'purple' },
  { key: '其他综合收益', label: '其他综合收益', color: 'gray' },
  { key: '综合收益总额', label: '综合收益总额', color: 'teal' },
  { key: '每股收益', label: '每股收益', color: 'cyan' },
] as const;

/**
 * 现金流量表分组结构
 */
export const CASH_FLOW_SECTIONS = [
  { key: '经营活动', label: '经营活动', color: 'green' },
  { key: '投资活动', label: '投资活动', color: 'blue' },
  { key: '筹资活动', label: '筹资活动', color: 'purple' },
  { key: '现金净变动', label: '现金净变动', color: 'gray' },
] as const;

// 旧字段名到标准 ID 的直接映射（兼容层，用于迁移已有数据）
export const LEGACY_FIELD_MAP: Record<string, string> = {
  // 资产负债表旧字段
  monetaryFunds: 'bs_001',
  tradingFinancialAssets: 'bs_002',
  notesReceivable: 'bs_005',
  accountsReceivable: 'bs_006',
  prepayments: 'bs_008',
  interestReceivable: 'bs_009',
  dividendsReceivable: 'bs_010',
  otherReceivables: 'bs_011',
  inventory: 'bs_012',
  contractAssets: 'bs_013',
  currentAssets: 'bs_017',
  totalCurrentAssets: 'bs_017',
  prevCurrentAssets: 'bs_017', // 上期值特殊处理
  // 旧准则科目兼容
  heldToMaturityInvestments: 'bs_018',
  availableForSaleFinancialAssets: 'bs_019',
  longTermEquityInvestments: 'bs_021',
  fixedAssets: 'bs_025',
  accumulatedDepreciation: 'bs_025a',
  fixedAssetsDisposal: 'bs_025b',
  constructionInProgress: 'bs_026',
  constructionMaterials: 'bs_026a',
  rightOfUseAssets: 'bs_029',
  intangibleAssets: 'bs_030',
  goodwill: 'bs_032',
  deferredTaxAssets: 'bs_034',
  nonCurrentAssets: 'bs_036',
  totalNonCurrentAssets: 'bs_036',
  totalAssets: 'bs_037',
  shortTermLoans: 'bs_038',
  notesPayable: 'bs_041',
  accountsPayable: 'bs_042',
  interestPayable: 'bs_047',
  dividendsPayable: 'bs_048',
  taxesPayable: 'bs_046',
  currentLiabilities: 'bs_053',
  totalCurrentLiabilities: 'bs_053',
  longTermLoans: 'bs_054',
  specialPayables: 'bs_057a',
  nonCurrentLiabilities: 'bs_063',
  totalNonCurrentLiabilities: 'bs_063',
  totalLiabilities: 'bs_064',
  paidInCapital: 'bs_065',
  capitalReserve: 'bs_067',
  treasuryStock: 'bs_068',
  surplusReserve: 'bs_071',
  retainedEarnings: 'bs_072',
  parentEquity: 'bs_073',
  minorityInterest: 'bs_074',
  ownersEquity: 'bs_075',
  totalEquity: 'bs_075',        // 扫描件路径字段别名
  shareholdersEquity: 'bs_075', // 英文报表别名
  // 利润表旧字段
  revenue: 'is_001',
  operatingRevenue: 'is_001',
  costOfRevenue: 'is_002',
  operatingCost: 'is_002',      // 扫描件路径字段别名
  businessTaxAndSurcharges: 'is_003',
  sellingExpenses: 'is_004',
  adminExpenses: 'is_005',
  rdExpenses: 'is_006',
  financialExpenses: 'is_007',
  creditImpairment: 'is_013',
  assetImpairment: 'is_014',
  operatingProfit: 'is_015',
  totalProfit: 'is_018',
  incomeTax: 'is_019',
  netProfit: 'is_020',
  continuingOperationsNetProfit: 'is_020a',
  discontinuedOperationsNetProfit: 'is_020b',
  parentNetProfit: 'is_021',
  minorityNetProfit: 'is_022',
  // 现金流量表旧字段
  operatingCashInflow: 'cf_004',
  operatingCashOutflow: 'cf_009',
  operatingCashFlow: 'cf_010',
  investingCashFlow: 'cf_022',
  financingCashFlow: 'cf_031',
  netCashIncrease: 'cf_033',
  netCashFlow: 'cf_033',        // 扫描件路径字段别名
  endingCashBalance: 'cf_035',
};
