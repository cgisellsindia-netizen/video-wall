import React from 'react';
import { Shield, Truck, Headphones, Sparkles } from 'lucide-react';

const heroHighlights = [
  { icon: Truck, label: 'Fast local dispatch' },
  { icon: Shield, label: 'Trusted CCTV setups' },
  { icon: Headphones, label: 'Installation support' }
];

const heroProducts = [
  { name: 'IP Cameras', image: '/images/cgi-ipb8.jpg', accent: 'Top clarity' },
  { name: 'PTZ Range', image: '/images/cgi-ptz36x5p.jpg', accent: 'Zoom coverage' },
  { name: 'PoE Switches', image: '/images/cgi-poe8g.jpg', accent: 'Ready stock' }
];

function HeroBanner() {
  return (
    <section className="hero-banner">
      <div className="hero-inner hero-storefront">
        <div className="hero-content hero-copy-block">
          <span className="hero-kicker">
            <Sparkles size={15} />
            Camigo Fast CCTV Delivery
          </span>
          <h1>Fast CCTV delivery for homes, shops, offices, and installers.</h1>
          <p>
            Order cameras, recorders, PoE switches, SMPS units, and full setup packages with quick local dispatch from Bhubaneswar.
          </p>
          <div className="hero-stats hero-highlights">
            {heroHighlights.map(({ icon: Icon, label }) => (
              <div className="hero-stat hero-highlight-pill" key={label}>
                <div className="hero-stat-icon"><Icon size={16} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="hero-signal-row">
            <span className="hero-signal-pill">AHD + IP + PTZ</span>
            <span className="hero-signal-pill">5-year warranty</span>
            <span className="hero-signal-pill">Same-day local support</span>
          </div>
        </div>

        <div className="hero-visual-board" aria-hidden="true">
          <div className="hero-visual-glow" />
          <div className="hero-product-cluster">
            {heroProducts.map((product) => (
              <article className="hero-product-card" key={product.name}>
                <div className="hero-product-image-wrap">
                  <img src={product.image} alt={product.name} />
                </div>
                <div className="hero-product-meta">
                  <strong>{product.name}</strong>
                  <span>{product.accent}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="hero-delivery-visual">
            <div className="hero-delivery-card">
              <span className="hero-delivery-pill">Local delivery</span>
              <strong>Quick dispatch from Bhubaneswar</strong>
              <small>Product + installation flow in one place</small>
            </div>
            <img src="/images/camigo-delivery-hero.png" alt="Camigo delivery partner with CCTV order" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
