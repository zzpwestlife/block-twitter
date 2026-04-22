/**
 * block-twitter Content Script
 * Runs on X/Twitter pages to detect keywords, highlight users, and block posts
 */

// ============================================================================
// 1. KeywordMatcher - Detect keywords in text with word boundary matching
// ============================================================================

class KeywordMatcher {
  /**
   * Match text against an array of keywords
   * @param {string} text - The text to search in
   * @param {string[]} keywords - Array of keywords to match
   * @returns {string[]} Array of matched keywords (complete word match, case-insensitive)
   */
  static match(text, keywords) {
    if (!text || !keywords || keywords.length === 0) {
      return [];
    }

    const lowercaseText = text.toLowerCase();
    const matched = [];

    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== 'string') continue;

      const lowercaseKeyword = keyword.toLowerCase();

      // Check if keyword contains CJK (Chinese, Japanese, Korean) characters
      const isCJK = /[一-鿿぀-ゟ゠-ヿ가-힯]/.test(lowercaseKeyword);

      let matches = false;
      if (isCJK) {
        // For CJK text, use simple substring matching (no word boundaries in CJK)
        matches = lowercaseText.includes(lowercaseKeyword);
      } else {
        // For English/other languages, use word boundary matching
        const regex = new RegExp(`\\b${this.escapeRegex(lowercaseKeyword)}\\b`, 'gi');
        matches = regex.test(lowercaseText);
      }

