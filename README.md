# block-twitter 🚫

**Chrome 扩展，用关键词快速屏蔽 X/Twitter 用户**

一键隐藏（本地）或原生屏蔽（真正屏蔽），支持批量操作。所有数据完全本地存储，零跟踪。

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Chrome](https://img.shields.io/badge/Chrome-✓-brightgreen)

---

## 🎯 核心功能

| 功能 | 说明 |
|------|------|
| **🟠 关键词检测** | 基于关键词自动标记帖子，支持英文、中文、Emoji |
| **隐藏用户** | CSS 本地隐藏（非破坏性，可随时取消） |
| **🚫 屏蔽(X)** | 调用 X 原生屏蔽，同手动屏蔽效果相同 |
| **批量操作** | 一次选择 10-100+ 用户，一键全部隐藏或屏蔽 |
| **跨标签页同步** | 任何标签页的操作立即生效到其他标签页 |
| **URL 导入** | 从 GitHub Gist 或任何 URL 一键导入关键词列表 |
| **数据备份** | 导出/导入 JSON 格式的关键词和屏蔽用户列表 |

---

## 🧭 v0.2 true block fallback 行为

为提高稳定性，`true block` 按钮在 v0.2 按以下顺序自动降级（fallback）：

1. **Inline menu first**：优先在时间线帖子内打开 `...` 菜单并执行原生屏蔽。
2. **Profile page fallback second**：若帖子内菜单不可用，自动跳转/打开用户资料页后再执行屏蔽流程。
3. **Local hide fallback third**：若前两步都失败，执行本地隐藏并给出明确提示：  
   `True block failed on X UI. Applied local hide fallback.`

---

## 🚀 v0.2.0-beta rollout / rollback 摘要

- 发布前执行 `v0.2.0-beta checklist`（构建、手测、关键路径验证）。
- 发布后跟踪 `failure-code monitoring checklist`（按失败码聚合，观察 inline/profile/local-hide 三段失败率）。
- 必要时执行 `legacy toggle rollback`：在设置中启用旧流程开关，回退到仅本地隐藏路径，降低用户影响面。

---

## ⚡ 快速开始

### 安装

1. 下载最新版本：[Releases](https://github.com/yourusername/block-twitter/releases)
2. 解压 ZIP 文件
3. 打开 `chrome://extensions/`，开启**开发者模式**（右上角）
4. 点击 **"加载已解压的扩展程序"**，选择解压文件夹
5. 完成！工具栏出现 block-twitter 图标

### 使用

1. **添加关键词**：点击扩展图标 → "Open Settings" → 输入关键词 → Add
2. **隐藏用户**：匹配的帖子旁点击"Hide User"或"🚫 屏蔽(X)"
3. **批量操作**：勾选多个用户，点击工具栏的"隐藏所有选中"或"屏蔽所有(X)"
4. **导入列表**：在设置页粘贴 GitHub Gist URL，点击"Import from URL"

---

## 📋 详细文档

- **[使用指南](docs/USER_GUIDE.md)** — 完整功能说明和常见问题
- **[问题排查](docs/TROUBLESHOOTING.md)** — 开发过程遇到的 6 个问题及解决方案
- **[发布指南](docs/CHROME_STORE_PUBLISHING.md)** — 如何上架到 Chrome Web Store
- **[更新指南](docs/UPDATING_IN_CHROME_STORE.md)** — 如何在应用商店更新已发布的插件

---

## 🔧 技术亮点

- **Manifest V3** — 最新的 Chrome 扩展规范
- **MutationObserver** — 高效检测 X.com 动态加载的帖子
- **CJK 文本处理** — 解决 JavaScript `\b` 词边界对中文失效的问题
- **Emoji 支持** — 自动提取 Twemoji 的 `alt` 属性进行匹配
- **零依赖** — 纯 JavaScript，无 npm 包依赖

---

## 🌟 功能示例

### 场景 1：快速屏蔽垃圾账号
```
添加关键词 → 刷新页面 → 匹配的帖子标记橙色 → 选择多个用户 
→ 点"隐藏所有选中" → 50+ 垃圾账号一秒消失
```

### 场景 2：导入朋友的关键词列表
```
朋友分享他的 Gist 链接 → 你粘贴到"Import from URL" 
→ 自动导入他的 100 个过滤关键词 → 收获
```

---

## 💾 数据安全

✅ **完全本地** — 所有数据存储在 `chrome.storage.local`  
✅ **零上传** — 不向任何服务器发送数据  
✅ **零跟踪** — 不收集用户活动  
✅ **开源代码** — 完全透明，可审计

---

## 🤝 贡献和反馈

- **发现 Bug？** — [提交 Issue](https://github.com/yourusername/block-twitter/issues)
- **有好主意？** — [Discussion](https://github.com/yourusername/block-twitter/discussions)
- **想贡献代码？** — Fork 后提交 Pull Request

---

## 📄 许可证

MIT License — 详见 [LICENSE](LICENSE) 文件

---

## 🚀 项目状态

- **v0.1.0** (Beta) — 核心功能完成，稳定可用
- **v0.2.0-beta** — 增强 `true block` 稳定性与 fallback 机制，附带 rollout/rollback 运行手册
- 下个正式版计划：正则表达式支持、定时启用/禁用、用户统计

---

**[⭐ Star 这个项目](https://github.com/yourusername/block-twitter)** 如果觉得有用！
