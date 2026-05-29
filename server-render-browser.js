const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const app = express();

// FORCE_BROWSER_TESTER_HOME
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "render-browser.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "render-browser.html"));
});

const server = app.listen(PORT, () => {
  console.log("Render Browser Tester running on port " + PORT);
});

const wss = new WebSocket.Server({ server });

let clients = [];
let running = false;
let browser = null;
let activeContexts = [];

const state = {
  total: 0,
  tested: 0,
  playing: 0,
  failed: 0,
  blocked: 0,
  active: false,
  currentProxy: "",
  logs: [],
  tiles: []
};

const CONFIG = {
  TARGET_URL: "https://example.com",
  PARALLEL_BROWSERS: 1,
  PAGE_TIMEOUT_MS: 30000,
  PLAY_DETECT_SECONDS: 4,
  MAX_SESSION_MS: 25000,
  TILE_WIDTH: 260,
  TILE_HEIGHT: 420,

  BLOCK_WORDS: [
    "captcha",
    "verify you are human",
    "checking your browser",
    "access denied",
    "unusual traffic",
    "too many requests",
    "cloudflare",
    "robot",
    "not a robot",
    "forbidden",
    "blocked",
    "video unavailable",
    "this video is unavailable",
    "this video isn't available",
    "this video has been removed",
    "this video is private",
    "before you continue",
    "consent.youtube.com",
    "sign in to confirm"
  ]
};

wss.on("connection", (ws) => {
  clients.push(ws);
  ws.send(JSON.stringify({ type: "state", data: state }));

  ws.on("close", () => {
    clients = clients.filter(x => x !== ws);
  });
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  clients.forEach(ws => {
    try { ws.send(msg); } catch {}
  });
}

function shortText(text, max = 220) {
  text = String(text || "").replace(/\s+/g, " ");
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function log(message, level = "info") {
  const line = {
    time: new Date().toLocaleTimeString(),
    message: shortText(message),
    level
  };

  state.logs.unshift(line);
  if (state.logs.length > 500) state.logs.pop();

  console.log("[" + level + "] " + line.message);
  broadcast("log", line);
  broadcast("state", state);
}

function resetState() {
  state.total = 0;
  state.tested = 0;
  state.playing = 0;
  state.failed = 0;
  state.blocked = 0;
  state.currentProxy = "";
  state.active = false;
  state.logs = [];
  state.tiles = [];
}

function parseOneProxy(line) {
  line = String(line || "").trim();
  if (!line) return null;

  line = line.replace(/\s+/g, "");

  try {
    if (line.includes("://")) {
      const url = new URL(line);
      return {
        display: line,
        server: url.protocol + "//" + url.hostname + ":" + url.port,
        username: decodeURIComponent(url.username || ""),
        password: decodeURIComponent(url.password || "")
      };
    }

    const parts = line.split(":");

    if (parts.length >= 4) {
      return {
        display: line,
        server: "http://" + parts[0] + ":" + parts[1],
        username: parts[2],
        password: parts.slice(3).join(":")
      };
    }

    if (parts.length === 2) {
      return {
        display: line,
        server: "http://" + parts[0] + ":" + parts[1],
        username: "",
        password: ""
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseProxyList(raw) {
  const map = new Map();

  String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/,/g, "\n")
    .replace(/;/g, "\n")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean)
    .forEach(line => {
      const parsed = parseOneProxy(line);
      if (parsed) map.set(parsed.display, parsed);
    });

  return Array.from(map.values());
}

function proxyForPlaywright(proxyObj) {
  const proxy = { server: proxyObj.server };
  if (proxyObj.username) proxy.username = proxyObj.username;
  if (proxyObj.password) proxy.password = proxyObj.password;
  return proxy;
}

function isBlockedText(text) {
  const lower = String(text || "").toLowerCase();
  return CONFIG.BLOCK_WORDS.some(w => lower.includes(w));
}

async function ensureBrowser() {
  if (browser) return browser;

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });

  return browser;
}

async function closeAllContexts() {
  for (const ctx of activeContexts) {
    try { await ctx.close(); } catch {}
  }
  activeContexts = [];
}

function updateTile(slot, patch) {
  const existing = state.tiles.find(t => t.slot === slot);

  if (existing) {
    Object.assign(existing, patch);
  } else {
    state.tiles.push({
      slot,
      proxy: "",
      status: "Waiting",
      image: "",
      ...patch
    });
  }

  broadcast("state", state);
}

async function tryPlay(page) {
  try {
    await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll("video"));
      for (const v of videos) {
        try {
          v.muted = true;
          v.volume = 0;
          v.autoplay = true;
          v.playsInline = true;
          v.play().catch(() => {});
        } catch {}
      }
    }).catch(() => {});

    const selectors = [
      "button[aria-label*='Play']",
      "button[title*='Play']",
      ".ytp-large-play-button",
      "button.ytp-play-button"
    ];

    for (const s of selectors) {
      const btn = await page.$(s).catch(() => null);
      if (btn) await btn.click({ timeout: 1000 }).catch(() => {});
    }

    await page.keyboard.press("k").catch(() => {});
  } catch {}
}

