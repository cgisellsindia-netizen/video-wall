(function () {
  const LOGIN_STORAGE_KEY = "video-wall-login-ok";
  const MAX_TILES = 50;
  const RETRY_DELAY_MS = 8000;
  const VIDEO_LINKS_STORAGE_KEY = 'video-wall-project-links';
  const VIDEO_PROJECT_STORAGE_KEY = 'video-wall-project-id';
  const CONTROLS_VISIBILITY_STORAGE_KEY = 'video-wall-project-controls-visible';
  const AUTO_REFRESH_MINUTES_STORAGE_KEY = 'video-wall-project-auto-refresh-minutes';
  const PROXY_LIST_STORAGE_KEY = 'video-wall-project-proxies';
  const PROXY_ENABLED_STORAGE_KEY = 'video-wall-project-proxy-enabled';

  const config = window.__VIDEO_WALL_CONFIG__ || {};
  const tileControllers = new Map();
  let autoRefreshTimer = null;

  /* ---------- proxy / ip rotation state ---------- */
  let proxyPool = [];
  let proxyRoundRobin = 0;
  let proxyEnabled = false;

  function parseProxyList(raw) {
    return String(raw || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function wrapUrlThroughProxy(rawUrl, proxyUrl) {
    if (!proxyUrl) return rawUrl;
    if (proxyUrl.indexOf("{url}") !== -1) {
      return proxyUrl.replace("{url}", encodeURIComponent(rawUrl));
    }
    return proxyUrl + encodeURIComponent(rawUrl);
  }

  function pickNextProxy() {
    if (!proxyPool.length) return "";
    const idx = proxyRoundRobin % proxyPool.length;
    proxyRoundRobin = (proxyRoundRobin + 1) % proxyPool.length;
    return proxyPool[idx];
  }

  /* ---------- original helpers ---------- */

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

  function readSavedFlag(key, fallbackValue) {
    try {
      const rawValue = localStorage.getItem(key);
      if (rawValue === null) return fallbackValue;
      return rawValue === 'true';
    } catch (error) {
      return fallbackValue;
    }
  }

  function writeSavedFlag(key, value) {
    try {
      localStorage.setItem(key, String(Boolean(value)));
    } catch (error) {}
  }

  function readSavedNumber(key, fallbackValue) {
    try {
      const rawValue = localStorage.getItem(key);
      if (!rawValue) return fallbackValue;
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function splitCameraConfig(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
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

  function inferSourceType(url) {
    const safeUrl = String(url || '').trim().toLowerCase();
    if (!safeUrl) return 'video';
    if (safeUrl.startsWith('rtsp://')) return 'rtsp';
    if (parseYouTubeId(safeUrl)) return 'youtube';
    if (parseVimeoId(safeUrl)) return 'vimeo';
    if (safeUrl.endsWith('.m3u8') || safeUrl.includes('.m3u8?')) return 'hls';
    if (safeUrl.endsWith('.mp4') || safeUrl.includes('.mp4?') || safeUrl.endsWith('.webm') || safeUrl.includes('.webm?') || safeUrl.endsWith('.ogg') || safeUrl.includes('.ogg?')) return 'video';
    if (safeUrl.startsWith('http://') || safeUrl.startsWith('https://')) return 'page';
    return 'video';
  }

  function buildEmbedUrl(source) {
    if (source.type === 'youtube') {
      const youtubeId = parseYouTubeId(source.url);
      if (!youtubeId) return '';
      return 'https://www.youtube.com/embed/' + youtubeId + '?autoplay=1&mute=1&loop=1&playlist=' + youtubeId + '&playsinline=1&rel=0';
    }
    if (source.type === 'vimeo') {
      const vimeoId = parseVimeoId(source.url);
      if (!vimeoId) return '';
      return 'https://player.vimeo.com/video/' + vimeoId + '?autoplay=1&muted=1&loop=1&autopause=0';
    }
    if (source.type === 'page') {
      return source.url;
    }
    return '';
  }

  function parseCameraLine(line, index) {
    const parts = String(line || '')
      .split('|')
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);

    if (!parts.length) return null;

    if (parts.length === 1) {
      return {
        title: 'Camera ' + (index + 1),
        sources: [{ url: parts[0], proxy: '' }]
      };
    }

    return {
      title: parts[0] || ('Camera ' + (index + 1)),
      sources: [{ url: parts[1], proxy: parts[2] || '' }]
    };
  }

  function normalizeCameras(rawConfig) {
    return splitCameraConfig(rawConfig)
      .slice(0, MAX_TILES)
      .map(parseCameraLine)
      .filter(Boolean)
      .map(function (camera, index) {
        return {
          id: 'camera-' + index,
          title: camera.title || ('Camera ' + (index + 1)),
          sources: camera.sources.map(function (source) {
            return {
              url: source.url || source, proxy: source.proxy || '', type: inferSourceType(source.url || source)
            };
          }).filter(function (source) {
            return Boolean(source.url);
          })
        };
      });
  }

  function padCameras(cameras) {
    const result = cameras.slice(0, MAX_TILES);
    while (result.length < MAX_TILES) {
      result.push(null);
    }
    return result;
  }

  const initialProjectId = getQueryValue('projectId') || readSavedValue(VIDEO_PROJECT_STORAGE_KEY) || config.projectId || '';
  const initialLinks = getQueryValue('links') || readSavedValue(VIDEO_LINKS_STORAGE_KEY) || config.videoLinks || '';
  const initialControlsVisible = readSavedFlag(CONTROLS_VISIBILITY_STORAGE_KEY, true);
  const initialAutoRefreshMinutes = readSavedNumber(AUTO_REFRESH_MINUTES_STORAGE_KEY, 0);
  const initialProxyList = getQueryValue('proxies') || readSavedValue(PROXY_LIST_STORAGE_KEY) || config.proxyList || '';
  const initialProxyEnabled = getQueryValue('proxy') === '1' ? true : (getQueryValue('proxy') === '0' ? false : readSavedFlag(PROXY_ENABLED_STORAGE_KEY, Boolean(config.proxyList)));

  /* seed proxy pool */
  proxyPool = parseProxyList(initialProxyList);
  proxyEnabled = initialProxyEnabled;
function showLoginPage() {
    app.innerHTML = [
      '<main class="login-page">',
      '  <section class="login-card">',
      '    <div class="login-logo">CGI</div>',
      '    <h1>Video Wall Login</h1>',
      '    <p>Enter your username and password to access the camera wall.</p>',
      '    <form id="login-form">',
      '      <label>Username</label>',
      '      <input id="login-username" type="text" placeholder="Enter username" autocomplete="username" />',
      '      <label>Password</label>',
      '      <input id="login-password" type="password" placeholder="Enter password" autocomplete="current-password" />',
      '      <button type="submit">Login</button>',
      '      <div id="login-error" class="login-error"></div>',
      '    </form>',
      '  </section>',
      '</main>'
    ].join("");

    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault();

      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value.trim();
      const error = document.getElementById("login-error");

      if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
        localStorage.setItem(LOGIN_STORAGE_KEY, "true");
        window.location.reload();
      } else {
        error.textContent = "Wrong username or password.";
      }
    });
  }
app.innerHTML = [
    '<main class="page">',
    '  <section class="toolbar">',
    '    <div class="toolbar-main">',
    '      <span class="eyebrow">Camera Wall</span>',
      '      <h1>50-camera customer demo wall</h1>',
    '      <p>Use direct camera streams, YouTube/Vimeo links, or embeddable camera pages here. One line per tile: <code>Camera Name|primary-url|backup-url-1|backup-url-2</code></p>',
    '    </div>',
    '    <div class="stat"><strong id="project-id-stat"></strong><span>Project ID</span></div>',
    '    <div class="stat"><strong id="video-count-stat"></strong><span>Active cameras</span></div>',
    '    <div class="stat"><strong id="network-stat"></strong><span>Network</span></div>',
    '    <div class="toolbar-actions">',
    '      <button type="button" class="toolbar-button" id="save-links-button">Save links</button>',
    '      <button type="button" class="toolbar-button" id="refresh-wall-button">Refresh wall</button>',
    '      <button type="button" class="toolbar-button" id="toggle-controls-button"></button>',
    '    </div>',
    '  </section>',
    '  <section class="controls" id="controls-panel">',
    '    <div class="controls-grid">',
    '      <div class="setup-side">',
    '        <label class="field">',
    '          <span>Project ID</span>',
    '          <input id="project-id-input" type="text" placeholder="Enter the project ID" />',
    '        </label>',
    '        <label class="field">',
    '          <span>Auto refresh</span>',
    '          <select id="auto-refresh-select">',
    '            <option value="0">Off</option>',
    '            <option value="1">Every 1 minute</option>',
    '            <option value="3">Every 3 minutes</option>',
    '            <option value="5">Every 5 minutes</option>',
    '            <option value="10">Every 10 minutes</option>',
    '            <option value="15">Every 15 minutes</option>',
    '          </select>',
    '        </label>',
    '        <div class="note"><strong>Best input:</strong> use browser-playable camera links such as HLS <code>.m3u8</code>, MP4, YouTube, Vimeo, or CCTV pages that allow iframe embedding.</div>',
    '        <div class="note"><strong>RTSP only if needed:</strong> browsers cannot play raw <code>rtsp://</code> directly, so those links need conversion through your NVR, gateway, or stream server.</div>',
    '        <div class="note"><strong>Background recovery:</strong> if a stream drops, stalls, or ends, the wall retries automatically. If the internet goes offline, the wall waits and refreshes again when the network comes back.</div>',
    '        <div class="save-message" id="save-message">Saved links load automatically in this browser.</div>',
    '      </div>',
    '      <div>',
    '        <label class="field">',
    '          <span>Camera config</span>',
    '          <textarea id="video-links-input" rows="12" placeholder="Front Gate|https://cams.example.com/frontgate.m3u8|https://backup.example.com/frontgate.m3u8&#10;Showroom 1|https://cams.example.com/showroom1.mp4&#10;Test Page|https://www.youtube.com/watch?v=dQw4w9WgXcQ&#10;Back Office|https://cams.example.com/backoffice.m3u8|https://backup.example.com/backoffice.m3u8"></textarea>',
'        </label>',
'        <label class="field">',
'          <span>Use proxy rotation</span>',
'          <label><input id="proxy-enabled-input" type="checkbox" /> Enable proxy</label>',
'        </label>',
'        <label class="field">',
'          <span>Proxy list (one per line, {url} substitution or prefix style)</span>',
'          <textarea id="proxy-list-input" rows="4" placeholder="https://proxy1.example.com/fetch?url={url}&#10;https://proxy2.example.com/fetch?url={url}&#10;https://proxy3.example.com/fetch?url={url}"></textarea>',
'        </label>',
'      </div>',
    '    </div>',
    '  </section>',
    '  <section class="wall-grid" id="video-grid"></section>',
    '  <div class="footer-note">The wall keeps retrying automatically after outages. Direct streams work best, and page links will work when the source site allows embedding.</div>',
    '</main>'
  ].join('');

  const projectIdInput = document.getElementById('project-id-input');
  const videoLinksInput = document.getElementById('video-links-input');
  const projectIdStat = document.getElementById('project-id-stat');
  const videoCountStat = document.getElementById('video-count-stat');
  const networkStat = document.getElementById('network-stat');
  const videoGrid = document.getElementById('video-grid');
  const controlsPanel = document.getElementById('controls-panel');
  const toggleControlsButton = document.getElementById('toggle-controls-button');
  const saveLinksButton = document.getElementById('save-links-button');
  const refreshWallButton = document.getElementById('refresh-wall-button');
  const autoRefreshSelect = document.getElementById('auto-refresh-select');
  const saveMessage = document.getElementById('save-message');
  const proxyListInput = document.getElementById('proxy-list-input');
  const proxyEnabledInput = document.getElementById('proxy-enabled-input');
  const proxyStatusNote = document.getElementById('proxy-status-note');

  projectIdInput.value = initialProjectId;
  videoLinksInput.value = initialLinks;
  autoRefreshSelect.value = String(initialAutoRefreshMinutes);
  proxyListInput.value = initialProxyList;
  proxyEnabledInput.checked = initialProxyEnabled;

  function applyControlsVisibility(visible) {
    controlsPanel.classList.toggle('is-hidden', !visible);
    toggleControlsButton.textContent = visible ? 'Hide setup' : 'Show setup';
    writeSavedFlag(CONTROLS_VISIBILITY_STORAGE_KEY, visible);
  }

  function cleanupTiles() {
    tileControllers.forEach(function (controller) {
      controller.destroy();
    });
    tileControllers.clear();
  }

  function setSaveMessage(message) {
    saveMessage.textContent = message;
  }

  function updateNetworkStat() {
    networkStat.textContent = navigator.onLine ? 'Online' : 'Offline';
    networkStat.parentElement.classList.toggle('stat-offline', !navigator.onLine);
  }

  function persistSettings(message) {
    writeSavedValue(VIDEO_PROJECT_STORAGE_KEY, projectIdInput.value.trim());
    writeSavedValue(VIDEO_LINKS_STORAGE_KEY, videoLinksInput.value);
    writeSavedValue(AUTO_REFRESH_MINUTES_STORAGE_KEY, autoRefreshSelect.value);
    writeSavedValue(PROXY_LIST_STORAGE_KEY, proxyListInput.value);
    writeSavedFlag(PROXY_ENABLED_STORAGE_KEY, proxyEnabledInput.checked);
    proxyPool = parseProxyList(proxyListInput.value);
    proxyEnabled = proxyEnabledInput.checked;
    if (message) setSaveMessage(message);
  }

  function clearAutoRefreshTimer() {
    if (autoRefreshTimer) {
      window.clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function scheduleAutoRefresh() {
    clearAutoRefreshTimer();
    const minutes = Number(autoRefreshSelect.value || 0);
    writeSavedValue(AUTO_REFRESH_MINUTES_STORAGE_KEY, String(minutes));
    if (!minutes) {
      setSaveMessage('Auto refresh is off. Saved links still load automatically.');
      return;
    }
    autoRefreshTimer = window.setInterval(function () {
  const LOGIN_STORAGE_KEY = "video-wall-login-ok";
      render();
      setSaveMessage('Wall auto-refreshed in the background.');
    }, minutes * 60 * 1000);
    setSaveMessage('Auto refresh is running every ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + '.');
  }

  function createPlaceholderTile(index) {
    return [
      '<article class="tile">',
      '  <div class="tile-head">',
      '    <div class="tile-title">',
      '      <strong>Camera ' + (index + 1) + '</strong>',
      '      <span class="tile-meta">Waiting for source</span>',
      '    </div>',
      '    <span class="tile-badge">Slot ' + (index + 1) + '</span>',
      '  </div>',
      '  <div class="tile-placeholder"><div><strong>Empty tile</strong><span>Add a stream line in setup to fill this square.</span></div></div>',
      '</article>'
    ].join('');
  }

  function createCameraTile(camera, index) {
    return [
      '<article class="tile" data-camera-id="' + escapeHtml(camera.id) + '">',
      '  <div class="tile-head">',
      '    <div class="tile-title">',
      '      <strong>' + escapeHtml(camera.title) + '</strong>',
      '      <span class="tile-meta">Source pool: ' + camera.sources.length + '</span>',
      '    </div>',
      '    <span class="tile-badge">Cam ' + (index + 1) + '</span>',
      '  </div>',
      '  <div class="tile-media" data-role="media"></div>',
      '  <div class="tile-foot">',
      '    <div>',
      '      <span class="tile-status" data-role="status">Starting...</span>',
      '      <span class="tile-source" data-role="source">No source loaded yet</span>',
      '    </div>',
      '    <div>',
      '      <span class="tile-proxy-badge" data-role="proxy" style="font-size:10px;color:rgba(255,255,255,0.5);display:block;margin-top:2px;"></span>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function setStatus(article, label, statusClass, sourceText, proxyText) {
    const statusNode = article.querySelector('[data-role="status"]');
    const sourceNode = article.querySelector('[data-role="source"]');
    if (statusNode) {
      statusNode.textContent = label;
      statusNode.className = 'tile-status ' + statusClass;
    }
    if (sourceNode) {
      sourceNode.textContent = sourceText || '';
    }
    if (proxyText !== undefined) {
      const proxyNode = article.querySelector('[data-role="proxy"]');
      if (proxyNode) proxyNode.textContent = proxyText;
    }
  }

  function createTileController(article, camera, tileIndex) {
    let sourceIndex = 0;
    let retryTimer = null;
    let hlsInstance = null;
    let currentVideo = null;

    function clearRetry() {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function destroyMedia() {
      clearRetry();
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.removeAttribute('src');
        currentVideo.load();
        currentVideo = null;
      }
      const mediaHost = article.querySelector('[data-role="media"]');
      if (mediaHost) mediaHost.innerHTML = '';
    }

    function scheduleNext(reason) {
      clearRetry();
      retryTimer = window.setTimeout(function () {
  const LOGIN_STORAGE_KEY = "video-wall-login-ok";
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        playCurrentSource(reason);
      }, RETRY_DELAY_MS);
    }

    function resolveSourceUrl(rawUrl) {
      if (proxyEnabled && proxyPool.length) {
        return wrapUrlThroughProxy(rawUrl, source.proxy || pickNextProxy());
      }
      return rawUrl;
    }

    function playCurrentSource(reason) {
      destroyMedia();
      const source = camera.sources[sourceIndex];
      if (!source) {
        setStatus(article, 'Offline', 'is-offline', 'No source configured');
        return;
      }

      const mediaHost = article.querySelector('[data-role="media"]');
      const sourceText = source.url;

      /* pick proxy and show badge */
      var proxyUrl = '';
      var proxyBadgeText = '';
      if (proxyEnabled && proxyPool.length) {
        proxyUrl = pickNextProxy();
        proxyBadgeText = 'proxy ' + ((proxyRoundRobin - 1 + proxyPool.length) % proxyPool.length + 1) + '/' + proxyPool.length;
      }

      if (source.type === 'rtsp') {
        mediaHost.innerHTML = '<div class="tile-placeholder"><div><strong>Browser cannot open this link directly</strong><span>Convert this camera feed to an HLS, WebRTC, or MP4 website URL.</span></div></div>';
        setStatus(article, 'Link needs browser-playable conversion', 'is-unsupported', sourceText, proxyBadgeText);
        scheduleNext(reason || 'rtsp');
        return;
      }

      if (source.type === 'youtube' || source.type === 'vimeo' || source.type === 'page') {
        const embedUrl = buildEmbedUrl(source);
        if (!embedUrl) {
          mediaHost.innerHTML = '<div class="tile-placeholder"><div><strong>Unsupported page link</strong><span>Use a direct video stream or a supported embeddable page link.</span></div></div>';
          setStatus(article, 'Page link unsupported', 'is-unsupported', sourceText, proxyBadgeText);
          scheduleNext('page-unsupported');
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.className = 'tile-frame';
        iframe.src = proxyUrl ? wrapUrlThroughProxy(embedUrl, proxyUrl) : embedUrl;
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('title', camera.title + ' source');
        mediaHost.innerHTML = '';
        mediaHost.appendChild(iframe);
        setStatus(
          article,
          source.type === 'page' ? 'Embedded page source' : 'Embedded video source',
          'is-live',
          sourceText,
          proxyBadgeText
        );
        return;
      }

      const video = document.createElement('video');
      video.className = 'tile-video';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = 'auto';
      mediaHost.innerHTML = '';
      mediaHost.appendChild(video);
      currentVideo = video;

      video.addEventListener('playing', function () {
        setStatus(article, 'Live', 'is-live', sourceText, proxyBadgeText);
      });

      video.addEventListener('ended', function () {
        setStatus(article, 'Source ended, switching...', 'is-retrying', sourceText, proxyBadgeText);
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        scheduleNext('ended');
      });

      video.addEventListener('stalled', function () {
        setStatus(article, 'Stream stalled, retrying...', 'is-retrying', sourceText, proxyBadgeText);
        scheduleNext('stalled');
      });

      video.addEventListener('error', function () {
        setStatus(article, 'Source failed, retrying...', 'is-offline', sourceText, proxyBadgeText);
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        scheduleNext('error');
      });

      if (source.type === 'hls' && window.Hls && window.Hls.isSupported()) {
        hlsInstance = new window.Hls({
          lowLatencyMode: true
        });
        hlsInstance.loadSource(proxyUrl ? wrapUrlThroughProxy(source.url, proxyUrl) : source.url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          video.play().catch(function () {
  const LOGIN_STORAGE_KEY = "video-wall-login-ok";});
        });
        hlsInstance.on(window.Hls.Events.ERROR, function (_event, data) {
          if (data && data.fatal) {
            setStatus(article, 'HLS error, switching...', 'is-offline', sourceText, proxyBadgeText);
            sourceIndex = (sourceIndex + 1) % camera.sources.length;
            scheduleNext('hls-error');
          }
        });
        setStatus(article, 'Connecting HLS...', 'is-retrying', sourceText, proxyBadgeText);
        return;
      }

      video.src = proxyUrl ? wrapUrlThroughProxy(source.url, proxyUrl) : source.url;
      setStatus(article, reason ? 'Retrying source...' : 'Connecting...', 'is-retrying', sourceText, proxyBadgeText);
      video.play().catch(function () {
  const LOGIN_STORAGE_KEY = "video-wall-login-ok";
        setStatus(article, 'Autoplay blocked or source failed', 'is-offline', sourceText, proxyBadgeText);
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        scheduleNext('play-rejected');
      });
    }

    return {
      start: function () {
        playCurrentSource('');
      },
      destroy: function () {
        destroyMedia();
      }
    };
  }

  function render() {
    const projectId = projectIdInput.value.trim();
    const links = videoLinksInput.value;
    const cameraItems = padCameras(normalizeCameras(links));

    writeSavedValue(VIDEO_PROJECT_STORAGE_KEY, projectId);
    writeSavedValue(VIDEO_LINKS_STORAGE_KEY, links);

    projectIdStat.textContent = projectId || 'Not set';
    videoCountStat.textContent = String(cameraItems.filter(Boolean).length);

    cleanupTiles();
    videoGrid.innerHTML = cameraItems.map(function (camera, index) {
      return camera ? createCameraTile(camera, index) : createPlaceholderTile(index);
    }).join('');

    cameraItems.forEach(function (camera, index) {
      if (!camera) return;
      const article = videoGrid.querySelector('[data-camera-id="' + camera.id + '"]');
      if (!article) return;
      const controller = createTileController(article, camera, index);
      tileControllers.set(camera.id, controller);
      controller.start();
    });
  }

  function refreshWallWithMessage(message) {
    render();
    if (message) setSaveMessage(message);
  }

  applyControlsVisibility(initialControlsVisible);
  updateNetworkStat();
  scheduleAutoRefresh();
  toggleControlsButton.addEventListener('click', function () {
    applyControlsVisibility(controlsPanel.classList.contains('is-hidden'));
  });
  saveLinksButton.addEventListener('click', function () {
    persistSettings('Links and settings saved in this browser.');
  });
  refreshWallButton.addEventListener('click', function () {
    refreshWallWithMessage('Wall refreshed manually.');
  });
  autoRefreshSelect.addEventListener('change', function () {
    persistSettings('');
    scheduleAutoRefresh();
  });
  proxyEnabledInput.addEventListener('change', function () {
    persistSettings('');
    render();
  });
  proxyListInput.addEventListener('input', function () {
    persistSettings('');
  });
  projectIdInput.addEventListener('input', function () {
    persistSettings('');
    render();
  });
  videoLinksInput.addEventListener('input', function () {
    persistSettings('');
    render();
  });
  window.addEventListener('online', function () {
    updateNetworkStat();
    refreshWallWithMessage('Network is back. Wall refreshed automatically.');
  });
  window.addEventListener('offline', function () {
    updateNetworkStat();
    setSaveMessage('Internet is offline. The wall will keep retrying and refresh again when the network returns.');
  });
  render();
})();










