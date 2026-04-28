/**
 * Options page script for block-twitter extension
 * Handles keywords management, blocked users, import/export
 */

// Storage keys
const STORAGE_KEYS = {
    keywords: 'keywords',
    blockedUsers: 'blockedUsers',
    falsePositiveUsers: 'falsePositiveUsers',
    aiSpamUsers: 'aiSpamUsers'
};

// Constants
const MAX_KEYWORDS = 1000;
const TOAST_DURATION = 3000;

// State
let keywords = [];
let blockedUsers = {};
let falsePositiveUsers = {};
let aiSpamUsers = {};
let filteredKeywords = [];
let filteredUsers = {};
let filteredAISpamUsers = {};
let filteredFalsePositiveUsers = {};
// Hidden users multi-select (Task2)
const selectedHiddenUsers = new Set();

// Batch true-block (Task3)
const BATCH_TRUE_BLOCK_PORT_NAME = 'bt-batch-true-block';
let batchPort = null;
let batchTrueBlockProgress = null; // { total, done, current?, status? }

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

    // Batch true-block UI (Task2; actual batch logic will be implemented in Task3/4)
    const batchSelectAllHiddenBtn = document.getElementById('batchSelectAllHiddenBtn');
    const batchTrueBlockBtn = document.getElementById('batchTrueBlockBtn');
    const batchCancelTrueBlockBtn = document.getElementById('batchCancelTrueBlockBtn');

    batchSelectAllHiddenBtn?.addEventListener('click', toggleSelectAllHiddenUsers);
    batchTrueBlockBtn?.addEventListener('click', startBatchTrueBlock);
    batchCancelTrueBlockBtn?.addEventListener('click', cancelBatchTrueBlock);
    updateBatchSelectedCount();

    // Setup event listeners for AI lists
    const aiSpamUserFilter = document.getElementById('aiSpamUserFilter');
    const clearAllAISpamUsersBtn = document.getElementById('clearAllAISpamUsersBtn');
    const falsePositiveUserFilter = document.getElementById('falsePositiveUserFilter');
    const clearAllFalsePositiveUsersBtn = document.getElementById('clearAllFalsePositiveUsersBtn');

    aiSpamUserFilter?.addEventListener('input', filterAISpamUsers);
    clearAllAISpamUsersBtn?.addEventListener('click', clearAllAISpamUsers);
    falsePositiveUserFilter?.addEventListener('input', filterFalsePositiveUsers);
    clearAllFalsePositiveUsersBtn?.addEventListener('click', clearAllFalsePositiveUsers);

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

    // Setup AI settings
    initAISettings();

    // Setup general settings
    initGeneralSettings();

    // Listen for storage changes
    chrome.storage.onChanged.addListener(onStorageChanged);
}

/**
 * Initialize general settings toggles
 */
function initGeneralSettings() {
    const checkbox = document.getElementById('showManualClassifyBtn');
    chrome.storage.local.get('showManualClassifyBtn', (data) => {
        checkbox.checked = data.showManualClassifyBtn ?? false;
    });
    checkbox.addEventListener('change', () => {
        chrome.storage.local.set({ showManualClassifyBtn: checkbox.checked });
    });
}

/**
 * Initialize AI settings section
 */
function initAISettings() {
    loadAISettings();

    document.getElementById('saveAiBtn').addEventListener('click', saveAISettings);
    document.getElementById('testAiBtn').addEventListener('click', testAIConnection);
    document.getElementById('saveAiPromptBtn').addEventListener('click', saveAIPrompt);

    document.getElementById('presetOpenAI').addEventListener('click', () => {
        document.getElementById('aiBaseUrl').value = 'https://api.openai.com/v1';
        document.getElementById('aiModel').value = 'gpt-4o-mini';
    });

    document.getElementById('presetClaude').addEventListener('click', () => {
        document.getElementById('aiBaseUrl').value = 'https://api.anthropic.com/v1';
        document.getElementById('aiModel').value = 'claude-haiku-4-5-20251001';
    });
}

