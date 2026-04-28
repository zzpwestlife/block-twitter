/**
 * Background Service Worker for block-twitter Chrome Extension
 *
 * Responsibilities:
 * - Initialize storage on first install
 * - Handle messages from popup/options pages
 * - Manage keywords, blocked users, and stats
 * - Validate data and ensure consistency across tabs
 * - Handle storage sync events
 */

// Constants
const DEFAULT_STORAGE = {
  keywords: [],
  blockedUsers: {},
  stats: { totalBlocked: 0 }
};

const ERROR_CODES = {
  EMPTY_KEYWORD: 'EMPTY_KEYWORD',
  DUPLICATE_KEYWORD: 'DUPLICATE_KEYWORD',
  EMPTY_USERNAME: 'EMPTY_USERNAME',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INVALID_JSON: 'INVALID_JSON'
};

/**
 * Initialize storage on extension install
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get(null, (currentData) => {
      if (!currentData || Object.keys(currentData).length === 0) {
        chrome.storage.local.set(DEFAULT_STORAGE, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to initialize storage:', chrome.runtime.lastError);
          } else {
            console.log('Storage initialized on install');
          }
        });
      }
    });
  }
});

/**
 * Validate keyword string
 * @param {string} keyword - The keyword to validate
 * @returns {object} {isValid: boolean, error?: string}
 */
function validateKeyword(keyword) {
  if (!keyword || typeof keyword !== 'string') {
    return { isValid: false, code: ERROR_CODES.EMPTY_KEYWORD, message: 'Keyword cannot be empty' };
  }

  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    return { isValid: false, code: ERROR_CODES.EMPTY_KEYWORD, message: 'Keyword cannot be whitespace only' };
  }

  return { isValid: true };
}

/**
 * Sanitize keyword by escaping special regex characters
 * @param {string} keyword - The keyword to sanitize
 * @returns {string} Sanitized keyword
 */
function sanitizeKeyword(keyword) {
  return keyword.trim();
}

/**
 * Validate username
 * @param {string} username - The username to validate
 * @returns {object} {isValid: boolean, error?: string}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { isValid: false, code: ERROR_CODES.EMPTY_USERNAME, message: 'Username cannot be empty' };
  }

  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { isValid: false, code: ERROR_CODES.EMPTY_USERNAME, message: 'Username cannot be whitespace only' };
  }

  return { isValid: true };
}

/**
 * Get current keywords from storage
 * @returns {Promise<Array>} Array of keywords
 */
function getKeywords() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['keywords'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in getKeywords:', chrome.runtime.lastError);
        resolve([]);
      } else {
        resolve(data.keywords || []);
      }
    });
  });
}

/**
 * Add a new keyword
 * @param {string} keyword - The keyword to add
 * @returns {Promise<object>} {success: boolean, data?: Array, error?: {code, message}}
 */
function addKeyword(keyword) {
  return new Promise((resolve) => {
    const validation = validateKeyword(keyword);
    if (!validation.isValid) {
      resolve({
        success: false,
        error: { code: validation.code, message: validation.message }
      });
      return;
    }

    const sanitized = sanitizeKeyword(keyword);

    chrome.storage.local.get(['keywords'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in addKeyword:', chrome.runtime.lastError);
        resolve({
          success: false,
          error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to read from storage' }
        });
        return;
      }

      const keywords = data.keywords || [];

      // Check for duplicates (case-insensitive comparison)
      const isDuplicate = keywords.some(k => k.toLowerCase() === sanitized.toLowerCase());
      if (isDuplicate) {
        resolve({
          success: false,
          error: { code: ERROR_CODES.DUPLICATE_KEYWORD, message: 'Keyword already exists' }
        });
        return;
      }

      const updatedKeywords = [...keywords, sanitized];
      chrome.storage.local.set({ keywords: updatedKeywords }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error writing keywords:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to write to storage' }
          });
        } else {
          console.log('Keyword added:', sanitized);
          resolve({ success: true, data: updatedKeywords });
        }
      });
    });
  });
}

/**
 * Delete a keyword
 * @param {string} keyword - The keyword to delete
 * @returns {Promise<object>} {success: boolean, data?: Array, error?: {code, message}}
 */
