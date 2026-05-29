const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const app = express();
const PORT = 4000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () => {
  console.log("Dashboard running: http://localhost:" + PORT);
});

const wss = new WebSocket.Server({ server });

let clients = [];
let running = false;

let testerContext = null;
let testerPages = [];
let workerBrowser = null;
let successContexts = [];

const state = {
  total: 0,
  tested: 0,
  success: 0,
  failed: 0,
  blocked: 0,
  skipped: 0,
  successWindows: 0,
  currentProxy: "",
  active: false,
  logs: []
};

const CONFIG = {
  TARGET_URL: "https://www.youtube.com",

  // Faster worker count
  TAB_TESTERS: 10,

  // Small visible tester app
  TESTER_WIDTH: 430,
  TESTER_HEIGHT: 300,
  TESTER_X: 10,
  TESTER_Y: 10,

  // Fast browser testing
  PAGE_LOAD_TIMEOUT_MS: 14000,
  TEST_WAIT_MS: 1200,

  // Success windows
  SUCCESS_WIDTH: 390,
  SUCCESS_HEIGHT: 680,
  SUCCESS_START_X: 460,
  SUCCESS_START_Y: 10,
  SUCCESS_GAP_X: 12,
  SUCCESS_GAP_Y: 20,
  SUCCESS_COLUMNS: 3,
  MAX_SUCCESS_WINDOWS: 8,

  // CPU save mode: close success window after playback/seconds
  AUTO_CLOSE_SUCCESS: true,
  AUTO_CLOSE_SUCCESS_MS: 45000,
  VIDEO_PLAY_DETECT_MS: 30000,

  // During testing, do not load heavy images/fonts.
  // In success windows media is allowed.
  FAST_MODE: true,

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
    "sign in to confirm you",
    "sign in to confirm you're not a bot",
    "confirm you're not a bot",
    "before you continue to youtube",
    "consent.youtube.com",
    "accounts.google.com",
    "our systems have detected unusual traffic",
    "this helps protect our community",
    "video unavailable",
    "this video is unavailable",
    "this video isn't available",
    "this video is not available",
    "video is unavailable",
    "this video may be inappropriate",
    "sign in to confirm your age",
    "this video is private",
    "this video has been removed"
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

function shortText(text, max = 180) {
  text = String(text || "").replace(/\s+/g, " ");
  if (text.length > max) return text.slice(0, max) + "...";
  return text;
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
  state.success = 0;
  state.failed = 0;
  state.blocked = 0;
  state.skipped = 0;
  state.successWindows = successContexts.length;
  state.currentProxy = "";
  state.active = false;
  state.logs = [];
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

async function makeTestPageFast(page) {
  if (!CONFIG.FAST_MODE) return;

  await page.route("**/*", async (route) => {
    const type = route.request().resourceType();

    // Test phase: block heavy things for speed.
    // Do not block script/xhr/document.
    if (["font"].includes(type)) {
      return route.abort();
    }

    return route.continue();
  });
}

async function makeSuccessPageFast(page) {
  if (!CONFIG.FAST_MODE) return;

  await page.route("**/*", async (route) => {
    const type = route.request().resourceType();

    // Success window: allow media, otherwise YouTube video will not play.
    if (["font"].includes(type)) {
      return route.abort();
    }

    return route.continue();
  });
}

async function detectBlocked(page) {
  try {
    const title = await page.title().catch(() => "");
    const body = await page.locator("body").innerText({ timeout: 1500 }).catch(() => "");
    const url = page.url();
    return isBlockedText(title + " " + body + " " + url);
  } catch {
    return true;
  }
}

async function forceYouTubePlay(page) {
  try {
    await page.waitForTimeout(1000);

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
      ".ytp-large-play-button",
      "button.ytp-play-button",
      "button[aria-label*='Play']",
      "button[title*='Play']"
    ];

    for (const selector of selectors) {
      const btn = await page.$(selector).catch(() => null);
      if (btn) {
        await btn.click({ timeout: 1000 }).catch(() => {});
      }
    }

    await page.keyboard.press("k").catch(() => {});

    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll("video"));
      for (const v of videos) {
        try {
          v.muted = true;
          v.volume = 0;
          v.play().catch(() => {});
        } catch {}
      }
    }).catch(() => {});
  } catch {}
}

