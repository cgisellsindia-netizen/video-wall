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
let goodProxies = [];
let badProxies = new Set();
let proxyPointer = 0;

let proxyStats = {
  total: 0,
  good: 0,
  bad: 0,
  tried: 0,
  lastWorking: "",
  lastError: ""
};

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/proxy-stats", (req, res) => {
  res.json(proxyStats);
});

app.post("/upload-proxies", upload.single("proxyfile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No proxy file uploaded" });

  const content = fs.readFileSync(req.file.path, "utf8");

  uploadedProxies = content
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  goodProxies = [];
  badProxies = new Set();
  proxyPointer = 0;

  proxyStats = {
    total: uploadedProxies.length,
    good: 0,
    bad: 0,
    tried: 0,
    lastWorking: "",
    lastError: ""
  };

  fs.unlinkSync(req.file.path);

  res.json({ ok: true, count: uploadedProxies.length });
});

function parseProxy(proxyLine) {
  if (!proxyLine) return null;

  let line = proxyLine.trim();

  // For your SOCKS4 proxies:
  // 1.2.3.4:1080 becomes socks4://1.2.3.4:1080
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

    const proxy = {
      server: `${u.protocol}//${u.hostname}:${u.port}`
    };

    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);

    return proxy;
  } catch {
    return null;
  }
}

function getNextProxy() {
  if (goodProxies.length > 0) {
    const p = goodProxies[proxyPointer % goodProxies.length];
    proxyPointer++;
    return p;
  }

  for (let i = 0; i < uploadedProxies.length; i++) {
    const p = uploadedProxies[proxyPointer % uploadedProxies.length];
    proxyPointer++;

    if (!badProxies.has(p)) {
      return p;
    }
  }

  return null;
}

function markGood(proxyLine) {
  if (!proxyLine) return;

  if (!goodProxies.includes(proxyLine)) {
    goodProxies.push(proxyLine);
  }

  badProxies.delete(proxyLine);

  proxyStats.good = goodProxies.length;
  proxyStats.bad = badProxies.size;
  proxyStats.lastWorking = proxyLine;
}

function markBad(proxyLine, error) {
  if (!proxyLine) return;

  badProxies.add(proxyLine);

  proxyStats.bad = badProxies.size;
  proxyStats.good = goodProxies.length;
  proxyStats.lastError = `${proxyLine} => ${error}`;
}

function isVideoUrl(url) {
  const u = url.toLowerCase();
  return (
    u.includes("pexels.com/download/video") ||
    u.includes(".mp4") ||
    u.includes(".webm") ||
    u.includes(".mov") ||
    u.includes(".m3u8")
  );
}

function safeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function videoPlayerHtml(videoUrl) {
  const cleanUrl = safeHtml(videoUrl);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden;font-family:Arial,sans-serif;}
    video{width:100vw;height:100vh;object-fit:contain;background:#000;}
    .label{position:fixed;left:10px;top:10px;color:#fff;background:rgba(0,0,0,.7);padding:6px 10px;border-radius:8px;font-size:13px;z-index:10;}
    .note{position:fixed;left:10px;bottom:10px;right:10px;color:#fff;background:rgba(160,0,0,.75);padding:8px 10px;border-radius:8px;font-size:12px;z-index:10;}
  </style>
</head>
<body>
  <div class="label">Video test mode</div>
  <video src="${cleanUrl}" autoplay muted loop controls playsinline></video>
  <div class="note">If video is black, use direct .webm or direct playable .mp4.</div>
</body>
</html>`;
}

async function safeSetContent(page, html) {
  try {
    await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch {}

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
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

function findSession(id) {
  return sessions.find(s => String(s.id) === String(id));
}

async function createBrowserWithProxy(url, sessionId) {
  const maxTries = uploadedProxies.length > 0 ? Math.min(uploadedProxies.length, 120) : 1;

  for (let attempt = 1; attempt <= maxTries; attempt++) {
    let proxyLine = null;
    let proxy = null;

    if (uploadedProxies.length > 0) {
      proxyLine = getNextProxy();
      proxy = parseProxy(proxyLine);
    }

    proxyStats.tried++;

    const launchOptions = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required",
        "--mute-audio"
      ]
    };

    if (proxy) launchOptions.proxy = proxy;

    let browser = null;

    try {
      browser = await chromium.launch(launchOptions);

      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 }
      });

      page.setDefaultTimeout(20000);

      if (isVideoUrl(url)) {
        await safeSetContent(page, videoPlayerHtml(url));
      } else {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
      }

      markGood(proxyLine);

      return {
        id: sessionId,
        browser,
        page,
        proxy: proxyLine || "No proxy",
        attempt
      };

    } catch (err) {
      if (browser) {
        try { await browser.close(); } catch {}
      }

      markBad(proxyLine, err.message);

      console.log(`Browser ${sessionId} proxy failed attempt ${attempt}: ${proxyLine || "No proxy"} | ${err.message}`);
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio"
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await safeSetContent(
    page,
    `<html><body style="background:#111;color:#fff;font-family:Arial;padding:20px;">
      <h2 style="color:#ff4444;">No working proxy found</h2>
      <p>Uploaded proxies: ${uploadedProxies.length}</p>
      <p>Tried: ${proxyStats.tried}</p>
      <p>Bad: ${proxyStats.bad}</p>
      <pre>${safeHtml(proxyStats.lastError)}</pre>
    </body></html>`
  );

  return {
    id: sessionId,
    browser,
    page,
    proxy: "No working proxy",
    attempt: maxTries
  };
}

app.post("/start", async (req, res) => {
  try {
    const { url, count } = req.body;

    if (!url) return res.status(400).json({ error: "URL required" });

    const browserCount = Math.min(Math.max(parseInt(count || 1), 1), 12);

    await stopAllSessions();

    for (let i = 0; i < browserCount; i++) {
      const session = await createBrowserWithProxy(url, i + 1);
      sessions.push(session);
    }

    res.json({
      ok: true,
      count: sessions.length,
      stats: proxyStats
    });

  } catch (err) {
    console.error("START ERROR:", err);
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
        timeout: 15000
      });

      result.push({
        id: session.id,
        proxy: session.proxy,
        image: "data:image/jpeg;base64," + shot.toString("base64")
      });

    } catch (e) {
      result.push({
        id: session.id,
        proxy: session.proxy,
        error: e.message
      });
    }
  }

  res.json(result);
});

app.post("/browser/:id/click", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });

    const { x, y } = req.body;
    await session.page.mouse.click(Number(x), Number(y));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/browser/:id/dblclick", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });

    const { x, y } = req.body;
    await session.page.mouse.dblclick(Number(x), Number(y));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/browser/:id/type", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });

    const { text } = req.body;
    await session.page.keyboard.type(String(text || ""), { delay: 20 });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/browser/:id/key", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });

    const { key } = req.body;
    await session.page.keyboard.press(String(key));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/browser/:id/wheel", async (req, res) => {
  try {
    const session = findSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Browser not found" });

    const { deltaY } = req.body;
    await session.page.mouse.wheel(0, Number(deltaY || 0));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function stopAllSessions() {
  for (const session of sessions) {
    try {
      await session.browser.close();
    } catch {}
  }
  sessions = [];
}

app.post("/stop", async (req, res) => {
  await stopAllSessions();
  res.json({ ok: true });
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