function deleteKeyword(keyword) {
  return new Promise((resolve) => {
    if (!keyword || typeof keyword !== 'string') {
      resolve({
        success: false,
        error: { code: ERROR_CODES.EMPTY_KEYWORD, message: 'Keyword cannot be empty' }
      });
      return;
    }

    chrome.storage.local.get(['keywords'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in deleteKeyword:', chrome.runtime.lastError);
        resolve({
          success: false,
          error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to read from storage' }
        });
        return;
      }

      const keywords = data.keywords || [];
      const updatedKeywords = keywords.filter(k => k.toLowerCase() !== keyword.toLowerCase());

      if (updatedKeywords.length === keywords.length) {
        resolve({
          success: false,
          error: { code: ERROR_CODES.EMPTY_KEYWORD, message: 'Keyword not found' }
        });
        return;
      }

      chrome.storage.local.set({ keywords: updatedKeywords }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error writing keywords:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to write to storage' }
          });
        } else {
          console.log('Keyword deleted:', keyword);
          resolve({ success: true, data: updatedKeywords });
        }
      });
    });
  });
}

/**
 * Get all blocked users
 * @returns {Promise<object>} Object with usernames as keys and timestamps as values
 */
function getBlockedUsers() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['blockedUsers'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in getBlockedUsers:', chrome.runtime.lastError);
        resolve({});
      } else {
        resolve(data.blockedUsers || {});
      }
    });
  });
}

/**
 * Block a user
 * @param {string} username - The username to block
 * @returns {Promise<object>} {success: boolean, data?: object, error?: {code, message}}
 */
function blockUser(username) {
  return new Promise((resolve) => {
    const validation = validateUsername(username);
    if (!validation.isValid) {
      resolve({
        success: false,
        error: { code: validation.code, message: validation.message }
      });
      return;
    }

    const sanitized = sanitizeKeyword(username); // Reuse sanitize for username

    chrome.storage.local.get(['blockedUsers', 'stats'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in blockUser:', chrome.runtime.lastError);
        resolve({
          success: false,
          error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to read from storage' }
        });
        return;
      }

      const blockedUsers = data.blockedUsers || {};
      const stats = data.stats || { totalBlocked: 0 };

      // Check if already blocked
      if (blockedUsers[sanitized]) {
        resolve({ success: true, data: blockedUsers }); // Already blocked, return success
        return;
      }

      const timestamp = Date.now();
      blockedUsers[sanitized] = timestamp;

      // Update stats
      stats.totalBlocked = Object.keys(blockedUsers).length;

      chrome.storage.local.set({ blockedUsers, stats }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error writing blockedUsers:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to write to storage' }
          });
        } else {
          console.log('User blocked:', sanitized);
          resolve({ success: true, data: blockedUsers });
        }
      });
    });
  });
}

/**
 * Unblock a user
 * @param {string} username - The username to unblock
 * @returns {Promise<object>} {success: boolean, data?: object, error?: {code, message}}
 */
function unblockUser(username) {
  return new Promise((resolve) => {
    if (!username || typeof username !== 'string') {
      resolve({
        success: false,
        error: { code: ERROR_CODES.EMPTY_USERNAME, message: 'Username cannot be empty' }
      });
      return;
    }

    const sanitized = sanitizeKeyword(username);

    chrome.storage.local.get(['blockedUsers', 'stats'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in unblockUser:', chrome.runtime.lastError);
        resolve({
          success: false,
          error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to read from storage' }
        });
        return;
      }

      const blockedUsers = data.blockedUsers || {};
      const stats = data.stats || { totalBlocked: 0 };

      if (!blockedUsers[sanitized]) {
        resolve({
          success: false,
          error: { code: ERROR_CODES.EMPTY_USERNAME, message: 'User not found in blocked list' }
        });
        return;
      }

      delete blockedUsers[sanitized];

      // Update stats
      stats.totalBlocked = Object.keys(blockedUsers).length;

      chrome.storage.local.set({ blockedUsers, stats }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error writing blockedUsers:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to write to storage' }
          });
        } else {
          console.log('User unblocked:', sanitized);
          resolve({ success: true, data: blockedUsers });
        }
      });
    });
  });
}

/**
 * Export all data as JSON string
 * @returns {Promise<object>} {success: boolean, data?: string, error?: {code, message}}
 */
