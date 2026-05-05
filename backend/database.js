const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const legacyDbPath = path.join(__dirname, 'instamart.db');
const defaultDataDir = process.env.SQLITE_DATA_DIR
  || process.env.RENDER_DISK_PATH
  || (fs.existsSync('/var/data') ? '/var/data' : __dirname);
fs.mkdirSync(defaultDataDir, { recursive: true });
const dbPath = process.env.SQLITE_DB_PATH || path.join(defaultDataDir, 'instamart.db');
if (dbPath !== legacyDbPath && !fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  fs.copyFileSync(legacyDbPath, dbPath);
}
const db = new sqlite3.Database(dbPath);
console.log(`Camigo SQLite database: ${dbPath}`);

const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) return reject(error);
    return resolve(this);
  });
});

const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => {
    if (error) return reject(error);
    return resolve(rows);
  });
});

const getColumnName = (definition) => String(definition || '').trim().split(/\s+/)[0].replace(/["'`]/g, '');

const ensureColumns = async (table, definitions = []) => {
  const rows = await allAsync(`PRAGMA table_info(${table})`);
  const existing = new Set(rows.map((row) => row.name));
  for (const definition of definitions) {
    const columnName = getColumnName(definition);
    if (!existing.has(columnName)) {
      await runAsync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
      existing.add(columnName);
    }
  }
};

let resolveReady;
let rejectReady;
const dbReady = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

db.serialize(async () => {
  try {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      plaintext_password TEXT,
      name TEXT,
      phone TEXT,
      address TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      image TEXT,
      sort_order INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      price REAL,
      mrp REAL,
      discount_percent REAL DEFAULT 0,
      dealer_price REAL,
      distributor_price REAL,
      warranty_years INTEGER DEFAULT 5,
      image TEXT,
      category_id INTEGER,
      stock INTEGER DEFAULT 100,
      unit TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total_amount REAL,
      final_amount REAL,
      gst_amount REAL,
      delivery_fee REAL,
      delivery_mode TEXT DEFAULT 'local',
      delivery_provider TEXT,
      delivery_estimate TEXT,
      delivery_distance_km REAL,
      delivery_weight_kg REAL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      address TEXT,
      customer_lat REAL,
      customer_lng REAL,
      customer_accuracy REAL,
      customer_location_locked_at INTEGER,
      installation_requested INTEGER DEFAULT 0,
      installation_fee REAL DEFAULT 0,
      installation_status TEXT DEFAULT 'not_requested',
      installer_id INTEGER,
      camera_count INTEGER DEFAULT 0,
      delivery_partner_id INTEGER,
      delivery_otp TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS category_banners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      image_url TEXT,
      width INTEGER DEFAULT 1200,
      height INTEGER DEFAULT 320,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price REAL,
      warranty_years INTEGER DEFAULT 5,
      warranty_start_at TEXT,
      warranty_end_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      discount_percent INTEGER,
      max_discount REAL,
      min_order REAL,
      usage_limit INTEGER,
      used_count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER UNIQUE,
      lat REAL,
      lng REAL,
      status TEXT DEFAULT 'available',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_partner_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      vehicle_type TEXT DEFAULT 'bike',
      vehicle_number TEXT,
      license_number TEXT,
      hub_id INTEGER,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (hub_id) REFERENCES hubs(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS hubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      map_url TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      message TEXT,
      target TEXT DEFAULT 'customer',
      personalize INTEGER DEFAULT 0,
      product_id INTEGER,
      image_url TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token TEXT UNIQUE,
      platform TEXT DEFAULT 'android',
      app_target TEXT DEFAULT 'customer',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS warranty_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      order_id INTEGER,
      order_item_id INTEGER,
      product_id INTEGER,
      serial_number TEXT,
      installer_name TEXT,
      purchase_use_case TEXT,
      notes TEXT,
      status TEXT DEFAULT 'registered',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (order_item_id) REFERENCES order_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      UNIQUE(order_item_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS service_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      order_id INTEGER,
      order_item_id INTEGER,
      product_id INTEGER,
      ticket_type TEXT DEFAULT 'support',
      title TEXT,
      description TEXT,
      contact_phone TEXT,
      preferred_slot TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (order_item_id) REFERENCES order_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await ensureColumns('products', [
      'discount_percent REAL DEFAULT 0',
      'dealer_price REAL',
      'distributor_price REAL',
      'warranty_years INTEGER DEFAULT 5'
    ]);
    await ensureColumns('users', [
      'phone_verified INTEGER DEFAULT 0',
      'phone_verified_at TEXT'
    ]);
    await ensureColumns('order_items', [
      'warranty_years INTEGER DEFAULT 5',
      'warranty_start_at TEXT',
      'warranty_end_at TEXT'
    ]);
    await ensureColumns('orders', [
      'customer_accuracy REAL',
      'customer_location_locked_at INTEGER',
      'installation_requested INTEGER DEFAULT 0',
      'installation_fee REAL DEFAULT 0',
      'installation_status TEXT DEFAULT "not_requested"',
      'installer_id INTEGER',
      'camera_count INTEGER DEFAULT 0',
      'delivery_partner_id INTEGER',
      'gst_amount REAL',
      'delivery_fee REAL',
      'delivery_mode TEXT DEFAULT "local"',
      'delivery_provider TEXT',
      'delivery_estimate TEXT',
      'delivery_distance_km REAL',
      'delivery_weight_kg REAL',
      'payment_status TEXT DEFAULT "created"',
      'razorpay_order_id TEXT',
      'razorpay_payment_id TEXT',
      'razorpay_signature TEXT',
      'payment_verified_at TEXT',
      'uber_direct_order_id TEXT',
      'uber_tracking_url TEXT',
      'uber_status TEXT',
      'uber_courier_name TEXT',
      'uber_courier_phone TEXT',
      'uber_last_event_at TEXT',
      'manual_dispatch_provider TEXT',
      'manual_dispatch_status TEXT DEFAULT "not_booked"',
      'manual_dispatch_reference TEXT',
      'manual_dispatch_notes TEXT',
      'manual_dispatch_updated_at TEXT',
      'delhivery_waybill TEXT',
      'delhivery_status TEXT',
      'delhivery_reference TEXT',
      'delhivery_last_event_at TEXT'
    ]);
    await ensureColumns('notifications', [
      'personalize INTEGER DEFAULT 0',
      'product_id INTEGER',
      'image_url TEXT',
      'user_id INTEGER'
    ]);
    await ensureColumns('warranty_registrations', [
      'serial_number TEXT',
      'installer_name TEXT',
      'purchase_use_case TEXT',
      'notes TEXT',
      'status TEXT DEFAULT "registered"',
      'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ]);
    await ensureColumns('service_tickets', [
      'ticket_type TEXT DEFAULT "support"',
      'title TEXT',
      'description TEXT',
      'contact_phone TEXT',
      'preferred_slot TEXT',
      'status TEXT DEFAULT "open"',
      'priority TEXT DEFAULT "normal"',
      'resolution_notes TEXT',
      'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    ]);
  db.run(`UPDATE order_items
          SET warranty_years = COALESCE(warranty_years, 5),
              warranty_start_at = COALESCE(warranty_start_at, (SELECT created_at FROM orders WHERE orders.id = order_items.order_id)),
              warranty_end_at = COALESCE(warranty_end_at, datetime((SELECT created_at FROM orders WHERE orders.id = order_items.order_id), '+' || COALESCE(warranty_years, 5) || ' years'))
          WHERE warranty_start_at IS NULL OR warranty_end_at IS NULL`);
  db.run(`INSERT INTO product_images (product_id, image_url, sort_order)
          SELECT p.id, p.image, 0
          FROM products p
          WHERE COALESCE(TRIM(p.image), '') <> ''
            AND NOT EXISTS (
              SELECT 1 FROM product_images pi
              WHERE pi.product_id = p.id AND pi.image_url = p.image
            )`);

  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  db.run(`INSERT OR IGNORE INTO users (id, email, password, plaintext_password, name, phone, address, role) VALUES 
    (1, 'user@test.com', ?, 'password123', 'Test User', '9876543210', '123 Main St, Bhubaneswar', 'user'),
    (2, 'admin@instamart.com', ?, 'admin123', 'Admin User', '9876543211', 'Admin Office, Odisha', 'admin'),
    (3, 'victim@test.com', ?, 'password123', 'Victim User', '9876543212', '456 Oak Ave, Cuttack', 'user'),
    (4, 'dealer@test.com', ?, 'password123', 'Dealer User', '9876543213', '789 Trade Center, Bhubaneswar', 'dealer'),
    (5, 'distributor@test.com', ?, 'password123', 'Distributor User', '9876543214', '101 Industrial Zone, Cuttack', 'distributor'),
    (6, 'delivery@test.com', ?, 'password123', 'Delivery Partner', '9876543215', 'Bhubaneswar Delivery Hub', 'delivery_partner'),
    (7, 'installer@test.com', ?, 'password123', 'Installer Partner', '9876543216', 'Bhubaneswar Service Hub', 'installer')`,
    [hashedPassword, adminPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword]);

  db.run(`UPDATE users
          SET phone = '', phone_verified = 0, phone_verified_at = NULL
          WHERE email IN (
            'user@test.com',
            'admin@instamart.com',
            'victim@test.com',
            'dealer@test.com',
            'distributor@test.com',
            'delivery@test.com',
            'installer@test.com'
          )
          AND phone LIKE '987654321%'`);

  db.run(`INSERT OR IGNORE INTO hubs (id, name, address, lat, lng, map_url, active) VALUES
    (1, 'First Hub - CGI CCTV CAMERA INDIA H.O', 'CGI CCTV CAMERA INDIA H.O, Bhubaneswar, Odisha', 20.34986, 85.82418, 'https://share.google/UtXmTRALSt0cZk0gZ', 1)`);

  db.run(`INSERT OR IGNORE INTO delivery_partner_details (id, user_id, vehicle_type, vehicle_number, license_number, hub_id, active) VALUES
    (1, 6, 'bike', 'OD-02-CAMIGO', 'DL-DEMO-001', 1, 1),
    (2, 7, 'bike', 'OD-02-INSTALL', 'DL-INSTALL-001', 1, 1)`);

  db.run(`INSERT OR IGNORE INTO categories (id, name, image, sort_order) VALUES 
    (1, 'Night Color AHD Cameras', '/images/ahd.jpg', 1),
    (2, 'IP Cameras', '/images/ip.jpg', 2),
    (3, 'PTZ Cameras', '/images/ptz.jpg', 3),
    (4, 'DVR Recorders', '/images/dvr.jpg', 4),
    (5, 'NVR Recorders', '/images/nvr.jpg', 5),
    (6, 'PoE Switches', '/images/poe.jpg', 6),
    (7, 'SMPS Power Supplies', '/images/smps.jpg', 7),
    (8, 'Accessories', '/category-real/accessories.jpg', 8)`);

  db.run(`INSERT OR IGNORE INTO products (id, name, description, price, mrp, image, category_id, stock, unit) VALUES 
    (1, 'CGI-HB3E 3MP AHD Bullet', '3MP Progressive Scan CMOS, 2304x1296, Night Color Vision, 30M Smart IR, IP67 Weatherproof, H.265+', 1850, 2499, '/images/cgi-hb3e.jpg', 1, 50, '1 Unit'),
    (2, 'CGI-HD3E 3MP AHD Dome', '3MP Progressive Scan CMOS, 2304x1296, Night Color Vision, 30M Smart IR, IP67 Weatherproof, H.265+', 1750, 2399, '/images/cgi-hd3e.jpg', 1, 50, '1 Unit'),
    (3, 'CGI-HB3H 3MP AHD Bullet ECO', '3MP Full HD, Fixed 3.6mm Lens, Full-Color White LED, AHD/TVI/CVI/CVBS, IP67 Rated', 1650, 2199, '/images/cgi-hb3h.jpg', 1, 50, '1 Unit'),
    (4, 'CGI-HD5 5MP AHD Dome', '5MP Ultra HD, Full-Color Night Vision White LED, Fixed Lens 3.6mm/6mm, AHD/TVI/CVI/CVBS', 2450, 3299, '/images/cgi-hd5.jpg', 1, 40, '1 Unit'),
    (5, 'CGI-HB5 5MP AHD Bullet', '5MP Ultra HD, Full-Color Night Vision White LED, Fixed Lens 3.6mm/6mm, IP67 Rated', 2550, 3399, '/images/cgi-hb5.jpg', 1, 40, '1 Unit'),
    (6, 'CGI-IPB3 3MP IP Bullet', '3MP Full HD, Full-Color Night Vision White LED, AI Human Detection, IP67, DC 12V or PoE', 2250, 2999, '/images/cgi-ipb3.jpg', 2, 50, '1 Unit'),
    (7, 'CGI-IPD3 3MP IP Dome', '3MP Full HD, Full-Color Night Vision, AI Human Detection, Metal Dome, DC 12V or PoE', 2150, 2899, '/images/cgi-ipd3.jpg', 2, 50, '1 Unit'),
    (8, 'CGI-IPB5 5MP IP Bullet', '5MP Ultra HD 4K, Full-Color Night Vision White LED, AI Human Detection, IP67, DC 12V or PoE', 3250, 4299, '/images/cgi-ipb5.jpg', 2, 40, '1 Unit'),
    (9, 'CGI-IPD5 5MP IP Dome', '5MP Ultra HD, Full-Color Night Vision White LED, AI Human Detection, Metal Dome, DC 12V or PoE', 3150, 4199, '/images/cgi-ipd5.jpg', 2, 40, '1 Unit'),
    (10, 'CGI-IPD8 8MP IP Dome', '8MP 4K Ultra HD, Full-Color Night Vision White LED, AI Human Detection, Metal Dome, DC 12V or PoE', 4850, 6499, '/images/cgi-ipd8.jpg', 2, 30, '1 Unit'),
    (11, 'CGI-IPB8 8MP IP Bullet', '8MP 4K Ultra HD, Full-Color Night Vision, AI Human Detection, Sturdy Metal Body, DC 12V or PoE', 4950, 6599, '/images/cgi-ipb8.jpg', 2, 30, '1 Unit'),
    (12, 'CGI-IPBB8 8MP Big Bullet', '8MP 3840x2160, 1/2.8" CMOS, 7mm Fixed Lens, 80-100M Smart IR, Human/Vehicle/Face Detection', 5250, 6999, '/images/cgi-ipbb8.jpg', 2, 25, '1 Unit'),
    (13, 'CGI-IPFED5 5MP Fisheye Dome', '5MP 2592x1944, 1.4mm/1.8mm Fisheye Lens, 360 Panoramic View, Built-in Microphone', 4850, 6499, '/images/cgi-ipfed5.jpg', 2, 20, '1 Unit'),
    (14, 'CGI-IPBVF5 5MP Verifocal Bullet', '5MP 2592x1944, 2.7-13.5mm Motorized Verifocal 5X Zoom, 60-80M Smart IR, Built-in Mic', 5650, 7499, '/images/cgi-ipbvf5.jpg', 2, 20, '1 Unit'),
    (15, 'CGI-PTZ36X4 4MP PTZ 36X', '4MP Ultra HD, 36X Optical Zoom, 150M Night Vision, 360 Pan/Tilt, AI Auto-Tracking, IP66', 18500, 24999, '/images/cgi-ptz36x4.jpg', 3, 15, '1 Unit'),
    (16, 'CGI-PTZ36X5 5MP PTZ 36X', '5MP Ultra HD, 36X Optical Zoom, 200M Night Vision, 360 Pan/Tilt, AI Auto-Tracking, IP66', 22500, 29999, '/images/cgi-ptz36x5.jpg', 3, 15, '1 Unit'),
    (17, 'CGI-PTZ36X4P 4MP PTZ PoE', '4MP Ultra HD PoE, 36X Optical Zoom, 150M Night Vision, 360 Pan/Tilt, AI Auto-Tracking, IP66', 19500, 25999, '/images/cgi-ptz36x4p.jpg', 3, 15, '1 Unit'),
    (18, 'CGI-PTZ36X5P 5MP PTZ PoE', '5MP Ultra HD PoE, 36X Optical Zoom, 200M Night Vision, 360 Pan/Tilt, AI Auto-Tracking, IP66', 23500, 30999, '/images/cgi-ptz36x5p.jpg', 3, 15, '1 Unit'),
    (19, 'CGI-PTZ4G 4G PT Camera', '4G SIM Support, HD Clarity, 360 Pan/Tilt, Auto-Tracking, Two-Way Audio, IP66, SD/Cloud Storage', 12500, 16999, '/images/cgi-ptz4g.jpg', 3, 20, '1 Unit'),
    (20, 'CGI-SOLCAM18 4G Solar PTZ', '4G SIM, Solar + 18000mAh Battery, 360 View, Motion Auto-Tracking, Two-Way Talk, IP66', 18500, 24999, '/images/cgi-solcam18.jpg', 3, 15, '1 Unit'),
    (21, 'CGI-DVR4-5MP 4CH DVR', '4CH 5MP HD Recording, H.265+ Compression, AHD/TVI/CVI/CVBS/IP Hybrid, Motion Alerts, USB Backup', 3250, 4299, '/images/cgi-dvr4.jpg', 4, 30, '1 Unit'),
    (22, 'CGI-DVR8-5MP 8CH DVR', '8CH 5MP HD Recording, H.265+ Compression, AHD/TVI/CVI/CVBS/IP Hybrid, Motion Alerts, USB Backup', 4250, 5699, '/images/cgi-dvr8.jpg', 4, 30, '1 Unit'),
    (23, 'CGI-DVR16-5MP 16CH DVR', '16CH 5MP HD Recording, H.265+ Compression, AHD/TVI/CVI/CVBS/IP Hybrid, Metal Body, 4K HDMI', 6250, 8399, '/images/cgi-dvr16.jpg', 4, 25, '1 Unit'),
    (24, 'CGI-DVR32-5MP 32CH DVR', '32CH 5MP HD Recording, H.265+ Compression, AHD/TVI/CVI/CVBS/IP Hybrid, Metal Body, 4K HDMI', 8250, 10999, '/images/cgi-dvr32.jpg', 4, 20, '1 Unit'),
    (25, 'CGI-DVR64-5MP 64CH DVR', '64CH 5MP HD Recording, H.265+ Compression, AHD/TVI/CVI/CVBS/IP Hybrid, Metal Body, 4K HDMI', 11250, 14999, '/images/cgi-dvr64.jpg', 4, 15, '1 Unit'),
    (26, 'CGI-NVR4-5MP 4CH NVR', '4CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 3850, 5199, '/images/cgi-nvr4.jpg', 5, 30, '1 Unit'),
    (27, 'CGI-NVR8-5MP 8CH NVR', '8CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 4850, 6499, '/images/cgi-nvr8.jpg', 5, 30, '1 Unit'),
    (28, 'CGI-NVR16-5MP 16CH NVR', '16CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 6850, 9199, '/images/cgi-nvr16.jpg', 5, 25, '1 Unit'),
    (29, 'CGI-NVR32-5MP 32CH NVR', '32CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 9250, 12399, '/images/cgi-nvr32.jpg', 5, 20, '1 Unit'),
    (30, 'CGI-NVR64-5MP 64CH NVR', '64CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 13250, 17699, '/images/cgi-nvr64.jpg', 5, 15, '1 Unit'),
    (31, 'CGI-NVR128-5MP 128CH NVR', '128CH 5MP IP Recording, H.265+ Compression, ONVIF Support, Motion Alerts, USB Backup, Plastic Body', 18500, 24699, '/images/cgi-nvr128.jpg', 5, 10, '1 Unit'),
    (32, 'CGI-POE4-100 4CH PoE Switch', '4 PoE + 2 Uplink Ports, 100M Transmission, Stable PoE Output, Overload Protection, Plug & Play', 1850, 2499, '/images/cgi-poe4.jpg', 6, 40, '1 Unit'),
    (33, 'CGI-POE8-100 8CH PoE Switch', '8 PoE + 2 Uplink Ports, 100M Transmission, Stable PoE Output, Overload Protection, Plug & Play', 2850, 3799, '/images/cgi-poe8.jpg', 6, 35, '1 Unit'),
    (34, 'CGI-POE16-100 16CH PoE Switch', '16 PoE + 2 Uplink Ports, 100M Transmission, Stable PoE Output, Overload Protection, Plug & Play', 4850, 6499, '/images/cgi-poe16.jpg', 6, 25, '1 Unit'),
    (35, 'CGI-POE4-1000 4CH Giga PoE', '4 PoE + 2 Uplink Ports, 1000Mbps Gigabit, Long-Distance Transmission, Efficient PoE, Plug & Play', 2250, 2999, '/images/cgi-poe4g.jpg', 6, 35, '1 Unit'),
    (36, 'CGI-POE8-1000 8CH Giga PoE', '8 PoE + 2 Uplink Ports, 1000Mbps Gigabit, Long-Distance Transmission, Efficient PoE, Plug & Play', 3250, 4299, '/images/cgi-poe8g.jpg', 6, 30, '1 Unit'),
    (37, 'CGI-POE16-1000 16CH Giga PoE', '16 PoE + 2 Uplink Ports, 1000Mbps Gigabit, Long-Distance Transmission, Efficient PoE, Plug & Play', 5850, 7799, '/images/cgi-poe16g.jpg', 6, 20, '1 Unit'),
    (38, '4CH SMPS 8Amp Power Supply', '12V/8A Stable Output, Handles up to 4 Cameras, Low Heat High Conversion, Overload & Short Circuit Protection', 850, 1199, '/images/cgi-smps4.jpg', 7, 50, '1 Unit'),
    (39, '8CH SMPS 15Amp Power Supply', '12V/15A Stable Output, Handles up to 8 Cameras, Low Heat High Conversion, Overload & Short Circuit Protection', 1250, 1699, '/images/cgi-smps8.jpg', 7, 45, '1 Unit'),
    (40, '16CH SMPS 25Amp Power Supply', '12V/25A Stable Output, Handles up to 16 Cameras, Low Heat High Conversion, Overload & Short Circuit Protection', 1850, 2499, '/images/cgi-smps16.jpg', 7, 35, '1 Unit'),
    (41, 'BNC Connector Pack', 'Pack of CCTV BNC connectors for camera cabling and quick installation.', 180, 249, '/images/cgi-accessory-bnc.jpg', 8, 100, '10 pcs'),
    (42, 'DC Connector Pack', 'Male/female DC power connector set for CCTV camera power lines.', 160, 229, '/images/cgi-accessory-dc.jpg', 8, 100, '10 pcs'),
    (43, 'CCTV Cable Roll 90m', 'High quality CCTV cable roll for camera installation and DVR/NVR wiring.', 1350, 1899, '/images/cgi-accessory-cable.jpg', 8, 40, '90 m'),
    (44, 'Camera Junction Box', 'Weather protected junction box for bullet and dome camera mounting.', 280, 399, '/images/cgi-accessory-box.jpg', 8, 80, '1 Unit')`);

  const march2026TradePrices = [
    [1, 873.20, 814.20],
    [2, 873.20, 814.20],
    [4, 1171.39, 1111.56],
    [5, 1171.39, 1111.56],
    [10, 3299.28, 3181.28],
    [11, 3300.13, 3181.28],
    [12, 3663.90, 3545.90],
    [13, 3032.60, 2891.00],
    [16, 33870.94, 31510.94],
    [19, 3128.18, 3010.18],
    [20, 5428.00, 5310.00],
    [21, 2684.50, 2566.50],
    [22, 2920.50, 2802.50],
    [23, 5192.00, 5074.00],
    [27, 3127.00, 3009.00],
    [28, 3481.00, 3363.00],
    [29, 7316.00, 7198.00],
    [30, 21122.00, 21004.00],
    [32, 1180.00, 1121.00],
    [33, 1475.00, 1357.00],
    [34, 4189.00, 4071.00],
    [38, 359.90, 330.40],
    [39, 401.20, 377.60],
    [41, 168.60, 156.80],
    [42, 75.50, 70.80]
  ];

  db.get('SELECT value FROM app_settings WHERE setting_key = ?', ['trade_prices_march_2026'], (settingErr, row) => {
    if (settingErr || row) return;
    march2026TradePrices.forEach(([id, dealerPrice, distributorPrice]) => {
      db.run(
        `UPDATE products
         SET dealer_price = ?, distributor_price = ?
         WHERE id = ?`,
        [dealerPrice, distributorPrice, id]
      );
    });
    db.run(
      'INSERT INTO app_settings (setting_key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      ['trade_prices_march_2026', 'applied']
    );
  });

  db.run(`INSERT OR IGNORE INTO promo_codes (id, code, discount_percent, max_discount, min_order, usage_limit) VALUES 
    (1, 'SAVE10', 10, 500, 5000, 100),
    (2, 'FIRST50', 50, 1000, 10000, 1),
    (3, 'CGI99', 99, 5000, 5000, 99999)`);
    resolveReady();
  } catch (error) {
    rejectReady(error);
  }
});

module.exports = db;
module.exports.ready = dbReady;
