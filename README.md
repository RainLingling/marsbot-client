# Marsbot Client — 本地离线客户端

> 🦁 火星豹 AI 信贷风控分析系统 · 本地桌面版

## 功能特性

- **完全离线运行**：无需联网，所有分析在本地完成
- **四层分析架构**：
  - Layer 1: 文档解析（营业执照、财务报表、银行流水、税务申报）
  - Layer 2: 知识图谱构建（企业关系网络）
  - Layer 3: 算法决策（38维特征工程 + 评分卡 + 硬性规则引擎 + 额度计算）
  - Layer 4: AI 综合风险评估
- **本地历史记录**：使用 localStorage 存储申请记录，支持恢复
- **可配置 LLM**：支持接入 DeepSeek、通义千问、GPT 等外部 API
- **数据导出**：分析结果可导出为 JSON 文件

## 下载安装

前往 [Releases](../../releases) 页面下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| Windows | `Marsbot-Client-Setup-x.x.x.exe` |
| macOS | `Marsbot-Client-x.x.x.dmg` |
| Linux | `Marsbot-Client-x.x.x.AppImage` |

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发模式（需要 Electron 环境）
pnpm dev

# 构建
pnpm build

# 打包（当前平台）
pnpm package
```

## 配置外部 LLM

点击右上角 ⚙️ 图标，填入：
- **API Key**：你的 LLM 服务 API Key
- **API URL**：兼容 OpenAI 格式的接口地址（如 `https://api.deepseek.com/v1/chat/completions`）
- **Model**：模型名称（如 `deepseek-chat`）

## 技术栈

- Electron 42 + React 19 + TypeScript
- Vite 8 + Tailwind CSS 4
- 本地分析引擎（纯前端，无服务端依赖）

## 许可证

MIT © 2025 RainLingling
