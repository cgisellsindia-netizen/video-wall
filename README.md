# CGI Multi-IP Website Testing Dashboard

This package opens multiple isolated Playwright browser sessions and displays them as live screenshot tiles in one dashboard.

Use it only for your own website testing, QA, geo preview, uptime/debugging, and UI checks.

## Install

```bash
npm install
npm run install-browsers
```

## Run locally

```bash
npm start
```

Open:

```text
http://localhost:4000
```

## Add proxies

Edit `proxies.txt` and add one proxy per line:

```text
http://username:password@ip:port
http://ip:port
socks5://username:password@ip:port
```

If `proxies.txt` is empty, browsers will run without proxies.

## Render setup

Build command:

```bash
npm install && npx playwright install chromium
```

Start command:

```bash
npm start
```

Health check endpoint:

```text
/health
```

For uptime monitoring, ping only `/health`, not product pages.

## Environment variables

```text
PORT=4000
MAX_BROWSERS=20
SCREENSHOT_INTERVAL_MS=1500
HEADLESS=true
DEFAULT_URL=https://getcamigo.in
```

## Important

Do not use this to create fake traffic, fake SEO signals, ad fraud, fake views, or bypass website restrictions.
