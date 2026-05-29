const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

let sessions = [];
let uploadedProxies = [];
let proxyQueue = [];
let scanning = false;
let stopRequested = false;

let proxyStats = {
  total: 0,
  tested: 0,
  working: 0,
  failed: 0,
  activeTests: 0,
  openedBrowsers: 0,
  targetBrowsers: 0,
  lastWorking: "",
  lastError: "",
  status: "Idle"
};

app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/proxy-stats", (req, res) => res.json(proxyStats));

app.post("/upload-proxies", upload.single("proxyfile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No proxy file uploaded" });

  const content = fs.readFileSync(req.file.path, "utf8");

  uploadedProxies = content
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  proxyQueue = [...uploadedProxies];

  proxyStats = {
    total: uploadedProxies.length,
    tested: 0,
    working: 0,
    failed: 0,
    activeTests: 0,
    openedBrowsers: 0,
    targetBrowsers: 0,
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
    line = "socks4://" + line;
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

function safeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isVideoUrl(url) {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m3u8") || u.includes("pexels.com/download/video");
}

function videoPlayerHtml(videoUrl) {
  const cleanUrl = safeHtml(videoUrl);
  return `
<html>
<body style="margin:0;background:#000;overflow:hidden;">
  <video src="${cleanUrl}" autoplay muted loop controls playsinline style="width:100vw;height:100vh;object-fit:contain;background:#000;"></video>
</body>
</html>`;
}

async function safeSetContent(page, html) {
  try { await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 8000 }); } catch {}
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 8000 });
  } catch {
    try {
      await page.evaluate((content) => {
        document.open();
        document.write(content);
        document.close();
      }, html);
    } catch {}
  }
}

function launchOptions(proxyLine) {
  const proxy = parseProxy(proxyLine);

  const options = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio"
    ]
  };

  if (proxy) options.proxy = proxy;
  return options;
}

async function openBrowserWithProxy(proxyLine, url) {
  const browser = await chromium.launch(launchOptions(proxyLine));
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(12000);

  if (isVideoUrl(url)) {
    await safeSetContent(page, videoPlayerHtml(url));
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
  }

  return { browser, page };
}

async function testAndOpen(proxyLine, url) {
  proxyStats.activeTests++;

  try {
    const opened = await openBrowserWithProxy(proxyLine, url);

    if (stopRequested || sessions.length >= proxyStats.targetBrowsers) {
      try { await opened.browser.close(); } catch {}
      return;
    }

    sessions.push({
      id: sessions.length + 1,
      browser: opened.browser,
      page: opened.page,
      proxy: proxyLine || "No proxy"
    });

    proxyStats.working++;
    proxyStats.openedBrowsers = sessions.length;
    proxyStats.lastWorking = proxyLine || "No proxy";
    proxyStats.status = `Working proxy found. Opened browser ${sessions.length}/${proxyStats.targetBrowsers}`;

  } catch (err) {
    proxyStats.failed++;
    proxyStats.lastError = `${proxyLine} => ${err.message}`;
  } finally {
    proxyStats.tested++;
    proxyStats.activeTests--;
  }
}

async function scannerLoop(url, browserCount, concurrency) {
  scanning = true;
  stopRequested = false;
  proxyStats.status = "Scanning proxies...";

  const workers = [];

  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (!stopRequested && sessions.length < browserCount && proxyQueue.length > 0) {
        const proxyLine = proxyQueue.shift();
        await testAndOpen(proxyLine, url);
      }
    })());
  }

  await Promise.allSettled(workers);

  scanning = false;

  if (sessions.length >= browserCount) {
    proxyStats.status = "Target browsers opened";
  } else if (proxyQueue.length === 0) {
    proxyStats.status = "Finished. Not enough working proxies found";
  } else {
    proxyStats.status = "Stopped";
  }
}

app.post("/start", async (req, res) => {
  try {
    const { url, count, concurrency } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    await stopAllSessions();

    const browserCount = Math.min(Math.max(parseInt(count || 1), 1), 12);
    const scanConcurrency = Math.min(Math.max(parseInt(concurrency || 20), 1), 80);

    proxyQueue = uploadedProxies.length ? [...uploadedProxies] : [null];

    proxyStats.tested = 0;
    proxyStats.working = 0;
    proxyStats.failed = 0;
    proxyStats.activeTests = 0;
    proxyStats.openedBrowsers = 0;
    proxyStats.targetBrowsers = browserCount;
    proxyStats.lastWorking = "";
    proxyStats.lastError = "";
    proxyStats.status = "Starting fast proxy scan...";

    scannerLoop(url, browserCount, scanConcurrency);

    res.json({ ok: true, message: "Fast scan started" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/screens", async (req, res) => {
  const result = [];

  for (const session of sessions) {
    try {
      const shot = await session.page.screenshot({
        type: "jpeg",
        quality: 65,
        fullPage: false,
        timeout: 10000
      });

      result.push({
        id: session.id,
        proxy: session.proxy,
        image: "data:image/jpeg;base64," + shot.toString("base64")
      });
    } catch (e) {
      result.push({ id: session.id, proxy: session.proxy, error: e.message });
    }
  }

  res.json(result);
});

function findSession(id) {
  return sessions.find(s => String(s.id) === String(id));
}

app.post("/browser/:id/click", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });
    await session.page.mouse.click(Number(req.body.x), Number(req.body.y));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/browser/:id/type", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });
    await session.page.keyboard.type(String(req.body.text || ""), { delay: 15 });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/browser/:id/key", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });
    await session.page.keyboard.press(String(req.body.key));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/browser/:id/wheel", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });
    await session.page.mouse.wheel(0, Number(req.body.deltaY || 0));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function stopAllSessions() {
  stopRequested = true;

  for (const session of sessions) {
    try { await session.browser.close(); } catch {}
  }

  sessions = [];
  proxyStats.openedBrowsers = 0;
}

app.post("/stop", async (req, res) => {
  await stopAllSessions();
  proxyStats.status = "Stopped";
  res.json({ ok: true });
});

process.on("unhandledRejection", err => console.error("UNHANDLED:", err));
process.on("uncaughtException", err => console.error("UNCAUGHT:", err));

app.listen(PORT, () => console.log(`Dashboard running on http://localhost:${PORT}`));
