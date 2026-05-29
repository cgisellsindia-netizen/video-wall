const socket = io();
const grid = document.getElementById('grid');
const message = document.getElementById('message');
const statusBadge = document.getElementById('statusBadge');
const tiles = new Map();

function makeTile(session) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.innerHTML = `
    <div class="tile-head">
      <strong>${session.id}</strong>
      <span>${session.status}</span>
    </div>
    <div class="meta">${session.proxyLabel}</div>
    <img alt="Browser preview ${session.id}" />
  `;
  grid.appendChild(tile);
  tiles.set(session.id, tile);
  return tile;
}

socket.on('sessions', sessions => {
  statusBadge.textContent = sessions.length ? `${sessions.length} running` : 'Idle';

  const activeIds = new Set(sessions.map(s => s.id));
  for (const [id, tile] of tiles) {
    if (!activeIds.has(id)) {
      tile.remove();
      tiles.delete(id);
    }
  }

  sessions.forEach(session => {
    const tile = tiles.get(session.id) || makeTile(session);
    tile.querySelector('.tile-head span').textContent = session.status;
    tile.querySelector('.meta').textContent = session.proxyLabel;
  });
});

socket.on('tile-frame', ({ id, image }) => {
  const tile = tiles.get(id);
  if (tile) tile.querySelector('img').src = image;
});

socket.on('clear-tiles', () => {
  grid.innerHTML = '';
  tiles.clear();
});

document.getElementById('startBtn').addEventListener('click', async () => {
  message.textContent = 'Starting...';
  const body = {
    url: document.getElementById('urlInput').value,
    browserCount: Number(document.getElementById('countInput').value)
  };

  const res = await fetch('/api/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  message.textContent = data.message || data.error || 'Done';
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  const res = await fetch('/api/stop', { method: 'POST' });
  const data = await res.json();
  message.textContent = data.message || 'Stopped';
});
