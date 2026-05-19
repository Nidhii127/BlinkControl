const isControllableUrl = (url = "") =>
  url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");

const withActiveTab = async (callback) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isControllableUrl(tab.url)) {
    return;
  }
  await callback(tab);
};

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // Ignore on unsupported Chrome versions.
  }
});

const actionHandlers = {
  SCROLL_UP: async () =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy({ top: -450, left: 0, behavior: "smooth" })
      });
    }),

  SCROLL_DOWN: async () =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy({ top: 450, left: 0, behavior: "smooth" })
      });
    }),

  NAVIGATE_BACK: async () =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.history.back()
      });
    }),
  NAVIGATE_FORWARD: async () =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.history.forward()
      });
    }),

  CLICK: async () =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const pos = window.__blinkcontrolCursorPos ?? {
            x: Math.floor(window.innerWidth / 2),
            y: Math.floor(window.innerHeight / 2)
          };
          const target = document.elementFromPoint(pos.x, pos.y);
          if (target instanceof HTMLElement) {
            target.click();
          }
        }
      });
    }),

  MOVE_CURSOR: async (payload = {}) =>
    withActiveTab(async (tab) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [payload],
        func: (payloadArg) => {
          const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
          const dx = Number(payloadArg?.dx ?? 0);
          const dy = Number(payloadArg?.dy ?? 0);
          const elId = "__blinkcontrolCursor";
          let cursor = document.getElementById(elId);
          if (!cursor) {
            cursor = document.createElement("div");
            cursor.id = elId;
            cursor.style.position = "fixed";
            cursor.style.width = "14px";
            cursor.style.height = "14px";
            cursor.style.borderRadius = "50%";
            cursor.style.background = "#111827";
            cursor.style.border = "2px solid #ffffff";
            cursor.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
            cursor.style.zIndex = "2147483647";
            cursor.style.pointerEvents = "none";
            cursor.style.left = `${Math.floor(window.innerWidth / 2)}px`;
            cursor.style.top = `${Math.floor(window.innerHeight / 2)}px`;
            document.documentElement.appendChild(cursor);
            window.__blinkcontrolCursorPos = {
              x: Math.floor(window.innerWidth / 2),
              y: Math.floor(window.innerHeight / 2)
            };
          }
          const prev = window.__blinkcontrolCursorPos ?? {
            x: Math.floor(window.innerWidth / 2),
            y: Math.floor(window.innerHeight / 2)
          };
          const next = {
            x: clamp(prev.x + dx, 8, window.innerWidth - 8),
            y: clamp(prev.y + dy, 8, window.innerHeight - 8)
          };
          window.__blinkcontrolCursorPos = next;
          cursor.style.left = `${Math.floor(next.x)}px`;
          cursor.style.top = `${Math.floor(next.y)}px`;
        }
      });
    }),

  NEW_TAB: async () => chrome.tabs.create({}),
  CLOSE_TAB: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.remove(tab.id);
    }
  },
  RELOAD: async () =>
    withActiveTab(async (tab) => {
      await chrome.tabs.reload(tab.id);
    }),
  PREV_TAB: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length <= 1) {
      return;
    }
    const activeIndex = tabs.findIndex((tab) => tab.active);
    const prevIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    const prevTab = tabs[prevIndex];
    if (prevTab?.id) {
      await chrome.tabs.update(prevTab.id, { active: true });
    }
  },
  NEXT_TAB: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length <= 1) {
      return;
    }
    const activeIndex = tabs.findIndex((tab) => tab.active);
    const nextIndex = (activeIndex + 1) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (nextTab?.id) {
      await chrome.tabs.update(nextTab.id, { active: true });
    }
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type || message.type !== "GESTURE_ACTION") {
    return false;
  }

  const handler = actionHandlers[message.action];
  if (!handler) {
    sendResponse({ ok: false, error: "Unknown action" });
    return false;
  }

  handler(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
