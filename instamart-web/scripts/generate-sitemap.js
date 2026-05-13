const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

const storefrontUrl = (process.env.REACT_APP_STOREFRONT_URL || 'https://getcamigo.in').replace(/\/+$/, '');
const apiBase = (process.env.REACT_APP_API_URL || 'https://camigo-store.onrender.com/api').replace(/\/+$/, '');

const staticRoutes = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/saved', changefreq: 'weekly', priority: '0.6' },
  { path: '/orders', changefreq: 'weekly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/about-camigo', changefreq: 'monthly', priority: '0.6' },
  { path: '/cctv-camera-bhubaneswar', changefreq: 'weekly', priority: '0.9' },
  { path: '/cctv-installation-bhubaneswar', changefreq: 'weekly', priority: '0.9' },
  { path: '/security-camera-odisha', changefreq: 'weekly', priority: '0.8' },
  { path: '/cctv-dealer-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/ip-camera-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/ptz-camera-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/dvr-nvr-dealer-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/home-cctv-installation-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/office-cctv-installation-bhubaneswar', changefreq: 'weekly', priority: '0.8' },
  { path: '/shipping-policy', changefreq: 'monthly', priority: '0.5' },
  { path: '/installation-policy', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy-policy', changefreq: 'monthly', priority: '0.4' },
  { path: '/returns-policy', changefreq: 'monthly', priority: '0.4' },
  { path: '/terms-of-service', changefreq: 'monthly', priority: '0.4' }
];

const xmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildUrlNode = ({ loc, changefreq, priority, lastmod }) => {
  const lastmodLine = lastmod ? `\n    <lastmod>${xmlEscape(lastmod)}</lastmod>` : '';
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmodLine}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
};

const fallbackSitemap = () => {
  const urls = staticRoutes.map((route) => ({
    ...route,
    loc: `${storefrontUrl}${route.path === '/' ? '/' : route.path}`
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(buildUrlNode).join('\n')}\n</urlset>\n`;
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
};

const buildDynamicSitemap = async () => {
  const [products, categories] = await Promise.all([
    fetchJson(`${apiBase}/products`),
    fetchJson(`${apiBase}/categories`)
  ]);

  const now = new Date().toISOString();
  const urls = [
    ...staticRoutes.map((route) => ({
      ...route,
      loc: `${storefrontUrl}${route.path === '/' ? '/' : route.path}`,
      lastmod: now
    })),
    ...categories.map((category) => ({
      loc: `${storefrontUrl}/category/${category.id}`,
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: now
    })),
    ...products.map((product) => ({
      loc: `${storefrontUrl}/product/${product.id}`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: now
    }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(buildUrlNode).join('\n')}\n</urlset>\n`;
};

async function main() {
  let xml;
  try {
    xml = await buildDynamicSitemap();
    console.log(`Generated sitemap with live product and category URLs from ${apiBase}`);
  } catch (error) {
    console.warn(`Could not fetch live catalog for sitemap generation: ${error.message}`);
    xml = fallbackSitemap();
    console.warn('Wrote fallback sitemap with static routes only.');
  }

  fs.writeFileSync(sitemapPath, xml, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
