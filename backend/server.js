const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Readable, Writable } = require('stream');
const admin = require('firebase-admin');
const ftp = require('basic-ftp');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const publicOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'https://camigo-store.onrender.com',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
  ...publicOrigins
]);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)
    ) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  credentials: true
}));

app.use((err, req, res, next) => {
  if (err?.message === 'Origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed', origin: req.headers.origin || null });
  }
  next(err);
});
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Uploaded image is too large. Please use a smaller banner file.' });
  }
  next(err);
});

const JWT_SECRET = process.env.JWT_SECRET || 'camigo-local-dev-secret-change-before-production';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const hasRazorpayConfig = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
const UBER_DIRECT_CUSTOMER_ID = process.env.UBER_DIRECT_CUSTOMER_ID || '';
const UBER_DIRECT_CLIENT_ID = process.env.UBER_DIRECT_CLIENT_ID || '';
const UBER_DIRECT_CLIENT_SECRET = process.env.UBER_DIRECT_CLIENT_SECRET || '';
const UBER_DIRECT_STORE_ID = process.env.UBER_DIRECT_STORE_ID || '';
const UBER_DIRECT_PICKUP_PHONE = process.env.UBER_DIRECT_PICKUP_PHONE || '';
const UBER_DIRECT_PICKUP_INSTRUCTIONS = process.env.UBER_DIRECT_PICKUP_INSTRUCTIONS || '';
const hasUberDirectConfig = Boolean(
  UBER_DIRECT_CLIENT_ID && UBER_DIRECT_CLIENT_SECRET && UBER_DIRECT_STORE_ID && UBER_DIRECT_PICKUP_PHONE
);
const DELHIVERY_API_TOKEN = process.env.DELHIVERY_API_TOKEN || '';
const DELHIVERY_CLIENT_NAME = process.env.DELHIVERY_CLIENT_NAME || '';
const DELHIVERY_PICKUP_LOCATION = process.env.DELHIVERY_PICKUP_LOCATION || '';
const DELHIVERY_SELLER_NAME = process.env.DELHIVERY_SELLER_NAME || 'Camigo';
const DELHIVERY_SELLER_PHONE = process.env.DELHIVERY_SELLER_PHONE || '';
const DELHIVERY_SELLER_ADDRESS = process.env.DELHIVERY_SELLER_ADDRESS || '';
const DELHIVERY_SELLER_PINCODE = process.env.DELHIVERY_SELLER_PINCODE || '';
const DELHIVERY_SELLER_CITY = process.env.DELHIVERY_SELLER_CITY || 'Bhubaneswar';
const DELHIVERY_SELLER_STATE = process.env.DELHIVERY_SELLER_STATE || 'Odisha';
const DELHIVERY_SELLER_COUNTRY = process.env.DELHIVERY_SELLER_COUNTRY || 'India';
const DELHIVERY_SELLER_GSTIN = process.env.DELHIVERY_SELLER_GSTIN || '';
const DELHIVERY_HSN_CODE = process.env.DELHIVERY_HSN_CODE || '';
const hasDelhiveryApiConfig = Boolean(
  DELHIVERY_API_TOKEN &&
  DELHIVERY_CLIENT_NAME &&
  DELHIVERY_PICKUP_LOCATION &&
  DELHIVERY_SELLER_PHONE &&
  DELHIVERY_SELLER_ADDRESS &&
  DELHIVERY_SELLER_PINCODE
);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BANNER_MODEL = process.env.OPENAI_BANNER_MODEL || 'gpt-4o-mini';
const MEDIA_MANIFEST_URL = process.env.MEDIA_MANIFEST_URL || '';
const MEDIA_MANIFEST_FTP_HOST = process.env.MEDIA_MANIFEST_FTP_HOST || '';
const MEDIA_MANIFEST_FTP_USER = process.env.MEDIA_MANIFEST_FTP_USER || '';
const MEDIA_MANIFEST_FTP_PASSWORD = process.env.MEDIA_MANIFEST_FTP_PASSWORD || '';
const MEDIA_MANIFEST_FTP_PATH = process.env.MEDIA_MANIFEST_FTP_PATH || '/htdocs/camigo-catalog-backup.json';
const MEDIA_MANIFEST_FTP_SECURE = String(process.env.MEDIA_MANIFEST_FTP_SECURE || '').toLowerCase() === 'true';
const MEDIA_MANIFEST_FTP_PORT = Number(process.env.MEDIA_MANIFEST_FTP_PORT || 21);
const hasCatalogFtpConfig = Boolean(MEDIA_MANIFEST_FTP_HOST && MEDIA_MANIFEST_FTP_USER && MEDIA_MANIFEST_FTP_PASSWORD);
const mediaManifestPublicOrigin = (() => {
  try {
    return MEDIA_MANIFEST_URL ? new URL(MEDIA_MANIFEST_URL).origin : '';
  } catch (error) {
    return '';
  }
})();
const MEDIA_LIBRARY_FTP_DIR = process.env.MEDIA_LIBRARY_FTP_DIR || '/htdocs';
const MEDIA_LIBRARY_PUBLIC_BASE = (process.env.MEDIA_LIBRARY_PUBLIC_BASE || mediaManifestPublicOrigin || '').replace(/\/+$/, '');
const mediaLibraryImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg']);
const mediaManifestPublicPathFromFtp = () => {
  const baseDir = path.posix.normalize(`/${String(MEDIA_LIBRARY_FTP_DIR || '/htdocs').replaceAll('\\', '/').replace(/^\/+/, '')}`);
  const ftpPath = path.posix.normalize(`/${String(MEDIA_MANIFEST_FTP_PATH || '/htdocs/camigo-catalog-backup.json').replaceAll('\\', '/').replace(/^\/+/, '')}`);
  const relativePath = ftpPath.startsWith(`${baseDir}/`) ? ftpPath.slice(baseDir.length) : `/${path.posix.basename(ftpPath)}`;
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
};
const MEDIA_MANIFEST_EXPECTED_URL = MEDIA_LIBRARY_PUBLIC_BASE
  ? `${MEDIA_LIBRARY_PUBLIC_BASE}${mediaManifestPublicPathFromFtp()}`
  : '';
const OPERATIONAL_STATE_FTP_PATH = process.env.OPERATIONAL_STATE_FTP_PATH || '/htdocs/camigo-operational-backup.enc';
const hasOperationalStateFtpConfig = hasCatalogFtpConfig;
const OPERATIONAL_STATE_ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(`${JWT_SECRET}:camigo-operational-state`, 'utf8')
  .digest();
const publicServerBaseUrl = (
  process.env.PUBLIC_SERVER_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://camigo-store.onrender.com'
).replace(/\/+$/, '');
const normalizePublicUrl = (value = '') => String(value || '').trim().replace(/\/+$/, '');
const catalogRestoreUrlWarning = () => {
  if (!MEDIA_MANIFEST_URL || !MEDIA_MANIFEST_EXPECTED_URL) return '';
  if (normalizePublicUrl(MEDIA_MANIFEST_URL) === normalizePublicUrl(MEDIA_MANIFEST_EXPECTED_URL)) return '';
  return `MEDIA_MANIFEST_URL points to a different JSON file than the FTP backup. Set MEDIA_MANIFEST_URL to ${MEDIA_MANIFEST_EXPECTED_URL}.`;
};
const firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const firebaseServiceAccountCandidates = [
  process.env.FIREBASE_SERVICE_ACCOUNT,
  path.join(__dirname, '..', 'firebase-service-account.json'),
  '/etc/secrets/firebase-service-account.json'
].filter(Boolean);
let firebaseReady = false;
try {
  if (!admin.apps.length) {
    let serviceAccount = null;
    if (firebaseServiceAccountJson) {
      serviceAccount = JSON.parse(firebaseServiceAccountJson);
    } else {
      const serviceAccountPath = firebaseServiceAccountCandidates.find(candidate => fs.existsSync(candidate));
      if (serviceAccountPath) serviceAccount = require(serviceAccountPath);
    }
    if (serviceAccount) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      firebaseReady = true;
    }
  }
} catch (error) {
  console.warn('Firebase Admin not ready:', error.message);
}

const priceForUserRole = (product, role) => {
  if (role === 'distributor' && Number(product.distributor_price) > 0) return Number(product.distributor_price);
  if (role === 'dealer' && Number(product.dealer_price) > 0) return Number(product.dealer_price);
  if (role === 'distributor') return Math.round(Number(product.price || 0) * 0.85);
  if (role === 'dealer') return Math.round(Number(product.price || 0) * 0.90);
  return Number(product.price || 0);
};

const DEFAULT_CAMIGO_HUB = {
  name: 'Camigo Hub',
  lat: 20.34986,
  lng: 85.82418
};

const APP_SETTING_KEYS = {
  homepageSetupPackages: 'homepage_setup_packages',
  codEnabled: 'cod_enabled'
};

const OPERATIONAL_APP_SETTING_KEYS = [
  APP_SETTING_KEYS.homepageSetupPackages,
  APP_SETTING_KEYS.codEnabled
];

const DEFAULT_SETUP_PACKAGES = [
  {
    id: 'ahd-4-camera-setup',
    title: 'AHD 4 Camera Setup',
    price: 12500,
    subtitle: 'Budget-ready 4 camera CCTV kit for homes and small shops.',
    badge: 'Most popular',
    image: '/category-real/ahd-cameras.jpg',
    product_id: null,
    category_id: 1
  },
  {
    id: 'ip-4-camera-setup',
    title: 'IP Camera 4 Camera Setup',
    price: 22500,
    subtitle: 'Sharper IP surveillance setup for offices, stores, and modern homes.',
    badge: 'Premium clarity',
    image: '/category-real/ip-cameras.jpg',
    product_id: null,
    category_id: 2
  },
  {
    id: 'ahd-5mp-4-camera-setup',
    title: 'AHD 5MP 4 Camera Setup',
    price: 15300,
    subtitle: 'Higher-resolution AHD combo for customers who want better detail at a practical price.',
    badge: '5MP upgrade',
    image: '/category-real/ahd-cameras.jpg',
    product_id: null,
    category_id: 1
  }
];

// Edit these average transport rates whenever your Uber/Rapido/Delhivery commercial pricing changes.
const LOCAL_PARTNER_RATE_CARD = [
  { provider: 'Rapido Parcel', baseFee: 52, perKmFee: 10.5, handlingFee: 8 },
  { provider: 'Uber Parcel', baseFee: 62, perKmFee: 12.5, handlingFee: 10 }
];

const DELHIVERY_RATE_CARD = {
  odisha: {
    label: 'Delhivery Odisha lane',
    baseQuotes: [82, 88, 94],
    additionalKgQuotes: [18, 20, 22],
    handlingQuotes: [12, 14, 16],
    safetyMarkupRate: 0.16,
    estimateLabel: '1-2 days'
  },
  east: {
    label: 'Delhivery East lane',
    baseQuotes: [108, 116, 124],
    additionalKgQuotes: [24, 26, 28],
    handlingQuotes: [15, 17, 19],
    safetyMarkupRate: 0.18,
    estimateLabel: '2-4 days'
  },
  national: {
    label: 'Delhivery National lane',
    baseQuotes: [138, 148, 158],
    additionalKgQuotes: [30, 33, 36],
    handlingQuotes: [18, 20, 22],
    safetyMarkupRate: 0.2,
    estimateLabel: '3-6 days'
  }
};

let uberDirectTokenCache = {
  accessToken: '',
  expiresAt: 0
};

const averageList = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
};

const roundCurrency = (value = 0) => Math.round(Number(value || 0));
const roundToStep = (value = 0, step = 5) => Math.ceil(Number(value || 0) / step) * step;
const roundOneDecimal = (value = 0) => Math.round(Number(value || 0) * 10) / 10;
const normalizeSettingKey = (value = '') => String(value || '').trim();
const normalizeSetupPackageId = (value = '', fallbackIndex = 0) => {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `setup-package-${fallbackIndex + 1}`;
};

const sanitizeSetupPackage = (entry = {}, index = 0) => {
  const fallback = DEFAULT_SETUP_PACKAGES[index] || DEFAULT_SETUP_PACKAGES[DEFAULT_SETUP_PACKAGES.length - 1];
  const title = String(entry?.title || fallback?.title || `Setup Package ${index + 1}`).trim();
  const subtitle = String(entry?.subtitle || fallback?.subtitle || '').trim();
  const badge = String(entry?.badge || fallback?.badge || '').trim();
  const image = String(entry?.image || fallback?.image || '/category-real/accessories.jpg').trim();
  const price = Math.max(0, Math.round(Number(entry?.price ?? fallback?.price ?? 0)));
  const productId = Number(entry?.product_id ?? entry?.linked_product_id ?? fallback?.product_id ?? 0);
  const categoryId = Number(entry?.category_id ?? fallback?.category_id ?? 1);
  return {
    id: normalizeSetupPackageId(entry?.id || title, index),
    title,
    subtitle,
    badge,
    image,
    price,
    product_id: Number.isInteger(productId) && productId > 0 ? productId : null,
    category_id: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : 1
  };
};

const sanitizeSetupPackages = (entries) => {
  const source = Array.isArray(entries) && entries.length ? entries : DEFAULT_SETUP_PACKAGES;
  return source
    .slice(0, 12)
    .map((entry, index) => sanitizeSetupPackage(entry, index))
    .filter((entry) => entry.title && entry.image && entry.price > 0);
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const fetchRoadRouteMetrics = async (startLat, startLng, endLat, endLng) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${Number(startLng)},${Number(startLat)};${Number(endLng)},${Number(endLat)}?overview=false&steps=false`,
      { signal: controller.signal }
    );
    const data = await response.json().catch(() => null);
    const route = data?.routes?.[0];
    if (!response.ok || !route?.distance) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      source: 'road-route'
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const isLocalServiceZone = (lat, lng) => {
  const valueLat = Number(lat);
  const valueLng = Number(lng);
  if (!Number.isFinite(valueLat) || !Number.isFinite(valueLng)) return false;
  return valueLat >= 20.05 && valueLat <= 20.65 && valueLng >= 85.50 && valueLng <= 86.10;
};

const isLocalAddressText = (address = '') => {
  const text = String(address).toLowerCase();
  return ['bhubaneswar', 'bbsr', 'cuttack', 'khordha', 'khurda', 'jatni', 'patia'].some(place => text.includes(place));
};

const extractPincode = (value = '') => {
  const match = String(value).match(/\b([1-9]\d{5})\b/);
  return match ? match[1] : '';
};

const isValidIndianPincode = (pincode = '') => /^[1-9]\d{5}$/.test(String(pincode || '').trim());

const isServiceablePincode = (pincode = '') => {
  const pin = String(pincode || '').trim();
  if (!isValidIndianPincode(pin)) return false;
  return pin.startsWith('751') || pin.startsWith('753') || /^752[01]\d{2}$/.test(pin);
};

const checkServiceability = ({ address = '', pincode = '', lat, lng } = {}) => {
  const detectedPincode = String(pincode || '').trim() || extractPincode(address);
  const gpsLocal = isLocalServiceZone(lat, lng);
  const pincodeLocal = isServiceablePincode(detectedPincode);
  const validPincode = isValidIndianPincode(detectedPincode);
  const addressLocal = isLocalAddressText(address);
  const hasPincode = Boolean(detectedPincode);
  const localServiceable = hasPincode ? pincodeLocal : (gpsLocal || addressLocal);
  const courierServiceable = hasPincode && validPincode && !localServiceable;
  return {
    serviceable: localServiceable || courierServiceable,
    localServiceable,
    courierServiceable,
    mode: localServiceable ? 'local' : courierServiceable ? 'courier' : 'blocked',
    detectedPincode,
    validPincode,
    gpsLocal,
    pincodeLocal,
    addressLocal
  };
};

const estimateItemWeightKg = (items = [], productLookup = new Map()) => {
  const categoryWeight = {
    1: 0.8,  // Night Color AHD Cameras
    2: 0.85, // IP Cameras
    3: 1.4,  // PTZ Cameras
    4: 2.4,  // DVR
    5: 2.6,  // NVR
    6: 1.4,  // PoE switch
    7: 0.45  // SMPS / accessories
  };

  const total = items.reduce((sum, item) => {
    const product = productLookup.get(item.product_id) || {};
    const categoryId = Number(product.category_id || 0);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitWeight = categoryWeight[categoryId] || 0.6;
    return sum + (unitWeight * quantity);
  }, 0);

  return Math.max(0.5, total);
};

const detectDelhiveryLane = (pincode = '') => {
  const pin = String(pincode || '').trim();
  if (pin.startsWith('75')) return 'odisha';
  if (/^(70|71|72|73|74|76|77|78|79)/.test(pin)) return 'east';
  return 'national';
};

const getDispatchHub = async () => {
  const row = await dbGetAsync(
    'SELECT name, lat, lng FROM hubs WHERE active = 1 AND lat IS NOT NULL AND lng IS NOT NULL ORDER BY id ASC LIMIT 1'
  );
  if (row && Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) {
    return {
      name: row.name || DEFAULT_CAMIGO_HUB.name,
      lat: Number(row.lat),
      lng: Number(row.lng)
    };
  }
  return DEFAULT_CAMIGO_HUB;
};

const buildDeliveryQuote = async ({ address = '', pincode = '', lat, lng, items = [], productLookup = new Map() } = {}) => {
  const serviceability = checkServiceability({ address, pincode, lat, lng });
  if (!serviceability.serviceable) {
    return {
      ...serviceability,
      charge: 0,
      baseQuote: 0,
      safetyMarkup: 0,
      provider: 'Unavailable',
      providerCode: 'blocked',
      estimateLabel: 'Not serviceable',
      zoneLabel: 'Invalid delivery area',
      message: 'Enter a valid 6-digit delivery pincode. Same-day is for Bhubaneswar/Cuttack/Khordha/Jatni, and outside-zone orders go by Delhivery courier.',
      distanceKm: null,
      estimatedWeightKg: null,
      chargeableWeightKg: null
    };
  }

  if (serviceability.localServiceable) {
    const hub = await getDispatchHub();
    const hasPreciseCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    const routeMetrics = hasPreciseCoords
      ? await fetchRoadRouteMetrics(hub.lat, hub.lng, Number(lat), Number(lng))
      : null;
    const fallbackDistanceKm = hasPreciseCoords
      ? Math.max(1.5, haversineKm(hub.lat, hub.lng, Number(lat), Number(lng)) * 1.22)
      : 8;
    const mappedDistanceKm = Math.max(1.5, Number(routeMetrics?.distanceKm || fallbackDistanceKm));
    const partnerQuotes = LOCAL_PARTNER_RATE_CARD.map((rateCard) => ({
      provider: rateCard.provider,
      quote: rateCard.baseFee + (mappedDistanceKm * rateCard.perKmFee) + rateCard.handlingFee
    }));
    const fallbackBaseQuote = averageList(partnerQuotes.map(item => item.quote));
    const fallbackSafetyMarkup = Math.max(12, fallbackBaseQuote * 0.16);
    let provider = 'Uber Parcel + Rapido average';
    let providerCode = 'local-average';
    let baseQuote = fallbackBaseQuote;
    let safetyMarkup = fallbackSafetyMarkup;
    let charge = roundToStep(baseQuote + safetyMarkup, 5);
    if (hasUberDirectConfig) {
      try {
        const uberEstimate = await createUberDirectEstimate({ address, lat, lng });
        const uberBaseQuote = Number(uberEstimate.deliveryFeeMinor || 0) / 100;
        if (uberBaseQuote > 0) {
          provider = 'Uber Direct';
          providerCode = 'uber-direct';
          baseQuote = uberBaseQuote;
          safetyMarkup = Math.max(10, uberBaseQuote * 0.08);
          charge = roundToStep(baseQuote + safetyMarkup, 5);
        }
      } catch (error) {
        console.warn(`Uber Direct estimate fallback used: ${error.message}`);
      }
    }
    const estimateLabel = routeMetrics?.durationMin
      ? routeMetrics.durationMin <= 60
        ? '45-90 mins'
        : routeMetrics.durationMin <= 150
          ? '90-150 mins'
          : 'Same day'
      : mappedDistanceKm <= 8
        ? '45-90 mins'
        : mappedDistanceKm <= 18
          ? '90-150 mins'
          : 'Same day';
    return {
      ...serviceability,
      charge,
      baseQuote: roundCurrency(baseQuote),
      safetyMarkup: roundCurrency(safetyMarkup),
      provider,
      providerCode,
      estimateLabel,
      zoneLabel: 'Same-day local zone',
      message: providerCode === 'uber-direct'
        ? 'Same-day delivery quote is coming from Uber Direct, with a small Camigo safety margin added to the checkout delivery charge.'
        : 'Same-day delivery charge is averaged from Uber Parcel and Rapido, then increased slightly for Camigo delivery safety.',
      distanceKm: roundOneDecimal(mappedDistanceKm),
      durationMin: routeMetrics?.durationMin || null,
      distanceSource: routeMetrics?.source || (hasPreciseCoords ? 'gps-estimate' : 'default-estimate'),
      estimatedWeightKg: null,
      chargeableWeightKg: null,
      hubName: hub.name
    };
  }

  const laneKey = detectDelhiveryLane(serviceability.detectedPincode);
  const lane = DELHIVERY_RATE_CARD[laneKey];
  const estimatedWeightKg = estimateItemWeightKg(items, productLookup);
  const chargeableWeightKg = Math.max(1, Math.ceil(estimatedWeightKg));
  const baseQuote = averageList(lane.baseQuotes)
    + (Math.max(0, chargeableWeightKg - 1) * averageList(lane.additionalKgQuotes))
    + averageList(lane.handlingQuotes);
  const safetyMarkup = Math.max(14, baseQuote * lane.safetyMarkupRate);
  const charge = roundToStep(baseQuote + safetyMarkup, 5);
  return {
    ...serviceability,
    charge,
    baseQuote: roundCurrency(baseQuote),
    safetyMarkup: roundCurrency(safetyMarkup),
    provider: 'Delhivery',
    providerCode: 'delhivery',
    estimateLabel: lane.estimateLabel,
    zoneLabel: lane.label,
    message: 'Outside the same-day corridor, Camigo will use averaged Delhivery courier pricing with a safety margin added to the checkout delivery charge.',
    distanceKm: null,
    estimatedWeightKg: roundOneDecimal(estimatedWeightKg),
    chargeableWeightKg
  };
};

const splitContactName = (value = '') => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Camigo', lastName: 'Customer' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Customer'
  };
};

const sanitizeDelhiveryText = (value = '') => String(value || '')
  .replace(/[&#%;\\]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toE164IndianPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`;
  const local = digits.slice(-10);
  return local ? `+91${local}` : '';
};

