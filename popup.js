// Get the tab history count from the background script
chrome.runtime.sendMessage({ type: 'getTabCount' }, (response) => {
    if (response && response.count !== undefined) {
        document.getElementById('tabCount').textContent = response.count;
    }
});

// Handle the shortcuts link
document.getElementById('shortcutLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
