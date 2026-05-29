let timer = null;
let statsTimer = null;
let enlargedId = null;
let selectedBrowserId = null;

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
      <b>Total:</b> ${s.total} |
      <b>Tested:</b> ${s.tested} |
      <b>Active:</b> ${s.activeTests} |
      <b>Working:</b> ${s.working} |
      <b>Failed:</b> ${s.failed}<br>
      <b>Opened Browsers:</b> ${s.openedBrowsers}/${s.targetBrowsers}<br>
      <b>Last Working:</b> ${s.lastWorking || "-"}<br>
      <b>Last Error:</b> ${s.lastError || "-"}
    `;
  } catch {}
}

async function startTest() {
  const url = document.getElementById("url").value.trim();
  const count = document.getElementById("count").value;
  const concurrency = document.getElementById("concurrency").value;

  setStatus("Fast scanning started. Browser will open immediately when proxy works...");

  const res = await fetch("/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, count, concurrency })
  });

  const data = await res.json();

  if (!data.ok) {
    setStatus(data.error || "Failed to start.");
    return;
  }

  if (timer) clearInterval(timer);
  if (statsTimer) clearInterval(statsTimer);

  timer = setInterval(loadScreens, 1000);
  statsTimer = setInterval(loadProxyStats, 700);

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
    if (String(enlargedId) === String(item.id)) card.classList.add("enlarged");

    const title = document.createElement("div");
    title.className = "title";
    title.innerText = `Browser ${item.id} | ${item.proxy}`;
    card.appendChild(title);

    const help = document.createElement("div");
    help.className = "help";
    help.innerText = String(enlargedId) === String(item.id)
      ? "Interactive: click, type, scroll. Double-click title to reduce."
      : "Double-click to enlarge.";
    card.appendChild(help);

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;

      img.onclick = e => {
        selectedBrowserId = item.id;
        sendClick(item.id, e, img);
      };

      img.ondblclick = e => {
        e.preventDefault();
        e.stopPropagation();
        enlargedId = String(enlargedId) === String(item.id) ? null : item.id;
        selectedBrowserId = enlargedId ? item.id : null;
        loadScreens();
      };

      img.onwheel = e => {
        if (String(enlargedId) !== String(item.id)) return;
        e.preventDefault();
        selectedBrowserId = item.id;
        sendWheel(item.id, e.deltaY);
      };

      card.appendChild(img);
    } else {
      const err = document.createElement("pre");
      err.innerText = item.error || "No image";
      card.appendChild(err);
    }

    title.ondblclick = () => {
      enlargedId = String(enlargedId) === String(item.id) ? null : item.id;
      selectedBrowserId = enlargedId ? item.id : null;
      loadScreens();
    };

    grid.appendChild(card);
  });
}

function getImageCoords(e, img) {
  const rect = img.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 1280,
    y: ((e.clientY - rect.top) / rect.height) * 720
  };
}

async function sendClick(id, e, img) {
  await fetch(`/browser/${id}/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getImageCoords(e, img))
  });
}

async function sendWheel(id, deltaY) {
  await fetch(`/browser/${id}/wheel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deltaY })
  });
}

document.addEventListener("keydown", async e => {
  if (!selectedBrowserId || !enlargedId) return;

  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    await fetch(`/browser/${selectedBrowserId}/type`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: e.key })
    });
    return;
  }

  let key = e.key === " " ? "Space" : e.key;

  const allowed = ["Backspace","Enter","Tab","Escape","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Delete","Home","End","PageUp","PageDown","Space"];

  if (allowed.includes(key)) {
    e.preventDefault();
    await fetch(`/browser/${selectedBrowserId}/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
  }
});

async function stopTest() {
  await fetch("/stop", { method: "POST" });

  if (timer) clearInterval(timer);
  if (statsTimer) clearInterval(statsTimer);

  timer = null;
  statsTimer = null;
  enlargedId = null;
  selectedBrowserId = null;

  document.getElementById("grid").innerHTML = "";
  setStatus("Stopped.");
  loadProxyStats();
}

window.onload = loadProxyStats;
