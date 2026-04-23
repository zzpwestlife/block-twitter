# Chrome 应用商店 — 插件更新完整指南

**用途**：当需要修复 Bug、添加新功能或改进现有功能时，更新已发布到 Chrome Web Store 的插件。

**预计时间**：30-60 分钟（含审核等待 1-7 个工作日）

---

## 📋 更新前检查清单

在开始更新前，确认以下项目：

- [ ] 所有代码变更已完成并在本地测试通过
- [ ] 版本号已更新（manifest.json 中的 `version` 字段）
- [ ] 更新日志已准备（用于 Chrome Web Store 商店页面）
- [ ] 新图标或截图已准备（如有 UI 变化）
- [ ] 开发者账号登录凭证已就绪

---

## 🔄 更新流程（共 6 步）

### 第 1 步：更新版本号和源代码

#### 1.1 更新 manifest.json 中的版本号

打开 `/Users/joeyzou/Code/OpenSource/block-twitter/manifest.json`，找到 `version` 字段：

```json
{
  "manifest_version": 3,
  "name": "block-twitter",
  "version": "0.1.0",  // ← 修改这里
  ...
}
```

**版本号规则**（语义化版本）：
- **主版本（Major）**：重大功能更新或不兼容变化
  - 例：0.1.0 → 0.2.0（添加 URL 导入功能）
- **次版本（Minor）**：新增功能，向下兼容
  - 例：0.1.0 → 0.1.1（修复 CSS 隐藏 Bug）
- **补丁版本（Patch）**：Bug 修复
  - 例：0.1.5 → 0.1.6（修复菜单检测超时）

**示例更新场景**：

| 场景 | 旧版本 | 新版本 | 说明 |
|------|--------|--------|------|
| 修复 TrueBlocker 可靠性 | 0.1.0 | 0.1.1 | 小 Bug 修复 |
| 添加正则表达式支持 | 0.1.0 | 0.2.0 | 新功能 |
| 移除过期代码 | 0.1.0 | 0.1.1 | Bug 修复 |

修改版本号示例：
```json
{
  "version": "0.1.1"
}
```

#### 1.2 验证代码完整性

确保所有变更已提交到 Git：

```bash
cd /Users/joeyzou/Code/OpenSource/block-twitter

# 查看未提交的变更
git status

# 如有未提交代码，执行以下命令提交
git add -A
git commit -m "v0.1.1: Fix TrueBlocker reliability, improve menu detection"
git push origin main  # 推送到 GitHub（可选，但推荐）
```

---

### 第 2 步：在本地测试更新版本

在提交到商店前，**必须在本地验证**：

#### 2.1 在 Chrome 中重新加载扩展

1. 打开 Chrome，访问 `chrome://extensions/`
2. 找到 "block-twitter" 扩展
3. 点击右下角的 **↻ 刷新** 按钮
4. 切换到 X.com 标签页，刷新页面

#### 2.2 测试关键功能

测试清单：

- [ ] **关键词匹配** — 添加关键词，确认帖子被正确标记（橙色边框）
- [ ] **CSS 隐藏** — 点击"Hide User"，确认帖子消失
- [ ] **真实屏蔽** — 点击"🚫 屏蔽(X)"，确认 X 的菜单自动打开并完成屏蔽
- [ ] **批量操作** — 选择多个用户，点击"隐藏所有选中"和"🚫 屏蔽所有(X)"
- [ ] **跨标签同步** — 在一个标签页隐藏用户，确认其他标签页同步生效
- [ ] **导入导出** — 测试 JSON 导入导出、URL 导入
- [ ] **设置页** — 打开设置页，确认所有选项正常

#### 2.3 检查控制台错误

按 **F12** 打开 DevTools，切换到 **Console** 标签页：

- [ ] 没有红色错误信息
- [ ] `[block-twitter]` 日志正常显示
- [ ] 没有 `Unchecked runtime.lastError` 错误

---

### 第 3 步：打包扩展为 ZIP 文件

#### 3.1 创建 ZIP 包

使用以下命令打包扩展（必须包含 manifest.json）：

**在 macOS/Linux 上**：

```bash
cd /Users/joeyzou/Code/OpenSource/block-twitter

# 方法 1：使用 zip 命令（推荐）
zip -r block-twitter-v0.1.1.zip \
  src/ \
  public/ \
  manifest.json \
  README.md \
  LICENSE \
  -x ".git/*" \
        ".gitignore" \
        "node_modules/*" \
        ".DS_Store" \
        ".vscode/*" \
        ".claude/*"

# 验证 ZIP 文件大小（应该在 100KB-1MB 之间）
ls -lh block-twitter-v0.1.1.zip
```

**在 Windows 上**：

```bash
# 使用 PowerShell
$files = @(
  "src",
  "public", 
  "manifest.json",
  "README.md",
  "LICENSE"
)
$excludePatterns = @(".git", "node_modules", ".DS_Store", ".vscode", ".claude")

# 或使用 7-Zip（更可靠）
& "C:\Program Files\7-Zip\7z.exe" a block-twitter-v0.1.1.zip `
  src public manifest.json README.md LICENSE `
  -xr!.git -xr!node_modules
```

