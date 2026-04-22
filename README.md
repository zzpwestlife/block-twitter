# block-twitter 🚫

A Chrome extension that helps you block X/Twitter users based on keyword filters. Automatically detect and hide posts containing specific keywords, and block problematic users with a single click.

**Status**: Beta v0.1.0 | **Compatibility**: Chrome/Chromium-based browsers

---

## ✨ Features

- **Keyword-Based Detection** — Define a list of keywords and automatically highlight posts containing them
- **One-Click Blocking** — Block users directly from their posts without visiting their profiles
- **Batch Operations** — Block multiple users at once for quick bulk filtering
- **Real-Time Sync** — Changes apply instantly across all open tabs
- **Smart Matching** — Complete word matching (case-insensitive) prevents accidental over-matching
- **Data Management** — Export/import your keyword lists and blocked users as JSON backups
- **Non-Destructive** — Posts are hidden with CSS, not deleted, so you can unblock anytime
- **Cross-Tab Sync** — Blocking in one tab automatically hides posts in all other tabs

---

## 🎯 Use Cases

- **Content Filtering** — Hide posts about topics you want to avoid
- **User Blocking** — Block problematic accounts without unfollowing them
- **Spam Prevention** — Filter out spam keywords and accounts
- **Safe Browsing** — Create a cleaner, more focused Twitter experience

---

## 📦 Installation

### Prerequisites
- Chrome, Edge, Brave, or any Chromium-based browser
- Developer mode enabled (for unpacked extensions)

### Quick Start

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/block-twitter.git
   cd block-twitter
   ```

2. **Open Chrome Extension Settings**
   - Navigate to `chrome://extensions/`
   - Toggle **"Developer mode"** ON (top right corner)

3. **Load the Extension**
   - Click **"Load unpacked"** button
   - Select the entire `block-twitter` folder
   - The extension icon should appear in your toolbar (red icon)

4. **Done!** Visit https://x.com or https://twitter.com and start using it

---

## 🚀 Usage Guide

### Adding Keywords

1. Click the **block-twitter extension icon** in the toolbar
2. Click **"Open Settings"** button
3. In the Options page, enter a keyword (e.g., "scam", "fake", "spam")
4. Click **"Add"** button
5. The keyword is saved and applies instantly to all open X/Twitter tabs

**Tips:**
- Keywords use **complete word matching** — "scam" matches "scam" but NOT "scammer"
- Matching is **case-insensitive** — "SCAM", "Scam", "scam" all match
- Maximum **1000 keywords** (to prevent storage overflow)
- Special characters are handled safely

### Blocking Users

When you see a post with matched keywords:

1. An **orange warning badge** appears next to the username showing matched keywords
2. Click the **red "Block User"** button next to the badge
3. The user's posts immediately disappear from the timeline
4. The user is added to your "Blocked Users" list in Settings

**What happens:**
- All posts from that user are hidden (not deleted)
- Posts are hidden across all tabs automatically
- You can unblock anytime by going to Settings

### Batch Blocking

1. Look at your timeline with multiple matched keywords
2. You can block users one by one using the buttons
3. Each block is instant and applies everywhere

### Unblocking Users

**Method 1: From Settings Page**
1. Open Settings (Click extension icon → "Open Settings")
2. Go to "Blocked Users" section
3. Find the user you want to unblock
4. Click the **"Unblock"** button
5. Posts from that user reappear on the timeline

**Method 2: From Timeline** (if available)
- Some posts may show an unblock option directly

### Backing Up Your Data

**Export:**
1. Open Settings page
2. In "Keywords Management" section, click **"Export Keywords"**
3. A JSON file downloads with all keywords and blocked users
4. Save this file as backup

**Import:**
1. Open Settings page
2. Click **"Import Keywords"** button
3. Select a previously exported JSON file
4. Data is restored and merged with existing data

**Storage Location:**
- All data is stored locally in Chrome's `chrome.storage.local`
- Data persists even if you close the browser
- Data is **NOT** synced to cloud (local only)

---

## ⚙️ Configuration

### Where is Settings?

1. Click the **block-twitter icon** in toolbar
2. Click **"Open Settings"** button
3. You'll see two sections:
   - **Keywords Management** — Add/edit/delete keywords
   - **Blocked Users** — View/unblock users, clear all

### Default Settings

On first install:
- Keywords list: Empty
- Blocked users: Empty
- All posts are visible (no filtering)

### Advanced: Import Previous Data

If you have an exported JSON file:
1. Go to Settings
2. Click "Import Keywords" in the Keywords section
3. Select your JSON file
4. Data merges with existing data

---

## 🐛 Troubleshooting

### Extension doesn't appear in toolbar
- Make sure you loaded it correctly (see Installation section)
- Try reloading the extension: `chrome://extensions/` → find block-twitter → click refresh icon
- Restart Chrome

### Keywords not working on X/Twitter
- **Check DevTools** (F12 → Console tab) for error messages
- **Reload the page** — Content script may not have loaded
- **Check if on correct domain** — Extension only works on x.com and twitter.com
- **Try a different keyword** — Some keywords may not have matches

### Posts not hiding when I block a user
- **Refresh the page** (Cmd+R / Ctrl+R)
- **Check DevTools** for errors
- **Try blocking again** — May not have registered properly

