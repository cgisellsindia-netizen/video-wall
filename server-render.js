const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () => {
  console.log("Render small dashboard running on port " + PORT);
});

const wss = new WebSocket.Server({ server });

let clients = [];
let running = false;

const state = {
  total: 0,
  tested: 0,
  working: 0,
  failed: 0,
  blocked: 0,
  currentProxy: "",
  active: false,
  logs: [],
  workingList: []
};

const CONFIG = {
  TARGET_URL: "https://example.com",
  PARALLEL_TESTS: 30,
  TIMEOUT_MS: 12000,

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
    "before you continue to youtube",
    "consent.youtube.com",
    "accounts.google.com",
    "video unavailable",
    "this video is unavailable",
    "this video isn't available",
    "this video has been removed",
    "this video is private"
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
  if (state.logs.length > 800) state.logs.pop();

  console.log("[" + level + "] " + line.message);
  broadcast("log", line);
  broadcast("state", state);
}

function resetState() {
  state.total = 0;
  state.tested = 0;
  state.working = 0;
  state.failed = 0;
  state.blocked = 0;
  state.currentProxy = "";
  state.active = false;
  state.logs = [];
  state.workingList = [];
}

function parseOneProxy(line) {
  line = String(line || "").trim();
  if (!line) return null;

  line = line.replace(/\s+/g, "");

  try {
    if (line.includes("://")) {
      return { display: line, url: line };
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

function saveWorkingProxy(proxyObj, ip) {
  const line = `${proxyObj.display} | IP: ${ip || "unknown"} | ${new Date().toISOString()}\n`;
  fs.appendFileSync(path.join(__dirname, "working-proxies.txt"), line);
}

async function testProxy(proxyObj) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const agent = getAgent(proxyObj.url);

    const ipRes = await fetch("https://api.ipify.org?format=json", {
      agent,
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0" }
    });

    if (!ipRes.ok) {
      clearTimeout(timeout);
      return { ok: false, reason: "IP check HTTP " + ipRes.status };
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
      return { ok: false, reason: "No IP returned" };
    }

    const targetRes = await fetch(CONFIG.TARGET_URL, {
      agent,
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0" }
    });

    const body = await targetRes.text().catch(() => "");
    const finalUrl = targetRes.url || "";

    clearTimeout(timeout);

    if (isBlocked(body + " " + finalUrl)) {
      return { ok: false, blocked: true, reason: "Blocked/CAPTCHA/Unavailable", ip };
    }

    if (!targetRes.ok) {
      return { ok: false, reason: "Target HTTP " + targetRes.status, ip };
    }

    return { ok: true, ip };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, reason: err.message || "Failed" };
  }
}

async function runPool(items, limit, worker) {
  let index = 0;

  async function runner() {
    while (running && index < items.length) {
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

app.post("/api/start", async (req, res) => {
  if (running) {
    return res.json({ ok: false, message: "Already running" });
  }

  resetState();

  CONFIG.TARGET_URL = req.body.targetUrl || CONFIG.TARGET_URL;

  const requestedParallel = Number(req.body.parallelTests || CONFIG.PARALLEL_TESTS);
  if (requestedParallel >= 1 && requestedParallel <= 100) {
    CONFIG.PARALLEL_TESTS = requestedParallel;
  }

  const proxies = parseProxyList(req.body.proxies || "");

  if (!proxies.length) {
    return res.json({ ok: false, message: "No valid proxies found" });
  }

  running = true;
  state.active = true;
  state.total = proxies.length;
  broadcast("state", state);

  res.json({ ok: true, count: proxies.length });

  log("Render small tester started.", "info");
  log("Total proxies: " + proxies.length, "info");
  log("Parallel tests: " + CONFIG.PARALLEL_TESTS, "info");
  log("Target URL: " + CONFIG.TARGET_URL, "info");

  await runPool(proxies, CONFIG.PARALLEL_TESTS, async (proxyObj) => {
    state.currentProxy = proxyObj.display;
    broadcast("state", state);

    const result = await testProxy(proxyObj);

    state.tested++;

    if (result.ok) {
      state.working++;
      state.workingList.unshift({
        proxy: proxyObj.display,
        ip: result.ip || "",
        time: new Date().toLocaleTimeString()
      });

      if (state.workingList.length > 200) state.workingList.pop();

      saveWorkingProxy(proxyObj, result.ip);

      log("WORKING INSTANT: " + proxyObj.display + " | IP: " + result.ip, "success");
    } else if (result.blocked) {
      state.blocked++;
      log("Blocked: " + proxyObj.display + " | " + result.reason, "warn");
    } else {
      state.failed++;
      log("Failed: " + proxyObj.display + " | " + result.reason, "error");
    }

    broadcast("state", state);
  });

  running = false;
  state.active = false;
  state.currentProxy = "";
  broadcast("state", state);

  log("Render testing finished.", "info");
});

app.post("/api/stop", async (req, res) => {
  running = false;
  state.active = false;
  broadcast("state", state);
  log("Stopped by user.", "warn");
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
    mode: "render-24x7-small-instant-working-proxy-tester",
    port: PORT
  });
});