      if (matches) {
        // Avoid duplicates
        if (!matched.includes(keyword)) {
          matched.push(keyword);
        }
      }
    }

    return matched;
  }

  /**
   * Escape special regex characters
   * @private
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// 2. DOMScanner - Monitor DOM for new posts using MutationObserver
// ============================================================================

class DOMScanner {
  constructor(onPostAdded) {
    this.onPostAdded = onPostAdded;
    this.observer = null;
    this.processedPosts = new WeakSet();
    // Multiple fallback selectors for finding posts
    this.postSelectors = [
      'article[data-testid="tweet"]', // Most specific X.com post selector
      'article[role="article"]', // Fallback with role
      'article', // Generic article tag
      '[data-testid="tweet"]', // Data attribute only
      '[role="article"]' // Role attribute only
    ];
  }

  /**
   * Start monitoring DOM for new posts
   */
  startMonitoring() {
    try {
      const config = {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      };

      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });

      // Start observing the document body
      if (document.body) {
        this.observer.observe(document.body, config);
        console.log('[block-twitter] DOMScanner started monitoring');
      } else {
        // Fallback: wait for body to load
        document.addEventListener('DOMContentLoaded', () => {
          this.observer.observe(document.body, config);
          console.log('[block-twitter] DOMScanner started monitoring (after DOMContentLoaded)');
        });
      }

      // Also scan existing posts on initial load
      // Add delay to ensure DOM is ready (X.com loads content dynamically)
      setTimeout(() => {
        this.scanExistingPosts();
        this.logSelectorDebugInfo();
      }, 2000);
    } catch (error) {
      console.error('[block-twitter] Error starting DOMScanner:', error);
    }
  }

  /**
   * Log debug info about which selectors find posts
   * @private
   */
  logSelectorDebugInfo() {
    console.log('[block-twitter] Selector debug info:');
    for (const selector of this.postSelectors) {
      try {
        const count = document.querySelectorAll(selector).length;
        console.log(`  ${selector}: ${count} elements`);
      } catch (e) {
        console.log(`  ${selector}: ERROR (${e.message})`);
      }
    }
  }

  /**
   * Stop monitoring DOM
   */
  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('[block-twitter] DOMScanner stopped monitoring');
    }
  }

  /**
   * Handle mutation events and find new posts
   * @private
   */
  handleMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check added nodes for post elements
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.scanNode(node);
          }
        });
      }
    }
  }

  /**
   * Scan a node and its descendants for posts
   * @private
   */
  scanNode(node) {
    try {
      // Check if the node itself is a post
      if (this.isPost(node)) {
        this.processPost(node);
      }

      // Check children for posts
      const posts = this.findPosts(node);
      posts.forEach((post) => this.processPost(post));
    } catch (error) {
      console.error('[block-twitter] Error scanning node:', error);
    }
  }

  /**
   * Check if a node is a post element
   * @private
   */
  isPost(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    for (const selector of this.postSelectors) {
      try {
        if (node.matches && node.matches(selector)) {
          return true;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return false;
  }

  /**
   * Find all posts within a node
   * @private
   */
  findPosts(node) {
    const posts = [];
    for (const selector of this.postSelectors) {
      try {
        const found = node.querySelectorAll(selector);
        posts.push(...found);
      } catch (e) {
        // Invalid selector, skip
      }
    }
    // Remove duplicates
    return [...new Set(posts)];
  }

  /**
   * Process a post element
   * @private
   */
  processPost(post) {
    // Avoid processing the same post twice
    if (this.processedPosts.has(post)) {
      return;
    }

    this.processedPosts.add(post);

    try {
      if (this.onPostAdded) {
        this.onPostAdded(post);
      }
    } catch (error) {
      console.error('[block-twitter] Error processing post:', error);
    }
  }

  /**
   * Scan for existing posts on initial page load
   * @private
   */
  scanExistingPosts() {
    try {
      const posts = this.findPosts(document);
      posts.forEach((post) => this.processPost(post));
      console.log(`[block-twitter] Initial scan found ${posts.length} posts`);
    } catch (error) {
      console.error('[block-twitter] Error scanning existing posts:', error);
    }
  }
}

// ============================================================================
// 3. UserHighlighter - Mark detected users with UI indicators
// ============================================================================

class UserHighlighter {
  constructor() {
    this.highlightedPosts = new WeakMap();
    this.selectedUsernames = new Set();       // tracks checked usernames for batch operations
    this.onSelectionChanged = null;           // callback when selection changes
  }

  /**
   * Highlight a post with matched keywords
   * @param {Element} postElement - The post DOM element
   * @param {string} username - The username (e.g., "@username")
   * @param {string[]} matchedKeywords - Array of keywords that matched
   */
  highlight(postElement, username, matchedKeywords) {
    if (!postElement || !username || !matchedKeywords || matchedKeywords.length === 0) {
      return;
    }

    try {
      // Avoid highlighting the same post twice
      if (this.highlightedPosts.has(postElement)) {
        return;
      }

      // Find the username element in the post
      const usernameElement = this.findUsernameElement(postElement, username);
      if (!usernameElement) {
        console.warn(`[block-twitter] Could not find username element for ${username}`);
        return;
      }

      // Create and insert the indicator badge
      const indicatorBadge = this.createIndicatorBadge(matchedKeywords);
      usernameElement.parentElement?.insertBefore(indicatorBadge, usernameElement.nextSibling);

      // Create and insert the block button
      const blockButton = this.createBlockButton(username);
      indicatorBadge.parentElement?.insertBefore(blockButton, indicatorBadge.nextSibling);

      // Create and insert selection checkbox for batch operations
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'bt-select-checkbox';
      checkbox.dataset.username = username;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedUsernames.add(username);
        } else {
          this.selectedUsernames.delete(username);
        }
        if (this.onSelectionChanged) {
          this.onSelectionChanged();
        }
      });
      usernameElement.parentElement?.insertBefore(checkbox, indicatorBadge);

      // Mark this post as highlighted
      this.highlightedPosts.set(postElement, { username, matchedKeywords });

      // Add a data attribute for CSS styling
      postElement.setAttribute('data-keyword-matched', 'true');
      postElement.classList.add('bt-keyword-matched');

      console.log(`[block-twitter] Highlighted ${username} for keywords: ${matchedKeywords.join(', ')}`);
    } catch (error) {
      console.error('[block-twitter] Error highlighting post:', error);
    }
  }

  /**
   * Find the username element within a post
   * @private
   */
  findUsernameElement(postElement, username) {
    try {
      // Try multiple selectors for username
      const selectors = [
        '[data-testid="User-Name"]',
        'a[href*="/"]', // Twitter profile links usually contain username
        '.css-1jxf684', // Common Twitter username class
        'span'
      ];

      for (const selector of selectors) {
        try {
          const elements = postElement.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && text.includes(username.replace('@', ''))) {
              return element;
            }
          }
        } catch (e) {
          // Selector failed, try next one
        }
      }

      // Fallback: find any element containing the username
      const walker = document.createTreeWalker(
        postElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes(username.replace('@', ''))) {
          return node.parentElement;
        }
      }

      return null;
    } catch (error) {
      console.error('[block-twitter] Error finding username element:', error);
      return null;
    }
  }

  /**
   * Create an indicator badge showing matched keywords
   * @private
   */
  createIndicatorBadge(keywords) {
    const badge = document.createElement('span');
    badge.className = 'bt-indicator-badge';
    badge.setAttribute('data-keywords', keywords.join(', '));
    badge.title = `Matched keywords: ${keywords.join(', ')}`;
    badge.textContent = `⚠ ${keywords.length} keyword${keywords.length > 1 ? 's' : ''}`;
    badge.style.cssText = `
      display: inline-block;
      margin-left: 8px;
      padding: 4px 8px;
      background-color: #ff9800;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    `;

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      // Show tooltip with keywords
      const tooltip = document.createElement('div');
      tooltip.className = 'bt-keyword-tooltip';
      tooltip.textContent = keywords.join(', ');
      tooltip.style.cssText = `
        position: absolute;
        background-color: #333;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        white-space: nowrap;
        margin-top: 4px;
      `;
      badge.parentElement?.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 3000);
    });

    return badge;
  }

  /**
   * Create a block button for the user
   * @private
   */
  createBlockButton(username) {
    const button = document.createElement('button');
    button.className = 'bt-block-button';
    button.textContent = 'Block User';
    button.setAttribute('data-username', username);
    button.type = 'button';
    button.style.cssText = `
      display: inline-block;
      margin-left: 8px;
      padding: 4px 12px;
      background-color: #e53935;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.2s;
    `;

    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#c62828';
    });

    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#e53935';
    });

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        // Disable button to prevent double-clicks
        button.disabled = true;
        button.textContent = 'Blocking...';

        // Call BlockingManager to handle the blocking
        await window.blockingManager?.blockUser(username);

        button.textContent = 'Blocked!';
        button.style.backgroundColor = '#4caf50';
        setTimeout(() => {
          button.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('[block-twitter] Error blocking user:', error);
        button.disabled = false;
        button.textContent = 'Block User';
      }
    });

    return button;
  }

  /**
   * Select all matched posts for batch operations
   */
  selectAll() {
    const checkboxes = document.querySelectorAll('.bt-select-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      this.selectedUsernames.add(checkbox.dataset.username);
    });
    if (this.onSelectionChanged) {
      this.onSelectionChanged();
    }
  }

  /**
   * Clear all selections
   */
  clearAll() {
    const checkboxes = document.querySelectorAll('.bt-select-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    this.selectedUsernames.clear();
    if (this.onSelectionChanged) {
      this.onSelectionChanged();
    }
  }

  /**
   * Get array of currently selected usernames
   */
  getSelected() {
    return Array.from(this.selectedUsernames);
  }
}

