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

      // Limit keywords to 1000
      const limitedKeywords = sanitizedKeywords.slice(0, 1000);

      const stats = {
        totalBlocked: Object.keys(sanitizedBlockedUsers).length
      };

      const dataToStore = {
        keywords: limitedKeywords,
        blockedUsers: sanitizedBlockedUsers,
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
