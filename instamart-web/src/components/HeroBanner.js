import React from 'react';
import { Shield, Truck, Headphones } from 'lucide-react';

function HeroBanner() {
  return (
    <div className="hero-banner">
      <div className="hero-inner">
        <div className="hero-content">
          <h1>CCTV Cameras Delivered Fast.<br />Installed Without Delay.</h1>
          <p>Order cameras, DVRs, NVRs, PoE switches and accessories with quick dispatch and installation support in Bhubaneswar.</p>
          <div className="hero-stats">
            <div className="hero-stat"><div className="hero-stat-icon"><Shield size={18} /></div><span>Same Day Delivery</span></div>
            <div className="hero-stat"><div className="hero-stat-icon"><Truck size={18} /></div><span>Free Delivery</span></div>
            <div className="hero-stat"><div className="hero-stat-icon"><Headphones size={18} /></div><span>5-Year Warranty</span></div>
          </div>
        </div>
        <div className="hero-illustration hero-delivery-visual">
          <div className="hero-brand-watermark">Camigo</div>
          <img src="/images/camigo-delivery-hero.png" alt="Camigo delivery partner with CCTV order" />
        </div>
      </div>
    </div>
  );
}
export default HeroBanner;
