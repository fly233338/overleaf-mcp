# 功能支持状态

本文档记录 `overleaf-mcp` 当前实际支持的能力。

状态只使用：

- 已支持
- 未支持

不将参考能力或未来设想描述为当前能力。

## 访问方式

| 能力 | 状态 |
|---|---|
| Overleaf Git 集成 | 已支持 |
| 多项目配置 | 已支持 |
| Git token 认证 | 已支持 |
| Overleaf Web API | 未支持 |
| Web session | 未支持 |
| 浏览器自动化 | 未支持 |

## MCP Tools

当前支持 9 个 tools：

| Tool | 状态 |
|---|---|
| `list_projects` | 已支持 |
| `list_files` | 已支持 |
| `search_text` | 已支持 |
| `read_file` | 已支持 |
| `get_sections` | 已支持 |
| `get_section_content` | 已支持 |
| `replace_text` | 已支持 |
| `write_file` | 已支持 |
| `write_section` | 已支持 |

这些 tools 保持当前 compatibility baseline 的公开参数和可见行为。

未指定 `projectName` 时使用默认项目。

`list_files` 默认过滤 `.tex` 文件；精确传入小写 `"all"` 时列出除 `.git` 目录外的全部普通文件。

`read_file` 未提供范围参数时读取完整原文；可选的 `startLine` 和 `endLine` 使用 1-based、包含边界的行范围。

`replace_text` 只执行大小写敏感的字面量替换；`oldText` 必须非空且在 pull 后的最新文件内容中恰好出现一次，`newText` 可为空以删除该匹配。

所有写操作必须提供明确的 `commitMessage`。

## 文件能力

当前支持：

- 项目文件遍历
- 项目内纯文本搜索（返回文件路径、行号和匹配行）
- 文本文件读取
- 唯一匹配的安全文本替换
- 完整文件写入
- 用户路径限制在仓库根目录内

文件操作通过 Git transport 的本地仓库完成。

## LaTeX 能力

当前支持：

- LaTeX 章节解析
- 章节列表
- 按标题读取章节
- 按标题替换章节

章节逻辑位于独立的纯函数模块中。

## Git 能力

当前支持：

- clone
- pull
- Git author 配置
- 单文件 staging
- commit
- push

写操作只 stage 当前修改的目标文件。

自动测试不访问真实 Overleaf。

## 安全边界

当前要求：

- token 不写入 stdout
- token 不出现在模型可见错误中
- 用户文件路径不得逃逸项目仓库
- stdout 仅用于 MCP stdio 协议

## 未支持能力

| 能力 | 状态 |
|---|---|
| Web 项目访问 | 未支持 |
| 免费账户 Web 能力 | 未支持 |
| LaTeX 编译 | 未支持 |
| PDF 获取或处理 | 未支持 |
| 评论 | 未支持 |
| revisions | 未支持 |
| LaTeX diagnostics | 未支持 |
| 通用 Overleaf CLI | 未支持 |

## 更新规则

改变模块边界、依赖方向或未来扩展落位规则时必须同步更新本文档。

只记录当前已经实现并经过测试的能力。
