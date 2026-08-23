# 为 `replace_text` 增加简单的 `replaceAll`

## Summary

保留现有 `replace_text` 主体、安全原则和 Git 流程，只增加可选布尔参数 `replaceAll`。默认模式继续要求全文唯一匹配；`replaceAll: true` 时替换全文所有非重叠字面量匹配。工具数量、名称和成功结果保持不变。

## Public Interface

```json
{
  "filePath": "sections/method.tex",
  "oldText": "feature extractor",
  "newText": "backbone network",
  "replaceAll": true,
  "commitMessage": "standardize terminology",
  "projectName": "paper"
}
```

- `replaceAll` 为可选 boolean，默认 `false`。
- 省略 `replaceAll` 或传入 `false` 时，`oldText` 必须在 pull 后的最新文件中恰好出现一次；0 次返回 `oldText was not found`，多次返回 `oldText is not unique; provide longer context`。
- `replaceAll: true` 时，`oldText` 必须至少出现一次，并从左到右替换所有非重叠匹配。
- 两种模式都保持大小写敏感和字面量匹配。
- `oldText` 为空或 `oldText === newText` 时在调用 transport 前拒绝；`newText` 可为空。
- replacement 中包含 `oldText` 时，不递归匹配新生成的内容。

## Implementation Work

1. **基线准备**
   - 将阶段 2 preview 提交以 fast-forward 合并到本地 `main`。
   - 让本地 `main` 和 `develop` 指向同一基线，后续修改在 `develop` 完成。

2. **扩展现有实现**
   - 在 `replace_text` schema 增加可选 boolean `replaceAll`，默认值为 `false`。
   - 复用现有 boolean 参数校验，非 boolean 值通过现有 MCP 错误通道拒绝。
   - 在 `FileService.replaceText()` 现有参数末尾追加 `replaceAll = false`，保持已有五参数调用有效。
   - 默认分支保留现有唯一匹配逻辑及错误文本。
   - 全文替换分支先确认至少一个匹配，再基于原始完整内容一次性生成结果，采用字面量、从左到右、非重叠语义。
   - 每个请求仍只调用一次 `transport.updateFile()`；不修改 Git transport，不新增 replacement 模块。

3. **文档与提交**
   - 更新架构和能力文档，说明默认唯一替换与显式全文替换两种模式。
   - 更新本计划副本，只保留简单 `replaceAll` 方案。
   - 完整验证通过后提交 `feat: add replace-all text editing`。

## Test and Acceptance

- Core 单元测试覆盖默认与显式 `false` 的唯一匹配行为，以及 `true` 时的单个、多处、跨行、删除、replacement 自包含和重叠字符串替换。
- 验证 0 匹配、空 `oldText` 和相同新旧文本被拒绝，错误文本与 transport 调用次数符合现有边界。
- MCP contract 测试覆盖 schema、默认说明、snapshot、三种参数转发和非 boolean 参数错误。
- 本地 fake Git 边界测试覆盖多匹配成功时的一次 pull/add/commit/push，以及 0 匹配时只完成 pull/read 且文件不变。
- 最终运行 `npm run typecheck`、`npm test`、`npm run build`。

## Explicit Non-Changes

- 不增加其他编辑参数或新的 Edit DSL。
- 不支持多文件、多组 `oldText/newText`、regex 或大小写选项。
- 不修改 `write_file`、`write_section`、tool registry 顺序或工具数量。
- 不修改 Git transport 的 `updateFile()` 事务边界。
- 不实现 Git push 失败后的本地文件回滚。
- 不修改当前版本号，不执行 npm 发布。

## Assumptions

- “替换全部”采用成熟字符串操作的非重叠匹配语义；例如 `aa` 在 `aaa` 中只有一个从左到右的可替换目标。
- 原子保证针对参数和匹配验证失败：updater 抛错时不写文件、不 add、不 commit、不 push。