/**
 * Load AI settings from storage
 */
function loadAISettings() {
    chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel', 'aiCustomPrompt'], (items) => {
        if (items.aiBaseUrl) document.getElementById('aiBaseUrl').value = items.aiBaseUrl;
        if (items.aiApiKey) document.getElementById('aiApiKey').value = items.aiApiKey;
        if (items.aiModel) document.getElementById('aiModel').value = items.aiModel;
        if (items.aiCustomPrompt) document.getElementById('aiCustomPrompt').value = items.aiCustomPrompt;
    });

    // Check Chrome built-in AI availability
    const badge = document.getElementById('aiStatusBadge');
    if (window.ai?.languageModel) {
        window.ai.languageModel.capabilities().then((caps) => {
            badge.textContent = caps.available !== 'no'
                ? 'Chrome AI 可用 ✓'
                : '需配置 API Key';
        }).catch(() => {
            badge.textContent = '需配置 API Key';
        });
    } else {
        badge.textContent = '需配置 API Key';
    }
}

/**
 * Test AI API connection with a minimal request
 */
async function testAIConnection() {
    const baseUrl = document.getElementById('aiBaseUrl').value.trim();
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const model = document.getElementById('aiModel').value.trim();

    if (!baseUrl || !apiKey) {
        showToast('请先填写 Base URL 和 API Key', 'error');
        return;
    }

    const btn = document.getElementById('testAiBtn');
    btn.disabled = true;
    btn.textContent = '测试中...';

    try {
        const isAnthropic = baseUrl.includes('anthropic.com');
        let res;

        if (isAnthropic) {
            const url = baseUrl.replace(/\/?$/, '') + '/messages';
            res = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: model || 'claude-haiku-4-5-20251001',
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'Reply ok' }],
                }),
            });
        } else {
            const url = baseUrl.replace(/\/?$/, '') + '/chat/completions';
            res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model || 'gpt-4o-mini',
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'Reply ok' }],
                }),
            });
        }

        const data = await res.json();

        if (!res.ok) {
            const errMsg = data?.error?.message || data?.error?.code || `HTTP ${res.status}`;
            showToast(`连接失败：${errMsg}`, 'error');
        } else {
            const reply = isAnthropic
                ? data.content?.[0]?.text
                : data.choices?.[0]?.message?.content;
            showToast(`连接成功 ✓ 模型回复：${reply ?? '(空)'}`, 'success');
        }
    } catch (err) {
        showToast(`连接失败：${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '测试连接';
    }
}

/**
 * Save AI API settings
 */
function saveAISettings() {
    const baseUrl = document.getElementById('aiBaseUrl').value.trim();
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const model = document.getElementById('aiModel').value.trim();

    chrome.storage.local.set({ aiBaseUrl: baseUrl, aiApiKey: apiKey, aiModel: model }, () => {
        showToast('AI 设置已保存', 'success');
    });
}

/**
 * Save custom AI prompt
 */
function saveAIPrompt() {
    const prompt = document.getElementById('aiCustomPrompt').value.trim();
    chrome.storage.local.set({ aiCustomPrompt: prompt }, () => {
        showToast('提示词已保存', 'success');
    });
}

/**
 * Load keywords and blocked users from storage
 */
function loadStorageData() {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (items) => {
        keywords = items[STORAGE_KEYS.keywords] || [];
        filteredKeywords = keywords;

        blockedUsers = items[STORAGE_KEYS.blockedUsers] || {};
        filteredUsers = blockedUsers;

        falsePositiveUsers = items[STORAGE_KEYS.falsePositiveUsers] || {};
        aiSpamUsers = items[STORAGE_KEYS.aiSpamUsers] || {};
        filteredAISpamUsers = aiSpamUsers;
        filteredFalsePositiveUsers = falsePositiveUsers;

        renderKeywords();
        renderBlockedUsers();
        renderAISpamUsers();
        renderFalsePositiveUsers();
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

    if (changes[STORAGE_KEYS.falsePositiveUsers]) {
        falsePositiveUsers = changes[STORAGE_KEYS.falsePositiveUsers].newValue || {};
        filteredFalsePositiveUsers = falsePositiveUsers;
        renderFalsePositiveUsers();
        updateCounters();
    }

    if (changes[STORAGE_KEYS.aiSpamUsers]) {
        aiSpamUsers = changes[STORAGE_KEYS.aiSpamUsers].newValue || {};
        filteredAISpamUsers = aiSpamUsers;
        renderAISpamUsers();
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
    selectedHiddenUsers.delete(username);
    updateBatchSelectedCount();

    chrome.storage.local.set({ [STORAGE_KEYS.blockedUsers]: blockedUsers }, () => {
        showToast(`User @${username} shown`, 'success');
    });
}

function syncSelectedHiddenUsersWithBlockedUsers() {
    const allowed = new Set(Object.keys(blockedUsers || {}));
    Array.from(selectedHiddenUsers).forEach((u) => {
        if (!allowed.has(u)) selectedHiddenUsers.delete(u);
    });
}

function getVisibleHiddenUsernames() {
    return Object.keys(filteredUsers || {});
}

function updateBatchSelectedCount() {
    const countEl = document.getElementById('batchSelectedHiddenCount');
    const selectAllBtn = document.getElementById('batchSelectAllHiddenBtn');
    const startBtn = document.getElementById('batchTrueBlockBtn');

    if (countEl) countEl.textContent = String(selectedHiddenUsers.size);

    // Update select-all label based on current visible list state
    const visible = getVisibleHiddenUsernames();
    const allVisibleSelected =
        visible.length > 0 && visible.every((u) => selectedHiddenUsers.has(u));
    if (selectAllBtn) selectAllBtn.textContent = allVisibleSelected ? '取消全选' : '全选';

    if (startBtn) startBtn.disabled = selectedHiddenUsers.size === 0 || isBatchTrueBlockRunning();
}

function toggleSelectAllHiddenUsers() {
    const visible = getVisibleHiddenUsernames();
    if (visible.length === 0) {
        updateBatchSelectedCount();
        return;
    }

    const allVisibleSelected = visible.every((u) => selectedHiddenUsers.has(u));
    if (allVisibleSelected) {
        visible.forEach((u) => selectedHiddenUsers.delete(u));
    } else {
        visible.forEach((u) => selectedHiddenUsers.add(u));
    }

    // Refresh list so checkboxes reflect the latest selection state.
    renderBlockedUsers();
}

function isBatchTrueBlockRunning() {
    return batchTrueBlockProgress?.status === 'running';
}

function setBatchTrueBlockControls(running) {
    const startBtn = document.getElementById('batchTrueBlockBtn');
    const cancelBtn = document.getElementById('batchCancelTrueBlockBtn');

    if (startBtn) startBtn.disabled = running || selectedHiddenUsers.size === 0;
    if (cancelBtn) cancelBtn.style.display = running ? 'inline-block' : 'none';
}

function renderBatchTrueBlockProgressText(text, visible = true) {
    const el = document.getElementById('batchTrueBlockProgress');
    if (!el) return;
    el.style.display = visible ? 'block' : 'none';
    if (visible) el.textContent = text || '';
}

function getBatchPort() {
    if (batchPort) return batchPort;
    batchPort = chrome.runtime.connect({ name: BATCH_TRUE_BLOCK_PORT_NAME });
    batchPort.onMessage.addListener(onBatchMessage);
    batchPort.onDisconnect.addListener(() => {
        batchPort = null;
        if (isBatchTrueBlockRunning()) {
            batchTrueBlockProgress = { ...(batchTrueBlockProgress || {}), status: 'error' };
            setBatchTrueBlockControls(false);
            renderBatchTrueBlockProgressText('批量屏蔽连接已断开（后台可能已重启）。请重试。', true);
        }
    });
    return batchPort;
}

function startBatchTrueBlock() {
    if (selectedHiddenUsers.size === 0) {
        showToast('请先选择要屏蔽的用户', 'info');
        return;
    }

    const usernames = Array.from(selectedHiddenUsers);
    batchTrueBlockProgress = { status: 'running', done: 0, total: usernames.length, current: null };

    setBatchTrueBlockControls(true);
    renderBatchTrueBlockProgressText(`准备开始批量屏蔽：共 ${usernames.length} 个用户…`, true);

    getBatchPort().postMessage({ type: 'start', usernames });
}

function cancelBatchTrueBlock() {
    if (!isBatchTrueBlockRunning()) return;
    renderBatchTrueBlockProgressText('正在停止…', true);
    getBatchPort().postMessage({ type: 'cancel' });
}

function onBatchMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'progress') {
        const total = Number(msg.total ?? batchTrueBlockProgress?.total ?? 0);
        const done = Number(msg.done ?? batchTrueBlockProgress?.done ?? 0);
        const username = msg.username || msg.current || null;
        const ok = Number(msg.ok ?? batchTrueBlockProgress?.ok ?? 0);
        const already = Number(msg.already ?? batchTrueBlockProgress?.already ?? 0);
        const failed = Number(msg.failed ?? batchTrueBlockProgress?.failed ?? 0);
        const step = msg.step || batchTrueBlockProgress?.step || null;
        const last = msg.last || batchTrueBlockProgress?.last || null;

        batchTrueBlockProgress = {
            status: 'running',
            total,
            done,
            current: username,
            ok,
            already,
            failed,
            step,
            last
        };

        const cur = username
            ? (String(username).startsWith('@') ? String(username) : `@${username}`)
            : '';
        const stepText = step ? `（${step}）` : '';
        const lastErr = last?.error ? ` | 错误: ${String(last.error).slice(0, 120)}` : '';
        renderBatchTrueBlockProgressText(
            `进度：${done}/${total} | 成功 ${ok} | 已屏蔽 ${already} | 失败 ${failed} ${cur}${stepText}${lastErr}`,
            true
        );
        setBatchTrueBlockControls(true);
        return;
    }

    if (msg.type === 'done') {
        batchTrueBlockProgress = { ...(batchTrueBlockProgress || {}), status: 'done' };
        setBatchTrueBlockControls(false);

        const total = Number(msg.total ?? batchTrueBlockProgress.total ?? 0);
        const done = Number(msg.done ?? total);
        const cancelled = Boolean(msg.cancelled);
        const ok = Number(msg.ok ?? batchTrueBlockProgress?.ok ?? 0);
        const already = Number(msg.already ?? batchTrueBlockProgress?.already ?? 0);
        const failed = Number(msg.failed ?? batchTrueBlockProgress?.failed ?? 0);

        const summary = `已处理 ${done}/${total}，成功 ${ok}，已屏蔽 ${already}，失败 ${failed}`;
        const hint = failed > 0
            ? '（失败的用户仍保留在隐藏列表并保持勾选，可重试或手动处理）'
            : '';
        renderBatchTrueBlockProgressText(
            cancelled ? `已停止：${summary} ${hint}` : `已完成：${summary} ${hint}`,
            true
        );
        showToast(cancelled ? '批量屏蔽已停止' : '批量屏蔽已完成', cancelled ? 'info' : 'success');
        updateBatchSelectedCount();
        return;
    }

    if (msg.type === 'error') {
        batchTrueBlockProgress = { ...(batchTrueBlockProgress || {}), status: 'error' };
        setBatchTrueBlockControls(false);
        const err = msg.error || msg.message || '未知错误';
        renderBatchTrueBlockProgressText(`错误：${err}`, true);
        showToast(`批量屏蔽失败：${err}`, 'error');
        updateBatchSelectedCount();
    }
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

    syncSelectedHiddenUsersWithBlockedUsers();

    const usernames = Object.keys(filteredUsers).sort();

    if (usernames.length === 0) {
        updateBatchSelectedCount();
        return;
    }

    usernames.forEach((username) => {
        const timestamp = filteredUsers[username];
        const date = new Date(timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

        const item = document.createElement('div');
        item.className = 'user-item';
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '10px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'bt-hidden-select';
        cb.dataset.username = username;
        cb.checked = selectedHiddenUsers.has(username);
        cb.addEventListener('change', () => {
            if (cb.checked) selectedHiddenUsers.add(username);
            else selectedHiddenUsers.delete(username);
            updateBatchSelectedCount();
        });

        const info = document.createElement('div');
        const displayHandle = String(username).startsWith('@') ? String(username) : `@${username}`;
        info.innerHTML = `
            <div class="user-name">${escapeHtml(displayHandle)}</div>
            <div class="user-timestamp">${dateStr}</div>
        `;

        left.appendChild(cb);
        left.appendChild(info);

        const btn = document.createElement('button');
        btn.className = 'btn btn-small btn-unblock';
        btn.textContent = 'Show';
        btn.addEventListener('click', () => unblockUser(username));

        item.appendChild(left);
        item.appendChild(btn);

        list.appendChild(item);
    });

    updateCounters();
    updateBatchSelectedCount();
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
    selectedHiddenUsers.clear();
    updateBatchSelectedCount();

    chrome.storage.local.set({ [STORAGE_KEYS.blockedUsers]: blockedUsers }, () => {
        showToast('All hidden users cleared', 'success');
    });
}

// ── AI Spam Users ─────────────────────────────────────────────────────────────

function filterAISpamUsers() {
    const term = (document.getElementById('aiSpamUserFilter')?.value || '').toLowerCase();
    if (!term) {
        filteredAISpamUsers = aiSpamUsers;
    } else {
        filteredAISpamUsers = {};
        Object.keys(aiSpamUsers).forEach((u) => {
            if (u.toLowerCase().includes(term)) filteredAISpamUsers[u] = aiSpamUsers[u];
        });
    }
    renderAISpamUsers();
}

function renderAISpamUsers() {
    const list = document.getElementById('aiSpamUsersList');
    if (!list) return;
    list.innerHTML = '';
    const usernames = Object.keys(filteredAISpamUsers || {}).sort();
    if (usernames.length === 0) {
        updateCounters();
        return;
    }
    usernames.forEach((username) => {
        const ts = filteredAISpamUsers[username];
        const dateStr = ts ? (new Date(ts)).toLocaleDateString() + ' ' + (new Date(ts)).toLocaleTimeString() : '';
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div>
                <div class="user-name">@${escapeHtml(username)}</div>
                <div class="user-timestamp">${dateStr}</div>
            </div>
            <button class="btn btn-small btn-unblock">移除</button>
        `;
        item.querySelector('.btn-unblock').addEventListener('click', () => removeAISpamUser(username));
        list.appendChild(item);
    });
    updateCounters();
}

