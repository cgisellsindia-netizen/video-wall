import re

with open(r'C:\temp\instamart-clone\backend\server.js', 'r') as f:
    content = f.read()

# Add path import
content = content.replace(
    "const bcrypt = require('bcryptjs');\nconst db = require('./database');",
    "const bcrypt = require('bcryptjs');\nconst path = require('path');\nconst db = require('./database');"
)

# Add static serving before app.listen
old_listen = "app.listen(PORT, () => {"
new_listen = """// Serve static files from React build
app.use(express.static(path.join(__dirname, '..', 'instamart-web', 'build')));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'instamart-web', 'build', 'index.html'));
});

app.listen(PORT, () => {"""

content = content.replace(old_listen, new_listen)

with open(r'C:\temp\instamart-clone\backend\server.js', 'w') as f:
    f.write(content)

print('Patched:', 'path = require' in content and 'instamart-web' in content)
