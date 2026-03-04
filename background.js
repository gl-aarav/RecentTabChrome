// ── Persistent Tab History ──────────────────────────────────────────
let tabHistory = [];

async function saveHistory() {
    await chrome.storage.session.set({ tabHistory });
}

async function loadHistory() {
    try {
        const data = await chrome.storage.session.get('tabHistory');
        if (data.tabHistory) tabHistory = data.tabHistory;
    } catch { /* first run */ }

    const allTabs = await chrome.tabs.query({});
    const validIds = new Set(allTabs.map(t => t.id));
    tabHistory = tabHistory.filter(id => validIds.has(id));
    for (const tab of allTabs) {
        if (!tabHistory.includes(tab.id)) tabHistory.push(tab.id);
    }
    await saveHistory();
}

loadHistory();

// ── Tab Event Listeners ────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    tabHistory = tabHistory.filter(id => id !== tabId);
    tabHistory.unshift(tabId);
    if (tabHistory.length > 200) tabHistory = tabHistory.slice(0, 200);
    await saveHistory();
});

chrome.tabs.onCreated.addListener(async (tab) => {
    if (!tabHistory.includes(tab.id)) {
        if (tab.active || tabHistory.length === 0) {
            tabHistory.unshift(tab.id);
        } else {
            // Insert at index 1 so the current active tab remains at index 0,
            // making the newly created background tab the "most recent previous" tab.
            tabHistory.splice(1, 0, tab.id);
        }
        await saveHistory();
    }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    tabHistory = tabHistory.filter(id => id !== tabId);
    await saveHistory();
});

chrome.tabs.onUpdated.addListener(async (tabId) => {
    if (!tabHistory.includes(tabId)) {
        tabHistory.push(tabId);
        await saveHistory();
    }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs.length > 0) {
        const tabId = tabs[0].id;
        tabHistory = tabHistory.filter(id => id !== tabId);
        tabHistory.unshift(tabId);
        await saveHistory();
    }
});

// ── Switcher State ─────────────────────────────────────────────────

let overlayTabId = null;
let overlayOpen = false;
let lastCommandTime = 0;

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'switch-to-last-tab') return;

    const now = Date.now();

    if (overlayOpen && overlayTabId) {
        // Already open → cycle to next tab
        // To prevent continuous cycling when the shortcut is held down,
        // we check the time since the last command. An OS key-repeat
        // usually fires every ~30-50ms. By updating lastCommandTime every
        // time and checking if the gap is small, we completely block key-repeats!
        const diff = now - lastCommandTime;
        lastCommandTime = now;

        if (diff < 200) return; // Drop OS key-repeats

        try {
            await chrome.tabs.sendMessage(overlayTabId, { type: 'rts_cycleNext' });
        } catch { /* overlay gone */ }
        return;
    }

    lastCommandTime = now;

    // Immediately open the overlay (content script handles quick-tap logic)
    await openOverlay();
});

async function switchToLastTab() {
    if (tabHistory.length < 2) return;
    const lastTabId = tabHistory[1];
    try {
        const tab = await chrome.tabs.get(lastTabId);
        await chrome.tabs.update(lastTabId, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
        tabHistory = tabHistory.filter(id => id !== lastTabId);
        await saveHistory();
        if (tabHistory.length >= 2) await switchToLastTab();
    }
}

async function openOverlay() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    overlayTabId = activeTab.id;
    overlayOpen = true;
    const tabData = await getTabHistoryDetails();
    // Pre-select index 1 (the last active tab, since 0 is the current tab)
    const selectedIndex = tabData.length > 1 ? 1 : 0;

    try {
        await chrome.scripting.executeScript({
            target: { tabId: overlayTabId },
            files: ['switcher-content.js']
        });
        await chrome.tabs.sendMessage(overlayTabId, {
            type: 'rts_initOverlay',
            tabs: tabData,
            selectedIndex
        });
    } catch {
        // Failed to inject (e.g., chrome:// URL)
        // Fallback: just instantly switch to the last tab!
        overlayTabId = null;
        overlayOpen = false;
        await switchToLastTab();
    }
}

function resetState() {
    overlayTabId = null;
    overlayOpen = false;
}

// ── Message Handler ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'switchFromOverlay') {
        switchToTab(message.tabId).then(() => {
            resetState();
            sendResponse({ success: true });
        });
        return true;
    }
    if (message.type === 'overlayCancelled') {
        resetState();
        sendResponse({ success: true });
        return true;
    }
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
});

async function getTabHistoryDetails() {
    const results = [];
    for (const tabId of tabHistory) {
        try {
            const tab = await chrome.tabs.get(tabId);
            results.push({
                id: tab.id,
                title: tab.title || 'Untitled',
                url: tab.url || '',
                favIconUrl: tab.favIconUrl || '',
                windowId: tab.windowId
            });
        } catch { /* tab gone */ }
    }
    return results;
}

async function switchToTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
        tabHistory = tabHistory.filter(id => id !== tabId);
        await saveHistory();
    }
}
