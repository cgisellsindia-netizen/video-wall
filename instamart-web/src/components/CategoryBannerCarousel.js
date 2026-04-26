import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

function CategoryBannerCarousel({ placementId }) {
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/categories/${placementId}/banners`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!alive) return;
        setBanners(Array.isArray(data) ? data : []);
        setActiveIndex(0);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => { alive = false; };
  }, [placementId]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveIndex(current => (current + 1) % banners.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  return (
    <section className="category-banner-strip">
      <div
        className="category-banner-track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {banners.map(banner => (
          <div
            key={banner.id}
            className="category-banner-slide"
            style={{ aspectRatio: `${banner.width || 1200} / ${banner.height || 320}` }}
          >
            <img src={banner.image_url} alt="Category banner" />
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="category-banner-dots">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              className={index === activeIndex ? 'active' : ''}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default CategoryBannerCarousel;
