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

  const res = await fetch("/upload-proxies", {
    method: "POST",
    body: form
  });

  const data = await res.json();

  if (data.ok) {
    setStatus(`Uploaded ${data.count} proxies. SOCKS4 supported.`);
    loadProxyStats();
  } else {
    setStatus(data.error || "Proxy upload failed.");
  }
}

async function loadProxyStats() {
  try {
    const res = await fetch("/proxy-stats");
    const s = await res.json();

    const box = document.getElementById("proxyStats");
    if (!box) return;

    box.innerHTML = `
      <b>Proxy Stats</b><br>
      Total: ${s.total} |
      Tried: ${s.tried} |
      Working: ${s.good} |
      Failed: ${s.bad}<br>
      Last Working: ${s.lastWorking || "-"}<br>
      Last Error: ${s.lastError || "-"}
    `;
  } catch {}
}

async function startTest() {
  const url = document.getElementById("url").value.trim();
  const count = document.getElementById("count").value;

  setStatus("Starting browsers. Proxies will keep trying until success...");

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

  enlargedId = null;
  selectedBrowserId = null;
  setStatus(`Started ${data.count} browser sessions. Double-click any tile to enlarge.`);

  if (timer) clearInterval(timer);
  if (statsTimer) clearInterval(statsTimer);

  timer = setInterval(loadScreens, 1200);
  statsTimer = setInterval(loadProxyStats, 1500);

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
    card.dataset.id = item.id;

    if (String(enlargedId) === String(item.id)) {
      card.classList.add("enlarged");
    }

    const title = document.createElement("div");
    title.className = "title";
    title.innerText = `Browser ${item.id} | ${item.proxy}`;
    card.appendChild(title);

    const help = document.createElement("div");
    help.className = "help";
    help.innerText = String(enlargedId) === String(item.id)
      ? "Interactive mode: click, type, scroll. Double-click top title to reduce."
      : "Double-click to enlarge.";
    card.appendChild(help);

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.dataset.id = item.id;

      img.addEventListener("click", function(e) {
        selectedBrowserId = item.id;
        sendClick(item.id, e, img);
      });

      img.addEventListener("dblclick", function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (String(enlargedId) === String(item.id)) {
          enlargedId = null;
          selectedBrowserId = null;
        } else {
          enlargedId = item.id;
          selectedBrowserId = item.id;
        }

        loadScreens();
      });

      img.addEventListener("wheel", function(e) {
        if (String(enlargedId) !== String(item.id)) return;
        e.preventDefault();
        selectedBrowserId = item.id;
        sendWheel(item.id, e.deltaY);
      }, { passive: false });

      card.appendChild(img);
    } else {
      const err = document.createElement("pre");
      err.innerText = item.error || "No image";
      card.appendChild(err);
    }

    title.addEventListener("dblclick", function() {
      if (String(enlargedId) === String(item.id)) {
        enlargedId = null;
        selectedBrowserId = null;
      } else {
        enlargedId = item.id;
        selectedBrowserId = item.id;
      }
      loadScreens();
    });

    grid.appendChild(card);
  });
}

function getImageCoords(e, img) {
  const rect = img.getBoundingClientRect();

  const x = ((e.clientX - rect.left) / rect.width) * 1280;
  const y = ((e.clientY - rect.top) / rect.height) * 720;

  return {
    x: Math.max(0, Math.min(1280, x)),
    y: Math.max(0, Math.min(720, y))
  };
}

async function sendClick(id, e, img) {
  const pos = getImageCoords(e, img);

  await fetch(`/browser/${id}/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pos)
  });
}

async function sendWheel(id, deltaY) {
  await fetch(`/browser/${id}/wheel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deltaY })
  });
}

document.addEventListener("keydown", async function(e) {
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

  const allowedKeys = [
    "Backspace", "Enter", "Tab", "Escape",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Delete", "Home", "End", "PageUp", "PageDown",
    "Space"
  ];

  let key = e.key;
  if (key === " ") key = "Space";

  if (allowedKeys.includes(key)) {
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
  setStatus("Stopped all browsers.");
  loadProxyStats();
}

window.addEventListener("load", loadProxyStats);
