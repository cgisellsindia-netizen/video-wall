(function () {
  const VIDEO_LINKS_STORAGE_KEY = 'video-wall-project-links';
  const VIDEO_PROJECT_STORAGE_KEY = 'video-wall-project-id';

  const config = window.__VIDEO_WALL_CONFIG__ || {};

  function splitVideoLinks(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((link) => link.trim())
      .filter(Boolean);
  }

  function parseYouTubeId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
      }
      if (parsed.hostname.includes('youtube.com')) {
        if (parsed.pathname.startsWith('/shorts/')) {
          return parsed.pathname.split('/')[2] || '';
        }
        if (parsed.pathname.startsWith('/embed/')) {
          return parsed.pathname.split('/')[2] || '';
        }
        return parsed.searchParams.get('v') || '';
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function parseVimeoId(url) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('vimeo.com')) return '';
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch (error) {
      return '';
    }
    return '';
  }

  function normalizeVideoItem(link, index) {
    const safeLink = String(link || '').trim();
    if (!safeLink) return null;

    const youtubeId = parseYouTubeId(safeLink);
    if (youtubeId) {
      return {
        title: 'YouTube video ' + (index + 1),
        source: 'https://www.youtube.com/embed/' + youtubeId + '?autoplay=1&mute=1&loop=1&playlist=' + youtubeId + '&playsinline=1&rel=0',
        type: 'iframe'
      };
    }

    const vimeoId = parseVimeoId(safeLink);
    if (vimeoId) {
      return {
        title: 'Vimeo video ' + (index + 1),
        source: 'https://player.vimeo.com/video/' + vimeoId + '?autoplay=1&muted=1&loop=1&autopause=0',
        type: 'iframe'
      };
    }

    return {
      title: 'Video ' + (index + 1),
      source: safeLink,
      type: 'video'
    };
  }

  function getQueryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function readSavedValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function writeSavedValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  }

  const initialProjectId = getQueryValue('projectId') || readSavedValue(VIDEO_PROJECT_STORAGE_KEY) || config.projectId || '';
  const initialLinks = getQueryValue('links') || readSavedValue(VIDEO_LINKS_STORAGE_KEY) || config.videoLinks || '';

  const app = document.getElementById('app');
  app.innerHTML = [
    '<main class="page">',
    '  <section class="hero">',
    '    <div>',
    '      <span class="eyebrow">Multi Video Render Page</span>',
    '      <h1>Run multiple video links on one website.</h1>',
    '      <p>Add the new project ID for this deployment, paste one video link per line, and the wall will auto-run supported videos.</p>',
    '    </div>',
    '    <div class="hero-meta">',
    '      <div class="stat"><strong id="project-id-stat"></strong><span>Project ID</span></div>',
    '      <div class="stat"><strong id="video-count-stat"></strong><span>Active videos</span></div>',
    '    </div>',
    '  </section>',
    '  <section class="controls">',
    '    <label class="field">',
    '      <span>Project ID</span>',
    '      <input id="project-id-input" type="text" placeholder="Enter the new project ID" />',
    '    </label>',
    '    <label class="field">',
    '      <span>Video links</span>',
    '      <textarea id="video-links-input" rows="8" placeholder="Paste one link per line&#10;https://www.youtube.com/watch?v=...&#10;https://example.com/video.mp4"></textarea>',
    '    </label>',
    '    <p class="hint">Supported: direct video files, YouTube, and Vimeo. You can also prefill this site from Render environment variables.</p>',
    '  </section>',
    '  <section class="video-grid" id="video-grid"></section>',
    '</main>'
  ].join('');

  const projectIdInput = document.getElementById('project-id-input');
  const videoLinksInput = document.getElementById('video-links-input');
  const projectIdStat = document.getElementById('project-id-stat');
  const videoCountStat = document.getElementById('video-count-stat');
  const videoGrid = document.getElementById('video-grid');

  projectIdInput.value = initialProjectId;
  videoLinksInput.value = initialLinks;

  function render() {
    const projectId = projectIdInput.value.trim();
    const links = videoLinksInput.value;
    const videoItems = splitVideoLinks(links)
      .map(normalizeVideoItem)
      .filter(Boolean);

    writeSavedValue(VIDEO_PROJECT_STORAGE_KEY, projectId);
    writeSavedValue(VIDEO_LINKS_STORAGE_KEY, links);

    projectIdStat.textContent = projectId || 'Not set';
    videoCountStat.textContent = String(videoItems.length);

    if (!videoItems.length) {
      videoGrid.innerHTML = [
        '<div class="empty-state">',
        '  <h2>No videos loaded yet</h2>',
        '  <p>Paste a few links above and they will appear here automatically.</p>',
        '</div>'
      ].join('');
      return;
    }

    videoGrid.innerHTML = videoItems.map(function (item) {
      return [
        '<article class="card">',
        '  <div class="card-head">',
        '    <h2>' + escapeHtml(item.title) + '</h2>',
        '    <span class="project-tag">' + escapeHtml(projectId || 'Project ID pending') + '</span>',
        '  </div>',
        item.type === 'iframe'
          ? '  <div class="video-frame"><iframe src="' + escapeAttribute(item.source) + '" title="' + escapeAttribute(item.title) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'
          : '  <video class="video-player" src="' + escapeAttribute(item.source) + '" controls autoplay muted loop playsinline></video>',
        '  <a class="link-button" href="' + escapeAttribute(item.source) + '" target="_blank" rel="noreferrer">Open source</a>',
        '</article>'
      ].join('');
    }).join('');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  projectIdInput.addEventListener('input', render);
  videoLinksInput.addEventListener('input', render);
  render();
})();
