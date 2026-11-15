FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
COPY velvet-browser/package.json ./package.json
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY velvet-browser/server.js ./server.js
COPY velvet-browser/index.html ./index.html
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
