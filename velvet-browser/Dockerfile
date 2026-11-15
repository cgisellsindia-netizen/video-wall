FROM mcr.microsoft.com/playwright:v1.56.1-noble
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends xvfb x11vnc xauth && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY velvet-browser/package.json ./package.json
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY velvet-browser/server.js ./server.js
COPY velvet-browser/index.html ./index.html
COPY velvet-browser/start.sh ./start.sh
RUN chmod 755 ./start.sh
ENV NODE_ENV=production
ENV DISPLAY=:99
EXPOSE 10000
CMD ["/bin/bash","/app/start.sh"]
