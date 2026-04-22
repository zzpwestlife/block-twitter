# 设计：Chrome 扩展 - 基于关键词屏蔽 X/Twitter 用户

## 概述

**block-twitter** 是一个 Chrome 浏览器扩展，允许用户定义关键词列表，自动识别 X/Twitter 上包含这些关键词的帖子，并标记相关用户。用户可一键屏蔽该用户的所有帖子，也可批量屏蔽多个用户，提高浏览体验。

**为什么重要**：帮助用户快速过滤不想看到的内容和账号，减少信息污染和有害内容的曝露。

---

## 范围

### 构建
- ✓ 关键词库管理（添加/删除/编辑/导出导入）
- ✓ 实时内容检测（监听 DOM 变化，识别关键词匹配）
- ✓ 用户标记与一键屏蔽（UI 按钮在匹配用户旁）
- ✓ 批量屏蔽功能（一次屏蔽多个用户）
- ✓ 屏蔽列表管理（查看/取消屏蔽）
- ✓ 跨标签页同步（所有标签页实时更新）
- ✓ 数据备份与恢复（导出/导入 JSON）

### 不构建
- ✗ 跨浏览器同步（仅限单浏览器本地存储）
- ✗ 云端备份服务（用户手动导出/导入）
- ✗ 正则表达式规则（仅支持完全单词匹配）
- ✗ 用户社区共享黑名单（仅个人本地列表）
- ✗ Firefox/Safari 兼容性（Chrome 专用）

---

## 架构

```
┌─────────────────────────────────────────────────────┐
│         Chrome Extension 架构总览                      │
└─────────────────────────────────────────────────────┘

【Manifest (manifest.json)】
  ├─ 定义扩展元数据、权限、content scripts
  └─ 声明 X/Twitter 网站的 URL pattern

【Content Script (content.js)】
  ├─ 运行在 X/Twitter 页面的 JavaScript
  ├─ 职责：监听 DOM 变化、检测关键词、标记用户、处理屏蔽显示
  └─ 接收 background 的指令，更新屏蔽列表状态

【Background Service Worker (background.js)】
  ├─ 后台常驻进程
  ├─ 职责：管理关键词库、屏蔽列表、处理存储同步
  └─ 响应 popup/options 的请求

【Options Page (options.html + options.js)】
  ├─ 完整的设置页面
  ├─ 功能：添加/删除/编辑关键词、查看/取消屏蔽用户列表
  ├─ 支持导出/导入关键词和屏蔽列表
  └─ 修改触发 chrome.storage 更新

【Popup (popup.html + popup.js)】
  ├─ 扩展图标点击时的小窗口
  ├─ 功能：快速查看屏蔽状态、跳转到 options 页面
  └─ 显示当前页面被屏蔽的帖子数

【数据存储 (chrome.storage.local)】
  ├─ keywords: [ "scam", "fake", ... ]
  ├─ blockedUsers: { "user1": timestamp, "user2": timestamp, ... }
  └─ stats: { totalBlocked: 42, ... }
```

**通信流向**：
```
options page → chrome.storage → onChanged event → content script
                ↓
            background script (响应同步)
                ↓
            content script (应用新规则)
```

---

## 组件

### Content Script 核心组件

**1. KeywordMatcher**
- 职责：检测文本是否包含关键词
- 接口：`match(text, keywords) → boolean`
- 实现：正则表达式完全单词匹配（不区分大小写）

**2. DOMScanner (MutationObserver)**
- 职责：监听 DOM 变化，找出所有帖子节点
- 接口：`startMonitoring()` / `stopMonitoring()`
- 回调：`onPostAdded(postElement)` → 扫描该帖子的用户和内容

**3. UserHighlighter**
- 职责：在帖子中标记可疑用户（添加 UI 标签）
- 接口：`highlight(postElement, username, matched_keywords)`
- 效果：用户名旁显示 [关键词匹配] + 一键屏蔽按钮

**4. BlockingManager**
- 职责：应用屏蔽（隐藏帖子）和取消屏蔽
- 接口：`blockUser(username)` / `unblockUser(username)`
- 存储：从 chrome.storage 读取屏蔽列表

### Options Page 组件

**1. KeywordListManager**
- 显示/编辑关键词列表
- 支持添加、删除、搜索、导出/导入

**2. BlockedUsersList**
- 显示所有被屏蔽用户
- 支持搜索、取消屏蔽、清空

### Popup 组件

**1. StatusDisplay**
- 显示当前页面的屏蔽统计（已屏蔽 N 条）
- 快速跳转到 options 页面按钮

