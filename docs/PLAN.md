# 首次启动自动创建配置

## Summary

当环境变量、显式配置和现有隐式候选都没有提供项目配置时，在用户配置目录创建可直接编辑的 `projects.json` 模板，向 stderr 提示路径和重启操作，然后正常结束。用户填写一次后，后续 MCP 客户端启动沿用现有配置加载流程。

## Implementation

- 保留现有环境变量、显式文件、用户目录、当前目录和包目录的配置优先级。
- 仅在所有隐式候选都因不存在而跳过后创建用户配置，不改变无效 JSON、权限错误或显式文件缺失的错误行为。
- 模板包含一个 `default` 项目以及待填写的 `name`、`projectId`、`gitToken`。
- `config.ts` 创建目录和文件后抛出专用首次启动信号；`bin.ts` 将信号消息写入 stderr 并直接返回，不启动 MCP transport。
- 文件创建使用排他写入，避免覆盖已存在的配置。

## Test and Acceptance

- 首次无配置时按既有顺序检查所有隐式候选，只创建用户目录下的 `projects.json`。
- 提示包含实际配置路径以及 `Add your Overleaf project and restart.`。
- 模板是有效 JSON；填写后可由现有 loader 正常加载。
- 其他配置来源、校验和错误行为保持不变。
- 依次通过 `npm run typecheck`、`npm test`、`npm run build` 和 `git diff --check`。

## Non-Changes

- 不增加交互式配置向导、额外命令或新的配置格式。
- 不修改 MCP tools、Git transport、版本号或发布配置。
- 不执行 npm 发布。
