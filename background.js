// ── Persistent Tab History ──────────────────────────────────────────
let tabHistory = [];
let switcherWindowId = null;
let switcherTabId = null;

// Persist history to chrome.storage.session so it survives service worker restarts
async function saveHistory() {
    await chrome.storage.session.set({ tabHistory });
}

// Load history from storage and reconcile with actual open tabs
async function loadHistory() {
    try {
        const data = await chrome.storage.session.get('tabHistory');
        if (data.tabHistory) {
            tabHistory = data.tabHistory;
        }
    } catch { /* first run */ }

    // Validate: remove closed tabs, add any untracked tabs
    const allTabs = await chrome.tabs.query({});
    const validIds = new Set(allTabs.map(t => t.id));
    tabHistory = tabHistory.filter(id => validIds.has(id));

    for (const tab of allTabs) {
        if (!tabHistory.includes(tab.id)) {
            tabHistory.push(tab.id);
        }
    }
    await saveHistory();
}

// Initialize on service worker start
loadHistory();

// ── Tab Event Listeners ────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const { tabId } = activeInfo;
    if (tabId === switcherTabId) return; // ignore switcher window
    tabHistory = tabHistory.filter(id => id !== tabId);
    tabHistory.unshift(tabId);
    if (tabHistory.length > 200) tabHistory = tabHistory.slice(0, 200);
    await saveHistory();
});

chrome.tabs.onCreated.addListener(async (tab) => {
    if (!tabHistory.includes(tab.id)) {
        tabHistory.unshift(tab.id);
        await saveHistory();
    }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    tabHistory = tabHistory.filter(id => id !== tabId);
    if (tabId === switcherTabId) {
        switcherTabId = null;
        switcherWindowId = null;
    }
    await saveHistory();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    // Ensure updated tabs are in the history
    if (!tabHistory.includes(tabId) && tabId !== switcherTabId) {
        tabHistory.push(tabId);
        await saveHistory();
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    if (windowId === switcherWindowId) return;

    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0) {
        const tabId = tabs[0].id;
        if (tabId === switcherTabId) return;
        tabHistory = tabHistory.filter(id => id !== tabId);
        tabHistory.unshift(tabId);
        await saveHistory();
    }
});

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === switcherWindowId) {
        switcherWindowId = null;
        switcherTabId = null;
    }
});

// ── Command: Open / Cycle Switcher ─────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'switch-to-last-tab') {
        await handleSwitchCommand();
    }
});

async function handleSwitchCommand() {
    // If switcher is already open, tell it to cycle forward
    if (switcherWindowId !== null) {
        try {
            await chrome.windows.get(switcherWindowId);
            chrome.runtime.sendMessage({ type: 'cycleNext' });
            return;
        } catch {
            switcherWindowId = null;
            switcherTabId = null;
        }
    }

    // Open the switcher popup window centered on the current window
    const currentWindow = await chrome.windows.getCurrent();
    const width = 720;
    const height = 165;
    const left = Math.round(currentWindow.left + (currentWindow.width - width) / 2);
    const top = Math.round(currentWindow.top + (currentWindow.height - height) / 2);

    const win = await chrome.windows.create({
        url: 'switcher.html',
        type: 'popup',
        width,
        height,
        left,
        top,
        focused: true
    });

    switcherWindowId = win.id;
    if (win.tabs && win.tabs.length > 0) {
        switcherTabId = win.tabs[0].id;
        // Remove switcher tab from history
        tabHistory = tabHistory.filter(id => id !== switcherTabId);
        await saveHistory();
    }
}

// ── Message Handler ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getTabHistory') {
        getTabHistoryDetails().then(tabs => sendResponse({ tabs }));
        return true;
    }
    if (message.type === 'getTabCount') {
        sendResponse({ count: tabHistory.length });
        return true;
    }
    if (message.type === 'switchToTab') {
        switchToTab(message.tabId).then(() => sendResponse({ success: true }));
        return true;
    }
    if (message.type === 'closeSwitcher') {
        if (switcherWindowId) {
            chrome.windows.remove(switcherWindowId).catch(() => { });
            switcherWindowId = null;
            switcherTabId = null;
        }
        sendResponse({ success: true });
        return true;
    }
});

async function getTabHistoryDetails() {
    const results = [];
    for (const tabId of tabHistory) {
        if (tabId === switcherTabId) continue;
        try {
            const tab = await chrome.tabs.get(tabId);
            results.push({
                id: tab.id,
                title: tab.title || 'Untitled',
                url: tab.url || '',
                favIconUrl: tab.favIconUrl || '',
                windowId: tab.windowId
            });
        } catch {
            // Tab no longer exists, will be cleaned up
        }
    }
    return results;
}

async function switchToTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        if (tab.windowId) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
    } catch {
        tabHistory = tabHistory.filter(id => id !== tabId);
        await saveHistory();
    }
}
