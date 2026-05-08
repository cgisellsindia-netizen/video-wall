import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

function CategoryBannerCarousel({ placementId, showEmptySlot = false }) {
  const [banners, setBanners] = useState([]);
  const [trackOffset, setTrackOffset] = useState(0);
  const visibleBanners = banners.length > 1
    ? [...banners, banners[0]]
    : banners;

  useEffect(() => {
    let alive = true;
    fetch(`${API_URL}/categories/${placementId}/banners`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!alive) return;
        setBanners(Array.isArray(data) ? data : []);
        setTrackOffset(0);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => { alive = false; };
  }, [placementId]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setTrackOffset(current => {
        const next = current + 1;
        return next >= banners.length ? 0 : next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length && !showEmptySlot) return null;

  if (!banners.length) {
    return (
      <section className="category-banner-strip category-banner-empty" aria-label="Shop by Category banner space">
        <div className="category-banner-empty-copy">
          <span>CAMIGO FAST LANE</span>
          <strong>Security deals for Bhubaneswar</strong>
          <small>Same-day CCTV delivery, installation support and warranty care.</small>
        </div>
        <div className="category-banner-empty-badges">
          <span>8 min dispatch</span>
          <span>Install support</span>
          <span>5-year warranty</span>
        </div>
      </section>
    );
  }

  return (
    <section className="category-banner-strip">
      <div
        className="category-banner-track"
        style={{
          transform: `translateX(calc(var(--category-banner-side-peek) - ${trackOffset} * (var(--category-banner-card-width) + var(--category-banner-gap))))`,
        }}
      >
        {visibleBanners.map((banner, index) => (
          <div
            key={`${banner.id}-${index}`}
            className="category-banner-slide"
            style={{ aspectRatio: `${banner.width || 1200} / ${banner.height || 320}` }}
          >
            <img src={banner.image_url} alt="Category banner" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default CategoryBannerCarousel;