async function setTabStatus(page, slot, status, proxy, color) {
  const safeProxy = String(proxy || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
    <html>
      <head><title>Tester ${slot}</title></head>
      <body style="font-family:Arial;background:#111;color:white;padding:6px;margin:0;font-size:11px;line-height:1.2;overflow:hidden;">
        <h4 style="margin:0 0 4px 0;font-size:12px;">Tab ${slot}</h4>
        <div style="font-size:11px;color:${color};font-weight:bold;">${status}</div>
        <p style="word-break:break-all;margin:3px 0;font-size:10px;">${safeProxy}</p>
      </body>
    </html>
  `;

  await page.goto("data:text/html," + encodeURIComponent(html)).catch(() => {});
}

async function closeTesterWindow() {
  try {
    if (testerContext) await testerContext.close();
  } catch {}

  testerContext = null;
  testerPages = [];
}

async function createTesterWindow() {
  await closeTesterWindow();

  const profileDir = path.join(__dirname, "chrome-profiles", "tester-" + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  testerContext = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: {
      width: CONFIG.TESTER_WIDTH,
      height: CONFIG.TESTER_HEIGHT
    },
    ignoreHTTPSErrors: true,
    args: [
      "--test-type",
      "--window-size=" + CONFIG.TESTER_WIDTH + "," + CONFIG.TESTER_HEIGHT,
      "--window-position=" + CONFIG.TESTER_X + "," + CONFIG.TESTER_Y,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--disable-notifications"
    ]
  });

  testerPages = [];

  let first = testerContext.pages()[0];
  if (!first) first = await testerContext.newPage();

  testerPages.push(first);

  for (let i = 1; i < CONFIG.TAB_TESTERS; i++) {
    testerPages.push(await testerContext.newPage());
  }

  for (let i = 0; i < testerPages.length; i++) {
    await setTabStatus(testerPages[i], i + 1, "Ready", "Waiting...", "#73a7ff");
  }

  log("Tester window opened with " + CONFIG.TAB_TESTERS + " status tabs.", "success");
}

async function createWorkerBrowser() {
  try {
    if (workerBrowser) await workerBrowser.close();
  } catch {}

  workerBrowser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--test-type",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      "--autoplay-policy=no-user-gesture-required"
    ]
  });
}

async function closeWorkerBrowser() {
  try {
    if (workerBrowser) await workerBrowser.close();
  } catch {}

  workerBrowser = null;
}

async function testProxyFast(proxyObj, slotIndex) {
  const slotPage = testerPages[slotIndex];

  await setTabStatus(slotPage, slotIndex + 1, "Testing", proxyObj.display, "#f0a500");

  let context = null;

  try {
    context = await workerBrowser.newContext({
      proxy: proxyForPlaywright(proxyObj),
      ignoreHTTPSErrors: true,
      viewport: {
        width: 360,
        height: 420
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36"
    });

    const page = await context.newPage();

    page.setDefaultTimeout(CONFIG.PAGE_LOAD_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_LOAD_TIMEOUT_MS);

    await makeTestPageFast(page);

    await page.goto(CONFIG.TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.PAGE_LOAD_TIMEOUT_MS
    });

    await page.waitForTimeout(CONFIG.TEST_WAIT_MS);

    if (page.url() === "about:blank") {
      await context.close();
      await setTabStatus(slotPage, slotIndex + 1, "Failed", proxyObj.display, "#ff4d4d");
      return { ok: false, reason: "about:blank" };
    }

    const blocked = await detectBlocked(page);

    await context.close();

    if (blocked) {
      await setTabStatus(slotPage, slotIndex + 1, "Blocked", proxyObj.display, "#f0a500");
      return { ok: false, blocked: true, reason: "blocked/captcha" };
    }

    await setTabStatus(slotPage, slotIndex + 1, "SUCCESS", proxyObj.display, "#19c37d");
    return { ok: true };
  } catch (err) {
    try {
      if (context) await context.close();
    } catch {}

    await setTabStatus(slotPage, slotIndex + 1, "Failed", proxyObj.display, "#ff4d4d");

    return {
      ok: false,
      reason: shortText(err.message || "failed", 100)
    };
  }
}

function successWindowPosition(index) {
  const col = index % CONFIG.SUCCESS_COLUMNS;
  const row = Math.floor(index / CONFIG.SUCCESS_COLUMNS);

  return {
    x: CONFIG.SUCCESS_START_X + col * (CONFIG.SUCCESS_WIDTH + CONFIG.SUCCESS_GAP_X),
    y: CONFIG.SUCCESS_START_Y + row * (CONFIG.SUCCESS_HEIGHT + CONFIG.SUCCESS_GAP_Y)
  };
}


async function waitForVideoThenClose(ctx, page, proxyDisplay) {
  if (!CONFIG.AUTO_CLOSE_SUCCESS) return;

  try {
    const startTime = Date.now();
    let realPlayed = false;
    let closed = false;

    while (Date.now() - startTime < CONFIG.VIDEO_PLAY_DETECT_MS) {
      // First check YouTube unavailable / blocked pages
      const pageText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      const pageUrl = page.url();

      if (isBlockedText(pageText + " " + pageUrl)) {
        log("Video unavailable/blocked. Closing window: " + proxyDisplay, "warn");

        try { await ctx.close(); } catch {}

        successContexts = successContexts.filter(x => x !== ctx);
        state.successWindows = successContexts.length;
        state.blocked++;
        broadcast("state", state);

        closed = true;
        return;
      }

      // Real playback means video currentTime moved above 5 seconds.
      realPlayed = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll("video"));

        return videos.some(v => {
          try {
            return Number(v.currentTime || 0) >= 5 && v.readyState >= 2;
          } catch {
            return false;
          }
        });
      }).catch(() => false);

      if (realPlayed) {
        break;
      }

      // Try to start muted playback again
      await forceYouTubePlay(page).catch(() => {});

      await page.waitForTimeout(1000);
    }

    if (closed) return;

    if (realPlayed) {
      log("Real video playback detected for 5 seconds. Closing to save CPU: " + proxyDisplay, "success");
    } else {
      log("Video did not really play. Closing after CPU timeout: " + proxyDisplay, "warn");
    }

    await ctx.close();

    successContexts = successContexts.filter(x => x !== ctx);
    state.successWindows = successContexts.length;
    broadcast("state", state);
  } catch (err) {
    try { await ctx.close(); } catch {}

    successContexts = successContexts.filter(x => x !== ctx);
    state.successWindows = successContexts.length;
    broadcast("state", state);
  }
}




async function openSuccessWindow(proxyObj) {
  if (successContexts.length >= CONFIG.MAX_SUCCESS_WINDOWS) {
    state.skipped++;
    return;
  }

  const index = successContexts.length;
  const pos = successWindowPosition(index);

  const profileDir = path.join(
    __dirname,
    "chrome-profiles",
    "success-" + Date.now() + "-" + Math.random().toString(16).slice(2)
  );

  fs.mkdirSync(profileDir, { recursive: true });

  try {
    const ctx = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: false,
      viewport: {
        width: CONFIG.SUCCESS_WIDTH,
        height: CONFIG.SUCCESS_HEIGHT
      },
      proxy: proxyForPlaywright(proxyObj),
      ignoreHTTPSErrors: true,
      args: [
        "--test-type",
        "--autoplay-policy=no-user-gesture-required",
        "--window-size=" + CONFIG.SUCCESS_WIDTH + "," + CONFIG.SUCCESS_HEIGHT,
        "--window-position=" + pos.x + "," + pos.y,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-notifications",
        "--disable-background-networking",
        "--disable-sync",
        "--metrics-recording-only"
      ]
    });

    successContexts.push(ctx);
    state.successWindows = successContexts.length;
    broadcast("state", state);

    log("Success window launched instantly: " + proxyObj.display, "success");

    const page = ctx.pages()[0] || await ctx.newPage();
    page.setDefaultTimeout(CONFIG.PAGE_LOAD_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_LOAD_TIMEOUT_MS);

    await makeSuccessPageFast(page);

    await page.goto(CONFIG.TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.PAGE_LOAD_TIMEOUT_MS
    });

    await page.waitForTimeout(800);
    await forceYouTubePlay(page);

    const blocked = await detectBlocked(page);

    if (blocked) {
      await ctx.close();
      successContexts = successContexts.filter(x => x !== ctx);
      state.successWindows = successContexts.length;
      state.blocked++;
      broadcast("state", state);
      log("Success window blocked and closed: " + proxyObj.display, "warn");
      return;
    }

    log("Success window opened: " + proxyObj.display, "success");

    // Close this success window automatically to reduce CPU load
    waitForVideoThenClose(ctx, page, proxyObj.display);
  } catch (err) {
    state.failed++;
    log("Success window failed: " + proxyObj.display + " | " + shortText(err.message, 100), "error");
  }
}

async function runWorkers(proxies) {
  let index = 0;

  async function worker(slotIndex) {
    while (running && index < proxies.length) {
      if (successContexts.length >= CONFIG.MAX_SUCCESS_WINDOWS) {
        running = false;
        break;
      }

      const proxyObj = proxies[index++];

      state.currentProxy = proxyObj.display;
      broadcast("state", state);

      const result = await testProxyFast(proxyObj, slotIndex);

      state.tested++;

      if (result.ok) {
        state.success++;
        log("Success from tab " + (slotIndex + 1) + ". Launching window instantly.", "success");
        openSuccessWindow(proxyObj);
      } else if (result.blocked) {
        state.blocked++;
        log("Blocked: " + proxyObj.display, "warn");
      } else {
        state.failed++;
        log("Failed: " + proxyObj.display + " | " + result.reason, "error");
      }

      broadcast("state", state);
    }

    if (testerPages[slotIndex]) {
      await setTabStatus(testerPages[slotIndex], slotIndex + 1, "Finished", "No more proxies.", "#73a7ff");
    }
  }

  const workers = [];
  const count = Math.min(CONFIG.TAB_TESTERS, proxies.length);

  for (let i = 0; i < count; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);
}

async function closeSuccessWindows() {
  for (const ctx of successContexts) {
    try { await ctx.close(); } catch {}
  }

  successContexts = [];
  state.successWindows = 0;
  broadcast("state", state);
}

app.post("/api/start", async (req, res) => {
  try {
    if (running) {
      return res.json({ ok: false, message: "Already running" });
    }

    resetState();

    CONFIG.TARGET_URL = req.body.targetUrl || CONFIG.TARGET_URL;
    CONFIG.TESTER_WIDTH = Number(req.body.testerWidth || CONFIG.TESTER_WIDTH);
    CONFIG.TESTER_HEIGHT = Number(req.body.testerHeight || CONFIG.TESTER_HEIGHT);
    CONFIG.SUCCESS_WIDTH = Number(req.body.successWidth || CONFIG.SUCCESS_WIDTH);
    CONFIG.SUCCESS_HEIGHT = Number(req.body.successHeight || CONFIG.SUCCESS_HEIGHT);
    CONFIG.SUCCESS_COLUMNS = Number(req.body.successColumns || CONFIG.SUCCESS_COLUMNS);
    CONFIG.MAX_SUCCESS_WINDOWS = Number(req.body.maxSuccessWindows || CONFIG.MAX_SUCCESS_WINDOWS);
    CONFIG.FAST_MODE = req.body.fastMode === true;

    const requestedTabs = Number(req.body.testerTabs || CONFIG.TAB_TESTERS);
    if (requestedTabs >= 1 && requestedTabs <= 30) {
      CONFIG.TAB_TESTERS = requestedTabs;
    }

    const proxies = parseProxyList(req.body.proxies || "");

    if (!proxies.length) {
      return res.json({ ok: false, message: "No valid proxies found." });
    }

    running = true;
    state.active = true;
    state.total = proxies.length;
    broadcast("state", state);

    res.json({ ok: true, count: proxies.length });

    log("FAST MODE started. Proxies: " + proxies.length, "info");
    log("Worker tabs: " + CONFIG.TAB_TESTERS, "info");
    log("Target: " + CONFIG.TARGET_URL, "info");

    await createTesterWindow();
    await createWorkerBrowser();

    await runWorkers(proxies);

    await closeWorkerBrowser();

    running = false;
    state.active = false;
    state.currentProxy = "";
    state.successWindows = successContexts.length;
    broadcast("state", state);

    log("Testing finished.", "info");
  } catch (err) {
    running = false;
    state.active = false;
    await closeWorkerBrowser();
    log("Server error: " + shortText(err.message, 150), "error");
    broadcast("state", state);
  }
});

app.post("/api/stop", async (req, res) => {
  running = false;
  await closeWorkerBrowser();

  state.active = false;
  state.currentProxy = "";
  broadcast("state", state);

  log("Stopped. Success windows remain open.", "warn");
  res.json({ ok: true });
});

app.post("/api/close-success", async (req, res) => {
  await closeSuccessWindows();
  log("Closed all success windows.", "warn");
  res.json({ ok: true });
});

app.post("/api/close-all", async (req, res) => {
  running = false;

  await closeWorkerBrowser();
  await closeTesterWindow();
  await closeSuccessWindows();

  state.active = false;
  state.currentProxy = "";
  broadcast("state", state);

  log("Closed everything.", "warn");
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "fast-shared-worker-browser-success-windows",
    port: PORT
  });
});





