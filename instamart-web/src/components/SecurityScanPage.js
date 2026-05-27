import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  Radar,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench
} from 'lucide-react';
import usePageSeo from '../usePageSeo';

const PLACE_TYPES = [
  { id: 'home', label: 'Home', baseline: 40, multiplier: 1 },
  { id: 'shop', label: 'Shop', baseline: 46, multiplier: 1.15 },
  { id: 'office', label: 'Office', baseline: 48, multiplier: 1.2 },
  { id: 'warehouse', label: 'Warehouse', baseline: 52, multiplier: 1.45 },
  { id: 'resort', label: 'Resort / Villa', baseline: 50, multiplier: 1.55 }
];

const PRIORITY_AREAS = [
  { id: 'gate', label: 'Main gate / entry', cameras: 1, recommendation: 'Gate coverage is critical for entry logging and visitor verification.' },
  { id: 'cash', label: 'Cash counter / billing desk', cameras: 1, recommendation: 'Cash handling area should always have a face-level camera.' },
  { id: 'parking', label: 'Parking / driveway', cameras: 1, recommendation: 'Parking camera helps number plate checks and after-hours movement review.' },
  { id: 'staircase', label: 'Staircase / passage', cameras: 1, recommendation: 'Internal movement tracking improves event reconstruction.' },
  { id: 'backside', label: 'Backside / service access', cameras: 1, recommendation: 'Rear entry points are common blind spots without dedicated coverage.' },
  { id: 'floor', label: 'Shop floor / office floor', cameras: 2, recommendation: 'Wide-angle monitoring reduces blind spots across the working area.' },
  { id: 'storage', label: 'Storage / stock room', cameras: 1, recommendation: 'Inventory zones benefit from tamper and stock-loss visibility.' },
  { id: 'reception', label: 'Reception / lobby', cameras: 1, recommendation: 'Reception coverage helps visitor tracking and dispute review.' }
];

const LIVE_MARKER_TYPES = [
  { id: 'gate', label: 'Gate camera', areaId: 'gate' },
  { id: 'cash', label: 'Cash counter camera', areaId: 'cash' },
  { id: 'parking', label: 'Parking camera', areaId: 'parking' },
  { id: 'blind', label: 'Blind spot', areaId: null }
];

const PACKAGE_LIBRARY = {
  hd4: {
    key: 'hd4',
    title: '4 Camera HD Setup',
    price: 11499,
    deliveryWindow: 'Technician slot available today 4 PM - 6 PM',
    components: ['4 x AHD cameras', '4ch DVR', '1TB HDD', 'Wire + SMPS', 'Standard installation']
  },
  ip4: {
    key: 'ip4',
    title: '4 Camera IP Setup',
    price: 24999,
    deliveryWindow: 'Technician can reach in around 45-90 minutes',
    components: ['4 x IP cameras', '4ch NVR', '1TB HDD', 'CAT6 + PoE', 'Standard installation']
  },
  ip8: {
    key: 'ip8',
    title: '8 Camera IP Setup',
    price: 38999,
    deliveryWindow: 'Same-day visit subject to site confirmation',
    components: ['8 x IP cameras', '8ch NVR', '2TB HDD', 'CAT6 + PoE switch', 'Extended installation']
  },
  hybrid: {
    key: 'hybrid',
    title: 'Hybrid Security Setup',
    price: 32999,
    deliveryWindow: 'Expert callback in 15 minutes to confirm final design',
    components: ['4 x IP cameras', '2 x HD cameras', 'NVR / DVR combo plan', 'Storage + power kit', 'Mixed-area installation']
  }
};

const DEFAULT_FORM = {
  placeType: 'shop',
  areaSize: 'medium',
  watchNight: true,
  sameDayInstall: true,
  highValueAssets: true,
  recordDays: '15',
  areas: ['gate', 'cash', 'parking', 'floor']
};

const getAreaCameraCount = (selectedAreas = []) => (
  selectedAreas.reduce((sum, areaId) => {
    const area = PRIORITY_AREAS.find((entry) => entry.id === areaId);
    return sum + Number(area?.cameras || 0);
  }, 0)
);

