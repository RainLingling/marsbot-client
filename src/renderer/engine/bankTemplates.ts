/**
 * bankTemplates.ts - 20+ 家银行流水 Excel 精确列名映射模板库
 *
 * 每个模板定义：
 * - bankName: 银行名称
 * - aliases: 文件名/表头中可能出现的银行标识
 * - headerKeywords: 用于识别该模板的表头关键词组合
 * - columns: 精确列名映射
 * - accountInfoRows: 账户信息所在行的关键词（用于提取户名/账号/开户行）
 * - dataStartOffset: 表头行之后跳过几行开始数据（默认1）
 */

export interface BankColumnMapping {
  date: string[];           // 交易日期列
  inflow: string[];         // 贷方/收入列
  outflow: string[];        // 借方/支出列
  amount?: string[];        // 单一金额列（借贷合一时）
  balance?: string[];       // 余额列
  txType?: string[];        // 交易类型/借贷标志列
  direction?: string[];     // 收支方向列（配合 amount 使用）
  remark?: string[];        // 摘要/用途列
  counterparty?: string[];  // 对手方名称列
}

export interface BankTemplate {
  bankName: string;
  bankCode: string;         // 银行代码（用于识别）
  aliases: string[];        // 文件名/表头中的银行标识关键词
  headerKeywords: string[]; // 至少匹配2个才认定为该模板
  columns: BankColumnMapping;
  dataStartOffset?: number; // 表头行之后跳过几行（默认1）
  accountInfoPatterns?: {   // 账户信息行的正则模式
    accountName?: RegExp;
    accountNumber?: RegExp;
    bankName?: RegExp;
    currency?: RegExp;
  };
}

// ─── 20+ 家银行模板 ───────────────────────────────────────────────────────────

