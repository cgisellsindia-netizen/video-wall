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
let proxyQueue = [];

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
  status: LOCAL_REAL_BROWSER ? "Local real browser mode" : "Render screenshot mode"
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

  proxyStats.total = uploadedProxies.length;
  proxyStats.tested = 0;
  proxyStats.working = 0;
  proxyStats.failed = 0;
  proxyStats.activeTests = 0;
  proxyStats.openedBrowsers = 0;
  proxyStats.lastWorking = "";
  proxyStats.lastError = "";
  proxyStats.status = "Proxy file uploaded";

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

function isVideoUrl(url) {
  const u = url.toLowerCase();
  return u.includes(".mp4") || u.includes(".webm") || u.includes(".mov") || u.includes(".m3u8") || u.includes("pexels.com/download/video");
}

function videoPlayerHtml(videoUrl) {
  return `
<html>
<body style="margin:0;background:#000;overflow:hidden;">
  <video src="${videoUrl}" autoplay muted loop controls playsinline style="width:100vw;height:100vh;object-fit:contain;background:#000;"></video>
</body>
</html>`;
}

async function openBrowser(proxyLine, url, id) {
  const proxy = parseProxy(proxyLine);

  const profilePath = path.join(__dirname, "profiles", "browser_" + id);
  fs.mkdirSync(profilePath, { recursive: true });

  const options = {
    headless: LOCAL_REAL_BROWSER ? false : true,
    viewport: { width: 1280, height: 720 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio"
    ]
  };

  if (proxy) options.proxy = proxy;

  let context;

  if (LOCAL_REAL_BROWSER) {
    context = await chromium.launchPersistentContext(profilePath, options);
  } else {
    const browser = await chromium.launch({
      headless: true,
      proxy: proxy || undefined,
      args: options.args
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    context._browserRef = browser;
  }

  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(15000);

  if (isVideoUrl(url)) {
    await page.setContent(videoPlayerHtml(url), { waitUntil: "domcontentloaded", timeout: 15000 });
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  }

  return { context, page };
}

app.post("/start", async (req, res) => {
  try {
    const { url, count } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    await stopAllSessions();

    const browserCount = Math.min(Math.max(parseInt(count || 1), 1), LOCAL_REAL_BROWSER ? 10 : 2);

    proxyStats.targetBrowsers = browserCount;
    proxyStats.openedBrowsers = 0;
    proxyStats.status = LOCAL_REAL_BROWSER
      ? "Opening real local browser windows..."
      : "Opening Render screenshot browsers...";

    const proxies = uploadedProxies.length ? uploadedProxies : [null];

    for (let i = 0; i < browserCount; i++) {
      const proxyLine = proxies[i % proxies.length];

      try {
        const opened = await openBrowser(proxyLine, url, i + 1);

        sessions.push({
          id: sessions.length + 1,
          context: opened.context,
          page: opened.page,
          proxy: proxyLine || "No proxy"
        });

        proxyStats.working++;
        proxyStats.openedBrowsers = sessions.length;
        proxyStats.lastWorking = proxyLine || "No proxy";
        proxyStats.status = `Opened ${sessions.length}/${browserCount}`;
      } catch (err) {
        proxyStats.failed++;
        proxyStats.lastError = `${proxyLine || "No proxy"} => ${err.message}`;
      }
    }

    res.json({ ok: true, count: sessions.length, localMode: LOCAL_REAL_BROWSER });
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

async function stopAllSessions() {
  for (const session of sessions) {
    try {
      await session.context.close();
      if (session.context._browserRef) await session.context._browserRef.close();
    } catch {}
  }

  sessions = [];
  proxyStats.openedBrowsers = 0;
}

app.post("/stop", async (req, res) => {
  await stopAllSessions();
  proxyStats.status = "Stopped";
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
  console.log(`Mode: ${LOCAL_REAL_BROWSER ? "LOCAL REAL BROWSER" : "RENDER SCREENSHOT"}`);
});
