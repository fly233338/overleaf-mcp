# Overleaf MCP

Use AI coding agents and MCP clients to read, understand, and edit Overleaf projects through Git.

[![npm](https://img.shields.io/npm/v/%40fly233338%2Foverleaf-mcp)](https://www.npmjs.com/package/@fly233338/overleaf-mcp)![Node.js](https://img.shields.io/node/v/%40fly233338%2Foverleaf-mcp)[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)![MCP](https://img.shields.io/badge/MCP-server-blue)

**English** | [中文](README.zh-CN.md)

## Demo

![Overleaf MCP demo]()

## What It Can Do

* Work with one or multiple Overleaf projects.
* Browse project files and preview the structure and line ranges of LaTeX documents.
* Search project text and read complete files or selected line ranges.
* Make targeted text and section edits, or write a complete file when needed.
* Commit and push changes back to Overleaf through Git.
* Keep credentials outside model-visible tool output and restrict file access to the project repository.

## Quick Start

### Requirements

You need:

* Node.js 18+
* An Overleaf project with Git integration
* An [Overleaf Git integration token](https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/git/git-integration-authentication-tokens)

### 1. Configure

Create `~/.config/overleaf-mcp/projects.json` on macOS/Linux or `%APPDATA%\overleaf-mcp\projects.json` on Windows:

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

### 2. Run

```sh
npx -y @fly233338/overleaf-mcp
```

`overleaf-mcp` automatically loads the user configuration and communicates with MCP clients over stdio.

## Available MCP Tools

`overleaf-mcp` currently exposes the following MCP tools:

| Tool            | Description                                           |
| --------------- | ----------------------------------------------------- |
| `list_projects` | List configured Overleaf projects                     |
| `list_files`    | List files in an Overleaf project                     |
| `preview_file`  | Preview the structure and line ranges of a LaTeX file |
| `search_text`   | Search text across project files                      |
| `read_file`     | Read a complete file or selected line range           |
| `replace_text`  | Replace targeted text and push the change             |
| `write_file`    | Write a complete file and push the change             |
| `write_section` | Replace a LaTeX section and push the change           |


## How It Works

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

`overleaf-mcp` is a standalone MCP server. It exposes project and LaTeX source operations to the MCP client, while synchronization and writes are handled through Overleaf's Git integration.

## Security and Limitations

* Overleaf access is handled through Git integration rather than browser automation.
* Credentials are kept outside model-visible tool output.
* File access is restricted to the configured project repository.
* Write operations are committed and pushed back to Overleaf through Git.
* An Overleaf project with Git integration is required.

## Development

```sh
npm install
npm run check
```

`npm run check` runs type checking, tests, and the production build.

## License

[MIT](LICENSE)