const buildUberDropoffAddress = ({ address = '', lat, lng } = {}) => {
  const formattedAddress = String(address || '').replace(/\s+/g, ' ').trim();
  const payload = { formatted_address: formattedAddress };
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    payload.location = {
      latitude: Number(lat),
      longitude: Number(lng)
    };
  }
  return payload;
};

const createDelhiveryShipmentForOrder = async (order, currentUser, productLookup = new Map()) => {
  if (!hasDelhiveryApiConfig) return null;
  const orderItems = await dbAllAsync(
    `SELECT oi.*, p.name, p.description, p.category_id
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [order.id]
  );
  if (!orderItems.length) {
    throw new Error('Delhivery shipment needs at least one order item');
  }

  const weightLookup = new Map(orderItems.map(item => [item.product_id, { category_id: item.category_id }]));
  const estimatedWeightKg = estimateItemWeightKg(orderItems, weightLookup.size ? weightLookup : productLookup);
  const totalPieces = orderItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
  const consigneePhone = String(currentUser?.phone || '').replace(/\D/g, '').slice(-10);
  if (!consigneePhone) {
    throw new Error('Customer phone is required for Delhivery shipment creation');
  }

  const shipments = [{
    name: sanitizeDelhiveryText(currentUser?.name || 'Camigo Customer'),
    add: sanitizeDelhiveryText(order.address || currentUser?.address || ''),
    pin: String(order.address || '').match(/\b([1-9]\d{5})\b/)?.[1] || '',
    city: sanitizeDelhiveryText(String(order.address || '').split(',').slice(-2, -1)[0] || 'Bhubaneswar'),
    state: DELHIVERY_SELLER_STATE,
    country: DELHIVERY_SELLER_COUNTRY,
    phone: consigneePhone,
    order: `camigo-${order.id}`,
    payment_mode: 'Prepaid',
    return_pin: DELHIVERY_SELLER_PINCODE,
    return_city: DELHIVERY_SELLER_CITY,
    return_phone: String(DELHIVERY_SELLER_PHONE).replace(/\D/g, '').slice(-10),
    return_add: sanitizeDelhiveryText(DELHIVERY_SELLER_ADDRESS),
    return_state: DELHIVERY_SELLER_STATE,
    return_country: DELHIVERY_SELLER_COUNTRY,
    products_desc: sanitizeDelhiveryText(orderItems.map(item => item.name).join(', ')).slice(0, 240),
    hsn_code: DELHIVERY_HSN_CODE || undefined,
    cod_amount: '0',
    order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 19).replace('T', ' '),
    total_amount: String(Math.round(Number(order.final_amount || order.total_amount || 0))),
    seller_add: sanitizeDelhiveryText(DELHIVERY_SELLER_ADDRESS),
    seller_name: sanitizeDelhiveryText(DELHIVERY_SELLER_NAME),
    seller_inv: `camigo-${order.id}`,
    quantity: String(totalPieces),
    shipment_width: '20',
    shipment_height: '20',
    weight: String(Math.max(500, Math.round(Number(estimatedWeightKg || 0.5) * 1000))),
    seller_gst_tin: DELHIVERY_SELLER_GSTIN || undefined,
    client: DELHIVERY_CLIENT_NAME,
    pickup_location: DELHIVERY_PICKUP_LOCATION
  }];

  const payload = {
    shipments,
    pickup_location: {
      name: DELHIVERY_PICKUP_LOCATION
    }
  };

  const body = new URLSearchParams({
    format: 'json',
    data: JSON.stringify(payload)
  });

  const response = await fetch('https://track.delhivery.com/api/cmu/create.json', {
    method: 'POST',
    headers: {
      Authorization: `Token ${DELHIVERY_API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Delhivery shipment creation failed');
  }
  const packageInfo = Array.isArray(data?.packages) ? data.packages[0] : null;
  const waybill = packageInfo?.waybill || data?.packages?.[0]?.waybill || data?.waybill || null;
  const status = packageInfo?.status || data?.packages?.[0]?.status || 'manifested';
  await dbRunAsync(
    `UPDATE orders
     SET delhivery_waybill = ?, delhivery_status = ?, delhivery_reference = ?, delhivery_last_event_at = CURRENT_TIMESTAMP,
         manual_dispatch_provider = COALESCE(manual_dispatch_provider, ?),
         manual_dispatch_status = CASE WHEN COALESCE(manual_dispatch_status, 'not_booked') = 'not_booked' THEN 'booked' ELSE manual_dispatch_status END,
         manual_dispatch_reference = COALESCE(manual_dispatch_reference, ?)
     WHERE id = ?`,
    [
      waybill,
      status,
      `camigo-${order.id}`,
      'Delhivery auto',
      waybill || `camigo-${order.id}`,
      order.id
    ]
  );
  return { data, waybill, status };
};

const getUberDirectAccessToken = async () => {
  if (!hasUberDirectConfig) {
    throw new Error('Uber Direct is not configured on the server yet');
  }
  if (uberDirectTokenCache.accessToken && Date.now() < uberDirectTokenCache.expiresAt - 60000) {
    return uberDirectTokenCache.accessToken;
  }
  const body = new URLSearchParams({
    client_id: UBER_DIRECT_CLIENT_ID,
    client_secret: UBER_DIRECT_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'eats.deliveries'
  });
  const response = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || 'Uber Direct authentication failed');
  }
  uberDirectTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 0) * 1000)
  };
  return uberDirectTokenCache.accessToken;
};

const uberDirectRequest = async (path, { method = 'GET', body } = {}) => {
  const accessToken = await getUberDirectAccessToken();
  const response = await fetch(`https://api.uber.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Uber Direct request failed');
  }
  return data;
};

const createUberDirectEstimate = async ({ address, lat, lng } = {}) => {
  const quote = await uberDirectRequest('/v1/eats/deliveries/estimates', {
    method: 'POST',
    body: {
      pickup: {
        store_id: UBER_DIRECT_STORE_ID,
        instructions: UBER_DIRECT_PICKUP_INSTRUCTIONS || null
      },
      dropoff_address: buildUberDropoffAddress({ address, lat, lng }),
      pickup_times: [0]
    }
  });
  const estimate = Array.isArray(quote?.estimates) ? quote.estimates[0] : null;
  return {
    estimateId: quote?.estimate_id || '',
    pickupAt: estimate?.pickup_at ?? 0,
    deliveryFeeMinor: Number(estimate?.delivery_fee?.total || 0),
    currencyCode: estimate?.delivery_fee?.currency_code || 'INR',
    etdTimestamp: estimate?.etd || null
  };
};

const mapUberTripStatusToCamigo = (statusCode = '') => {
  switch (String(statusCode || '').toUpperCase()) {
    case 'SCHEDULED':
      return 'pending';
    case 'EN_ROUTE_TO_PICKUP':
      return 'accepted';
    case 'ARRIVED_AT_PICKUP':
      return 'arrived_at_store';
    case 'EN_ROUTE_TO_DROPOFF':
    case 'ARRIVED_AT_DROPOFF':
      return 'out_for_delivery';
    case 'COMPLETED':
      return 'delivered';
    case 'FAILED':
      return 'cancelled';
    default:
      return null;
  }
};

const syncUberDirectOrderStatus = async (order, uberStatus) => {
  const courierTrip = Array.isArray(uberStatus?.courier_trips) ? uberStatus.courier_trips[uberStatus.courier_trips.length - 1] : null;
  const courier = courierTrip?.courier || {};
  const nextStatus = mapUberTripStatusToCamigo(courierTrip?.status || courierTrip?.status_code || uberStatus?.order_status);
  await dbRunAsync(
    `UPDATE orders
     SET uber_status = ?, uber_tracking_url = COALESCE(?, uber_tracking_url), uber_courier_name = ?, uber_courier_phone = ?, uber_last_event_at = CURRENT_TIMESTAMP,
         status = CASE WHEN ? IS NOT NULL THEN ? ELSE status END
     WHERE id = ?`,
    [
      courierTrip?.status || courierTrip?.status_code || uberStatus?.order_status || null,
      uberStatus?.order_tracking_url || null,
      courier?.name || null,
      courier?.phone || courier?.phone_number || courier?.public_phone_info?.formatted_phone_number || null,
      nextStatus,
      nextStatus,
      order.id
    ]
  );
};

const createUberDirectDeliveryForOrder = async (order, currentUser) => {
  if (!hasUberDirectConfig) return null;
  const orderItems = await dbAllAsync(
    `SELECT oi.*, p.name, p.description, p.category_id
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [order.id]
  );
  if (!orderItems.length) {
    throw new Error('Uber Direct delivery needs at least one order item');
  }
  const estimate = await createUberDirectEstimate({
    address: order.address,
    lat: order.customer_lat,
    lng: order.customer_lng
  });
  if (!estimate.estimateId) {
    throw new Error('Uber Direct did not return an estimate ID');
  }
  const { firstName, lastName } = splitContactName(currentUser?.name || 'Camigo Customer');
  const payload = {
    estimate_id: estimate.estimateId,
    pickup_at: estimate.pickupAt,
    external_order_id: `camigo-${order.id}`,
    external_user_id: String(order.user_id),
    pickup: {
      store_id: UBER_DIRECT_STORE_ID,
      instructions: UBER_DIRECT_PICKUP_INSTRUCTIONS || null
    },
    dropoff: {
      address: buildUberDropoffAddress({
        address: order.address,
        lat: order.customer_lat,
        lng: order.customer_lng
      }),
      contact: {
        first_name: firstName,
        last_name: lastName,
        email: currentUser?.email || '',
        phone: toE164IndianPhone(currentUser?.phone || '')
      },
      instructions: 'Camigo order delivery',
      type: 'DOOR'
    },
    order_items: orderItems.map((item) => ({
      name: item.name,
      description: item.description || '',
      external_id: String(item.product_id),
      quantity: Number(item.quantity || 1),
      price: Math.round(Number(item.price || 0) * 100),
      currency_code: 'INR',
      weight: Math.max(100, Math.round(Number(item.quantity || 1) * 500))
    })),
    order_summary: {
      currency_code: 'INR',
      order_value: Math.round(Number(order.total_amount || order.final_amount || 0) * 100)
    },
    return_trips_enabled: false
  };
  const created = await uberDirectRequest('/v1/eats/deliveries/orders', {
    method: 'POST',
    body: payload
  });
  await dbRunAsync(
    `UPDATE orders
     SET uber_direct_order_id = ?, uber_tracking_url = ?, uber_status = ?, delivery_provider = ?, uber_last_event_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      created?.order_id || null,
      created?.order_tracking_url || null,
      'SCHEDULED',
      'Uber Direct',
      order.id
    ]
  );
  return created;
};

const getUberDirectDeliveryStatus = async (orderId) => uberDirectRequest(`/v1/eats/deliveries/orders/${orderId}`);

const cancelUberDirectDelivery = async (orderId, cancellingParty = 'CUSTOMER') => {
  if (!orderId) return null;
  return uberDirectRequest(`/v1/eats/orders/${orderId}/cancel`, {
    method: 'POST',
    body: {
      reason: 'CUSTOMER_CALLED_TO_CANCEL',
      cancelling_party: cancellingParty
    }
  });
};

const addYears = (date, years) => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + Number(years || 5));
  return next;
};

const dbGetAsync = (query, params = []) => new Promise((resolve, reject) => {
  db.get(query, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});

const dbAllAsync = (query, params = []) => new Promise((resolve, reject) => {
  db.all(query, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

const dbRunAsync = (query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const getAppSetting = async (settingKey) => {
  const key = normalizeSettingKey(settingKey);
  if (!key) return null;
  return dbGetAsync(
    'SELECT setting_key, value, updated_at FROM app_settings WHERE setting_key = ?',
    [key]
  );
};

const getJsonAppSetting = async (settingKey, fallbackValue = null) => {
  const row = await getAppSetting(settingKey);
  if (!row?.value) return fallbackValue;
  try {
    return JSON.parse(row.value);
  } catch (error) {
    return fallbackValue;
  }
};

const saveJsonAppSetting = async (settingKey, value) => {
  const key = normalizeSettingKey(settingKey);
  if (!key) throw new Error('Setting key is required');
  await dbRunAsync(
    `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [key, JSON.stringify(value)]
  );
};

const isCodEnabled = async () => Boolean(await getJsonAppSetting(APP_SETTING_KEYS.codEnabled, false));

const resolveSetupPackages = async () => {
  const stored = await getJsonAppSetting(APP_SETTING_KEYS.homepageSetupPackages, null);
  return sanitizeSetupPackages(stored);
};

const buildSetupPackageProductDraft = (entry = {}) => {
  const title = String(entry.title || '').trim();
  const subtitle = String(entry.subtitle || '').trim();
  return {
    name: title,
    description: subtitle || `${title} full setup package from Camigo.`,
    price: Math.max(0, Math.round(Number(entry.price || 0))),
    mrp: Math.max(0, Math.round(Number(entry.price || 0))),
    image: String(entry.image || '/category-real/accessories.jpg').trim(),
    category_id: Number(entry.category_id || 1),
    stock: 25,
    unit: '1 Setup',
    discount_percent: 0,
    dealer_price: null,
    distributor_price: null,
    warranty_years: 5
  };
};

