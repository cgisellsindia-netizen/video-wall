import React from 'react';

function HeroBanner() {
  return (
    <section className="hero-banner">
      <picture>
        <source
          media="(max-width: 640px)"
          srcSet="/images/camigo-main-hero-banner-mobile.webp"
          type="image/webp"
        />
        <source
          srcSet="/images/camigo-main-hero-banner.webp"
          type="image/webp"
        />
        <img
          className="hero-banner-image"
          src="/images/camigo-main-hero-banner.webp"
          alt="Camigo Fast CCTV Delivery"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width="1600"
          height="600"
        />
      </picture>
    </section>
  );
}

export default HeroBanner;
