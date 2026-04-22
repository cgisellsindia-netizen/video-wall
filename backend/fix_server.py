import pathlib

f = pathlib.Path(r'C:\temp\instamart-clone\backend\server.js')
text = f.read_text()

# Replace login endpoint
old_login = """// VULNERABLE: SQL Injection in login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // VULNERABLE: String concatenation in SQL query
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  db.get(query, [], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
});"""

new_login = """// VULNERABLE: SQL Injection in login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // VULNERABLE: String concatenation in SQL query
  const query = `SELECT * FROM users WHERE email = '${email}' AND plaintext_password = '${password}'`;
  db.get(query, [], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
});"""

text = text.replace(old_login, new_login)

# Replace register endpoint
old_reg = """    'INSERT INTO users (email, password, name, phone, address) VALUES (?, ?, ?, ?, ?)',
    [email, hashedPassword, name, phone, address],"""

new_reg = """    'INSERT INTO users (email, password, plaintext_password, name, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
    [email, hashedPassword, password, name, phone, address],"""

text = text.replace(old_reg, new_reg)

f.write_text(text)
print('Patched:', 'plaintext_password' in text)