const getAreaSizeAdjustment = (size = 'medium') => {
  if (size === 'small') return 0;
  if (size === 'large') return 2;
  return 1;
};

const getStorageMultiplier = (recordDays = '15') => {
  if (recordDays === '30') return 1.15;
  if (recordDays === '7') return 0.92;
  return 1;
};

const markerTypeById = (markerTypeId) => LIVE_MARKER_TYPES.find((item) => item.id === markerTypeId);

const buildSuggestions = (form, markers = []) => {
  const placeMeta = PLACE_TYPES.find((entry) => entry.id === form.placeType) || PLACE_TYPES[1];
  const derivedAreas = markers
    .map((marker) => markerTypeById(marker.type)?.areaId)
    .filter(Boolean);
  const mergedAreas = [...new Set([...form.areas, ...derivedAreas])];
  const blindMarkerCount = markers.filter((marker) => marker.type === 'blind').length;
  const livePlacementCount = markers.filter((marker) => marker.type !== 'blind').length;
  const baseCameras = Math.max(2, getAreaCameraCount(mergedAreas) + getAreaSizeAdjustment(form.areaSize) + Math.min(2, livePlacementCount));
  const adjustedCameras = Math.ceil(baseCameras * placeMeta.multiplier);
  const blindSpots = [
    ...markers
      .filter((marker) => marker.type === 'blind')
      .slice(0, 3)
      .map((marker, index) => `Blind spot marked in live scan #${index + 1}.`),
    ...PRIORITY_AREAS
      .filter((area) => !mergedAreas.includes(area.id))
      .slice(0, Math.max(0, 3 - blindMarkerCount))
      .map((area) => `Potential blind spot near ${area.label.toLowerCase()}.`)
  ];

  const selectedAreaRecommendations = PRIORITY_AREAS
    .filter((area) => mergedAreas.includes(area.id))
    .map((area) => ({
      title: area.label,
      note: area.recommendation
    }));

  const beforeScoreBase = placeMeta.baseline - (mergedAreas.length * 2) - (form.watchNight ? 4 : 0) - (blindMarkerCount * 3);
  const beforeScore = Math.max(26, Math.min(68, Math.round(beforeScoreBase)));
  const afterBoost = Math.min(58, adjustedCameras * 5 + (form.highValueAssets ? 6 : 0) + (form.watchNight ? 5 : 0) + (livePlacementCount * 3));
  const afterScore = Math.max(beforeScore + 18, Math.min(96, beforeScore + afterBoost));

  const packageKey = adjustedCameras >= 7
    ? 'ip8'
    : form.placeType === 'warehouse' || form.placeType === 'resort'
      ? 'hybrid'
      : form.watchNight || form.highValueAssets || livePlacementCount >= 2
        ? 'ip4'
        : 'hd4';

  const packageTemplate = PACKAGE_LIBRARY[packageKey];
  const storageAdjustedPrice = Math.round(packageTemplate.price * getStorageMultiplier(form.recordDays));
  const packagePrice = storageAdjustedPrice + (form.sameDayInstall ? 0 : -500);
  const placementLabels = selectedAreaRecommendations.map((item) => item.title);
  const livePlacementLabels = markers
    .filter((marker) => marker.type !== 'blind')
    .slice(0, 4)
    .map((marker) => markerTypeById(marker.type)?.label || 'Suggested camera');

  const packageComponents = [
    ...packageTemplate.components,
    `${adjustedCameras} suggested camera points`,
    livePlacementCount ? `${livePlacementCount} live scan placement markers added` : 'Guided scan placement estimate',
    form.recordDays === '30' ? 'Extended storage retention' : `Recording retention target: ${form.recordDays} days`
  ];

  const installSlot = form.sameDayInstall
    ? 'Technician reaching in 45 minutes'
    : 'Preferred slot available tomorrow 10 AM - 1 PM';

  const afterPreview = (livePlacementLabels.length ? livePlacementLabels : placementLabels.slice(0, 4))
    .map((label) => `${label} view`);

  return {
    mergedAreas,
    adjustedCameras,
    beforeScore,
    afterScore,
    blindSpots,
    selectedAreaRecommendations,
    packagePlan: {
      ...packageTemplate,
      price: packagePrice,
      components: packageComponents
    },
    installSlot,
    afterPreview
  };
};

function SecurityScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [markers, setMarkers] = useState([]);
  const [activeMarkerType, setActiveMarkerType] = useState('gate');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSupported] = useState(() => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);

  const scanResult = useMemo(() => buildSuggestions(form, markers), [form, markers]);

  usePageSeo({
    title: 'Camigo Security Scan | Live CCTV Placement, Package, and Installation Estimate',
    description: 'Use Camigo Security Scan to open your camera, mark blind spots, estimate CCTV placement, generate a package, and request same-day installation.',
    canonicalUrl: 'https://getcamigo.in/security-scan',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'Camigo Security Scan',
          url: 'https://getcamigo.in/security-scan',
          description: 'Live camera-assisted security scan for CCTV package recommendations and installation estimates.'
        },
        {
          '@type': 'Service',
          name: 'Camigo Security Scan',
          serviceType: 'AI-assisted CCTV recommendation and live camera scan estimate',
          provider: {
            '@type': 'Organization',
            name: 'Camigo',
            url: 'https://getcamigo.in/'
          },
          areaServed: ['Bhubaneswar', 'Odisha'],
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: '0'
          }
        }
      ]
    }
  });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    if (!cameraSupported) {
      setCameraError('This device or browser does not support live camera scan.');
      return;
    }
    try {
      setCameraError('');
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (error) {
      setCameraError('Camera permission was blocked or the live scan could not start.');
      setCameraReady(false);
    }
  };

  const toggleArea = (areaId) => {
    setForm((current) => {
      const nextAreas = current.areas.includes(areaId)
        ? current.areas.filter((entry) => entry !== areaId)
        : [...current.areas, areaId];
      return {
        ...current,
        areas: nextAreas.length ? nextAreas : [areaId]
      };
    });
  };

  const handleLiveTap = (event) => {
    const surface = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - surface.left) / surface.width) * 100;
    const y = ((event.clientY - surface.top) / surface.height) * 100;
    const markerType = markerTypeById(activeMarkerType);

    setMarkers((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        x,
        y,
        type: activeMarkerType
      }
    ]);

    if (markerType?.areaId && !form.areas.includes(markerType.areaId)) {
      setForm((current) => ({
        ...current,
        areas: [...current.areas, markerType.areaId]
      }));
    }
  };

  const resetLiveMarkers = () => setMarkers([]);

  return (
    <main className="container security-scan-page">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Security Scan</span>
      </nav>

      <section className="security-scan-hero">
        <div className="security-scan-hero-copy">
          <span className="eyebrow">Camigo Security Scan</span>
          <h1>Open the camera, mark blind spots, and get the right CCTV package instantly.</h1>
          <p>
            This live scan MVP lets the customer open the phone camera, mark camera-needed areas, and generate a coverage plan.
            Installer will still confirm final placement on site.
          </p>
          <div className="security-scan-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => document.getElementById('security-live-scan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Open Live Scan
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/install')}>
              Book Technician
            </button>
          </div>
          <div className="security-scan-hero-pills">
            <span><ScanLine size={14} /> Live camera scan</span>
            <span><ShieldCheck size={14} /> Security score</span>
            <span><Wrench size={14} /> Same-day install CTA</span>
          </div>
        </div>
        <div className="security-scan-hero-panel">
          <div className="security-scan-live-card">
            <div className="security-scan-phone-frame security-scan-phone-preview">
              <div className="security-scan-camera-dots">
                <span>Gate camera</span>
                <span>Blind spot</span>
                <span>Counter camera</span>
              </div>
            </div>
            <small>Tap directly on the live view to mark where a camera is needed or where a blind spot exists.</small>
          </div>
        </div>
      </section>

      <section id="security-live-scan" className="security-scan-live-section">
        <div className="security-scan-card">
          <div className="security-scan-card-head">
            <div>
              <span className="eyebrow">Live Security Doctor</span>
              <h2>Scan the place with your camera</h2>
            </div>
            <Camera size={20} />
          </div>

          <div className="security-scan-live-toolbar">
            <div className="security-scan-options">
              {LIVE_MARKER_TYPES.map((markerType) => (
                <button
                  key={markerType.id}
                  type="button"
                  className={activeMarkerType === markerType.id ? 'security-chip active' : 'security-chip'}
                  onClick={() => setActiveMarkerType(markerType.id)}
                >
                  {markerType.label}
                </button>
              ))}
            </div>
            <div className="security-package-actions">
              {!cameraReady ? (
                <button type="button" className="btn btn-primary" onClick={startCamera}>
                  Open camera
                </button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={stopCamera}>
                  Stop camera
                </button>
              )}
              <button type="button" className="btn btn-outline" onClick={resetLiveMarkers}>
                Clear markers
              </button>
            </div>
          </div>

          <div className="security-live-scan-stage">
            <button
              type="button"
              className={cameraReady ? 'security-live-surface active' : 'security-live-surface'}
              onClick={cameraReady ? handleLiveTap : undefined}
            >
              <video ref={videoRef} className="security-live-video" muted playsInline />
              {!cameraReady && (
                <div className="security-live-placeholder">
                  <Camera size={34} />
                  <strong>Live camera preview</strong>
                  <span>Open the camera, then tap the scene to mark gate, counter, parking, or blind spots.</span>
                </div>
              )}
              {markers.map((marker) => {
                const label = markerTypeById(marker.type)?.label || 'Marker';
                return (
                  <span
                    key={marker.id}
                    className={marker.type === 'blind' ? 'security-live-marker blind' : 'security-live-marker'}
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  >
                    {label}
                  </span>
                );
              })}
            </button>
          </div>

          {cameraError ? <p className="security-camera-error">{cameraError}</p> : null}
          {!cameraSupported ? <p className="security-camera-error">Live camera scan needs a browser with camera access support.</p> : null}

          <div className="security-live-hint-grid">
            <div className="security-preview-tile">
              <span>{markers.length} live markers added</span>
            </div>
            <div className="security-preview-tile">
              <span>{markers.filter((marker) => marker.type === 'blind').length} blind spots flagged</span>
            </div>
            <div className="security-preview-tile">
              <span>{scanResult.adjustedCameras} total camera points suggested</span>
            </div>
          </div>
        </div>
      </section>

      <section id="security-scan-builder" className="security-scan-grid">
        <div className="security-scan-builder">
          <div className="security-scan-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Step 1</span>
                <h2>Tell us about the place</h2>
              </div>
              <MapPin size={20} />
            </div>
            <div className="security-scan-options">
              {PLACE_TYPES.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className={form.placeType === place.id ? 'security-chip active' : 'security-chip'}
                  onClick={() => setForm((current) => ({ ...current, placeType: place.id }))}
                >
                  {place.label}
                </button>
              ))}
            </div>

            <div className="security-scan-field">
              <label>Property size</label>
              <div className="security-scan-options">
                {[
                  ['small', 'Small'],
                  ['medium', 'Medium'],
                  ['large', 'Large']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={form.areaSize === value ? 'security-chip active' : 'security-chip'}
                    onClick={() => setForm((current) => ({ ...current, areaSize: value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="security-scan-field">
              <label>Which areas need monitoring?</label>
              <div className="security-scan-toggle-grid">
                {PRIORITY_AREAS.map((area) => {
                  const active = form.areas.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      className={active ? 'security-toggle-card active' : 'security-toggle-card'}
                      onClick={() => toggleArea(area.id)}
                    >
                      <Camera size={18} />
                      <span>{area.label}</span>
                      {active && <CheckCircle2 size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="security-scan-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Step 2</span>
                <h2>Set monitoring preference</h2>
              </div>
              <Radar size={20} />
            </div>
            <div className="security-scan-switch-list">
              {[
                {
                  key: 'watchNight',
                  title: 'Night monitoring needed',
                  copy: 'Adds stronger low-light and outdoor recommendation weight.'
                },
                {
                  key: 'sameDayInstall',
                  title: 'Need same-day technician',
                  copy: 'Prioritises ready-to-install package output.'
                },
                {
                  key: 'highValueAssets',
                  title: 'Cash, stock, or high-value area present',
                  copy: 'Pushes camera quality and coverage score upward.'
                }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={form[item.key] ? 'security-switch-card active' : 'security-switch-card'}
                  onClick={() => setForm((current) => ({ ...current, [item.key]: !current[item.key] }))}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.copy}</small>
                  </div>
                  <span>{form[item.key] ? 'On' : 'Off'}</span>
                </button>
              ))}
            </div>
            <div className="security-scan-field">
              <label>Preferred recording retention</label>
              <div className="security-scan-options">
                {['7', '15', '30'].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={form.recordDays === days ? 'security-chip active' : 'security-chip'}
                    onClick={() => setForm((current) => ({ ...current, recordDays: days }))}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="security-scan-card security-future-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Future mode</span>
                <h2>VR camera placement planner</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <p className="security-technician-copy">
              Next we can add a future-ready VR placement mode where the customer walks the site and sees virtual
              camera positions, coverage direction, and secure vs blind area overlays before installation.
            </p>
            <ul className="security-package-list">
              <li>Walk-through room and gate placement preview</li>
              <li>Virtual field-of-view and blind-spot overlay</li>
              <li>Before / after coverage comparison in real space</li>
              <li>Installer confirmation workflow from the same scan</li>
            </ul>
          </div>
        </div>

        <aside className="security-scan-results">
          <div className="security-scan-card security-score-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Security score</span>
                <h2>Before vs after</h2>
              </div>
              <ShieldAlert size={20} />
            </div>
            <div className="security-score-rows">
              <div className="security-score-row danger">
                <span>Before setup</span>
                <strong>{scanResult.beforeScore}/100</strong>
                <small>{scanResult.beforeScore <= 50 ? 'Unsafe' : 'Partially covered'}</small>
              </div>
              <div className="security-score-row success">
                <span>After Camigo plan</span>
                <strong>{scanResult.afterScore}/100</strong>
                <small>{scanResult.afterScore >= 85 ? 'Secure' : 'Improved'}</small>
              </div>
            </div>
          </div>

          <div className="security-scan-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Suggested placement</span>
                <h2>{scanResult.adjustedCameras} camera points recommended</h2>
              </div>
              <MapPin size={20} />
            </div>
            <div className="security-placement-list">
              {scanResult.selectedAreaRecommendations.map((item) => (
                <div key={item.title} className="security-placement-item">
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
            {scanResult.blindSpots.length > 0 && (
              <div className="security-blind-spot-box">
                <strong>Uncovered areas detected</strong>
                <ul>
                  {scanResult.blindSpots.map((spot) => <li key={spot}>{spot}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="security-scan-card security-package-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Instant package generator</span>
                <h2>{scanResult.packagePlan.title}</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="security-package-price-row">
              <strong>Rs {scanResult.packagePlan.price.toLocaleString('en-IN')}</strong>
              <span>{scanResult.packagePlan.deliveryWindow}</span>
            </div>
            <ul className="security-package-list">
              {scanResult.packagePlan.components.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="security-package-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/install')}>
                Book today <ArrowRight size={16} />
              </button>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/shop')}>
                Browse CCTV
              </button>
            </div>
          </div>

          <div className="security-scan-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Preview</span>
                <h2>After installation you can monitor</h2>
              </div>
              <ShieldCheck size={20} />
            </div>
            <div className="security-preview-grid">
              {scanResult.afterPreview.map((label) => (
                <div key={label} className="security-preview-tile">
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="security-scan-card">
            <div className="security-scan-card-head">
              <div>
                <span className="eyebrow">Technician booking</span>
                <h2>{scanResult.installSlot}</h2>
              </div>
              <Clock3 size={20} />
            </div>
            <p className="security-technician-copy">
              Installer will confirm final placement on-site. This scan is an estimate to help the customer buy faster and safer.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/install')}>
              Continue to technician booking
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default SecurityScanPage;
