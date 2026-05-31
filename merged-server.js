const http = require('http');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8082;

function parseOneProxy(line) {
  line = String(line || '').trim();
  if (!line) return null;
  if (line.includes('://')) {
    try { new URL(line); return { url: line, server: line }; } catch { return null; }
  }
  const parts = line.split(':');
  if (parts.length >= 4) {
    return { url: 'http://' + parts[0] + ':' + parts[1], server: 'http://' + parts[2] + ':' + parts.slice(3).join(':') + '@' + parts[0] + ':' + parts[1] };
  }
  if (parts.length === 2) {
    return { url: 'http://' + parts[0] + ':' + parts[1], server: 'http://' + parts[0] + ':' + parts[1] };
  }
  return null;
}

function parseProxyList(raw) {
  const lines = String(raw || '').split(String.fromCharCode(10));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const p = parseOneProxy(t);
    if (p) out.push(p);
  }
  return out;
}

function getAgent(proxyUrl) {
  if (proxyUrl.startsWith('socks4') || proxyUrl.startsWith('socks5')) return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

async function testProxy(targetUrl, proxyObj) {
  try {
    const agent = getAgent(proxyObj.server);
    const res = await fetch(targetUrl, { method: 'HEAD', agent: agent, timeout: 15000, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const ok = res.status >= 200 && res.status < 400;
    return { ok: ok, statusCode: res.status, error: ok ? null : ('HTTP ' + res.status) };
  } catch (err) {
    return { ok: false, statusCode: 0, error: err.message };
  }
}


async function fetchGeonode() {
  try {
    const res = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc', { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map(item => item.ip && item.port ? item.ip + ':' + item.port : null).filter(Boolean);
  } catch { return []; }
}

async function fetchProxyScrape() {
  try {
    const res = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all', { timeout: 20000 });
    if (!res.ok) return [];
    const text = await res.text();
    return text.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l && l.includes(':'));
  } catch { return []; }
}

async function fetchProxyListDownload(type) {
  try {
    const res = await fetch('https://www.proxy-list.download/api/v1/get?type=' + type, { timeout: 20000 });
    if (!res.ok) return [];
    const text = await res.text();
    return text.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l && l.includes(':'));
  } catch { return []; }
}

async function fetchAllFreeProxies() {
  const results = await Promise.all([
    fetchGeonode(),
    fetchProxyScrape(),
    fetchProxyListDownload('http'),
    fetchProxyListDownload('socks4'),
    fetchProxyListDownload('socks5')
  ]);
  const all = results.flat();
  const seen = new Set();
  const unique = [];
  for (let i = 0; i < all.length; i++) {
    const key = all[i].toLowerCase().replace(new RegExp('^https?://'), '').replace(new RegExp('^socks[45]://'), '');
    if (!seen.has(key)) { seen.add(key); unique.push(all[i]); }
  }
  return unique;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://' + req.headers.host);

  if (url.pathname === '/api/test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const proxyObj = parseOneProxy(data.proxy);
        if (!proxyObj) { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Invalid proxy' })); return; }
        const result = await testProxy(data.targetUrl, proxyObj);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: result.ok, statusCode: result.statusCode, error: result.error, proxy: proxyObj.url }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message })); }
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'merged.html'), (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data);
    });
    return;
  }

  if (url.pathname === '/api/geonode' && req.method === 'GET') {
    try {
      const apiUrl = 'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc';
      const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
      if (!response.ok) { res.writeHead(502); res.end(JSON.stringify({ ok: false, error: 'Upstream error ' + response.status })); return; }
      const json = await response.json();
      const data = (json.data || []).map(item => (item.ip && item.port) ? (item.ip + ':' + item.port) : null).filter(Boolean);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count: data.length, proxies: data }));
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/proxies/all' && req.method === 'GET') {
    try {
      const proxies = await fetchAllFreeProxies();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count: proxies.length, proxies: proxies, sources: ['geonode','proxyscrape','proxy-list.download(http)','proxy-list.download(socks4)','proxy-list.download(socks5)'] }));
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }


  if (url.pathname === '/api/bot-test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const proxyObj = parseOneProxy(data.proxy);
        const targetUrl = data.targetUrl || 'https://emapp.cc/watch/';
        const profile = data.profile || 'naive';
        if (!proxyObj) { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Invalid proxy' })); return; }
        let browser;
        const result = { profile: profile, proxy: proxyObj.url, target: targetUrl, ok: false, blocked: false, captcha: false, cloudflare: false, botDetected: false, videoLoaded: false, videoPlaying: false, pageTitle: '', finalUrl: '', signals: [], error: null, loadTime: 0 };
        try {
          const startTime = Date.now();
          const launchOptions = { headless: profile === 'human' ? false : true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-blink-features=AutomationControlled'] };
          if (proxyObj.server.startsWith('socks')) { launchOptions.proxy = { server: proxyObj.server }; } else { launchOptions.proxy = { server: proxyObj.url }; }
          browser = await chromium.launch(launchOptions);
          let contextOptions = { viewport: profile === 'human' ? { width: 1920, height: 1080 } : { width: 1366, height: 768 }, locale: 'en-US', timezoneId: 'America/New_York' };
          if (profile === 'naive') { result.signals.push('profile:naive-headless'); }
          else if (profile === 'stealth') { contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; launchOptions.args.push('--disable-features=IsolateOrigins,site-per-process'); result.signals.push('profile:stealth-ua-spoof'); }
          else if (profile === 'human') { contextOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; contextOptions.viewport = { width: 1920, height: 1080 }; launchOptions.args.push('--disable-features=IsolateOrigins,site-per-process'); result.signals.push('profile:human-headed'); }
          const context = await browser.newContext(contextOptions);
          const page = await context.newPage();
          const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
          result.loadTime = Date.now() - startTime;
          await page.waitForTimeout(3000);
          const pageData = await page.evaluate(() => {
            const data = { title: document.title, url: window.location.href, bodyText: document.body ? document.body.innerText.toLowerCase() : '', videoCount: 0, videoPlaying: false, hasVideoElement: false, signals: [] };
            const videos = document.querySelectorAll('video');
            data.videoCount = videos.length;
            data.hasVideoElement = videos.length > 0;
            videos.forEach(v => { if (!v.paused && v.currentTime > 0) data.videoPlaying = true; });
            if (navigator.webdriver) data.signals.push('navigator-webdriver');
            if (window.outerWidth === 0 && window.outerHeight === 0) data.signals.push('no-outer-size');
            if (window.chrome && !window.chrome.runtime) data.signals.push('chrome-no-runtime');
            if (window.__cf_chl_jschl_tk__) data.signals.push('cloudflare-challenge');
            if (window.turnstile) data.signals.push('turnstile-detected');
            if (window.grecaptcha) data.signals.push('recaptcha-detected');
            if (document.querySelector('iframe[src*="challenges.cloudflare"]')) data.signals.push('cloudflare-iframe');
            if (document.querySelector('iframe[src*="captcha"]')) data.signals.push('captcha-iframe');
            const blockTexts = ['blocked', 'access denied', 'forbidden', 'captcha', 'verify you are human', 'checking your browser', 'security check', 'bot detected', 'automated'];
            blockTexts.forEach(text => { if (data.bodyText.includes(text)) data.signals.push('block-text:' + text); });
            return data;
          });
          result.pageTitle = pageData.title;
          result.finalUrl = pageData.url;
          result.videoLoaded = pageData.hasVideoElement;
          result.videoPlaying = pageData.videoPlaying;
          result.signals = result.signals.concat(pageData.signals);
          result.blocked = result.signals.some(s => s.includes('block-text') || s.includes('cloudflare'));
          result.captcha = result.signals.some(s => s.includes('captcha'));
          result.cloudflare = result.signals.some(s => s.includes('cloudflare'));
          result.botDetected = result.blocked || result.captcha || result.signals.includes('navigator-webdriver');
          result.ok = true;
          await browser.close();
          browser = null;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          if (browser) await browser.close();
          result.error = err.message;
          result.botDetected = true;
          result.signals.push('error:' + err.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message })); }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => { console.log('Merged app running at http://localhost:' + PORT); });
