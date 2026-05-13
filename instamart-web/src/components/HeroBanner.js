import React from 'react';

function HeroBanner() {
  return (
    <section className="hero-banner">
      <img
        className="hero-banner-image"
        src="/images/camigo-main-hero-banner.png"
        alt="Camigo Fast CCTV Delivery"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        width="2048"
        height="768"
      />
    </section>
  );
}

export default HeroBanner;
