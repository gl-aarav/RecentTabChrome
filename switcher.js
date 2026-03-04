let tabs = [];
let selectedIndex = 1; // Start on the second tab (last active)

// Load tabs from background
chrome.runtime.sendMessage({ type: 'getTabHistory' }, (response) => {
    if (!response || !response.tabs) return;
    tabs = response.tabs;
    if (tabs.length === 0) return;

    // Pre-select the second item (the last active tab before the current one)
    selectedIndex = tabs.length > 1 ? 1 : 0;
    render();
    scrollSelectedIntoView();
});

// Listen for cycle messages from background (when shortcut pressed again)
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'cycleNext') {
        selectedIndex = (selectedIndex + 1) % tabs.length;
        render();
        scrollSelectedIntoView();
    }
});

function render() {
    const container = document.getElementById('switcher');
    container.innerHTML = '';

    tabs.forEach((tab, i) => {
        const item = document.createElement('div');
        item.className = 'tab-item' + (i === selectedIndex ? ' selected' : '');
        item.dataset.index = i;

        // Icon
        if (tab.favIconUrl) {
            const img = document.createElement('img');
            img.className = 'tab-icon';
            img.src = tab.favIconUrl;
            img.alt = '';
            img.onerror = () => {
                const placeholder = createPlaceholder(tab.title);
                img.replaceWith(placeholder);
            };
            item.appendChild(img);
        } else {
            item.appendChild(createPlaceholder(tab.title));
        }

        // Title
        const title = document.createElement('div');
        title.className = 'tab-title';
        title.textContent = tab.title;
        title.title = tab.title;
        item.appendChild(title);

        // Click to switch
        item.addEventListener('click', () => {
            switchToTab(tab.id);
        });

        container.appendChild(item);
    });
}

function createPlaceholder(title) {
    const el = document.createElement('div');
    el.className = 'tab-icon-placeholder';
    el.textContent = (title || '?').charAt(0).toUpperCase();
    return el;
}

function scrollSelectedIntoView() {
    const items = document.querySelectorAll('.tab-item');
    if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

function switchToTab(tabId) {
    chrome.runtime.sendMessage({ type: 'switchToTab', tabId }, () => {
        chrome.runtime.sendMessage({ type: 'closeSwitcher' });
    });
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight':
        case 'Tab':
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % tabs.length;
            render();
            scrollSelectedIntoView();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
            render();
            scrollSelectedIntoView();
            break;
        case 'Enter':
            e.preventDefault();
            if (tabs[selectedIndex]) {
                switchToTab(tabs[selectedIndex].id);
            }
            break;
        case 'Escape':
            e.preventDefault();
            chrome.runtime.sendMessage({ type: 'closeSwitcher' });
            break;
    }
});

// Close if the window loses focus (user clicked elsewhere)
window.addEventListener('blur', () => {
    setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'closeSwitcher' });
    }, 150);
});
