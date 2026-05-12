import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
const resolvedSourceCache = new Map();

const isEmbeddedImage = (value = '') => /^(data|blob):/i.test(String(value || '').trim());

const splitSourceParts = (value = '') => {
  const cleanValue = String(value || '').trim();
  const match = cleanValue.match(/^([^?#]*)([?#].*)?$/);
  return {
    path: match?.[1] || '',
    suffix: match?.[2] || ''
  };
};

const normalizePathSegments = (pathname = '') => pathname
  .split('/')
  .map((segment) => {
    if (!segment) return segment;
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch (error) {
      return encodeURIComponent(segment);
    }
  })
  .join('/');

const normalizeImageSource = (value = '') => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || isEmbeddedImage(cleanValue)) return cleanValue;

  if (/^https?:\/\//i.test(cleanValue)) {
    try {
      const parsed = new URL(cleanValue);
      parsed.pathname = normalizePathSegments(parsed.pathname);
      return parsed.toString();
    } catch (error) {
      return cleanValue;
    }
  }

  const { path, suffix } = splitSourceParts(cleanValue);
  return `${normalizePathSegments(path)}${suffix}`;
};

const proxiedMediaSource = (value = '') => {
  const cleanValue = normalizeImageSource(value);
  if (!cleanValue || isEmbeddedImage(cleanValue) || !/^https?:\/\//i.test(cleanValue)) return '';
  return `${API_URL}/media/proxy?url=${encodeURIComponent(cleanValue)}`;
};

const buildFallbackSources = (src, fallbackSrc = '') => {
  const cleanSrc = normalizeImageSource(src);
  const cleanFallbackSrc = normalizeImageSource(fallbackSrc);
  const sources = [];
  const addSource = (value) => {
    const cleanValue = normalizeImageSource(value);
    if (cleanValue && !sources.includes(cleanValue)) sources.push(cleanValue);
  };

  if (resolvedSourceCache.has(cleanSrc)) addSource(resolvedSourceCache.get(cleanSrc));
  addSource(cleanSrc);
  addSource(proxiedMediaSource(cleanSrc));
  addSource(cleanFallbackSrc);
  return sources;
};

function ProductImage({
  src,
  fallbackSrc = '/images/cgi-hd3e.jpg',
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fallbackContent = 'CCTV',
  onLoad,
  onError,
  ...imgProps
}) {
  const sourceKey = normalizeImageSource(src);
  const sources = useMemo(() => buildFallbackSources(src, fallbackSrc), [src, fallbackSrc]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sources.join('|')]);

  const currentSrc = sources[sourceIndex];

  if (!currentSrc) {
    return <div className={className ? `${className} emoji` : 'emoji'}>{fallbackContent}</div>;
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      {...imgProps}
      onLoad={(event) => {
        if (sourceKey && currentSrc) resolvedSourceCache.set(sourceKey, currentSrc);
        if (typeof onLoad === 'function') onLoad(event);
      }}
      onError={(event) => {
        if (typeof onError === 'function') onError(event);
        setSourceIndex((currentIndex) => (
          currentIndex + 1 < sources.length ? currentIndex + 1 : sources.length
        ));
      }}
    />
  );
}

export default ProductImage;
