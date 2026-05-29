const express = require("express");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { firefox, webkit } = require("playwright");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

let scanning = false;
let browser = null;

const activeTiles = new Map();

let tileQueue = [];
let tileQueueRunning = false;

const scanState = {
  total: 0,
  tested: 0,
  working: 0,
  failed: 0,
  blocked: 0,
  autoplayDetected: 0,
  active: false,
  currentProxy: "",
  logs: [],
  workingList: [],
  tiles: []
};

const SCAN_SESSION_FILE = path.join(__dirname, "scan-session.json");

const CONFIG = {
  TARGET_URL: "https://example.com",

  PARALLEL_TESTS: 8,
  PROXY_TIMEOUT_MS: 9000,

  MAX_BROWSER_TILES: 1,
  TILE_WIDTH: 260,
  TILE_HEIGHT: 420,
  TILE_TIMEOUT_MS: 35000,
  AUTOPLAY_DETECT_SECONDS: 3,
  CLOSE_TILE_AFTER_PLAY_MS: 6000,

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
    "sign in to confirm",
    "confirm you're not a bot"
  ]
};


function saveScanSession() {
  try {
    const lightState = {
      total: scanState.total,
      tested: scanState.tested,
      working: scanState.working,
      failed: scanState.failed,
      blocked: scanState.blocked,
      autoplayDetected: scanState.autoplayDetected || 0,
      active: scanState.active,
      currentProxy: scanState.currentProxy,
      workingList: (scanState.workingList || []).slice(0, 200),
      logs: (scanState.logs || []).slice(0, 120),
      tiles: [] // never save screenshots/base64 to disk
    };

    const data = {
      scanState: lightState,
      savedAt: new Date().toISOString()
    };

    fs.writeFileSync(SCAN_SESSION_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function loadScanSession() {
  try {
    if (!fs.existsSync(SCAN_SESSION_FILE)) return;

    const raw = fs.readFileSync(SCAN_SESSION_FILE, "utf8");
    const data = JSON.parse(raw);

    if (data && data.scanState) {
      Object.assign(scanState, data.scanState);

      // If server restarted, old scan is no longer truly active.
      scanState.active = false;
      scanState.currentProxy = "";
    }
  } catch {}
}

setInterval(saveScanSession, 1000);

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

  scanState.logs.unshift(line);
  if (scanState.logs.length > 150) scanState.logs.pop();

  console.log("[" + level + "] " + line.message);
  saveScanSession();
}

function resetScanState() {
  scanState.total = 0;
  scanState.tested = 0;
  scanState.working = 0;
  scanState.failed = 0;
  scanState.blocked = 0;
  scanState.autoplayDetected = 0;
  scanState.active = false;
  scanState.currentProxy = "";
  scanState.logs = [];
  scanState.workingList = [];
  scanState.tiles = [];
  tileQueue = [];
  tileQueueRunning = false;
}

function parseOneProxy(line) {
  line = String(line || "").trim();
  if (!line) return null;

  line = line.replace(/\s+/g, "");

  try {
    if (line.includes("://")) {
      return {
        display: line,
        url: line
      };
    }

    const parts = line.split(":");

    if (parts.length >= 4) {
      const ip = parts[0];
      const port = parts[1];
      const user = encodeURIComponent(parts[2]);
      const pass = encodeURIComponent(parts.slice(3).join(":"));

      return {
        display: line,
        url: `http://${user}:${pass}@${ip}:${port}`
      };
    }

    if (parts.length === 2) {
      return {
        display: line,
        url: `http://${parts[0]}:${parts[1]}`
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

function getAgent(proxyUrl) {
  if (proxyUrl.startsWith("socks4://") || proxyUrl.startsWith("socks5://")) {
    return new SocksProxyAgent(proxyUrl);
  }

  return new HttpsProxyAgent(proxyUrl);
}

function isBlocked(text) {
  const lower = String(text || "").toLowerCase();
  return CONFIG.BLOCK_WORDS.some(w => lower.includes(w));
}

async function testProxy(proxyObj) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.PROXY_TIMEOUT_MS);

  try {
    const agent = getAgent(proxyObj.url);

    const ipRes = await fetch("https://api.ipify.org?format=json", {
      agent,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!ipRes.ok) {
      clearTimeout(timeout);
      return {
        ok: false,
        reason: "IP check HTTP " + ipRes.status
      };
    }

    const ipText = await ipRes.text();

    let ip = "";
    try {
      ip = JSON.parse(ipText).ip || "";
    } catch {
      ip = ipText.trim();
    }

    if (!ip) {
      clearTimeout(timeout);
      return {
        ok: false,
        reason: "No IP returned"
      };
    }

    const targetRes = await fetch(CONFIG.TARGET_URL, {
      agent,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    });

    const body = await targetRes.text().catch(() => "");
    const finalUrl = targetRes.url || "";

    clearTimeout(timeout);

    if (isBlocked(body + " " + finalUrl)) {
      return {
        ok: false,
        blocked: true,
        reason: "Blocked / unavailable",
        ip
      };
    }

    if (!targetRes.ok) {
      return {
        ok: false,
        reason: "Target HTTP " + targetRes.status,
        ip
      };
    }

    return {
      ok: true,
      ip
    };
  } catch (err) {
    clearTimeout(timeout);

    return {
      ok: false,
      reason: err.message || "Failed"
    };
  }
}

async function runPool(items, limit, worker) {
  let index = 0;

  async function runner() {
    while (scanning && index < items.length) {
      const current = index++;
      await worker(items[current], current);
    }
  }

  const workers = [];
  const count = Math.min(limit, items.length);

  for (let i = 0; i < count; i++) {
    workers.push(runner());
  }

  await Promise.all(workers);
}

function saveWorkingProxy(proxyObj, ip) {
  try {
    const line = `${proxyObj.display} | IP: ${ip || "unknown"} | ${new Date().toISOString()}\n`;
    fs.appendFileSync(path.join(__dirname, "working-proxies.txt"), line);
  } catch {}
}

function proxyForPlaywright(proxyObj) {
  const url = new URL(proxyObj.url);

  const proxy = {
    server: url.protocol + "//" + url.hostname + ":" + url.port
  };

  if (url.username) proxy.username = decodeURIComponent(url.username);
  if (url.password) proxy.password = decodeURIComponent(url.password);

  return proxy;
}

async function ensureBrowser() {
  if (browser) return browser;

  try {
    browser = await firefox.launch({
      headless: true
    });

    log("Browser engine started: Firefox", "success");
    return browser;
  } catch (err) {
    log("Firefox failed. Trying WebKit: " + err.message, "warn");
  }

  try {
    browser = await webkit.launch({
      headless: true
    });

    log("Browser engine started: WebKit", "success");
    return browser;
  } catch (err) {
    log("WebKit also failed: " + err.message, "error");
    throw err;
  }
}

function updateTile(tileId, patch) {
  const tile = scanState.tiles.find(t => t.id === tileId);

  if (tile) {
    Object.assign(tile, patch);
  }
}

function removeTile(tileId) {
  scanState.tiles = scanState.tiles.filter(t => t.id !== tileId);
}

async function handleConsentPage(page) {
  try {
    await page.waitForTimeout(800);

    const url = page.url().toLowerCase();
    const bodyText = await page.locator("body").innerText({ timeout: 1500 }).catch(() => "");
    const body = bodyText.toLowerCase();

    const isConsent =
      url.includes("consent.youtube.com") ||
      body.includes("before you continue") ||
      body.includes("bevor sie") ||
      body.includes("cookies") ||
      body.includes("alle akzeptieren") ||
      body.includes("accept all");

    if (!isConsent) return false;

    const texts = [
      "Accept all",
      "I agree",
      "Agree",
      "Alle akzeptieren",
      "Akzeptieren",
      "Einverstanden",
      "Reject all",
      "Alle ablehnen"
    ];

    for (const text of texts) {
      const btn = page.getByRole("button", { name: new RegExp(text, "i") });
      if (await btn.count().catch(() => 0)) {
        await btn.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2000);
        return true;
      }
    }

    const clicked = await page.evaluate(() => {
      const words = [
        "accept all",
        "i agree",
        "agree",
        "alle akzeptieren",
        "akzeptieren",
        "einverstanden",
        "alle ablehnen",
        "reject all"
      ];

      const buttons = Array.from(document.querySelectorAll("button, div[role='button']"));

      for (const b of buttons) {
        const t = (b.innerText || b.textContent || "").toLowerCase().trim();
        if (words.some(w => t.includes(w))) {
          b.click();
          return true;
        }
      }

      return false;
    }).catch(() => false);

    if (clicked) {
      await page.waitForTimeout(2000);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function tryPlay(page) {
  try {
    await handleConsentPage(page);

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

    for (const selector of selectors) {
      const btn = await page.$(selector).catch(() => null);
      if (btn) {
        await btn.click({ timeout: 1000 }).catch(() => {});
      }
    }

    await page.keyboard.press("k").catch(() => {});
  } catch {}
}

async function getScreenshot(page) {
  try {
    const buf = await page.screenshot({
      type: "jpeg",
      quality: 25,
      fullPage: false
    });

    return "data:image/jpeg;base64," + buf.toString("base64");
  } catch {
    return "";
  }
}

async function getVideoTime(page) {
  return await page.evaluate(() => {
    const v = document.querySelector("video");
    if (!v) return 0;
    return Number(v.currentTime || 0);
  }).catch(() => 0);
}

async function closeTile(tileId) {
  const obj = activeTiles.get(tileId);
  if (!obj) return;

  try {
    clearInterval(obj.interval);
  } catch {}

  try {
    await obj.context.close();
  } catch {}

  activeTiles.delete(tileId);
  removeTile(tileId);
  processTileQueue();
  processTileQueue();

  processTileQueue();
}


function queueBrowserTile(item) {
  tileQueue.push(item);
  processTileQueue();
}

async function processTileQueue() {
  if (tileQueueRunning) return;

  tileQueueRunning = true;

  try {
    while (tileQueue.length > 0 && activeTiles.size < CONFIG.MAX_BROWSER_TILES) {
      const item = tileQueue.shift();

      if (!item) break;

      log("Opening browser tile from queue: " + item.display, "info");

      // Important: start tile directly here, do NOT queue again
      startBrowserTile(item);
    }
  } catch (err) {
    log("Tile queue error: " + err.message, "error");
  } finally {
    tileQueueRunning = false;
  }
}


function startTileWatchdog(tileId, seconds = 35) {
  setTimeout(async () => {
    const tile = scanState.tiles.find(t => t.id === tileId);
    if (!tile) return;

    const badStatuses = [
      "Opening browser",
      "Starting engine",
      "Creating browser context",
      "Loading page",
      "Testing autoplay"
    ];

    if (badStatuses.includes(tile.status) && Number(tile.currentTime || 0) === 0) {
      updateTile(tileId, {
        status: "Tile timeout - closing",
        image: ""
      });

      log("Tile stuck, closed to continue queue: " + (tile.proxy || ""), "warn");

      await closeTile(tileId);
    }
  }, seconds * 1000);
}

async function startBrowserTile(item) {
  if (activeTiles.size >= CONFIG.MAX_BROWSER_TILES) {
    log("Tile limit reached. Keeping proxy in working list only: " + item.display, "warn");
    return;
  }

  const tileId = "tile-" + Date.now() + "-" + Math.random().toString(16).slice(2);

  scanState.tiles.unshift({
    id: tileId,
    proxy: item.display,
    ip: item.ip,
    status: "Opening browser",
    image: "",
    currentTime: 0,
    autoplay: false
  });

  let context = null;
  let page = null;
  let interval = null;

  try {
    updateTile(tileId, { status: "Starting engine" });
    const b = await ensureBrowser();

    updateTile(tileId, { status: "Creating browser context" });

    context = await b.newContext({
      proxy: proxyForPlaywright(item),
      ignoreHTTPSErrors: true,
      viewport: {
        width: CONFIG.TILE_WIDTH,
        height: CONFIG.TILE_HEIGHT
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari/537.36"
    });

    updateTile(tileId, { status: "Creating page" });

    page = await context.newPage();

    page.setDefaultTimeout(CONFIG.TILE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(CONFIG.TILE_TIMEOUT_MS);

    activeTiles.set(tileId, {
      context,
      page,
      interval: null
    });

    updateTile(tileId, {
      status: "Loading page"
    });

    await page.goto(CONFIG.TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.TILE_TIMEOUT_MS
    });

    await page.waitForTimeout(1200);
    await tryPlay(page);

    updateTile(tileId, {
      status: "Testing autoplay",
      image: await getScreenshot(page)
    });

    interval = setInterval(async () => {
      try {
        await tryPlay(page);

        const body = await page.locator("body").innerText({ timeout: 800 }).catch(() => "");
        const url = page.url();

        if (isBlocked(body + " " + url)) {
          updateTile(tileId, {
            status: "Blocked / unavailable",
            image: await getScreenshot(page)
          });

          log("Tile blocked/unavailable: " + item.display, "warn");

          await closeTile(tileId);
          return;
        }

        const currentTime = await getVideoTime(page);
        const image = await getScreenshot(page);

        if (currentTime >= CONFIG.AUTOPLAY_DETECT_SECONDS) {
          updateTile(tileId, {
            status: "AUTOPLAY DETECTED",
            autoplay: true,
            currentTime,
            image
          });

          scanState.autoplayDetected++;

          log("AUTOPLAY DETECTED: " + item.display + " | time " + Math.round(currentTime) + "s", "success");

          setTimeout(() => {
            closeTile(tileId);
          }, CONFIG.CLOSE_TILE_AFTER_PLAY_MS);

          clearInterval(interval);
          return;
        }

        updateTile(tileId, {
          status: "Testing autoplay",
          currentTime,
          image
        });
      } catch (err) {
        updateTile(tileId, {
          status: "Tile error"
        });

        log("Tile error: " + item.display + " | " + err.message, "error");

        await closeTile(tileId);
      }
    }, 5000);

    activeTiles.set(tileId, {
      context,
      page,
      interval
    });
  } catch (err) {
    updateTile(tileId, {
      status: "Failed",
      image: ""
    });

    log("Tile failed: " + item.display + " | " + err.message, "error");

    try {
      if (context) await context.close();
    } catch {}

    activeTiles.delete(tileId);

    setTimeout(() => {
      removeTile(tileId);
  processTileQueue();

  processTileQueue();
}, 5000);
  }
}


async function emergencyCleanupTiles() {
  try {
    if (activeTiles.size <= CONFIG.MAX_BROWSER_TILES) return;

    const ids = Array.from(activeTiles.keys());
    while (activeTiles.size > CONFIG.MAX_BROWSER_TILES && ids.length) {
      const id = ids.shift();
      await closeTile(id);
    }
  } catch {}
}

setInterval(emergencyCleanupTiles, 10000);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/state", (req, res) => {
  saveScanSession();

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const safeState = {
    ...scanState,
    logs: (scanState.logs || []).slice(0, 150),
    workingList: (scanState.workingList || []).slice(0, 200),
    tiles: (scanState.tiles || []).slice(0, CONFIG.MAX_BROWSER_TILES)
  };

  res.json(safeState);
});

app.post("/api/start", async (req, res) => {
  if (scanning) {
    return res.json({
      ok: false,
      message: "Already running"
    });
  }

  resetScanState();

  CONFIG.TARGET_URL = req.body.targetUrl || CONFIG.TARGET_URL;

  const requestedParallel = Number(req.body.parallelTests || CONFIG.PARALLEL_TESTS);
  if (requestedParallel >= 1 && requestedParallel <= 100) {
    CONFIG.PARALLEL_TESTS = requestedParallel;
  }

  const requestedTiles = Number(req.body.maxBrowserTiles || CONFIG.MAX_BROWSER_TILES);
  if (requestedTiles >= 1 && requestedTiles <= 1) {
    CONFIG.MAX_BROWSER_TILES = requestedTiles;
  } else {
    CONFIG.MAX_BROWSER_TILES = 1;
  }

  const proxies = parseProxyList(req.body.proxies || "");

  if (!proxies.length) {
    return res.json({
      ok: false,
      message: "No valid proxies found"
    });
  }

  scanning = true;
  scanState.active = true;
  scanState.total = proxies.length;
  scanState.tested = 0;
  scanState.currentProxy = "";
  saveScanSession();

  res.json({
    ok: true,
    count: proxies.length
  });

  // Run scan in background so browser refresh does not stop it.
  setImmediate(async () => {
    try {
      log("Scanner started in background.", "info");
      log("Total proxies: " + proxies.length, "info");
      log("Parallel tests: " + CONFIG.PARALLEL_TESTS, "info");
      log("Max browser tiles: " + CONFIG.MAX_BROWSER_TILES, "info");
      log("Target URL: " + CONFIG.TARGET_URL, "info");

      await runPool(proxies, CONFIG.PARALLEL_TESTS, async (proxyObj) => {
        scanState.currentProxy = proxyObj.display;
        saveScanSession();

        const result = await testProxy(proxyObj);

        scanState.tested++;

        if (result.ok) {
          const item = {
            id: scanState.workingList.length,
            display: proxyObj.display,
            url: proxyObj.url,
            ip: result.ip || "",
            time: new Date().toLocaleTimeString()
          };

          scanState.working++;
          scanState.workingList.unshift(item);

          saveWorkingProxy(proxyObj, result.ip);

          log("WORKING: " + proxyObj.display + " | IP: " + result.ip, "success");

          queueBrowserTile(item);
        } else if (result.blocked) {
          scanState.blocked++;
          log("Blocked: " + proxyObj.display + " | " + result.reason, "warn");
        } else {
          scanState.failed++;
          log("Failed: " + proxyObj.display + " | " + result.reason, "error");
        }

        saveScanSession();
      });

      scanning = false;
      scanState.active = false;
      scanState.currentProxy = "";
      saveScanSession();

      log("Scanning finished.", "info");
    } catch (err) {
      scanning = false;
      scanState.active = false;
      scanState.currentProxy = "";
      log("Background scan error: " + err.message, "error");
      saveScanSession();
    }
  });
});

app.post("/api/stop", async (req, res) => {
  scanning = false;
  scanState.active = false;

  for (const tileId of Array.from(activeTiles.keys())) {
    await closeTile(tileId);
  }

  log("Stopped.", "warn");
  res.json({ ok: true });
});

app.get("/api/working", (req, res) => {
  const filePath = path.join(__dirname, "working-proxies.txt");

  if (!fs.existsSync(filePath)) {
    return res.type("text/plain").send("");
  }

  res.type("text/plain").send(fs.readFileSync(filePath, "utf8"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "auto-browser-tiles-autoplay-detected",
    port: PORT
  });
});

loadScanSession();

app.listen(PORT, () => {
  console.log("Auto browser tile scanner running on port " + PORT);
});







