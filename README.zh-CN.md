# Overleaf MCP

通过 Git，让 AI 编程 Agent 和 MCP 客户端直接读取、理解和编辑 Overleaf 项目。

[![npm](https://img.shields.io/npm/v/%40fly233338%2Foverleaf-mcp)](https://www.npmjs.com/package/@fly233338/overleaf-mcp) ![Node.js](https://img.shields.io/node/v/%40fly233338%2Foverleaf-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![MCP](https://img.shields.io/badge/MCP-server-blue)

[English](README.md) | **中文**

## Demo

![Overleaf MCP Demo](image-1.png)

## 能做什么

* 支持一个或多个 Overleaf 项目。
* 浏览项目文件，并预览 LaTeX 文档的结构和行号范围。
* 搜索项目文本，读取完整文件或指定行范围。
* 对文本或 LaTeX 章节进行精准修改，也可以在需要时重写完整文件。
* 通过 Git 提交并将修改推送回 Overleaf。
* 避免在模型可见的工具输出中暴露凭证，并将文件访问限制在项目仓库范围内。

## 快速开始

### 环境要求

你需要：

* Node.js 18+
* 一个已启用 Git integration 的 Overleaf 项目
* 一个 [Overleaf Git integration token](https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/git/git-integration-authentication-tokens)

### 1. 配置项目

在 macOS/Linux 上创建：

```text
~/.config/overleaf-mcp/projects.json
```

在 Windows 上创建：

```text
%APPDATA%\overleaf-mcp\projects.json
```

配置内容：

```json
{
  "projects": {
    "paper": {
      "name": "Paper",
      "projectId": "your-project-id",
      "gitToken": "your-git-token"
    }
  }
}
```

### 2. 运行

```sh
npx -y @fly233338/overleaf-mcp
```

`overleaf-mcp` 会自动加载用户配置，并通过 stdio 与 MCP 客户端通信。

## 可用的 MCP Tools

`overleaf-mcp` 当前提供以下 MCP tools：

| Tool            | 说明                  |
| --------------- | ------------------- |
| `list_projects` | 列出已配置的 Overleaf 项目  |
| `list_files`    | 列出 Overleaf 项目中的文件  |
| `preview_file`  | 预览 LaTeX 文件的结构和行号范围 |
| `search_text`   | 在项目文件中搜索文本          |
| `read_file`     | 读取完整文件或指定行范围        |
| `replace_text`  | 替换指定文本并推送修改         |
| `write_file`    | 写入完整文件并推送修改         |
| `write_section` | 替换 LaTeX 章节并推送修改    |

## Examples

![Example](image-1.png)

## 工作原理

```text
AI client / coding agent
          │
          │ MCP stdio
          ▼
     overleaf-mcp
          │
          │ Overleaf Git integration
          ▼
     Overleaf project
```

`overleaf-mcp` 是一个独立的 MCP Server。

它向 MCP 客户端提供项目文件和 LaTeX 源文件相关操作，同时通过 Overleaf 的 Git integration 完成项目同步、提交和写入。

## 安全与限制

* Overleaf 项目访问通过 Git integration 完成，而不是浏览器自动化。
* 凭证不会出现在模型可见的工具输出中。
* 文件访问被限制在已配置的项目仓库范围内。
* 写入操作通过 Git commit 并推送回 Overleaf。
* 目标 Overleaf 项目必须支持 Git integration。

## 开发

```sh
npm install
npm run check
```

`npm run check` 会依次执行类型检查、测试和生产构建。

## License

[MIT](LICENSE)
