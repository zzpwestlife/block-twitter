# 帖子旁 🚩 手动标记：一层快速操作面板（隐藏/屏蔽/垃圾/误报）

日期：2026-04-27  
范围：`src/content/content.js`（content script，`UserHighlighter`）

## 背景 / 问题

当前每条帖子用户名旁会出现一个小 🚩（`.bt-manual-classify-btn`）。点击后会弹出菜单，但用户想完成“隐藏/屏蔽”通常需要：

1) 点击 🚩 打开菜单  
2) 再点击菜单里的某个选项（或先做标记再去点其它按钮）

在需要大量处理（批量隐藏/屏蔽）时，操作负担偏重。目标是**尽量减少操作次数**，并把常用动作放在第一层即可完成。

## 目标 / 成功标准

1. 点击帖子旁 🚩 后，弹层第一屏即可直接执行：
   - **隐藏（本地）**
   - **屏蔽（X 原生）**
2. 同一层仍保留：
   - **标记为垃圾**
   - **标记为误报**
3. 弹层位置稳定（锚定 🚩），点击空白处关闭。
4. 不破坏现有数据记录：`aiSpamUsers` / `falsePositiveUsers` / `blockedUsers` 的存储逻辑保持一致。

## 非目标

- 不改变右下角悬浮 🚩 开关按钮（`#bt-manual-toggle-btn`）的逻辑。
- 不新增复杂设置项（例如“默认动作”）。

## 方案（采纳）

将 `UserHighlighter._showManualMenu()` 从“二选一分类菜单”升级为“快速操作面板”，在同一弹层内提供 4 个动作：

### 动作与行为

1) **隐藏（本地）**
- 直接调用：`window.blockingManager?.blockUser(username)`
- 预期：立即隐藏该用户当前页面帖子，并写入 `blockedUsers`（与现有“隐藏”逻辑一致）

2) **屏蔽（X 原生）**
- 直接调用：`TrueBlocker.block(postElement, username)`
- 成功后：同样调用 `window.blockingManager?.blockUser(username)` 做本地隐藏兜底（与现有“🚫 屏蔽(X)”按钮逻辑一致）
- 失败则给出轻量反馈（toast 或按钮文案短暂变更），不让用户无感

3) **标记为垃圾**
- 沿用当前逻辑：
  - 如未被标记（`data-keyword-matched` 不存在），先 `highlight(postElement, username, ['✋ 手动标记'])`
  - 写入 `aiSpamUsers[username] = Date.now()` 并删除 `falsePositiveUsers[username]`

4) **标记为误报**
- 沿用当前逻辑：
  - 如已标记，执行 `dismissHighlight(postElement, username)`
  - 否则写入 `falsePositiveUsers[username] = Date.now()` 并删除 `aiSpamUsers[username]`

### UI 布局

弹层继续使用当前 `.bt-manual-menu` 的基础样式，但内容从 2 项扩展到 4 项：

- 第 1、2 项（隐藏/屏蔽）作为“高频动作”，放在上方
- 第 3、4 项（垃圾/误报）放在下方
- 可以用分割线（`border-top`）分组，但不强制

## 交互细节

- 点击某个动作后：
  - 立即关闭菜单（避免重复点击）
  - 对异步动作（屏蔽/隐藏持久化）提供按钮短暂 disabled + 文案反馈（例如“处理中...”）
- 菜单打开时只存在一个：打开前先移除其它 `.bt-manual-menu`

## 测试用例（手动）

1. 点击任意帖子旁 🚩，弹层出现 4 个动作：隐藏 / 屏蔽(X) / 标记为垃圾 / 标记为误报。
2. 点击“隐藏”，该用户帖子立刻隐藏；刷新页面仍保持隐藏。
3. 点击“屏蔽(X)”，触发 X 原生流程；成功后该用户帖子隐藏；刷新仍隐藏。
4. 点击“标记为垃圾”，出现高亮标记；并写入 `aiSpamUsers`。
5. 点击“标记为误报”，高亮消失；并写入 `falsePositiveUsers`，且从 `aiSpamUsers` 移除。

