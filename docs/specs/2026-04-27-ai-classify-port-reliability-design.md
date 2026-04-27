# 外部 AI 分类稳定性修复：Port 长连接 + 失败显式提示

日期：2026-04-27  
范围：
- `src/content/content.js`（`AIDetector._classifyBatchAPI` 调用链）
- `src/background/background.js`（新增 `onConnect` Port 通道）

## 背景 / 问题

你截图里的控制台报错：

> `Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`

这通常意味着 **MV3 background service worker 在等待 AI 网络请求期间休眠/被回收**，导致 `chrome.runtime.sendMessage` 通道被关闭。  
当前实现遇到这种情况会 fallback 为 `ok`，所以表面看起来是“AI 没识别”，实则是“请求没拿到结果”。

## 目标 / 成功标准

1. 外部 API 模式下（你当前 GPT-4o mini），AI 分类请求不再因为 message channel 关闭而频繁失败。
2. 若请求确实失败/超时，页面明确提示（toast），而不是静默变成全 `ok`。
3. 不改变现有输出协议（仍然 N 行 `序号: spam/ok`），解析器保持兼容增强版。

## 方案（采纳）

### 1) 使用 `chrome.runtime.connect` Port 长连接替代 `sendMessage`

在 content script 与 background 之间建立命名 Port（例如 `name="bt-ai-classify"`）：

- content script 持有 Port 单例，断开自动重连
- 每次分类请求带 `requestId`（uuid/自增）
- background 收到消息后调用 `handleAIClassify(payload)`，再通过 Port `postMessage({ requestId, success, labels, error })` 回传

Port 的存在通常可显著降低 SW 中途休眠导致的通道断开问题（比一次性 sendMessage 更稳）。

### 2) 超时与失败显式提示（toast）

在 content 侧为每个请求设置超时（例如 30s）：

- 超时/异常：显示 toast “AI 请求失败，请重试”
- 该批次结果不再静默当 `ok`（至少要让用户知道失败发生）

### 3) 保持现有一次重试（可选增强）

可保留现有“message channel closed”时的 retry 思路，但在 Port 模式下主要依赖重连与 timeout 处理。

## 手动验证

1. 在回复区触发 AI 扫描：不应再频繁出现 `message channel closed` 报错。
2. 断网/填错 API Key：应出现 toast 提示失败，而不是全 ok。

