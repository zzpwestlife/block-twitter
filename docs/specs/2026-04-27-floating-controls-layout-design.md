# 右下角悬浮按钮遮挡优化（AI 扫描 vs 🚩 开关）设计

日期：2026-04-27  
范围：`src/content/content.js`（content script UI）

## 背景 / 问题

当前页面右下角存在两个 `position: fixed` 的悬浮按钮：

- **AI 扫描按钮**：`#bt-ai-scan-btn`（点击后会显示进度文字，如“⏳ 扫描 12/80...”）
- **手动标记开关按钮（小旗子）**：`#bt-manual-toggle-btn`（🚩 / 🚩 ON）

现状是两个按钮分别固定定位，🚩 开关通过 JS 动态计算 `right`（`positionLeft()`）尝试避让 AI 按钮的宽度。但当 AI 扫描按钮文案在扫描过程中变长时，🚩 开关仍可能被遮挡或难以点击。

## 目标 / 成功标准

1. 点击 AI 扫描按钮后，无论按钮文案如何变化（准备中/扫描进度/结果），🚩 开关始终可见且可点击，不被遮挡。
2. 不引入复杂的尺寸监听逻辑（例如 MutationObserver/ResizeObserver）也能稳定工作。
3. 尽量保持现有 UI 风格、位置（右下角）与 z-index 层级不变。

## 非目标

- 不调整帖子内部的手动标记按钮（每条帖子旁的 🚩）的布局。
- 不改变 AI 扫描功能、扫描策略或结果展示。

## 方案（采纳）

### 方案 A：统一容器 + Flex 布局（采纳）

在右下角创建一个统一的悬浮容器 `#bt-floating-controls`，并将两个按钮都放入该容器中，由容器负责布局：

- `#bt-floating-controls`
  - `position: fixed; bottom: 24px; right: 24px; display: flex; gap: 12px; align-items: center;`
  - `z-index` >= 两个按钮当前 z-index 的较大值（避免被页面其它元素覆盖）
- 子元素顺序：🚩 在左，AI 扫描在右

这样当 AI 按钮宽度变化时，整体只会向左扩展，两个按钮不会互相遮挡，且无需在每次文案变化时重算 `right`。

## 实现要点

1. 在 content script 初始化时创建（或复用）`#bt-floating-controls` 容器。
2. `AIScanButton.render()`：不直接 append 到 `document.body`，改为 append 到该容器。
3. `ContentScriptManager._renderManualBtnToggle()`：同理 append 到该容器；并移除/废弃 `positionLeft()` 的动态计算逻辑。
4. 保持现有按钮本身样式（圆角、padding、背景色等）不变，仅改变其外部布局方式。

## 风险与兼容性

- 页面某些样式可能对按钮产生影响：容器与按钮都使用内联 style（当前代码已是内联 style）可降低影响。
- z-index：需要确保容器 z-index 不低于目前两个按钮，以免出现“可见但点不到”的覆盖问题。

## 测试用例（手动）

1. 打开 X 页面，右下角同时出现 🚩 与 🤖 AI扫描 两按钮。
2. 点击 🤖 AI扫描，观察按钮文案从“准备中”到“扫描 n/m”，再到“结果”期间：
   - 🚩 始终可见
   - 🚩 始终可点击（可切换 🚩 / 🚩 ON）
3. 页面缩放（90% / 110%）、窗口宽度变化时，右下角按钮仍正常排列且不互相遮挡。

