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

      // For non-ASCII characters (CJK, emoji, etc.), use simple substring matching.
      // \b word boundaries only work for ASCII [a-zA-Z0-9_] and will never fire
      // around emoji or CJK characters (all are \W), causing silent misses.
      const hasNonAscii = /[^\x00-\x7F]/.test(keyword);

      let matches = false;
      if (hasNonAscii) {
        // Normalize both sides before comparing:
        // 1. Strip invisible/obfuscation Unicode that spammers insert between emoji
        //    to defeat keyword matching (e.g. Tibetan combining vowels U+0F00-0FFF,
        //    zero-width spaces, variation selectors, combining diacriticals).
        //    ZWJ U+200D is kept to preserve compound emoji like 👨‍👩‍👧‍👦.
        // 2. Normalize whitespace around newlines (Twitter <br> may have surrounding spaces).
        // Strip invisible obfuscation characters that spammers insert between emoji
        // to defeat keyword matching. ZWJ (U+200D) is kept for compound emoji (👨‍👩‍👧‍👦).
        // Ranges stripped:
        //   U+0300-U+036F  Combining diacritical marks
        //   U+0F00-U+0FFF  Tibetan block (U+0F74, U+0F80 used as invisible separators)
        //   U+200B         Zero-width space
        //   U+200C         Zero-width non-joiner (ZWNJ)
        //   U+200E-U+200F  LTR / RTL marks
        //   U+2060-U+206F  Word joiner and other invisible format chars
        //   U+FE00-U+FE0F  Variation selectors 1-16
        const stripObfuscation = (s) => s.replace(
          /[̀-ͯༀ-࿿​‌‎‏⁠-⁯︀-️]/g,
          ''
        );
        const normalize = (s) =>
          stripObfuscation(s).replace(/[^\S\n]*\n[^\S\n]*/g, '\n');
        matches = normalize(lowercaseText).includes(normalize(lowercaseKeyword));
      } else {
        // For pure ASCII keywords, use word boundary matching
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
   * Extract full text from a post element, including emoji rendered as <img alt="...">
   * X/Twitter converts emoji characters to <img> tags; textContent misses them.
   */
  static extractPostText(element) {
    let text = '';
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeName === 'IMG' && node.alt) {
        text += node.alt;
      } else if (node.nodeName === 'BR') {
        text += '\n';
      } else {
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    };
    walk(element);
    return text;
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
    this.postByUsername = new Map();   // username → postElement for batch dismiss
    this.matchedUsernames = new Set(); // all matched usernames seen in this tab session (deduped)
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

      // Track all matched usernames (deduped) so "全选" / counts can work across infinite scroll
      this.matchedUsernames.add(username);

      // Create and insert the indicator badge
      const indicatorBadge = this.createIndicatorBadge(matchedKeywords);
      usernameElement.parentElement?.insertBefore(indicatorBadge, usernameElement.nextSibling);

      // Create and insert the block button
      const blockButton = this.createBlockButton(username);
      indicatorBadge.parentElement?.insertBefore(blockButton, indicatorBadge.nextSibling);

      // Create and insert the true block button (X native)
      const trueBlockButton = this.createTrueBlockButton(username, postElement);
      blockButton.parentElement?.insertBefore(trueBlockButton, blockButton.nextSibling);

      // Create and insert selection checkbox for batch operations
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'bt-select-checkbox';
      checkbox.dataset.username = username;
      // If user selected this username on a previous "page" (older tweets), reflect it on newly loaded posts
      checkbox.checked = this.selectedUsernames.has(username);
      if (checkbox.checked) this.selectedUsernames.add(username);
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

      // Create and insert dismiss (false-positive) button
      const dismissButton = this.createDismissButton(username, postElement);
      trueBlockButton.parentElement?.insertBefore(dismissButton, trueBlockButton.nextSibling);

      // Mark this post as highlighted
      this.highlightedPosts.set(postElement, { username, matchedKeywords });
      this.postByUsername.set(username, postElement);

      // Add a data attribute for CSS styling
      postElement.setAttribute('data-keyword-matched', 'true');
      postElement.classList.add('bt-keyword-matched');

      console.log(`[block-twitter] Highlighted ${username} for keywords: ${matchedKeywords.join(', ')}`);

      // If the batch toolbar is already visible (has selections), refresh counts as new posts load.
      // Avoid doing extra work when nothing is selected.
      if (this.onSelectionChanged && this.selectedUsernames.size > 0) {
        this.onSelectionChanged();
      }
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
    button.textContent = 'Hide User';
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
        button.textContent = 'Hiding...';

        // Call BlockingManager to handle the blocking
        await window.blockingManager?.blockUser(username);

        button.textContent = 'Hidden!';
        button.style.backgroundColor = '#4caf50';
        setTimeout(() => {
          button.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('[block-twitter] Error hiding user:', error);
        button.disabled = false;
        button.textContent = 'Hide User';
      }
    });

    return button;
  }

  /**
   * Create a true block button that triggers X's native block flow
   * @private
   */
  createTrueBlockButton(username, postElement) {
    const button = document.createElement('button');
    button.className = 'bt-true-block-button';
    button.textContent = '🚫 屏蔽(X)';
    button.dataset.username = username;
    button.type = 'button';
    button.style.cssText = `
      display: inline-block;
      margin-left: 4px;
      padding: 4px 12px;
      background-color: #7f1d1d;
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
      if (!button.disabled) button.style.backgroundColor = '#991b1b';
    });

    button.addEventListener('mouseout', () => {
      if (!button.disabled) button.style.backgroundColor = '#7f1d1d';
    });

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      button.disabled = true;
      button.textContent = '屏蔽中...';
      button.style.opacity = '0.7';

      const ok = await TrueBlocker.block(postElement, username);
      if (ok) {
        button.textContent = '✓ 已屏蔽';
        button.style.backgroundColor = '#16a34a';
        button.style.opacity = '1';
        // Also apply local CSS hide
        window.blockingManager?.blockUser(username);
      } else {
        button.disabled = false;
        button.textContent = '🚫 屏蔽(X)';
        button.style.backgroundColor = '#7f1d1d';
        button.style.opacity = '1';
      }
    });

    return button;
  }

  /**
   * Add a small manual-classify button to every non-blocked post.
   * Shows a dropdown with "Mark as spam" / "Mark as false positive".
   */
  addManualClassifyButton(postElement, username) {
    if (postElement.hasAttribute('data-bt-manual-btn')) return;

    const usernameElement = this.findUsernameElement(postElement, username);
    if (!usernameElement) return;

    const btn = document.createElement('button');
    btn.className = 'bt-manual-classify-btn';
    btn.dataset.username = username;
    btn.textContent = '🚩';
    btn.type = 'button';
    btn.title = '手动标记';
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      padding: 1px 5px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #374151;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      vertical-align: middle;
      opacity: 0.4;
      transition: opacity 0.15s;
    `;

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.4'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showManualMenu(btn, postElement, username);
    });

    usernameElement.parentElement?.appendChild(btn);
    postElement.setAttribute('data-bt-manual-btn', 'true');
  }

  _showManualMenu(anchorBtn, postElement, username) {
    document.querySelectorAll('.bt-manual-menu').forEach(m => m.remove());

    const isFlagged = postElement.hasAttribute('data-keyword-matched');

    const menu = document.createElement('div');
    menu.className = 'bt-manual-menu';
    menu.style.cssText = `
      position: fixed;
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 4px 0;
      z-index: 100001;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      min-width: 150px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    `;

    const makeItem = (text, color, onClick) => {
      const item = document.createElement('div');
      item.textContent = text;
      item.style.cssText = `padding: 8px 14px; color: ${color}; cursor: pointer;`;
      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.06)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', (e) => { e.stopPropagation(); menu.remove(); onClick(); });
      return item;
    };

    menu.appendChild(makeItem('🚩 标记为垃圾', '#f87171', () => {
      if (!isFlagged) this.highlight(postElement, username, ['✋ 手动标记']);
      chrome.storage.local.get(['aiSpamUsers', 'falsePositiveUsers'], (data) => {
        const spam = data.aiSpamUsers || {};
        const fp = data.falsePositiveUsers || {};
        spam[username] = Date.now();
        delete fp[username];
        chrome.storage.local.set({ aiSpamUsers: spam, falsePositiveUsers: fp });
      });
    }));

    menu.appendChild(makeItem('✕ 标记为误报', '#9ca3af', () => {
      if (isFlagged) {
        this.dismissHighlight(postElement, username);
      } else {
        chrome.storage.local.get(['falsePositiveUsers', 'aiSpamUsers'], (data) => {
          const fp = data.falsePositiveUsers || {};
          const spam = data.aiSpamUsers || {};
          fp[username] = Date.now();
          delete spam[username];
          chrome.storage.local.set({ falsePositiveUsers: fp, aiSpamUsers: spam });
        });
      }
    }));

    document.body.appendChild(menu);

    const rect = anchorBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;

    const close = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorBtn) {
        menu.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  /**
   * Create a dismiss (false-positive) button for a highlighted post
   * @private
   */
  createDismissButton(username, postElement) {
    const button = document.createElement('button');
    button.className = 'bt-dismiss-button';
    button.textContent = '✕ 误报';
    button.dataset.username = username;
    button.type = 'button';
    button.style.cssText = `
      display: inline-block;
      margin-left: 4px;
      padding: 4px 10px;
      background-color: #374151;
      color: #d1d5db;
      border: 1px solid #4b5563;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.2s;
    `;
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = '#4b5563';
    });
    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = '#374151';
    });
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dismissHighlight(postElement, username);
    });
    return button;
  }

  /**
   * Remove AI highlight from a post (user marked as false positive)
   */
  dismissHighlight(postElement, username) {
    postElement.removeAttribute('data-keyword-matched');
    postElement.classList.remove('bt-keyword-matched');
    this.highlightedPosts.delete(postElement);
    this.postByUsername.delete(username);
    this.matchedUsernames.delete(username);
    this.selectedUsernames.delete(username);

    for (const cls of ['.bt-indicator-badge', '.bt-block-button', '.bt-true-block-button',
                       '.bt-select-checkbox', '.bt-manual-mark-btn', '.bt-dismiss-button']) {
      postElement.querySelectorAll(cls).forEach(el => el.remove());
    }
    if (this.onSelectionChanged) this.onSelectionChanged();

    // Remove from AI spam list and add to false-positive list (both persisted)
    chrome.storage.local.get(['aiSpamUsers', 'falsePositiveUsers'], (data) => {
      const spamUsers = data.aiSpamUsers || {};
      delete spamUsers[username];
      const fpUsers = data.falsePositiveUsers || {};
      fpUsers[username] = Date.now();
      chrome.storage.local.set({ aiSpamUsers: spamUsers, falsePositiveUsers: fpUsers });
    });
  }

  /**
   * Select all matched posts for batch operations
   */
  selectAll() {
    // Select all matched usernames we've seen in this tab session (not just currently mounted DOM nodes).
    // This fixes "翻页/滚动后全选不包含上一页" and makes counts stable & deduped by username.
    for (const username of this.matchedUsernames) {
      this.selectedUsernames.add(username);
    }

    // Reflect selection on currently visible checkboxes
    const checkboxes = document.querySelectorAll('.bt-select-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = true; });
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
    blockAllBtn.textContent = '隐藏所有选中';
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

    // True Block All button (X native, sequential)
    const trueBlockAllBtn = document.createElement('button');
    trueBlockAllBtn.className = 'bt-batch-true-block-btn';
    trueBlockAllBtn.textContent = '🚫 屏蔽所有(X)';
    trueBlockAllBtn.style.cssText = `
      background: #7f1d1d;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background-color 0.2s;
    `;
    trueBlockAllBtn.addEventListener('click', () => {
      this.trueBlockAll(trueBlockAllBtn);
    });
    this.toolbar.appendChild(trueBlockAllBtn);

    // Batch dismiss (false positive) button
    const dismissAllBtn = document.createElement('button');
    dismissAllBtn.className = 'bt-batch-dismiss-btn';
    dismissAllBtn.textContent = '✕ 标记为误报';
    dismissAllBtn.style.cssText = `
      background: #374151;
      color: #d1d5db;
      border: 1px solid #4b5563;
      border-radius: 6px;
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    `;
    dismissAllBtn.addEventListener('click', () => {
      this.dismissAll();
    });
    this.toolbar.appendChild(dismissAllBtn);

    document.body.appendChild(this.toolbar);
  }

  /**
   * Update toolbar visibility and count label
   */
  update() {
    if (!this.toolbar) return;

    const selectedCount = this.highlighter.selectedUsernames.size;
    // Use deduped usernames (not checkbox DOM count) to avoid duplicates + keep stable across infinite scroll "翻页"
    const totalCount =
      this.highlighter.matchedUsernames
        ? this.highlighter.matchedUsernames.size
        : new Set(Array.from(document.querySelectorAll('.bt-select-checkbox')).map(cb => cb.dataset.username)).size;

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

    const results = await Promise.allSettled(
      selected.map(username => this.blockingManager.blockUser(username))
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed === 0) {
      this.showToast(`已隐藏 ${count} 个用户`);
    } else if (failed < count) {
      this.showToast(`已隐藏 ${count - failed} / ${count} 个用户`);
    } else {
      this.showToast('隐藏失败，请重新加载页面后重试', 'error');
    }

    this.highlighter.clearAll();
    this.update();
  }

  /**
   * True block all selected users via X's native block flow (sequential)
   */
  async trueBlockAll(btn) {
    const selected = this.highlighter.getSelected();
    if (selected.length === 0) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = '屏蔽中...';
    }

    let ok = 0;
    let idx = 0;
    for (const username of selected) {
      idx++;
      if (btn) btn.textContent = `屏蔽中 ${idx}/${selected.length}...`;

      try {
        // Re-query each iteration — earlier blocks may have shifted the DOM.
        // Prefer [data-testid="tweet"] over bare article: bare article matches quoted-tweet
        // wrappers, which causes us to pick up the wrong (inner) caret button.
        const trueBlockBtn = document.querySelector(`.bt-true-block-button[data-username="${username}"]`);
        const postEl = trueBlockBtn?.closest('[data-testid="tweet"]')
                    ?? trueBlockBtn?.closest('article');

        if (!postEl) {
          console.warn('[block-twitter] Could not find post element for user:', username);
          continue;
        }

        let success = await TrueBlocker.block(postEl, username);

        // Single retry on failure — menu might not have rendered in time
        if (!success) {
          console.log('[block-twitter] Retrying block for:', username);
          await new Promise(r => setTimeout(r, 1000));
          success = await TrueBlocker.block(postEl, username);
        }

        if (success) {
          try {
            await this.blockingManager.blockUser(username);
            ok++;
            console.log('[block-twitter] Successfully blocked user:', username);
          } catch (err) {
            console.error('[block-twitter] Error saving blocked user:', username, err);
          }
        } else {
          console.warn('[block-twitter] Failed to block user (after retry):', username);
        }

        // Pause between users: let X process the block and reset UI state
        await new Promise(r => setTimeout(r, 1500));

        // Every 5 successful blocks take a longer break to avoid X rate-limiting
        if (ok > 0 && ok % 5 === 0) {
          console.log('[block-twitter] Rate-limit pause after', ok, 'blocks...');
          if (btn) btn.textContent = `暂停防限速 (${ok}/${selected.length})...`;
          await new Promise(r => setTimeout(r, 4000));
        }
      } catch (error) {
        console.error('[block-twitter] Error in batch block for user:', username, error);
        continue;
      }
    }

    this.showToast(`已屏蔽 ${ok}/${selected.length} 个用户（X 原生）`);
    this.highlighter.clearAll();
    this.update();

    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚫 屏蔽所有(X)';
    }
  }

  /**
   * Dismiss all selected posts as false positives
   */
  dismissAll() {
    const selected = this.highlighter.getSelected();
    if (selected.length === 0) return;

    for (const username of [...selected]) {
      const postEl = this.highlighter.postByUsername.get(username);
      if (postEl && document.contains(postEl)) {
        this.highlighter.dismissHighlight(postEl, username);
      } else {
        // Post element detached — clear state directly
        this.highlighter.postByUsername.delete(username);
        this.highlighter.selectedUsernames.delete(username);
      }
    }

    this.update();
    this.showToast(`已将 ${selected.length} 个用户标记为误报`);
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
// 5a. BlockingManager - Hide/show posts based on blocked user list
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
    if (!username) return;

    const normalizedUsername = username.startsWith('@') ? username : `@${username}`;

    // Update in-memory state and hide posts immediately — do this before any async work
    // so the UI responds even if storage save fails.
    this.blockedUsers[normalizedUsername] = Date.now();
    this.hidePostsFromUser(normalizedUsername);

    try {
      await this.saveBlockedUsers();
    } catch (error) {
      if (error?.message?.includes('Extension context invalidated')) {
        // Extension was reloaded in another tab — in-memory hide already applied, nothing more we can do.
        console.warn('[block-twitter] Extension context invalidated; block not persisted for:', normalizedUsername);
        return;
      }
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
// 5b. TrueBlocker - Automate X's native block flow via DOM interaction
// ============================================================================

class TrueBlocker {
  static async block(postElement, username) {
    try {
      // 1. Close any lingering menu/dialog from a previous operation
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
      }));
      await new Promise(r => setTimeout(r, 250));

      // 2. Scroll post into viewport — Twitter may virtualise off-screen articles
      postElement.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, 300));

      // 3. Simulate hover with real coordinates so Twitter's React handlers fire correctly
      const rect = postElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove']) {
        postElement.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, clientX: cx, clientY: cy
        }));
      }
      await new Promise(r => setTimeout(r, 300));

      // 4. Find the caret that belongs to THIS tweet, not to a nested quoted-tweet article.
      //    querySelectorAll returns DOM-order — the inner article's caret comes first,
      //    so we must skip any caret whose nearest article ancestor != postElement.
      let caret = TrueBlocker.findDirectCaret(postElement);
      if (!caret) caret = postElement.querySelector('button[aria-label*="More"]');
      if (!caret) caret = postElement.querySelector('[role="button"][aria-label*="More"]');

      if (!caret) {
        console.warn('[block-twitter] TrueBlocker: caret button not found for', username);
        return false;
      }

      // Hover over caret with coordinates, then click
      const cr = caret.getBoundingClientRect();
      caret.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true, clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2
      }));
      await new Promise(r => setTimeout(r, 100));
      caret.click();
      // Give menu more time to fully render
      await new Promise(r => setTimeout(r, 600));

      const menuItem = await TrueBlocker.waitForBlockMenuItem(username);
      if (!menuItem) {
        console.warn('[block-twitter] TrueBlocker: block menu item not found for', username);
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
        }));
        await new Promise(r => setTimeout(r, 300));
        return false;
      }

      menuItem.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      await new Promise(r => setTimeout(r, 200));
      menuItem.click();

      const confirmed = await TrueBlocker.waitAndConfirm();

      // 5. Wait for confirmation dialog to fully close before returning
      if (confirmed) {
        await TrueBlocker.waitForDialogClose();
      }

      return confirmed;
    } catch (e) {
      console.error('[block-twitter] TrueBlocker.block error:', e);
      return false;
    }
  }

  // Return the caret button that directly belongs to postElement,
  // skipping any caret inside a nested quoted-tweet / reply article.
  static findDirectCaret(postElement) {
    const carets = postElement.querySelectorAll('[data-testid="caret"]');
    for (const c of carets) {
      // Walk ancestors up to postElement; if we hit another article first, this
      // caret belongs to a nested tweet — skip it.
      let el = c.parentElement;
      let nested = false;
      while (el && el !== postElement) {
        if (el.tagName === 'ARTICLE' || el.getAttribute?.('data-testid') === 'tweet') {
          nested = true;
          break;
        }
        el = el.parentElement;
      }
      if (!nested) return c;
    }
    return null;
  }

  // Wait until the confirmation sheet disappears from the DOM
  static waitForDialogClose(timeout = 3000) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeout;
      const check = () => {
        if (!document.querySelector('[data-testid="confirmationSheetConfirm"]')) {
          resolve();
          return;
        }
        if (Date.now() < deadline) {
          setTimeout(check, 150);
        } else {
          resolve(); // timed out — proceed anyway
        }
      };
      setTimeout(check, 200);
    });
  }

  static waitForBlockMenuItem(username, timeout = 5000) {
    return new Promise((resolve) => {
      const handle = username.replace('@', '').toLowerCase();
      const deadline = Date.now() + timeout;
      let attempts = 0;

      const check = () => {
        attempts++;
        const items = document.querySelectorAll('[role="menuitem"]');

        // First pass: look for "屏蔽" or "Block" with username
        for (const item of items) {
          const text = item.textContent || '';
          const lowerText = text.toLowerCase();

          // Check if this is a block menu item
          const hasBlockKeyword = text.includes('屏蔽') || lowerText.includes('block');
          if (!hasBlockKeyword) continue;

          // Check if username is in the text (flexible matching)
          const hasUsername = text.includes(username) ||
                             text.includes('@' + handle) ||
                             lowerText.includes(handle) ||
                             text.includes(handle);

          if (hasUsername) {
            console.log('[block-twitter] Found block menu item for', username, ':', text);
            resolve(item);
            return;
          }
        }

        // Second pass: if no username match, look for any block menu item
        // (some X UI variations don't include username in the menu text)
        if (attempts === 1) {
          for (const item of items) {
            const text = item.textContent || '';
            if (text.includes('屏蔽') || text.toLowerCase().includes('block')) {
              console.log('[block-twitter] Found generic block menu item (no username match):', text);
              resolve(item);
              return;
            }
          }
        }

        if (Date.now() < deadline) {
          setTimeout(check, 150);
        } else {
          console.warn('[block-twitter] TrueBlocker: timeout waiting for block menu item after', attempts, 'attempts');
          resolve(null);
        }
      };

      // Longer initial delay to allow menu to fully render
      setTimeout(check, 400);
    });
  }

  static waitAndConfirm(timeout = 4000) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeout;

      const check = () => {
        // Try multiple selectors for confirmation button
        let confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
        if (!confirmBtn) {
          confirmBtn = document.querySelector('button[aria-label*="Block"]');
        }
        if (!confirmBtn) {
          confirmBtn = document.querySelector('[role="button"][aria-label*="Block"]');
        }

        if (confirmBtn) {
          console.log('[block-twitter] Found confirmation button, clicking...');
          confirmBtn.click();
          resolve(true);
          return;
        }

        if (Date.now() < deadline) {
          setTimeout(check, 150);
        } else {
          // No confirm dialog appeared — some accounts may skip it, treat as success
          console.log('[block-twitter] No confirmation dialog, treating as success');
          resolve(true);
        }
      };

      setTimeout(check, 400);
    });
  }
}

