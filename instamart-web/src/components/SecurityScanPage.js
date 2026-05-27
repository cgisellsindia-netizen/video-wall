import React, { useMemo, useState } from 'react';
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

const PACKAGE_LIBRARY = {
  hd4: {
    key: 'hd4',
    title: '4 Camera HD Setup',
    price: 11499,
    deliveryWindow: 'Technician slot available today 4 PM - 6 PM',
    components: ['4 x AHD cameras', '4ch DVR', '1TB HDD', 'Wire + SMPS', 'Standard installation'],
    image: 'HD cameras + DVR'
  },
  ip4: {
    key: 'ip4',
    title: '4 Camera IP Setup',
    price: 24999,
    deliveryWindow: 'Technician can reach in around 45-90 minutes',
    components: ['4 x IP cameras', '4ch NVR', '1TB HDD', 'CAT6 + PoE', 'Standard installation'],
    image: 'IP cameras + NVR'
  },
  ip8: {
    key: 'ip8',
    title: '8 Camera IP Setup',
    price: 38999,
    deliveryWindow: 'Same-day visit subject to site confirmation',
    components: ['8 x IP cameras', '8ch NVR', '2TB HDD', 'CAT6 + PoE switch', 'Extended installation'],
    image: '8-channel IP coverage'
  },
  hybrid: {
    key: 'hybrid',
    title: 'Hybrid Security Setup',
    price: 32999,
    deliveryWindow: 'Expert callback in 15 minutes to confirm final design',
    components: ['4 x IP cameras', '2 x HD cameras', 'NVR / DVR combo plan', 'Storage + power kit', 'Mixed-area installation'],
    image: 'Indoor + outdoor mixed plan'
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

const buildSuggestions = (form) => {
  const placeMeta = PLACE_TYPES.find((entry) => entry.id === form.placeType) || PLACE_TYPES[1];
  const baseCameras = Math.max(2, getAreaCameraCount(form.areas) + getAreaSizeAdjustment(form.areaSize));
  const adjustedCameras = Math.ceil(baseCameras * placeMeta.multiplier);
  const blindSpots = PRIORITY_AREAS
    .filter((area) => !form.areas.includes(area.id))
    .slice(0, 3)
    .map((area) => `Potential blind spot near ${area.label.toLowerCase()}.`);
  const selectedAreaRecommendations = PRIORITY_AREAS
    .filter((area) => form.areas.includes(area.id))
    .map((area) => ({
      title: area.label,
      note: area.recommendation
    }));

  const beforeScoreBase = placeMeta.baseline - (form.areas.length * 2) - (form.watchNight ? 4 : 0);
  const beforeScore = Math.max(32, Math.min(68, Math.round(beforeScoreBase)));
  const afterBoost = Math.min(55, adjustedCameras * 5 + (form.highValueAssets ? 6 : 0) + (form.watchNight ? 5 : 0));
  const afterScore = Math.max(beforeScore + 18, Math.min(96, beforeScore + afterBoost));

  const packageKey = adjustedCameras >= 7
    ? 'ip8'
    : form.placeType === 'warehouse' || form.placeType === 'resort'
      ? 'hybrid'
      : form.watchNight || form.highValueAssets
        ? 'ip4'
        : 'hd4';

  const packageTemplate = PACKAGE_LIBRARY[packageKey];
  const storageAdjustedPrice = Math.round(packageTemplate.price * getStorageMultiplier(form.recordDays));
  const packagePrice = storageAdjustedPrice + (form.sameDayInstall ? 0 : -500);
  const placementLabels = selectedAreaRecommendations.map((item) => item.title);
  const packageComponents = [
    ...packageTemplate.components,
    `${adjustedCameras} suggested camera points`,
    form.recordDays === '30' ? 'Extended storage retention' : `Recording retention target: ${form.recordDays} days`
  ];

  const installSlot = form.sameDayInstall
    ? 'Technician reaching in 45 minutes'
    : 'Preferred slot available tomorrow 10 AM - 1 PM';

  const afterPreview = placementLabels.slice(0, 4).map((label) => `${label} view`);

  return {
    placeMeta,
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
  const [form, setForm] = useState(DEFAULT_FORM);

  const scanResult = useMemo(() => buildSuggestions(form), [form]);

  usePageSeo({
    title: 'Camigo Security Scan | CCTV Placement, Package, and Installation Estimate',
    description: 'Use Camigo Security Scan to estimate camera placement, blind spots, security score, recommended CCTV package, and same-day technician options.',
    canonicalUrl: 'https://getcamigo.in/security-scan',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'Camigo Security Scan',
          url: 'https://getcamigo.in/security-scan',
          description: 'Guided security scan for CCTV package recommendations and installation estimates.'
        },
        {
          '@type': 'Service',
          name: 'Camigo Security Scan',
          serviceType: 'AI-assisted CCTV recommendation and installation estimate',
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
          <h1>Scan your place, spot blind areas, and get the right CCTV package instantly.</h1>
          <p>
            This is an AI-assisted estimate for faster buying. Camigo suggests camera placement, a package plan,
            and a technician slot so customers stop guessing what to buy.
          </p>
          <div className="security-scan-hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => document.getElementById('security-scan-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Start Security Scan
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/install')}>
              Book Technician
            </button>
          </div>
          <div className="security-scan-hero-pills">
            <span><ScanLine size={14} /> Guided scan</span>
            <span><ShieldCheck size={14} /> Security score</span>
            <span><Wrench size={14} /> Same-day install CTA</span>
          </div>
        </div>
        <div className="security-scan-hero-panel">
          <div className="security-scan-live-card">
            <div className="security-scan-phone-frame">
              <div className="security-scan-camera-dots">
                <span>Gate camera</span>
                <span>Parking camera</span>
                <span>Counter camera</span>
              </div>
            </div>
            <small>Live camera scan can be added next. This MVP starts with guided inputs and instant recommendations.</small>
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
