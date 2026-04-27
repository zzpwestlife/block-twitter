# Status 页仅处理回复：跳过主楼（帖子本身）

日期：2026-04-27  
范围：`src/content/content.js`（content script）

## 背景 / 问题

当前扩展会对页面中识别到的推文元素（`article[data-testid="tweet"]` 等）统一进行：

- 关键词匹配与高亮（`UserHighlighter.highlight`）
- AI 识别结果复显（`aiSpamUsers`）
- 帖子旁 🚩 菜单（手动操作）

但用户的主要使用场景是 **推文详情页（status 页面）的回复区**：需要处理大量垃圾回复。  
因此 **主楼（帖子本身）不应被标记为垃圾、更不应被隐藏/屏蔽**（避免误伤主楼内容/作者）。

## 目标 / 成功标准

1. 仅在 **status 详情页** 生效：主楼推文不参与关键词/AI 标记，也不显示帖子旁 🚩。
2. 回复区推文保持原逻辑：关键词/AI/🚩 均正常工作。
3. 不影响用户显式“已隐藏/已屏蔽用户”的生效（`blockedUsers` 仍然应能隐藏该用户的主楼/回复）。

## 非目标

- 不在时间线（home/for you）、搜索、列表等页面改变行为。
- 不新增 UI 开关（默认按 status 页固定规则处理）。

## 方案（采纳）

### 1) 识别 status 页与主楼 tweet

仅当 `location.pathname` 包含 `/status/` 时启用。

在 content script 中新增辅助判断：

- `isStatusPage = /\\/status\\//.test(location.pathname)`
- `isRootTweet(postEl)`：
  - 优先：`postEl.closest('[data-testid="tweetDetail"]')` 为真则视为主楼
  - 兜底：缓存“页面上第一个出现在 tweetDetail 容器内的 tweet”作为 rootTweet

> 说明：X 的 DOM 可能会 re-render / 变更结构，因此采用多策略降低脆弱性。

### 2) 在处理流程中跳过主楼

在 `ContentScriptManager.processPost(postElement)` 中：

1. 保留最前面的“blockedUsers 直接隐藏并 return”（这是用户显式拉黑，不属于误判）
2. 在其后新增：
   - 若 `isStatusPage && isRootTweet(postElement)` 则直接 `return`，不执行：
     - `addManualClassifyButton`
     - `aiSpamUsers` 复显高亮
     - 关键词匹配与 `highlight`

### 3) AI 扫描时排除主楼

在 `AIScanButton._scan()` 中收集 `allPosts` 时，若是 status 页，则 filter 掉 rootTweet，避免 AI 扫描把主楼也纳入。

## 手动测试用例

1. 打开任意推文详情页 `/status/<id>`：
   - 主楼不出现关键词 badge、不出现 🚩，也不会被 AI 扫描标记
   - 回复区仍可出现关键词 badge 与 🚩
2. 若主楼作者在 `blockedUsers` 中：
   - 主楼仍会被隐藏（符合“用户显式隐藏”预期）