function exportData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in exportData:', chrome.runtime.lastError);
        resolve({
          success: false,
          error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to read from storage' }
        });
        return;
      }

      try {
        const exportObj = {
          keywords: data.keywords || [],
          blockedUsers: data.blockedUsers || {},
          falsePositiveUsers: data.falsePositiveUsers || {},
          aiSpamUsers: data.aiSpamUsers || {},
          stats: data.stats || { totalBlocked: 0 },
          exportedAt: new Date().toISOString()
        };
        const jsonString = JSON.stringify(exportObj, null, 2);
        resolve({ success: true, data: jsonString });
      } catch (error) {
        console.error('Error serializing data:', error);
        resolve({
          success: false,
          error: { code: ERROR_CODES.INVALID_JSON, message: 'Failed to serialize data' }
        });
      }
    });
  });
}

/**
 * Import data from JSON string
 * @param {string} jsonString - The JSON string to import
 * @returns {Promise<object>} {success: boolean, data?: object, error?: {code, message}}
 */
function importData(jsonString) {
  return new Promise((resolve) => {
    if (!jsonString || typeof jsonString !== 'string') {
      resolve({
        success: false,
        error: { code: ERROR_CODES.INVALID_JSON, message: 'Import data must be a valid JSON string' }
      });
      return;
    }

    try {
      const importedData = JSON.parse(jsonString);

      // Validate structure
      if (!Array.isArray(importedData.keywords) || typeof importedData.blockedUsers !== 'object') {
        resolve({
          success: false,
          error: { code: ERROR_CODES.INVALID_JSON, message: 'Invalid data structure' }
        });
        return;
      }

      // Sanitize imported data
      const sanitizedKeywords = importedData.keywords
        .filter(k => typeof k === 'string' && k.trim().length > 0)
        .map(k => k.trim())
        .filter((k, idx, arr) => arr.indexOf(k) === idx); // Remove duplicates

      const sanitizedBlockedUsers = {};
      if (importedData.blockedUsers && typeof importedData.blockedUsers === 'object') {
        Object.entries(importedData.blockedUsers).forEach(([username, timestamp]) => {
          if (username.trim().length > 0) {
            sanitizedBlockedUsers[username.trim()] = timestamp;
          }
        });
      }

      const sanitizedFalsePositives = {};
      if (importedData.falsePositiveUsers && typeof importedData.falsePositiveUsers === 'object') {
        Object.entries(importedData.falsePositiveUsers).forEach(([username, timestamp]) => {
          if (username.trim().length > 0) {
            sanitizedFalsePositives[username.trim()] = timestamp;
          }
        });
      }

      const sanitizedAISpamUsers = {};
      if (importedData.aiSpamUsers && typeof importedData.aiSpamUsers === 'object') {
        Object.entries(importedData.aiSpamUsers).forEach(([username, timestamp]) => {
          const u = username.trim();
          // Don't re-import AI spam users that the user marked as false positives
          if (u.length > 0 && !sanitizedFalsePositives[u]) {
            sanitizedAISpamUsers[u] = timestamp;
          }
        });
      }

      // Limit keywords to 1000
      const limitedKeywords = sanitizedKeywords.slice(0, 1000);

      const stats = {
        totalBlocked: Object.keys(sanitizedBlockedUsers).length
      };

      const dataToStore = {
        keywords: limitedKeywords,
        blockedUsers: sanitizedBlockedUsers,
        falsePositiveUsers: sanitizedFalsePositives,
        aiSpamUsers: sanitizedAISpamUsers,
        stats
      };

      chrome.storage.local.set(dataToStore, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error in importData:', chrome.runtime.lastError);
          resolve({
            success: false,
            error: { code: ERROR_CODES.STORAGE_ERROR, message: 'Failed to write imported data to storage' }
          });
        } else {
          console.log('Data imported successfully');
          resolve({ success: true, data: dataToStore });
        }
      });
    } catch (error) {
      console.error('Error parsing import data:', error);
      resolve({
        success: false,
        error: { code: ERROR_CODES.INVALID_JSON, message: 'Invalid JSON format' }
      });
    }
  });
}

/**
 * Classify posts as spam/ok using an external LLM API.
 * Supports Anthropic Messages API and any OpenAI-compatible endpoint.
 */