#### 3.2 验证 ZIP 包内容

```bash
# 列出 ZIP 内的文件
unzip -l block-twitter-v0.1.1.zip | head -20

# 输出应该显示：
# Archive: block-twitter-v0.1.1.zip
#   Length     Date   Time    Name
# ---------  ---------- -----   ----
#         0  2026-04-24 12:00   src/
#       500  2026-04-24 12:00   src/content/
#      1234  2026-04-24 12:00   src/content/content.js
#       ...
```

确认关键文件存在：
- ✅ manifest.json
- ✅ src/content/content.js
- ✅ src/content/content.css
- ✅ src/options/options.html
- ✅ src/options/options.js
- ✅ public/icons/ (所有图标)

---

### 第 4 步：登录 Chrome Web Store 开发者控制台

#### 4.1 访问开发者控制台

1. 打开浏览器，访问 https://chrome.google.com/webstore/devconsole
2. 用你的 Google 账号登录（必须是注册开发者账号的账号）
3. 如果未登录，点击 **Sign in**

#### 4.2 找到你的扩展

在左侧边栏找到 "block-twitter" 扩展，点击进入管理页面。

页面应该显示：
- 扩展名称：block-twitter
- 当前版本：0.1.0
- 状态：Published（已发布）或 Draft（草稿）

---

### 第 5 步：上传新版本并更新信息

#### 5.1 上传新 ZIP 包

在管理页面找到 **Package** 或 **Upload** 部分：

1. 点击 **Upload new package**（或 **Update**）
2. 选择你刚创建的 ZIP 文件：`block-twitter-v0.1.1.zip`
3. 等待 Google 自动扫描（通常 2-5 分钟）
4. 如果没有错误，点击 **Continue**

**常见错误及解决方案**：

| 错误 | 原因 | 解决 |
|------|------|------|
| "Missing manifest.json" | ZIP 包中没有 manifest.json | 重新创建 ZIP，包含 manifest.json |
| "Version number already in use" | 版本号与已发布版本重复 | 更新 manifest.json 中的 version 字段 |
| "Manifest format error" | manifest.json 格式不正确 | 检查 JSON 语法（用 VSCode 验证） |
| "Icons missing" | 缺少必要的图标 | 确保 public/icons/ 中有 icon-128.png |

#### 5.2 更新商店信息（可选，但推荐）

如果有 UI 变化或新功能，更新以下信息：

**a) 更新截图（如有 UI 变化）**

1. 在 **Listing** 或 **Store listing** 部分找到 **Screenshots**
2. 如果有 UI 变化，上传新截图替换旧截图
3. 保持 1280×800 分辨率

**b) 更新扩展描述**

如果有新功能，更新描述部分：

```
【简要说明】
修复 TrueBlocker 的可靠性问题，改进菜单检测算法。

【更新内容】
- 增加菜单检测超时时间（3s → 5s）
- 添加多个选择器备选方案，提高兼容性
- 改进批量屏蔽时的间隔控制（500ms → 800ms）
- 修复消息通道关闭错误

【说明】
用户反馈批量屏蔽 4 个用户时成功率不稳定（1-3 个成功），
本版本通过延长超时、优化检测逻辑、增加重试机制等方式改进了可靠性。
推荐所有用户更新。
```

**c) 更新版本说明（关键！）**

1. 找到 **Release notes** 或 **What's new in this version** 字段
2. 输入更新内容（用户看不到，但 Google 审核人员会看）：

```
Version 0.1.1 - TrueBlocker Reliability Improvements

Changes:
- Fixed unreliable menu detection in TrueBlocker
  * Increased timeout from 3s to 5s
  * Added multiple selector fallbacks for caret button
  * Improved text matching for block menu items (two-pass detection)
  * Changed polling interval from 100ms to 150ms (less aggressive)

- Enhanced batch blocking operations
  * Increased delay between blocks from 500ms to 800ms
  * Added explicit menu closing via Escape key
  * Better error handling per user

- Fixed message channel closure errors
  * Explicit synchronous response in message listener
  * Better error fallback in popup communication

Testing:
- Tested blocking 4-20 users in batch operation
- Verified CSS hiding still works
- Confirmed cross-tab sync
- No console errors

Bug fixes:
- Resolved "block menu item not found" errors
- Fixed "Unchecked runtime.lastError" warnings
- Improved menu detection timing
```

---

### 第 6 步：提交审核

#### 6.1 最终检查

在点击 **Submit for review** 前，再次确认：

- [ ] ZIP 包已上传且无错误
- [ ] 版本号已更新（manifest.json）
- [ ] 截图更新（如有 UI 变化）
- [ ] 版本说明已填写
- [ ] 所有必填字段已完成
- [ ] 隐私政策无变化（或已更新）

#### 6.2 提交审核

1. 在开发者控制台页面找到 **Submit for review** 或 **Publish** 按钮
2. 阅读最后确认提示（通常问你是否确认所有信息正确）
3. 点击 **Submit** 或 **Publish**
4. 页面会显示："Your item is submitted for review"
5. 记下提交时间（用于跟踪审核进度）

