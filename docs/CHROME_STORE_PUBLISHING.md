# Chrome Web Store 上架完整指南

**预计时间**：2-3 周（含审核等待）  
**成本**：$5 美元（开发者账号注册费，一次性）

---

## 📅 时间表

```
第 1-2 天  → 准备上架材料（图标、截图、文案）
第 3 天    → 注册开发者账号 + 支付 $5
第 4-5 天  → 打包扩展 + 上传 + 填写商店信息
第 6 天    → 最终检查 + 提交审核
第 7-14 天 → 等待 Google 审核（通常 1-7 个工作日）
```

---

## 🚀 快速开始（TL;DR）

如果你只有 10 分钟，按以下顺序做：

1. **准备图标和截图**（30 分钟）— 用 Canva/Figma 快速生成
2. **注册开发者账号**（5 分钟）— 支付 $5，登录 [Developer Console](https://chrome.google.com/webstore/devconsole)
3. **创建 ZIP 包**（5 分钟）— 运行下面的打包命令
4. **上传 + 填写信息**（30 分钟）— 粘贴文案，上传图标截图
5. **提交审核**（1 分钟）— 点击 Submit

---

## 阶段一：准备上架材料

### 1.1 图标（必须）

需要 4 张 PNG 格式的图标文件，存放在 `public/icons/` 目录：

| 尺寸 | 用途 | 文件名 | 优先级 |
|------|------|--------|--------|
| 16×16 px | 浏览器工具栏 | `icon-16.png` | 低 |
| 32×32 px | Windows 任务栏 | `icon-32.png` | 低 |
| 48×48 px | 扩展管理页面 | `icon-48.png` | 中 |
| **128×128 px** | **Chrome Web Store 列表** | **`icon-128.png`** | **🔴 最重要** |

**128×128 图标最重要**，这是用户在商店看到的主要图标。

#### 快速生成图标（推荐方案，30 分钟）

**选项 A：用 Canva（最简单）**
1. 打开 [Canva.com](https://www.canva.com)
2. 搜索"Logo"或"App Icon"模板
3. 创建 1280×1280 设计（最后缩小）
4. 加入"🚫"符号或简单的屏蔽图案
5. 导出为 PNG，然后用 Image Resize 工具缩小到各种尺寸

**选项 B：用 Figma（专业）**
1. 打开 [Figma.com](https://www.figma.com)
2. 创建新项目
3. 创建 128×128 画板（和截图设计）
4. 设计简洁的图标（推荐用"🚫"配色：深红）
5. 导出为 PNG，自动支持多种尺寸

**选项 C：用在线工具（最快）**
- [Favicon Generator](https://www.favicon-generator.org/)
- [Icon Generator](https://icon.kitchen/)
- 上传一张图片，自动生成多种尺寸

**选项 D：继续用占位图（可行）**
- 项目中已有占位图，可以先用这个上架
- 审核通过后可以更新图标（Google 允许更新）
- 这样可以立即开始审核流程

#### 图标设计建议

```
推荐配色：深红 (#7f1d1d) + 白色 (#ffffff)
符号：🚫（禁止符号）或简化的屏蔽图案
风格：简洁、现代、易识别
背景：透明或纯色
```

### 1.2 商店截图（必须，至少 1 张）

**要求**：

| 项目 | 要求 |
|------|------|
| **数量** | 1~5 张（至少 1 张，推荐 3 张） |
| **尺寸** | 1280×800 px（推荐）或 640×400 px |
| **格式** | PNG 或 JPG |
| **文件名** | screenshot-1.png, screenshot-2.png 等 |

#### 推荐的 3 张截图内容

**截图 1：关键词检测 + 标记**
- 显示 X.com 页面
- 几条帖子带有橙色左边框
- 用户名旁显示"⚠ N keywords"
- 标题：`Automatic keyword detection with orange indicators`

**截图 2：隐藏和屏蔽操作**
- 展示 Hide User 和 🚫 屏蔽(X) 两个按钮
- 显示工具栏底部的"隐藏所有选中"和"屏蔽所有(X)"
- 标题：`Two modes: local hide or native block`

**截图 3：设置页面**
- 显示关键词列表
- 展示 URL 导入功能
- 显示已隐藏用户列表
- 标题：`Easy management: keywords, URL import, blocked users`

#### 快速获取截图

**方法 1：用 Chrome DevTools（推荐，最快）**
```
1. 打开 X.com，加载扩展
2. 点击扩展 Open Settings，配置关键词
3. 回到 X.com，刷新页面，找到匹配的帖子
4. 按 F12 打开 DevTools
5. 右上角菜单 ⋮ → More tools → Capture screenshot
6. 选择 Capture full page screenshot
7. 截图保存到本地，用图片编辑器剪裁到 1280×800
```

**方法 2：用 Mac 原生截图**
```
Cmd+Shift+5 → 选择窗口 → 截图 → 编辑
```

**方法 3：用在线工具**
- [ScreenFlow](https://www.telestream.net/screenflow/) - Mac
- [ShareX](https://getsharex.com/) - Windows
- Chrome 扩展：[Full Page Screen Capture](https://chrome.google.com/webstore/detail/full-page-screen-capture)

#### 截图编辑建议

```bash
# 用 ImageMagick 批量调整大小
convert screenshot-1.png -resize 1280x800 screenshot-1-final.png
```

或用在线工具：[Resize Image](https://resizeimage.net/)

### 1.3 宣传图（可选但强烈推荐）

| 类型 | 尺寸 | 说明 |
|------|------|------|
| 小型宣传图 | 440×280 px | 出现在搜索结果中 |
| 大型宣传图 | 1400×560 px | 出现在 Featured 精选栏 |
| Marquee 图 | 1400×560 px | 置顶推荐时使用 |

### 1.4 扩展描述文案

需要准备两份文案：

#### 简短描述（132 字符以内）

显示在搜索结果中，是吸引用户点击的第一印象。

**版本 1（简洁版）**：
```
Block X/Twitter users by keywords. One-click hide, batch operations, native block.
```
（108 字符）

**版本 2（功能突出版）**：
```
Fast block X/Twitter spam. Keywords + hide/block + batch ops + zero tracking.
```
（92 字符）

**版本 3（中英混合）**：
```
🚫 屏蔽 X/Twitter 垃圾账号 — 关键词检测、一键隐藏、原生屏蔽、零跟踪
```
（48 字符，含中文）

#### 详细描述（16000 字符以内）

是商店页面的主要内容，用户会看得比较仔细。参考以下模板：

```markdown
Block and hide X/Twitter users with ease.

## CORE FEATURES

✓ Keyword-based detection — Automatically flag posts containing specified keywords
✓ Two blocking modes:
  - Hide User (local CSS hiding, non-destructive)
  - 🚫 Block(X) (native X block, true platform-level blocking)
✓ Batch operations — Hide or block 10-100+ users at once
✓ Real-time cross-tab sync — Changes apply instantly everywhere
✓ URL import — Import keywords from GitHub Gist, JSON, or plain text
✓ Smart matching:
  - English: Complete word matching (case-insensitive)
  - Chinese/Japanese/Korean: Substring matching
  - Emoji: Full support
✓ Data management — Export/import as JSON for backup and sharing

## PRIVACY & SECURITY

✓ 100% local storage — All data stays on your device
✓ Zero tracking — No data collection or analytics
✓ No external APIs — Extension doesn't call any remote servers
✓ Open source — Code is public and auditable on GitHub

## HOW TO USE

1. **Add Keywords**
   - Click extension icon → "Open Settings"
   - Enter keywords (e.g., "spam", "scam", "垃圾")
   - Click "Add"

2. **Detect & Mark**
   - Matching posts show orange left border + keyword badge
   - Works in real-time as new posts load

3. **Hide or Block**
   - "Hide User" — Local CSS hide (non-destructive)
   - "🚫 Block(X)" — Automatic native X block (true blocking)
   - Or batch select and use toolbar buttons

4. **Manage Data**
   - Export keywords as JSON backup
   - Import from GitHub Gist URL
   - Manage hidden users in settings

## SUPPORTED LANGUAGES

✓ English (complete word matching)
✓ Chinese (Simplified & Traditional)
✓ Japanese, Korean (substring matching)
✓ All languages supported via Emoji

## LIMITATIONS

- First load on X.com takes ~2 seconds (X's dynamic loading)
- Requires Chrome/Chromium-based browser
- No Firefox/Safari support (yet)

## DOCUMENTATION

- Full guide: https://github.com/yourusername/block-twitter/blob/main/docs/USER_GUIDE.md
- Troubleshooting: https://github.com/yourusername/block-twitter/blob/main/docs/TROUBLESHOOTING.md
- Source code: https://github.com/yourusername/block-twitter

Free. Forever. No ads. No tracking. Open source.
```

**关键点**：
- 用 ✓ 符号列出特性（易扫读）
- 强调隐私和本地存储
- 包括完整的使用步骤
- 列出支持的语言
- 包含 GitHub 链接（增加可信度）

**参考详细描述**（可根据实际功能调整）：
```
Block and hide X/Twitter users with ease. Create custom keyword lists to automatically flag posts and block users. Two blocking modes:

★ CSS Hide — Local, non-destructive hiding (posts hidden, not deleted)
★ Native X Block — True platform-level blocking (same as X's block feature)

Features:
• Keyword-based detection with orange indicators on matching posts
• One-click hide user or native block with automatic menu simulation
• Batch operations: select multiple users and hide/block in bulk
• Real-time sync across all tabs — changes apply instantly
• Data import from URL: import keyword lists from GitHub Gist or plain text
• Export/import keywords as JSON for backup or sharing
• Smart matching: complete word matching for English, substring for Chinese

Everything stays on your device — no data is sent to servers. All data stored locally in browser storage.

Perfect for filtering spam, blocking controversial content, or managing your Twitter experience.
```

### 1.5 隐私政策（如有数据收集则必须）

本扩展不收集任何用户数据，数据完全本地存储，通常可在商店描述中说明，无需单独隐私政策页面。但如果你计划上架到需要权限的分类，Google 可能要求提供。

建议在 GitHub 或个人网站上创建一个简单的隐私政策页面，内容示例：

```
block-twitter Privacy Policy

This extension does not collect, transmit, or share any personal data.
All data (keywords and hidden users) is stored locally in your browser
using chrome.storage.local and never leaves your device.
```

### 1.6 检查 manifest.json

上架前确认以下字段完整：

```json
{
  "manifest_version": 3,
  "name": "block-twitter",
  "version": "0.1.0",
  "description": "Block X/Twitter users by keywords. One-click hide or native block.",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["https://x.com/*", "https://twitter.com/*"]
}
```

> **name** 和 **description** 字段会直接显示在商店页面，确保清晰准确。

---

## 阶段二：注册 Chrome Web Store 开发者账号

### 2.1 访问开发者控制台

打开：[https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

### 2.2 注册开发者账号

1. 使用 Google 账号登录
2. 阅读并同意《Chrome Web Store 开发者协议》
3. 支付 **一次性注册费 $5 美元**（用于防止滥用，只需支付一次）
4. 填写开发者信息（名称、联系邮箱）

> 注册费支持信用卡/借记卡支付，PayPal 不支持。

---

## 阶段三：打包扩展（3 分钟）

### 3.1 项目结构检查

确认项目干净，应该包含这些文件：

```
block-twitter/
├── manifest.json              ← ✅ 必须在根目录
├── src/
│   ├── background/background.js
│   ├── content/content.js
│   ├── content/content.css
│   ├── popup/popup.{html,js,css}
│   └── options/options.{html,js,css}
└── public/
    └── icons/
        ├── icon-16.png
        ├── icon-32.png
        ├── icon-48.png
        └── icon-128.png
```

**不需要包含的文件**（会自动排除）：
```
❌ .git/, .gitignore
❌ .claude/
❌ docs/
❌ TESTING.md, README.md
❌ node_modules/
❌ .DS_Store
```

### 3.2 创建 ZIP 包（推荐命令行，3 分钟）

打开终端，进入项目根目录：

```bash
cd /Users/joeyzou/Code/OpenSource/block-twitter

# 创建 ZIP 包
zip -r block-twitter-v0.1.0.zip . \
  --exclude "*.git*" \
  --exclude "node_modules/*" \
  --exclude ".DS_Store" \
  --exclude ".claude/*" \
  --exclude "docs/*" \
  --exclude "TESTING.md" \
  --exclude "README.md" \
  --exclude "superpowers/*"

# 验证文件大小（应该 < 5MB）
ls -lh block-twitter-v0.1.0.zip
```

**或用 GUI（macOS/Windows）**：
- macOS：选中所有文件 → 右键 → "压缩"
- Windows：选中所有文件 → 右键 → "发送到" → "压缩(zipped)文件夹"

> ⚠️ **重要**：ZIP 根目录必须直接是 `manifest.json`，**不能在子文件夹里**！

### 3.3 验证 ZIP 包正确性

**方法 1：命令行验证（推荐）**

```bash
# 检查 manifest.json 是否在根目录
unzip -l block-twitter-v0.1.0.zip | grep manifest.json

# 应该输出：block-twitter-v0.1.0/manifest.json
# 不要输出：block-twitter-v0.1.0/block-twitter/manifest.json
```

**方法 2：解压测试**

```bash
# 创建临时目录
mkdir -p /tmp/test-block-twitter
unzip block-twitter-v0.1.0.zip -d /tmp/test-block-twitter/

# 检查结构
ls -la /tmp/test-block-twitter/manifest.json  # 应该直接在根目录

# 在 Chrome 中测试加载
# 打开 chrome://extensions/ → Load unpacked
# 选择 /tmp/test-block-twitter/ 目录
```

**方法 3：在 Chrome 中测试（最保险）**

1. 创建临时文件夹：`/tmp/test-block-twitter/`
2. 解压 ZIP：`unzip block-twitter-v0.1.0.zip -d /tmp/test-block-twitter/`
3. 打开 `chrome://extensions/`，启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `/tmp/test-block-twitter/`
6. ✅ 扩展能正常加载且功能可用？→ ZIP 包正确！

**检查清单**：
```
✅ ZIP 大小 < 5MB
✅ manifest.json 在根目录（ls -la 直接看到）
✅ 所有 src/ 文件都包含了
✅ public/icons/*.png 都包含了
✅ Chrome 能正常加载此扩展
✅ 扩展功能正常（添加关键词、隐藏用户等）
```

---

## 阶段四：在开发者控制台创建商店页面（30 分钟）

### 4.1 创建新项目 + 上传 ZIP

**步骤**：

1. 打开 [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole)
2. 确保已登录 Google 账号且已完成 $5 注册
3. 点击 **"New item"（新建项目）**按钮
4. 上传 ZIP 文件：`block-twitter-v0.1.0.zip`
5. 等待 Google 自动解析 manifest.json（约 1-2 分钟）
6. ✅ 显示"Package uploaded successfully"

**检查项**：
```
✅ manifest.json 成功解析
✅ 扩展名自动填充为 "block-twitter"
✅ 版本号显示为 0.1.0
✅ 权限列表正确（storage, scripting）
```

### 4.2 填写商店详情（最关键的部分）

上传后会进入"Item details"编辑页面，需要填写以下信息：

#### 4.2.1 基本信息

| 字段 | 填写内容 | 备注 |
|------|---------|------|
| **名称** | `block-twitter` | 来自 manifest.json，可修改 |
| **简短描述** | 从上面选一个 | 132 字符以内，显示在搜索结果 |
| **详细描述** | 参考上面的模板 | 16000 字符以内，是商店页主内容 |
| **分类** | Productivity | 或 Social & Communication |
| **语言** | English + 中文（简体）| 可选多语言 |

#### 4.2.2 上传图形资产

**必需**：
1. **128×128 PNG 图标** — 在"Icon"区域上传
   - 点击"Upload images"
   - 选择 `public/icons/icon-128.png`
   - ✅ Google 会自动缩放到其他尺寸

2. **至少 1 张截图** — 在"Screenshots"区域上传
   - 点击"Add screenshot"
   - 上传 1-3 张 1280×800 或 640×400 的 PNG/JPG
   - 添加描述（如"Keyword detection and user blocking"）

**可选**（如果有时间）：
- Small tile (440×280) — 搜索结果用
- Large tile (1400×560) — Featured 栏用

#### 4.2.3 Privacy practices 标签页（最容易漏填，Submit 按钮灰掉的主因）

> 💡 **首次上架的人 90% 会在这里卡住**。点 "Submit for review" 时弹窗 "Unable to publish"，最多会列出 8 项缺失，对应关系如下：

| 弹窗提示 | 在哪里填 | 本章节 |
|---------|---------|--------|
| A justification for host permission use is required | Privacy practices | 4.2.3.② |
| A justification for scripting is required | Privacy practices | 4.2.3.② |
| A justification for storage is required | Privacy practices | 4.2.3.② |
| A justification for remote code use is required | Privacy practices | 4.2.3.② |
| The single purpose description is required | Privacy practices | 4.2.3.① |
| Certify that your data usage complies with... | Privacy practices | 4.2.3.③ |
| You must provide a contact email | **Account** 标签页 | 4.2.3.④ |
| You must verify your contact email | **Account** 标签页 | 4.2.3.④ |

##### ① Single purpose description（必填）

描述扩展的**单一用途**，300 字符以内。模板：

```
block-twitter helps users filter their X/Twitter timeline by automatically 
detecting posts that contain user-defined keywords and providing one-click 
options to either locally hide the author or trigger X's native block. 
All data is stored locally in the browser; nothing is sent to any server.
```

##### ② Permission justifications（每个权限一段）

每条 manifest 里声明的权限都要一段说明，审核员会对照代码核实。**务必写得具体、可验证**。

**`storage` justification**
```
Used to persist the user's keyword list and hidden-user list locally via 
chrome.storage.local, so configuration survives across browser sessions 
and syncs between tabs. No data leaves the device.
```

**`scripting` justification**
```
Used to inject the content script into x.com and twitter.com pages so the 
extension can scan visible posts for user-defined keywords, mark matches, 
and expose Hide/Block buttons on the post UI.
```

**Host permission justification**（⚠️ 见下文 in-depth review 说明）
```
host_permissions are limited to https://x.com/* and https://twitter.com/*, 
which are the only sites where this extension operates. The content script 
reads DOM nodes of visible timeline posts to detect user-defined keywords, 
and (on user click) invokes X's native block menu. No network requests are 
made to these hosts from the extension itself; no page content is exfiltrated 
or stored beyond the local keyword/hidden-user lists.
```

**Remote code justification**
- 如果页面提供下拉选项 → 选 **"No, I am not using remote code"**，无需文字
- 如果必须填文字：
```
This extension does not use or load any remote code. All JavaScript and 
CSS is bundled inside the extension package. The "URL import" feature only 
fetches plain-text keyword lists (never code) via fetch() on user request.
```

> ⚠️ **Host Permission 会触发 in-depth review**：声明了 `host_permissions` 的扩展，Google 会走更严格的人工审核，通常 **2–4 周**（普通审核 1–3 天）。把域名限制到最小范围（例如 `https://x.com/*` 而不是 `<all_urls>`）能显著缩短审核时间。见 §5.2。

##### ③ Data usage 合规声明（勾选框，4 项）

需要全部勾选（本扩展根本不收集数据）：

- ☑ I do not sell or transfer user data to third parties...
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes
- ☑ **I certify that my data usage complies with the Developer Program Policies**

##### ④ Account 标签页：Contact email

1. 左上角头像 → **Account**
2. 填写 **Contact email**（必须是你能收信的邮箱）
3. 点 **Verify** → 去邮箱点确认链接

> 这两项不在 Privacy practices 里，是独立的 Account 页面，容易被忽略。

#### 4.2.4 Test instructions（可选但强烈推荐）

左侧菜单 **Access → Test instructions**。声明了 host permission 进入 in-depth review 时，审核员需要能复现扩展的功能；没有这段说明会显著提高被拒概率。模板：

```
1. Install extension and pin it.
2. Open https://x.com/ and log in.
3. Click the extension icon → "Open Settings".
4. Add a test keyword, e.g. "crypto".
5. Return to x.com timeline — posts containing "crypto" show an 
   orange left border and a "⚠ 1 keyword" badge next to the username.
6. Click "Hide User" on a marked post → the user is hidden locally.
7. Click "🚫 Block(X)" → X's native block confirmation dialog appears.
```

#### 4.2.5 扩展可见性和分发

**可见性**选项：
- **Public**（推荐）— 所有用户可在商店搜索到
- Unlisted — 只有知道链接的人才能安装
- Private — 只有你自己能看到

**价格**：
- ✅ Free（免费）— 无需设置

### 4.3 最终检查清单（提交前务必检查！）

```
□ 名称和简短描述填写完整
□ 详细描述清晰、包含功能列表和隐私说明
□ 128×128 图标已上传
□ 至少 1 张截图已上传（推荐 3 张），尺寸 1280×800 或 640×400
□ 分类选择正确（Productivity / Tools）
□ 语言选择合理
□ Privacy practices：Single purpose description 已填
□ Privacy practices：每个权限（storage / scripting / host / remote code）都有 justification
□ Privacy practices：4 项 data usage 声明全部勾选
□ Account：Contact email 已填且已点 Verify 通过
□ Access → Test instructions 已填（有 host permission 时强烈推荐）
□ Distribution：可见性设置为 Public
□ Distribution：Regions 已选
□ 价格设置为 Free
□ 没有拼写错误或链接错误
□ GitHub 链接（如有）能正确访问
```

### 4.4 提交审核（最后一步）

1. 滚到页面底部，检查所有信息无误
2. 点击蓝色的 **"Submit for review"** 按钮
3. 确认提交（可能会再问一次）
4. ✅ 显示"Submitted for review"

**提交后**：
```
✅ 扩展进入"Pending review"状态
✅ Google 会发邮件确认收到
✅ 你的扩展会在 1-7 个工作日内被审核
```

---

### 🔍 提交前常见遗漏

以下是最容易被拒的原因，提交前检查：

| 常见问题 | 检查方法 |
|---------|---------|
| 图标太模糊或缺失 | 确保 128×128 PNG 清晰可见 |
| 描述有拼写错误 | 复制到 Word 检查拼写 |
| 截图尺寸错误 | 确保是 1280×800 或 640×400 |
| 隐私问题回答错误 | 再读一遍题目，"收集数据"要选 No |
| 权限没有解释 | 在详细描述中说明为什么需要 storage 和 scripting 权限 |
| 代码包含外部脚本 | 确保 manifest.json 没有远程代码 URL |

---

## 阶段五：审核、上线与持续更新

### 5.1 审核期间会发生什么

**提交后**：

1. **第 1 天**：Google 自动验证 ZIP 包和 manifest.json
   - ✅ 应该收到"Submission received"邮件
   - ❌ 如果格式错误，会立即被拒

2. **第 2-7 天**：Google 人工审核
   - 检查代码是否符合政策
   - 验证功能是否与描述相符
   - 确认没有恶意代码

3. **第 7-14 天**：等待期
   - 高峰期可能需要更长时间
   - 不要重复提交（会延长审核时间）

**审核状态查看**：
```
进入 Chrome Web Store Developer Console
→ 找到 block-twitter 项目
→ 最右边 "Status" 列显示当前状态
```

### 5.2 审核时间预期

| 情况 | 预计时间 |
|------|---------|
| 首次提交、无 host permission | 3-7 个工作日 |
| **首次提交、有 host permission**（⚠️ block-twitter 属于此类） | **2-4 周**（in-depth review） |
| 审核高峰期（年末） | 在上述基础上再加 1 周 |
| 更新已发布的扩展 | 1-3 个工作日 |
| 涉及更敏感权限（`tabs`、`webRequest`、`<all_urls>` 等） | 2-6 周 |

> **提示**：周末和节假日 Google 不工作，不算在审核时间里

#### ⚠️ Host Permission 与 In-depth Review

上传包含 `host_permissions` 的 ZIP 后，开发者控制台通常会出现提示：

> *"Due to the Host Permission, your extension may require an in-depth review which will delay publishing."*

**这是标准警告，不是错误。** 说明和影响：

| 维度 | 普通审核 | In-depth review |
|------|---------|-----------------|
| 审核时间 | 1-3 个工作日 | **通常 2-4 周** |
| 审核内容 | 基础政策检查 | 逐行代码审计 + 权限合理性 |
| 沟通频率 | 很少 | 可能邮件追问 |
| 上线后限制 | 无 | **无**（通过后完全一样） |

**缩短审核时间的 4 条建议**：

1. **精确限定 host 域名**：`https://x.com/*` + `https://twitter.com/*` 远比 `<all_urls>` 或 `*://*/*` 快
2. **Permission justification 写具体**：说清"读哪些 DOM、何时读、读完做什么、是否外传"（见 §4.2.3.②）
3. **认真填 Access → Test instructions**：审核员复现不了功能就容易拒（见 §4.2.4）
4. **别频繁重传 ZIP**：审核期内更新会重置排队

### 5.3 ✅ 审核通过（最好的情况）

**你会收到**：
```
✅ Google 发来的邮件："Your extension has been published"
✅ Chrome Web Store 商店链接（可分享）
✅ 扩展 ID 和详细信息
```

**发生什么**：
1. 扩展在 Chrome Web Store 上架
2. 所有用户可以搜索到并安装
3. 商店链接格式：`https://chrome.google.com/webstore/detail/block-twitter/[你的扩展ID]`

**立即行动**：
1. 验证商店链接能打开
2. 在项目 README 中更新商店链接
3. 在 GitHub Release 中加入商店链接
4. 在社交媒体分享商店链接
5. 在 Reddit/V2EX 等平台分享上架消息

### 5.4 ❌ 审核被拒（也是学习机会）

Google 会邮件说明**具体拒绝原因**，常见情况及解决方法：

#### 常见拒绝原因

| 拒绝原因 | 具体表现 | 解决方法 | 再次提交时间 |
|---------|---------|---------|------------|
| **描述不清晰** | "Description doesn't explain the purpose clearly" | 补充功能说明，加入使用示例 | 修改后立即 |
| **权限说明不足** | "Permissions not justified" | 在详细描述中解释为什么需要这些权限 | 修改后立即 |
| **代码问题** | "Code doesn't match description" | 检查是否有未声明的功能 | 修复代码，再提交 |
| **隐私问题** | "May violate user privacy" | 明确说明数据存储位置（本地）且不收集 | 更新隐私说明 |
| **截图问题** | "Screenshots must be clear" | 提供高质量、相关的 1280×800 截图 | 更换截图，再提交 |
| **拼写/格式** | "Contains inappropriate content" | 仔细检查拼写和敏感词 | 修改后立即 |

#### 被拒后的步骤

1. **仔细阅读拒绝邮件**
   - Google 通常会给出非常具体的原因
   - 复制关键词到文档，不要遗漏任何细节

2. **根据反馈修改**
   - 编辑商店页面信息（不需要重新上传 ZIP）
   - 或修改代码后创建新 ZIP（如果是代码问题）

3. **重新提交**
   ```
   Developer Console → block-twitter → "Submit for review"
   ```

4. **打标记**
   - 在邮件中回复说明已修改
   - 或在 Developer Console 的备注中说明改进内容

#### 被拒后重新审核

- **审核不会"冷却"**，可以立即重新提交
- 新提交会重新排队审核
- 通常第二次会更快（审核员已熟悉你的扩展）
- **常见成功率**：第一次被拒 → 第二次通过 ✅

> 💡 **被拒不是失败**，这是 Google 帮你改进！很多知名扩展第一次也被拒过。

### 5.5 扩展上线后：首周行动计划

| 时间 | 行动 | 目的 |
|------|------|------|
| **第 1 天** | 验证商店页面、下载自己的扩展测试 | 确保一切正常 |
| **第 1-3 天** | 发 GitHub Release + 宣传文案 | 吸引早期用户 |
| **第 1 周** | 在 Reddit/Twitter/V2EX 分享 | 获得初期曝光 |
| **持续** | 收集用户反馈，修复问题，发版本更新 | 保持活跃度 |

### 5.6 版本更新流程

上线后，如果要发布新版本：

```bash
# 1. 修改 manifest.json 版本号
"version": "0.2.0"

# 2. 创建新 ZIP
zip -r block-twitter-v0.2.0.zip . --exclude "*.git*" ...

# 3. 在 Developer Console 上传新 ZIP
Developer Console → Package → Upload new package

# 4. 填写"What's new"（更新说明）
# 例如：
# - Fixed emoji keyword matching bug
# - Added URL import feature
# - Improved batch operation speed

# 5. 提交审核
Submit for review

# 6. 新版本通常 1-3 天审核完毕
```

新版本的审核**通常更快**，因为 Google 已经知道你的扩展。

---

## 总结：从现在到上架的完整时间表

```
现在        → 准备材料（1-2 天）
           → 注册开发者账号（5 分钟）
           → 打包和测试（30 分钟）
           → 填写商店详情（30 分钟）
           → 提交审核（1 分钟）

+1-7 天    → Google 审核（通常 3-7 天）

+7-14 天   → 🎉 扩展上线！
```

**总耗时**：2-3 周（含 Google 审核等待）

---

## 后续：版本更新流程

发布新版本时：

1. 修改 `manifest.json` 中的 `version` 字段（如 `0.1.0` → `0.2.0`）
2. 重新打包 ZIP
3. 在开发者控制台 → 找到扩展 → 点击 **"Package"** → **"Upload new package"**
4. 填写更新说明（What's new）
5. 提交审核

---

## 重要资源

| 资源 | 链接 |
|------|------|
| 开发者控制台 | https://chrome.google.com/webstore/devconsole |
| 开发者政策 | https://developer.chrome.com/docs/webstore/program-policies/ |
| 图标设计规范 | https://developer.chrome.com/docs/extensions/mv3/manifest/icons/ |
| Manifest V3 文档 | https://developer.chrome.com/docs/extensions/mv3/intro/ |
| 审核状态查询 | 开发者控制台 → 你的扩展 → "Status" 列 |

---

## 上架前最终检查清单

### 代码和打包

```
□ manifest.json version 已更新为 0.1.0
□ manifest.json 中的 permissions 和 host_permissions 正确
□ 所有图标文件存在：
  □ public/icons/icon-16.png (16×16)
  □ public/icons/icon-32.png (32×32)
  □ public/icons/icon-48.png (48×48)
  □ public/icons/icon-128.png (128×128)
□ 创建的 ZIP 包能在 Chrome 中正常加载
□ 测试了所有核心功能：
  □ 添加关键词
  □ 匹配帖子显示橙色标记
  □ 隐藏用户
  □ 屏蔽用户(X)
  □ 批量操作
  □ 导入/导出
  □ 跨标签页同步
□ ZIP 包根目录直接包含 manifest.json（不在子文件夹）
□ ZIP 大小 < 5MB
□ 没有包含 .git/, docs/, node_modules/, .DS_Store 等
```

### 商店页面信息

```
□ 扩展名：block-twitter
□ 简短描述：填写（132 字符以内）
□ 详细描述：完整（包含功能、使用方法、隐私说明）
□ 分类：Productivity
□ 语言：English + 中文（简体）
□ 128×128 图标：已上传清晰 PNG
□ 截图：至少 1 张（推荐 3 张）
  □ 尺寸正确（1280×800 或 640×400）
  □ 格式正确（PNG 或 JPG）
  □ 展示核心功能
□ Single purpose description：已填写清楚
```

### 隐私和政策

```
□ 数据收集问题：选择 "No"
□ 远程代码问题：选择 "No"
□ 政策符合问题：选择 "Yes"
□ 详细描述中明确说明：
  □ 数据完全本地存储
  □ 不收集任何用户信息
  □ 不向外部服务器发送数据
  □ 不包含恶意代码
```

### 账户和支付

```
□ 已注册 Chrome Web Store 开发者账号
□ 已支付 $5 注册费
□ 账号验证邮箱是活跃的（能接收 Google 邮件）
```

### 提交前最后一步

```
□ 再次检查所有文案中没有拼写错误
□ 验证所有链接（如 GitHub 链接）是否正确
□ 确认图标和截图都是最新的
□ 在 Developer Console 中预览一遍整个商店页面
□ 深呼吸，准备好了！🚀
```

---

## 常见问题速查表

| 问题 | 答案 |
|------|------|
| **图标必须是 PNG 吗？** | 是的，PNG 格式，背景最好透明 |
| **能用占位图先上架吗？** | 可以，但 128×128 最好清晰专业 |
| **一定要 3 张截图吗？** | 不一定，1 张可以，但 3 张更好 |
| **ZIP 包可以包含 docs/ 吗？** | 可以，但不必要，会增加大小 |
| **提交后能修改吗？** | 可以修改商店页面信息，但不能改 ZIP 内容 |
| **被拒后多久能重新提交？** | 立即可以，没有冷却期 |
| **能同时提交多个扩展吗？** | 可以，但每个需要单独的 $5 账号 |
| **有提交次数限制吗？** | 没有，可以无限提交 |

---

## 成功上架后的下一步

**立即行动**（第 1 天）：
1. ✅ 验证商店链接可以打开
2. ✅ 从 Chrome Store 下载自己的扩展，测试一遍
3. ✅ 在项目 README 中更新商店链接
4. ✅ 在 GitHub Release 中加入商店链接

**宣传和推广**（第 2-7 天）：
1. 发 GitHub Release 公告
2. 在 Twitter/X、Reddit、V2EX 分享
3. 邀请朋友体验并反馈
4. 收集用户意见，为下个版本做准备

**持续维护**（之后）：
1. 定期检查用户评论和评分
2. 修复 bug，发布新版本
3. 保持活跃的项目状态（定期更新）
4. 根据用户反馈添加功能

---

## 资源链接

| 资源 | 链接 |
|------|------|
| **开发者控制台** | https://chrome.google.com/webstore/devconsole |
| **Chrome Web Store 政策** | https://developer.chrome.com/docs/webstore/program-policies/ |
| **Manifest V3 文档** | https://developer.chrome.com/docs/extensions/mv3/ |
| **Icon 规范** | https://developer.chrome.com/docs/extensions/mv3/manifest/icons/ |
| **屏幕截图规范** | https://developer.chrome.com/docs/webstore/images/ |
| **Google 支持** | https://support.google.com/chrome/a/answer/2663860 |