// ============================================================================
// 4. BatchBlockToolbar - Floating toolbar for batch blocking operations
// ============================================================================

class BatchBlockToolbar {
  constructor(highlighter, blockingManager) {
    this.highlighter = highlighter;
    this.blockingManager = blockingManager;
    this.toolbar = null;
    this.countLabel = null;
  }

  /**
   * Create and render the floating toolbar
   */
  render() {
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'bt-batch-toolbar';
    this.toolbar.className = 'bt-batch-toolbar';
    this.toolbar.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1d1f23;
      color: white;
      border-radius: 12px;
      padding: 12px 20px;
      display: none;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // Count label
    this.countLabel = document.createElement('span');
    this.countLabel.className = 'bt-batch-count';
    this.countLabel.style.cssText = 'font-weight: 600; font-size: 14px;';
    this.toolbar.appendChild(this.countLabel);

    // Select All button
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'bt-batch-select-all';
    selectAllBtn.style.cssText = `
      background: transparent;
      color: #60a5fa;
      border: 1px solid #60a5fa;
      border-radius: 6px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    `;
    selectAllBtn.addEventListener('click', () => {
      this.highlighter.selectAll();
    });
    this.toolbar.appendChild(selectAllBtn);
    this.selectAllBtn = selectAllBtn;

    // Block All button
    const blockAllBtn = document.createElement('button');
    blockAllBtn.className = 'bt-batch-block-btn';
    blockAllBtn.textContent = '屏蔽所有选中';
    blockAllBtn.style.cssText = `
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    `;
    blockAllBtn.addEventListener('click', () => {
      this.blockAll();
    });
    this.toolbar.appendChild(blockAllBtn);

    document.body.appendChild(this.toolbar);
  }

