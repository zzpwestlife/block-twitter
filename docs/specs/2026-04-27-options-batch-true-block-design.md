# 配置页：隐藏用户列表多选 + 批量 X 原生屏蔽（含频控/去重/已屏蔽处理）

日期：2026-04-27  
范围：
- `src/options/options.html / options.js`（UI 多选、进度展示、触发批量任务）
- `src/background/background.js`（批量任务调度、频控、tab 管理、与 content script 通信）
- `src/content/content.js`（新增“在用户主页执行原生 Block”的 DOM 自动化能力）

## 背景 / 问题

当前配置页的“隐藏用户列表（blockedUsers）”只能逐个点击 “Show/移除”。  
但用户实际希望：

1) 在隐藏用户列表里 **多选** 用户  
2) 一键对选中的用户执行 **X 原生屏蔽（Block）**  
3) 数量可能很多，需要 **频控/限速**，并处理“已屏蔽过”的情况  
4) **屏蔽成功后自动从隐藏列表移除**（你已确认）

## 目标 / 成功标准

1. options 页面可对 hidden users 多选（支持全选/取消全选、显示已选数量）。
2. 点击“批量屏蔽（X）”后，后台按频控串行执行：
   - 成功屏蔽 → 标记成功
   - 已经屏蔽过 → 视作成功（跳过）
   - 失败 → 记录失败原因并继续
3. 批量过程中可“停止/取消”。
4. 成功（含已屏蔽）后，该用户从 `blockedUsers` 中移除并刷新 UI。
5. 频控策略防止短时间高频触发：默认 1.5~3s 随机间隔，每 20 个额外休息 8~15s。

## 非目标

- 不做并发屏蔽（并发更容易触发风控与 UI 混乱）。
- 不保证 100% 成功（X UI 变化/网络/登录状态都会影响），但必须可见失败原因。

## 方案对比

### 方案 A：在 x.com 用户主页自动化点击 Block（推荐）
- background 打开/复用一个 x.com tab
- 依次导航到 `https://x.com/<username>`
- content script 在主页找 “更多操作(⋯)” → 点击 “Block/屏蔽” → 确认
- 优点：不依赖该用户出现在时间线/回复里；适合批量处理隐藏列表
- 缺点：需要做一套“主页 Block 自动化”的 selector 兼容

### 方案 B：在页面上找该用户某条推文复用 TrueBlocker（不推荐）
- 需要该用户在当前页面存在推文 DOM；隐藏列表通常并不满足
- 可靠性/覆盖面差

结论：采用 **方案 A**。

## 设计细节

### 1) Options UI（多选 + 批量操作条）

在“Hidden Users”区块：

- 每行新增 checkbox
- 顶部新增操作条：
  - “全选 / 取消全选”
  - “已选 N”
  - “批量屏蔽（X）”按钮
  - “停止”按钮（仅批量进行中显示）
- 进度面板：
  - `处理中 x / y`
  - 成功/已屏蔽/失败数量
  - 失败列表（最多显示前 20 条，避免页面过长）

### 2) Background 批量任务调度（串行 + 频控）

新增一个 batch job 管理器：

- 只允许同时运行 1 个 job（防止重复点击）
- job 状态：`idle/running/cancelled/done`
- 逐个处理 username：
  1. `await sleep(jitter(1500..3000))`
  2. 每 20 个额外 `await sleep(jitter(8000..15000))`
  3. 调用 `ensureXTab()` + `navigateToProfile(username)`
  4. 通过 `chrome.tabs.sendMessage(tabId, { type: 'bt_trueBlockProfile', username, requestId })`
  5. 解析结果：`success | already_blocked | failed`
  6. 若 success/already_blocked：从 `blockedUsers` 删除并 `chrome.storage.local.set(...)`
  7. 向 options 页面推送进度事件（runtime message 或 port）

取消逻辑：
- options 点击“停止” → background 将 job 标记 cancelled，并在下一次循环前退出。

### 3) Content Script：主页 Block 自动化（ProfileBlocker）

在 `src/content/content.js` 增加一个处理 message 的分支（或复用已有 onMessage/handler）：

输入：`{ type: 'bt_trueBlockProfile', username, requestId }`

执行步骤（尽量多 selector/fallback）：

1. 等待主页主容器可用（避免页面还在加载）
2. 快速检查“是否已屏蔽”：
   - 页面上是否存在 “Blocked/已屏蔽/解除屏蔽(Unblock)” 相关按钮或菜单项
   - 若已屏蔽 → 返回 `{ status: 'already_blocked' }`
3. 找到用户操作菜单按钮：
   - `[data-testid="userActions"] [data-testid="userActionsButton"]`（示例）
   - 或 `button[aria-label*="More"]` / `button[aria-label*="更多"]`
4. 打开菜单后找到 “Block/屏蔽” menuitem 并点击
5. 点击确认（复用 TrueBlocker 的 `confirmationSheetConfirm` selector）
6. 返回 `{ status: 'success' }`，失败则 `{ status: 'failed', error }`

### 4) 已屏蔽处理

“已屏蔽”当作成功：
- UI 计入 success（或单独计数 already_blocked）
- 同样从 `blockedUsers` 移除（因为已达到目标）

### 5) 频控/风控策略

- 默认串行 + jitter
- 遇到连续失败（例如 5 个连续失败）时：
  - 暂停更久（例如 30s）
  - 并提示用户可能被风控或未登录

## 安全与用户体验

- 批量任务开始前弹确认框：显示将要屏蔽的数量与提醒“请保持登录状态”
- 任务执行中尽量不抢夺用户当前浏览 tab：
  - 使用后台新开 tab（或复用已有 x.com tab），不强制切换焦点（最佳努力）

## 手动测试用例

1. 在 options 隐藏用户列表勾选 10 个用户 → 批量屏蔽：
   - 进度条正常滚动
   - 成功用户从隐藏列表消失
2. 包含已屏蔽用户：
   - 显示为已屏蔽（或视作成功）并从隐藏列表移除
3. 批量数量 50+：
   - 不会高频连点，间隔符合频控，且可停止
4. 未登录 X：
   - 失败提示明确（例如“未登录/无法找到操作菜单”），不会静默

