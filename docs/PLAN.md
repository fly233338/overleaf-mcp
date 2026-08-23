# 为 `replace_text` 增加简单的 `replaceAll`

## Summary

`replace_text` 增加可选布尔参数 `replaceAll`，默认值为 `false`。工具名称、数量、成功结果、安全边界和 Git 流程保持不变。

## Public Contract

- `replaceAll` 省略或为 `false` 时，`oldText` 必须在 pull 后的最新文件中恰好出现一次。
- `replaceAll: true` 时，`oldText` 必须至少出现一次，并从左到右替换全文所有非重叠匹配；例如 `aa` 在 `aaa` 中只有一个目标。
- 两种模式均为大小写敏感的字面量匹配。
- `oldText` 为空或与 `newText` 相同时，在调用 transport 前拒绝。
- `newText` 可为空，并始终按字面量插入；`$&`、`$1` 等序列没有特殊含义。
- 替换结果基于原始完整内容一次性生成，不重新扫描新生成的 replacement 内容。

## Implementation

- `replace_text` schema 声明可选 boolean `replaceAll` 及默认值 `false`，handler 复用现有 boolean 校验并转发参数。
- `FileService.replaceText()` 在现有参数末尾使用 `replaceAll = false`，保留默认唯一匹配逻辑和既有错误文本。
- 全文模式确认至少一次匹配后，通过 `split(oldText).join(newText)` 生成结果。
- 每个请求只调用一次 `transport.updateFile()`，由现有 updater 事务完成 pull、读取、写入、提交和推送。

## Test and Acceptance

- Core 测试覆盖默认唯一替换、显式全文替换、零匹配、删除、跨行和重叠语义。
- 字面量 replacement 测试同时证明包含 `oldText` 时不递归，并原样保留 `$&`、`$1`。
- MCP contract 测试覆盖 schema、snapshot、参数转发和非 boolean 参数错误。
- fake Git 测试覆盖成功与匹配失败的单次 updater 事务边界。
- 完成后依次运行 `npm run typecheck`、`npm test`、`npm run build` 和 `git diff --check`。

## Non-Changes

- 不修改 core 替换算法、Git transport、tool registry、工具数量或版本号。
- 不增加其他编辑能力或替换选项。
- 不执行 npm 发布。
