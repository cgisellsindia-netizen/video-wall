const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 4000;
const LOCAL_REAL_BROWSER = process.env.LOCAL_REAL_BROWSER === "1";

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

let sessions = [];
let uploadedProxies = [];
let proxyIndex = 0;

let stats = {
  total: 0,
  tried: 0,
  working: 0,
  failed: 0,
  opened: 0,
  target: 0,
  lastWorking: "",
  lastError: "",
  status: "Ready"
};

app.get("/health", (req, res) => res.send("OK"));
app.get("/proxy-stats", (req, res) => res.json(stats));

app.post("/upload-proxies", upload.single("proxyfile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No proxy file uploaded" });

  const content = fs.readFileSync(req.file.path, "utf8");

  uploadedProxies = content
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  proxyIndex = 0;

  stats = {
    total: uploadedProxies.length,
    tried: 0,
    working: 0,
    failed: 0,
    opened: 0,
    target: 0,
    lastWorking: "",
    lastError: "",
    status: "Proxy file uploaded"
  };

  fs.unlinkSync(req.file.path);
  res.json({ ok: true, count: uploadedProxies.length });
});

function parseProxy(proxyLine) {
  if (!proxyLine) return null;

  let line = proxyLine.trim();

  if (
    !line.startsWith("http://") &&
    !line.startsWith("https://") &&
    !line.startsWith("socks4://") &&
    !line.startsWith("socks5://")
  ) {
    line = "socks5://" + line;
  }

  try {
    const u = new URL(line);
    const proxy = { server: `${u.protocol}//${u.hostname}:${u.port}` };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    return null;
  }
}

function getWindowPosition(id) {
  const w = 560;
  const h = 420;
  const gap = 20;
  const cols = 3;

  const index = id - 1;
  const x = 40 + (index % cols) * (w + gap);
  const y = 40 + Math.floor(index / cols) * (h + gap);

  return { x, y, w, h };
}

function isBadPageText(text) {
  const t = text.toLowerCase();

  return (
    t.includes("captcha") ||
    t.includes("verify you are human") ||
    t.includes("checking your browser") ||
    t.includes("cloudflare") ||
    t.includes("access denied") ||
    t.includes("unusual traffic") ||
    t.includes("robot") ||
    t.includes("blocked") ||
    t.includes("forbidden") ||
    t.includes("too many requests")
  );
}

async function checkPageGood(page) {
  try {
    await page.waitForTimeout(2500);

    const title = await page.title().catch(() => "");
    const body = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");

    if (isBadPageText(title) || isBadPageText(body)) {
      return { ok: false, reason: "CAPTCHA / block / verification detected" };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function openOneBrowser(url, proxyLine, id) {
  const proxy = parseProxy(proxyLine);
  const pos = getWindowPosition(id);

  const profilePath = path.join(__dirname, "profiles", "browser_" + id);
  fs.mkdirSync(profilePath, { recursive: true });

  const args = [
    `--window-size=${pos.w},${pos.h}`,
    `--window-position=${pos.x},${pos.y}`,
    "--autoplay-policy=no-user-gesture-required",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled"
  ];

  let context;

  if (LOCAL_REAL_BROWSER) {
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      proxy: proxy || undefined,
      viewport: { width: pos.w, height: pos.h },
      args
    });
  } else {
    const browser = await chromium.launch({
      headless: true,
      proxy: proxy || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required"
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    context._browserRef = browser;
  }

  const page = context.pages()[0] || await context.newPage();

  page.setDefaultTimeout(10000);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 15000
  });

  const check = await checkPageGood(page);

  if (!check.ok) {
    await context.close().catch(() => {});
    if (context._browserRef) await context._browserRef.close().catch(() => {});
    throw new Error(check.reason);
  }

  return { context, page };
}

async function openWithRetry(url, id) {
  const maxTry = uploadedProxies.length ? Math.min(uploadedProxies.length, 80) : 1;

  for (let i = 0; i < maxTry; i++) {
    const proxyLine = uploadedProxies.length
      ? uploadedProxies[proxyIndex++ % uploadedProxies.length]
      : null;

    stats.tried++;
    stats.status = `Browser ${id}: trying proxy ${stats.tried}/${stats.total || 1}`;

    try {
      const opened = await openOneBrowser(url, proxyLine, id);

      stats.working++;
      stats.opened++;
      stats.lastWorking = proxyLine || "No proxy";
      stats.status = `Opened browser ${stats.opened}/${stats.target}`;

      return {
        id,
        context: opened.context,
        page: opened.page,
        proxy: proxyLine || "No proxy"
      };

    } catch (err) {
      stats.failed++;
      stats.lastError = `${proxyLine || "No proxy"} => ${err.message}`;
    }
  }

  throw new Error("No working proxy found");
}

app.post("/start", async (req, res) => {
  try {
    const { url, count } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    await stopAllSessions();

    const browserCount = Math.min(Math.max(parseInt(count || 1), 1), 9);

    stats.target = browserCount;
    stats.opened = 0;
    stats.tried = 0;
    stats.working = 0;
    stats.failed = 0;
    stats.lastError = "";
    stats.lastWorking = "";
    stats.status = "Starting arranged browsers...";

    for (let i = 1; i <= browserCount; i++) {
      try {
        const session = await openWithRetry(url, i);
        sessions.push(session);
      } catch (err) {
        stats.lastError = `Browser ${i}: ${err.message}`;
      }
    }

    res.json({ ok: true, count: sessions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/screens", async (req, res) => {
  const result = [];

  for (const s of sessions) {
    try {
      const shot = await s.page.screenshot({
        type: "jpeg",
        quality: 60,
        fullPage: false,
        timeout: 8000
      });

      result.push({
        id: s.id,
        proxy: s.proxy,
        image: "data:image/jpeg;base64," + shot.toString("base64")
      });
    } catch (e) {
      result.push({
        id: s.id,
        proxy: s.proxy,
        error: e.message
      });
    }
  }

  res.json(result);
});

async function stopAllSessions() {
  for (const s of sessions) {
    try {
      await s.context.close();
      if (s.context._browserRef) await s.context._browserRef.close();
    } catch {}
  }

  sessions = [];
  stats.opened = 0;
}

app.post("/stop", async (req, res) => {
  await stopAllSessions();
  stats.status = "Stopped";
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
  console.log(`Mode: ${LOCAL_REAL_BROWSER ? "LOCAL REAL BROWSER" : "RENDER SCREENSHOT"}`);
});
