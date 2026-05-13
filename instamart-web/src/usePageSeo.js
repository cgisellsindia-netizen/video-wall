import { useEffect } from 'react';

function ensureMeta(selector, attr, value) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement('meta');
    const match = selector.match(/\[(.*?)="(.*?)"\]/);
    if (match) node.setAttribute(match[1], match[2]);
    document.head.appendChild(node);
  }
  node.setAttribute(attr, value);
  return node;
}

export default function usePageSeo({ title, description, canonicalUrl, image, schema }) {
  useEffect(() => {
    if (!title || !description || !canonicalUrl) return undefined;

    const existingCanonical = document.querySelector('link[rel="canonical"]');
    const previousCanonical = existingCanonical?.getAttribute('href') || '';
    const previousTitle = document.title;
    const previousDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const previousOgTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const previousOgDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const previousOgUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
    const previousOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    const previousTwitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
    const previousTwitterDescription = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
    const previousTwitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';

    document.title = title;
    if (existingCanonical) existingCanonical.setAttribute('href', canonicalUrl);
    ensureMeta('meta[name="description"]', 'content', description);
    ensureMeta('meta[property="og:title"]', 'content', title);
    ensureMeta('meta[property="og:description"]', 'content', description);
    ensureMeta('meta[property="og:url"]', 'content', canonicalUrl);
    ensureMeta('meta[property="og:image"]', 'content', image);
    ensureMeta('meta[name="twitter:title"]', 'content', title);
    ensureMeta('meta[name="twitter:description"]', 'content', description);
    ensureMeta('meta[name="twitter:image"]', 'content', image);

    let schemaNode = null;
    if (schema) {
      schemaNode = document.createElement('script');
      schemaNode.type = 'application/ld+json';
      schemaNode.dataset.camigoSchema = 'page';
      schemaNode.textContent = JSON.stringify(schema);
      document.head.appendChild(schemaNode);
    }

    return () => {
      document.title = previousTitle;
      if (existingCanonical) existingCanonical.setAttribute('href', previousCanonical);
      ensureMeta('meta[name="description"]', 'content', previousDescription);
      ensureMeta('meta[property="og:title"]', 'content', previousOgTitle);
      ensureMeta('meta[property="og:description"]', 'content', previousOgDescription);
      ensureMeta('meta[property="og:url"]', 'content', previousOgUrl);
      ensureMeta('meta[property="og:image"]', 'content', previousOgImage);
      ensureMeta('meta[name="twitter:title"]', 'content', previousTwitterTitle);
      ensureMeta('meta[name="twitter:description"]', 'content', previousTwitterDescription);
      ensureMeta('meta[name="twitter:image"]', 'content', previousTwitterImage);
      schemaNode?.remove();
    };
  }, [canonicalUrl, description, image, schema, title]);
}
