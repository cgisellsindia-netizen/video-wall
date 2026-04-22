const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(path.join(__dirname, 'backend', 'instamart.db'));

db.serialize(() => {
  db.run(`INSERT OR IGNORE INTO categories (id, name, image, sort_order) VALUES (8, 'Accessories', '/category-real/accessories.jpg', 8)`);
  const products = [
    [41, 'BNC Connector Pack', 'Pack of CCTV BNC connectors for camera cabling and quick installation.', 180, 249, '/images/cgi-accessory-bnc.jpg', 8, 100, '10 pcs'],
    [42, 'DC Connector Pack', 'Male/female DC power connector set for CCTV camera power lines.', 160, 229, '/images/cgi-accessory-dc.jpg', 8, 100, '10 pcs'],
    [43, 'CCTV Cable Roll 90m', 'High quality CCTV cable roll for camera installation and DVR/NVR wiring.', 1350, 1899, '/images/cgi-accessory-cable.jpg', 8, 40, '90 m'],
    [44, 'Camera Junction Box', 'Weather protected junction box for bullet and dome camera mounting.', 280, 399, '/images/cgi-accessory-box.jpg', 8, 80, '1 Unit']
  ];
  const stmt = db.prepare(`INSERT OR IGNORE INTO products (id, name, description, price, mrp, image, category_id, stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  products.forEach(p => stmt.run(p));
  stmt.finalize();
});

db.close(() => console.log('Accessories seeded'));
