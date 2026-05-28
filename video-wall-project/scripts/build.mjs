import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');

const projectId = process.env.VIDEO_WALL_PROJECT_ID || '';
const videoLinks = process.env.VIDEO_WALL_LINKS || '';

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const fileName of ['styles.css', 'app.js']) {
  fs.copyFileSync(path.join(srcDir, fileName), path.join(distDir, fileName));
}

const template = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const html = template.replace(
  '__VIDEO_WALL_CONFIG__',
  JSON.stringify({
    projectId,
    videoLinks
  })
);

fs.writeFileSync(path.join(distDir, 'index.html'), html);
console.log('Built video wall project into dist/');
