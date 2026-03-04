(function () {
    const HOST_ID = '__rts_switcher_host';

    if (window.__rts_switcher_ready) return;
    window.__rts_switcher_ready = true;

    // Track modifiers globally to handle instant tap vs hold
    let activeModifiers = new Set();
    window.addEventListener('keydown', e => activeModifiers.add(e.key), true);
    window.addEventListener('keyup', e => activeModifiers.delete(e.key), true);
    window.addEventListener('blur', () => activeModifiers.clear(), true);

    let hostEl = null;
    let shadow = null;
    let tabs = [];
    let selectedIndex = 0;

    // ── Styles ─────────────────────────────────────────────────────
    const CSS = `
    :host { all: initial; }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      z-index: 2147483647;
      opacity: 0;
      animation: rtsFadeIn 0.15s ease-out forwards;
      animation-delay: 0.05s;
    }
    @keyframes rtsFadeIn {
      to { opacity: 1; }
    }

    @media (prefers-color-scheme: dark) {
      .backdrop { background: rgba(0, 0, 0, 0.42); }
    }

    .strip {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 10px;
      padding: 22px 28px 18px;
      border-radius: 20px;
      max-width: 88vw;
      overflow-x: auto;
      scrollbar-width: none;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(50px);
      -webkit-backdrop-filter: blur(50px);
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.14),
        0 0 0 0.5px rgba(0, 0, 0, 0.06);
    }
    .strip::-webkit-scrollbar { display: none; }

    @media (prefers-color-scheme: dark) {
      .strip {
        background: rgba(30, 30, 30, 0.95);
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.55),
          0 0 0 0.5px rgba(255, 255, 255, 0.06);
      }
    }

    /* ── Tab item ─────────────────────────────── */
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 140px;
      min-width: 140px;
      cursor: pointer;
      user-select: none;
      padding: 6px;
      border-radius: 12px;
      transition: background 0.1s;
    }
    .item:hover { background: rgba(0, 0, 0, 0.03); }
    @media (prefers-color-scheme: dark) {
      .item:hover { background: rgba(255, 255, 255, 0.04); }
    }

    .item.sel { background: rgba(59, 130, 246, 0.08); }
    @media (prefers-color-scheme: dark) {
      .item.sel { background: rgba(59, 130, 246, 0.14); }
    }

    /* ── Preview card ─────────────────────────── */
    .preview {
      width: 128px;
      height: 86px;
      border-radius: 10px;
      background: #f2f2f2;
      border: 1.5px solid transparent;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: border-color 0.1s;
    }
    @media (prefers-color-scheme: dark) {
      .preview { background: #2a2a2a; }
    }

    .item.sel .preview {
      border-color: rgba(59, 130, 246, 0.55);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
    }

    .preview-bar {
      height: 20px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      gap: 5px;
      background: #e8e8e8;
      flex-shrink: 0;
    }
    @media (prefers-color-scheme: dark) {
      .preview-bar { background: #363636; }
    }

    .preview-fav {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
      object-fit: contain;
    }

    .preview-domain {
      font-size: 8px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
    @media (prefers-color-scheme: dark) {
      .preview-domain { color: #777; }
    }

    .preview-body {
      flex: 1;
      padding: 6px 8px;
      display: flex;
      align-items: flex-start;
    }

    .preview-text {
      font-size: 9px;
      line-height: 1.35;
      color: #666;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
    @media (prefers-color-scheme: dark) {
      .preview-text { color: #999; }
    }

    /* ── Icon underneath ──────────────── */
    .bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 10px;
    }

    .icon {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      object-fit: contain;
      background: #e9e9e9;
      flex-shrink: 0;
      transition: transform 0.1s;
    }
    @media (prefers-color-scheme: dark) {
      .icon { background: #3a3a3a; }
    }

    .item.sel .icon, .item.sel .ph {
      transform: scale(1.15);
    }

    .ph {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
      color: #999;
      background: #e9e9e9;
      flex-shrink: 0;
      transition: transform 0.1s;
    }
    @media (prefers-color-scheme: dark) {
      .ph { background: #3a3a3a; color: #666; }
    }
  `;

    // ── Message listener ───────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        switch (msg.type) {
            case 'rts_initOverlay':
                tabs = msg.tabs || [];
                selectedIndex = msg.selectedIndex || 0;

                // If user already released the modifier keys before we built the overlay,
                // this was an instant "quick tap". Complete the switch immediately!
                if (!activeModifiers.has('Alt') && !activeModifiers.has('Control') && !activeModifiers.has('Meta')) {
                    if (tabs.length > 0 && tabs[selectedIndex]) {
                        chrome.runtime.sendMessage({ type: 'switchFromOverlay', tabId: tabs[selectedIndex].id });
                    }
                    sendResponse({ ok: true });
                    return;
                }

                buildOverlay();
                sendResponse({ ok: true });
                break;
            case 'rts_cycleNext':
                if (tabs.length > 0) {
                    selectedIndex = (selectedIndex + 1) % tabs.length;
                    updateSelection();
                }
                sendResponse({ ok: true });
                break;
            case 'rts_getSelection':
                sendResponse({ tabId: tabs[selectedIndex]?.id });
                break;
            case 'rts_removeOverlay':
                destroyOverlay();
                sendResponse({ ok: true });
                break;
        }
        return true;
    });

    // ── Key listeners (modifier release = confirm) ─────────────────
    document.addEventListener('keyup', (e) => {
        if (!hostEl) return;
        if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
            confirmAndClose();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (!hostEl) return;

        // Cycle with 'Q' or 'K'
        if (e.code === 'KeyQ' || e.code === 'KeyK') {
            e.preventDefault();
            e.stopPropagation();
            selectedIndex = (selectedIndex + 1) % tabs.length;
            updateSelection();
            return;
        }

        // Cycle back with 'J'
        if (e.code === 'KeyJ') {
            e.preventDefault();
            e.stopPropagation();
            selectedIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
            updateSelection();
            return;
        }

        switch (e.key) {
            case 'ArrowRight':
            case 'Tab':
                e.preventDefault();
                e.stopPropagation();
                selectedIndex = (selectedIndex + 1) % tabs.length;
                updateSelection();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                e.stopPropagation();
                selectedIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
                updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                confirmAndClose();
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                destroyOverlay();
                chrome.runtime.sendMessage({ type: 'overlayCancelled' });
                break;
        }
    }, true);

    // ── Core functions ─────────────────────────────────────────────
    function confirmAndClose() {
        const tab = tabs[selectedIndex];
        destroyOverlay();
        if (tab) chrome.runtime.sendMessage({ type: 'switchFromOverlay', tabId: tab.id });
    }

    function getDomain(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
    }

    function buildOverlay() {
        destroyOverlay();

        hostEl = document.createElement('div');
        hostEl.id = HOST_ID;
        hostEl.style.cssText =
            'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:auto!important;';
        shadow = hostEl.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = CSS;
        shadow.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.className = 'backdrop';
        backdrop.addEventListener('mousedown', (e) => {
            if (e.target === backdrop) {
                destroyOverlay();
                chrome.runtime.sendMessage({ type: 'overlayCancelled' });
            }
        });

        const strip = document.createElement('div');
        strip.className = 'strip';

        tabs.forEach((tab, i) => {
            const item = document.createElement('div');
            item.className = 'item' + (i === selectedIndex ? ' sel' : '');

            // ── Preview card ──
            const preview = document.createElement('div');
            preview.className = 'preview';

            const bar = document.createElement('div');
            bar.className = 'preview-bar';

            if (tab.favIconUrl) {
                const barIcon = document.createElement('img');
                barIcon.className = 'preview-fav';
                barIcon.src = tab.favIconUrl;
                barIcon.alt = '';
                barIcon.onerror = () => barIcon.remove();
                bar.appendChild(barIcon);
            }

            const domain = document.createElement('div');
            domain.className = 'preview-domain';
            domain.textContent = getDomain(tab.url);
            bar.appendChild(domain);
            preview.appendChild(bar);

            const body = document.createElement('div');
            body.className = 'preview-body';
            const pText = document.createElement('div');
            pText.className = 'preview-text';
            pText.textContent = tab.title;
            body.appendChild(pText);
            preview.appendChild(body);

            item.appendChild(preview);

            // ── Icon ──
            const bottom = document.createElement('div');
            bottom.className = 'bottom';

            if (tab.favIconUrl) {
                const img = document.createElement('img');
                img.className = 'icon';
                img.src = tab.favIconUrl;
                img.alt = '';
                img.onerror = () => img.replaceWith(makePh(tab.title));
                bottom.appendChild(img);
            } else {
                bottom.appendChild(makePh(tab.title));
            }

            item.appendChild(bottom);

            item.addEventListener('click', () => {
                selectedIndex = i;
                confirmAndClose();
            });

            strip.appendChild(item);
        });

        backdrop.appendChild(strip);
        shadow.appendChild(backdrop);
        document.documentElement.appendChild(hostEl);
        requestAnimationFrame(() => scrollToSelected());
    }

    function makePh(title) {
        const d = document.createElement('div');
        d.className = 'ph';
        d.textContent = (title || '?')[0].toUpperCase();
        return d;
    }

    function updateSelection() {
        if (!shadow) return;
        shadow.querySelectorAll('.item').forEach((el, i) => {
            el.classList.toggle('sel', i === selectedIndex);
        });
        scrollToSelected();
    }

    function scrollToSelected() {
        if (!shadow) return;
        const items = shadow.querySelectorAll('.item');
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }

    function destroyOverlay() {
        document.getElementById(HOST_ID)?.remove();
        hostEl = null;
        shadow = null;
    }
})();
