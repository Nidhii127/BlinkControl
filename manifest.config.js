const manifest = {
  manifest_version: 3,
  name: "BlinkControl Local AI",
  version: "1.0.0",
  description: "Control browser actions with local eye and hand gestures.",
  action: {
    default_popup: "src/popup.html"
  },
  side_panel: {
    default_path: "src/controller.html"
  },
  background: {
    service_worker: "src/background.js",
    type: "module"
  },
  permissions: ["tabs", "activeTab", "storage", "scripting", "sidePanel"],
  host_permissions: ["<all_urls>"],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  web_accessible_resources: [
    {
      resources: ["models/*", "wasm/*"],
      matches: ["<all_urls>"]
    }
  ]
};

export default manifest;