  /**
   * Update toolbar visibility and count label
   */
  update() {
    if (!this.toolbar) return;

    const selectedCount = this.highlighter.selectedUsernames.size;
    const totalCount = document.querySelectorAll('.bt-select-checkbox').length;

    if (selectedCount === 0) {
      this.toolbar.style.display = 'none';
    } else {
      this.toolbar.style.display = 'flex';
      this.countLabel.textContent = `已选择 ${selectedCount} 个用户`;
      this.selectAllBtn.textContent = `全选 (${totalCount})`;
    }
  }

  /**
   * Block all selected users
   */
  async blockAll() {
    const selected = this.highlighter.getSelected();
    if (selected.length === 0) return;

    const count = selected.length;
    console.log(`[block-twitter] Batch blocking ${count} users:`, selected);

    try {
      // Block all in parallel
      await Promise.all(selected.map(username => this.blockingManager.blockUser(username)));

      // Show success message
      this.showToast(`已屏蔽 ${count} 个用户`);

      // Clear selection
      this.highlighter.clearAll();
      this.update();
    } catch (error) {
      console.error('[block-twitter] Error batch blocking:', error);
      this.showToast('屏蔽失败，请重试', 'error');
    }
  }

  /**
   * Show toast notification
   * @private
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#16a34a' : '#dc2626'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 99998;
      animation: fadeInOut 2s ease-in-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }
}

// ============================================================================
// 5. BlockingManager - Hide/show posts based on blocked user list
// ============================================================================

class BlockingManager {
  constructor() {
    this.blockedUsers = {};
    this.cssStyleElement = null;
    this.initializeStyles();
  }

  /**
   * Initialize the CSS for blocking
   * @private
   */
  initializeStyles() {
    try {
      if (!this.cssStyleElement) {
        this.cssStyleElement = document.createElement('style');
        this.cssStyleElement.id = 'bt-blocking-styles';
        this.cssStyleElement.textContent = `
          /* Blocked post hiding */
          [data-bt-blocked="true"] {
            display: none !important;
          }

          /* Visual indicators */
          .bt-keyword-matched {
            border-left: 3px solid #ff9800;
            padding-left: 12px;
          }

          .bt-indicator-badge {
            display: inline-block;
            margin-left: 8px;
          }

          .bt-block-button {
            display: inline-block;
            margin-left: 8px;
          }

          .bt-keyword-tooltip {
            position: absolute;
            background-color: #333;
            color: white;
            z-index: 10000;
          }
        `;
        document.head.appendChild(this.cssStyleElement);
        console.log('[block-twitter] Blocking styles initialized');
      }
    } catch (error) {
      console.error('[block-twitter] Error initializing styles:', error);
    }
  }