const syncSetupPackageProducts = async (entries = []) => {
  const nextPackages = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = sanitizeSetupPackage(entries[index], index);
    const draft = buildSetupPackageProductDraft(entry);
    let productId = Number(entry.product_id || 0);
    let existingProduct = null;

    if (productId > 0) {
      existingProduct = await dbGetAsync('SELECT id FROM products WHERE id = ?', [productId]);
    }
    if (!existingProduct) {
      existingProduct = await dbGetAsync(
        'SELECT id FROM products WHERE lower(name) = lower(?) ORDER BY id ASC LIMIT 1',
        [draft.name]
      );
    }

    if (existingProduct?.id) {
      productId = Number(existingProduct.id);
      await dbRunAsync(
        `UPDATE products
         SET name = ?, description = ?, price = ?, mrp = ?, image = ?, category_id = ?, stock = ?, unit = ?,
             discount_percent = ?, dealer_price = ?, distributor_price = ?, warranty_years = ?
         WHERE id = ?`,
        [
          draft.name,
          draft.description,
          draft.price,
          draft.mrp,
          draft.image,
          draft.category_id,
          draft.stock,
          draft.unit,
          draft.discount_percent,
          draft.dealer_price,
          draft.distributor_price,
          draft.warranty_years,
          productId
        ]
      );
      await new Promise((resolve, reject) => {
        saveProductImages(productId, draft.image, [draft.image], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } else {
      const created = await dbRunAsync(
        `INSERT INTO products (
           name, description, price, mrp, image, category_id, stock, unit,
           discount_percent, dealer_price, distributor_price, warranty_years
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          draft.name,
          draft.description,
          draft.price,
          draft.mrp,
          draft.image,
          draft.category_id,
          draft.stock,
          draft.unit,
          draft.discount_percent,
          draft.dealer_price,
          draft.distributor_price,
          draft.warranty_years
        ]
      );
      productId = Number(created.lastID);
      await new Promise((resolve, reject) => {
        saveProductImages(productId, draft.image, [draft.image], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    nextPackages.push({
      ...entry,
      product_id: productId,
      category_id: draft.category_id
    });
  }
  return nextPackages;
};

const normalizeImageList = (value) => {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map(item => String(item || '').trim())
    .filter(Boolean);
};

const hasManifestValue = (entry, key) => Object.prototype.hasOwnProperty.call(entry, key);
const valueOrFallback = (entry, key, fallback) => (hasManifestValue(entry, key) ? entry[key] : fallback);
const numberOrFallback = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const integerOrFallback = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

const stableHash = (value = '') => crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');

const syntheticReviewNames = [
  'Amit Sharma',
  'Priya Nair',
  'Rohit Das',
  'Sneha Patnaik',
  'Vikram Singh',
  'Ananya Mishra',
  'Suresh Kumar',
  'Neha Reddy',
  'Arjun Mehta',
  'Pooja Sahoo'
];

const syntheticReviewText = [
  'Clear picture quality and quick delivery.',
  'Good packaging and stable night vision.',
  'Installation was simple and the camera feels reliable.',
  'Worth the price for home and shop security.',
  'Image clarity is better than expected.'
];

const buildSyntheticProductRating = (product = {}) => {
  const seed = parseInt(stableHash(`${product.id}:${product.name}`).slice(0, 8), 16) || 0;
  const text = `${product.name || ''} ${product.description || ''} ${product.category_name || ''}`.toLowerCase();
  const isIpProduct = /\bip\b|ip camera|poe|nvr/.test(text) || Number(product.category_id) === 2;
  const isAhdProduct = /\bahd\b|analog|dvr/.test(text) || Number(product.category_id) === 1;
  const ratingMin = isIpProduct ? 4.8 : isAhdProduct ? 4.3 : 4.5;
  const ratingMax = isIpProduct ? 5.0 : isAhdProduct ? 4.5 : 4.8;
  const rating = Math.min(ratingMax, ratingMin + ((seed % 21) / 20) * (ratingMax - ratingMin));
  const ratingCount = 200 + (seed % 501);
  const reviews = [0, 1, 2].map(offset => ({
    name: syntheticReviewNames[(seed + offset * 3) % syntheticReviewNames.length],
    rating: Math.min(5, Number((rating + (offset === 0 ? 0.1 : offset === 1 ? 0 : -0.1)).toFixed(1))),
    text: syntheticReviewText[(seed + offset) % syntheticReviewText.length]
  }));

  return {
    rating_average: Number(rating.toFixed(1)),
    rating_count: ratingCount,
    reviews
  };
};

const findProductForManifest = async (entry) => {
  const productId = Number(entry.id || entry.product_id);
  if (Number.isInteger(productId) && productId > 0) {
    const byId = await dbGetAsync('SELECT * FROM products WHERE id = ?', [productId]);
    if (byId) return byId;
  }
  const name = String(entry.name || '').trim();
  if (!name) return null;
  return dbGetAsync('SELECT * FROM products WHERE lower(name) = lower(?)', [name]);
};

const findCategoryIdForManifest = async (entry) => {
  if (String(entry.category_id) === '0' || String(entry.category_name || '').toLowerCase() === 'shop by category') return 0;
  const categoryId = Number(entry.category_id);
  if (Number.isInteger(categoryId) && categoryId > 0) {
    const byId = await dbGetAsync('SELECT id FROM categories WHERE id = ?', [categoryId]);
    if (byId) return byId.id;
  }
  const name = String(entry.category_name || entry.category || '').trim();
  if (!name) return 0;
  const byName = await dbGetAsync('SELECT id FROM categories WHERE lower(name) = lower(?)', [name]);
  return byName?.id || 0;
};

const buildMediaManifest = async () => {
  const categories = await dbAllAsync(
    `SELECT id, name, image, sort_order
     FROM categories
     ORDER BY sort_order ASC, id ASC`
  );
  const products = await dbAllAsync(
    `SELECT p.*, c.name as category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.id ASC`
  );
  const productImages = await dbAllAsync('SELECT product_id, image_url, sort_order FROM product_images ORDER BY product_id ASC, sort_order ASC, id ASC');
  const groupedImages = productImages.reduce((map, row) => {
    map[row.product_id] = map[row.product_id] || [];
    map[row.product_id].push(row.image_url);
    return map;
  }, {});
  const banners = await dbAllAsync(
    `SELECT cb.*, COALESCE(c.name, 'Shop by Category') as category_name
     FROM category_banners cb
     LEFT JOIN categories c ON cb.category_id = c.id
     ORDER BY cb.category_id ASC, cb.sort_order ASC, cb.id ASC`
  );
  return {
    version: 1,
    type: 'camigo-catalog-backup',
    generated_at: new Date().toISOString(),
    note: 'Camigo catalog backup. Host this JSON on InfinityFree or any public URL and set MEDIA_MANIFEST_URL on Render to restore category tiles, products, prices, images, and banners after restarts.',
    categories: categories.map(category => ({
      id: category.id,
      name: category.name,
      image: category.image || '',
      sort_order: Number(category.sort_order || 0)
    })),
    products: products.map(product => {
      const images = groupedImages[product.id]?.length ? groupedImages[product.id] : normalizeImageList(product.image);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price || 0),
        mrp: Number(product.mrp || 0),
        discount_percent: Number(product.discount_percent || 0),
        dealer_price: product.dealer_price === null || product.dealer_price === undefined ? null : Number(product.dealer_price),
        distributor_price: product.distributor_price === null || product.distributor_price === undefined ? null : Number(product.distributor_price),
        warranty_years: Number(product.warranty_years || 5),
        category_id: Number(product.category_id || 0),
        category_name: product.category_name || '',
        stock: Number(product.stock || 0),
        unit: product.unit || '1 Unit',
        image: images[0] || '',
        images
      };
    }),
    category_banners: banners.map(banner => ({
      id: banner.id,
      category_id: Number(banner.category_id || 0),
      category_name: banner.category_name,
      image_url: banner.image_url,
      width: Number(banner.width || 1200),
      height: Number(banner.height || 320),
      sort_order: Number(banner.sort_order || 0),
      active: Number(banner.active || 0) === 1
    }))
  };
};

const applyMediaManifest = async (manifest, source = 'manual') => {
  if (!manifest || typeof manifest !== 'object') throw new Error('Catalog backup must be a JSON object');
  const categories = Array.isArray(manifest.categories) ? manifest.categories : [];
  const products = Array.isArray(manifest.products) ? manifest.products : [];
  const banners = Array.isArray(manifest.category_banners)
    ? manifest.category_banners
    : (Array.isArray(manifest.banners) ? manifest.banners : []);
  let categoryCount = 0;
  let productCount = 0;
  let insertedProductCount = 0;
  let deletedProductCount = 0;
  let bannerCount = 0;
  const incomingProductIds = new Set();
  const incomingProductNames = new Set();

  for (const entry of categories) {
    const categoryId = Number(entry.id);
    const fallbackName = String(entry.name || '').trim();
    if (!Number.isInteger(categoryId) || categoryId <= 0 || !fallbackName) continue;
    await dbRunAsync(
      `INSERT INTO categories (id, name, image, sort_order)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         image = excluded.image,
         sort_order = excluded.sort_order`,
      [
        categoryId,
        fallbackName,
        String(entry.image || '').trim(),
        Number(entry.sort_order || 0)
      ]
    );
    categoryCount += 1;
  }

  for (const entry of products) {
    let product = await findProductForManifest(entry);
    const images = normalizeImageList(entry.images?.length ? entry.images : [entry.image, entry.image_url]);
    const categoryId = await findCategoryIdForManifest(entry);
    const fallbackName = String(entry.name || product?.name || '').trim();
    if (!product && !fallbackName) continue;

    const nextProduct = {
      name: fallbackName,
      description: String(valueOrFallback(entry, 'description', product?.description || '') || ''),
      price: numberOrFallback(valueOrFallback(entry, 'price', product?.price), product?.price || 0),
      mrp: numberOrFallback(valueOrFallback(entry, 'mrp', product?.mrp), product?.mrp || 0),
      image: images[0] || product?.image || String(entry.image || ''),
      category_id: categoryId || Number(product?.category_id || entry.category_id || 1),
      stock: integerOrFallback(valueOrFallback(entry, 'stock', product?.stock), product?.stock || 0),
      unit: String(valueOrFallback(entry, 'unit', product?.unit || '1 Unit') || '1 Unit'),
      discount_percent: numberOrFallback(valueOrFallback(entry, 'discount_percent', product?.discount_percent), product?.discount_percent || 0),
      dealer_price: numberOrFallback(valueOrFallback(entry, 'dealer_price', product?.dealer_price), product?.dealer_price ?? null),
      distributor_price: numberOrFallback(valueOrFallback(entry, 'distributor_price', product?.distributor_price), product?.distributor_price ?? null),
      warranty_years: Math.max(1, integerOrFallback(valueOrFallback(entry, 'warranty_years', product?.warranty_years), product?.warranty_years || 5))
    };

    if (product) {
      await dbRunAsync(
        `UPDATE products
         SET name = ?, description = ?, price = ?, mrp = ?, image = ?, category_id = ?, stock = ?, unit = ?,
             discount_percent = ?, dealer_price = ?, distributor_price = ?, warranty_years = ?
         WHERE id = ?`,
        [
          nextProduct.name,
          nextProduct.description,
          nextProduct.price,
          nextProduct.mrp,
          nextProduct.image,
          nextProduct.category_id,
          nextProduct.stock,
          nextProduct.unit,
          nextProduct.discount_percent,
          nextProduct.dealer_price,
          nextProduct.distributor_price,
          nextProduct.warranty_years,
          product.id
        ]
      );
    } else {
      const productId = Number(entry.id || entry.product_id);
      if (Number.isInteger(productId) && productId > 0) {
        await dbRunAsync(
          `INSERT INTO products (id, name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price, warranty_years)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            nextProduct.name,
            nextProduct.description,
            nextProduct.price,
            nextProduct.mrp,
            nextProduct.image,
            nextProduct.category_id,
            nextProduct.stock,
            nextProduct.unit,
            nextProduct.discount_percent,
            nextProduct.dealer_price,
            nextProduct.distributor_price,
            nextProduct.warranty_years
          ]
        );
        product = { id: productId };
      } else {
        const result = await dbRunAsync(
          `INSERT INTO products (name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price, warranty_years)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nextProduct.name,
            nextProduct.description,
            nextProduct.price,
            nextProduct.mrp,
            nextProduct.image,
            nextProduct.category_id,
            nextProduct.stock,
            nextProduct.unit,
            nextProduct.discount_percent,
            nextProduct.dealer_price,
            nextProduct.distributor_price,
            nextProduct.warranty_years
          ]
        );
        product = { id: result.lastID };
      }
      insertedProductCount += 1;
    }

    incomingProductIds.add(Number(product.id));
    incomingProductNames.add(String(nextProduct.name || '').trim().toLowerCase());

    if (images.length) {
      await dbRunAsync('DELETE FROM product_images WHERE product_id = ?', [product.id]);
      for (const [index, imageUrl] of images.entries()) {
        await dbRunAsync('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)', [product.id, imageUrl, index]);
      }
    }
    productCount += 1;
  }

  if (products.length) {
    const existingProducts = await dbAllAsync('SELECT id, name FROM products ORDER BY id ASC');
    const productsToRemove = existingProducts.filter(product => (
      !incomingProductIds.has(Number(product.id))
      && !incomingProductNames.has(String(product.name || '').trim().toLowerCase())
    ));
    for (const product of productsToRemove) {
      await dbRunAsync('DELETE FROM product_images WHERE product_id = ?', [product.id]);
      await dbRunAsync('DELETE FROM cart WHERE product_id = ?', [product.id]);
      const result = await dbRunAsync('DELETE FROM products WHERE id = ?', [product.id]);
      deletedProductCount += result.changes || 0;
    }
  }

  if (banners.length) {
    await dbRunAsync('DELETE FROM category_banners');
    for (const entry of banners) {
      const imageUrl = String(entry.image_url || entry.image || '').trim();
      if (!imageUrl) continue;
      const categoryId = await findCategoryIdForManifest(entry);
      await dbRunAsync(
        `INSERT INTO category_banners (category_id, image_url, width, height, sort_order, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          categoryId,
          imageUrl,
          Math.max(320, Number(entry.width) || 1200),
          Math.max(120, Number(entry.height) || 320),
          Number(entry.sort_order || 0),
          entry.active === false || String(entry.active) === '0' ? 0 : 1
        ]
      );
      bannerCount += 1;
    }
  }

  await dbRunAsync(
    `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    ['last_media_manifest_restore', JSON.stringify({ source, categoryCount, productCount, insertedProductCount, deletedProductCount, bannerCount, at: new Date().toISOString() })]
  );
  return { categoryCount, productCount, insertedProductCount, deletedProductCount, bannerCount };
};

const restoreMediaManifestFromUrl = async (url, source = 'MEDIA_MANIFEST_URL') => {
  const manifestUrl = String(url || '').trim();
  if (!manifestUrl) throw new Error('Manifest URL is required');
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Media manifest download failed (${response.status})`);
  const manifest = await response.json();
  return applyMediaManifest(manifest, source);
};

const createCatalogFtpClient = async () => {
  if (!hasCatalogFtpConfig) {
    throw new Error('InfinityFree FTP is not configured. Add MEDIA_MANIFEST_FTP_HOST, MEDIA_MANIFEST_FTP_USER, and MEDIA_MANIFEST_FTP_PASSWORD in Render Environment.');
  }
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;
  await client.access({
    host: MEDIA_MANIFEST_FTP_HOST,
    port: Number.isFinite(MEDIA_MANIFEST_FTP_PORT) ? MEDIA_MANIFEST_FTP_PORT : 21,
    user: MEDIA_MANIFEST_FTP_USER,
    password: MEDIA_MANIFEST_FTP_PASSWORD,
    secure: MEDIA_MANIFEST_FTP_SECURE
  });
  return client;
};

const restoreMediaManifestFromFtp = async (source = 'startup-ftp-import') => {
  if (!hasCatalogFtpConfig) {
    throw new Error('InfinityFree FTP is not configured for catalog restore.');
  }
  const client = await createCatalogFtpClient();
  try {
    const remotePath = normalizeCatalogBackupRemotePath();
    const payload = await collectCatalogBackupPayloadFromFtp(client, remotePath);
    const manifest = parseCatalogBackupPayload(payload, remotePath);
    return applyMediaManifest(manifest, source);
  } finally {
    client.close();
  }
};

const normalizeMediaLibraryDir = (value = '/') => {
  const parts = String(value || '/')
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  if (parts.some(part => part === '..' || part.includes('\0'))) return '/';
  const safeParts = parts.filter(part => part !== '.');
  return safeParts.length ? `/${safeParts.join('/')}` : '/';
};

const normalizeMediaLibraryBaseDir = () => {
  const raw = String(MEDIA_LIBRARY_FTP_DIR || '/htdocs').replaceAll('\\', '/');
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  return path.posix.normalize(prefixed);
};

const mediaLibraryRemoteDir = (dir = '/') => path.posix.join(
  normalizeMediaLibraryBaseDir(),
  normalizeMediaLibraryDir(dir)
);

const mediaLibraryPublicUrl = (dir, filename) => {
  const cleanDir = normalizeMediaLibraryDir(dir).replace(/^\/+|\/+$/g, '');
  const parts = cleanDir ? cleanDir.split('/').filter(Boolean) : [];
  const encodedPath = [...parts, filename].map(part => encodeURIComponent(part)).join('/');
  return `${MEDIA_LIBRARY_PUBLIC_BASE}/${encodedPath}`;
};

const normalizeCatalogBackupRemotePath = () => {
  const raw = String(MEDIA_MANIFEST_FTP_PATH || '/htdocs/camigo-catalog-backup.json').replaceAll('\\', '/');
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  return path.posix.normalize(prefixed);
};

const collectCatalogBackupPayloadFromFtp = async (client, remotePath = normalizeCatalogBackupRemotePath()) => {
  const chunks = [];
  const collector = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      callback();
    }
  });
  await client.downloadTo(collector, remotePath);
  return Buffer.concat(chunks).toString('utf8').trim();
};

const parseCatalogBackupPayload = (payload, remotePath = normalizeCatalogBackupRemotePath()) => {
  if (!payload) throw new Error(`Catalog backup FTP file is empty: ${remotePath}`);
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error(`Catalog backup FTP file is not valid JSON: ${error.message}`);
  }
};

const catalogPayloadHash = (payload) => crypto.createHash('sha256').update(String(payload || ''), 'utf8').digest('hex');

const uploadCatalogBackupToFtp = async (reason = 'catalog-change') => {
  if (!hasCatalogFtpConfig) return { skipped: true };
  const client = await createCatalogFtpClient();
  try {
    const manifest = await buildMediaManifest();
    const payload = JSON.stringify({
      ...manifest,
      synced_at: new Date().toISOString(),
      sync_reason: reason
    }, null, 2);
    const remotePath = normalizeCatalogBackupRemotePath();
    const remoteDir = path.posix.dirname(remotePath);
    if (remoteDir && remoteDir !== '/' && remoteDir !== '.') {
      await client.ensureDir(remoteDir);
    }
    await client.uploadFrom(Readable.from([payload]), remotePath);
    const uploadedPayload = await collectCatalogBackupPayloadFromFtp(client, remotePath);
    const expectedHash = catalogPayloadHash(payload);
    const uploadedHash = catalogPayloadHash(uploadedPayload);
    if (expectedHash !== uploadedHash) {
      throw new Error('Catalog backup verification failed after FTP upload. The uploaded JSON does not match the saved catalog.');
    }
    await dbRunAsync(
      `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [
        'last_catalog_backup_sync',
        JSON.stringify({
          reason,
          remotePath,
          productCount: manifest.products.length,
          bannerCount: manifest.category_banners.length,
          checksum: uploadedHash,
          at: new Date().toISOString()
        })
      ]
    );
    console.log(`Catalog backup uploaded to FTP: ${remotePath}`);
    return {
      skipped: false,
      remotePath,
      productCount: manifest.products.length,
      bannerCount: manifest.category_banners.length,
      verified: true,
      checksum: uploadedHash
    };
  } finally {
    client.close();
  }
};

let catalogBackupSyncTimer = null;
const queueCatalogBackupSync = (reason = 'catalog-change') => {
  if (!hasCatalogFtpConfig) return;
  if (catalogBackupSyncTimer) clearTimeout(catalogBackupSyncTimer);
  catalogBackupSyncTimer = setTimeout(() => {
    catalogBackupSyncTimer = null;
    uploadCatalogBackupToFtp(reason).catch(error => {
      console.warn(`Catalog backup FTP sync failed: ${error.message}`);
    });
  }, 2500);
};

const syncCatalogBackupForResponse = async (reason = 'catalog-change') => {
  if (!hasCatalogFtpConfig) {
    return {
      skipped: true,
      warning: 'Saved on Render only. InfinityFree catalog backup is not configured, so product details can reset after redeploy.'
    };
  }
  try {
    const result = await uploadCatalogBackupToFtp(reason);
    const warning = catalogRestoreUrlWarning();
    return { ...result, ok: true, warning: warning || undefined };
  } catch (error) {
    console.warn(`Catalog backup FTP sync failed: ${error.message}`);
    return {
      failed: true,
      warning: `Saved on Render, but InfinityFree catalog backup failed: ${error.message}`
    };
  }
};

const normalizeOperationalStateRemotePath = () => {
  const raw = String(OPERATIONAL_STATE_FTP_PATH || '/htdocs/camigo-operational-backup.enc').replaceAll('\\', '/');
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  return path.posix.normalize(prefixed);
};

const buildOperationalStateManifest = async () => {
  const appSettingPlaceholders = OPERATIONAL_APP_SETTING_KEYS.map(() => '?').join(', ');
  const [users, hubs, deliveryPartnerDetails, orders, orderItems, deliveryLocations, notifications, warrantyRegistrations, serviceTickets, userAddresses, savedItems, appSettings] = await Promise.all([
    dbAllAsync(
      `SELECT id, email, password, plaintext_password, name, phone, address, role,
              phone_verified, phone_verified_at, created_at
       FROM users
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT id, name, address, lat, lng, map_url, active, created_at
       FROM hubs
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT user_id, vehicle_type, vehicle_number, license_number, hub_id, active
       FROM delivery_partner_details
       ORDER BY user_id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM orders
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM order_items
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT partner_id, lat, lng, status, updated_at
       FROM delivery_locations
       ORDER BY partner_id ASC`
    ),
    dbAllAsync(
      `SELECT id, title, message, target, personalize, product_id, image_url, user_id, created_at
       FROM notifications
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM warranty_registrations
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM service_tickets
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM user_addresses
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT *
       FROM saved_items
       ORDER BY id ASC`
    ),
    dbAllAsync(
      `SELECT setting_key, value, updated_at
       FROM app_settings
       WHERE setting_key IN (${appSettingPlaceholders})
       ORDER BY setting_key ASC`,
      OPERATIONAL_APP_SETTING_KEYS
    )
  ]);

  return {
    version: 1,
    type: 'camigo-operational-backup',
    generated_at: new Date().toISOString(),
    users,
    hubs,
    delivery_partner_details: deliveryPartnerDetails,
    orders,
    order_items: orderItems,
    delivery_locations: deliveryLocations,
    notifications,
    warranty_registrations: warrantyRegistrations,
    service_tickets: serviceTickets,
    user_addresses: userAddresses,
    saved_items: savedItems,
    app_settings: appSettings
  };
};

const encryptOperationalStatePayload = (manifest) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', OPERATIONAL_STATE_ENCRYPTION_KEY, iv);
  const payload = JSON.stringify(manifest, null, 2);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    version: 1,
    type: 'camigo-operational-backup-envelope',
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64')
  }, null, 2);
};

const decryptOperationalStatePayload = (payload, remotePath = normalizeOperationalStateRemotePath()) => {
  if (!payload) throw new Error(`Operational backup FTP file is empty: ${remotePath}`);
  let envelope;
  try {
    envelope = JSON.parse(payload);
  } catch (error) {
    throw new Error(`Operational backup FTP file is not valid JSON: ${error.message}`);
  }

  if (envelope?.type !== 'camigo-operational-backup-envelope') {
    throw new Error(`Operational backup FTP file has unsupported type: ${envelope?.type || 'unknown'}`);
  }
  if (envelope?.algorithm !== 'aes-256-gcm') {
    throw new Error(`Operational backup FTP file has unsupported algorithm: ${envelope?.algorithm || 'unknown'}`);
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      OPERATIONAL_STATE_ENCRYPTION_KEY,
      Buffer.from(String(envelope.iv || ''), 'base64')
    );
    decipher.setAuthTag(Buffer.from(String(envelope.tag || ''), 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(String(envelope.data || ''), 'base64')),
      decipher.final()
    ]).toString('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Operational backup decrypt failed: ${error.message}`);
  }
};

const operationalPayloadHash = (payload) => crypto.createHash('sha256').update(String(payload || ''), 'utf8').digest('hex');

