# 结构化 LaTeX 文件预览与旧章节读取工具替换

## Summary

新增 `preview_file`，通过纯函数解析单个 LaTeX 文件的标题、外部文件引用和 figure/table，并返回适合 Agent 过滤和生成 `read_file` 行范围请求的 JSON。

同时删除已被替代的 `get_sections` 和 `get_section_content`。最终 MCP 工具数保持为 8：新增 1 个、删除 2 个。本阶段不修改版本号或发布包。

## Public Interfaces and Types

新增：

```json
{
  "name": "preview_file",
  "arguments": {
    "filePath": "sections/method.tex",
    "projectName": "paper"
  }
}
```

返回 pretty-printed JSON 文本：

```json
{
  "filePath": "sections/method.tex",
  "lineCount": 186,
  "items": [
    {
      "type": "section",
      "title": "Method",
      "startLine": 1,
      "endLine": 186
    },
    {
      "type": "table",
      "startLine": 51,
      "endLine": 66,
      "caption": "Model architecture",
      "label": "tab:architecture"
    },
    {
      "type": "input",
      "startLine": 102,
      "target": "tables/results"
    }
  ]
}
```

`items` 是按源码位置排序的扁平联合类型：

- 标题：`type / title / startLine / endLine`
- `input/include`：`type / target / startLine`
- `figure/table`：`type / startLine / endLine / caption? / label?`
- 所有行号均为 1-based；范围为包含边界。
- `title/caption/label/target` 去除参数外围空白，但保留原始 LaTeX。
- 缧失的 `caption` 或 `label` 键直接省略。

## Implementation Work

1. **同步开发基线**
   - 本地 `main` 通过 `--ff-only` 更新到已合并 PR 的 `origin/main`。
   - `develop` 再通过 `--ff-only` 对齐 `main`，然后继续在 `develop` 开发。
   - 不创建额外 merge commit。

2. **实现纯预览解析器**
   - 新增 `src/latex/preview.ts`，导出无 I/O 的 `previewLatexFile(content)`。
   - 一次扫描建立逻辑行起点，确保空文件为 0 行，结尾换行不产生虚假行，并兼容 LF、CRLF、CR。
   - 解析 `part/chapter/section/subsection/subsubsection`，支持 starred 标题、可选短标题和嵌套花括号。
   - 标题范围结束于下一个同级或上级标题的前一行；最后一个标题结束于文件末行，因此父标题范围包含子标题和浮动体。
   - 解析带花括号参数的 `input/include`，保留未解析、未补扩展名的原始 target。
   - 配对 `figure/table/figure*/table*` 的 begin/end，统一输出为 `figure` 或 `table`，范围包含结束命令所在行。
   - 在每个完整浮动环境内提取第一个有效 caption 和 label；caption 支持可选短标题和嵌套花括号。
   - 先屏蔽未转义 `%` 到行末的注释且保持字符位置不变，避免注释命令产生 item；`\%` 不开始注释。
   - 无法闭合的命令参数或环境只跳过对应 item，不让整个预览失败。
   - 合并所有解析结果，按命令在源码中的字符位置稳定排序，再移除内部 offset。
   - 完成 parser 测试后提交 `feat: add structured LaTeX file preview`。

3. **接入 service 和 MCP tool**
   - 增加预览结果及三个 item 分支的 TypeScript 类型。
   - `FileService.previewFile(filePath, projectName?)` 使用现有安全文件读取获取完整内容，调用纯 parser，并补充原始 `filePath`。
   - 新增独立 preview tool definition/handler；handler 只校验字符串参数、调用 service 并序列化 JSON。
   - 在 registry 中将 `preview_file` 放在 `list_files` 后，形成 `list_files → preview_file → read_file` 的推荐顺序。

4. **删除被替代的章节读取入口**
   - 删除 `get_sections` 和 `get_section_content` 的 tool definitions、handlers、registry 项及对应 tool 模块。
   - 删除 `FileService.getSections()`、`FileService.getSectionContent()` 和纯读取函数 `getSectionContent()`。
   - 保留 `parseSections()`、`replaceSection()`、`write_section` 及其现有行为；预览 parser 不改变编辑 parser。
   - 更新中文架构、能力文档和当前阶段的计划副本，登记 8 个最终工具和新的 preview 数据流。
   - 提交 `refactor: remove superseded section read tools`。

## Test and Acceptance

- Parser 单元测试覆盖：
  - 五级标题、starred 标题、可选短标题、嵌套 LaTeX 标题。
  - 父子标题的包含范围、同级边界和最后一个标题到 EOF。
  - `input/include` 的 target 和 1-based 行号。
  - `figure/table` 及 starred 变体、完整范围、caption/label 任意先后顺序和缺失字段省略。
  - 混合 item 的源码顺序。
  - LF、CRLF、CR、空文件、末尾换行。
  - 注释命令被忽略、转义百分号不被视为注释。
  - 畸形参数和未闭合环境被局部跳过，其他合法 item 仍返回。
- Service 测试验证选定项目只读取一次完整文件，并返回 `filePath + lineCount + items`。
- MCP contract 测试验证：
  - `preview_file` 仅要求 `filePath`，`projectName` 可选。
  - handler 参数转发和 JSON 文本完全匹配。
  - registry 最终包含 8 个工具并更新 snapshot。
  - 调用 `get_sections` 或 `get_section_content` 返回 `Unknown tool`。
- 保留 `write_section` 的 parser、替换和 Git updater 回归测试。
- 完成后运行 `npm run typecheck`、`npm test`、`npm run build`。
- 两个阶段提交均只暂存各自相关文件。

## Explicit Non-Changes

- 不递归读取或解析 `input/include` 目标，不补 `.tex`，也不检查目标是否存在。
- 不解析 equation、algorithm、listing、citation、bibliography、subfigure、`includegraphics` 或自定义宏。
- 不特别屏蔽 verbatim、lstlisting、minted 等字面量环境。
- 不返回正文摘要、内容片段、列号、父节点索引或递归 children。
- 不增加 Git transport 方法，不修改路径安全边界。
- 不修改 `write_section` 的标题匹配和编辑语义。
- 不保留旧章节读取工具的 alias 或兼容 handler。
- 本阶段保持 package、lockfile 和 server metadata 为 `1.1.0`，不执行 npm 发布。

## Assumptions

- 下一次公开版本号推迟到后续发布阶段决定；本阶段只形成开发提交。
- `preview_file + read_file(range)` 是今后唯一的结构化章节阅读工作流。
- 标题、caption、label 和 target 返回源码参数内容，不尝试渲染成纯文本。
- 未闭合或不支持的 LaTeX 结构不会产生 diagnostics，只是不进入 `items`。
