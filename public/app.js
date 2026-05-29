let timer = null;
let statsTimer = null;

function setStatus(msg) {
  document.getElementById("status").innerText = msg;
}

async function uploadProxies() {
  const file = document.getElementById("proxyfile").files[0];

  if (!file) {
    setStatus("Please select proxy file first.");
    return;
  }

  const form = new FormData();
  form.append("proxyfile", file);

  const res = await fetch("/upload-proxies", { method: "POST", body: form });
  const data = await res.json();

  if (data.ok) {
    setStatus(`Uploaded ${data.count} proxies.`);
    loadProxyStats();
  } else {
    setStatus(data.error || "Proxy upload failed.");
  }
}

async function loadProxyStats() {
  try {
    const res = await fetch("/proxy-stats");
    const s = await res.json();

    document.getElementById("proxyStats").innerHTML = `
      <b>Status:</b> ${s.status}<br>
      <b>Total proxies:</b> ${s.total}<br>
      <b>Opened browsers:</b> ${s.openedBrowsers}/${s.targetBrowsers}<br>
      <b>Last working:</b> ${s.lastWorking || "-"}<br>
      <b>Last error:</b> ${s.lastError || "-"}
    `;
  } catch {}
}

async function startTest() {
  const url = document.getElementById("url").value.trim();
  const count = document.getElementById("count").value;

  setStatus("Starting...");

  const res = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, count })
  });

  const data = await res.json();

  if (!data.ok) {
    setStatus(data.error || "Failed to start.");
    return;
  }

  setStatus(data.localMode ? "Real local browsers opened." : "Render screenshot browsers opened.");

  if (timer) clearInterval(timer);
  if (statsTimer) clearInterval(statsTimer);

  timer = setInterval(loadScreens, 1500);
  statsTimer = setInterval(loadProxyStats, 1000);

  loadScreens();
  loadProxyStats();
}

async function loadScreens() {
  const res = await fetch("/screens");
  const data = await res.json();

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  data.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("div");
    title.className = "title";
    title.innerText = `Browser ${item.id} | ${item.proxy}`;
    card.appendChild(title);

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      card.appendChild(img);
    } else {
      const err = document.createElement("pre");
      err.innerText = item.error || "No image";
      card.appendChild(err);
    }

    grid.appendChild(card);
  });
}

async function stopTest() {
  await fetch("/stop", { method: "POST" });

  if (timer) clearInterval(timer);
  if (statsTimer) clearInterval(statsTimer);

  timer = null;
  statsTimer = null;

  document.getElementById("grid").innerHTML = "";
  setStatus("Stopped.");
  loadProxyStats();
}

window.onload = loadProxyStats;