const applyOperationalStateManifest = async (manifest, source = 'operational-state-import') => {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Operational state manifest must be a JSON object');
  }
  if (manifest.type !== 'camigo-operational-backup') {
    throw new Error(`Unsupported operational state manifest type: ${manifest.type || 'unknown'}`);
  }

  const users = Array.isArray(manifest.users) ? manifest.users : [];
  const hubs = Array.isArray(manifest.hubs) ? manifest.hubs : [];
  const deliveryPartnerDetails = Array.isArray(manifest.delivery_partner_details)
    ? manifest.delivery_partner_details
    : [];
  const orders = Array.isArray(manifest.orders) ? manifest.orders : [];
  const orderItems = Array.isArray(manifest.order_items) ? manifest.order_items : [];
  const deliveryLocations = Array.isArray(manifest.delivery_locations) ? manifest.delivery_locations : [];
  const notifications = Array.isArray(manifest.notifications) ? manifest.notifications : [];
  const warrantyRegistrations = Array.isArray(manifest.warranty_registrations) ? manifest.warranty_registrations : [];
  const serviceTickets = Array.isArray(manifest.service_tickets) ? manifest.service_tickets : [];
  const userAddresses = Array.isArray(manifest.user_addresses) ? manifest.user_addresses : [];
  const savedItems = Array.isArray(manifest.saved_items) ? manifest.saved_items : [];
  const appSettings = Array.isArray(manifest.app_settings) ? manifest.app_settings : [];

  await dbRunAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    for (const user of users) {
      await dbRunAsync(
        `INSERT INTO users (
           id, email, password, plaintext_password, name, phone, address, role,
           phone_verified, phone_verified_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password = excluded.password,
           plaintext_password = excluded.plaintext_password,
           name = excluded.name,
           phone = excluded.phone,
           address = excluded.address,
           role = excluded.role,
           phone_verified = excluded.phone_verified,
           phone_verified_at = excluded.phone_verified_at,
           created_at = COALESCE(excluded.created_at, users.created_at)`,
        [
          user.id,
          user.email || null,
          user.password || null,
          user.plaintext_password || null,
          user.name || '',
          user.phone || null,
          user.address || '',
          user.role || 'user',
          Number(user.phone_verified) ? 1 : 0,
          user.phone_verified_at || null,
          user.created_at || null
        ]
      );
    }

    for (const hub of hubs) {
      await dbRunAsync(
        `INSERT INTO hubs (id, name, address, lat, lng, map_url, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           address = excluded.address,
           lat = excluded.lat,
           lng = excluded.lng,
           map_url = excluded.map_url,
           active = excluded.active,
           created_at = COALESCE(excluded.created_at, hubs.created_at)`,
        [
          hub.id,
          hub.name || '',
          hub.address || '',
          Number(hub.lat) || 0,
          Number(hub.lng) || 0,
          hub.map_url || '',
          Number(hub.active) ? 1 : 0,
          hub.created_at || null
        ]
      );
    }

    for (const details of deliveryPartnerDetails) {
      await dbRunAsync(
        `INSERT INTO delivery_partner_details (
           user_id, vehicle_type, vehicle_number, license_number, hub_id, active
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           vehicle_type = excluded.vehicle_type,
           vehicle_number = excluded.vehicle_number,
           license_number = excluded.license_number,
           hub_id = excluded.hub_id,
           active = excluded.active`,
        [
          details.user_id,
          details.vehicle_type || 'bike',
          details.vehicle_number || '',
          details.license_number || '',
          details.hub_id || null,
          Number(details.active) ? 1 : 0
        ]
      );
    }

    for (const order of orders) {
      await dbRunAsync(
        `INSERT INTO orders (
           id, user_id, total_amount, final_amount, gst_amount, delivery_fee,
           delivery_mode, delivery_provider, delivery_estimate, delivery_distance_km, delivery_weight_kg,
           status, payment_method, address, customer_lat, customer_lng, customer_accuracy,
           customer_location_locked_at, installation_requested, installation_fee, installation_status,
           installer_id, camera_count, delivery_partner_id, delivery_otp, created_at,
           payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_verified_at,
           uber_direct_order_id, uber_tracking_url, uber_status, uber_courier_name, uber_courier_phone, uber_last_event_at,
           manual_dispatch_provider, manual_dispatch_status, manual_dispatch_reference, manual_dispatch_notes, manual_dispatch_updated_at,
           delhivery_waybill, delhivery_status, delhivery_reference, delhivery_last_event_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           total_amount = excluded.total_amount,
           final_amount = excluded.final_amount,
           gst_amount = excluded.gst_amount,
           delivery_fee = excluded.delivery_fee,
           delivery_mode = excluded.delivery_mode,
           delivery_provider = excluded.delivery_provider,
           delivery_estimate = excluded.delivery_estimate,
           delivery_distance_km = excluded.delivery_distance_km,
           delivery_weight_kg = excluded.delivery_weight_kg,
           status = excluded.status,
           payment_method = excluded.payment_method,
           address = excluded.address,
           customer_lat = excluded.customer_lat,
           customer_lng = excluded.customer_lng,
           customer_accuracy = excluded.customer_accuracy,
           customer_location_locked_at = excluded.customer_location_locked_at,
           installation_requested = excluded.installation_requested,
           installation_fee = excluded.installation_fee,
           installation_status = excluded.installation_status,
           installer_id = excluded.installer_id,
           camera_count = excluded.camera_count,
           delivery_partner_id = excluded.delivery_partner_id,
           delivery_otp = excluded.delivery_otp,
           created_at = COALESCE(excluded.created_at, orders.created_at),
           payment_status = excluded.payment_status,
           razorpay_order_id = excluded.razorpay_order_id,
           razorpay_payment_id = excluded.razorpay_payment_id,
           razorpay_signature = excluded.razorpay_signature,
           payment_verified_at = excluded.payment_verified_at,
           uber_direct_order_id = excluded.uber_direct_order_id,
           uber_tracking_url = excluded.uber_tracking_url,
           uber_status = excluded.uber_status,
           uber_courier_name = excluded.uber_courier_name,
           uber_courier_phone = excluded.uber_courier_phone,
           uber_last_event_at = excluded.uber_last_event_at,
           manual_dispatch_provider = excluded.manual_dispatch_provider,
           manual_dispatch_status = excluded.manual_dispatch_status,
           manual_dispatch_reference = excluded.manual_dispatch_reference,
           manual_dispatch_notes = excluded.manual_dispatch_notes,
           manual_dispatch_updated_at = excluded.manual_dispatch_updated_at,
           delhivery_waybill = excluded.delhivery_waybill,
           delhivery_status = excluded.delhivery_status,
           delhivery_reference = excluded.delhivery_reference,
           delhivery_last_event_at = excluded.delhivery_last_event_at`,
        [
          order.id,
          order.user_id,
          Number(order.total_amount || 0),
          Number(order.final_amount || order.total_amount || 0),
          Number(order.gst_amount || 0),
          Number(order.delivery_fee || 0),
          order.delivery_mode || 'local',
          order.delivery_provider || null,
          order.delivery_estimate || null,
          order.delivery_distance_km ?? null,
          order.delivery_weight_kg ?? null,
          order.status || 'pending',
          order.payment_method || null,
          order.address || '',
          order.customer_lat ?? null,
          order.customer_lng ?? null,
          order.customer_accuracy ?? null,
          order.customer_location_locked_at ?? null,
          Number(order.installation_requested) ? 1 : 0,
          Number(order.installation_fee || 0),
          order.installation_status || 'not_requested',
          order.installer_id || null,
          Number(order.camera_count || 0),
          order.delivery_partner_id || null,
          order.delivery_otp || null,
          order.created_at || null,
          order.payment_status || 'created',
          order.razorpay_order_id || null,
          order.razorpay_payment_id || null,
          order.razorpay_signature || null,
          order.payment_verified_at || null,
          order.uber_direct_order_id || null,
          order.uber_tracking_url || null,
          order.uber_status || null,
          order.uber_courier_name || null,
          order.uber_courier_phone || null,
          order.uber_last_event_at || null,
          order.manual_dispatch_provider || null,
          order.manual_dispatch_status || null,
          order.manual_dispatch_reference || null,
          order.manual_dispatch_notes || null,
          order.manual_dispatch_updated_at || null,
          order.delhivery_waybill || null,
          order.delhivery_status || null,
          order.delhivery_reference || null,
          order.delhivery_last_event_at || null
        ]
      );
    }

    for (const item of orderItems) {
      await dbRunAsync(
        `INSERT INTO order_items (
           id, order_id, product_id, quantity, price, warranty_years, warranty_start_at, warranty_end_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           order_id = excluded.order_id,
           product_id = excluded.product_id,
           quantity = excluded.quantity,
           price = excluded.price,
           warranty_years = excluded.warranty_years,
           warranty_start_at = excluded.warranty_start_at,
           warranty_end_at = excluded.warranty_end_at`,
        [
          item.id,
          item.order_id,
          item.product_id,
          Number(item.quantity || 1),
          Number(item.price || 0),
          Number(item.warranty_years || 5),
          item.warranty_start_at || null,
          item.warranty_end_at || null
        ]
      );
    }

    for (const location of deliveryLocations) {
      await dbRunAsync(
        `INSERT INTO delivery_locations (partner_id, lat, lng, status, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(partner_id) DO UPDATE SET
           lat = excluded.lat,
           lng = excluded.lng,
           status = excluded.status,
           updated_at = excluded.updated_at`,
        [
          location.partner_id,
          location.lat ?? null,
          location.lng ?? null,
          location.status || 'available',
          location.updated_at || new Date().toISOString()
        ]
      );
    }

    for (const notification of notifications) {
      await dbRunAsync(
        `INSERT INTO notifications (
           id, title, message, target, personalize, product_id, image_url, user_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           message = excluded.message,
           target = excluded.target,
           personalize = excluded.personalize,
           product_id = excluded.product_id,
           image_url = excluded.image_url,
           user_id = excluded.user_id,
           created_at = COALESCE(excluded.created_at, notifications.created_at)`,
        [
          notification.id,
          notification.title || '',
          notification.message || '',
          notification.target || 'customer',
          Number(notification.personalize) ? 1 : 0,
          notification.product_id || null,
          notification.image_url || null,
          notification.user_id || null,
          notification.created_at || null
        ]
      );
    }

    for (const registration of warrantyRegistrations) {
      await dbRunAsync(
        `INSERT INTO warranty_registrations (
           id, user_id, order_id, order_item_id, product_id, serial_number, installer_name,
           purchase_use_case, notes, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           order_id = excluded.order_id,
           order_item_id = excluded.order_item_id,
           product_id = excluded.product_id,
           serial_number = excluded.serial_number,
           installer_name = excluded.installer_name,
           purchase_use_case = excluded.purchase_use_case,
           notes = excluded.notes,
           status = excluded.status,
           created_at = COALESCE(excluded.created_at, warranty_registrations.created_at),
           updated_at = COALESCE(excluded.updated_at, warranty_registrations.updated_at)`,
        [
          registration.id,
          registration.user_id || null,
          registration.order_id || null,
          registration.order_item_id || null,
          registration.product_id || null,
          registration.serial_number || null,
          registration.installer_name || null,
          registration.purchase_use_case || null,
          registration.notes || null,
          registration.status || 'registered',
          registration.created_at || null,
          registration.updated_at || null
        ]
      );
    }

    for (const ticket of serviceTickets) {
      await dbRunAsync(
        `INSERT INTO service_tickets (
           id, user_id, order_id, order_item_id, product_id, ticket_type, title, description,
           contact_phone, preferred_slot, status, priority, resolution_notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           order_id = excluded.order_id,
           order_item_id = excluded.order_item_id,
           product_id = excluded.product_id,
           ticket_type = excluded.ticket_type,
           title = excluded.title,
           description = excluded.description,
           contact_phone = excluded.contact_phone,
           preferred_slot = excluded.preferred_slot,
           status = excluded.status,
           priority = excluded.priority,
           resolution_notes = excluded.resolution_notes,
           created_at = COALESCE(excluded.created_at, service_tickets.created_at),
           updated_at = COALESCE(excluded.updated_at, service_tickets.updated_at)`,
        [
          ticket.id,
          ticket.user_id || null,
          ticket.order_id || null,
          ticket.order_item_id || null,
          ticket.product_id || null,
          ticket.ticket_type || 'support',
          ticket.title || '',
          ticket.description || '',
          ticket.contact_phone || null,
          ticket.preferred_slot || null,
          ticket.status || 'open',
          ticket.priority || 'normal',
          ticket.resolution_notes || null,
          ticket.created_at || null,
          ticket.updated_at || null
        ]
      );
    }

    for (const entry of userAddresses) {
      await dbRunAsync(
        `INSERT INTO user_addresses (
           id, user_id, label, address, pincode, lat, lng, is_default, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           label = excluded.label,
           address = excluded.address,
           pincode = excluded.pincode,
           lat = excluded.lat,
           lng = excluded.lng,
           is_default = excluded.is_default,
           created_at = COALESCE(excluded.created_at, user_addresses.created_at),
           updated_at = COALESCE(excluded.updated_at, user_addresses.updated_at)`,
        [
          entry.id,
          entry.user_id || null,
          entry.label || 'Home',
          entry.address || '',
          entry.pincode || null,
          entry.lat ?? null,
          entry.lng ?? null,
          Number(entry.is_default) ? 1 : 0,
          entry.created_at || null,
          entry.updated_at || null
        ]
      );
    }

    for (const entry of savedItems) {
      await dbRunAsync(
        `INSERT INTO saved_items (
           id, user_id, product_id, created_at
         ) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           product_id = excluded.product_id,
           created_at = COALESCE(excluded.created_at, saved_items.created_at)`,
        [
          entry.id,
          entry.user_id || null,
          entry.product_id || null,
          entry.created_at || null
        ]
      );
    }

    for (const setting of appSettings) {
      const settingKey = normalizeSettingKey(setting?.setting_key);
      if (!settingKey || !OPERATIONAL_APP_SETTING_KEYS.includes(settingKey)) continue;
      await dbRunAsync(
        `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
         VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          settingKey,
          String(setting?.value || ''),
          setting?.updated_at || null
        ]
      );
    }

    await dbRunAsync(
      `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [
        'last_operational_state_restore',
        JSON.stringify({
          source,
          userCount: users.length,
          hubCount: hubs.length,
          deliveryPartnerDetailCount: deliveryPartnerDetails.length,
          orderCount: orders.length,
          orderItemCount: orderItems.length,
          deliveryLocationCount: deliveryLocations.length,
          notificationCount: notifications.length,
          warrantyRegistrationCount: warrantyRegistrations.length,
          serviceTicketCount: serviceTickets.length,
          addressBookCount: userAddresses.length,
          savedItemCount: savedItems.length,
          appSettingCount: appSettings.length,
          at: new Date().toISOString()
        })
      ]
    );

    await dbRunAsync('COMMIT');
    return {
      userCount: users.length,
      hubCount: hubs.length,
      deliveryPartnerDetailCount: deliveryPartnerDetails.length,
      orderCount: orders.length,
      orderItemCount: orderItems.length,
      deliveryLocationCount: deliveryLocations.length,
      notificationCount: notifications.length,
      warrantyRegistrationCount: warrantyRegistrations.length,
      serviceTicketCount: serviceTickets.length,
      addressBookCount: userAddresses.length,
      savedItemCount: savedItems.length,
      appSettingCount: appSettings.length
    };
  } catch (error) {
    await dbRunAsync('ROLLBACK').catch(() => {});
    throw error;
  }
};

const uploadOperationalStateToFtp = async (reason = 'state-change') => {
  if (!hasOperationalStateFtpConfig) return { skipped: true };
  const client = await createCatalogFtpClient();
  try {
    const manifest = await buildOperationalStateManifest();
    const payload = encryptOperationalStatePayload({
      ...manifest,
      synced_at: new Date().toISOString(),
      sync_reason: reason
    });
    const remotePath = normalizeOperationalStateRemotePath();
    const remoteDir = path.posix.dirname(remotePath);
    if (remoteDir && remoteDir !== '/' && remoteDir !== '.') {
      await client.ensureDir(remoteDir);
    }
    await client.uploadFrom(Readable.from([payload]), remotePath);
    const uploadedPayload = await collectCatalogBackupPayloadFromFtp(client, remotePath);
    const expectedHash = operationalPayloadHash(payload);
    const uploadedHash = operationalPayloadHash(uploadedPayload);
    if (expectedHash !== uploadedHash) {
      throw new Error('Operational backup verification failed after FTP upload. The uploaded file does not match the saved state.');
    }
    decryptOperationalStatePayload(uploadedPayload, remotePath);
    await dbRunAsync(
      `INSERT OR REPLACE INTO app_settings (setting_key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [
        'last_operational_state_sync',
        JSON.stringify({
          reason,
          remotePath,
          userCount: manifest.users.length,
          hubCount: manifest.hubs.length,
          deliveryPartnerDetailCount: manifest.delivery_partner_details.length,
          checksum: uploadedHash,
          at: new Date().toISOString()
        })
      ]
    );
    console.log(`Operational state uploaded to FTP: ${remotePath}`);
    return {
      skipped: false,
      remotePath,
      userCount: manifest.users.length,
      hubCount: manifest.hubs.length,
      deliveryPartnerDetailCount: manifest.delivery_partner_details.length,
      verified: true,
      checksum: uploadedHash
    };
  } finally {
    client.close();
  }
};

const syncOperationalStateForResponse = async (reason = 'state-change') => {
  if (!hasOperationalStateFtpConfig) {
    return {
      skipped: true,
      warning: 'Saved on Render only. InfinityFree operational backup is not configured, so users and partner settings can reset after redeploy.'
    };
  }
  try {
    const result = await uploadOperationalStateToFtp(reason);
    return { ...result, ok: true };
  } catch (error) {
    console.warn(`Operational backup FTP sync failed: ${error.message}`);
    return {
      failed: true,
      warning: `Saved on Render, but InfinityFree operational backup failed: ${error.message}`
    };
  }
};

let operationalBackupSyncTimer = null;
const queueOperationalStateSync = (reason = 'state-change') => {
  if (!hasOperationalStateFtpConfig) return;
  if (operationalBackupSyncTimer) clearTimeout(operationalBackupSyncTimer);
  operationalBackupSyncTimer = setTimeout(() => {
    operationalBackupSyncTimer = null;
    uploadOperationalStateToFtp(reason).catch(error => {
      console.warn(`Operational backup FTP sync failed: ${error.message}`);
    });
  }, 1000);
};

const restoreOperationalStateFromFtp = async (source = 'startup-operational-import') => {
  if (!hasOperationalStateFtpConfig) {
    throw new Error('InfinityFree FTP is not configured for operational state restore.');
  }
  const client = await createCatalogFtpClient();
  try {
    const remotePath = normalizeOperationalStateRemotePath();
    const payload = await collectCatalogBackupPayloadFromFtp(client, remotePath);
    const manifest = decryptOperationalStatePayload(payload, remotePath);
    return applyOperationalStateManifest(manifest, source);
  } finally {
    client.close();
  }
};

const restoreOperationalStateOnStartup = async () => {
  const result = await restoreOperationalStateFromFtp('startup-operational-ftp-import');
  console.log(
    `Operational state restored from FTP before startup: ${result.userCount} users, ${result.hubCount} hubs, ${result.deliveryPartnerDetailCount} delivery partner records`
  );
  return result;
};

const createOrderItemsAsync = (orderId, items, prices, warrantyYears) => new Promise((resolve, reject) => {
  const warrantyStartAt = new Date();
  const stmt = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, price, warranty_years, warranty_start_at, warranty_end_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  items.forEach(item => {
    const years = warrantyYears.get(item.product_id) || 5;
    stmt.run(
      orderId,
      item.product_id,
      item.quantity,
      prices.get(item.product_id),
      years,
      warrantyStartAt.toISOString(),
      addYears(warrantyStartAt, years).toISOString()
    );
  });
  stmt.finalize((err) => {
    if (err) return reject(err);
    resolve();
  });
});

const callRazorpay = async (endpoint, body) => {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.description || data.error?.reason || 'Razorpay request failed');
  }
  return data;
};

const normalizeOrderItems = (items = []) => items
  .map(item => ({
    product_id: Number(item.product_id),
    quantity: Math.max(1, Number(item.quantity || 1))
  }))
  .filter(item => Number.isInteger(item.product_id) && Number.isFinite(item.quantity));

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const extractJsonObject = (value = '') => {
  const text = String(value || '').trim();
  try { return JSON.parse(text); } catch (error) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid banner JSON');
  return JSON.parse(match[0]);
};

const callOpenAiJson = async ({ system, user }) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured on the server');
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_BANNER_MODEL,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI banner generation failed');
  }
  return extractJsonObject(data.choices?.[0]?.message?.content || '{}');
};

const buildBannerSvgDataUrl = ({ width, height, headline, subheadline, eyebrow, cta, theme }) => {
  const safeWidth = Math.max(640, Number(width) || 1200);
  const safeHeight = Math.max(180, Number(height) || 320);
  const palette = {
    blue: ['#082a63', '#0b49b5', '#f6c400'],
    yellow: ['#fff5b8', '#ffe27a', '#082a63'],
    green: ['#eafff3', '#a9f5cf', '#075f45'],
    orange: ['#fff0d9', '#ffd39b', '#0a2f75']
  };
  const [bgA, bgB, accent] = palette[String(theme || '').toLowerCase()] || palette.blue;
  const darkText = bgA.startsWith('#08') || bgA.startsWith('#0b') ? '#ffffff' : '#082a63';
  const mutedText = darkText === '#ffffff' ? 'rgba(255,255,255,.86)' : '#53657f';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${bgA}"/>
      <stop offset="100%" stop-color="${bgB}"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#001b40" flood-opacity=".18"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" rx="36" fill="url(#bg)"/>
  <circle cx="${safeWidth - 135}" cy="${safeHeight / 2}" r="${safeHeight * 0.64}" fill="#ffffff" opacity=".16"/>
  <circle cx="${safeWidth - 50}" cy="${safeHeight - 34}" r="${safeHeight * 0.32}" fill="${accent}" opacity=".22"/>
  <g filter="url(#softShadow)">
    <rect x="${safeWidth - 330}" y="${Math.max(22, safeHeight * .2)}" width="230" height="${Math.max(86, safeHeight * .42)}" rx="24" fill="#ffffff" opacity=".95"/>
    <circle cx="${safeWidth - 255}" cy="${safeHeight / 2}" r="38" fill="${accent}"/>
    <path d="M${safeWidth - 278} ${safeHeight / 2}h72v28h-72z" fill="#082a63" opacity=".92"/>
    <circle cx="${safeWidth - 205}" cy="${safeHeight / 2 + 14}" r="18" fill="#ffffff"/>
    <circle cx="${safeWidth - 205}" cy="${safeHeight / 2 + 14}" r="9" fill="#082a63"/>
  </g>
  <text x="44" y="62" fill="${accent}" font-family="Poppins, Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="3">${escapeHtml(eyebrow || 'CAMIGO FAST LANE')}</text>
  <text x="44" y="${safeHeight * .48}" fill="${darkText}" font-family="Poppins, Arial, sans-serif" font-size="${Math.max(34, safeHeight * .17)}" font-weight="900" letter-spacing="-2">${escapeHtml(headline || 'CCTV deals delivered fast')}</text>
  <text x="46" y="${safeHeight * .64}" fill="${mutedText}" font-family="Poppins, Arial, sans-serif" font-size="${Math.max(18, safeHeight * .065)}" font-weight="700">${escapeHtml(subheadline || 'Same-day dispatch, installation support and warranty care.')}</text>
  <rect x="46" y="${safeHeight - 72}" width="210" height="42" rx="21" fill="${accent}"/>
  <text x="72" y="${safeHeight - 45}" fill="${darkText === '#ffffff' ? '#082a63' : '#ffffff'}" font-family="Poppins, Arial, sans-serif" font-size="17" font-weight="900">${escapeHtml(cta || 'Shop now')}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
};

const buildOrderDraft = async (user, body) => {
  const {
    items,
    address,
    pincode,
    payment_method,
    promo_code,
    customer_lat,
    customer_lng,
    customer_accuracy,
    customer_location_locked_at,
    installation_requested
  } = body;

  if (!Array.isArray(items) || !items.length) {
    throw new Error('Order items are required');
  }
    if (!address || !payment_method) {
      throw new Error('Address and payment method are required');
    }
    const normalizedPaymentMethod = String(payment_method || '').toLowerCase();
    const codEnabled = await isCodEnabled();
    if (!['upi', 'card', 'cod'].includes(normalizedPaymentMethod)) {
      throw new Error('Only UPI, card, and COD payments are allowed');
    }
    if (normalizedPaymentMethod === 'cod' && !codEnabled) {
      throw new Error('Cash on delivery is currently disabled');
    }

  const normalizedItems = normalizeOrderItems(items);
  if (!normalizedItems.length) {
    throw new Error('Valid order items are required');
  }

  const placeholders = normalizedItems.map(() => '?').join(',');
  const products = await dbAllAsync(
    `SELECT id, price, dealer_price, distributor_price, warranty_years, category_id, name, description
     FROM products
     WHERE id IN (${placeholders})`,
    normalizedItems.map(item => item.product_id)
  );

  const prices = new Map(products.map(product => [product.id, priceForUserRole(product, user.role)]));
  const warrantyYears = new Map(products.map(product => [product.id, Math.max(1, Number(product.warranty_years || 5))]));
  const productCategory = new Map(products.map(product => [product.id, Number(product.category_id)]));
  if (prices.size !== normalizedItems.length) {
    throw new Error('One or more products were not found');
  }

  let totalAmount = normalizedItems.reduce((sum, item) => sum + (prices.get(item.product_id) * item.quantity), 0);
  let taxableAmount = totalAmount;
  const cameraCount = normalizedItems.reduce((sum, item) => (
    [1, 2, 3].includes(productCategory.get(item.product_id)) ? sum + item.quantity : sum
  ), 0);
  const installationRequested = Boolean(installation_requested) && cameraCount > 0;
  const installationFee = installationRequested ? cameraCount * 500 : 0;

  if (promo_code) {
    const promo = await dbGetAsync(
      'SELECT * FROM promo_codes WHERE code = ? AND active = 1',
      [promo_code]
    );
    if (promo && promo.used_count < promo.usage_limit && totalAmount >= promo.min_order) {
      let discount = (totalAmount * promo.discount_percent) / 100;
      if (discount > promo.max_discount) discount = promo.max_discount;
      taxableAmount = totalAmount - discount;
      await dbRunAsync('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [promo.id]);
    }
  }

  const safeCustomerLat = Number.isFinite(Number(customer_lat)) ? Number(customer_lat) : null;
  const safeCustomerLng = Number.isFinite(Number(customer_lng)) ? Number(customer_lng) : null;
  const safeCustomerAccuracy = Number.isFinite(Number(customer_accuracy)) ? Number(customer_accuracy) : null;
  const safeCustomerLockedAt = Number.isFinite(Number(customer_location_locked_at)) ? Number(customer_location_locked_at) : null;
  const productLookup = new Map(products.map(product => [product.id, product]));
  const deliveryQuote = await buildDeliveryQuote({
    address,
    pincode,
    lat: safeCustomerLat,
    lng: safeCustomerLng,
    items: normalizedItems,
    productLookup
  });
  if (!deliveryQuote.serviceable) {
    throw new Error(deliveryQuote.message);
  }
  const deliveryFee = Number(deliveryQuote.charge || 0);
  const gstAmount = Math.round(taxableAmount * 0.18);
  const finalAmount = taxableAmount + gstAmount + deliveryFee + installationFee;
  const addressWithPincode = deliveryQuote.detectedPincode && !String(address).includes(deliveryQuote.detectedPincode)
    ? `${address}\nPincode: ${deliveryQuote.detectedPincode}`
    : address;

  return {
    normalizedItems,
    prices,
    warrantyYears,
    address: addressWithPincode,
      paymentMethod: normalizedPaymentMethod,
    totalAmount,
    gstAmount,
    deliveryFee,
    installationRequested,
    installationFee,
    cameraCount,
    deliveryQuote,
    finalAmount,
    customerLat: safeCustomerLat,
    customerLng: safeCustomerLng,
    customerAccuracy: safeCustomerAccuracy,
    customerLockedAt: safeCustomerLockedAt
  };
};

const createLocalOrderRecord = async ({ userId, draft, status = 'pending', paymentStatus = 'paid', razorpayOrderId = null }) => {
  const deliveryOtp = String(1000 + crypto.randomInt(9000));
  const result = await dbRunAsync(
    `INSERT INTO orders (
      user_id, total_amount, final_amount, gst_amount, delivery_fee, delivery_mode, delivery_provider, delivery_estimate, delivery_distance_km, delivery_weight_kg,
      installation_requested, installation_fee, installation_status, camera_count,
      status, payment_method, address, customer_lat, customer_lng, customer_accuracy,
      customer_location_locked_at, delivery_otp, payment_status, razorpay_order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      userId,
      draft.totalAmount,
      draft.finalAmount,
      draft.gstAmount,
      draft.deliveryFee,
      draft.deliveryQuote?.mode || 'local',
      draft.deliveryQuote?.provider || 'Camigo',
      draft.deliveryQuote?.estimateLabel || '',
      draft.deliveryQuote?.distanceKm ?? null,
      draft.deliveryQuote?.estimatedWeightKg ?? null,
      draft.installationRequested ? 1 : 0,
      draft.installationFee,
      draft.installationRequested ? 'requested' : 'not_requested',
      draft.cameraCount,
      status,
      draft.paymentMethod,
      draft.address,
      draft.customerLat,
      draft.customerLng,
      draft.customerAccuracy,
      draft.customerLockedAt,
      deliveryOtp,
      paymentStatus,
      razorpayOrderId
    ]
  );
  await createOrderItemsAsync(result.lastID, draft.normalizedItems, draft.prices, draft.warrantyYears);
  return result.lastID;
};

const canCustomerCancelOrder = (order) => {
  if (!order) return { allowed: false, reason: 'Order not found' };
  const createdAt = new Date(order.created_at).getTime();
  if (!Number.isFinite(createdAt)) return { allowed: false, reason: 'Order cannot be cancelled now' };
  const ageMs = Date.now() - createdAt;
  if (ageMs > 60 * 1000) {
    return { allowed: false, reason: 'The 1 minute cancel window has expired' };
  }
  const blockedStatuses = ['accepted', 'arrived_at_store', 'picked_up', 'packed', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'];
  if (blockedStatuses.includes(String(order.status || '').toLowerCase())) {
    return { allowed: false, reason: 'This order is already being processed and cannot be cancelled' };
  }
  return { allowed: true };
};

const attachOrderItems = (orders, res) => {
  if (!orders.length) return res.json([]);
  const placeholders = orders.map(() => '?').join(',');
  db.all(
    `SELECT oi.*, p.name, p.image, p.unit
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id IN (${placeholders})
     ORDER BY oi.id`,
    orders.map(order => order.id),
    (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      const grouped = items.reduce((map, item) => {
        map[item.order_id] = map[item.order_id] || [];
        map[item.order_id].push(item);
        return map;
      }, {});
      res.json(orders.map(order => ({ ...order, items: grouped[order.id] || [] })));
    }
  );
};

const normalizeTicketStatus = (value = '', fallback = 'open') => {
  const status = String(value || '').trim().toLowerCase();
  return new Set(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']).has(status)
    ? status
    : fallback;
};

const normalizeWarrantyStatus = (value = '', fallback = 'registered') => {
  const status = String(value || '').trim().toLowerCase();
  return new Set(['registered', 'verified', 'claimed', 'expired']).has(status)
    ? status
    : fallback;
};

const syncUserPrimaryAddress = async (userId) => {
  const primary = await dbGetAsync(
    `SELECT address
     FROM user_addresses
     WHERE user_id = ? AND is_default = 1
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
  if (primary?.address) {
    await dbRunAsync('UPDATE users SET address = ? WHERE id = ?', [primary.address, userId]);
  }
};

const attachProductImages = (products, res, single = false) => {
  const list = Array.isArray(products) ? products : (products ? [products] : []);
  if (!list.length) return single ? res.json(null) : res.json([]);
  const placeholders = list.map(() => '?').join(',');
  db.all(
    `SELECT product_id, image_url, sort_order
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    list.map(product => product.id),
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const grouped = rows.reduce((map, row) => {
        map[row.product_id] = map[row.product_id] || [];
        map[row.product_id].push(row.image_url);
        return map;
      }, {});
      const enriched = list.map(product => {
        const gallery = grouped[product.id] && grouped[product.id].length
          ? grouped[product.id]
          : (product.image ? [product.image] : []);
        return {
          ...product,
          image: gallery[0] || product.image,
          images: gallery,
          ...buildSyntheticProductRating(product)
        };
      });
      res.json(single ? enriched[0] : enriched);
    }
  );
};

const saveProductImages = (productId, image, images, callback) => {
  const gallery = (Array.isArray(images) ? images : [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
  const cover = String(image || '').trim();
  if (cover && !gallery.includes(cover)) gallery.unshift(cover);

  db.run('DELETE FROM product_images WHERE product_id = ?', [productId], (deleteErr) => {
    if (deleteErr) return callback(deleteErr);
    if (!gallery.length) return callback(null);
    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
    gallery.forEach((url, index) => stmt.run(productId, url, index));
    stmt.finalize(callback);
  });
};

const sendPushToTarget = (target, payload) => new Promise((resolve) => {
  if (!firebaseReady) return resolve({ sent: 0, failed: 0, skipped: true });
  const roles = target === 'delivery'
    ? ['delivery_partner']
    : target === 'installer'
      ? ['installer']
    : target === 'all'
      ? ['user', 'dealer', 'distributor', 'admin', 'delivery_partner', 'installer']
      : ['user', 'dealer', 'distributor', 'admin'];
  const placeholders = roles.map(() => '?').join(',');
  db.all(
    `SELECT pt.token, pt.id FROM push_tokens pt
     JOIN users u ON pt.user_id = u.id
     WHERE u.role IN (${placeholders})`,
    roles,
    async (err, rows = []) => {
      if (err || !rows.length) return resolve({ sent: 0, failed: rows.length || 0 });
      const tokens = [...new Set(rows.map(row => row.token).filter(Boolean))];
      if (!tokens.length) return resolve({ sent: 0, failed: 0 });
      let sent = 0;
      let failed = 0;
      const invalidTokens = [];
      for (let index = 0; index < tokens.length; index += 500) {
        const batch = tokens.slice(index, index + 500);
        try {
          const response = await admin.messaging().sendEachForMulticast({
            tokens: batch,
            notification: {
              title: payload.title,
              body: payload.body
            },
            data: {
              product_id: payload.product_id ? String(payload.product_id) : '',
              notification_id: payload.notification_id ? String(payload.notification_id) : ''
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'camigo-admin',
                sound: 'default'
              }
            }
          });
          sent += response.successCount;
          failed += response.failureCount;
          response.responses.forEach((item, itemIndex) => {
            const code = item.error?.code || '';
            if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
              invalidTokens.push(batch[itemIndex]);
            }
          });
        } catch (error) {
          failed += batch.length;
        }
      }
      if (invalidTokens.length) {
        db.run(`DELETE FROM push_tokens WHERE token IN (${invalidTokens.map(() => '?').join(',')})`, invalidTokens);
      }
      resolve({ sent, failed });
    }
  );
});

const sendPushToUserIds = (userIds, payload, appTarget = 'customer') => new Promise((resolve) => {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map(Number).filter(Number.isInteger))];
  if (!firebaseReady || !ids.length) return resolve({ sent: 0, failed: 0, skipped: true });
  const placeholders = ids.map(() => '?').join(',');
  db.all(
    `SELECT token FROM push_tokens
     WHERE user_id IN (${placeholders})
       AND app_target = ?`,
    [...ids, appTarget],
    async (err, rows = []) => {
      if (err || !rows.length) return resolve({ sent: 0, failed: rows.length || 0 });
      const tokens = [...new Set(rows.map(row => row.token).filter(Boolean))];
      if (!tokens.length) return resolve({ sent: 0, failed: 0 });
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: Object.entries(payload).reduce((acc, [key, value]) => {
            if (value === undefined || value === null) return acc;
            acc[key] = String(value);
            return acc;
          }, {})
        });
        resolve({ sent: response.successCount || 0, failed: response.failureCount || 0 });
      } catch (sendError) {
        resolve({ sent: 0, failed: tokens.length, error: sendError.message });
      }
    }
  );
});