// ============================================================================
// 6. AIDetector - Classify posts as spam using Chrome AI or external API
// ============================================================================

class AIDetector {
  constructor() {
    this.available = false;
    this.backend = null; // 'chrome-ai' | 'api'
  }

  async initialize() {
    if (window.ai?.languageModel) {
      try {
        const caps = await window.ai.languageModel.capabilities();
        if (caps.available !== 'no') {
          this.available = true;
          this.backend = 'chrome-ai';
          console.log('[block-twitter] AI backend: chrome-ai');
          return;
        }
      } catch (_) {}
    }
    const cfg = await new Promise(resolve =>
      chrome.storage.local.get(['aiBaseUrl', 'aiApiKey'], resolve)
    );
    if (cfg.aiBaseUrl && cfg.aiApiKey) {
      this.available = true;
      this.backend = 'api';
      console.log('[block-twitter] AI backend: api', cfg.aiBaseUrl);
    }
  }

  async classifyBatch(posts, onProgress) {
    if (!this.available) return new Map();
    const results = new Map();

    if (this.backend === 'chrome-ai') {
      let session = await this._createChromeAISession();
      for (let i = 0; i < posts.length; i++) {
        if (i > 0 && i % 20 === 0) {
          session.destroy();
          session = await this._createChromeAISession();
        }
        const label = await this._classifyOneChromeAI(session, posts[i].username, posts[i].text);
        results.set(posts[i].post, label);
        onProgress?.(i + 1, posts.length);
      }
      session.destroy();
    } else {
      for (let i = 0; i < posts.length; i += 10) {
        const batch = posts.slice(i, i + 10);
        const labels = await this._classifyBatchAPI(batch);
        batch.forEach(({ post }, j) => results.set(post, labels[j] ?? 'ok'));
        onProgress?.(Math.min(i + 10, posts.length), posts.length);
      }
    }
    return results;
  }

