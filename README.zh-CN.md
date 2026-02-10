# OpenClaw Configurator

[English](README.md)

一个用于在 Linux 上配置 [OpenClaw](https://github.com/openclaw/openclaw) 的交互式命令行工具。

## 功能特性

- 🌍 多语言支持（English / 简体中文）
- 🔧 添加 AI 服务商
- 🔑 安全配置 API 密钥
- 🤖 选择和切换模型
- ⚡ 内置 12API 和自定义服务商支持

## 快速开始

无需安装，直接运行：

```bash
curl -fsSL https://github.com/moonwesif/openclaw-configurator/releases/latest/download/index.js -o /tmp/openclaw-config.js && node /tmp/openclaw-config.js
```

> **注意：** 本工具需要交互式终端输入，请勿使用 `curl ... | node` 方式运行，否则 stdin 会被管道占用导致无法输入。

## 前置要求

- [Node.js](https://nodejs.org/) v22 或更高版本
- [OpenClaw](https://github.com/openclaw/openclaw) 已安装并在 PATH 中可用

## 使用说明

运行脚本后，将进入交互式菜单：

1. **选择语言** - 选择 English 或 简体中文
2. **添加服务商** - 配置新的 AI 服务商，包括 Base URL 和 API 密钥
3. **选择模型** - 在已配置的模型之间切换
4. **退出** - 退出程序

### 支持的服务商

- **12API** - 预配置 `https://cdn.12ai.org`
- **其他** - 兼容 OpenAI/Anthropic API 的自定义服务商

## 开发

```bash
# 安装依赖
make install

# 开发模式运行
make dev

# 类型检查和构建
make typecheck build

# 生产构建
make build-prod
```

## 许可证

MIT