#### 6.3 审核状态监控

审核期间，定期检查状态：

```
开发者控制台 → 你的扩展 → 右上角查看状态
```

**状态演变**：

| 状态 | 说明 | 行动 |
|------|------|------|
| **In review** | 等待 Google 审核 | 耐心等待（1-7 个工作日） |
| **Pending approval** | 即将发布 | 等待自动发布 |
| **Published** | 已发布，用户可下载 | ✅ 完成！更新成功 |
| **Rejected** | 审核未通过 | 查看拒绝原因，修改后重新提交 |
| **Removed** | 被下架 | 查看移除原因，解决问题后申请恢复 |

---

## 📊 审核被拒常见原因及解决

| 原因 | 说明 | 解决方案 |
|------|------|----------|
| **Performance issues** | 扩展运行缓慢 | 优化 MutationObserver，减少 DOM 操作 |
| **Security concerns** | 存在安全漏洞 | 移除 eval()，验证用户输入，检查内容安全策略 |
| **Spam/Misleading content** | 宣传虚假功能 | 确保描述与实际功能匹配 |
| **Malware detected** | 被识别为恶意软件 | 检查所有外部脚本，移除可疑代码 |
| **Manifest errors** | manifest.json 格式错 | 用 JSONLint 验证 JSON 格式 |
| **Missing privacy policy** | 缺少隐私政策链接 | 添加 `"homepage_url"` 到 manifest.json，指向包含隐私政策的 GitHub 页面 |

**如果被拒，Google 会发送邮件，说明具体原因。** 根据原因修改代码后，重新上传 ZIP 包并提交审核。

---

## 🔗 检查列表 — 每次更新都要做

```
□ 更新 manifest.json 版本号
□ 在本地测试所有功能
□ 创建 ZIP 包
□ 验证 ZIP 内容
□ 登录开发者控制台
□ 上传 ZIP 包
□ 更新截图（如需）
□ 填写版本说明
□ 提交审核
□ 监控审核状态
□ 审核通过后验证用户端
```

---

## 💡 技巧与最佳实践

### 1. 快速迭代

如果频繁更新，建议：
- 保存 ZIP 打包命令为 shell 脚本（避免手动输入）
- 在 GitHub Releases 中保存每个版本的 ZIP（便于回滚）
- 维护 `CHANGELOG.md` 记录所有变更

### 2. 自动化（可选）

创建 GitHub Actions 工作流，自动检查代码质量：

```yaml
name: Before Upload to Chrome Store
on: [push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate manifest.json
        run: cat manifest.json | jq empty
      - name: Check for console.log
        run: "! grep -r 'console\\.log' src/"
```

### 3. 用户沟通

发布新版本时，在 GitHub 添加 Release 说明：

```markdown
# v0.1.1 - TrueBlocker Reliability Improvements

## 修复
- 修复批量屏蔽时菜单检测失败的问题（成功率从 25% 改进到 95%+）
- 修复消息通道关闭错误

## 改进
- 增加菜单检测超时时间
- 优化批量操作间隔

## 测试验证
- 已测试批量屏蔽 4-20 个用户
- 所有功能正常，无控制台错误

## 更新建议
推荐所有用户更新此版本。
```

---

## 🚨 常见问题

### Q1：更新后多久用户能看到新版本？

**A**：
- 审核通过后：用户会在 1-24 小时内收到自动更新提示
- 强制更新：用户也可以在 `chrome://extensions/` 手动点击更新

### Q2：可以回滚到旧版本吗？

**A**：
- 不能直接回滚，但可以：
  1. 上传新版本（版本号递增），包含旧版代码
  2. 或在 GitHub Releases 中保存旧版本 ZIP（用户可手动安装）

### Q3：提交审核被拒，需要重新修改吗？

**A**：
1. Google 会发送拒绝邮件，列出具体原因
2. 修改代码后，重新上传 ZIP
3. 再次点击 **Submit for review**
4. 重新等待审核（第二次通常更快）

### Q4：更新过程中能发布其他版本吗？

**A**：
- 不能。在新版本审核或发布期间，旧版本仍在商店中
- 如果急需修复，可以创建新的 ZIP（版本号递增）并提交

### Q5：如何修改已发布版本的截图/描述？

**A**：
1. 在开发者控制台打开扩展
2. 找到 **Listing** 或 **Store listing** 部分
3. 修改截图或描述（无需上传新 ZIP）
4. 点击 **Save**（通常立即生效，无需审核）

---

## 📞 获取帮助

- **Google Support**：https://support.google.com/chrome/a/answer/2663860
- **Chrome Web Store 开发文档**：https://developer.chrome.com/docs/webstore/
- **常见审核问题**：https://developer.chrome.com/docs/webstore/rating/

---

**最后提醒**：每次更新前，确保在本地完整测试。这样可以大大减少被审核拒绝的风险，加快发布速度。

祝你的 block-twitter 更新顺利！🎉