const createUserNotification = ({ userId = null, target = 'customer', title, message, personalize = 0, productId = null, imageUrl = null }) => new Promise((resolve) => {
  db.run(
    'INSERT INTO notifications (title, message, target, personalize, product_id, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, message, target, personalize ? 1 : 0, productId, imageUrl, userId],
    function(err) {
      if (err) return resolve({ ok: false, error: err.message });
      resolve({ ok: true, id: this.lastID });
    }
  );
});

const notifyOrderStatusChange = (orderId, status) => {
  const labels = {
    accepted: 'Order accepted',
    arrived_at_store: 'Partner reached the store',
    picked_up: 'Order picked up',
    packed: 'Order packed',
    out_for_delivery: 'Out for delivery',
    delivered: 'Order delivered',
    rejected: 'Order update'
  };
  const messages = {
    accepted: 'A delivery partner accepted your Camigo order.',
    arrived_at_store: 'Your delivery partner has reached the Camigo store/hub.',
    picked_up: 'Your order has been picked up and is ready to move.',
    packed: 'Your order is packed and being prepared for dispatch.',
    out_for_delivery: 'Your order is now on the way.',
    delivered: 'Your order has been marked delivered.',
    rejected: 'Your order needs attention. Please check the app.'
  };
  db.get('SELECT id, user_id, status FROM orders WHERE id = ?', [orderId], async (err, order) => {
    if (err || !order) return;
    const title = labels[status] || 'Order updated';
    const message = messages[status] || `Your order status changed to ${String(status).replaceAll('_', ' ')}.`;
    await createUserNotification({ userId: order.user_id, target: 'customer', title, message, personalize: 1 });
    await sendPushToUserIds(order.user_id, { title, body: message, order_id: orderId, status }, 'customer');
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const cleanPhone = (phone = '') => String(phone || '').replace(/\D/g, '').slice(-10);
const isValidIndianMobile = (phone = '') => /^\d{10}$/.test(cleanPhone(phone));
const isStaffRole = (role = '') => ['admin', 'delivery_partner', 'installer'].includes(String(role || ''));
const signAuthToken = (user) => jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '30d' }
);

const formatUserForClient = (user) => {
  const phoneVerified = Number(user.phone_verified || 0) === 1;
  const staffCanUsePhone = isStaffRole(user.role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: phoneVerified || staffCanUsePhone ? (user.phone || '') : '',
    phone_verified: phoneVerified,
    address: user.address,
    role: user.role
  };
};

app.get('/api/debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ status: 'debug disabled', node_version: process.version, platform: process.platform });
});

const loginUser = (req, res) => {
  const loginId = String(req.body.email || req.body.loginId || req.body.phone || '').trim();
  const { password } = req.body;
  if (!loginId || !password) return res.status(400).json({ error: 'Login ID/mobile and password are required' });

  const safeLoginPhone = cleanPhone(loginId);

  db.get('SELECT * FROM users WHERE lower(email) = lower(?)', [loginId], async (emailErr, emailUser) => {
    if (emailErr) return res.status(500).json({ error: emailErr.message });

    const finishLogin = async (user) => {
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      try {
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
        return res.json({ token: signAuthToken(user), user: formatUserForClient(user) });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    };

    if (emailUser) {
      return finishLogin(emailUser);
    }

    if (!isValidIndianMobile(safeLoginPhone)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.get('SELECT * FROM users WHERE phone = ?', [safeLoginPhone], async (phoneErr, phoneUser) => {
      if (phoneErr) return res.status(500).json({ error: phoneErr.message });
      if (!phoneUser) return res.status(401).json({ error: 'Invalid credentials' });
      if (!isStaffRole(phoneUser.role) && Number(phoneUser.phone_verified || 0) !== 1) {
        return res.status(403).json({ error: 'This mobile number is not verified yet. Login with email first, then verify your mobile from Account.' });
      }
      return finishLogin(phoneUser);
    });
  });
};

app.post('/api/auth/login', loginUser);

const registerUser = async (req, res) => {
  const { email, password, name, phone, address } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  const safeEmail = String(email || '').trim().toLowerCase();
  const safePhone = cleanPhone(phone);
  if (!safePhone || !isValidIndianMobile(safePhone)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  }

  try {
    const emailUser = await dbGetAsync('SELECT id FROM users WHERE lower(email) = lower(?)', [safeEmail]);
    if (emailUser) return res.status(400).json({ error: 'Email already exists' });
    const phoneUser = await dbGetAsync('SELECT id FROM users WHERE phone = ?', [safePhone]);
    if (phoneUser) return res.status(400).json({ error: 'This mobile number is already linked to another account' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRunAsync(
      'INSERT INTO users (email, password, plaintext_password, name, phone, phone_verified, phone_verified_at, address) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)',
      [safeEmail, hashedPassword, password, name, safePhone, address]
    );
    const operationalBackup = await syncOperationalStateForResponse('user-registered');
    res.json({
      id: result.lastID,
      message: 'Account created. Login with email, then verify your mobile number from Account.',
      backup_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.post('/api/auth/register', registerUser);

// Backward-compatible aliases for cached app/web builds that may call auth without /api.
app.post('/auth/login', loginUser);

app.post('/auth/register', registerUser);

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

const verifyPhoneNumber = async (req, res) => {
  if (!firebaseReady) {
    return res.status(503).json({ error: 'Firebase phone verification is not configured on the server yet' });
  }

  const idToken = String(req.body.idToken || req.body.firebase_id_token || '').trim();
  const requestedPhone = cleanPhone(req.body.phone || '');
  if (!idToken) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded?.firebase?.sign_in_provider !== 'phone') {
      return res.status(400).json({ error: 'This verification token was not created from phone OTP' });
    }

    const verifiedPhone = cleanPhone(decoded.phone_number || '');
    if (!verifiedPhone || !isValidIndianMobile(verifiedPhone)) {
      return res.status(400).json({ error: 'Verified mobile number is missing from Firebase response' });
    }
    if (requestedPhone && requestedPhone !== verifiedPhone) {
      return res.status(400).json({ error: 'The verified OTP number does not match the entered mobile number' });
    }

    const duplicatePhone = await dbGetAsync(
      'SELECT id FROM users WHERE phone = ? AND id <> ?',
      [verifiedPhone, req.user.userId]
    );
    if (duplicatePhone) {
      return res.status(400).json({ error: 'This mobile number is already linked to another account' });
    }

    await dbRunAsync(
      `UPDATE users
       SET phone = ?, phone_verified = 1, phone_verified_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [verifiedPhone, req.user.userId]
    );
    const refreshedUser = await dbGetAsync('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!refreshedUser) return res.status(404).json({ error: 'User not found after verification' });
    const operationalBackup = await syncOperationalStateForResponse('phone-verified');
    res.json({
      message: 'Mobile number verified successfully',
      user: formatUserForClient(refreshedUser),
      backup_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Phone verification failed' });
  }
};

app.post('/api/auth/phone/verify', authenticateToken, verifyPhoneNumber);
app.post('/auth/phone/verify', authenticateToken, verifyPhoneNumber);

// Categories
app.get('/api/setup-packages', async (req, res) => {
  try {
    const packages = await syncSetupPackageProducts(await resolveSetupPackages());
    await saveJsonAppSetting(APP_SETTING_KEYS.homepageSetupPackages, packages);
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/store-settings', async (req, res) => {
  try {
    res.json({
      cod_enabled: await isCodEnabled()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY sort_order', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/categories/:id/banners', (req, res) => {
  db.all(
    `SELECT * FROM category_banners
     WHERE category_id = ? AND active = 1
     ORDER BY sort_order ASC, id ASC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Products
app.get('/api/products', (req, res) => {
  const { category_id, search } = req.query;
  let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
  let params = [];
  
  if (category_id) {
    query += ' WHERE p.category_id = ?';
    params.push(category_id);
  }
  
  if (search) {
    query += category_id ? ' AND' : ' WHERE';
    query += ' (p.name LIKE ? OR p.description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    attachProductImages(rows, res);
  });
});

app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Product not found' });
    attachProductImages(row, res, true);
  });
});

app.get('/api/serviceability', (req, res) => {
  const check = checkServiceability({
    address: req.query.address || '',
    pincode: req.query.pincode || '',
    lat: req.query.lat,
    lng: req.query.lng
  });
  res.json({
    ...check,
    message: check.localServiceable
      ? 'Same-day Camigo delivery is available for this area.'
      : check.courierServiceable
        ? 'Outside the same-day corridor, Delhivery courier delivery can be used for this pincode.'
        : 'Enter a valid 6-digit pincode to check local or courier delivery availability.'
  });
});

app.post('/api/delivery-quote', async (req, res) => {
  try {
    const normalizedItems = normalizeOrderItems(req.body.items || []);
    const placeholders = normalizedItems.map(() => '?').join(',');
    const products = placeholders
      ? await dbAllAsync(
          `SELECT id, category_id, name, description
           FROM products
           WHERE id IN (${placeholders})`,
          normalizedItems.map(item => item.product_id)
        )
      : [];
    const productLookup = new Map(products.map(product => [product.id, product]));
    const quote = await buildDeliveryQuote({
      address: req.body.address || '',
      pincode: req.body.pincode || '',
      lat: req.body.customer_lat ?? req.body.lat,
      lng: req.body.customer_lng ?? req.body.lng,
      items: normalizedItems,
      productLookup
    });
    res.json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/notifications', (req, res) => {
  const target = String(req.query.target || 'customer');
  const authHeader = req.headers['authorization'];
  let currentUserId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      currentUserId = decoded.userId;
    } catch (e) {}
  }
  db.all(
    `SELECT * FROM notifications
     WHERE target IN (?, 'all')
       AND (user_id IS NULL OR user_id = ?)
     ORDER BY created_at DESC
     LIMIT 5`,
    [target, currentUserId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/push/register', authenticateToken, (req, res) => {
  const { token, platform, app_target } = req.body;
  if (!token || String(token).length < 20) return res.status(400).json({ error: 'Valid push token is required' });
  const safeTarget = ['customer', 'delivery', 'installer'].includes(app_target) ? app_target : (req.user.role === 'delivery_partner' ? 'delivery' : req.user.role === 'installer' ? 'installer' : 'customer');
  db.run(
    `INSERT INTO push_tokens (user_id, token, platform, app_target, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(token) DO UPDATE SET
       user_id = excluded.user_id,
       platform = excluded.platform,
       app_target = excluded.app_target,
       updated_at = CURRENT_TIMESTAMP`,
    [req.user.userId, token, platform || 'android', safeTarget],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Push token registered' });
    }
  );
});

// Cart
app.get('/api/cart', authenticateToken, (req, res) => {
  db.all(
    `SELECT c.*, p.name, p.price, p.dealer_price, p.distributor_price, p.image, p.unit, p.category_id
     FROM cart c 
     JOIN products p ON c.product_id = p.id 
     WHERE c.user_id = ?`,
    [req.user.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(row => ({ ...row, price: priceForUserRole(row, req.user.role) })));
    }
  );
});

app.post('/api/cart', authenticateToken, (req, res) => {
  const { product_id, quantity } = req.body;
  
  db.get('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [req.user.userId, product_id], (err, item) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (item) {
      db.run('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [quantity, item.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cart updated' });
      });
    } else {
      db.run('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', 
        [req.user.userId, product_id, quantity], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Item added to cart' });
      });
    }
  });
});

