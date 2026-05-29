const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

let sessions = [];
let uploadedProxies = [];

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.post("/upload-proxies", upload.single("proxyfile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No proxy file uploaded" });

  const content = fs.readFileSync(req.file.path, "utf8");
  uploadedProxies = content
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  fs.unlinkSync(req.file.path);
  res.json({ ok: true, count: uploadedProxies.length });
});

function parseProxy(proxyLine) {
  if (!proxyLine) return null;

  let line = proxyLine.trim();

  if (!line.startsWith("http://") && !line.startsWith("https://") && !line.startsWith("socks5://")) {
    line = "http://" + line;
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
    html,body{
      margin:0;
      width:100%;
      height:100%;
      background:#000;
      overflow:hidden;
      font-family:Arial,sans-serif;
    }
    video{
      width:100vw;
      height:100vh;
      object-fit:contain;
      background:#000;
    }
    .label{
      position:fixed;
      left:10px;
      top:10px;
      color:#fff;
      background:rgba(0,0,0,.7);
      padding:6px 10px;
      border-radius:8px;
      font-size:13px;
      z-index:10;
    }
    .note{
      position:fixed;
      left:10px;
      bottom:10px;
      right:10px;
      color:#fff;
      background:rgba(160,0,0,.75);
      padding:8px 10px;
      border-radius:8px;
      font-size:12px;
      z-index:10;
    }
  </style>
</head>
<body>
  <div class="label">Video test mode</div>
  <video src="${cleanUrl}" autoplay muted loop controls playsinline></video>
  <div class="note">If video is black, this URL may be download/protected/codec-blocked. Use direct .webm or direct playable .mp4.</div>
</body>
</html>`;
}

async function safeSetContent(page, html) {
  try {
    await page.goto("about:blank", { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch {}

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (err) {
    try {
      await page.evaluate((content) => {
        document.open();
        document.write(content);
        document.close();
      }, html);
    } catch {}
  }
}

app.post("/start", async (req, res) => {
  try {
    const { url, count } = req.body;

    if (!url) return res.status(400).json({ error: "URL required" });

    const browserCount = Math.min(Math.max(parseInt(count || 1), 1), 12);

    await stopAllSessions();

    for (let i = 0; i < browserCount; i++) {
      const proxyLine = uploadedProxies[i % uploadedProxies.length];
      const proxy = parseProxy(proxyLine);

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

      const browser = await chromium.launch(launchOptions);
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 }
      });

      sessions.push({
        id: i + 1,
        browser,
        page,
        proxy: proxyLine || "No proxy"
      });

      try {
        if (isVideoUrl(url)) {
          await safeSetContent(page, videoPlayerHtml(url));
        } else {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        }
      } catch (err) {
        await safeSetContent(
          page,
          `<html><body style="font-family:Arial;background:#111;color:#fff;padding:20px;">
            <h2 style="color:#ff4444;">Failed to open</h2>
            <p>${safeHtml(url)}</p>
            <pre style="white-space:pre-wrap;color:#ff9999;">${safeHtml(err.message)}</pre>
          </body></html>`
        );
      }
    }

    res.json({ ok: true, count: sessions.length });
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
        quality: 60,
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
