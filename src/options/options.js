/**
 * Options page script for block-twitter extension
 * Handles keywords management, blocked users, import/export
 */

// Storage keys
const STORAGE_KEYS = {
    keywords: 'keywords',
    blockedUsers: 'blockedUsers'
};

// Constants
const MAX_KEYWORDS = 1000;
const TOAST_DURATION = 3000;

// State
let keywords = [];
let blockedUsers = {};
let filteredKeywords = [];
let filteredUsers = {};

document.addEventListener('DOMContentLoaded', initializeOptions);

/**
 * Initialize options page on load
 */
function initializeOptions() {
    // Load initial data
    loadStorageData();

    // Setup event listeners for keywords
    const keywordInput = document.getElementById('keywordInput');
    const addKeywordBtn = document.getElementById('addKeywordBtn');
    const keywordFilter = document.getElementById('keywordFilter');

    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addKeyword();
    });
    addKeywordBtn.addEventListener('click', addKeyword);
    keywordFilter.addEventListener('input', filterKeywords);

    // Setup event listeners for blocked users
    const userFilter = document.getElementById('userFilter');
    const clearAllBtn = document.getElementById('clearAllBtn');

    userFilter.addEventListener('input', filterUsers);
    clearAllBtn.addEventListener('click', clearAllUsers);

    // Setup export/import
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');

    exportBtn.addEventListener('click', exportKeywords);
    importFile.addEventListener('change', handleImportFile);

    // Setup URL import
    const urlImportInput = document.getElementById('urlImportInput');
    const urlImportBtn = document.getElementById('urlImportBtn');

    urlImportBtn.addEventListener('click', importFromUrl);
    urlImportInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') importFromUrl();
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener(onStorageChanged);
}

/**
 * Load keywords and blocked users from storage
 */
function loadStorageData() {
    chrome.storage.local.get([STORAGE_KEYS.keywords, STORAGE_KEYS.blockedUsers], (items) => {
        // Load keywords
        keywords = items[STORAGE_KEYS.keywords] || [];
        filteredKeywords = keywords;

        // Load blocked users
        blockedUsers = items[STORAGE_KEYS.blockedUsers] || {};
        filteredUsers = blockedUsers;

        // Render UI
        renderKeywords();
        renderBlockedUsers();
        updateCounters();
    });
}

/**
 * Handle storage changes from other parts of the extension
 */
function onStorageChanged(changes, areaName) {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEYS.keywords]) {
        keywords = changes[STORAGE_KEYS.keywords].newValue || [];
        filteredKeywords = keywords;
        renderKeywords();
        updateCounters();
    }

    if (changes[STORAGE_KEYS.blockedUsers]) {
        blockedUsers = changes[STORAGE_KEYS.blockedUsers].newValue || {};
        filteredUsers = blockedUsers;
        renderBlockedUsers();
        updateCounters();
    }
}

/**
 * Add a new keyword
 */
function addKeyword() {
    const input = document.getElementById('keywordInput');
    // Support \n as escape sequence so users can enter multi-line keywords
    // (e.g. "💛🌿\n🐷😊😄" becomes a keyword with an actual newline)
    const keyword = input.value.trim().replace(/\\n/g, '\n');

    // Validate input
    if (!keyword) {
        showToast('Please enter a keyword', 'error');
        return;
    }

    if (keyword.length > 100) {
        showToast('Keyword is too long (max 100 characters)', 'error');
        return;
    }

    if (keywords.length >= MAX_KEYWORDS) {
        showToast(`Maximum ${MAX_KEYWORDS} keywords allowed`, 'error');
        return;
    }

    if (keywords.includes(keyword)) {
        showToast('This keyword already exists', 'error');
        return;
    }

    // Add keyword
    keywords.push(keyword);
    keywords.sort();

    // Save to storage
    chrome.storage.local.set({ [STORAGE_KEYS.keywords]: keywords }, () => {
        input.value = '';
        showToast('Keyword added successfully', 'success');
    });
}

/**
 * Delete a keyword
 */
function deleteKeyword(keyword) {
    const index = keywords.indexOf(keyword);
    if (index === -1) return;

    keywords.splice(index, 1);

    chrome.storage.local.set({ [STORAGE_KEYS.keywords]: keywords }, () => {
        showToast('Keyword deleted', 'success');
    });
}

