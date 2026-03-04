// Fetch full tab history from background
chrome.runtime.sendMessage({ type: 'getTabHistory' }, (response) => {
    const tabList = document.getElementById('tabList');
    const tabCount = document.getElementById('tabCount');

    if (!response || !response.tabs || response.tabs.length === 0) {
        tabList.innerHTML = '<div class="empty-state">No tabs tracked yet</div>';
        tabCount.textContent = '0 tabs';
        return;
    }

    const tabs = response.tabs;
    tabCount.textContent = tabs.length + ' tab' + (tabs.length !== 1 ? 's' : '');
    tabList.innerHTML = '';

    // Get current active tab to mark it
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        const activeTabId = activeTabs.length > 0 ? activeTabs[0].id : null;

        tabs.forEach((tab, index) => {
            const entry = document.createElement('div');
            entry.className = 'tab-entry' + (tab.id === activeTabId ? ' current' : '');

            // Favicon
            if (tab.favIconUrl) {
                const img = document.createElement('img');
                img.className = 'tab-favicon';
                img.src = tab.favIconUrl;
                img.alt = '';
                img.onerror = () => {
                    const ph = document.createElement('div');
                    ph.className = 'tab-favicon-placeholder';
                    ph.textContent = (tab.title || '?').charAt(0).toUpperCase();
                    img.replaceWith(ph);
                };
                entry.appendChild(img);
            } else {
                const ph = document.createElement('div');
                ph.className = 'tab-favicon-placeholder';
                ph.textContent = (tab.title || '?').charAt(0).toUpperCase();
                entry.appendChild(ph);
            }

            // Info
            const info = document.createElement('div');
            info.className = 'tab-info';

            const name = document.createElement('div');
            name.className = 'tab-name';
            name.textContent = tab.title;
            name.title = tab.title;
            info.appendChild(name);

            const url = document.createElement('div');
            url.className = 'tab-url';
            try {
                const parsed = new URL(tab.url);
                url.textContent = parsed.hostname + parsed.pathname;
            } catch {
                url.textContent = tab.url;
            }
            info.appendChild(url);
            entry.appendChild(info);

            // Rank
            const rank = document.createElement('div');
            rank.className = 'tab-rank';
            rank.textContent = tab.id === activeTabId ? '●' : '#' + (index + 1);
            entry.appendChild(rank);

            // Click to switch
            entry.addEventListener('click', () => {
                chrome.runtime.sendMessage({ type: 'switchToTab', tabId: tab.id }, () => {
                    window.close();
                });
            });

            tabList.appendChild(entry);
        });
    });
});

// Handle the shortcuts link
document.getElementById('shortcutLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