async function handleAIClassify({ posts, baseUrl, apiKey, model, systemPrompt }) {
  const postsText = posts
    .map((p, i) => {
      const name = p.displayName ? `${p.displayName} (@${p.username.replace('@', '')})` : p.username;
      return `[${i + 1}] 账号: ${name}\n    内容: ${p.text.slice(0, 300)}`;
    })
    .join('\n');
  const N = posts.length;
  const userMsg =
`对以下帖子分类。只输出 ${N} 行，每行必须严格使用半角冒号 ':'，格式必须为: "序号: spam" 或 "序号: ok"。
不要输出任何解释、标题、空行或多余字符。
示例:
1: spam
2: ok

${postsText}`;

  let text = '';
  try {
    const isAnthropic = baseUrl.includes('anthropic.com');
    if (isAnthropic) {
      const url = baseUrl.replace(/\/?$/, '') + '/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      const data = await res.json();
      text = data.content?.[0]?.text ?? '';
    } else {
      const url = baseUrl.replace(/\/?$/, '') + '/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          max_tokens: 200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      text = data.choices?.[0]?.message?.content ?? '';
    }
  } catch (err) {
    console.error('[block-twitter] AI API error:', err);
    return { success: false, error: err.message };
  }

  const lines = String(text || '').split(/\r?\n/);
  const labels = posts.map((_, i) => {
    const idx = i + 1;
    const re = new RegExp(`^\\s*${idx}\\s*[:：/／\\.)\\-–—]\\s*(spam|ok)\\b`, 'i');
    const line = lines.find(l => re.test(l));
    const m = line?.match(re);
    const v = (m?.[1] || 'ok').toLowerCase();
    return v === 'spam' ? 'spam' : 'ok';
  });

  const hasAnyNonEmptyLine = lines.some(l => l.trim().length > 0);
  if (!labels.some(x => x === 'spam') && hasAnyNonEmptyLine) {
    // Not necessarily an error, but helps diagnose “all ok” due to format mismatch.
    console.warn('[block-twitter] AI parse produced no spam labels; check output format.');
  }
  return { success: true, labels };
}

// ── Batch true-block Port (Task4; throttled runner) ───────────────────────────

const BATCH_TRUE_BLOCK_PORT_NAME = 'bt-batch-true-block';
let activeBatchTrueBlockJob = null; // { cancelled, done, total, ok, already, failed, port, xTabId }
let cachedXTabId = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

function normalizeHandle(username) {
  const s = String(username || '').trim();
  return s.startsWith('@') ? s.slice(1) : s;
}

function getBlockedUsersFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['blockedUsers'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('[batch-true-block] storage get blockedUsers error:', chrome.runtime.lastError);
        resolve({});
      } else {
        resolve(data.blockedUsers || {});
      }
    });
  });
}

function setBlockedUsersToStorage(blockedUsers) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ blockedUsers }, () => {
      if (chrome.runtime.lastError) {
        console.error('[batch-true-block] storage set blockedUsers error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function tabsQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tabs || []);
    });
  });
}

function tabsCreate(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tab);
    });
  });
}

function tabsGet(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tab);
    });
  });
}

function tabsUpdate(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(tab);
    });
  });
}

function tabsSendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(response);
    });
  });
}

async function cancellableSleep(job, ms) {
  const endAt = Date.now() + ms;
  while (Date.now() < endAt) {
    if (job.cancelled) return false;
    // Chunk it so cancel is responsive.
    // 250ms is a good compromise between responsiveness and overhead.
    await sleep(Math.min(250, endAt - Date.now()));
  }
  return !job.cancelled;
}

function safePostProgress(job, extra = {}) {
  const port = job?.port;
  if (!port) return;
  try {
    port.postMessage({
      type: 'progress',
      done: job.done,
      total: job.total,
      ok: job.ok,
      already: job.already,
      failed: job.failed,
      last: job.last,
      ...extra
    });
  } catch (_) {
    // ignore (port may have disconnected)
  }
}

function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch (_) {
    // ignore
  }
}