---

## 数据流

### 关键词库编辑流程
```
User 在 Options 页面
  ↓ (输入新关键词 + 点击 Add)
Options Page 调用 chrome.storage.local.set({ keywords: [...] })
  ↓
Chrome Storage 触发 onChanged 事件
  ↓
Background Script 监听并更新内存中的 keywords 缓存
  ↓
Content Script 监听 onChanged 事件，更新本地 keywords 缓存
  ↓
Content Script 重新扫描当前页面（立即生效）
  ↓
用户看到新的关键词匹配结果
```

### 屏蔽用户流程
```
User 在 X 页面看到标记的用户
  ↓ (点击 "屏蔽" 按钮)
Content Script: BlockingManager.blockUser("@username")
  ↓
写入 chrome.storage.local: blockedUsers["@username"] = timestamp
  ↓
Chrome Storage 触发 onChanged 事件
  ↓
Content Script 监听，立即隐藏该用户的所有帖子 (CSS display:none)
  ↓
Background Script 同步更新 blockedUsers 缓存
  ↓
用户立即看到帖子消失
```

### 跨标签页同步
```
User 在 Tab A 屏蔽了 @user1
  ↓
Tab A 的 Content Script 写入 chrome.storage
  ↓
Tab B 的 Content Script 也监听到 onChanged 事件
  ↓
Tab B 自动隐藏 @user1 的帖子（无需手动刷新）
```

### 取消屏蔽流程
```
User 在 Options 页面或页面上点击 "取消屏蔽"
  ↓
删除 blockedUsers 中的用户
  ↓
Content Script 监听存储变化，移除 display:none 样式
  ↓
帖子重新显示
```

---

## 错误处理

| 场景 | 触发条件 | 处理方案 |
|------|---------|---------|
| Storage 读取失败 | 初始化时数据损坏 | 使用默认值，允许用户导入备份 |
| DOM 结构改版 | X 改变帖子 HTML | 准备 fallback 选择器，显示更新警告 |
| Content Script 加载失败 | 页面加载太快 | 每 2 秒检查一次，刷新页面重新加载 |
| 关键词列表过大 | >10000 关键词 | 限制最多 1000 个，导入时截断 |
| 屏蔽列表过大 | >50000 用户 | 提供"清空 X 天前屏蔽的"功能 |
| 竞态条件 | 同时编辑关键词和屏蔽 | chrome.storage 队列化保证顺序 |
| 扩展卸载后重装 | storage.local 被清空 | 提供导出/导入功能恢复数据 |

---

## 测试策略

### Happy Path
- ✓ 关键词添加与立即生效
- ✓ 一键屏蔽功能
- ✓ 批量屏蔽
- ✓ 取消屏蔽

### Error Path
- ✓ 无效的关键词输入（空、重复、特殊字符）
- ✓ Storage 失败恢复
- ✓ DOM 选择器失效
- ✓ 屏蔽用户不存在

### Edge Cases
- ✓ 包含关键词的用户名
- ✓ 多个关键词同时匹配
- ✓ 大小写敏感性
- ✓ 批量屏蔽网络延迟
- ✓ 同时编辑关键词和屏蔽用户
- ✓ 导出/导入功能
- ✓ 跨浏览器配置文件

---

## 关键决策

| 决策 | 选项 | 理由 |
|------|------|------|
| **检测策略** | MutationObserver | 相比定时轮询，性能好 5-10 倍，能应对 500+ 帖子页面 |
| **屏蔽方式** | CSS 隐藏 | 相比删除，可恢复；相比替换，页面布局不变 |
| **跨脚本通信** | chrome.storage onChanged | 简单可靠，自动队列化，立即生效 |
| **关键词匹配** | 完全单词匹配 | 精度足够，实现简单；模糊匹配/正则留作未来扩展 |
| **数据持久化** | 导出/导入 JSON | 不依赖云服务，用户完全控制，防止数据丢失 |

---

## 未知项

| 项目 | 原因 | 负责人/延期 |
|------|------|-----------|
| X 的具体 DOM 选择器 | 需要实际开发时检查 X 当前页面结构 | 开发阶段调整 |
| 性能基准线 | 需要真实用户测试 | Beta 阶段测量 |
| Chrome Storage 的实际配额 | 理论上 10MB，实际需验证 | 开发阶段测试 |
| 跨标签页通信的延迟 | 取决于 Chrome 版本和系统负载 | 开发阶段测量 |
