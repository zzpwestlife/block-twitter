# AI 扫描提示词补漏优化：SM/床搭子/DD/可飞🍑 等模式

日期：2026-04-27  
范围：
- `src/content/content.js`
  - `AIDetector.DEFAULT_SYSTEM_PROMPT`
  - `AIDetector._extractKeywordGroups()`（分组正则）
- `src/background/background.js`
  - `handleAIClassify()` 将 `内容`截断从 200 → 300

## 背景 / 问题

在外部 API 后端（Base URL + API Key）模式下，出现漏报样例：

- 昵称/显示名含明显暗示：例如“可飞🍑”
- 内容含明显性暗示/求约：例如 “蹲个 SM 的床搭子 DD”

当前提示词更偏“保守”，同时 keywords 分组正则未显式覆盖这些新模式，导致模型对该类样本可能倾向输出 `ok`。

## 目标 / 成功标准

1. 对“SM/BDSM/床搭子/可飞🍑/可空降/求搭子 DD”这类高置信模式，AI 更倾向判 `spam`（补漏）。
2. 不显著抬高误报：对正常语境出现的“SM”（如技术 SMB/缩写）应尽量避免误伤（通过语境/中文搭配约束）。
3. 外部 API 输入文本截断更合理：从 200 提升到 300，降低关键信息被截断导致的漏报。

## 非目标

- 不新增复杂模型训练流程。
- 不改变输出格式（仍只允许 `spam`/`ok`）。

## 方案（采纳）

### 1) 强 spam 规则补充（Prompt 文本）

在 `AIDetector.DEFAULT_SYSTEM_PROMPT` 的“强 spam 信号”中新增/强调：

- SM/BDSM/调教/床搭子/固炮 等性暗示相关词（尤其与“蹲/找/约/同城/线下/哥哥/弟弟/DD”等搭配时）
- 昵称/显示名包含“可飞/可空降/可约/可🍑/🍑”等暗示（作为强信号）

并明确说明：若仅出现英文缩写 “SM” 且语境为技术/文件/产品缩写，应优先判 `ok`（降低误伤）。

### 2) keywords 分组正则补充（用于高置信示例注入）

在 `AIDetector._extractKeywordGroups()` 中增强：

- `sex` 组：加入 `SM|BDSM|床搭子|可飞|可空降|可约|🍑|飞🍑` 等模式（大小写不敏感）
- `offline` 组：将 `DD` 识别从 `\bdd\b` 改为“独立 token”的更可靠匹配（例如有空格分隔，或后接 emoji/标点）

目的：让 system prompt 注入的“高置信示例”覆盖该类新模式，减少漏报。

### 3) API 输入截断长度 200→300

在 `src/background/background.js` 的 `handleAIClassify()` 中，将：

```js
p.text.slice(0, 200)
```

调整为：

```js
p.text.slice(0, 300)
```

以减少模型看不到关键句的概率。

## 手动验证

1. 用同一条漏报样例（昵称含“可飞🍑”，内容含“SM/床搭子/DD”）再次触发 AI 扫描，期望判 `spam`。
2. 找 2~3 条正常内容含 “SM/同城/附近” 但无引流/性暗示的样例，期望仍判 `ok`。