export const BANK_TEMPLATES: BankTemplate[] = [

  // ── 1. 工商银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "中国工商银行",
    bankCode: "ICBC",
    aliases: ["工商银行", "工行", "ICBC", "icbc"],
    headerKeywords: ["记账日期", "借方金额", "贷方金额", "余额", "摘要"],
    columns: {
      date: ["记账日期", "交易日期", "业务日期"],
      inflow: ["贷方金额", "贷方发生额"],
      outflow: ["借方金额", "借方发生额"],
      balance: ["账户余额", "余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名", "对手方名称"],
    },
    accountInfoPatterns: {
      accountName: /(?:户名|账户名称)[：:\s]*([^\s\t，,]{2,20})/,
      accountNumber: /(?:账号|卡号)[：:\s]*(\d[\d\s*]{6,})/,
      bankName: /(?:开户行|开户机构)[：:\s]*([^\s\t，,]{4,20})/,
    },
  },

  // ── 2. 建设银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "中国建设银行",
    bankCode: "CCB",
    aliases: ["建设银行", "建行", "CCB", "ccb"],
    headerKeywords: ["交易日期", "借方发生额", "贷方发生额", "账户余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方发生额", "贷方金额"],
      outflow: ["借方发生额", "借方金额"],
      balance: ["账户余额", "余额"],
      remark: ["摘要", "附言"],
      counterparty: ["对方户名", "对手方"],
    },
    accountInfoPatterns: {
      accountName: /(?:户名|账户名)[：:\s]*([^\s\t，,]{2,20})/,
      accountNumber: /(?:账号)[：:\s]*(\d[\d\s*]{6,})/,
      bankName: /(?:开户行|支行)[：:\s]*([^\s\t，,]{4,20})/,
    },
  },

  // ── 3. 农业银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "中国农业银行",
    bankCode: "ABC",
    aliases: ["农业银行", "农行", "ABC", "abc"],
    headerKeywords: ["记账日期", "收入金额", "支出金额", "余额", "摘要"],
    columns: {
      date: ["记账日期", "交易日期"],
      inflow: ["收入金额", "贷方金额", "贷方"],
      outflow: ["支出金额", "借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名", "收款人", "付款人"],
    },
  },

  // ── 4. 中国银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "中国银行",
    bankCode: "BOC",
    aliases: ["中国银行", "中行", "BOC", "boc"],
    headerKeywords: ["交易日期", "交易金额", "借贷标志", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      amount: ["交易金额", "发生额", "金额"],
      txType: ["借贷标志", "借贷方向", "收支标志"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要", "附言"],
      counterparty: ["对方户名", "对手方名称"],
    },
  },

  // ── 5. 招商银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "招商银行",
    bankCode: "CMB",
    aliases: ["招商银行", "招行", "CMB", "cmb"],
    headerKeywords: ["交易日期", "收入", "支出", "余额", "交易摘要"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入", "收入金额", "贷方金额"],
      outflow: ["支出", "支出金额", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["交易摘要", "摘要", "附言"],
      counterparty: ["对方账户名称", "对方户名"],
    },
  },

  // ── 6. 交通银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "交通银行",
    bankCode: "BOCOM",
    aliases: ["交通银行", "交行", "BOCOM"],
    headerKeywords: ["交易日期", "借方金额", "贷方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名", "对手方"],
    },
  },

  // ── 7. 邮储银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "中国邮政储蓄银行",
    bankCode: "PSBC",
    aliases: ["邮储银行", "邮政储蓄", "PSBC", "psbc"],
    headerKeywords: ["交易日期", "存入金额", "支取金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["存入金额", "贷方金额", "收入金额"],
      outflow: ["支取金额", "借方金额", "支出金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 8. 浦发银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "上海浦东发展银行",
    bankCode: "SPDB",
    aliases: ["浦发银行", "浦发", "SPDB", "spdb"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "账户余额"],
    columns: {
      date: ["交易日期", "记账日期", "发生日期"],
      inflow: ["贷方金额", "贷方发生额"],
      outflow: ["借方金额", "借方发生额"],
      balance: ["账户余额", "余额"],
      remark: ["摘要", "交易摘要", "用途"],
      counterparty: ["对方户名", "对手方名称"],
    },
  },

  // ── 9. 兴业银行 ──────────────────────────────────────────────────────────────
  {
    bankName: "兴业银行",
    bankCode: "CIB",
    aliases: ["兴业银行", "兴业", "CIB", "cib"],
    headerKeywords: ["记账日期", "贷方", "借方", "余额", "摘要"],
    columns: {
      date: ["记账日期", "交易日期"],
      inflow: ["贷方", "贷方金额", "贷方发生额"],
      outflow: ["借方", "借方金额", "借方发生额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名", "对手方"],
    },
  },

  // ── 10. 中信银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "中信银行",
    bankCode: "CITIC",
    aliases: ["中信银行", "中信", "CITIC", "citic"],
    headerKeywords: ["交易日期", "收入金额", "支出金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入金额", "贷方金额"],
      outflow: ["支出金额", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要", "附言"],
      counterparty: ["对方户名", "收款人", "付款人"],
    },
  },

  // ── 11. 光大银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "中国光大银行",
    bankCode: "CEB",
    aliases: ["光大银行", "光大", "CEB", "ceb"],
    headerKeywords: ["交易日期", "贷方发生额", "借方发生额", "账户余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方发生额", "贷方金额"],
      outflow: ["借方发生额", "借方金额"],
      balance: ["账户余额", "余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 12. 民生银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "中国民生银行",
    bankCode: "CMBC",
    aliases: ["民生银行", "民生", "CMBC", "cmbc"],
    headerKeywords: ["交易日期", "收入", "支出", "余额", "摘要"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入", "贷方金额", "入账金额"],
      outflow: ["支出", "借方金额", "出账金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名", "对手方"],
    },
  },

  // ── 13. 华夏银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "华夏银行",
    bankCode: "HXB",
    aliases: ["华夏银行", "华夏", "HXB"],
    headerKeywords: ["记账日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["记账日期", "交易日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 14. 广发银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "广发银行",
    bankCode: "GDB",
    aliases: ["广发银行", "广发", "GDB"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "收入金额"],
      outflow: ["借方金额", "支出金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 15. 平安银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "平安银行",
    bankCode: "PAB",
    aliases: ["平安银行", "平安", "PAB", "pab"],
    headerKeywords: ["交易日期", "收入金额", "支出金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入金额", "贷方金额"],
      outflow: ["支出金额", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要", "备注"],
      counterparty: ["对方户名", "收款方", "付款方"],
    },
  },

  // ── 16. 北京银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "北京银行",
    bankCode: "BOBJ",
    aliases: ["北京银行", "北京行", "BOBJ"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "账户余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["账户余额", "余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 17. 上海银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "上海银行",
    bankCode: "SHBANK",
    aliases: ["上海银行", "沪行", "SHBANK"],
    headerKeywords: ["交易日期", "贷方发生额", "借方发生额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方发生额", "贷方金额"],
      outflow: ["借方发生额", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 18. 宁波银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "宁波银行",
    bankCode: "NBCB",
    aliases: ["宁波银行", "宁波行", "NBCB"],
    headerKeywords: ["交易日期", "收入", "支出", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入", "贷方金额"],
      outflow: ["支出", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 19. 南京银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "南京银行",
    bankCode: "NJCB",
    aliases: ["南京银行", "南京行", "NJCB"],
    headerKeywords: ["记账日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["记账日期", "交易日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 20. 杭州银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "杭州银行",
    bankCode: "HZCB",
    aliases: ["杭州银行", "杭银", "HZCB"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "收入金额"],
      outflow: ["借方金额", "支出金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 21. 徽商银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "徽商银行",
    bankCode: "HSBANK",
    aliases: ["徽商银行", "徽商", "HSBANK"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 22. 浙商银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "浙商银行",
    bankCode: "CZBANK",
    aliases: ["浙商银行", "浙商", "CZBANK"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "收入"],
      outflow: ["借方金额", "支出"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 23. 渤海银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "渤海银行",
    bankCode: "BHBANK",
    aliases: ["渤海银行", "渤海", "BHBANK"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 24. 恒丰银行 ─────────────────────────────────────────────────────────────
  {
    bankName: "恒丰银行",
    bankCode: "HFB",
    aliases: ["恒丰银行", "恒丰", "HFB"],
    headerKeywords: ["交易日期", "贷方金额", "借方金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["贷方金额", "贷方"],
      outflow: ["借方金额", "借方"],
      balance: ["余额", "账户余额"],
      remark: ["摘要"],
      counterparty: ["对方户名"],
    },
  },

  // ── 25. 网商银行（阿里系）─────────────────────────────────────────────────────
  {
    bankName: "网商银行",
    bankCode: "MYBANK",
    aliases: ["网商银行", "网商", "MYbank", "mybank"],
    headerKeywords: ["交易时间", "收入", "支出", "余额", "交易类型"],
    columns: {
      date: ["交易时间", "交易日期"],
      inflow: ["收入", "入账金额"],
      outflow: ["支出", "出账金额"],
      balance: ["余额", "账户余额"],
      remark: ["交易类型", "摘要"],
      counterparty: ["对方名称", "对手方"],
    },
  },

  // ── 26. 微众银行（腾讯系）─────────────────────────────────────────────────────
  {
    bankName: "微众银行",
    bankCode: "WEBANK",
    aliases: ["微众银行", "微众", "WeBank", "webank"],
    headerKeywords: ["交易日期", "收入金额", "支出金额", "余额"],
    columns: {
      date: ["交易日期", "记账日期"],
      inflow: ["收入金额", "贷方金额"],
      outflow: ["支出金额", "借方金额"],
      balance: ["余额", "账户余额"],
      remark: ["摘要", "交易摘要"],
      counterparty: ["对方户名"],
    },
  },
];

// ─── 银行模板匹配函数 ─────────────────────────────────────────────────────────

/**
 * 根据文件名和表头内容识别银行模板
 * @param fileName 文件名（含扩展名）
 * @param headers 表头行内容数组
 * @param previewText 文件前几行文本（用于识别银行名称）
 * @returns 匹配的银行模板，或 null（使用通用逻辑）
 */
export function detectBankTemplate(
  fileName: string,
  headers: string[],
  previewText?: string
): BankTemplate | null {
  const fileNameLower = fileName.toLowerCase();
  const headersStr = headers.join(" ");
  const previewLower = (previewText || "").toLowerCase();

  // 1. 先按文件名匹配
  for (const template of BANK_TEMPLATES) {
    for (const alias of template.aliases) {
      if (fileNameLower.includes(alias.toLowerCase())) {
        return template;
      }
    }
  }

  // 2. 再按预览文本匹配（文件前几行通常包含银行名称）
  for (const template of BANK_TEMPLATES) {
    for (const alias of template.aliases) {
      if (previewLower.includes(alias.toLowerCase())) {
        return template;
      }
    }
  }

  // 3. 按表头关键词匹配（匹配度最高的模板）
  let bestMatch: BankTemplate | null = null;
  let bestScore = 0;
  for (const template of BANK_TEMPLATES) {
    const score = template.headerKeywords.filter(kw => headersStr.includes(kw)).length;
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestMatch;
}

/**
 * 根据银行模板和表头，返回各列的索引
 */
export function resolveColumnIndices(
  template: BankTemplate,
  headers: string[]
): {
  dateCol: number;
  inflowCol: number;
  outflowCol: number;
  amountCol: number;
  balanceCol: number;
  txTypeCol: number;
  directionCol: number;
  remarkCol: number;
  counterpartyCol: number;
} {
  const findCol = (candidates: string[] | undefined): number => {
    if (!candidates) return -1;
    for (const candidate of candidates) {
      // 精确匹配
      const exactIdx = headers.findIndex(h => h.trim() === candidate.trim());
      if (exactIdx >= 0) return exactIdx;
    }
    for (const candidate of candidates) {
      // 包含匹配（排除账户信息列）
      const idx = headers.findIndex(h => {
        if (!h.includes(candidate)) return false;
        const isAccountInfoCol = /账号|卡号|行号|行名|开户行|开户机构|支行|网点|证件/.test(h);
        return !isAccountInfoCol;
      });
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const cols = template.columns;
  const dateCol = findCol(cols.date);
  const inflowCol = findCol(cols.inflow);
  const outflowCol = findCol(cols.outflow);
  const amountCol = findCol(cols.amount);
  const balanceCol = findCol(cols.balance);
  const txTypeCol = findCol(cols.txType);
  const directionCol = findCol(cols.direction);
  const remarkCol = findCol(cols.remark);
  const counterpartyCol = findCol(cols.counterparty);

  return { dateCol, inflowCol, outflowCol, amountCol, balanceCol, txTypeCol, directionCol, remarkCol, counterpartyCol };
}

/**
 * 获取所有银行名称列表（用于 UI 展示）
 */
export function getBankList(): { bankName: string; bankCode: string }[] {
  return BANK_TEMPLATES.map(t => ({ bankName: t.bankName, bankCode: t.bankCode }));
}
