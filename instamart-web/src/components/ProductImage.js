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

const buildResolutionCacheKey = (value = '', options = {}) => {
  const cleanValue = normalizeImageSource(value);
  if (!cleanValue) return '';
  const width = Number(options.width || 0) > 0 ? Number(options.width) : 0;
  const quality = Number(options.quality || 0) > 0 ? Number(options.quality) : 0;
  const format = String(options.format || '').trim().toLowerCase();
  return JSON.stringify({
    src: cleanValue,
    width,
    quality,
    format
  });
};

const proxiedMediaSource = (value = '', options = {}) => {
  const cleanValue = normalizeImageSource(value);
  if (!cleanValue || isEmbeddedImage(cleanValue) || !/^https?:\/\//i.test(cleanValue)) return '';
  const params = new URLSearchParams({ url: cleanValue });
  if (Number(options.width || 0) > 0) params.set('w', String(Number(options.width)));
  if (Number(options.quality || 0) > 0) params.set('q', String(Number(options.quality)));
  if (options.format) params.set('format', String(options.format));
  return `${API_URL}/media/proxy?${params.toString()}`;
};

const buildFallbackSources = (src, extraSources = [], fallbackSrc = '', options = {}) => {
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
    const resolutionCacheKey = buildResolutionCacheKey(cleanCandidate, options);
    if (resolutionCacheKey && resolvedSourceCache.has(resolutionCacheKey)) {
      addSource(resolvedSourceCache.get(resolutionCacheKey));
    }
    const webpVariant = buildWebpVariant(cleanCandidate);
    const isRemote = isRemoteSource(cleanCandidate);
    if (isRemote) {
      if (options.preferDirect) {
        addSource(cleanCandidate);
        addSource(proxiedMediaSource(cleanCandidate, options));
      } else {
        addSource(proxiedMediaSource(cleanCandidate, options));
        addSource(cleanCandidate);
      }
    } else {
      addSource(webpVariant);
      addSource(cleanCandidate);
      addSource(proxiedMediaSource(cleanCandidate, options));
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
  fallbackSrc = '',
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fallbackContent = 'CCTV',
  proxyWidth = 0,
  proxyQuality = 80,
  proxyFormat = 'webp',
  preferDirect = false,
  onLoad,
  onError,
  ...imgProps
}) {
  const sourceKey = normalizeImageSource(src);
  const fallbackKey = normalizeImageSource(fallbackSrc);
  const resolutionCacheKey = useMemo(
    () => buildResolutionCacheKey(sourceKey, {
      width: proxyWidth,
      quality: proxyQuality,
      format: proxyFormat
    }),
    [sourceKey, proxyWidth, proxyQuality, proxyFormat]
  );
  const sourcePlan = useMemo(
    () => buildFallbackSources(src, sources, fallbackSrc, {
      width: proxyWidth,
      quality: proxyQuality,
      format: proxyFormat,
      preferDirect
    }),
    [src, sources, fallbackSrc, proxyWidth, proxyQuality, proxyFormat, preferDirect]
  );
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
          && resolutionCacheKey
          && currentSrc
          && currentSrc !== fallbackKey
          && currentSrc !== proxiedMediaSource(fallbackKey, {
            width: proxyWidth,
            quality: proxyQuality,
            format: proxyFormat
          });
        if (canCacheResolvedSource) {
          resolvedSourceCache.set(resolutionCacheKey, currentSrc);
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
