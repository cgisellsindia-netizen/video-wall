const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'camigo-local-dev-secret-change-before-production';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const hasRazorpayConfig = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BANNER_MODEL = process.env.OPENAI_BANNER_MODEL || 'gpt-4o-mini';
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
  if (!['upi', 'card'].includes(String(payment_method || '').toLowerCase())) {
    throw new Error('Only UPI and card payments are allowed');
  }

  const normalizedItems = normalizeOrderItems(items);
  if (!normalizedItems.length) {
    throw new Error('Valid order items are required');
  }

  const placeholders = normalizedItems.map(() => '?').join(',');
  const products = await dbAllAsync(
    `SELECT id, price, dealer_price, distributor_price, warranty_years, category_id
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
  const localAddress = isLocalServiceZone(safeCustomerLat, safeCustomerLng) || isLocalAddressText(address);
  const deliveryFee = taxableAmount > 2000 ? 0 : localAddress ? 40 : 120;
  const gstAmount = Math.round(taxableAmount * 0.18);
  const finalAmount = taxableAmount + gstAmount + deliveryFee + installationFee;

  return {
    normalizedItems,
    prices,
    warrantyYears,
    address,
    paymentMethod: String(payment_method).toLowerCase(),
    totalAmount,
    gstAmount,
    deliveryFee,
    installationRequested,
    installationFee,
    cameraCount,
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
      user_id, total_amount, final_amount, gst_amount, delivery_fee,
      installation_requested, installation_fee, installation_status, camera_count,
      status, payment_method, address, customer_lat, customer_lng, customer_accuracy,
      customer_location_locked_at, delivery_otp, payment_status, razorpay_order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      draft.totalAmount,
      draft.finalAmount,
      draft.gstAmount,
      draft.deliveryFee,
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
          images: gallery
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

  db.get('SELECT * FROM users WHERE email = ? OR phone = ?', [loginId, loginId], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    try {
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

app.post('/api/auth/login', loginUser);

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone, address } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(
    'INSERT INTO users (email, password, name, phone, address) VALUES (?, ?, ?, ?, ?)',
    [email, hashedPassword, name, phone, address],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'User registered successfully' });
    }
  );
});

// Backward-compatible aliases for cached app/web builds that may call auth without /api.
app.post('/auth/login', loginUser);

app.post('/auth/register', async (req, res) => {
  const { email, password, name, phone, address } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (email, password, name, phone, address) VALUES (?, ?, ?, ?, ?)',
    [email, hashedPassword, name, phone, address],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'User registered successfully' });
    }
  );
});

// Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Categories
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

app.post('/api/payments/razorpay/order', authenticateToken, async (req, res) => {
  if (!hasRazorpayConfig) {
    return res.status(503).json({ error: 'Razorpay is not configured on the server yet' });
  }
  try {
    const draft = await buildOrderDraft(req.user, req.body);
    const razorpayOrder = await callRazorpay('/v1/orders', {
      amount: Math.round(draft.finalAmount * 100),
      currency: 'INR',
      receipt: `camigo_${req.user.userId}_${Date.now()}`,
      notes: {
        customer_id: String(req.user.userId),
        payment_method: draft.paymentMethod,
        installation_requested: draft.installationRequested ? '1' : '0'
      }
    });
    const orderId = await createLocalOrderRecord({
      userId: req.user.userId,
      draft,
      status: 'payment_pending',
      paymentStatus: 'created',
      razorpayOrderId: razorpayOrder.id
    });
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
      customer: {
        name: req.user.name || 'Camigo Customer',
        email: req.user.email || '',
        contact: req.body.phone || ''
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
    await dbRunAsync('DELETE FROM cart WHERE user_id = ?', [req.user.userId]);

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
  db.all('SELECT id, email, name, phone, address, role, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/delivery/orders', authenticateToken, (req, res) => {
  if (!['delivery_partner', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Delivery partner access required' });
  }

  db.all(`SELECT o.*, u.name as user_name, u.phone as user_phone
          FROM orders o
          JOIN users u ON o.user_id = u.id
          WHERE o.payment_status = 'paid'
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
          WHERE o.payment_status = 'paid'
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
      res.json({ message: 'Location updated', lat: Number(lat), lng: Number(lng), status: status || 'on_delivery' });
    }
  );
});

