const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4000;
const MAX_BROWSERS = Number(process.env.MAX_BROWSERS || 20);
const SCREENSHOT_INTERVAL_MS = Number(process.env.SCREENSHOT_INTERVAL_MS || 1500);
const HEADLESS = process.env.HEADLESS !== 'false';
const DEFAULT_URL = process.env.DEFAULT_URL || 'https://getcamigo.in';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

function parseProxy(line) {
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) return null;
  try {
    const u = new URL(raw);
    const proxy = { server: `${u.protocol}//${u.hostname}:${u.port}` };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    const parts = raw.split(':');
    if (parts.length === 2) return { server: `http://${raw}` };
    return null;
  }
}

function loadProxies() {
  const proxyPath = path.join(__dirname, 'proxies.txt');
  if (!fs.existsSync(proxyPath)) return [];
  return fs.readFileSync(proxyPath, 'utf8')
    .split(/\r?\n/)
    .map(parseProxy)
    .filter(Boolean);
}

function safeUrl(input) {
  try {
    const u = new URL(input);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function sessionSummary() {
  return Array.from(sessions.values()).map(s => ({
    id: s.id,
    url: s.url,
    proxyLabel: s.proxyLabel,
    status: s.status,
    createdAt: s.createdAt
  }));
}

async function startOneSession({ id, url, proxy }) {
  const proxyLabel = proxy ? proxy.server.replace(/\/\/.*@/, '//***@') : 'No proxy';
  const record = {
    id,
    url,
    proxyLabel,
    status: 'starting',
    createdAt: new Date().toISOString(),
    browser: null,
    page: null,
    timer: null
  };
  sessions.set(id, record);
  io.emit('sessions', sessionSummary());

  try {
    const launchOptions = { headless: HEADLESS };
    if (proxy) launchOptions.proxy = proxy;

    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    record.browser = browser;
    record.page = page;
    record.status = 'loading';
    io.emit('sessions', sessionSummary());

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    record.status = 'live';
    io.emit('sessions', sessionSummary());

    record.timer = setInterval(async () => {
      try {
        if (!sessions.has(id)) return;
        const buffer = await page.screenshot({ type: 'jpeg', quality: 55 });
        io.emit('tile-frame', { id, image: `data:image/jpeg;base64,${buffer.toString('base64')}` });
      } catch (err) {
        record.status = 'screenshot-error';
        io.emit('sessions', sessionSummary());
      }
    }, SCREENSHOT_INTERVAL_MS);
  } catch (err) {
    record.status = `error: ${err.message.slice(0, 120)}`;
    io.emit('sessions', sessionSummary());
  }
}

async function stopAllSessions() {
  const all = Array.from(sessions.values());
  sessions.clear();
  for (const s of all) {
    if (s.timer) clearInterval(s.timer);
    try {
      if (s.browser) await s.browser.close();
    } catch {}
  }
  io.emit('sessions', []);
  io.emit('clear-tiles');
}

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/status', (req, res) => {
  res.json({ running: sessions.size, maxBrowsers: MAX_BROWSERS, sessions: sessionSummary() });
});

app.post('/api/start', async (req, res) => {
  const url = safeUrl(req.body.url || DEFAULT_URL);
  const count = Number(req.body.browserCount || 1);

  if (!url) return res.status(400).json({ error: 'Invalid URL. Use http:// or https:// URL.' });
  if (!Number.isInteger(count) || count < 1) return res.status(400).json({ error: 'Browser count must be at least 1.' });
  if (count > MAX_BROWSERS) return res.status(400).json({ error: `Maximum ${MAX_BROWSERS} browsers allowed.` });

  await stopAllSessions();

  const proxies = loadProxies();
  for (let i = 0; i < count; i++) {
    const proxy = proxies.length ? proxies[i % proxies.length] : null;
    startOneSession({ id: `B${i + 1}`, url, proxy });
  }

  res.json({ ok: true, message: `Starting ${count} browser session(s).`, proxiesLoaded: proxies.length });
});

app.post('/api/stop', async (req, res) => {
  await stopAllSessions();
  res.json({ ok: true, message: 'All browser sessions stopped.' });
});

io.on('connection', socket => {
  socket.emit('sessions', sessionSummary());
});

process.on('SIGINT', async () => {
  await stopAllSessions();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});