### Export/Import not working
- **File format** — Must be a JSON file exported from block-twitter
- **File corruption** — Try exporting again and importing fresh
- **Try reloading** — Reload the page and try again

### Extension shows errors in console
- This is helpful for debugging. Note the error message.
- Try these steps:
  1. Go to `chrome://extensions/`
  2. Find block-twitter → Click refresh icon
  3. Go back to X/Twitter page
  4. Reload the page (Cmd+R / Ctrl+R)

### Data is missing after restarting Chrome
- This should NOT happen (data is persistent)
- If it does, check if you can import from a backup
- As a workaround, use Settings → "Export Keywords" to save regularly

---

## 📋 How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│  Content Script (content.js)             │
│  - Monitors page for new posts           │
│  - Detects keywords in post text         │
│  - Marks matching users                  │
│  - Hides blocked users' posts            │
└─────────────────────────────────────────┘
           ↕ (Chrome Storage Events)
┌─────────────────────────────────────────┐
│  Background Service Worker (background.js)│
│  - Manages keyword list                  │
│  - Manages blocked users list            │
│  - Handles import/export                 │
│  - Syncs between tabs                    │
└─────────────────────────────────────────┘
           ↕ (Chrome Storage Events)
┌─────────────────────────────────────────┐
│  Popup & Options Pages (UI)              │
│  - Display settings                      │
│  - Let user add/remove keywords          │
│  - Let user manage blocked users         │
│  - Handle data export/import             │
└─────────────────────────────────────────┘
```

### Detection Method

- **MutationObserver** — Efficiently detects new posts without heavy polling
- **Word Boundary Matching** — Uses regex `\b` to match complete words only
- **Case-Insensitive** — Converts text to lowercase before matching
- **Performance** — Optimized to handle 500+ posts without lag

### Storage

- All data stored in `chrome.storage.local` (local, not synced)
- Max ~10MB capacity (current usage typically <1MB)
- Data persists across browser restarts
- Each browser profile has separate storage

---

## 🔒 Privacy & Security

- **No data sent to servers** — Everything stays on your device
- **No tracking** — Extension doesn't track your activity
- **No API calls** — Doesn't communicate with external services
- **Local storage only** — Not synced to cloud
- **Open source** — Code is visible for review

---

## 💾 Data Backup

**Always backup important data:**
1. Go to Settings
2. Click "Export Keywords" regularly
3. Save the JSON file to your computer
4. If you reinstall, use "Import Keywords" to restore

---

## 🛠️ Development

### File Structure

```
block-twitter/
├── manifest.json                 # Extension config
├── README.md                     # This file
├── TESTING.md                    # Testing guide
├── docs/
│   └── specs/
│       └── 2026-04-22--block-twitter.md  # Design spec
└── src/
    ├── background/
    │   └── background.js         # Service worker
    ├── content/
    │   ├── content.js            # Main logic
    │   └── content.css           # Styles
    ├── popup/
    │   ├── popup.html
    │   ├── popup.js
    │   └── popup.css
    └── options/
        ├── options.html
        ├── options.js
        └── options.css
```

### Building from Source

1. Clone the repository
2. Make changes to src files
3. Reload extension in `chrome://extensions/`
4. Test on x.com / twitter.com

### Running Tests

See `TESTING.md` for complete testing guide.

### Code Quality

- No external dependencies (pure JavaScript)
- Chrome APIs only (no npm packages)
- Modular component design
- Comprehensive error handling

---

## ⚠️ Known Limitations

1. **X/Twitter DOM Changes** — If X updates their HTML structure, the extension may need updates
2. **Private Browsing** — Chrome doesn't allow extensions in Incognito mode (browser restriction)
3. **Storage Limits** — Maximum ~10MB, enough for 1000+ keywords and 50000+ blocked users
4. **Browser Support** — Chrome/Chromium only (not Firefox or Safari)
5. **Performance** — May slow down pages with 1000+ posts (browser limitation)

---

## 🤝 Contributing

Found a bug? Have a feature request?

1. Check if it's already reported in Issues
2. Open a new GitHub Issue with:
   - What you were doing
   - What went wrong
   - Steps to reproduce
   - Browser version and OS

---

## 📄 License

MIT License — See LICENSE file for details

---

## 🙏 Acknowledgments

Built with Chrome Web Extension APIs | Tested on Chrome/Brave/Edge

---

## 📞 Support

### Quick Questions?
- Check TESTING.md for debugging tips
- Check Troubleshooting section above

### Found a bug?
- Open an issue on GitHub
- Include console errors (F12 → Console)
- Include steps to reproduce

### Want to help?
- Test the extension and provide feedback
- Report any compatibility issues
- Suggest improvements

---

## 🚀 Future Roadmap

Potential features (not yet implemented):
- [ ] Regular expression support for advanced matching
- [ ] User blacklist import from external sources
- [ ] Statistics dashboard (most blocked users, etc)
- [ ] Scheduling (enable/disable at certain times)
- [ ] Whitelist (always show certain users)
- [ ] Browser profile sync across devices
- [ ] Dark mode for settings page

---

**Last Updated**: April 2026 | **Version**: 0.1.0 (Beta)

Happy blocking! 🎉
