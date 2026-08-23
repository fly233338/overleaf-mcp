# 安全文本替换、全文件枚举与 1.1.0 发布准备

## Summary

在已完成 `search_text` 和 `read_file(range)` 的 `develop` 基线上，新增只允许唯一匹配的 `replace_text`，并让 `list_files` 通过 `extension: "all"` 列出全部项目文件。工具总数由 9 个增至 10 个；完成文档修复后，按用户后续授权将 `develop` 快进合并到 `main` 并发布 `@fly233338/overleaf-mcp@1.1.0`。

## Public Interfaces and Types

- 新增 `replace_text`：
  - 必填：`filePath`、`oldText`、`newText`、`commitMessage`。
  - 可选：`projectName`，继续默认选择 `default` 项目。
  - `oldText` 必须为非空、大小写敏感的字面量，并在最新文件内容中恰好出现一次。
  - `newText` 允许为空以支持删除；与 `oldText` 相同时作为无效修改报错。
  - 成功时返回 transport 输出；输出为空时返回 `Text replaced and pushed successfully.`。
- 扩展 `list_files.extension`：
  - 未提供或传空字符串时继续默认 `.tex`。
  - 精确传入小写 `"all"` 时列出除 `.git` 目录外的全部普通文件。
  - 其他值继续作为单个文件名后缀过滤器，不改变已有行为。

## Implementation Work

1. **安全文本替换**
   - 在 `FileService` 新增 `replaceText()`，选择项目后调用现有 `transport.updateFile()`，不增加 Git 专用接口或新模块。
   - 在 updater 内基于 pull 后读取的最新内容统计 `oldText`；0 次时报“未找到”，多次时报“匹配不唯一，请提供更长上下文”。
   - 匹配计数包含重叠起始位置，确保任何可能的多个替换位置都会被拒绝；唯一匹配时只拼接替换该处，保留其余内容逐字不变。
   - updater 抛错时不得写回目标文件，也不得执行 add、commit 或 push；现有路径限制、commit message 校验和冲突处理继续由 transport 承担。
   - 在 edit tool 中定义 schema、handler 和成功结果，并在显式 registry 中将 `replace_text` 放在 `status_summary` 与 `write_file` 之间。
   - 聚焦测试通过后，仅暂存相关实现、测试与 snapshot，提交为 `feat: add safe text replacement`。

2. **全部文件枚举**
   - 在 core 将公开值 `"all"` 映射为 transport 已支持的空扩展过滤器；默认 `.tex` 仍由 service/tool 保持。
   - 更新 `list_files` schema 描述，明确 `.tex` 默认值、扩展示例和 `"all"` 特殊值。
   - 全文件结果继续使用现有递归遍历及确定性排序，包含 `.bib`、`.sty`、`.cls`、图片、隐藏普通文件等，但排除 `.git` 目录内容。
   - 聚焦测试通过后，仅暂存相关实现、测试与 snapshot，提交为 `feat: support listing all project files`。

3. **文档与 1.1.0 发布准备**
   - 更新 `docs/CAPABILITIES.md`：工具数改为 10，登记 `replace_text` 的唯一匹配写入语义，并说明 `list_files` 的 `"all"` 行为。
   - 将 `package.json`、package lockfile 根包版本和 MCP server metadata 同步更新为 `1.1.0`。
   - 不恢复 README；本轮工具文档以 tool schema/description 和中文能力文档为准。
   - 完成完整验证后提交为 `chore: prepare 1.1.0 release`，且不暂存用户已有的 `.gitignore` 修改。

4. **文档修复、分支合并与发布**
   - 修复 `docs/CAPABILITIES.md` 的复制标题和未闭合 Markdown 围栏，并使更新规则与当前 `AGENTS.md` 一致。
   - 同步更新 `docs/ARCHITECTURE.md` 中的 `replace_text`、`list_files("all")` 和 10 个 tools 架构说明。
   - 从 `.gitignore` 移除 `docs/`，将当前中文文档纳入 Git 跟踪。
   - 在 `develop` 提交修复后，将其快进合并到 `main`，重新运行发布检查并执行 npm 发布。

## Test and Acceptance

- Service 测试覆盖：
  - 唯一的单行和跨行 `oldText` 被精确替换。
  - 空 `newText` 可以删除唯一匹配。
  - 空 `oldText`、0 次匹配、多次匹配、重叠多次匹配及无效同值替换均报错并保持内容不变。
  - `projectName`、文件路径、commit message 和 updater 正确传给所选 transport。
  - `listFiles()` 默认传 `.tex`，`extension: "all"` 向 transport 传空过滤器，普通扩展仍原样传递。
- Git transport 边界测试覆盖：
  - 空扩展过滤器返回嵌套目录中的全部普通文件，包括非文本和图片，同时跳过 `.git`。
  - updater 成功时仍只 pull 一次、写入一个文件、stage 一个目标并 commit/push。
  - updater 因匹配错误抛出时，目标文件不变且 Git 调用止于 pull。
- MCP contract 测试覆盖：
  - 10 个工具的确定顺序、`replace_text` schema、`list_files` 更新后的说明及 snapshot。
  - handler 完整转发五个替换参数，返回约定成功文本。
  - 0 次或多次匹配错误通过现有 MCP `isError` 通道返回。
- 保留现有 `search_text` 和 `read_file(range)` 测试作为回归验收，不重复设计其行为。
- 最终运行 `npm run typecheck`、`npm test`、`npm run build` 和 `npm pack --dry-run`；确认 tarball 名称和 manifest 版本为 `@fly233338/overleaf-mcp@1.1.0`。
- 最终 Git 状态只能包含计划提交，以及未暂存的用户 `.gitignore` 修改。

## Explicit Non-Changes

- 不支持 regex、大小写不敏感替换、replace-all、可配置匹配次数或自动选择第一个匹配。
- 不改变 `write_file`、`write_section`、`search_text`、`read_file` 或 `status_summary` 的公开行为。
- `"all"` 只扩展 `list_files`，不赋予 `search_text` 搜索二进制或全部扩展的能力。
- 不修改架构边界，不新增 replacement transport 或额外 Git 抽象。
- 不创建 README。
- 不创建 tag，不 push Git 远端。

## Assumptions

- 当前 `develop` 上的 `search_text`、范围读取和边界修复提交是本阶段前置基线。
- “恰好一次”指完整、大小写敏感、允许跨行的字面量子串匹配；重叠出现也视为多次。
- `"all"` 区分大小写，仅精确小写值具有特殊语义。
- `1.1.0` 是 scoped npm 包 `@fly233338/overleaf-mcp` 的版本，同时也是 MCP server 对外报告的版本。