app.put('/api/cart/:id', authenticateToken, (req, res) => {
  const quantity = Math.max(1, Number(req.body.quantity || 1));
  db.run(
    'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
    [quantity, req.params.id, req.user.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Cart item not found' });
      res.json({ message: 'Cart quantity updated', quantity });
    }
  );
});

app.delete('/api/cart/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM cart WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Item removed from cart' });
  });
});

// Promo codes
app.post('/api/promo/apply', authenticateToken, (req, res) => {
  const { code, order_amount } = req.body;
  
  db.get('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [code], (err, promo) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!promo) return res.status(400).json({ error: 'Invalid promo code' });
    
    if (order_amount < promo.min_order) {
      return res.status(400).json({ error: `Minimum order amount is ${promo.min_order}` });
    }
    
    if (promo.used_count >= promo.usage_limit) {
      return res.status(400).json({ error: 'Promo code usage limit exceeded' });
    }
    
    let discount = (order_amount * promo.discount_percent) / 100;
    if (discount > promo.max_discount) discount = promo.max_discount;
    
    res.json({ 
      code,
      discount_percent: promo.discount_percent,
      discount_amount: discount,
      final_amount: order_amount - discount
    });
  });
});

// Orders
app.post('/api/orders', authenticateToken, async (req, res) => {
  res.status(410).json({
    error: 'Direct order placement is disabled. Start payment through Razorpay checkout first.'
  });
});

