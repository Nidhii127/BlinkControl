# BlinkControl

> Hands-free browser control using eye blinks and hand gestures — powered by on-device AI, no server required.

BlinkControl is a Chrome extension that lets you navigate the web entirely through facial gestures and hand movements. Built with MediaPipe and WebAssembly, all inference runs locally in the browser — no data ever leaves your device.

---

## Features

- 👁️ **Blink-based control** — single, double, triple blink and long blink mapped to browser actions
- 🖐️ **Hand gesture recognition** — scroll, navigate, pinch-to-click via MediaPipe hand tracking
- 🔒 **100% on-device** — no camera frames uploaded, no external API calls
- ⚡ **WebAssembly runtime** — MediaPipe WASM bundled into the extension for fast, offline inference
- 🌐 **Cross-platform** — works on Windows, macOS, and Linux wherever Chrome supports Manifest V3

---

## Gesture Mapping

- Hand Scroll Up -> Scroll Up
- Hand Scroll Down -> Scroll Down
- Hand Swipe L -> Navigate Back
- Hand Swipe R -> Navigate Forward
- Hand Pinch -> Click
- Single Blink -> Click
- Double Blink -> New Tab
- Triple Blink -> Close Tab
- Long Blink -> Reload
- Left Wink -> Prev Tab
- Right Wink -> Next Tab

---

## Tech Stack

- **MediaPipe Tasks** — face landmark detection + hand gesture recognition
- **WebAssembly (WASM)** — in-browser ML inference without a backend
- **Chrome Extension Manifest V3** — minimal permissions, service worker architecture
- **Vite** — build tooling and bundling

---

## Getting Started

```bash
# Install dependencies
npm install

# Build the extension (also downloads ML model files)
npm run build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Click the extension icon → **Open Controller** → **Start Camera + AI**

---

## Privacy

- Camera access is requested only when you click Start — never in the background
- All ML inference runs locally via MediaPipe WASM
- No frames, landmarks, or usage data are sent to any server
- Manifest V3 with minimal declared permissions (`tabs`, `scripting`)