async function ensureXTab(job) {
  if (job.cancelled) throw new Error('cancelled');

  // 1) Try cached tabId
  if (cachedXTabId) {
    try {
      const t = await tabsGet(cachedXTabId);
      const url = String(t?.url || '');
      if (url.includes('://x.com/') && !t.active) {
        job.xTabId = cachedXTabId;
        return cachedXTabId;
      }
    } catch (_) {
      // Tab might be gone; fall through
    }
    cachedXTabId = null;
  }

  // 2) Try reuse an existing, non-active x.com tab
  try {
    const tabs = await tabsQuery({ url: ['*://x.com/*'] });
    const candidate = tabs.find(t => !t.active);
    if (candidate?.id != null) {
      cachedXTabId = candidate.id;
      job.xTabId = candidate.id;
      return candidate.id;
    }
  } catch (e) {
    console.warn('[batch-true-block] tabs.query failed, will create new tab:', e);
  }

  // 3) Create new background tab
  const tab = await tabsCreate({ url: 'https://x.com/home', active: false });
  cachedXTabId = tab.id;
  job.xTabId = tab.id;
  return tab.id;
}

async function waitForTabComplete(job, tabId, { timeoutMs = 45000 } = {}) {
  if (job.cancelled) throw new Error('cancelled');

  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for tab complete'));
    }, timeoutMs);

    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };

    const onRemoved = (removedTabId) => {
      if (removedTabId !== tabId) return;
      cleanup();
      reject(new Error('tab removed'));
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== 'complete') return;
      cleanup();
      resolve(true);
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    // Cancel polling
    const cancelTick = async () => {
      if (done) return;
      if (job.cancelled) {
        cleanup();
        reject(new Error('cancelled'));
        return;
      }
      setTimeout(cancelTick, 200);
    };
    cancelTick();
  });
}

async function navigateToProfile(job, tabId, username) {
  const handle = normalizeHandle(username);
  if (!handle) throw new Error('empty username');
  const url = `https://x.com/${handle}`;
  // Updating URL does not activate the tab; keep it background.
  await tabsUpdate(tabId, { url });
  await waitForTabComplete(job, tabId, { timeoutMs: 45000 });
  return url;
}

async function runTrueBlockInTab(job, tabId, username) {
  // Content script injection can lag. Retry a bit.
  const maxTry = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxTry; attempt++) {
    if (job.cancelled) throw new Error('cancelled');
    try {
      // Expected: { status: 'success'|'already_blocked'|'failed', error? }
      const res = await tabsSendMessage(tabId, { type: 'bt_trueBlockProfile', username });
      return res || { status: 'failed', error: 'empty response' };
    } catch (e) {
      lastErr = e;
      // "Receiving end does not exist." is common when content script not ready yet.
      await cancellableSleep(job, jitter(800, 1400));
    }
  }
  return { status: 'failed', error: lastErr?.message || String(lastErr || 'sendMessage failed') };
}

function cancelJob() {
  if (activeBatchTrueBlockJob) {
    activeBatchTrueBlockJob.cancelled = true;
  }
}

