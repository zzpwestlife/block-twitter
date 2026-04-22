# Chrome Web Store 上架完整指南

---

## 概览

将扩展上架到 Chrome Web Store 分为四个阶段：

```
准备材料 → 注册开发者账号 → 创建商店页面 → 提交审核
```

审核通过后扩展公开上线，通常需要 **1~7 个工作日**。

---

## 阶段一：准备上架材料

### 1.1 图标（必须）

| 尺寸 | 用途 | 格式 |
|------|------|------|
| 16×16 px | 浏览器工具栏（小） | PNG |
| 32×32 px | Windows 任务栏 | PNG |
| 48×48 px | 扩展管理页面 | PNG |
| 128×128 px | Chrome Web Store 列表 | PNG |

> **当前状态**：项目中的图标为占位图，上架前必须换成真实设计的图标。
> 推荐工具：[Figma](https://figma.com)（免费）、Adobe Illustrator

### 1.2 商店截图（必须，至少 1 张）

| 要求 | 规格 |
|------|------|
| 数量 | 1~5 张 |
| 尺寸 | 1280×800 px 或 640×400 px |
| 格式 | PNG 或 JPG |
| 内容建议 | 展示扩展的核心功能（如关键词匹配橙色标记、批量操作工具栏、设置页） |

### 1.3 宣传图（可选但强烈推荐）

| 类型 | 尺寸 | 说明 |
|------|------|------|
| 小型宣传图 | 440×280 px | 出现在搜索结果中 |
| 大型宣传图 | 1400×560 px | 出现在 Featured 精选栏 |
| Marquee 图 | 1400×560 px | 置顶推荐时使用 |

### 1.4 扩展描述文案

需要准备两份：
- **简短描述**：最多 132 个字符，显示在搜索结果中
- **详细描述**：最多 16000 个字符，支持基本格式（换行，不支持 HTML）

**参考简短描述**：
```
Block X/Twitter users by keyword. One-click hide, batch hide, or native X block. Real-time sync across tabs.
```

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

## 阶段三：打包扩展

### 3.1 整理项目目录

确认项目结构干净，删除不必要的文件：

```
block-twitter/
├── manifest.json          ← 必须在根目录
├── src/
│   ├── background/
│   ├── content/
│   ├── popup/
│   └── options/
└── public/
    └── icons/             ← 确保图标文件存在且正确
```

不需要包含：
- `node_modules/`（本项目无依赖）
- `.git/`
- `docs/`（文档目录，不影响功能）
- `*.md` 文件（可以包含，但不必要）

### 3.2 创建 ZIP 包

**方法 A：命令行**
```bash
cd /path/to/block-twitter
zip -r block-twitter-v0.1.0.zip . \
  --exclude "*.git*" \
  --exclude "node_modules/*" \
  --exclude "*.DS_Store"
```

**方法 B：GUI**
- macOS：选中所有文件 → 右键 → "压缩"
- Windows：选中所有文件 → 右键 → "发送到" → "压缩(zipped)文件夹"

> **重要**：ZIP 包内部不要有额外的父文件夹，`manifest.json` 必须在 ZIP 的根层级。

### 3.3 验证 ZIP 包

解压 ZIP 包，在 `chrome://extensions/` 用"加载已解压的扩展程序"测试，确认功能正常再提交。

---

## 阶段四：在开发者控制台创建商店页面

### 4.1 上传扩展包

1. 进入 [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole)
2. 点击 **"New item"（新建项目）**
3. 上传 ZIP 文件
4. 等待自动解析 manifest.json（约 1 分钟）

### 4.2 填写商店详情

进入商品详情页，填写以下内容：

**基本信息**

| 字段 | 内容 |
|------|------|
| 名称 | block-twitter（来自 manifest.json，可在此页覆盖） |
| 简短描述 | 132 字符内 |
| 详细描述 | 功能介绍、使用说明、注意事项 |
| 分类 | **Productivity**（推荐）或 **Social & Communication** |
| 语言 | 选择主要语言（如 Chinese Simplified + English） |

**图形资产**

- 上传商店图标（128×128 PNG）
- 上传至少 1 张截图（1280×800 或 640×400）
- 可选：上传宣传图

**隐私**

| 问题 | 回答（本扩展） |
|------|------|
| 是否收集用户数据？ | 否 |
| 是否使用远程代码？ | 否 |
| 是否符合开发者计划政策？ | 是 |

填写"单一用途说明"（Single purpose description）：
```
This extension helps users filter X/Twitter content by blocking users
whose posts match specified keywords, using local CSS hiding or X's
native block feature.
```

### 4.3 设置分发范围

- **可见性**：Public（公开） / Unlisted（链接可访问）/ Private（仅自己）
- **地区**：默认全球，可限制特定国家
- **价格**：免费

### 4.4 提交审核

点击 **"Submit for review"（提交审核）**。

---

## 阶段五：审核与上线

### 审核时间

| 情况 | 预计时间 |
|------|------|
| 首次提交，新扩展 | 3~7 个工作日 |
| 更新已发布的扩展 | 1~3 个工作日 |
| 涉及敏感权限（如 `tabs`、`webRequest`） | 可能延长至 2 周 |

### 审核通过后

- 扩展在 Chrome Web Store 公开，可通过链接安装
- 你会收到 Google 的邮件通知
- 商店链接格式：`https://chrome.google.com/webstore/detail/[扩展名]/[扩展ID]`

### 审核被拒怎么办？

Google 会邮件说明拒绝原因，常见原因及解决方法：

| 拒绝原因 | 解决方法 |
|----------|----------|
| 描述不清晰 | 补充详细的功能说明 |
| 权限说明不充分 | 在描述中解释每个权限的用途 |
| 没有隐私政策 | 添加隐私政策 URL |
| 截图不符合要求 | 更换符合尺寸要求的截图 |
| 代码包含混淆或外部脚本 | 确保所有代码可读且本地化 |

修改后重新提交，审核重新计时。

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

## 上架前检查清单

```
□ manifest.json version 字段已更新
□ 所有图标文件存在（16/32/48/128 px PNG）
□ 已准备至少 1 张商店截图（1280×800 px）
□ 已准备简短描述（≤132 字符）
□ 已准备详细描述
□ 已完成隐私声明
□ 在干净的 Chrome 配置文件中测试功能正常
□ ZIP 包根目录直接包含 manifest.json（无额外父文件夹）
□ 已注册开发者账号并完成 $5 注册费支付
```
