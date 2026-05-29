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

  // supported:
  // http://user:pass@ip:port
  // http://ip:port
  // ip:port
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

function videoPlayerHtml(videoUrl) {
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
      background:rgba(0,0,0,.6);
      padding:6px 10px;
      border-radius:8px;
      font-size:13px;
      z-index:10;
    }
  </style>
</head>
<body>
  <div class="label">Video test mode</div>
  <video src="${videoUrl}" autoplay muted loop controls playsinline></video>
</body>
</html>`;
}

app.post("/start", async (req, res) => {
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

    try {
      if (isVideoUrl(url)) {
        await page.setContent(videoPlayerHtml(url), { waitUntil: "domcontentloaded" });
      } else {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      }
    } catch (err) {
      await page.setContent(`<h1 style="font-family:Arial;color:red;">Failed to open</h1><pre>${err.message}</pre>`);
    }

    sessions.push({
      id: i + 1,
      browser,
      page,
      proxy: proxyLine || "No proxy"
    });
  }

  res.json({ ok: true, count: sessions.length });
});

app.get("/screens", async (req, res) => {
  const result = [];

  for (const session of sessions) {
    try {
      const shot = await session.page.screenshot({
        type: "jpeg",
        quality: 60,
        fullPage: false
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

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
