// Tracks the history of active tab IDs (most recent first)
let tabHistory = [];

// Listen for tab activation changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    const { tabId } = activeInfo;

    // Remove this tab from history if it already exists (avoid duplicates)
    tabHistory = tabHistory.filter((id) => id !== tabId);

    // Push to front of history
    tabHistory.unshift(tabId);

    // Keep history bounded to avoid memory leaks
    if (tabHistory.length > 50) {
        tabHistory = tabHistory.slice(0, 50);
    }
});

// Listen for tab removal to clean up history
chrome.tabs.onRemoved.addListener((tabId) => {
    tabHistory = tabHistory.filter((id) => id !== tabId);
});

// Listen for window focus changes — track the active tab in the newly focused window
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;

    chrome.tabs.query({ active: true, windowId }, (tabs) => {
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            tabHistory = tabHistory.filter((id) => id !== tabId);
            tabHistory.unshift(tabId);
        }
    });
});

// Handle the keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
    if (command === "switch-to-last-tab") {
        switchToLastTab();
    }
});

async function switchToLastTab() {
    // The first entry in history is the current tab, so the last active is index 1
    if (tabHistory.length < 2) return;

    const lastTabId = tabHistory[1];

    try {
        // Verify the tab still exists
        const tab = await chrome.tabs.get(lastTabId);

        // Switch to the tab
        await chrome.tabs.update(lastTabId, { active: true });

        // Also focus the window containing that tab
        if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
    } catch (e) {
        // Tab no longer exists — remove it from history and try the next one
        tabHistory = tabHistory.filter((id) => id !== lastTabId);
        // Recursively try the next tab in history
        if (tabHistory.length >= 2) {
            switchToLastTab();
        }
    }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getTabCount') {
        sendResponse({ count: tabHistory.length });
    }
    return true;
});

// Initialize history with the current active tab on extension load
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
        tabHistory.unshift(tabs[0].id);
    }
});
