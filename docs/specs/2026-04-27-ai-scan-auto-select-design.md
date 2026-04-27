# AI 扫描结果自动全选（仅本次 spam）

日期：2026-04-27  
范围：`src/content/content.js`（`AIScanButton` / `UserHighlighter` / `BatchBlockToolbar`）

## 背景 / 问题

当前 AI 扫描完成后，会对判定为 `spam` 的用户进行高亮并插入批量操作 checkbox，但这些 checkbox 默认未勾选。  
用户需要额外手动“逐个勾选 / 点全选”，再进行“隐藏所有选中/屏蔽所有(X)”等批量操作，步骤偏多。

## 目标 / 成功标准

1. **仅本次 AI 扫描判定为 spam 的用户**自动加入“已选中”集合并勾选 checkbox。
2. 扫描结束后批量工具条立即显示正确的“已选择 N 个用户”，用户可直接执行后续批量操作。
3. 不影响用户手动选择/取消选择；不把历史已标记/关键词命中的用户自动选中。

## 非目标

- 不实现“自动全选所有标记来源”（历史 AI、关键词等）。
- 不新增复杂 UI（例如撤销按钮）；本次仅减少一次操作步骤。

## 方案（采纳）

在 `AIScanButton._scan()` 中处理 AI 结果时：

当某条结果为 `spam` 且成功执行 `this.highlighter.highlight(liveEl, username, ['🤖 AI识别'])` 后：

1) **自动选中该用户**  
- `this.highlighter.selectedUsernames.add(username)`

2) **勾选当前 DOM 中对应 checkbox（若存在）**  
- 通过选择器 `.bt-select-checkbox[data-username="${username}"]` 查找并 `checked = true`

3) **刷新工具条计数**  
- 调用 `this.highlighter.onSelectionChanged?.()`（已有绑定到 `toolbar.update()`）

> 说明：因为 `highlight()` 可能在 re-render 场景下对“liveEl”重找元素，勾选动作应在 highlight 之后做，并以 DOM re-query 为准。

## 手动测试用例

1. 在回复区点击 🤖 AI 扫描，产生若干 spam 命中：
   - spam 命中的用户 checkbox 自动勾选
   - 批量工具条自动出现且计数正确
2. 手动取消某个 checkbox：
   - 工具条计数随之减少
3. 再次扫描（同一页追加命中）：
   - 仅本次新增命中会继续被自动选中（已有选中状态不受影响）