/**
 * Filter keywords based on search input
 */
function filterKeywords() {
    const searchTerm = document.getElementById('keywordFilter').value.toLowerCase();

    if (!searchTerm) {
        filteredKeywords = keywords;
    } else {
        filteredKeywords = keywords.filter((kw) =>
            kw.toLowerCase().includes(searchTerm)
        );
    }

    renderKeywords();
}

/**
 * Render keywords list
 */
function renderKeywords() {
    const list = document.getElementById('keywordsList');
    list.innerHTML = '';

    if (filteredKeywords.length === 0) {
        return;
    }

    filteredKeywords.forEach((keyword) => {
        const item = document.createElement('div');
        item.className = 'keyword-item';
        // Show actual newlines as a visible ↵ indicator so multi-line keywords are readable
        const displayText = escapeHtml(keyword).replace(/\n/g, '<span class="nl-indicator" title="newline">↵</span>');
        item.innerHTML = `
            <span class="keyword-text">${displayText}</span>
            <button class="btn btn-small btn-delete">Delete</button>
        `;

        item.querySelector('.btn-delete').addEventListener('click', () => {
            deleteKeyword(keyword);
        });

        list.appendChild(item);
    });

    updateCounters();
}

/**
 * Unblock a user
 */
function unblockUser(username) {
    delete blockedUsers[username];

    chrome.storage.local.set({ [STORAGE_KEYS.blockedUsers]: blockedUsers }, () => {
        showToast(`User @${username} shown`, 'success');
    });
}

/**
 * Filter blocked users based on search input
 */
function filterUsers() {
    const searchTerm = document.getElementById('userFilter').value.toLowerCase();

    if (!searchTerm) {
        filteredUsers = blockedUsers;
    } else {
        filteredUsers = {};
        Object.keys(blockedUsers).forEach((username) => {
            if (username.toLowerCase().includes(searchTerm)) {
                filteredUsers[username] = blockedUsers[username];
            }
        });
    }

    renderBlockedUsers();
}

/**
 * Render blocked users list
 */
