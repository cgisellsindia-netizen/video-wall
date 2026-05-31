const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const PORT = 8081;

function parseOneProxy(line) {
  line = String(line || '').trim();
  if (!line) return null;

  if (line.includes('://')) {
    try {
      const url = new URL(line);
      return { url: line, server: line };
    } catch { return null; }
  }

  const parts = line.split(':');
  if (parts.length >= 4) {
    return {
      url: `http://${parts[0]}:${parts[1]}`,
      server: `http://${parts[2]}:${parts.slice(3).join(':')}@${parts[0]}:${parts[1]}`
    };
  }
  if (parts.length === 2) {
    return { url: `http://${parts[0]}:${parts[1]}`, server: `http://${parts[0]}:${parts[1]}` };
  }
  return null;
}

function parseProxyList(raw) {
  return String(raw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(parseOneProxy).filter(Boolean);
}

function getAgent(proxyUrl) {
  if (proxyUrl.startsWith('socks4') || proxyUrl.startsWith('socks5')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

async function testProxy(targetUrl, proxyObj) {
  try {
    const agent = getAgent(proxyObj.server);
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      agent,
      timeout: 15000,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const ok = res.status >= 200 && res.status < 400;
    return { ok, statusCode: res.status, error: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, statusCode: 0, error: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { targetUrl, proxy } = JSON.parse(body);
        const proxyObj = parseOneProxy(proxy);
        if (!proxyObj) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid proxy format' }));
          return;
        }
        const result = await testProxy(targetUrl, proxyObj);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: result.ok, statusCode: result.statusCode, error: result.error, proxy: proxyObj.url }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/test-all' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { targetUrl, proxies: rawProxies } = JSON.parse(body);
        const proxies = parseProxyList(rawProxies);
        if (!proxies.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'No valid proxies' }));
          return;
        }

        const results = [];
        for (const proxyObj of proxies) {
          const result = await testProxy(targetUrl, proxyObj);
          results.push({
            proxy: proxyObj.url,
            ok: result.ok,
            statusCode: result.statusCode,
            error: result.error
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, results }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'proxy-tester.html'), (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Proxy tester running at http://localhost:' + PORT);
});

