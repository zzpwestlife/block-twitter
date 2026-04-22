# Testing Guide - block-twitter Chrome Extension

## 📦 Project Structure

```
block-twitter/
├── manifest.json              # Extension configuration
├── docs/
│   └── specs/
│       └── 2026-04-22--block-twitter.md  # Design spec
├── src/
│   ├── background/
│   │   └── background.js      # Service worker (storage, messaging)
│   ├── content/
│   │   ├── content.js         # DOM detection & blocking logic
│   │   └── content.css        # Styling for indicators & blocked posts
│   ├── popup/
│   │   ├── popup.html         # Popup UI
│   │   ├── popup.js           # Popup logic
│   │   └── popup.css          # Popup styles
│   └── options/
│       ├── options.html       # Settings page
│       ├── options.js         # Settings logic
│       └── options.css        # Settings styles
└── public/                    # (for future assets/icons)
```

## 🚀 Loading Extension in Chrome

### Step 1: Enable Developer Mode
1. Open Chrome and go to `chrome://extensions/`
2. Toggle **"Developer mode"** ON (top right corner)

### Step 2: Load Unpacked Extension
1. Click **"Load unpacked"** button
2. Navigate to and select the **entire `block-twitter` folder** (not just src/)
3. Click "Select Folder"

You should now see the extension loaded with a red icon in your Chrome toolbar.

## ✅ Testing Checklist

### 1. Basic Setup
- [x] Extension appears in Chrome toolbar
- [x] Popup shows without errors (click extension icon)
- [x] Options page opens (click "Open Settings" in popup)
- [x] No console errors in DevTools (F12 → Console)

### 2. Keywords Management (Options Page)
- [x] Add keyword: Type "scam" and click Add
- [x] Keyword appears in list
- [x] Duplicate prevention: Try adding "scam" again → Error message
- [x] Delete keyword: Click delete button next to keyword
- [x] Search keywords: Type in search box, list filters
- [x] Keyword counter shows correct count

### 3. Real-time Detection (X.com / Twitter.com)
- [ ] Go to https://x.com (or twitter.com)
- [ ] Open DevTools Console (F12 → Console)
- [ ] Should see no errors
- [ ] Existing posts with keyword "scam" should show orange indicator
- [ ] Indicator says: "⚠ 1 keywords"
- [ ] Hover over indicator to see matched keywords

### 4. One-Click Blocking
- [ ] Click "Block User" button next to marked user
- [ ] Button shows "Blocking..." state
- [ ] Post immediately disappears (hidden)
- [ ] User appears in "Blocked Users" section of Options page
- [ ] Refresh page → post still hidden

### 5. Batch Operations
- [ ] Add 5-10 posts with keyword "fake" in timeline
- [ ] All matching posts show indicators
- [ ] Block multiple users one by one
- [ ] Check "Blocked Users" list updates after each block

### 6. Cross-Tab Sync
- [ ] Open X in Tab A and Tab B
- [ ] Block a user in Tab A
- [ ] Switch to Tab B → user's posts are hidden there too
- [ ] No page refresh needed

### 7. Unblocking
- [ ] Go to Options page
- [ ] Find blocked user in "Blocked Users" section
- [ ] Click "Unblock"
- [ ] Go back to X page
- [ ] User's posts reappear (refresh page if needed)

### 8. Export / Import
- [ ] In Options page, click "Export Keywords"
- [ ] JSON file downloads with keywords and blocked users
- [ ] Click "Import Keywords"
- [ ] Select the JSON file
- [ ] Data restores correctly

### 9. Keyword Addition (Real-time)
- [ ] With X page open, add new keyword in Options page
- [ ] Return to X page without refresh
- [ ] New posts matching the keyword should be highlighted immediately
- [ ] Check DevTools console for no errors

### 10. Edge Cases
- [ ] Add keyword with special chars: "l0l" or "ok!" → Should work
- [ ] Add keyword "a" → should only match word "a", not "apple"
- [ ] Username with keyword: "@scammer" with keyword "scam" → Should be marked
- [ ] Very long keyword (100+ chars) → Should be truncated or rejected with message
- [ ] Add >1000 keywords → Should warn user and limit to 1000

## 🐛 Debugging

### Check DevTools
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Check for any red error messages
4. Look for any "Uncaught" errors

### Inspect Content Script
1. Right-click on X.com page → **Inspect**
2. Go to **Console** tab
3. You should see log messages from content.js (if any)

### Check Storage
1. Open DevTools (F12)
2. Go to **Application** tab → **Storage** → **Local Storage**
3. Find `chrome-extension://[ID]/`
4. Should see `keywords` and `blockedUsers` data in JSON format

### Check Background Service Worker
1. Go to `chrome://extensions/`
2. Find "block-twitter" extension
3. Click **"Inspect views: service worker"**
4. Check Console for any errors

### Reload Extension
1. Go to `chrome://extensions/`
2. Click the refresh icon on block-twitter
3. Reload X.com page (Cmd+R / Ctrl+R)

## 📝 Known Limitations

1. **X/Twitter DOM Changes**: If X updates their HTML structure, selectors may need updates
2. **Private Browsing**: Extension doesn't work in Incognito mode (Chrome Security Policy)
3. **Storage Size**: Limited to ~10MB in chrome.storage.local
4. **Cross-Browser**: Only works on Chrome (not Firefox/Safari)

## 🎯 Next Steps

If all tests pass:
1. Test with real X/Twitter content and keywords
2. Check performance with 100+ posts on timeline
3. Verify export/import with various data sizes
4. Test blocking/unblocking patterns

If you find issues:
1. Check console for error messages
2. Note exact steps to reproduce
3. Check if X.com page structure changed
4. Try reloading extension and page
