# AI 扫描补漏：结构化特征（随机号/emoji 密集/模板短句）注入

日期：2026-04-27  
适用后端：外部 API（你当前使用 GPT-4o mini）  
范围：`src/background/background.js`（优先），可选补充 `src/content/content.js`（Chrome AI backend）

## 背景 / 问题

你反馈的漏报样例里，很多内容语义很弱（鸡汤短句、少量字），但账号画像很强：

- `@handle` 常为 **随机字母+数字**（无语义）
- 内容 **emoji 密集** 或 “模板化擦边短句 + emoji”

仅靠自然语言提示词让模型“自己推断随机号/emoji 密度”，稳定性不高；即使模型能力足够，也容易输出 `ok`。

## 目标 / 成功标准

1. 让 AI 明确收到可机器计算的特征字段，并在提示词中优先使用这些字段做判断，从而补漏。
2. 使用**激进阈值策略**（你已确认）：更倾向补漏，允许误报略升。
3. 不要求更换模型（GPT-4o mini 可继续用）；若效果仍不足再考虑换更强模型。

## 非目标

- 不新增“本地硬判定直接 spam”的预判层（本轮仍由 AI 输出 spam/ok）。
- 不改变 UI。

## 方案（采纳）

### 1) 在外部 API 的每条帖子输入中加入“结构化特征”行（background.js 组装）

在 `handleAIClassify()` 构造 `postsText` 时，除了：

```
[n] 账号: <displayName (@handle)>
    内容: <text>
```

增加一行：

```
    特征: random_handle=<true/false>, emoji_count=<int>, emoji_ratio=<0-1>, has_link=<true/false>, has_bait_word=<true/false>
```

这些特征全部在 background 侧根据 `username/text` 计算，不依赖模型推断。

### 2) 更新 system prompt：明确“优先按特征阈值判定”

在 `AIDetector.DEFAULT_SYSTEM_PROMPT`（或 `aiCustomPrompt`）中新增规则：

- 当 `random_handle=true` 且（`emoji_count>=6` 或 `emoji_ratio>=0.25`）时，若文本本身缺乏具体语义（短句/鸡汤/模板擦边），**倾向判 spam**。
- 当 `has_bait_word=true` 且 `random_handle=true` 时，倾向判 spam。
- 仅当账号不像随机号且无明显引流信号时，鸡汤短句优先 ok（控制误伤）。

### 3) userMsg 强制输出格式保持（已完成）

继续要求输出 N 行 `序号: spam/ok`，解析器已增强兼容多种分隔符。

## 特征定义（实现细节）

- `random_handle`：handle 去掉 `@` 后符合以下之一：
  - `^[a-z]{4,}\\d{3,}$`（如 `arvnopup92270`）
  - 或 `^[a-z0-9]{10,}$` 且数字占比高（可选增强）
- `emoji_count`：用 Unicode `\\p{Extended_Pictographic}` 统计
- `emoji_ratio`：`emoji_count / max(1, nonSpaceLen)`（nonSpaceLen 为去空白后的长度）
- `has_link`：文本含 `http://` 或 `https://`
- `has_bait_word`：命中 bait 词（男大弟弟/舞蹈生/一字马/被指挥/可月可约/真人可月/随心所欲/后劲很大/高级又治愈 等）

## 手动验证

1. 对“随机号 + emoji 很多 + 鸡汤短句/模板短句”的回复区样本，期望更容易判 spam。
2. 对正常账号（非随机号）发布的普通鸡汤，期望仍多为 ok（可能略有误伤，需要后续微调阈值）。