function removeAISpamUser(username) {
    delete aiSpamUsers[username];
    filteredAISpamUsers = { ...aiSpamUsers };
    chrome.storage.local.set({ [STORAGE_KEYS.aiSpamUsers]: aiSpamUsers }, () => {
        renderAISpamUsers();
        showToast('已移除', 'success');
    });
}

function clearAllAISpamUsers() {
    if (Object.keys(aiSpamUsers).length === 0) { showToast('列表为空', 'info'); return; }
    if (!confirm(`确定要清空全部 ${Object.keys(aiSpamUsers).length} 个 AI 识别垃圾用户记录吗？`)) return;
    aiSpamUsers = {};
    filteredAISpamUsers = {};
    chrome.storage.local.set({ [STORAGE_KEYS.aiSpamUsers]: aiSpamUsers }, () => {
        renderAISpamUsers();
        showToast('已清空', 'success');
    });
}

// ── False Positive Users ──────────────────────────────────────────────────────

function filterFalsePositiveUsers() {
    const term = (document.getElementById('falsePositiveUserFilter')?.value || '').toLowerCase();
    if (!term) {
        filteredFalsePositiveUsers = falsePositiveUsers;
    } else {
        filteredFalsePositiveUsers = {};
        Object.keys(falsePositiveUsers).forEach((u) => {
            if (u.toLowerCase().includes(term)) filteredFalsePositiveUsers[u] = falsePositiveUsers[u];
        });
    }
    renderFalsePositiveUsers();
}

