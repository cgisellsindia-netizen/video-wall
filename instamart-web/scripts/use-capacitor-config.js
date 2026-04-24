const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const allowed = new Set(['customer', 'delivery', 'installer']);

if (!allowed.has(target)) {
  console.error('Usage: node scripts/use-capacitor-config.js <customer|delivery|installer>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const source = path.join(root, `capacitor.${target}.config.json`);
const destination = path.join(root, 'capacitor.config.json');

fs.copyFileSync(source, destination);
console.log(`Using Capacitor config: ${path.basename(source)}`);
