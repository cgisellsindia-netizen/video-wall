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

const isRemoteSource = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

const buildWebpVariant = (value = '') => {
  const cleanValue = normalizeImageSource(value);
  if (!cleanValue || isEmbeddedImage(cleanValue) || isRemoteSource(cleanValue)) return '';
  const { path, suffix } = splitSourceParts(cleanValue);
  if (!/\.png$/i.test(path)) return '';
  return `${path.replace(/\.png$/i, '.webp')}${suffix}`;
};

const proxiedMediaSource = (value = '') => {
  const cleanValue = normalizeImageSource(value);
  if (!cleanValue || isEmbeddedImage(cleanValue) || !/^https?:\/\//i.test(cleanValue)) return '';
  return `${API_URL}/media/proxy?url=${encodeURIComponent(cleanValue)}`;
};

const buildFallbackSources = (src, extraSources = [], fallbackSrc = '') => {
  const cleanExtraSources = Array.isArray(extraSources) ? extraSources : [extraSources];
  const cleanFallbackSrc = normalizeImageSource(fallbackSrc);
  const sources = [];
  const candidateKeys = [];
  const addSource = (value) => {
    const cleanValue = normalizeImageSource(value);
    if (cleanValue && !sources.includes(cleanValue)) sources.push(cleanValue);
  };

  [src, ...cleanExtraSources].forEach((candidate) => {
    const cleanCandidate = normalizeImageSource(candidate);
    if (!cleanCandidate || candidateKeys.includes(cleanCandidate)) return;
    candidateKeys.push(cleanCandidate);
    if (resolvedSourceCache.has(cleanCandidate)) addSource(resolvedSourceCache.get(cleanCandidate));
    const webpVariant = buildWebpVariant(cleanCandidate);
    const prefersProxy = isRemoteSource(cleanCandidate);
    if (prefersProxy) {
      addSource(proxiedMediaSource(cleanCandidate));
      addSource(cleanCandidate);
    } else {
      addSource(webpVariant);
      addSource(cleanCandidate);
      addSource(proxiedMediaSource(cleanCandidate));
    }
  });

  if (!candidateKeys.length) {
    addSource(cleanFallbackSrc);
  }

  return { sources, candidateKeys };
};

function ProductImage({
  src,
  sources = [],
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
  const fallbackKey = normalizeImageSource(fallbackSrc);
  const sourcePlan = useMemo(() => buildFallbackSources(src, sources, fallbackSrc), [src, sources, fallbackSrc]);
  const sourceList = sourcePlan.sources;
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceList.join('|')]);

  const currentSrc = sourceList[sourceIndex];

  if (!currentSrc) {
    return (
      <div
        className={className ? `${className} product-image-placeholder` : 'product-image-placeholder'}
        aria-label={alt || fallbackContent}
      />
    );
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
        const canCacheResolvedSource = sourceKey
          && currentSrc
          && currentSrc !== fallbackKey
          && currentSrc !== proxiedMediaSource(fallbackKey);
        if (canCacheResolvedSource) {
          sourcePlan.candidateKeys.forEach((candidateKey) => resolvedSourceCache.set(candidateKey, currentSrc));
        }
        if (typeof onLoad === 'function') onLoad(event);
      }}
      onError={(event) => {
        if (typeof onError === 'function') onError(event);
        setSourceIndex((currentIndex) => (
          currentIndex + 1 < sourceList.length ? currentIndex + 1 : sourceList.length
        ));
      }}
    />
  );
}

export default ProductImage;
