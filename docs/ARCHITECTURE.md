# 架构说明

## 项目定位

`overleaf-mcp` 是一个独立的 TypeScript Overleaf MCP Server。

当前版本通过 Overleaf Git 集成提供项目、文件和 LaTeX 章节相关能力，不包含 DSH 专用逻辑，也不提供通用 Overleaf CLI。

当前实现以简单、清晰、可测试为优先，不为尚未实现的能力提前建立空模块或抽象。

## 目录结构

```text
src/
├── auth/
│   └── git-token.ts
├── core/
│   ├── project.ts
│   └── files.ts
├── latex/
│   ├── preview.ts
│   └── sections.ts
├── tools/
│   ├── index.ts
│   ├── projects.ts
│   ├── files.ts
│   ├── preview.ts
│   └── edit.ts
├── transports/
│   └── git/
│       └── git-transport.ts
├── bin.ts
├── config.ts
├── errors.ts
├── server.ts
└── types.ts
```

## 分层职责

### `auth/`

负责 Git token 的读取和解析。

不负责项目配置、Git 操作或 MCP 逻辑。

### `config.ts`

负责：

- 项目配置加载
- 配置来源优先级
- 配置校验
- 转换为内部项目配置
- 所有隐式候选均不存在时，在用户配置目录创建初始 `projects.json` 并返回专用首次启动信号

配置错误和首次启动信号通过异常返回，不负责启动或退出进程。

### `transports/git/`

负责通过 Git 访问 Overleaf，包括：

- 仓库 clone 和 pull
- 本地仓库管理
- 文件读取、遍历和写入；递归遍历只返回普通文件并排除 `.git` 目录，空扩展过滤器表示枚举全部文件
- 通用单文件 updater 的同步、读取、写入、提交和推送
- Git author 配置
- add、commit 和 push

所有用户文件路径必须限制在项目仓库根目录内。

该层不负责项目选择、MCP schema 或 LaTeX 解析。文件更新通过 `ProjectTransport` 接收纯文本 updater，Git transport 不感知 updater 的具体用途。

### `core/`

负责应用层用例。

`ProjectService` 管理项目配置、项目选择和对应的 Git transport。

`ProjectTransport` 是 core 使用的最小 transport 接口，也是测试 fake transport 的边界。

`FileService` 协调项目、Git transport 和 LaTeX parser，提供文件和章节相关操作。`listFiles()` 将公开参数中精确小写的 `"all"` 映射为空扩展过滤器；`previewFile()` 通过现有安全读取获取一个完整文件并调用纯预览 parser，补充原始文件路径；`replaceText()` 在 pull 后的最新内容中执行大小写敏感的字面量替换，默认要求唯一匹配，显式启用时替换全文所有非重叠匹配；`writeSection()` 在 core 中完成 LaTeX replacement。两种局部写入都将 updater 交给 transport。

core 不依赖 MCP server 或 tools。

### `latex/`

`preview.ts` 负责从单个 LaTeX 文件提取标题范围、外部文件引用和 figure/table，返回扁平的结构化预览。`sections.ts` 保留写入所需的章节解析和替换。

保持纯函数，不访问文件系统、Git、配置或 MCP。

### `tools/`

负责 MCP tool definition、参数接收和结果转换。

tool 只调用 core service，不直接执行 Git、读取配置、访问文件系统或读取进程环境。

所有 tools 在 `tools/index.ts` 中显式注册，不使用动态扫描或插件机制。

`tools/files.ts` 定义文件浏览、搜索和读取 tools，包括支持 `extension: "all"` 的 `list_files`；`tools/preview.ts` 定义 `preview_file` 并将 service 结果序列化为 JSON；`tools/edit.ts` 定义写入 tools，包括默认唯一替换并可通过 `replaceAll` 显式全文替换的 `replace_text`。当前 registry 显式注册 8 个 tools。

### `server.ts`

负责创建 MCP server，并基于 tool registry 提供 tool list 和 tool call。

该模块必须可以安全 import，不启动 stdio，不读取进程配置，也不退出进程。

### `bin.ts`

唯一运行入口。

负责：

- 读取运行环境
- 加载配置
- 构造 services
- 创建 server
- 连接 MCP stdio transport
- 首次创建配置后将编辑提示写入 stderr 并正常结束
- 处理顶层启动失败

stdout 只用于 MCP 协议，诊断信息只写 stderr。

## 依赖方向

主要依赖方向为：

`bin → server → tools → core → transport / latex`

配置和认证由入口层加载后传入其他模块。

禁止底层模块反向依赖 MCP server 或 tools。

