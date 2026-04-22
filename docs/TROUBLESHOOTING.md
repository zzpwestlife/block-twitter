# block-twitter 开发问题排查记录

本文档记录了开发过程中遇到的所有问题及其解决方案，供日后参考。

---

## 问题 1：图标文件缺失导致扩展加载失败

**现象**
Chrome 扩展加载时报错：`Could not load icon 'icons/icon-16.png'`，扩展无法正常显示图标。

**根因**
`manifest.json` 中引用了 `icons/icon-16.png` 等路径，但对应的图标文件不存在。

**解决方案**
1. 在 `public/icons/` 目录下创建占位图标（Node.js 生成最小 PNG）
2. 更新 `manifest.json` 中的图标路径为 `public/icons/icon-{16,48,128}.png`

```json
"icons": {
  "16": "public/icons/icon-16.png",
  "48": "public/icons/icon-48.png",
  "128": "public/icons/icon-128.png"
}
```

---

## 问题 2：Popup 发送消息报"消息通道已关闭"错误

**现象**
点击扩展图标打开 Popup 时，控制台报错：
`Error: Could not establish connection. Receiving end does not exist.`

**根因**
`popup.js` 向 content script 发送 `getBlockedCount` 消息，但 content script 中没有对应的消息监听器。

**解决方案**
在 `ContentScriptManager.initialize()` 中添加 `chrome.runtime.onMessage.addListener`：

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBlockedCount') {
    const blockedPosts = document.querySelectorAll('[data-bt-blocked="true"]').length;
    sendResponse({ blockedCount: blockedPosts });
  }
});
```

---

## 问题 3：帖子检测数量全部为 0

**现象**
扩展加载后，`DOMScanner` 扫描结果所有选择器返回 0 个元素，关键词无法匹配任何帖子。

**根因**
X.com 使用动态加载（React/SPA），content script 在 `DOMContentLoaded` 时立即运行，此时页面的帖子 DOM 尚未渲染完毕。

**解决方案**
在 `DOMScanner.startMonitoring()` 的初始扫描前加 2000ms 延迟：

```javascript
setTimeout(() => {
  this.scanExistingPosts();
  this.logSelectorDebugInfo();
}, 2000);
```

同时确认有效的帖子选择器为 `article[data-testid="tweet"]`（X.com 的主选择器）。

---

## 问题 4：中文（CJK）关键词无法匹配

**现象**
添加中文关键词（如"一直都在"）后，包含该词的帖子没有被标记。

**根因**
JavaScript 的 `\b` 词边界正则表达式仅适用于 ASCII 字符（`[a-zA-Z0-9_]`），对中文、日文、韩文字符完全失效——"一" 等 CJK 字符不被视为"词字符"，`\b` 匹配的是字符串头尾，导致误判。

**解决方案**
在 `KeywordMatcher.match()` 中检测关键词是否包含 CJK 字符，若是则改用 `String.includes()` 子串匹配：

```javascript
const isCJK = /[一-鿿぀-ゟ゠-ヿ가-힯]/.test(lowercaseKeyword);

if (isCJK) {
  matches = lowercaseText.includes(lowercaseKeyword);
} else {
  const regex = new RegExp(`\\b${this.escapeRegex(lowercaseKeyword)}\\b`, 'gi');
  matches = regex.test(lowercaseText);
}
```

---

## 问题 5：刷新页面后已隐藏用户的帖子重新出现

**现象**
批量隐藏用户后刷新页面，被隐藏用户的帖子仍然显示，橙色标记和 Hide User 按钮还在。

**根因**
与问题 3 同源：`BlockingManager.initialize()` 在页面加载时立即调用 `applyBlockingToCurrentPage()`，但此时帖子 DOM 尚未渲染，找不到任何帖子元素，隐藏操作无效。

MutationObserver 的 `processPost()` 虽然会对新增帖子检查是否已被隐藏，但实际执行时机上存在竞争条件。

**解决方案（已实施）**
两处修复：
1. `BlockingManager.initialize()` 加载完 blockedUsers 后调用 `applyBlockingToCurrentPage()`（需配合页面加载时机）
2. `ContentScriptManager.processPost()` 在做关键词检测前，先判断该用户是否已在 blockedUsers 中，若是直接隐藏：

```javascript
processPost(postElement) {
  const username = this.extractUsername(postElement);
  if (username && this.blockingManager.blockedUsers[username]) {
    this.blockingManager.hidePostsFromUser(username);
    return;
  }
  // 继续关键词检测...
}
```

> **注意**：该问题的根本解决依赖于帖子 DOM 渲染时机，刷新后首批帖子若在 MutationObserver 触发前已渲染，可能仍需手动刷新一次。

---

## 问题 6：Emoji 关键词无法匹配帖子

**现象**
添加含 Emoji 的关键词（如"一直都在 💧"），包含该词的帖子没有被标记。

**根因**
X.com 使用 [Twemoji](https://github.com/twitter/twemoji) 库，将所有 Emoji 字符转换为 `<img>` 标签：

```html
<!-- X.com 实际渲染 -->
一直都在 <img src="..." alt="💧" class="r-4qtqp9">
```

`element.textContent` 完全忽略 `<img>` 标签，因此提取到的帖子文本中没有任何 Emoji 字符，导致含 Emoji 的关键词永远无法匹配。

**解决方案**
在 `KeywordMatcher` 中添加 `extractPostText()` 方法，遍历 DOM 树，同时收集文本节点内容和 `<img>` 标签的 `alt` 属性：

```javascript
static extractPostText(element) {
  let text = '';
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === 'IMG' && node.alt) {
      text += node.alt;  // 恢复被 Twemoji 替换掉的 Emoji 字符
    } else {
      for (const child of node.childNodes) {
        walk(child);
      }
    }
  };
  walk(element);
  return text;
}
```

在 `processPost()` 中使用此方法替代 `postElement.textContent`。

---

## 通用排查步骤

1. `chrome://extensions/` → 找到 block-twitter → 点击 **刷新图标** → 重新加载 X.com
2. 打开 DevTools（F12）→ Console 查看 `[block-twitter]` 开头的日志
3. `chrome://extensions/` → 点击 **"Inspect views: service worker"** → 查看后台日志
4. Application → Storage → Local Storage 查看 `keywords` 和 `blockedUsers` 数据是否正确
