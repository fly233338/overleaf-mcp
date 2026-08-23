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

未设置环境变量或显式配置，且所有隐式配置候选均不存在时，首次启动会在用户配置目录创建 `overleaf-mcp/projects.json` 模板，在 stderr 输出文件位置和重启提示，然后结束。Linux/macOS 默认目录为 `~/.config`，Windows 使用 `%APPDATA%`。用户填写项目后，后续启动直接加载该配置。

配置中的项目名称直接作为 `projects` 对象的键，项目值只包含 `projectId` 和 `gitToken`：

```json
{
  "projects": {
    "test-mcp": {
      "projectId": "6943c3b439b88adfd6932e66",
      "gitToken": "your-git-token"
    }
  }
}
```

配置不使用单独的 `name` 字段。环境变量方式下，`OVERLEAF_PROJECT_NAME` 同样作为项目键；未设置时使用 `default`。

## MCP Tools

当前支持 8 个 tools：

| Tool | 状态 |
|---|---|
| `list_projects` | 已支持 |
| `list_files` | 已支持 |
| `preview_file` | 已支持 |
| `search_text` | 已支持 |
| `read_file` | 已支持 |
| `replace_text` | 已支持 |
| `write_file` | 已支持 |
| `write_section` | 已支持 |

tool 的 `projectName` 直接对应配置中的项目键；未指定时使用配置中的第一个项目。

`list_files` 默认过滤 `.tex` 文件；精确传入小写 `"all"` 时列出除 `.git` 目录外的全部普通文件。

`preview_file` 读取单个 LaTeX 文件并返回标题范围、`input/include` 引用以及 `figure/table` 的结构化 JSON；所有行号均为 1-based 且范围包含边界。

`read_file` 未提供范围参数时读取完整原文；可选的 `startLine` 和 `endLine` 使用 1-based、包含边界的行范围。

`replace_text` 只执行大小写敏感的字面量替换；`oldText` 必须非空。默认模式要求它在 pull 后的最新文件内容中恰好出现一次；显式传入 `replaceAll: true` 时替换全文所有从左到右、非重叠匹配。`newText` 可为空以删除匹配，并始终按字面量插入，`$&`、`$1` 等序列没有特殊含义；替换过程不会重新扫描新生成的内容。

所有写操作必须提供明确的 `commitMessage`。

## 文件能力

当前支持：

- 项目文件遍历
- 项目内纯文本搜索（返回文件路径、行号和匹配行）
- 文本文件读取
- LaTeX 文件结构化预览
- 默认唯一匹配、可显式全文替换的安全文本编辑
- 完整文件写入
- 用户路径限制在仓库根目录内

文件操作通过 Git transport 的本地仓库完成。

## LaTeX 能力

当前支持：

- 标题、外部文件引用和 figure/table 预览
- 按标题替换章节

预览和章节写入逻辑位于各自独立的纯函数模块中。

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
