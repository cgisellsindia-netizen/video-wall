(function () {
  const MAX_TILES = 50;
  const RETRY_DELAY_MS = 8000;
  const VIDEO_LINKS_STORAGE_KEY = 'video-wall-project-links';
  const VIDEO_PROJECT_STORAGE_KEY = 'video-wall-project-id';
  const CONTROLS_VISIBILITY_STORAGE_KEY = 'video-wall-project-controls-visible';

  const config = window.__VIDEO_WALL_CONFIG__ || {};
  const tileControllers = new Map();

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

  function inferSourceType(url) {
    const safeUrl = String(url || '').trim().toLowerCase();
    if (!safeUrl) return 'video';
    if (safeUrl.startsWith('rtsp://')) return 'rtsp';
    if (safeUrl.endsWith('.m3u8') || safeUrl.includes('.m3u8?')) return 'hls';
    return 'video';
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
        sources: [parts[0]]
      };
    }

    return {
      title: parts[0] || ('Camera ' + (index + 1)),
      sources: parts.slice(1)
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
              url: source,
              type: inferSourceType(source)
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

  const app = document.getElementById('app');
  app.innerHTML = [
    '<main class="page">',
    '  <section class="toolbar">',
    '    <div class="toolbar-main">',
    '      <span class="eyebrow">Camera Wall</span>',
      '      <h1>50-camera customer demo wall</h1>',
    '      <p>Use your normal camera website links here. One line per tile: <code>Camera Name|primary-url|backup-url-1|backup-url-2</code></p>',
    '    </div>',
    '    <div class="stat"><strong id="project-id-stat"></strong><span>Project ID</span></div>',
    '    <div class="stat"><strong id="video-count-stat"></strong><span>Active cameras</span></div>',
    '    <div class="toolbar-actions"><button type="button" class="toolbar-button" id="toggle-controls-button"></button></div>',
    '  </section>',
    '  <section class="controls" id="controls-panel">',
    '    <div class="controls-grid">',
    '      <div class="setup-side">',
    '        <label class="field">',
    '          <span>Project ID</span>',
    '          <input id="project-id-input" type="text" placeholder="Enter the project ID" />',
    '        </label>',
    '        <div class="note"><strong>Best input:</strong> use normal browser-playable camera links such as HLS <code>.m3u8</code>, MP4, or other website video URLs from your camera system.</div>',
    '        <div class="note"><strong>RTSP only if needed:</strong> browsers cannot play raw <code>rtsp://</code> directly, so those links need conversion through your NVR, gateway, or stream server.</div>',
    '        <div class="note"><strong>Failover:</strong> if a stream drops, stalls, or ends, the wall retries and moves to the next configured source automatically.</div>',
    '      </div>',
    '      <div>',
    '        <label class="field">',
    '          <span>Camera config</span>',
    '          <textarea id="video-links-input" rows="12" placeholder="Front Gate|https://cams.example.com/frontgate.m3u8|https://backup.example.com/frontgate.m3u8&#10;Showroom 1|https://cams.example.com/showroom1.mp4&#10;Back Office|https://cams.example.com/backoffice.m3u8|https://backup.example.com/backoffice.m3u8"></textarea>',
    '        </label>',
    '      </div>',
    '    </div>',
    '  </section>',
    '  <section class="wall-grid" id="video-grid"></section>',
    '  <div class="footer-note">The wall keeps retrying automatically after outages. Normal browser-playable camera links work best.</div>',
    '</main>'
  ].join('');

  const projectIdInput = document.getElementById('project-id-input');
  const videoLinksInput = document.getElementById('video-links-input');
  const projectIdStat = document.getElementById('project-id-stat');
  const videoCountStat = document.getElementById('video-count-stat');
  const videoGrid = document.getElementById('video-grid');
  const controlsPanel = document.getElementById('controls-panel');
  const toggleControlsButton = document.getElementById('toggle-controls-button');

  projectIdInput.value = initialProjectId;
  videoLinksInput.value = initialLinks;

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
      '  </div>',
      '</article>'
    ].join('');
  }

  function setStatus(article, label, statusClass, sourceText) {
    const statusNode = article.querySelector('[data-role="status"]');
    const sourceNode = article.querySelector('[data-role="source"]');
    if (statusNode) {
      statusNode.textContent = label;
      statusNode.className = 'tile-status ' + statusClass;
    }
    if (sourceNode) {
      sourceNode.textContent = sourceText || '';
    }
  }

  function createTileController(article, camera) {
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
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        playCurrentSource(reason);
      }, RETRY_DELAY_MS);
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

      if (source.type === 'rtsp') {
        mediaHost.innerHTML = '<div class="tile-placeholder"><div><strong>Browser cannot open this link directly</strong><span>Convert this camera feed to an HLS, WebRTC, or MP4 website URL.</span></div></div>';
        setStatus(article, 'Link needs browser-playable conversion', 'is-unsupported', sourceText);
        scheduleNext(reason || 'rtsp');
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
        setStatus(article, 'Live', 'is-live', sourceText);
      });

      video.addEventListener('ended', function () {
        setStatus(article, 'Source ended, switching...', 'is-retrying', sourceText);
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        scheduleNext('ended');
      });

      video.addEventListener('stalled', function () {
        setStatus(article, 'Stream stalled, retrying...', 'is-retrying', sourceText);
        scheduleNext('stalled');
      });

      video.addEventListener('error', function () {
        setStatus(article, 'Source failed, retrying...', 'is-offline', sourceText);
        sourceIndex = (sourceIndex + 1) % camera.sources.length;
        scheduleNext('error');
      });

      if (source.type === 'hls' && window.Hls && window.Hls.isSupported()) {
        hlsInstance = new window.Hls({
          lowLatencyMode: true
        });
        hlsInstance.loadSource(source.url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          video.play().catch(function () {});
        });
        hlsInstance.on(window.Hls.Events.ERROR, function (_event, data) {
          if (data && data.fatal) {
            setStatus(article, 'HLS error, switching...', 'is-offline', sourceText);
            sourceIndex = (sourceIndex + 1) % camera.sources.length;
            scheduleNext('hls-error');
          }
        });
        setStatus(article, 'Connecting HLS...', 'is-retrying', sourceText);
        return;
      }

      video.src = source.url;
      setStatus(article, reason ? 'Retrying source...' : 'Connecting...', 'is-retrying', sourceText);
      video.play().catch(function () {
        setStatus(article, 'Autoplay blocked or source failed', 'is-offline', sourceText);
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

    cameraItems.forEach(function (camera) {
      if (!camera) return;
      const article = videoGrid.querySelector('[data-camera-id="' + camera.id + '"]');
      if (!article) return;
      const controller = createTileController(article, camera);
      tileControllers.set(camera.id, controller);
      controller.start();
    });
  }

  applyControlsVisibility(initialControlsVisible);
  toggleControlsButton.addEventListener('click', function () {
    applyControlsVisibility(controlsPanel.classList.contains('is-hidden'));
  });
  projectIdInput.addEventListener('input', render);
  videoLinksInput.addEventListener('input', render);
  render();
})();
