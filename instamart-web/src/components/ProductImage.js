import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

const rasterExtensions = ['webp', 'jpg', 'jpeg', 'png'];

const isEmbeddedImage = (value = '') => /^(data|blob):/i.test(String(value || '').trim());

const proxiedMediaSource = (value = '') => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue || isEmbeddedImage(cleanValue) || !/^https?:\/\//i.test(cleanValue)) return '';
  return `${API_URL}/media/proxy?url=${encodeURIComponent(cleanValue)}`;
};

const buildFallbackSources = (src, fallbackSrc = '') => {
  const cleanSrc = String(src || '').trim();
  const sources = [];
  const addSource = (value) => {
    const cleanValue = String(value || '').trim();
    if (cleanValue && !sources.includes(cleanValue)) sources.push(cleanValue);
  };

  addSource(cleanSrc);

  if (cleanSrc && !isEmbeddedImage(cleanSrc)) {
    const [pathPart, suffix = ''] = cleanSrc.split(/([?#].*)/, 2);
    const match = pathPart.match(/^(.*)\.([a-z0-9]+)$/i);
    if (match && rasterExtensions.includes(match[2].toLowerCase())) {
      rasterExtensions.forEach((extension) => addSource(`${match[1]}.${extension}${suffix}`));
    }
  }

  sources.slice().forEach((source) => addSource(proxiedMediaSource(source)));

  addSource(fallbackSrc);
  return sources;
};

function ProductImage({
  src,
  fallbackSrc = '/images/cgi-hd3e.jpg',
  alt = '',
  className = '',
  loading = 'lazy',
  fallbackContent = 'CCTV',
  ...imgProps
}) {
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
      {...imgProps}
      onError={() => {
        setSourceIndex((currentIndex) => (
          currentIndex + 1 < sources.length ? currentIndex + 1 : sources.length
        ));
      }}
    />
  );
}

export default ProductImage;
