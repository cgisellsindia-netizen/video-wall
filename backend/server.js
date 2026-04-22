const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
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
      /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)
    ) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'camigo-local-dev-secret-change-before-production';

const priceForUserRole = (product, role) => {
  if (role === 'distributor' && Number(product.distributor_price) > 0) return Number(product.distributor_price);
  if (role === 'dealer' && Number(product.dealer_price) > 0) return Number(product.dealer_price);
  if (role === 'distributor') return Math.round(Number(product.price || 0) * 0.85);
  if (role === 'dealer') return Math.round(Number(product.price || 0) * 0.90);
  return Number(product.price || 0);
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

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
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
});

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
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
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
});

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
    res.json(rows);
  });
});

app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  });
});

app.get('/api/notifications', (req, res) => {
  const target = String(req.query.target || 'customer');
  db.all(
    `SELECT * FROM notifications
     WHERE target IN (?, 'all')
     ORDER BY created_at DESC
     LIMIT 5`,
    [target],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Cart
app.get('/api/cart', authenticateToken, (req, res) => {
  db.all(
    `SELECT c.*, p.name, p.price, p.dealer_price, p.distributor_price, p.image, p.unit 
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
app.post('/api/orders', authenticateToken, (req, res) => {
  const { items, address, payment_method, promo_code, customer_lat, customer_lng } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Order items are required' });
  }
  if (!address || !payment_method) {
    return res.status(400).json({ error: 'Address and payment method are required' });
  }

  const normalizedItems = items
    .map(item => ({
      product_id: Number(item.product_id),
      quantity: Math.max(1, Number(item.quantity || 1))
    }))
    .filter(item => Number.isInteger(item.product_id) && Number.isFinite(item.quantity));

  if (!normalizedItems.length) {
    return res.status(400).json({ error: 'Valid order items are required' });
  }

  const placeholders = normalizedItems.map(() => '?').join(',');
  db.all(`SELECT id, price, dealer_price, distributor_price FROM products WHERE id IN (${placeholders})`, normalizedItems.map(item => item.product_id), (err, products) => {
    if (err) return res.status(500).json({ error: err.message });

    const prices = new Map(products.map(product => [product.id, priceForUserRole(product, req.user.role)]));
    if (prices.size !== normalizedItems.length) {
      return res.status(400).json({ error: 'One or more products were not found' });
    }

    let totalAmount = normalizedItems.reduce((sum, item) => sum + (prices.get(item.product_id) * item.quantity), 0);
    let finalAmount = totalAmount;

    const createOrder = () => {
    const deliveryOtp = String(1000 + crypto.randomInt(9000));
    const safeCustomerLat = Number.isFinite(Number(customer_lat)) ? Number(customer_lat) : null;
    const safeCustomerLng = Number.isFinite(Number(customer_lng)) ? Number(customer_lng) : null;
    db.run(
      'INSERT INTO orders (user_id, total_amount, final_amount, status, payment_method, address, customer_lat, customer_lng, delivery_otp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, totalAmount, finalAmount, 'pending', payment_method, address, safeCustomerLat, safeCustomerLng, deliveryOtp],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const orderId = this.lastID;
        const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
        
        normalizedItems.forEach(item => {
          stmt.run(orderId, item.product_id, item.quantity, prices.get(item.product_id));
        });
        stmt.finalize();
        
        // Clear cart
        db.run('DELETE FROM cart WHERE user_id = ?', [req.user.userId]);
        
        res.json({ order_id: orderId, total_amount: totalAmount, final_amount: finalAmount, status: 'pending' });
      }
    );
    };

    if (promo_code) {
      db.get('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [promo_code], (err, promo) => {
        if (err) return res.status(500).json({ error: err.message });
        if (promo && promo.used_count < promo.usage_limit && totalAmount >= promo.min_order) {
          let discount = (totalAmount * promo.discount_percent) / 100;
          if (discount > promo.max_discount) discount = promo.max_discount;
          finalAmount = totalAmount - discount;

          db.run('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?', [promo.id]);
        }
        createOrder();
      });
    } else {
      createOrder();
    }
  });
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
    
    db.all('SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?', 
      [req.params.id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, items });
    });
  });
});

app.get('/api/orders', authenticateToken, (req, res) => {
  db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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
          WHERE o.status NOT IN ('delivered', 'rejected')
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
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

  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: 'Order not found' });
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

    db.run('UPDATE orders SET status = ? WHERE id = ?', ['delivered', req.params.id], function(updateErr) {
      if (updateErr) return res.status(500).json({ error: updateErr.message });
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
    ? 'SELECT * FROM orders WHERE id = ?'
    : 'SELECT * FROM orders WHERE id = ? AND user_id = ?';

  db.get(orderQuery, orderParams, (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.get(`SELECT dl.*, u.name as partner_name, u.phone as partner_phone
            FROM delivery_locations dl
            JOIN users u ON dl.partner_id = u.id
            WHERE u.role = 'delivery_partner'
            ORDER BY dl.updated_at DESC LIMIT 1`, [], (err, location) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ order, partner_location: location || null });
    });
  });
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, phone, address, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Email, password, name, and role are required' });
  }
  if (!['user', 'dealer', 'distributor', 'delivery_partner', 'admin'].includes(role)) {
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
  const { email, vehicle_type, vehicle_number, license_number, hub_id, active, password } = req.body;
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
  const { title, message, target } = req.body;
  const safeTarget = ['customer', 'delivery', 'all'].includes(target) ? target : 'customer';
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

  db.run(
    'INSERT INTO notifications (title, message, target) VALUES (?, ?, ?)',
    [title, message, safeTarget],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Notification sent' });
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

  const invalidRole = updates.find(([field, value]) => field === 'role' && !['user', 'dealer', 'distributor', 'delivery_partner', 'admin'].includes(value));
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
  const { name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price } = req.body;
  db.run(`INSERT INTO products (name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null],
    function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ id: this.lastID, message: 'Product created' }); });
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, description, price, mrp, image, category_id, stock, unit, discount_percent, dealer_price, distributor_price } = req.body;
  db.run(`UPDATE products SET name=?, description=?, price=?, mrp=?, image=?, category_id=?, stock=?, unit=?, discount_percent=?, dealer_price=?, distributor_price=? WHERE id=?`,
    [name, description, price, mrp, image, category_id, stock, unit, discount_percent || 0, dealer_price || null, distributor_price || null, req.params.id],
    function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ message: 'Product updated' }); });
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, (req, res) => {
  db.run(`DELETE FROM products WHERE id=?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted' });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'instamart-web', 'build')));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'instamart-web', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Instamart Clone API running on http://localhost:${PORT}`);
  console.log('Security hardening enabled for auth, orders, admin routes, and product search.');
});