  async _classifyOneChromeAI(session, username, text) {
    const result = await session.prompt(`用户名: ${username}\n内容: ${text.slice(0, 300)}`);
    return result.trim().toLowerCase().startsWith('spam') ? 'spam' : 'ok';
  }

  async _createChromeAISession() {
    return window.ai.languageModel.create({ systemPrompt: await this._getSystemPrompt() });
  }

  async _classifyBatchAPI(batch) {
    const cfg = await new Promise(resolve =>
      chrome.storage.local.get(['aiBaseUrl', 'aiApiKey', 'aiModel'], resolve)
    );
    const payload = {
      posts: batch.map(({ username, displayName, text }) => ({ username, displayName, text })),
      baseUrl: cfg.aiBaseUrl,
      apiKey: cfg.aiApiKey,
      model: cfg.aiModel,
      systemPrompt: await this._getSystemPrompt(),
    };

    // Retry once if the service worker channel closes (MV3 worker may sleep mid-request)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'aiClassify', payload });
        if (response?.success) return response.labels;
        if (response?.error) console.warn('[block-twitter] AI classify error:', response.error);
        break;
      } catch (err) {
        if (attempt === 0 && err?.message?.includes('message channel closed')) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        console.error('[block-twitter] sendMessage failed:', err);
        break;
      }
    }
    return batch.map(() => 'ok');
  }

  async _getSystemPrompt() {
    const data = await new Promise(resolve =>
      chrome.storage.local.get(['aiCustomPrompt', 'keywords'], resolve)
    );
    const base = data.aiCustomPrompt || AIDetector.DEFAULT_SYSTEM_PROMPT;
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];
    if (keywords.length === 0) return base;

    // Append up to 80 keywords as concrete examples (avoid token bloat)
    const sample = keywords.slice(0, 80).join('、');
    return base + `\n\n【已知垃圾关键词示例（参考相似模式，不必完全匹配）】\n${sample}`;
  }
}

