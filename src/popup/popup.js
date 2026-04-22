/**
 * Popup script for block-twitter extension
 * Handles communication with content script and storage
 */

document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
    // Get the settings button and add click handler
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }

    // Load and display blocked post count for current page
    loadBlockedCount();
}

/**
 * Open the options page
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * Load the count of blocked posts on the current page
 */
function loadBlockedCount() {
    // Send message to content script to get blocked count
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            updateBlockedCountDisplay(0);
            return;
        }

        const tabId = tabs[0].id;

        // Send message to content script
        chrome.tabs.sendMessage(
            tabId,
            { action: 'getBlockedCount' },
            (response) => {
                // Handle potential errors (content script might not be loaded)
                if (chrome.runtime.lastError) {
                    console.log('Content script not loaded or error:', chrome.runtime.lastError.message);
                    updateBlockedCountDisplay(0);
                    return;
                }

                if (response && typeof response.blockedCount === 'number') {
                    updateBlockedCountDisplay(response.blockedCount);
                } else {
                    updateBlockedCountDisplay(0);
                }
            }
        );
    });
}

/**
 * Update the blocked count display
 * @param {number} count - Number of blocked posts
 */
function updateBlockedCountDisplay(count) {
    const countElement = document.querySelector('#blockedCount span');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Listen for storage changes and update count if needed
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.blockedUsers || changes.keywords)) {
        // Reload count when storage changes
        loadBlockedCount();
    }
});
