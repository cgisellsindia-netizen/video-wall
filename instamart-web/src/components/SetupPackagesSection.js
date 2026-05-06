import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

const formatPrice = (value) => `Rs ${new Intl.NumberFormat('en-IN').format(Math.max(0, Number(value || 0)))}`;

function SetupPackagesSection() {
  const [packages, setPackages] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const loadPackages = async () => {
      try {
        const res = await fetch(`${API_URL}/setup-packages`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setPackages(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!cancelled) setPackages([]);
      }
    };
    loadPackages();
    return () => { cancelled = true; };
  }, []);

  if (!packages.length) return null;

  return (
    <section className="category-section setup-packages-section">
      <div className="section-header">
        <div>
          <span className="phone-verify-eyebrow">Ready CCTV combos</span>
          <h2 className="section-title">Full Setup Packages</h2>
        </div>
        <span className="see-all">Quick quote</span>
      </div>
      <div className="setup-package-grid">
        {packages.map((entry) => (
          <article key={entry.id} className="setup-package-card">
            <div className="setup-package-visual">
              <img src={entry.image} alt={entry.title} loading="lazy" />
              {entry.badge ? <span className="setup-package-badge">{entry.badge}</span> : null}
            </div>
            <div className="setup-package-body">
              <div className="setup-package-price-row">
                <strong>{entry.title}</strong>
                <span>{formatPrice(entry.price)}</span>
              </div>
              <p>{entry.subtitle || 'Camigo full setup package with delivery support.'}</p>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate('/contact')}>
                Book full setup
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SetupPackagesSection;