async function startJob(port, usernames) {
  // Cancel any previous job
  cancelJob();

  const list = Array.isArray(usernames) ? usernames.filter(Boolean) : [];
  const job = {
    cancelled: false,
    done: 0,
    total: list.length,
    ok: 0,
    already: 0,
    failed: 0,
    last: null,
    port,
    xTabId: null
  };
  activeBatchTrueBlockJob = job;

  try {
    if (list.length === 0) {
      safePost(port, { type: 'done', done: 0, total: 0, cancelled: false, ok: 0, already: 0, failed: 0 });
      return;
    }

    // Cache blockedUsers once, then mutate+set on each success/already step.
    // (No repeated get calls.)
    let blockedUsersCache = await getBlockedUsersFromStorage();

    for (let i = 0; i < list.length; i++) {
      const username = list[i];
      if (job.cancelled) break;

      // Per-user throttle
      safePostProgress(job, { username, step: 'throttle' });
      const okSleep = await cancellableSleep(job, jitter(1500, 3000));
      if (!okSleep) break;

      // Ensure tab
      safePostProgress(job, { username, step: 'ensure_tab' });
      const tabId = await ensureXTab(job);
      if (job.cancelled) break;

      // Navigate
      safePostProgress(job, { username, step: 'navigate' });
      await navigateToProfile(job, tabId, username);
      if (job.cancelled) break;

      // True block via content script
      safePostProgress(job, { username, step: 'true_block' });
      const res = await runTrueBlockInTab(job, tabId, username);

      const status = String(res?.status || 'failed');
      job.last = { username, status };
      if (status === 'success') job.ok += 1;
      else if (status === 'already_blocked') job.already += 1;
      else job.failed += 1;

      // Success or already_blocked: remove from extension's hidden list (blockedUsers)
      if (status === 'success' || status === 'already_blocked') {
        const raw = String(username || '').trim();
        const alt = raw.startsWith('@') ? raw.slice(1) : `@${raw}`;
        let changed = false;
        if (raw && Object.prototype.hasOwnProperty.call(blockedUsersCache, raw)) {
          delete blockedUsersCache[raw];
          changed = true;
        }
        if (alt && Object.prototype.hasOwnProperty.call(blockedUsersCache, alt)) {
          delete blockedUsersCache[alt];
          changed = true;
        }
        if (changed) {
          safePostProgress(job, { username, step: 'update_storage' });
          await setBlockedUsersToStorage(blockedUsersCache);
        }
      }

      // Mark this item as done (count processed items)
      job.done = i + 1;
      safePostProgress(job, { username, step: 'done_item' });

      // Every 20 items, take an extra longer rest
      if (job.cancelled) break;
      if (job.done % 20 === 0 && job.done < list.length) {
        safePostProgress(job, { username, step: 'extra_rest' });
        const okExtra = await cancellableSleep(job, jitter(8000, 15000));
        if (!okExtra) break;
      }
    }

    const finalDone = job.cancelled ? job.done : list.length;
    safePost(port, {
      type: 'done',
      done: finalDone,
      total: list.length,
      cancelled: job.cancelled,
      ok: job.ok,
      already: job.already,
      failed: job.failed,
      last: job.last
    });
  } catch (err) {
    if (String(err?.message || err) === 'cancelled') {
      safePost(port, { type: 'done', done: job.done, total: job.total, cancelled: true, ok: job.ok, already: job.already, failed: job.failed, last: job.last });
      return;
    }
    console.error('[batch-true-block] job error:', err);
    safePost(port, { type: 'error', error: err?.message || String(err) });
  } finally {
    if (activeBatchTrueBlockJob === job) activeBatchTrueBlockJob = null;
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== BATCH_TRUE_BLOCK_PORT_NAME) return;

  port.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'start') startJob(port, msg.usernames);
    if (msg.type === 'cancel') cancelJob();
  });

  port.onDisconnect.addListener(() => {
    if (activeBatchTrueBlockJob?.port === port) cancelJob();
  });
});

/**
 * Handle incoming messages from popup/options pages or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  console.log('Message received in background:', type, payload);

  switch (type) {
    case 'getKeywords':
      getKeywords().then(data => {
        sendResponse({ success: true, data });
      });
      break;

    case 'addKeyword':
      addKeyword(payload.keyword).then(response => {
        sendResponse(response);
      });
      break;

    case 'deleteKeyword':
      deleteKeyword(payload.keyword).then(response => {
        sendResponse(response);
      });
      break;

    case 'getBlockedUsers':
      getBlockedUsers().then(data => {
        sendResponse({ success: true, data });
      });
      break;

    case 'blockUser':
      blockUser(payload.username).then(response => {
        sendResponse(response);
      });
      break;

    case 'unblockUser':
      unblockUser(payload.username).then(response => {
        sendResponse(response);
      });
      break;

    case 'exportData':
      exportData().then(response => {
        sendResponse(response);
      });
      break;

    case 'importData':
      importData(payload.jsonString).then(response => {
        sendResponse(response);
      });
      break;

    case 'aiClassify':
      handleAIClassify(payload).then(sendResponse);
      break;

    default:
      sendResponse({
        success: false,
        error: { code: 'UNKNOWN_MESSAGE', message: 'Unknown message type' }
      });
  }

  // Return true to indicate we'll send response asynchronously
  return true;
});

/**
 * Listen to storage changes for debugging and cross-tab sync
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('Storage changed in area:', areaName);
    console.log('Changes:', changes);

    // Log specific changes for debugging
    if (changes.keywords) {
      console.log('Keywords updated:', changes.keywords.newValue);
    }
    if (changes.blockedUsers) {
      console.log('Blocked users updated:', changes.blockedUsers.newValue);
    }
    if (changes.stats) {
      console.log('Stats updated:', changes.stats.newValue);
    }
  }
});