AIDetector.DEFAULT_SYSTEM_PROMPT =
`你是Twitter/X平台的垃圾账号分类器。每条输入包含"账号"（显示名+@handle）和"内容"两部分。

【判断为 spam 的情形】
- 显示名或内容含色情/成人服务：招嫖、约炮、破处、免费福利、约会、找主人、找搭子（带性暗示语境）等
- 内容为纯 emoji 组合，无实质文字，疑似引流暗号
- 内容中含不可见字符（藏文、零宽字符）插入 emoji 之间
- 推广刷粉、涨粉、诈骗、虚假投资
- 机器人式重复内容或明显无意义引流评论

【判断为 ok 的情形】
- 正常观点、新闻、日常生活，即使措辞粗俗
- 批评他人或有争议的内容
- 含 emoji 但有实质文字内容的帖子

只回复 spam 或 ok，绝对不要解释。`;

// ============================================================================
// 7. AIScanButton - Floating button to trigger AI scan of current page
// ============================================================================

class AIScanButton {
  constructor(aiDetector, highlighter, extractUsernameFn) {
    this.aiDetector = aiDetector;
    this.highlighter = highlighter;
    this.extractUsername = extractUsernameFn;
    this.btn = null;
    this.scanning = false;
  }

  render() {
    this.btn = document.createElement('button');
    this.btn.id = 'bt-ai-scan-btn';
    const isAvailable = this.aiDetector.available;
    this.btn.textContent = '🤖 AI扫描';
    this.btn.title = isAvailable
      ? '扫描当前页面的垃圾账号'
      : '请先在设置页配置 AI（Base URL + API Key）';
    this.btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: ${isAvailable ? '#1d4ed8' : '#6b7280'};
      color: white;
      border: none;
      border-radius: 20px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: ${isAvailable ? 'pointer' : 'not-allowed'};
      z-index: 99998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: background 0.2s;
      white-space: nowrap;
    `;

    if (isAvailable) {
      this.btn.addEventListener('click', () => this._scan());
    }
    document.body.appendChild(this.btn);
  }

  async _scan() {
    if (this.scanning) return;

    // Immediate feedback — disable button before any async work
    this.scanning = true;
    if (this.btn) {
      this.btn.disabled = true;
      this.btn.textContent = '⏳ 准备中...';
      this.btn.style.opacity = '0.8';
    }

    // Re-check backend on every scan — user may have configured API key after page load
    await this.aiDetector.initialize();
    if (!this.aiDetector.available) {
      this.btn.title = '请先在设置页配置 AI（Base URL + API Key）';
      this._resetLabel();
      return;
    }
    this.btn.style.cursor = 'pointer';
    this.btn.style.background = '#1d4ed8';

    try {
      const startTime = Date.now();

      const { falsePositiveUsers = {} } = await new Promise(resolve =>
        chrome.storage.local.get(['falsePositiveUsers'], resolve)
      );

      const allPosts = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const posts = allPosts
        .filter(post => !post.hasAttribute('data-keyword-matched') && !post.hasAttribute('data-bt-blocked'))
        .filter(post => !this._isVerified(post))
        .map(post => ({
          post,
          username: this.extractUsername(post),
          displayName: this._extractDisplayName(post),
          text: KeywordMatcher.extractPostText(post),
        }))
        .filter(({ username, text }) => username && text && !falsePositiveUsers[username]);

      if (posts.length === 0) {
        this._setLabel('✓ 无新帖子');
        setTimeout(() => this._resetLabel(), 2000);
        return;
      }

      // Show post count immediately so user knows scan started
      if (this.btn) this.btn.textContent = `⏳ 扫描 0/${posts.length}...`;

      const results = await this.aiDetector.classifyBatch(posts, (done, total) => {
        if (this.btn) this.btn.textContent = `⏳ 扫描 ${done}/${total}...`;
      });

      let spamCount = 0;
      const newSpamEntries = {};
      for (const [postEl, label] of results) {
        if (label === 'spam') {
          const entry = posts.find(p => p.post === postEl);
          if (!entry?.username) continue;

          // Twitter's React may have re-rendered the element during the API call.
          // Re-find the current live element by username before inserting badges.
          const liveEl = document.contains(postEl)
            ? postEl
            : this._refindPost(entry.username);
          if (!liveEl) continue;

          this.highlighter.highlight(liveEl, entry.username, ['🤖 AI识别']);
          this._addFeedbackButtons(liveEl, entry.username);
          newSpamEntries[entry.username] = Date.now();
          spamCount++;
        }
      }

      // Persist spam usernames so they survive page refresh
      if (Object.keys(newSpamEntries).length > 0) {
        chrome.storage.local.get(['aiSpamUsers'], (data) => {
          const merged = { ...(data.aiSpamUsers || {}), ...newSpamEntries };
          chrome.storage.local.set({ aiSpamUsers: merged });
        });
      }

      // After scan: add "手动标记" button to undetected posts so user can report misses
      for (const { post, username } of posts) {
        const livePost = document.contains(post) ? post : this._refindPost(username);
        if (livePost && !livePost.hasAttribute('data-keyword-matched') && !this._isVerified(livePost)) {
          this._addMarkButton(livePost, username);
        }
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this._setLabel(`✓ 发现 ${spamCount} 个 (${elapsed}s)`);
      setTimeout(() => this._resetLabel(), 3000);
    } catch (err) {
      console.error('[block-twitter] AI scan error:', err);
      this._setLabel('✗ 扫描失败');
      setTimeout(() => this._resetLabel(), 2000);
    }
  }

  // Re-find the live DOM element for a username when the original reference is detached
  _refindPost(username) {
    const handle = username.replace('@', '').toLowerCase();
    for (const post of document.querySelectorAll('article[data-testid="tweet"]')) {
      for (const link of post.querySelectorAll('a[href^="/"]')) {
        if (link.getAttribute('href')?.toLowerCase() === `/${handle}`) return post;
      }
    }
    return null;
  }

  // Return true if the post author has a blue verified badge
  _isVerified(postElement) {
    const userNameEl = postElement.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) return false;
    return !!(
      userNameEl.querySelector('[data-testid="verifiedBadge"]') ||
      userNameEl.querySelector('svg[aria-label="Verified account"]') ||
      userNameEl.querySelector('[aria-label="Verified account"]')
    );
  }

  // Extract display name (the visible name above @handle, including emoji)
  _extractDisplayName(postElement) {
    const userNameEl = postElement.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) return '';
    const fullText = KeywordMatcher.extractPostText(userNameEl);
    const atIdx = fullText.indexOf('@');
    return atIdx > 0 ? fullText.slice(0, atIdx).trim() : fullText.trim();
  }

  // Add "误报" dismiss + "漏报" feedback on AI-flagged posts
  _addFeedbackButtons(postEl, username) {
    const existingBadge = postEl.querySelector('.bt-indicator-badge');
    if (!existingBadge) return;

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '✕ 误报';
    dismissBtn.title = '这不是垃圾，取消标记';
    dismissBtn.style.cssText = `
      display: inline-block;
      margin-left: 4px;
      padding: 4px 8px;
      background: #374151;
      color: #d1d5db;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    `;
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.highlighter.dismissHighlight(postEl, username);
    });
    existingBadge.parentElement?.insertBefore(dismissBtn, existingBadge.nextSibling);
  }

  // Add a small "🚮" button to posts the AI didn't flag — lets user manually report misses
  _addMarkButton(postEl, username) {
    if (postEl.querySelector('.bt-manual-mark-btn')) return;
    const userNameEl = postEl.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) return;

    const btn = document.createElement('button');
    btn.className = 'bt-manual-mark-btn';
    btn.textContent = '🚮';
    btn.title = '标记为垃圾账号';
    btn.style.cssText = `
      display: inline-block;
      margin-left: 6px;
      padding: 2px 6px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #374151;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.5'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.remove();
      this.highlighter.highlight(postEl, username, ['🤖 手动标记']);
      this._addFeedbackButtons(postEl, username);
      // Persist so re-appears after page refresh
      chrome.storage.local.get(['aiSpamUsers'], (data) => {
        const users = data.aiSpamUsers || {};
        users[username] = Date.now();
        chrome.storage.local.set({ aiSpamUsers: users });
      });
    });
    userNameEl.parentElement?.appendChild(btn);
  }

  _setLabel(text) {
    if (this.btn) this.btn.textContent = text;
  }

  _resetLabel() {
    if (this.btn) {
      this.btn.textContent = '🤖 AI扫描';
      this.btn.style.background = this.aiDetector.available ? '#1d4ed8' : '#6b7280';
      this.btn.style.opacity = '1';
      this.btn.disabled = false;
    }
    this.scanning = false;
  }
}

// ============================================================================
// 8. Main Content Script Initialization
// ============================================================================

class ContentScriptManager {
  constructor() {
    this.keywords = [];
    this.aiSpamUsers = {};
    this.falsePositiveUsers = {};
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

      // Load keywords and AI spam users from storage
      await this.loadKeywords();
      await this.loadAISpamUsers();
      await this.loadFalsePositiveUsers();
      await this.loadShowManualClassifyBtn();

      // Listen for storage updates
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.keywords) this.onKeywordsChanged(changes.keywords);
        if (changes.aiSpamUsers) this.aiSpamUsers = changes.aiSpamUsers.newValue || {};
        if (changes.falsePositiveUsers) this.falsePositiveUsers = changes.falsePositiveUsers.newValue || {};
        if (changes.showManualClassifyBtn) this._applyManualBtnVisibility(changes.showManualClassifyBtn.newValue ?? false);
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

      // Initialize AI scan button
      this.aiDetector = new AIDetector();
      await this.aiDetector.initialize();
      this.aiScanButton = new AIScanButton(
        this.aiDetector,
        this.highlighter,
        (post) => this.extractUsername(post)
      );
      this.aiScanButton.render();
      this._renderManualBtnToggle();

      // Setup message listener for popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          if (request.action === 'getBlockedCount') {
            const blockedPosts = document.querySelectorAll('[data-bt-blocked="true"]').length;
            sendResponse({ blockedCount: blockedPosts });
          }
        } catch (error) {
          console.error('[block-twitter] Error handling message:', error);
          sendResponse({ blockedCount: 0 });
        }
        return false; // Explicitly indicate synchronous response
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

  loadAISpamUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiSpamUsers'], (result) => {
        this.aiSpamUsers = result.aiSpamUsers || {};
        resolve();
      });
    });
  }

  loadFalsePositiveUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['falsePositiveUsers'], (result) => {
        this.falsePositiveUsers = result.falsePositiveUsers || {};
        resolve();
      });
    });
  }

  loadShowManualClassifyBtn() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['showManualClassifyBtn'], (result) => {
        this._applyManualBtnVisibility(result.showManualClassifyBtn ?? false);
        resolve();
      });
    });
  }

  _renderManualBtnToggle() {
    const btn = document.createElement('button');
    btn.id = 'bt-manual-toggle-btn';
    btn.title = '开关：在每条帖子旁显示手动标记按钮（🚩）';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      border: none;
      border-radius: 20px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      z-index: 99997;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: background 0.2s, opacity 0.2s;
      white-space: nowrap;
    `;

    const update = (show) => {
      btn.textContent = show ? '🚩 ON' : '🚩';
      btn.style.background = show ? '#92400e' : '#374151';
      btn.style.color = show ? '#fde68a' : '#9ca3af';
      btn.style.opacity = show ? '1' : '0.7';
    };

    const positionLeft = () => {
      const scanBtn = document.getElementById('bt-ai-scan-btn');
      if (scanBtn) {
        btn.style.right = `${scanBtn.offsetWidth + 36}px`;
      }
    };

    chrome.storage.local.get(['showManualClassifyBtn'], (data) => {
      update(data.showManualClassifyBtn ?? false);
      positionLeft();
    });

    btn.addEventListener('click', () => {
      chrome.storage.local.get(['showManualClassifyBtn'], (data) => {
        const next = !(data.showManualClassifyBtn ?? false);
        chrome.storage.local.set({ showManualClassifyBtn: next });
        update(next);
      });
    });

    document.body.appendChild(btn);
    setTimeout(positionLeft, 100);
  }

  _applyManualBtnVisibility(show) {
    let style = document.getElementById('bt-manual-btn-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'bt-manual-btn-style';
      document.head.appendChild(style);
    }
    style.textContent = show ? '' : '.bt-manual-classify-btn { display: none !important; }';

    // Sync floating toggle button appearance
    const toggleBtn = document.getElementById('bt-manual-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = show ? '🚩 ON' : '🚩';
      toggleBtn.style.background = show ? '#92400e' : '#374151';
      toggleBtn.style.color = show ? '#fde68a' : '#9ca3af';
      toggleBtn.style.opacity = show ? '1' : '0.7';
    }
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
      // First, try to extract username to check if already blocked
      const username = this.extractUsername(postElement);

      // If user is already blocked, hide the post and return
      if (username && this.blockingManager && this.blockingManager.blockedUsers[username]) {
        this.blockingManager.hidePostsFromUser(username);
        return;
      }

      // Add manual classify button to every visible post (skips blocked)
      if (username) this.highlighter.addManualClassifyButton(postElement, username);

      // If user was previously flagged by AI (and not since dismissed), re-apply highlight
      if (username && this.aiSpamUsers[username] && !this.falsePositiveUsers[username]) {
        this.highlighter.highlight(postElement, username, ['🤖 AI识别']);
        return;
      }

      if (!this.keywords || this.keywords.length === 0) {
        return;
      }

      // Extract text content from post, including emoji rendered as <img alt="...">
      const postText = KeywordMatcher.extractPostText(postElement);

      // Check if post matches any keywords
      const matchedKeywords = KeywordMatcher.match(postText, this.keywords);

      if (matchedKeywords.length > 0 && username) {
        this.highlighter.highlight(postElement, username, matchedKeywords);
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
// 7. Start the content script when DOM is ready
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