app.post('/api/orders/cod', authenticateToken, async (req, res) => {
  try {
    if (!(await isCodEnabled())) {
      return res.status(403).json({ error: 'Cash on delivery is currently disabled' });
    }
    const draft = await createOrderDraft(req.body);
    if (draft.paymentMethod !== 'cod') {
      return res.status(400).json({ error: 'COD order must use payment method cod' });
    }

    const currentUser = await dbGetAsync('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const orderId = await createLocalOrderRecord({
      userId: currentUser.id,
      draft,
      status: 'pending',
      paymentStatus: 'cod_due'
    });
    queueOperationalStateSync('cod-order-created');

    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (order && String(order.delivery_mode || '').toLowerCase() === 'local' && hasUberDirectConfig) {
      try {
        await createUberDirectDeliveryForOrder(order, currentUser);
      } catch (uberError) {
        console.warn(`Uber Direct COD delivery creation failed for order ${order.id}: ${uberError.message}`);
      }
    }

    res.json({
      message: 'COD order placed successfully.',
      order_id: orderId,
      status: 'pending',
      payment_status: 'cod_due',
      final_amount: order?.final_amount ?? draft.finalAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/razorpay/order', authenticateToken, async (req, res) => {
  if (!hasRazorpayConfig) {
    return res.status(503).json({ error: 'Razorpay is not configured on the server yet' });
  }
  try {
    const currentUser = await dbGetAsync('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!currentUser) {
      return res.status(404).json({ error: 'User account not found' });
    }
    if (!isStaffRole(currentUser.role) && Number(currentUser.phone_verified || 0) !== 1) {
      return res.status(400).json({ error: 'Verify your mobile number from Account before checkout.' });
    }
    const verifiedPhone = cleanPhone(currentUser.phone || '');
    const requestedPhone = cleanPhone(req.body.phone || '');
    if (!isStaffRole(currentUser.role) && verifiedPhone && requestedPhone && verifiedPhone !== requestedPhone) {
      return res.status(400).json({ error: 'Checkout phone does not match your verified mobile number. Update it from Account first.' });
    }
    req.body.phone = verifiedPhone || requestedPhone;
    const draft = await buildOrderDraft(currentUser, req.body);
    const razorpayOrder = await callRazorpay('/v1/orders', {
      amount: Math.round(draft.finalAmount * 100),
      currency: 'INR',
      receipt: `camigo_${currentUser.id}_${Date.now()}`,
      notes: {
        customer_id: String(currentUser.id),
        payment_method: draft.paymentMethod,
        installation_requested: draft.installationRequested ? '1' : '0',
        service_area: draft.deliveryQuote?.mode || 'verified',
        delivery_provider: draft.deliveryQuote?.provider || 'Camigo'
      }
    });
    const orderId = await createLocalOrderRecord({
      userId: currentUser.id,
      draft,
      status: 'payment_pending',
      paymentStatus: 'created',
      razorpayOrderId: razorpayOrder.id
    });
    queueOperationalStateSync('razorpay-order-created');
    res.json({
      key: RAZORPAY_KEY_ID,
      amount: Math.round(draft.finalAmount * 100),
      currency: 'INR',
      razorpay_order_id: razorpayOrder.id,
      local_order_id: orderId,
      payment_method: draft.paymentMethod,
      totals: {
        subtotal: draft.totalAmount,
        gst_amount: draft.gstAmount,
        delivery_fee: draft.deliveryFee,
        installation_fee: draft.installationFee,
        final_amount: draft.finalAmount
      },
      delivery: {
        mode: draft.deliveryQuote?.mode || 'local',
        provider: draft.deliveryQuote?.provider || 'Camigo',
        estimate: draft.deliveryQuote?.estimateLabel || '',
        zone: draft.deliveryQuote?.zoneLabel || '',
        distance_km: draft.deliveryQuote?.distanceKm ?? null,
        chargeable_weight_kg: draft.deliveryQuote?.chargeableWeightKg ?? null
      },
      customer: {
        name: currentUser.name || 'Camigo Customer',
        email: currentUser.email || '',
        contact: verifiedPhone || req.body.phone || ''
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/payments/razorpay/verify', authenticateToken, async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Razorpay verification payload is incomplete' });
  }
  if (!hasRazorpayConfig) {
    return res.status(503).json({ error: 'Razorpay is not configured on the server yet' });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    const order = await dbGetAsync(
      'SELECT * FROM orders WHERE razorpay_order_id = ? AND user_id = ?',
      [razorpay_order_id, req.user.userId]
    );
    if (!order) {
      return res.status(404).json({ error: 'Payment order not found' });
    }

    await dbRunAsync(
      `UPDATE orders
       SET payment_status = ?, status = ?, razorpay_payment_id = ?, razorpay_signature = ?, payment_verified_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['paid', 'pending', razorpay_payment_id, razorpay_signature, order.id]
    );
    const currentUser = await dbGetAsync('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (currentUser && String(order.delivery_mode || '').toLowerCase() === 'local' && hasUberDirectConfig) {
      try {
        await createUberDirectDeliveryForOrder(order, currentUser);
      } catch (uberError) {
        console.warn(`Uber Direct create delivery failed for order ${order.id}: ${uberError.message}`);
      }
    }
    if (currentUser && String(order.delivery_mode || '').toLowerCase() === 'courier' && hasDelhiveryApiConfig) {
      try {
        await createDelhiveryShipmentForOrder(order, currentUser);
      } catch (delhiveryError) {
        console.warn(`Delhivery shipment create failed for order ${order.id}: ${delhiveryError.message}`);
      }
    }
    await dbRunAsync('DELETE FROM cart WHERE user_id = ?', [req.user.userId]);
    queueOperationalStateSync('payment-verified');

    res.json({
      order_id: order.id,
      status: 'pending',
      payment_status: 'paid',
      final_amount: order.final_amount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hubs', (req, res) => {
  db.all('SELECT * FROM hubs ORDER BY active DESC, id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/hubs/active', (req, res) => {
  db.get('SELECT * FROM hubs WHERE active = 1 ORDER BY id ASC LIMIT 1', [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No active hub found' });
    res.json(row);
  });
});

app.get('/api/orders/:id', authenticateToken, (req, res) => {
  const params = req.user.role === 'admin'
    ? [req.params.id]
    : [req.params.id, req.user.userId];
  const query = req.user.role === 'admin'
    ? 'SELECT * FROM orders WHERE id = ?'
    : 'SELECT * FROM orders WHERE id = ? AND user_id = ?';

  db.get(query, params, (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    db.all('SELECT oi.*, p.name, p.image, p.unit FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

app.get('/api/orders', authenticateToken, (req, res) => {
  db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    attachOrderItems(rows, res);
  });
});

app.get('/api/account/warranty-registrations', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT wr.*, oi.quantity, oi.warranty_start_at, oi.warranty_end_at, p.name AS product_name, p.image AS product_image
       FROM warranty_registrations wr
       LEFT JOIN order_items oi ON oi.id = wr.order_item_id
       LEFT JOIN products p ON p.id = wr.product_id
       WHERE wr.user_id = ?
       ORDER BY wr.created_at DESC, wr.id DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account/service-tickets', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT st.*, p.name AS product_name, p.image AS product_image
       FROM service_tickets st
       LEFT JOIN products p ON p.id = st.product_id
       WHERE st.user_id = ?
       ORDER BY st.created_at DESC, st.id DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/account/profile', authenticateToken, async (req, res) => {
  try {
    const safeName = String(req.body?.name || '').trim();
    const safeAddress = String(req.body?.address || '').trim();
    if (!safeName) return res.status(400).json({ error: 'Name is required.' });

    await dbRunAsync('UPDATE users SET name = ?, address = ? WHERE id = ?', [safeName, safeAddress, req.user.userId]);
    queueOperationalStateSync('account-profile-updated');
    const updated = await dbGetAsync('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    res.json({ message: 'Profile updated.', user: formatUserForClient(updated) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account/addresses', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT *
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, updated_at DESC, id DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account/addresses', authenticateToken, async (req, res) => {
  try {
    const label = String(req.body?.label || 'Home').trim() || 'Home';
    const address = String(req.body?.address || '').trim();
    const pincode = String(req.body?.pincode || extractPincode(address) || '').trim();
    const lat = req.body?.lat ?? null;
    const lng = req.body?.lng ?? null;
    const isDefault = Boolean(req.body?.is_default);
    if (!address) return res.status(400).json({ error: 'Address is required.' });

    if (isDefault) {
      await dbRunAsync('UPDATE user_addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.userId]);
    }
    const result = await dbRunAsync(
      `INSERT INTO user_addresses (user_id, label, address, pincode, lat, lng, is_default, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.userId, label, address, pincode || null, lat, lng, isDefault ? 1 : 0]
    );
    if (isDefault) {
      await dbRunAsync('UPDATE users SET address = ? WHERE id = ?', [address, req.user.userId]);
    }
    queueOperationalStateSync('account-address-created');
    const created = await dbGetAsync('SELECT * FROM user_addresses WHERE id = ?', [result.lastID]);
    res.json({ message: 'Address saved.', address: created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/account/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await dbGetAsync('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!existing) return res.status(404).json({ error: 'Saved address not found.' });

    const label = String(req.body?.label ?? existing.label ?? 'Home').trim() || 'Home';
    const address = String(req.body?.address ?? existing.address ?? '').trim();
    const pincode = String(req.body?.pincode ?? extractPincode(address) ?? existing.pincode ?? '').trim();
    const lat = req.body?.lat ?? existing.lat ?? null;
    const lng = req.body?.lng ?? existing.lng ?? null;
    const isDefault = Boolean(req.body?.is_default);
    if (!address) return res.status(400).json({ error: 'Address is required.' });

    if (isDefault) {
      await dbRunAsync('UPDATE user_addresses SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.userId]);
    }
    await dbRunAsync(
      `UPDATE user_addresses
       SET label = ?, address = ?, pincode = ?, lat = ?, lng = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [label, address, pincode || null, lat, lng, isDefault ? 1 : 0, req.params.id, req.user.userId]
    );
    if (isDefault) {
      await dbRunAsync('UPDATE users SET address = ? WHERE id = ?', [address, req.user.userId]);
    } else if (existing.is_default) {
      await syncUserPrimaryAddress(req.user.userId);
    }
    queueOperationalStateSync('account-address-updated');
    const updated = await dbGetAsync('SELECT * FROM user_addresses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Address updated.', address: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/account/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await dbGetAsync('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!existing) return res.status(404).json({ error: 'Saved address not found.' });
    await dbRunAsync('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (existing.is_default) {
      const fallback = await dbGetAsync(
        'SELECT id, address FROM user_addresses WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1',
        [req.user.userId]
      );
      if (fallback) {
        await dbRunAsync('UPDATE user_addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [fallback.id]);
        await dbRunAsync('UPDATE users SET address = ? WHERE id = ?', [fallback.address, req.user.userId]);
      } else {
        await dbRunAsync('UPDATE users SET address = ? WHERE id = ?', ['', req.user.userId]);
      }
    }
    queueOperationalStateSync('account-address-deleted');
    res.json({ message: 'Address removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account/saved-items', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT si.id, si.product_id, si.created_at
       FROM saved_items si
       WHERE si.user_id = ?
       ORDER BY si.created_at DESC, si.id DESC`,
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account/saved-items', authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.body?.product_id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'A valid product is required.' });
    }
    const product = await dbGetAsync('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    await dbRunAsync(
      `INSERT OR IGNORE INTO saved_items (user_id, product_id)
       VALUES (?, ?)`,
      [req.user.userId, productId]
    );
    queueOperationalStateSync('saved-item-created');
    const savedItem = await dbGetAsync(
      `SELECT id, product_id, created_at
       FROM saved_items
       WHERE user_id = ? AND product_id = ?`,
      [req.user.userId, productId]
    );
    res.json({ message: 'Saved item added.', saved_item: savedItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/account/saved-items/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'A valid product is required.' });
    }
    await dbRunAsync(
      'DELETE FROM saved_items WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );
    queueOperationalStateSync('saved-item-deleted');
    res.json({ message: 'Saved item removed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/warranty-register', authenticateToken, async (req, res) => {
  try {
    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const orderItemId = Number(req.body?.order_item_id || 0);
    const item = await dbGetAsync(
      `SELECT oi.*, p.name AS product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.id = ? AND oi.order_id = ?`,
      [orderItemId, order.id]
    );
    if (!item) return res.status(404).json({ error: 'Ordered product not found' });

    const existing = await dbGetAsync('SELECT * FROM warranty_registrations WHERE order_item_id = ?', [item.id]);
    if (existing) {
      return res.status(400).json({ error: 'Warranty is already registered for this product item.' });
    }

    const serialNumber = String(req.body?.serial_number || '').trim();
    const installerName = String(req.body?.installer_name || '').trim();
    const purchaseUseCase = String(req.body?.purchase_use_case || '').trim();
    const notes = String(req.body?.notes || '').trim();
    if (!serialNumber) return res.status(400).json({ error: 'Serial number is required.' });

    const result = await dbRunAsync(
      `INSERT INTO warranty_registrations (
         user_id, order_id, order_item_id, product_id, serial_number, installer_name,
         purchase_use_case, notes, status, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        req.user.userId,
        order.id,
        item.id,
        item.product_id,
        serialNumber,
        installerName || null,
        purchaseUseCase || null,
        notes || null,
        'registered'
      ]
    );

    await createUserNotification({
      userId: req.user.userId,
      target: 'customer',
      title: 'Warranty registered',
      message: `${item.product_name} is now registered under your Camigo warranty records.`,
      personalize: 1
    });
    queueOperationalStateSync('warranty-registered');

    const registration = await dbGetAsync('SELECT * FROM warranty_registrations WHERE id = ?', [result.lastID]);
    res.json({ message: 'Warranty registered.', registration });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Warranty is already registered for this product item.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/service-tickets', authenticateToken, async (req, res) => {
  try {
    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const orderItemId = Number(req.body?.order_item_id || 0);
    const item = await dbGetAsync(
      `SELECT oi.*, p.name AS product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.id = ? AND oi.order_id = ?`,
      [orderItemId, order.id]
    );
    if (!item) return res.status(404).json({ error: 'Ordered product not found' });

    const ticketType = String(req.body?.ticket_type || 'support').trim().toLowerCase();
    const safeTicketType = new Set(['support', 'refund', 'installation', 'warranty']).has(ticketType)
      ? ticketType
      : 'support';
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const contactPhone = cleanPhone(req.body?.contact_phone || '');
    const preferredSlot = String(req.body?.preferred_slot || '').trim();
    const priority = ['low', 'normal', 'high'].includes(String(req.body?.priority || '').trim().toLowerCase())
      ? String(req.body?.priority || '').trim().toLowerCase()
      : 'normal';

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and issue details are required.' });
    }

    const result = await dbRunAsync(
      `INSERT INTO service_tickets (
         user_id, order_id, order_item_id, product_id, ticket_type, title, description,
         contact_phone, preferred_slot, status, priority, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        req.user.userId,
        order.id,
        item.id,
        item.product_id,
        safeTicketType,
        title,
        description,
        contactPhone || null,
        preferredSlot || null,
        'open',
        priority
      ]
    );

    await createUserNotification({
      userId: req.user.userId,
      target: 'customer',
      title: 'Support ticket created',
      message: `${item.product_name} issue has been sent to the Camigo support queue.`,
      personalize: 1
    });
    queueOperationalStateSync('service-ticket-created');

    const ticket = await dbGetAsync('SELECT * FROM service_tickets WHERE id = ?', [result.lastID]);
    res.json({ message: 'Service ticket created.', ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const order = await dbGetAsync(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const decision = canCustomerCancelOrder(order);
    if (!decision.allowed) {
      return res.status(400).json({ error: decision.reason });
    }

    const nextPaymentStatus = String(order.payment_status || '').toLowerCase() === 'paid'
      ? 'refund_pending'
      : 'cancelled';

    if (order.uber_direct_order_id && hasUberDirectConfig) {
      try {
        await cancelUberDirectDelivery(order.uber_direct_order_id, 'CUSTOMER');
      } catch (uberError) {
        console.warn(`Uber Direct cancel failed for order ${order.id}: ${uberError.message}`);
      }
    }

    await dbRunAsync(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', nextPaymentStatus, req.params.id, req.user.userId]
    );

    await createUserNotification({
      userId: req.user.userId,
      target: 'customer',
      title: 'Order cancelled',
      message: nextPaymentStatus === 'refund_pending'
        ? 'Your order was cancelled within 1 minute. Refund review has started.'
        : 'Your order was cancelled successfully.',
      personalize: 1
    });
    queueOperationalStateSync('customer-order-cancelled');

    res.json({
      message: 'Order cancelled',
      status: 'cancelled',
      payment_status: nextPaymentStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoints
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT id, email, name, phone, phone_verified, address, role, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/setup-packages', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const packages = await syncSetupPackageProducts(await resolveSetupPackages());
    await saveJsonAppSetting(APP_SETTING_KEYS.homepageSetupPackages, packages);
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/setup-packages', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!Array.isArray(req.body?.packages)) {
      return res.status(400).json({ error: 'Packages array is required' });
    }
    const packages = await syncSetupPackageProducts(sanitizeSetupPackages(req.body.packages));
    if (!packages.length) {
      return res.status(400).json({ error: 'At least one valid setup package is required' });
    }

    await saveJsonAppSetting(APP_SETTING_KEYS.homepageSetupPackages, packages);
    const operationalBackup = await syncOperationalStateForResponse('setup-packages-updated');
    res.json({
      message: 'Full setup packages updated.',
      packages,
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  const categoryId = Number(req.params.id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ error: 'Valid category ID is required' });
  }

  const name = String(req.body.name || '').trim();
  const image = String(req.body.image || '').trim();
  const sortOrder = Number(req.body.sort_order || 0);
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  if (!image) {
    return res.status(400).json({ error: 'Category image is required' });
  }

  try {
    const result = await dbRunAsync(
      'UPDATE categories SET name = ?, image = ?, sort_order = ? WHERE id = ?',
      [name, image, Number.isFinite(sortOrder) ? sortOrder : 0, categoryId]
    );
    if (!result.changes) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const catalogBackup = await syncCatalogBackupForResponse('category-updated');
    res.json({
      message: 'Category updated',
      catalog_backup: catalogBackup,
      catalog_warning: catalogBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/delivery/orders', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }

  db.all(`SELECT o.*, u.name as user_name, u.phone as user_phone
          FROM orders o
          JOIN users u ON o.user_id = u.id
           WHERE (o.payment_status = 'paid' OR lower(coalesce(o.payment_method, '')) = 'cod')
              AND o.status NOT IN ('delivered', 'rejected')
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/installer/orders', authenticateToken, (req, res) => {
  if (!['installer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Installer access required' });
  }
  db.all(`SELECT o.*, u.name as user_name, u.phone as user_phone
          FROM orders o
          JOIN users u ON o.user_id = u.id
           WHERE (o.payment_status = 'paid' OR lower(coalesce(o.payment_method, '')) = 'cod')
              AND o.installation_requested = 1
            AND o.installation_status != 'completed'
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/installer/orders/:id/status', authenticateToken, (req, res) => {
  if (!['installer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Installer access required' });
  }
  const { installation_status } = req.body;
  const allowedStatuses = ['requested', 'assigned', 'in_progress', 'completed'];
  if (!allowedStatuses.includes(installation_status)) {
    return res.status(400).json({ error: 'Invalid installation status' });
  }
  const params = req.user.role === 'installer'
    ? [installation_status, req.user.userId, req.params.id]
    : [installation_status, req.params.id];
  const query = req.user.role === 'installer'
    ? 'UPDATE orders SET installation_status = ?, installer_id = ? WHERE id = ? AND installation_requested = 1'
    : 'UPDATE orders SET installation_status = ? WHERE id = ? AND installation_requested = 1';
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: 'Installation order not found' });
    db.get('SELECT user_id FROM orders WHERE id = ?', [req.params.id], async (orderErr, order) => {
      if (orderErr || !order) return;
      const labels = {
        assigned: 'Installer assigned',
        in_progress: 'Installation started',
        completed: 'Installation completed'
      };
      const messages = {
        assigned: 'A Camigo installer has been assigned to your order.',
        in_progress: 'Your CCTV installation is now in progress.',
        completed: 'Your CCTV installation has been completed successfully.'
      };
      const title = labels[installation_status] || 'Installation updated';
      const message = messages[installation_status] || `Installation status changed to ${String(installation_status).replaceAll('_', ' ')}.`;
      await createUserNotification({ userId: order.user_id, target: 'customer', title, message, personalize: 1 });
      await sendPushToUserIds(order.user_id, { title, body: message, order_id: req.params.id, installation_status }, 'customer');
      queueOperationalStateSync('installation-status-updated');
    });
    res.json({ message: 'Installation status updated', installation_status });
  });
});

app.put('/api/delivery/orders/:id/status', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }

  const { status } = req.body;
  const allowedStatuses = ['pending', 'accepted', 'rejected', 'arrived_at_store', 'picked_up', 'packed', 'out_for_delivery', 'delivered'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid delivery status' });
  }

  const params = req.user.role === 'delivery_partner'
    ? [status, req.user.userId, req.params.id]
    : [status, req.params.id];
  const query = req.user.role === 'delivery_partner'
    ? 'UPDATE orders SET status = ?, delivery_partner_id = ? WHERE id = ?'
    : 'UPDATE orders SET status = ? WHERE id = ?';

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: 'Order not found' });
    notifyOrderStatusChange(req.params.id, status);
    queueOperationalStateSync('delivery-status-updated');
    res.json({ message: 'Order status updated', status });
  });
});

app.post('/api/delivery/orders/:id/verify-otp', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }

  const { otp } = req.body;
  db.get('SELECT id, delivery_otp FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.delivery_otp) !== String(otp || '').trim()) {
      return res.status(400).json({ error: 'Invalid delivery OTP' });
    }

    const params = req.user.role === 'delivery_partner'
      ? ['delivered', req.user.userId, req.params.id]
      : ['delivered', req.params.id];
    const query = req.user.role === 'delivery_partner'
      ? 'UPDATE orders SET status = ?, delivery_partner_id = ? WHERE id = ?'
      : 'UPDATE orders SET status = ? WHERE id = ?';

    db.run(query, params, function(updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      notifyOrderStatusChange(req.params.id, 'delivered');
      queueOperationalStateSync('delivery-otp-verified');
      res.json({ message: 'OTP verified. Order delivered.', status: 'delivered' });
    });
  });
});

app.get('/api/delivery/earnings', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }

  db.all(`SELECT id, final_amount, created_at
          FROM orders
          WHERE status = 'delivered'
          ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayOrders = rows.filter(row => String(row.created_at).slice(0, 10) === todayKey);
    const weekOrders = rows.filter(row => new Date(row.created_at) >= weekAgo);
    const deliveryFee = 45;
    res.json({
      today_orders: todayOrders.length,
      week_orders: weekOrders.length,
      today_earnings: todayOrders.length * deliveryFee,
      week_earnings: weekOrders.length * deliveryFee,
      online_hours: Math.max(2, Math.round((weekOrders.length * 0.8 + 3) * 10) / 10),
      wallet_balance: weekOrders.length * deliveryFee + (weekOrders.length >= 10 ? 250 : 0),
      incentive: weekOrders.length >= 10 ? 250 : 0,
      rating: 4.8
    });
  });
});

app.post('/api/delivery/location', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }
  const { lat, lng, status } = req.body;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  db.run(
    `INSERT INTO delivery_locations (partner_id, lat, lng, status, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(partner_id) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
    [req.user.userId, Number(lat), Number(lng), status || 'on_delivery'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      queueOperationalStateSync('delivery-location-updated');
      res.json({ message: 'Location updated', lat: Number(lat), lng: Number(lng), status: status || 'on_delivery' });
    }
  );
});

app.get('/api/tracking/:orderId', authenticateToken, async (req, res) => {
  const elevated = req.user.role === 'admin' || req.user.role === 'delivery_partner';
  const orderParams = elevated
    ? [req.params.orderId]
    : [req.params.orderId, req.user.userId];
  const orderQuery = elevated
    ? `SELECT o.*, dp.name as delivery_partner_name, dp.phone as delivery_partner_phone
       FROM orders o
       LEFT JOIN users dp ON o.delivery_partner_id = dp.id
       WHERE o.id = ?`
    : `SELECT o.*, dp.name as delivery_partner_name, dp.phone as delivery_partner_phone
       FROM orders o
       LEFT JOIN users dp ON o.delivery_partner_id = dp.id
       WHERE o.id = ? AND o.user_id = ?`;

  try {
    let order = await dbGetAsync(orderQuery, orderParams);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.uber_direct_order_id && hasUberDirectConfig) {
      try {
        const uberStatus = await getUberDirectDeliveryStatus(order.uber_direct_order_id);
        await syncUberDirectOrderStatus(order, uberStatus);
        order = await dbGetAsync(orderQuery, orderParams);
        const courierTrip = Array.isArray(uberStatus?.courier_trips) ? uberStatus.courier_trips[uberStatus.courier_trips.length - 1] : null;
        const courier = courierTrip?.courier || {};
        const partnerLocation = courier?.location
          ? {
              lat: Number(courier.location.latitude ?? courier.location.lat),
              lng: Number(courier.location.longitude ?? courier.location.lng),
              updated_at: new Date().toISOString(),
              partner_name: courier.name || order.uber_courier_name || 'Uber courier',
              partner_phone: courier.phone || courier.phone_number || order.uber_courier_phone || null
            }
          : null;
        const partner = {
          partner_name: courier.name || order.uber_courier_name || 'Uber courier',
          partner_phone: courier.phone || courier.phone_number || order.uber_courier_phone || null,
          tracking_url: uberStatus?.order_tracking_url || order.uber_tracking_url || null,
          provider: 'Uber Direct'
        };
        return res.json({ order, partner, partner_location: partnerLocation });
      } catch (uberError) {
        console.warn(`Uber Direct status fallback used for order ${order.id}: ${uberError.message}`);
      }
    }

    const orderStatus = String(order.status || '').toLowerCase();
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const codOrder = String(order.payment_method || '').toLowerCase() === 'cod';
    if (orderStatus === 'payment_pending' || ((!codOrder && paymentStatus && paymentStatus !== 'paid')) || ['cancelled', 'rejected', 'delivered'].includes(orderStatus)) {
      return res.json({ order, partner: null, partner_location: null });
    }

    const partner = order.delivery_partner_id
      ? {
          partner_id: order.delivery_partner_id,
          partner_name: order.delivery_partner_name,
          partner_phone: order.delivery_partner_phone
        }
      : null;
    const locationParams = order.delivery_partner_id ? [order.delivery_partner_id] : [];
    const locationWhere = order.delivery_partner_id
      ? 'WHERE dl.partner_id = ?'
      : "WHERE u.role = 'delivery_partner'";

    db.get(`SELECT dl.*, u.name as partner_name, u.phone as partner_phone
            FROM delivery_locations dl
            JOIN users u ON dl.partner_id = u.id
            ${locationWhere}
            ORDER BY dl.updated_at DESC LIMIT 1`, locationParams, (err, location) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ order, partner: partner || location || null, partner_location: location || null });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks/uber-direct', async (req, res) => {
  try {
    const payload = req.body || {};
    const externalOrderId = String(payload?.meta?.external_order_id || payload?.external_order_id || '').trim();
    const uberOrderId = String(payload?.meta?.order_id || payload?.data?.id || payload?.order_id || '').trim();
    let order = null;
    if (/^camigo-\d+$/.test(externalOrderId)) {
      order = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [Number(externalOrderId.replace('camigo-', ''))]);
    }
    if (!order && uberOrderId) {
      order = await dbGetAsync('SELECT * FROM orders WHERE uber_direct_order_id = ?', [uberOrderId]);
    }
    if (!order) return res.status(200).json({ ok: true });

    let uberStatus = null;
    if (uberOrderId && hasUberDirectConfig) {
      try {
        uberStatus = await getUberDirectDeliveryStatus(uberOrderId);
      } catch (error) {
        uberStatus = null;
      }
    }
    if (uberStatus) {
      await syncUberDirectOrderStatus(order, uberStatus);
    } else {
      const rawStatus = payload?.meta?.status || payload?.status || null;
      const mappedStatus = mapUberTripStatusToCamigo(rawStatus);
      await dbRunAsync(
        `UPDATE orders
         SET uber_direct_order_id = COALESCE(?, uber_direct_order_id), uber_status = ?, uber_last_event_at = CURRENT_TIMESTAMP,
             status = CASE WHEN ? IS NOT NULL THEN ? ELSE status END
         WHERE id = ?`,
        [uberOrderId || null, rawStatus, mappedStatus, mappedStatus, order.id]
      );
    }
    queueOperationalStateSync('uber-direct-webhook');
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(200).json({ ok: true });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, phone, address, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Email, password, name, and role are required' });
  }
  if (!['user', 'dealer', 'distributor', 'delivery_partner', 'installer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail) {
      return res.status(400).json({ error: 'Valid login ID/email is required' });
    }

    const duplicateEmail = await dbGetAsync(
      'SELECT id FROM users WHERE lower(email) = lower(?)',
      [safeEmail]
    );
    if (duplicateEmail) {
      return res.status(400).json({ error: 'This login ID/email is already used' });
    }

    const safePhone = cleanPhone(phone);
    if (safePhone && !isValidIndianMobile(safePhone)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
    }
    if (safePhone) {
      const duplicatePhone = await dbGetAsync('SELECT id FROM users WHERE phone = ?', [safePhone]);
      if (duplicatePhone) {
        return res.status(400).json({ error: 'This mobile number is already linked to another account' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const phoneVerified = safePhone && role !== 'user' ? 1 : 0;
    const result = await dbRunAsync(
      `INSERT INTO users (
         email, password, plaintext_password, name, phone, phone_verified,
         phone_verified_at, address, role
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeEmail,
        hashedPassword,
        password,
        String(name).trim(),
        safePhone,
        phoneVerified,
        phoneVerified ? new Date().toISOString() : null,
        String(address || '').trim(),
        role
      ]
    );
    const operationalBackup = await syncOperationalStateForResponse('admin-user-created');
    res.json({
      id: result.lastID,
      email: safeEmail,
      password,
      role,
      message: 'Login created',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This login ID/email is already used' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, (req, res) => {
  db.all(`SELECT o.*, u.email, u.phone, u.name as user_name 
          FROM orders o 
          JOIN users u ON o.user_id = u.id 
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/warranty-registrations', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT wr.*, u.name AS user_name, u.phone AS user_phone, p.name AS product_name, p.image AS product_image
       FROM warranty_registrations wr
       LEFT JOIN users u ON u.id = wr.user_id
       LEFT JOIN products p ON p.id = wr.product_id
       ORDER BY wr.created_at DESC, wr.id DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/warranty-registrations/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await dbGetAsync('SELECT * FROM warranty_registrations WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Warranty registration not found' });

    const nextStatus = normalizeWarrantyStatus(req.body?.status, existing.status || 'registered');
    const notes = String(req.body?.notes ?? existing.notes ?? '').trim();
    await dbRunAsync(
      'UPDATE warranty_registrations SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextStatus, notes || null, req.params.id]
    );
    queueOperationalStateSync('admin-warranty-updated');

    const updated = await dbGetAsync('SELECT * FROM warranty_registrations WHERE id = ?', [req.params.id]);
    if (updated?.user_id) {
      await createUserNotification({
        userId: updated.user_id,
        target: 'customer',
        title: 'Warranty record updated',
        message: `Your Camigo warranty record is now marked as ${nextStatus.replaceAll('_', ' ')}.`,
        personalize: 1
      });
    }
    res.json({ message: 'Warranty registration updated.', registration: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/service-tickets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await dbAllAsync(
      `SELECT st.*, u.name AS user_name, u.phone AS user_phone, p.name AS product_name, p.image AS product_image
       FROM service_tickets st
       LEFT JOIN users u ON u.id = st.user_id
       LEFT JOIN products p ON p.id = st.product_id
       ORDER BY st.created_at DESC, st.id DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/service-tickets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = await dbGetAsync('SELECT * FROM service_tickets WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Service ticket not found' });

    const nextStatus = normalizeTicketStatus(req.body?.status, existing.status || 'open');
    const resolutionNotes = String(req.body?.resolution_notes ?? existing.resolution_notes ?? '').trim();
    const priority = ['low', 'normal', 'high'].includes(String(req.body?.priority || '').trim().toLowerCase())
      ? String(req.body?.priority || '').trim().toLowerCase()
      : (existing.priority || 'normal');

    await dbRunAsync(
      `UPDATE service_tickets
       SET status = ?, priority = ?, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStatus, priority, resolutionNotes || null, req.params.id]
    );
    queueOperationalStateSync('admin-service-ticket-updated');

    const updated = await dbGetAsync('SELECT * FROM service_tickets WHERE id = ?', [req.params.id]);
    if (updated?.user_id) {
      await createUserNotification({
        userId: updated.user_id,
        target: 'customer',
        title: 'Support ticket updated',
        message: `Your Camigo support ticket is now ${nextStatus.replaceAll('_', ' ')}.`,
        personalize: 1
      });
    }
    res.json({ message: 'Service ticket updated.', ticket: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/orders/:id/manual-dispatch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const provider = String(req.body?.provider || '').trim();
    const reference = String(req.body?.reference || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const requestedDispatchStatus = String(req.body?.dispatch_status || '').trim().toLowerCase();
    const requestedOrderStatus = String(req.body?.order_status || '').trim().toLowerCase();
    const allowedDispatchStatuses = new Set(['not_booked', 'booked', 'assigned', 'out_for_delivery', 'delivered', 'cancelled']);
    const allowedOrderStatuses = new Set(['pending', 'accepted', 'out_for_delivery', 'delivered', 'cancelled']);
    const nextDispatchStatus = allowedDispatchStatuses.has(requestedDispatchStatus)
      ? requestedDispatchStatus
      : (String(order.manual_dispatch_status || '').trim().toLowerCase() || 'not_booked');

    let nextOrderStatus = allowedOrderStatuses.has(requestedOrderStatus)
      ? requestedOrderStatus
      : String(order.status || 'pending').toLowerCase();

    if (!requestedOrderStatus) {
      if (['booked', 'assigned'].includes(nextDispatchStatus) && nextOrderStatus === 'pending') nextOrderStatus = 'accepted';
      if (nextDispatchStatus === 'out_for_delivery') nextOrderStatus = 'out_for_delivery';
      if (nextDispatchStatus === 'delivered') nextOrderStatus = 'delivered';
    }

    await dbRunAsync(
      `UPDATE orders
       SET manual_dispatch_provider = ?,
           manual_dispatch_status = ?,
           manual_dispatch_reference = ?,
           manual_dispatch_notes = ?,
           manual_dispatch_updated_at = CURRENT_TIMESTAMP,
           delivery_provider = CASE WHEN ? <> '' THEN ? ELSE delivery_provider END,
           status = ?
       WHERE id = ?`,
      [
        provider || null,
        nextDispatchStatus,
        reference || null,
        notes || null,
        provider,
        provider,
        nextOrderStatus,
        order.id
      ]
    );
    queueOperationalStateSync('manual-dispatch-updated');
    const updated = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [order.id]);
    res.json({ message: 'Manual dispatch updated.', order: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/system-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [uberLinkedOrders, paidUberOrders, codEnabled] = await Promise.all([
      dbGetAsync("SELECT COUNT(*) AS count FROM orders WHERE uber_direct_order_id IS NOT NULL AND TRIM(uber_direct_order_id) <> ''"),
      dbGetAsync('SELECT COUNT(*) AS count FROM orders WHERE delivery_provider = ? AND payment_status = ?', ['Uber Direct', 'paid']),
      isCodEnabled()
    ]);
    res.json({
      uber_direct: {
        ready: hasUberDirectConfig,
        app_generated: Boolean(UBER_DIRECT_CLIENT_ID),
        app_id: UBER_DIRECT_CLIENT_ID || '',
        customer_id: UBER_DIRECT_CUSTOMER_ID || '',
        store_id: UBER_DIRECT_STORE_ID || '',
        pickup_phone: UBER_DIRECT_PICKUP_PHONE || '',
        pickup_instructions: UBER_DIRECT_PICKUP_INSTRUCTIONS || '',
        auth_mode: 'client_secret',
        webhook_url: `${publicServerBaseUrl}/api/webhooks/uber-direct`,
        linked_orders: Number(uberLinkedOrders?.count || 0),
        paid_orders_using_uber: Number(paidUberOrders?.count || 0)
      },
      razorpay: {
        ready: hasRazorpayConfig,
        key_id: RAZORPAY_KEY_ID || ''
      },
      delhivery: {
        ready: hasDelhiveryApiConfig,
        client_name: DELHIVERY_CLIENT_NAME || '',
        pickup_location: DELHIVERY_PICKUP_LOCATION || '',
        seller_phone: DELHIVERY_SELLER_PHONE || '',
        seller_pincode: DELHIVERY_SELLER_PINCODE || ''
      },
      payments: {
        cod_enabled: codEnabled
      },
      media_library: {
        ready: Boolean(MEDIA_LIBRARY_PUBLIC_BASE),
        public_base: MEDIA_LIBRARY_PUBLIC_BASE || ''
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/store-settings/cod', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    await saveJsonAppSetting(APP_SETTING_KEYS.codEnabled, enabled);
    const operationalBackup = await syncOperationalStateForResponse('cod-setting-updated');
    res.json({
      message: `Cash on delivery ${enabled ? 'enabled' : 'disabled'}.`,
      cod_enabled: enabled,
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/category-banners', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    `SELECT cb.*, COALESCE(c.name, 'Shop by Category') as category_name
     FROM category_banners cb
     LEFT JOIN categories c ON cb.category_id = c.id
     ORDER BY cb.category_id ASC, c.sort_order ASC, cb.sort_order ASC, cb.id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/admin/category-banners/ai-generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      category_id = 0,
      prompt = '',
      width = 1200,
      height = 320,
      theme = 'blue',
      sort_order = 0,
      active = true,
      save = true
    } = req.body || {};
    const generateAll = String(category_id) === 'all';
    const categoryId = generateAll ? 0 : Number(category_id) || 0;
    const placements = generateAll
      ? [{ id: 0, name: 'Shop by Category' }, ...(await dbAllAsync('SELECT id, name FROM categories ORDER BY sort_order ASC, id ASC'))]
      : [];
    if (generateAll) {
      const generated = [];
      for (const placement of placements) {
        const discountedProducts = await dbAllAsync(
          `SELECT p.name, p.price, p.mrp, p.discount_percent, c.name as category_name
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE (? = 0 OR p.category_id = ?)
           ORDER BY COALESCE(p.discount_percent, CASE WHEN p.mrp > 0 THEN ((p.mrp - p.price) * 100.0 / p.mrp) ELSE 0 END) DESC
           LIMIT 8`,
          [placement.id, placement.id]
        );
        const offerSummary = discountedProducts.map(product => {
          const discount = Number(product.discount_percent) > 0
            ? Math.round(Number(product.discount_percent))
            : product.mrp ? Math.max(0, Math.round((1 - Number(product.price) / Number(product.mrp)) * 100)) : 0;
          return `${product.name} (${discount}% off, Rs ${product.price}, MRP Rs ${product.mrp})`;
        }).join('\n');
        const ai = await callOpenAiJson({
          system: `You are Camigo's ecommerce banner copywriter for a CCTV and security delivery app.
Return only JSON with keys: eyebrow, headline, subheadline, cta, theme.
Use short punchy Indian quick-commerce style copy. No markdown. No HTML.`,
          user: `Banner placement: ${placement.name}
Admin instruction: ${prompt || 'Create the best sales banner from available offers.'}
Current products and discounts:
${offerSummary || 'No product discounts available.'}
Allowed theme values: blue, yellow, green, orange.
Make headline under 42 characters and subheadline under 85 characters.`
        });
        const imageUrl = buildBannerSvgDataUrl({
          width,
          height,
          headline: ai.headline,
          subheadline: ai.subheadline,
          eyebrow: ai.eyebrow,
          cta: ai.cta,
          theme: ai.theme || theme
        });
        if (save) {
          const result = await dbRunAsync(
            `INSERT INTO category_banners (category_id, image_url, width, height, sort_order, active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              placement.id,
              imageUrl,
              Math.max(640, Number(width) || 1200),
              Math.max(180, Number(height) || 320),
              Number(sort_order) || 0,
              active ? 1 : 0
            ]
          );
          generated.push({ id: result.lastID, category_id: placement.id, category_name: placement.name, image_url: imageUrl, copy: ai });
        } else {
          generated.push({ category_id: placement.id, category_name: placement.name, image_url: imageUrl, copy: ai });
        }
      }
      const catalogBackup = save ? await syncCatalogBackupForResponse('ai-banners-generated') : null;
      return res.json({
        generated,
        message: `AI generated ${generated.length} banner${generated.length === 1 ? '' : 's'}`,
        catalog_backup: catalogBackup,
        catalog_warning: catalogBackup?.warning
      });
    }
    const category = categoryId === 0
      ? { name: 'Shop by Category' }
      : await dbGetAsync('SELECT name FROM categories WHERE id = ?', [categoryId]);
    if (categoryId !== 0 && !category) {
      return res.status(400).json({ error: 'Selected banner category was not found' });
    }

    const discountedProducts = await dbAllAsync(
      `SELECT p.name, p.price, p.mrp, p.discount_percent, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE (? = 0 OR p.category_id = ?)
       ORDER BY COALESCE(p.discount_percent, CASE WHEN p.mrp > 0 THEN ((p.mrp - p.price) * 100.0 / p.mrp) ELSE 0 END) DESC
       LIMIT 8`,
      [categoryId, categoryId]
    );
    const offerSummary = discountedProducts.map(product => {
      const discount = Number(product.discount_percent) > 0
        ? Math.round(Number(product.discount_percent))
        : product.mrp ? Math.max(0, Math.round((1 - Number(product.price) / Number(product.mrp)) * 100)) : 0;
      return `${product.name} (${discount}% off, Rs ${product.price}, MRP Rs ${product.mrp})`;
    }).join('\n');

    const ai = await callOpenAiJson({
      system: `You are Camigo's ecommerce banner copywriter for a CCTV and security delivery app.
Return only JSON with keys: eyebrow, headline, subheadline, cta, theme.
Use short punchy Indian quick-commerce style copy. No markdown. No HTML.`,
      user: `Banner placement: ${category.name}
Admin instruction: ${prompt || 'Create the best sales banner from available offers.'}
Current products and discounts:
${offerSummary || 'No product discounts available.'}
Allowed theme values: blue, yellow, green, orange.
Make headline under 42 characters and subheadline under 85 characters.`
    });

    const imageUrl = buildBannerSvgDataUrl({
      width,
      height,
      headline: ai.headline,
      subheadline: ai.subheadline,
      eyebrow: ai.eyebrow,
      cta: ai.cta,
      theme: ai.theme || theme
    });

    if (!save) {
      return res.json({ image_url: imageUrl, copy: ai });
    }

    const result = await dbRunAsync(
      `INSERT INTO category_banners (category_id, image_url, width, height, sort_order, active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        imageUrl,
        Math.max(640, Number(width) || 1200),
        Math.max(180, Number(height) || 320),
        Number(sort_order) || 0,
        active ? 1 : 0
      ]
    );
    const catalogBackup = await syncCatalogBackupForResponse('ai-banner-generated');
    res.json({
      id: result.lastID,
      image_url: imageUrl,
      copy: ai,
      message: 'AI banner generated and saved',
      catalog_backup: catalogBackup,
      catalog_warning: catalogBackup.warning
    });
  } catch (error) {
    const status = /OpenAI API key/.test(error.message) ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/admin/category-banners', authenticateToken, requireAdmin, (req, res) => {
  const { category_id, image_url, width, height, sort_order, active } = req.body;
  if (!Number.isInteger(Number(category_id)) || Number(category_id) < 0 || !String(image_url || '').trim()) {
    return res.status(400).json({ error: 'Category and banner image are required' });
  }
  db.run(
    `INSERT INTO category_banners (category_id, image_url, width, height, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(category_id),
      String(image_url).trim(),
      Math.max(320, Number(width) || 1200),
      Math.max(120, Number(height) || 320),
      Number(sort_order) || 0,
      active ? 1 : 0
    ],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const catalogBackup = await syncCatalogBackupForResponse('banner-created');
      res.json({
        id: this.lastID,
        message: 'Category banner added',
        catalog_backup: catalogBackup,
        catalog_warning: catalogBackup.warning
      });
    }
  );
});

app.put('/api/admin/category-banners/:id', authenticateToken, requireAdmin, (req, res) => {
  const { category_id, image_url, width, height, sort_order, active } = req.body;
  if (!Number.isInteger(Number(category_id)) || Number(category_id) < 0 || !String(image_url || '').trim()) {
    return res.status(400).json({ error: 'Category and banner image are required' });
  }
  db.run(
    `UPDATE category_banners
     SET category_id = ?, image_url = ?, width = ?, height = ?, sort_order = ?, active = ?
     WHERE id = ?`,
    [
      Number(category_id),
      String(image_url).trim(),
      Math.max(320, Number(width) || 1200),
      Math.max(120, Number(height) || 320),
      Number(sort_order) || 0,
      active ? 1 : 0,
      req.params.id
    ],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const catalogBackup = await syncCatalogBackupForResponse('banner-updated');
      res.json({
        message: 'Category banner updated',
        catalog_backup: catalogBackup,
        catalog_warning: catalogBackup.warning
      });
    }
  );
});

app.delete('/api/admin/category-banners/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM category_banners WHERE id = ?', [req.params.id], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const catalogBackup = await syncCatalogBackupForResponse('banner-deleted');
    res.json({
      message: 'Category banner deleted',
      catalog_backup: catalogBackup,
      catalog_warning: catalogBackup.warning
    });
  });
});

app.get('/api/admin/media/manifest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const manifest = await buildMediaManifest();
    res.setHeader('Content-Disposition', 'attachment; filename="camigo-catalog-backup.json"');
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/media/manifest/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = req.body?.manifest_url
      ? await restoreMediaManifestFromUrl(req.body.manifest_url, 'admin-url-import')
      : await applyMediaManifest(req.body?.manifest || req.body, 'admin-json-import');
    const catalogBackup = await syncCatalogBackupForResponse('catalog-imported');
    res.json({
      ...result,
      message: `Catalog restored: ${result.categoryCount || 0} category tiles, ${result.productCount} products (${result.insertedProductCount || 0} new) and ${result.bannerCount} banners.`,
      catalog_backup: catalogBackup,
      catalog_warning: catalogBackup.warning
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/media/manifest/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!hasCatalogFtpConfig) {
      return res.status(400).json({
        error: 'FTP auto-backup is not configured. Add MEDIA_MANIFEST_FTP_HOST, MEDIA_MANIFEST_FTP_USER, MEDIA_MANIFEST_FTP_PASSWORD, and MEDIA_MANIFEST_FTP_PATH in Render Environment.'
      });
    }
    const result = await uploadCatalogBackupToFtp('admin-manual-sync');
    res.json({ ...result, message: 'Catalog JSON pushed to InfinityFree FTP.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/media/library', authenticateToken, requireAdmin, async (req, res) => {
  if (!MEDIA_LIBRARY_PUBLIC_BASE) {
    return res.status(400).json({
      error: 'InfinityFree public image URL is not configured. Add MEDIA_LIBRARY_PUBLIC_BASE in Render Environment, for example https://your-domain.ct.ws.'
    });
  }

  let client;
  try {
    const dir = normalizeMediaLibraryDir(req.query.dir || '/');
    const remoteDir = mediaLibraryRemoteDir(dir);
    client = await createCatalogFtpClient();
    await client.cd(remoteDir);
    const entries = await client.list();
    const visibleEntries = entries.filter(entry => !String(entry.name || '').startsWith('.'));
    const directories = visibleEntries
      .filter(entry => entry.isDirectory)
      .map(entry => ({
        name: entry.name,
        dir: normalizeMediaLibraryDir(`${dir}/${entry.name}`)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const images = visibleEntries
      .filter(entry => entry.isFile && mediaLibraryImageExtensions.has(path.posix.extname(entry.name || '').toLowerCase()))
      .map(entry => ({
        name: entry.name,
        url: mediaLibraryPublicUrl(dir, entry.name),
        size: entry.size || 0,
        modified_at: entry.modifiedAt ? entry.modifiedAt.toISOString() : entry.rawModifiedAt || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      dir,
      parent: dir === '/' ? null : normalizeMediaLibraryDir(dir.split('/').slice(0, -1).join('/')),
      remote_dir: remoteDir,
      public_base: MEDIA_LIBRARY_PUBLIC_BASE,
      directories,
      images
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not browse InfinityFree media library.' });
  } finally {
    if (client) client.close();
  }
});

app.post('/api/admin/orders/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentStatus = String(order.status || '').toLowerCase();
    if (['cancelled', 'delivered'].includes(currentStatus)) {
      return res.status(400).json({ error: 'This order cannot be cancelled' });
    }

    if (order.uber_direct_order_id && hasUberDirectConfig) {
      try {
        await cancelUberDirectDelivery(order.uber_direct_order_id, 'MERCHANT');
      } catch (uberError) {
        console.warn(`Uber Direct admin cancel failed for order ${order.id}: ${uberError.message}`);
      }
    }

    const nextPaymentStatus = String(order.payment_status || '').toLowerCase() === 'paid'
      ? 'refund_pending'
      : 'cancelled';

    await dbRunAsync(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['cancelled', nextPaymentStatus, req.params.id]
    );

    await createUserNotification({
      userId: order.user_id,
      target: 'customer',
      title: 'Order cancelled by admin',
      message: nextPaymentStatus === 'refund_pending'
        ? 'Your Camigo order was cancelled by admin. Refund review has started.'
        : 'Your Camigo order was cancelled by admin.',
      personalize: 1
    });

    await sendPushToUserIds(order.user_id, {
      title: 'Order cancelled by admin',
      body: nextPaymentStatus === 'refund_pending'
        ? 'Your Camigo order was cancelled. Refund review has started.'
        : 'Your Camigo order was cancelled by admin.',
      order_id: req.params.id,
      status: 'cancelled'
    }, 'customer');
    queueOperationalStateSync('admin-order-cancelled');

    res.json({
      message: 'Order cancelled',
      status: 'cancelled',
      payment_status: nextPaymentStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/delivery-partners', authenticateToken, requireAdmin, (req, res) => {
  db.all(`SELECT u.id, u.name, u.email, u.plaintext_password, u.phone, u.address, u.role,
                 dp.vehicle_type, dp.vehicle_number, dp.license_number, dp.hub_id, dp.active,
                 h.name as hub_name
          FROM users u
          LEFT JOIN delivery_partner_details dp ON dp.user_id = u.id
          LEFT JOIN hubs h ON h.id = dp.hub_id
          WHERE u.role = 'delivery_partner'
          ORDER BY u.id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/admin/delivery-partners/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { email, phone, vehicle_type, vehicle_number, license_number, hub_id, active, password } = req.body;
  const allowedVehicles = ['bike', 'tempo', 'truck'];
  if (!allowedVehicles.includes(vehicle_type)) {
    return res.status(400).json({ error: 'Invalid vehicle type' });
  }

  if (email && String(email).trim().length < 3) {
    return res.status(400).json({ error: 'Login ID must be at least 3 characters' });
  }

  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const fields = [];
    const values = [];
    const safeEmail = email ? String(email).trim().toLowerCase() : '';
    const safePhone = phone !== undefined ? cleanPhone(phone || '') : undefined;

    if (safeEmail) {
      const duplicateEmail = await dbGetAsync(
        'SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?',
        [safeEmail, req.params.id]
      );
      if (duplicateEmail) {
        return res.status(400).json({ error: 'This login ID/email is already used' });
      }
    }

    if (phone !== undefined) {
      if (safePhone && !isValidIndianMobile(safePhone)) {
        return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
      }
      if (safePhone) {
        const duplicatePhone = await dbGetAsync(
          'SELECT id FROM users WHERE phone = ? AND id <> ?',
          [safePhone, req.params.id]
        );
        if (duplicatePhone) {
          return res.status(400).json({ error: 'This mobile number is already linked to another account' });
        }
      }
    }

    if (safeEmail) {
      fields.push('email = ?');
      values.push(safeEmail);
    }

    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(safePhone);
      fields.push('phone_verified = ?');
      values.push(safePhone ? 1 : 0);
      fields.push('phone_verified_at = ?');
      values.push(safePhone ? new Date().toISOString() : null);
    }

    if (password) {
      fields.push('password = ?', 'plaintext_password = ?');
      values.push(await bcrypt.hash(String(password), 10), String(password));
    }

    if (fields.length) {
      const loginUpdate = await dbRunAsync(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND role = ?`,
        [...values, req.params.id, 'delivery_partner']
      );
      if (!loginUpdate.changes) {
        return res.status(404).json({ error: 'Delivery partner not found' });
      }
    }

    await dbRunAsync(
      `INSERT INTO delivery_partner_details (user_id, vehicle_type, vehicle_number, license_number, hub_id, active)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         vehicle_type = excluded.vehicle_type,
         vehicle_number = excluded.vehicle_number,
         license_number = excluded.license_number,
         hub_id = excluded.hub_id,
         active = excluded.active`,
      [req.params.id, vehicle_type, vehicle_number || '', license_number || '', hub_id || null, active ? 1 : 0]
    );

    const operationalBackup = await syncOperationalStateForResponse('delivery-partner-updated');
    res.json({
      message: 'Delivery partner details updated',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This login ID/email is already used' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/hubs', authenticateToken, requireAdmin, async (req, res) => {
  const { name, address, lat, lng, map_url, active } = req.body;
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'Hub name, latitude, and longitude are required' });
  }

  try {
    if (active) {
      await dbRunAsync('UPDATE hubs SET active = 0');
    }
    const result = await dbRunAsync(
      'INSERT INTO hubs (name, address, lat, lng, map_url, active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address || '', Number(lat), Number(lng), map_url || '', active ? 1 : 0]
    );
    const operationalBackup = await syncOperationalStateForResponse('hub-created');
    res.json({
      id: result.lastID,
      message: 'Hub added',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/hubs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, address, lat, lng, map_url, active } = req.body;
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'Hub name, latitude, and longitude are required' });
  }

  try {
    if (active) {
      await dbRunAsync('UPDATE hubs SET active = 0 WHERE id != ?', [req.params.id]);
    }
    await dbRunAsync(
      'UPDATE hubs SET name=?, address=?, lat=?, lng=?, map_url=?, active=? WHERE id=?',
      [name, address || '', Number(lat), Number(lng), map_url || '', active ? 1 : 0, req.params.id]
    );
    const operationalBackup = await syncOperationalStateForResponse('hub-updated');
    res.json({
      message: 'Hub updated',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/hubs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbRunAsync('DELETE FROM hubs WHERE id = ?', [req.params.id]);
    const operationalBackup = await syncOperationalStateForResponse('hub-deleted');
    res.json({
      message: 'Hub deleted',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/notifications', authenticateToken, requireAdmin, (req, res) => {
  const { title, message, target, personalize, product_id, image_url } = req.body;
  const safeTarget = ['customer', 'delivery', 'installer', 'all'].includes(target) ? target : 'customer';
  const safeProductId = Number.isInteger(Number(product_id)) && Number(product_id) > 0 ? Number(product_id) : null;
  const safeImageUrl = String(image_url || '').trim() || null;
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

  db.run(
    'INSERT INTO notifications (title, message, target, personalize, product_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [title, message, safeTarget, personalize ? 1 : 0, safeProductId, safeImageUrl],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const pushResult = await sendPushToTarget(safeTarget, {
        title,
        body: message,
        product_id: safeProductId,
        image_url: safeImageUrl,
        notification_id: this.lastID
      });
      queueOperationalStateSync('admin-notification-created');
      res.json({ id: this.lastID, message: 'Notification sent', push: pushResult });
    }
  );
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['name', 'email', 'phone', 'address', 'role'];
  const incomingUpdates = Object.fromEntries(
    Object.entries(req.body).filter(([field]) => allowedFields.includes(field))
  );

  if (!Object.keys(incomingUpdates).length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  if (incomingUpdates.role && !['user', 'dealer', 'distributor', 'delivery_partner', 'installer', 'admin'].includes(incomingUpdates.role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const existingUser = await dbGetAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedUpdates = {};

    if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'name')) {
      const safeName = String(incomingUpdates.name || '').trim();
      if (!safeName) return res.status(400).json({ error: 'Name is required' });
      normalizedUpdates.name = safeName;
    }

    if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'email')) {
      const safeEmail = String(incomingUpdates.email || '').trim().toLowerCase();
      if (!safeEmail) return res.status(400).json({ error: 'Login ID/email is required' });
      const duplicateEmail = await dbGetAsync(
        'SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?',
        [safeEmail, id]
      );
      if (duplicateEmail) return res.status(400).json({ error: 'This login ID/email is already used' });
      normalizedUpdates.email = safeEmail;
    }

    const nextRole = incomingUpdates.role || existingUser.role;
    if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'role')) {
      normalizedUpdates.role = incomingUpdates.role;
    }

    if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'address')) {
      normalizedUpdates.address = String(incomingUpdates.address || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'phone')) {
      const safePhone = cleanPhone(incomingUpdates.phone || '');
      if (safePhone && !isValidIndianMobile(safePhone)) {
        return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
      }
      const duplicatePhone = safePhone
        ? await dbGetAsync('SELECT id FROM users WHERE phone = ? AND id <> ?', [safePhone, id])
        : null;
      if (duplicatePhone) {
        return res.status(400).json({ error: 'This mobile number is already linked to another account' });
      }
      normalizedUpdates.phone = safePhone;
      if (safePhone && isStaffRole(nextRole)) {
        normalizedUpdates.phone_verified = 1;
        normalizedUpdates.phone_verified_at = new Date().toISOString();
      } else if (!safePhone || nextRole === 'user') {
        normalizedUpdates.phone_verified = 0;
        normalizedUpdates.phone_verified_at = null;
      }
    } else if (Object.prototype.hasOwnProperty.call(incomingUpdates, 'role')) {
      if (existingUser.phone && isStaffRole(nextRole)) {
        normalizedUpdates.phone_verified = 1;
        normalizedUpdates.phone_verified_at = existingUser.phone_verified_at || new Date().toISOString();
      } else if (nextRole === 'user') {
        normalizedUpdates.phone_verified = 0;
        normalizedUpdates.phone_verified_at = null;
      }
    }

    const updateEntries = Object.entries(normalizedUpdates);
    if (!updateEntries.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClause = updateEntries.map(([field]) => `${field} = ?`).join(', ');
    const values = updateEntries.map(([, value]) => value);

    await dbRunAsync(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id]);
    const operationalBackup = await syncOperationalStateForResponse('admin-user-updated');
    res.json({
      message: 'User updated',
      operational_backup: operationalBackup,
      operational_warning: operationalBackup.warning
    });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This login ID/email is already used' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && Number(req.params.id) !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.get('SELECT id, email, name, phone, phone_verified, address, role FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(formatUserForClient(row));
  });
});

// Admin Product CRUD
app.post('/api/admin/products', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, price, mrp, image, images, category_id, stock, unit, discount_percent, dealer_price, distributor_price, warranty_years } = req.body;
  const warrantyYears = Math.max(1, Number(warranty_years || 5));
  db.run(`INSERT INTO products (name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price, warranty_years) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null, warrantyYears],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      saveProductImages(this.lastID, image, images, async (imageErr) => {
        if (imageErr) return res.status(500).json({ error: imageErr.message });
        const catalogBackup = await syncCatalogBackupForResponse('product-created');
        res.json({
          id: this.lastID,
          message: 'Product created',
          catalog_backup: catalogBackup,
          catalog_warning: catalogBackup.warning
        });
      });
    });
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, price, mrp, image, images, category_id, stock, unit, discount_percent, dealer_price, distributor_price, warranty_years } = req.body;
  const warrantyYears = Math.max(1, Number(warranty_years || 5));
  db.run(`UPDATE products SET name=?, description=?, price=?, mrp=?, image=?, category_id=?, stock=?, unit=?, discount_percent=?, dealer_price=?, distributor_price=?, warranty_years=? WHERE id=?`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null, warrantyYears, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      saveProductImages(req.params.id, image, images, async (imageErr) => {
        if (imageErr) return res.status(500).json({ error: imageErr.message });
        const catalogBackup = await syncCatalogBackupForResponse('product-updated');
        res.json({
          message: 'Product updated',
          catalog_backup: catalogBackup,
          catalog_warning: catalogBackup.warning
        });
      });
    });
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM product_images WHERE product_id = ?', [req.params.id], function(imageErr) {
    if (imageErr) return res.status(500).json({ error: imageErr.message });
    db.run(`DELETE FROM products WHERE id=?`, [req.params.id], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const catalogBackup = await syncCatalogBackupForResponse('product-deleted');
    res.json({
      message: 'Product deleted',
      catalog_backup: catalogBackup,
      catalog_warning: catalogBackup.warning
    });
  });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build
const buildPath = path.join(__dirname, '..', 'instamart-web', 'build');

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

app.use(express.static(buildPath, {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
}));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const restoreCatalogOnStartup = async () => {
  const restoreCandidates = [
    MEDIA_MANIFEST_EXPECTED_URL,
    MEDIA_MANIFEST_URL
  ].filter(Boolean).filter((url, index, list) => list.findIndex(item => normalizePublicUrl(item) === normalizePublicUrl(url)) === index);
  const restoreConfigWarning = catalogRestoreUrlWarning();
  if (restoreConfigWarning) console.warn(restoreConfigWarning);

  if (hasCatalogFtpConfig) {
    try {
      const result = await restoreMediaManifestFromFtp('startup-ftp-import');
      console.log(`Catalog manifest restored from FTP before startup: ${result.productCount} products, ${result.bannerCount} banners`);
      return;
    } catch (error) {
      console.warn(`Media manifest FTP restore skipped before startup: ${error.message}`);
    }
  }

  for (const restoreUrl of restoreCandidates) {
    try {
      const result = await restoreMediaManifestFromUrl(restoreUrl, 'startup-url-import');
      console.log(`Catalog manifest restored from ${restoreUrl} before startup: ${result.productCount} products, ${result.bannerCount} banners`);
      return;
    } catch (error) {
      console.warn(`Media manifest restore skipped for ${restoreUrl} before startup: ${error.message}`);
    }
  }
};

const startServer = async () => {
  try {
    await db.ready;
  } catch (error) {
    console.error(`Database startup failed: ${error.message}`);
    process.exit(1);
  }

  try {
    if (hasCatalogFtpConfig || MEDIA_MANIFEST_URL || MEDIA_MANIFEST_EXPECTED_URL) {
      await restoreCatalogOnStartup();
    }
  } catch (error) {
    console.warn(`Catalog startup restore failed: ${error.message}`);
  }

  try {
    if (hasOperationalStateFtpConfig) {
      await restoreOperationalStateOnStartup();
    }
  } catch (error) {
    console.warn(`Operational state startup restore failed: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`Instamart Clone API running on http://localhost:${PORT}`);
    console.log('Security hardening enabled for auth, orders, admin routes, and product search.');
  });
};

startServer();
