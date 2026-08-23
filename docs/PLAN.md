# 项目名称直接作为配置键

## Summary

将 `projects` 对象的键作为唯一项目名称，删除项目值中重复的 `name` 字段，并发布补丁版本。

## Implementation

- `ProjectConfig` 只保留 `projectId` 和 `gitToken`，不读取 `name` 字段。
- 首次启动模板不再生成 `name` 字段。
- 文件配置的项目键直接作为 `projectName` 和 `list_projects` 中的 `id`、`name`。
- 环境变量配置使用 `OVERLEAF_PROJECT_NAME` 作为项目键，省略时键为 `default`。
- tool 未传 `projectName` 时选择配置中的第一个项目。
- 不保留旧 `name` 字段的兼容逻辑。

## Test and Acceptance

- 配置测试覆盖键名加载、首次模板和环境变量键名。
- core 测试覆盖项目列表及省略 `projectName` 时选择首项。
- MCP contract snapshot 记录新的 `projectName` 描述。
- 依次通过 `npm run typecheck`、`npm test`、`npm run build` 和 `git diff --check`。

## Non-Changes

- 不修改 Git transport、tool 数量或注册顺序。
- 不增加迁移层、fallback 或额外配置字段。
- 不发布 README 改动，不执行 Git push 或 npm 以外的发布。