function renderBlockedUsers() {
    const list = document.getElementById('blockedUsersList');
    list.innerHTML = '';

    const usernames = Object.keys(filteredUsers).sort();

    if (usernames.length === 0) {
        return;
    }

    usernames.forEach((username) => {
        const timestamp = filteredUsers[username];
        const date = new Date(timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div>
                <div class="user-name">@${escapeHtml(username)}</div>
                <div class="user-timestamp">${dateStr}</div>
            </div>
            <button class="btn btn-small btn-unblock">Show</button>
        `;

        item.querySelector('.btn-unblock').addEventListener('click', () => {
            unblockUser(username);
        });

        list.appendChild(item);
    });

    updateCounters();
}

/**
 * Clear all blocked users with confirmation
 */
function clearAllUsers() {
    if (Object.keys(blockedUsers).length === 0) {
        showToast('No hidden users to clear', 'info');
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to show all ${Object.keys(blockedUsers).length} hidden users? This cannot be undone.`
    );

    if (!confirmed) return;

    blockedUsers = {};

    chrome.storage.local.set({ [STORAGE_KEYS.blockedUsers]: blockedUsers }, () => {
        showToast('All hidden users cleared', 'success');
    });
}

/**
 * Export keywords to JSON file
 */
function exportKeywords() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        keywords: keywords,
        blockedUsers: blockedUsers
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `block-twitter-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);

    showToast('Export successful', 'success');
}

/**
 * Handle import file selection
 */
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Validate data structure
            if (!data.keywords || !Array.isArray(data.keywords)) {
                showToast('Invalid file format: missing keywords array', 'error');
                return;
            }

            // Validate and sanitize keywords
            let importedKeywords = data.keywords
                .filter((kw) => typeof kw === 'string')
                .map((kw) => kw.trim())
                .filter((kw) => kw && kw.length <= 100);

            // Remove duplicates
            importedKeywords = [...new Set(importedKeywords)];

            // Limit to MAX_KEYWORDS
            if (importedKeywords.length > MAX_KEYWORDS) {
                importedKeywords = importedKeywords.slice(0, MAX_KEYWORDS);
                showToast(`Limited to ${MAX_KEYWORDS} keywords`, 'info');
            }

            // Sort
            importedKeywords.sort();

            // Merge with existing keywords
            const merged = [...new Set([...keywords, ...importedKeywords])].sort();

            if (merged.length > MAX_KEYWORDS) {
                merged = merged.slice(0, MAX_KEYWORDS);
                showToast(`Merged keywords limited to ${MAX_KEYWORDS}`, 'info');
            }

            // Handle blocked users
            let importedUsers = data.blockedUsers || {};
            if (typeof importedUsers === 'object' && !Array.isArray(importedUsers)) {
                // Merge with existing blocked users
                blockedUsers = { ...blockedUsers, ...importedUsers };
            }

            // Save to storage
            chrome.storage.local.set(
                {
                    [STORAGE_KEYS.keywords]: merged,
                    [STORAGE_KEYS.blockedUsers]: blockedUsers
                },
                () => {
                    showToast('Import successful', 'success');
                }
            );
        } catch (error) {
            console.error('Import error:', error);
            showToast('Invalid JSON file', 'error');
        }
    };

    reader.onerror = () => {
        showToast('Failed to read file', 'error');
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

/**
 * Update counter displays
 */
function updateCounters() {
    document.getElementById('keywordCount').textContent = keywords.length;
    document.getElementById('blockedUserCount').textContent = Object.keys(blockedUsers).length;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, TOAST_DURATION);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Import keywords from a remote URL (GitHub Gist, raw JSON, plain text)
 */
async function importFromUrl() {
    const input = document.getElementById('urlImportInput');
    const btn = document.getElementById('urlImportBtn');
    const rawUrl = input.value.trim();

    if (!rawUrl) {
        showToast('Please enter a URL', 'error');
        return;
    }

    let url;
    try {
        url = normalizeGistUrl(rawUrl);
        new URL(url); // throws if invalid
    } catch {
        showToast('Invalid URL', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Importing...';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        const text = await response.text();
        const imported = parseUrlContent(text);

        if (imported.length === 0) {
            showToast('No valid keywords found at that URL', 'info');
            return;
        }

        let merged = [...new Set([...keywords, ...imported])].sort();
        const addedCount = merged.length - keywords.length;

        if (merged.length > MAX_KEYWORDS) {
            merged = merged.slice(0, MAX_KEYWORDS);
        }

        chrome.storage.local.set({ [STORAGE_KEYS.keywords]: merged }, () => {
            input.value = '';
            showToast(`Imported ${imported.length} keywords (${addedCount} new)`, 'success');
        });
    } catch (error) {
        console.error('[block-twitter] URL import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Import from URL';
    }
}

/**
 * Convert a GitHub Gist page URL to its raw content URL.
 * https://gist.github.com/user/abc123        → https://gist.githubusercontent.com/user/abc123/raw/
 * https://gist.githubusercontent.com/...raw/  → unchanged
 * Any other URL                               → unchanged
 */
function normalizeGistUrl(url) {
    const match = url.match(/^https:\/\/gist\.github\.com\/([^/?#]+\/[^/?#]+)/);
    if (match) {
        return `https://gist.githubusercontent.com/${match[1]}/raw/`;
    }
    return url;
}

/**
 * Parse fetched content into a clean keyword array.
 * Supports:
 *   - { keywords: [...] }  (block-twitter export format)
 *   - ["kw1", "kw2", ...]  (bare JSON array)
 *   - plain text, one keyword per line
 */
function parseUrlContent(text) {
    try {
        const data = JSON.parse(text);
        if (data.keywords && Array.isArray(data.keywords)) {
            return sanitizeKeywords(data.keywords);
        }
        if (Array.isArray(data)) {
            return sanitizeKeywords(data);
        }
    } catch {
        // not JSON — fall through to plain text
    }
    return sanitizeKeywords(text.split('\n'));
}

/**
 * Filter, trim and deduplicate a raw keyword array
 */
function sanitizeKeywords(arr) {
    return [...new Set(
        arr
            .filter((kw) => typeof kw === 'string')
            .map((kw) => kw.trim())
            .filter((kw) => kw.length > 0 && kw.length <= 100)
    )];
}