function renderFalsePositiveUsers() {
    const list = document.getElementById('falsePositiveUsersList');
    if (!list) return;
    list.innerHTML = '';
    const usernames = Object.keys(filteredFalsePositiveUsers || {}).sort();
    if (usernames.length === 0) {
        updateCounters();
        return;
    }
    usernames.forEach((username) => {
        const ts = filteredFalsePositiveUsers[username];
        const dateStr = ts ? (new Date(ts)).toLocaleDateString() + ' ' + (new Date(ts)).toLocaleTimeString() : '';
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div>
                <div class="user-name">@${escapeHtml(username)}</div>
                <div class="user-timestamp">${dateStr}</div>
            </div>
            <button class="btn btn-small btn-unblock">移除</button>
        `;
        item.querySelector('.btn-unblock').addEventListener('click', () => removeFalsePositiveUser(username));
        list.appendChild(item);
    });
    updateCounters();
}

function removeFalsePositiveUser(username) {
    delete falsePositiveUsers[username];
    filteredFalsePositiveUsers = { ...falsePositiveUsers };
    chrome.storage.local.set({ [STORAGE_KEYS.falsePositiveUsers]: falsePositiveUsers }, () => {
        renderFalsePositiveUsers();
        showToast('已移除', 'success');
    });
}

function clearAllFalsePositiveUsers() {
    if (Object.keys(falsePositiveUsers).length === 0) { showToast('列表为空', 'info'); return; }
    if (!confirm(`确定要清空全部 ${Object.keys(falsePositiveUsers).length} 个误报用户记录吗？`)) return;
    falsePositiveUsers = {};
    filteredFalsePositiveUsers = {};
    chrome.storage.local.set({ [STORAGE_KEYS.falsePositiveUsers]: falsePositiveUsers }, () => {
        renderFalsePositiveUsers();
        showToast('已清空', 'success');
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
        blockedUsers: blockedUsers,
        falsePositiveUsers: falsePositiveUsers,
        aiSpamUsers: aiSpamUsers
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
            const importedUsers = data.blockedUsers || {};
            if (typeof importedUsers === 'object' && !Array.isArray(importedUsers)) {
                blockedUsers = { ...blockedUsers, ...importedUsers };
            }

            // Handle false positive users (merge, imported list wins)
            const importedFP = data.falsePositiveUsers || {};
            if (typeof importedFP === 'object' && !Array.isArray(importedFP)) {
                falsePositiveUsers = { ...falsePositiveUsers, ...importedFP };
            }

            // Handle AI spam users — skip any that are in falsePositiveUsers
            const importedSpam = data.aiSpamUsers || {};
            if (typeof importedSpam === 'object' && !Array.isArray(importedSpam)) {
                const sanitized = {};
                Object.entries(importedSpam).forEach(([u, ts]) => {
                    if (!falsePositiveUsers[u]) sanitized[u] = ts;
                });
                aiSpamUsers = { ...aiSpamUsers, ...sanitized };
            }

            // Save to storage
            chrome.storage.local.set(
                {
                    [STORAGE_KEYS.keywords]: merged,
                    [STORAGE_KEYS.blockedUsers]: blockedUsers,
                    [STORAGE_KEYS.falsePositiveUsers]: falsePositiveUsers,
                    [STORAGE_KEYS.aiSpamUsers]: aiSpamUsers
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
    const aiCountEl = document.getElementById('aiSpamUserCount');
    if (aiCountEl) aiCountEl.textContent = Object.keys(aiSpamUsers).length;
    const fpCountEl = document.getElementById('falsePositiveUserCount');
    if (fpCountEl) fpCountEl.textContent = Object.keys(falsePositiveUsers).length;
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