app.get('/api/tracking/:orderId', authenticateToken, (req, res) => {
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

  db.get(orderQuery, orderParams, (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

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
      if (order.status === 'delivered') {
        return res.json({ order, partner, partner_location: null });
      }
      res.json({ order, partner: partner || location || null, partner_location: location || null });
    });
  });
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, phone, address, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Email, password, name, and role are required' });
  }
  if (!['user', 'dealer', 'distributor', 'delivery_partner', 'installer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    'INSERT INTO users (email, password, plaintext_password, name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [email, hashedPassword, password, name, phone, address, role],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, email, password, role, message: 'Login created' });
    }
  );
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, (req, res) => {
  db.all(`SELECT o.*, u.email, u.name as user_name 
          FROM orders o 
          JOIN users u ON o.user_id = u.id 
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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
      return res.json({
        generated,
        message: `AI generated ${generated.length} banner${generated.length === 1 ? '' : 's'}`
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
    res.json({ id: result.lastID, image_url: imageUrl, copy: ai, message: 'AI banner generated and saved' });
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
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Category banner added' });
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
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Category banner updated' });
    }
  );
});

app.delete('/api/admin/category-banners/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM category_banners WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Category banner deleted' });
  });
});

app.post('/api/admin/orders/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const order = await dbGetAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentStatus = String(order.status || '').toLowerCase();
    if (['cancelled', 'delivered'].includes(currentStatus)) {
      return res.status(400).json({ error: 'This order cannot be cancelled' });
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

  const saveDetails = () => {
    db.run(
      `INSERT INTO delivery_partner_details (user_id, vehicle_type, vehicle_number, license_number, hub_id, active)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         vehicle_type=excluded.vehicle_type,
         vehicle_number=excluded.vehicle_number,
         license_number=excluded.license_number,
         hub_id=excluded.hub_id,
         active=excluded.active`,
      [req.params.id, vehicle_type, vehicle_number || '', license_number || '', hub_id || null, active ? 1 : 0],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Delivery partner details updated' });
      }
    );
  };

  if (password && String(password).trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const updateUserLogin = async () => {
    const fields = [];
    const values = [];

    if (email) {
      fields.push('email = ?');
      values.push(String(email).trim());
    }

    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(String(phone || '').trim());
    }

    if (password) {
      fields.push('password = ?', 'plaintext_password = ?');
      values.push(await bcrypt.hash(String(password), 10), String(password));
    }

    if (!fields.length) {
      saveDetails();
      return;
    }

    db.run(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND role = ?`,
      [...values, req.params.id, 'delivery_partner'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'This login ID/email is already used' });
          }
          return res.status(500).json({ error: err.message });
        }
        if (!this.changes) return res.status(404).json({ error: 'Delivery partner not found' });
        saveDetails();
      }
    );
  };

  updateUserLogin();
});

app.post('/api/admin/hubs', authenticateToken, requireAdmin, (req, res) => {
  const { name, address, lat, lng, map_url, active } = req.body;
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'Hub name, latitude, and longitude are required' });
  }

  const saveHub = () => {
    db.run(
      'INSERT INTO hubs (name, address, lat, lng, map_url, active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address || '', Number(lat), Number(lng), map_url || '', active ? 1 : 0],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Hub added' });
      }
    );
  };

  if (active) db.run('UPDATE hubs SET active = 0', [], saveHub);
  else saveHub();
});

app.put('/api/admin/hubs/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, address, lat, lng, map_url, active } = req.body;
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'Hub name, latitude, and longitude are required' });
  }

  const updateHub = () => {
    db.run(
      'UPDATE hubs SET name=?, address=?, lat=?, lng=?, map_url=?, active=? WHERE id=?',
      [name, address || '', Number(lat), Number(lng), map_url || '', active ? 1 : 0, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Hub updated' });
      }
    );
  };

  if (active) db.run('UPDATE hubs SET active = 0 WHERE id != ?', [req.params.id], updateHub);
  else updateHub();
});

app.delete('/api/admin/hubs/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM hubs WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Hub deleted' });
  });
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
      res.json({ id: this.lastID, message: 'Notification sent', push: pushResult });
    }
  );
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const allowedFields = ['name', 'phone', 'address', 'role'];
  const updates = Object.entries(req.body).filter(([field]) => allowedFields.includes(field));

  if (!updates.length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const invalidRole = updates.find(([field, value]) => field === 'role' && !['user', 'dealer', 'distributor', 'delivery_partner', 'installer', 'admin'].includes(value));
  if (invalidRole) return res.status(400).json({ error: 'Invalid role' });

  const setClause = updates.map(([field]) => `${field} = ?`).join(', ');
  const values = updates.map(([, value]) => value);

  db.run(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User updated' });
  });
});

app.get('/api/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && Number(req.params.id) !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.get('SELECT id, email, name, phone, address, role FROM users WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// Admin Product CRUD
app.post('/api/admin/products', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, price, mrp, image, images, category_id, stock, unit, discount_percent, dealer_price, distributor_price } = req.body;
  db.run(`INSERT INTO products (name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      saveProductImages(this.lastID, image, images, (imageErr) => {
        if (imageErr) return res.status(500).json({ error: imageErr.message });
        res.json({ id: this.lastID, message: 'Product created' });
      });
    });
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, price, mrp, image, images, category_id, stock, unit, discount_percent, dealer_price, distributor_price } = req.body;
  db.run(`UPDATE products SET name=?, description=?, price=?, mrp=?, image=?, category_id=?, stock=?, unit=?, discount_percent=?, dealer_price=?, distributor_price=? WHERE id=?`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      saveProductImages(req.params.id, image, images, (imageErr) => {
        if (imageErr) return res.status(500).json({ error: imageErr.message });
        res.json({ message: 'Product updated' });
      });
    });
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run('DELETE FROM product_images WHERE product_id = ?', [req.params.id], function(imageErr) {
    if (imageErr) return res.status(500).json({ error: imageErr.message });
    db.run(`DELETE FROM products WHERE id=?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted' });
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

app.listen(PORT, () => {
  console.log(`Instamart Clone API running on http://localhost:${PORT}`);
  console.log('Security hardening enabled for auth, orders, admin routes, and product search.');
});
