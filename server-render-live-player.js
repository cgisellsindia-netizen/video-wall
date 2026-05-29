const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

let ffmpegProcess = null;

const state = {
  active: false,
  ready: false,
  videoUrl: "",
  proxy: "",
  mode: "copy",
  hlsUrl: "/hls/live/index.m3u8",
  logs: [],
  error: ""
};

function log(message, level = "info") {
  const line = {
    time: new Date().toLocaleTimeString(),
    level,
    message: String(message || "").slice(0, 500)
  };

  state.logs.unshift(line);
  if (state.logs.length > 150) state.logs.pop();

  console.log(`[${level}] ${line.message}`);
}

function proxyToFfmpeg(proxy) {
  proxy = String(proxy || "").trim();
  if (!proxy) return "";

  if (
    proxy.startsWith("http://") ||
    proxy.startsWith("https://") ||
    proxy.startsWith("socks5://") ||
    proxy.startsWith("socks4://")
  ) {
    return proxy;
  }

  const parts = proxy.split(":");

  if (parts.length >= 4) {
    const ip = parts[0];
    const port = parts[1];
    const user = encodeURIComponent(parts[2]);
    const pass = encodeURIComponent(parts.slice(3).join(":"));
    return `http://${user}:${pass}@${ip}:${port}`;
  }

  if (parts.length === 2) {
    return `http://${parts[0]}:${parts[1]}`;
  }

  return proxy;
}

function cleanHls() {
  const dir = path.join(__dirname, "public", "hls", "live");

  fs.rmSync(dir, {
    recursive: true,
    force: true
  });

  fs.mkdirSync(dir, {
    recursive: true
  });

  return dir;
}

function stopFfmpeg() {
  try {
    if (ffmpegProcess) {
      ffmpegProcess.kill("SIGKILL");
    }
  } catch {}

  ffmpegProcess = null;
  state.active = false;
  state.ready = false;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "live-player.html"));
});

app.get("/api/status", (req, res) => {
  const m3u8 = path.join(__dirname, "public", "hls", "live", "index.m3u8");
  state.ready = fs.existsSync(m3u8);

  res.setHeader("Cache-Control", "no-store");
  res.json({ ...state });
});

app.post("/api/start", (req, res) => {
  const videoUrl = String(req.body.videoUrl || "").trim();
  const proxy = String(req.body.proxy || "").trim();
  const mode = String(req.body.mode || "copy").trim();

  if (!videoUrl) {
    return res.json({
      ok: false,
      message: "Video URL missing"
    });
  }

  stopFfmpeg();

  const hlsDir = cleanHls();
  const outM3u8 = path.join(hlsDir, "index.m3u8");

  state.active = true;
  state.ready = false;
  state.videoUrl = videoUrl;
  state.proxy = proxy;
  state.mode = mode;
  state.error = "";
  state.logs = [];

  res.json({
    ok: true,
    hlsUrl: state.hlsUrl
  });

  log("Starting real HLS player.", "info");
  log("Input URL: " + videoUrl, "info");

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel", "warning",
    "-rw_timeout", "15000000",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-user_agent", "Mozilla/5.0"
  ];

  const proxyUrl = proxyToFfmpeg(proxy);

  if (proxyUrl) {
    args.push("-http_proxy", proxyUrl);
    log("Proxy enabled: " + proxy, "info");
  }

  args.push("-i", videoUrl);

  if (mode === "transcode") {
    args.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k"
    );
  } else {
    args.push("-c", "copy");
  }

  args.push(
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "8",
    "-hls_flags", "delete_segments+append_list+independent_segments",
    "-hls_segment_filename", path.join(hlsDir, "seg_%03d.ts"),
    outM3u8
  );

  ffmpegProcess = spawn("ffmpeg", args);

  ffmpegProcess.stderr.on("data", data => {
    const text = data.toString().trim();
    if (text) log(text, "ffmpeg");
  });

  ffmpegProcess.on("close", code => {
    log("FFmpeg stopped with code: " + code, code === 0 ? "info" : "error");

    state.active = false;

    if (code !== 0) {
      state.error = "FFmpeg stopped with code " + code;
    }

    ffmpegProcess = null;
  });

  ffmpegProcess.on("error", err => {
    state.active = false;
    state.error = err.message;
    log("FFmpeg error: " + err.message, "error");
    ffmpegProcess = null;
  });
});

app.post("/api/stop", (req, res) => {
  stopFfmpeg();
  log("Stopped by user.", "warn");
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: "real-live-hls-player-no-browser-tiles"
  });
});

app.listen(PORT, () => {
  console.log("Real live HLS player running on port " + PORT);
});