  /**
   * Initialize the blocking manager
   * Load blocked users from storage and listen for changes
   */
  async initialize() {
    try {
      // Load initial blocked users from storage
      const result = await this.loadBlockedUsers();
      this.blockedUsers = result.blockedUsers || {};

      // Apply blocking to already existing posts on page
      this.applyBlockingToCurrentPage();

      // Listen for storage changes
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.blockedUsers) {
          this.onStorageChanged(changes.blockedUsers);
        }
      });

      console.log('[block-twitter] BlockingManager initialized with', Object.keys(this.blockedUsers).length, 'blocked users');
    } catch (error) {
      console.error('[block-twitter] Error initializing BlockingManager:', error);
    }
  }

  /**
   * Apply blocking to all currently visible posts on the page
   * @private
   */
  applyBlockingToCurrentPage() {
    try {
      const postSelectors = [
        'article[data-testid="tweet"]',
        'article[role="article"]',
        'article',
        '[data-testid="tweet"]',
        '[role="article"]'
      ];

      for (const username of Object.keys(this.blockedUsers)) {
        this.hidePostsFromUser(username);
      }

      console.log('[block-twitter] Applied blocking to', Object.keys(this.blockedUsers).length, 'blocked users on current page');
    } catch (error) {
      console.error('[block-twitter] Error applying blocking to page:', error);
    }
  }

  /**
   * Load blocked users from chrome.storage
   * @private
   */
  loadBlockedUsers() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['blockedUsers'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[block-twitter] Storage error:', chrome.runtime.lastError);
            resolve({ blockedUsers: {} });
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        console.error('[block-twitter] Error loading blocked users:', error);
        resolve({ blockedUsers: {} });
      }
    });
  }

  /**
   * Block a user and hide their posts
   * @param {string} username - The username to block (e.g., "@username")
   */
  async blockUser(username) {
    try {
      if (!username) return;

      // Normalize username (remove @ if present)
      const normalizedUsername = username.startsWith('@') ? username : `@${username}`;

      // Add to blocked users
      this.blockedUsers[normalizedUsername] = Date.now();

      // Save to storage
      await this.saveBlockedUsers();

      // Hide all posts from this user
      this.hidePostsFromUser(normalizedUsername);

      console.log(`[block-twitter] Blocked user: ${normalizedUsername}`);
    } catch (error) {
      console.error('[block-twitter] Error blocking user:', error);
      throw error;
    }
  }

  /**
   * Unblock a user and show their posts
   * @param {string} username - The username to unblock
   */
  async unblockUser(username) {
    try {
      if (!username) return;

      // Normalize username
      const normalizedUsername = username.startsWith('@') ? username : `@${username}`;

      // Remove from blocked users
      delete this.blockedUsers[normalizedUsername];

      // Save to storage
      await this.saveBlockedUsers();

      // Show posts from this user
      this.showPostsFromUser(normalizedUsername);

      console.log(`[block-twitter] Unblocked user: ${normalizedUsername}`);
    } catch (error) {
      console.error('[block-twitter] Error unblocking user:', error);
      throw error;
    }
  }

  /**
   * Save blocked users to chrome.storage
   * @private
   */
  saveBlockedUsers() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ blockedUsers: this.blockedUsers }, () => {
          if (chrome.runtime.lastError) {
            console.error('[block-twitter] Storage error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('[block-twitter] Error saving blocked users:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle storage changes from other tabs/popup
   * @private
   */
  onStorageChanged(blockedUsersChange) {
    try {
      const newBlockedUsers = blockedUsersChange.newValue || {};
      const oldBlockedUsers = blockedUsersChange.oldValue || {};

      // Find newly blocked users
      for (const username of Object.keys(newBlockedUsers)) {
        if (!oldBlockedUsers.hasOwnProperty(username)) {
          this.hidePostsFromUser(username);
        }
      }

      // Find unblocked users
      for (const username of Object.keys(oldBlockedUsers)) {
        if (!newBlockedUsers.hasOwnProperty(username)) {
          this.showPostsFromUser(username);
        }
      }

      this.blockedUsers = newBlockedUsers;
      console.log('[block-twitter] Blocked users updated:', Object.keys(newBlockedUsers).length);
    } catch (error) {
      console.error('[block-twitter] Error handling storage change:', error);
    }
  }

  /**
   * Hide all posts from a user
   * @private
   */
  hidePostsFromUser(username) {
    try {
      const posts = document.querySelectorAll('article, [data-testid="Tweet"], [data-testid="tweet"], .tweet, [role="article"]');
      let hiddenCount = 0;

      posts.forEach((post) => {
        if (this.isPostByUser(post, username)) {
          post.setAttribute('data-bt-blocked', 'true');
          post.style.display = 'none';
          hiddenCount++;
        }
      });

      console.log(`[block-twitter] Hidden ${hiddenCount} posts from ${username}`);
    } catch (error) {
      console.error('[block-twitter] Error hiding posts from user:', error);
    }
  }

  /**
   * Show posts from a user
   * @private
   */
  showPostsFromUser(username) {
    try {
      const posts = document.querySelectorAll('[data-bt-blocked="true"]');
      let shownCount = 0;

      posts.forEach((post) => {
        if (this.isPostByUser(post, username)) {
          post.removeAttribute('data-bt-blocked');
          post.style.display = '';
          shownCount++;
        }
      });

      console.log(`[block-twitter] Shown ${shownCount} posts from ${username}`);
    } catch (error) {
      console.error('[block-twitter] Error showing posts from user:', error);
    }
  }

  /**
   * Check if a post is by a specific user
   * @private
   */
  isPostByUser(postElement, username) {
    try {
      const usernameText = username.replace('@', '').toLowerCase();

      // Try to find username in post element
      const text = postElement.textContent?.toLowerCase() || '';

      // Look for username patterns in the text
      // Twitter usernames are preceded by @ or appear in profile links
      const patterns = [
        new RegExp(`@${usernameText}`, 'i'),
        new RegExp(`\\b${usernameText}\\b`, 'i')
      ];

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return true;
        }
      }

      // Also check links to the user's profile
      const profileLinks = postElement.querySelectorAll('a[href*="/"]');
      for (const link of profileLinks) {
        if (link.href.includes(`/${usernameText}`) || link.textContent?.toLowerCase().includes(usernameText)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[block-twitter] Error checking post author:', error);
      return false;
    }
  }
}

// ============================================================================
// 5. Main Content Script Initialization
// ============================================================================

class ContentScriptManager {
  constructor() {
    this.keywords = [];
    this.scanner = null;
    this.highlighter = null;
    this.blockingManager = null;
  }

  /**
   * Initialize the content script
   */
  async initialize() {
    try {
      console.log('[block-twitter] Initializing content script...');

      // Initialize components
      this.highlighter = new UserHighlighter();
      this.blockingManager = new BlockingManager();
      await this.blockingManager.initialize();

      // Make blocking manager globally accessible for the block button
      window.blockingManager = this.blockingManager;

      // Load keywords from storage
      await this.loadKeywords();

      // Listen for keyword updates
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.keywords) {
          this.onKeywordsChanged(changes.keywords);
        }
      });

      // Initialize DOM scanner
      this.scanner = new DOMScanner((postElement) => {
        this.processPost(postElement);
      });
      this.scanner.startMonitoring();

      // Initialize batch block toolbar
      this.toolbar = new BatchBlockToolbar(this.highlighter, this.blockingManager);
      this.highlighter.onSelectionChanged = () => this.toolbar.update();
      this.toolbar.render();

      // Setup message listener for popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          if (request.action === 'getBlockedCount') {
            const blockedPosts = document.querySelectorAll('[data-bt-blocked="true"]').length;
            sendResponse({ blockedCount: blockedPosts });
          }
        } catch (error) {
          console.error('[block-twitter] Error handling message:', error);
        }
      });

      console.log('[block-twitter] Content script initialized successfully');
    } catch (error) {
      console.error('[block-twitter] Error initializing content script:', error);
    }
  }

  /**
   * Load keywords from storage
   * @private
   */
  loadKeywords() {
    return new Promise((resolve) => {
      try {
        console.log('[block-twitter] Attempting to load keywords from storage...');
        chrome.storage.local.get(['keywords'], (result) => {
          console.log('[block-twitter] Storage callback received, result:', result);
          if (chrome.runtime.lastError) {
            console.error('[block-twitter] Storage error:', chrome.runtime.lastError);
            this.keywords = [];
          } else {
            this.keywords = result.keywords || [];
            console.log('[block-twitter] Keywords from storage:', this.keywords);
          }
          console.log(`[block-twitter] Loaded ${this.keywords.length} keywords (${this.keywords.join(', ')})`);
          resolve();
        });
      } catch (error) {
        console.error('[block-twitter] Error loading keywords:', error);
        this.keywords = [];
        resolve();
      }
    });
  }

  /**
   * Handle keyword storage changes
   * @private
   */
  onKeywordsChanged(keywordsChange) {
    try {
      this.keywords = keywordsChange.newValue || [];
      console.log(`[block-twitter] Keywords updated: ${this.keywords.length} keywords`);

      // Re-scan all posts with new keywords
      this.rescanAllPosts();
    } catch (error) {
      console.error('[block-twitter] Error handling keyword change:', error);
    }
  }

  /**
   * Process a post element
   * @private
   */
  processPost(postElement) {
    try {
      if (!this.keywords || this.keywords.length === 0) {
        console.log('[block-twitter] Skipping post: no keywords loaded');
        return;
      }

      // Extract text content from post
      const postText = postElement.textContent || '';

      // Check if post matches any keywords
      const matchedKeywords = KeywordMatcher.match(postText, this.keywords);

      if (matchedKeywords.length > 0) {
        console.log('[block-twitter] Found matching keywords:', matchedKeywords);
        // Find username in post
        const username = this.extractUsername(postElement);
        if (username) {
          console.log(`[block-twitter] Highlighting post from ${username} for keywords: ${matchedKeywords.join(', ')}`);
          // Highlight the post
          this.highlighter.highlight(postElement, username, matchedKeywords);
        } else {
          console.log('[block-twitter] Could not extract username from post');
        }
      }
    } catch (error) {
      console.error('[block-twitter] Error processing post:', error);
    }
  }

  /**
   * Extract username from a post element
   * @private
   */
  extractUsername(postElement) {
    try {
      // Try multiple selectors for username
      const selectors = [
        '[data-testid="User-Name"]',
        'a[href*="/"]',
        '.css-1jxf684'
      ];

      for (const selector of selectors) {
        try {
          const elements = postElement.querySelectorAll(selector);
          for (const element of elements) {
            let text = element.textContent?.trim() || '';
            // Check if it looks like a username
            if (text && (text.startsWith('@') || text.match(/^[a-zA-Z0-9_]+$/))) {
              return text.startsWith('@') ? text : `@${text}`;
            }
          }
        } catch (e) {
          // Selector failed, try next
        }
      }

      // Fallback: look for username pattern in links
      const links = postElement.querySelectorAll('a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/(@?[a-zA-Z0-9_]+)\b/);
        if (match) {
          return match[1].startsWith('@') ? match[1] : `@${match[1]}`;
        }
      }

      return null;
    } catch (error) {
      console.error('[block-twitter] Error extracting username:', error);
      return null;
    }
  }

  /**
   * Rescan all posts with current keywords
   * @private
   */
  rescanAllPosts() {
    try {
      const posts = document.querySelectorAll('article, [data-testid="Tweet"], [data-testid="tweet"], .tweet, [role="article"]');
      console.log(`[block-twitter] Rescanning ${posts.length} posts with updated keywords`);

      posts.forEach((post) => {
        // Reset the highlighter's tracking for this post if needed
        this.processPost(post);
      });
    } catch (error) {
      console.error('[block-twitter] Error rescanning posts:', error);
    }
  }
}

// ============================================================================
// 6. Start the content script when DOM is ready
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new ContentScriptManager();
    manager.initialize();
  });
} else {
  // DOM is already loaded
  const manager = new ContentScriptManager();
  manager.initialize();
}

// Export for testing/debugging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KeywordMatcher,
    DOMScanner,
    UserHighlighter,
    BlockingManager,
    ContentScriptManager
  };
}