async function getScreenshotData(page) {
  try {
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 45,
      fullPage: false
    });

    return "data:image/jpeg;base64," + buf.toString("base64");
  } catch {
    return "";
  }
}

async function videoPlayed(page) {
  return await page.evaluate((seconds) => {
    const videos = Array.from(document.querySelectorAll("video"));
    return videos.some(v => {
      try {
        return Number(v.currentTime || 0) >= seconds && !v.paused && v.readyState >= 2;
      } catch {
        return false;
      }
    });
  }, CONFIG.PLAY_DETECT_SECONDS).catch(() => false);
}

async function testProxyBrowser(proxyObj, slot) {
  let context = null;

  try {
    const b = await ensureBrowser();

    updateTile(slot, {
      proxy: proxyObj.display,
      status: "Opening",
      image: ""
    });

    context = await b.newContext({
      proxy: proxyForPlaywright(proxyObj),
      ignoreHTTPSErrors: true,
      viewport: {
        width: CONFIG.TILE_WIDTH,
        height: CONFIG.TILE_HEIGHT
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari/537.36"
    });

    activeContexts.push(context);

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_TIMEOUT_MS);

    updateTile(slot, { status: "Loading page" });

    await page.goto(CONFIG.TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.PAGE_TIMEOUT_MS
    });

    await page.waitForTimeout(1500);
    await tryPlay(page);

    const startedAt = Date.now();
    let played = false;

    while (Date.now() - startedAt < CONFIG.MAX_SESSION_MS) {
      const body = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      const url = page.url();

      if (isBlockedText(body + " " + url)) {
        const img = await getScreenshotData(page);
        updateTile(slot, {
          status: "Blocked / unavailable",
          image: img
        });

        state.blocked++;
        log("Blocked/unavailable: " + proxyObj.display, "warn");
        await context.close();
        activeContexts = activeContexts.filter(x => x !== context);
        return;
      }

      await tryPlay(page);

      const img = await getScreenshotData(page);
      updateTile(slot, {
        status: "Testing playback",
        image: img
      });

      played = await videoPlayed(page);

      if (played) {
        updateTile(slot, {
          status: "PLAYING",
          image: img
        });

        state.playing++;
        log("Playing detected: " + proxyObj.display, "success");
        await context.close();
        activeContexts = activeContexts.filter(x => x !== context);
        return;
      }

      await page.waitForTimeout(1500);
    }

    const img = await getScreenshotData(page);
    updateTile(slot, {
      status: "No playback",
      image: img
    });

    state.failed++;
    log("No playback: " + proxyObj.display, "error");

    await context.close();
    activeContexts = activeContexts.filter(x => x !== context);
  } catch (err) {
    try {
      if (context) await context.close();
    } catch {}

    activeContexts = activeContexts.filter(x => x !== context);

    updateTile(slot, {
      proxy: proxyObj.display,
      status: "Failed",
      image: ""
    });

    state.failed++;
    log("Failed: " + proxyObj.display + " | " + err.message, "error");
  }
}

async function runPool(proxies) {
  let index = 0;

  async function worker(slot) {
    while (running && index < proxies.length) {
      const proxyObj = proxies[index++];

      state.currentProxy = proxyObj.display;
      broadcast("state", state);

      await testProxyBrowser(proxyObj, slot);

      state.tested++;
      broadcast("state", state);
    }

    updateTile(slot, {
      proxy: "",
      status: "Finished",
      image: ""
    });
  }

  const workers = [];
  const count = Math.min(CONFIG.PARALLEL_BROWSERS, proxies.length);

  for (let i = 1; i <= count; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);
}

app.post("/api/start", async (req, res) => {
  if (running) {
    return res.json({ ok: false, message: "Already running" });
  }

  resetState();

  CONFIG.TARGET_URL = req.body.targetUrl || CONFIG.TARGET_URL;

  const parallel = Number(req.body.parallelBrowsers || req.body.parallelTests || CONFIG.PARALLEL_BROWSERS);
  if (parallel >= 1 && parallel <= 8) CONFIG.PARALLEL_BROWSERS = parallel;

  const proxies = parseProxyList(req.body.proxies || "");

  if (!proxies.length) {
    return res.json({ ok: false, message: "No valid proxies found" });
  }

  running = true;
  state.active = true;
  state.total = proxies.length;
  broadcast("state", state);

  res.json({ ok: true, count: proxies.length });

  log("Render browser testing started.", "info");
  log("Target: " + CONFIG.TARGET_URL, "info");
  log("Parallel browsers: " + CONFIG.PARALLEL_BROWSERS, "info");

  await runPool(proxies);

  running = false;
  state.active = false;
  state.currentProxy = "";
  broadcast("state", state);

  await closeAllContexts();

  log("Testing finished.", "info");
});

app.post("/api/stop", async (req, res) => {
  running = false;
  await closeAllContexts();

  state.active = false;
  broadcast("state", state);

  log("Stopped by user.", "warn");
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "render-headless-browser-video-testing",
    port: PORT
  });
});


