import React from 'react';
import { Link } from 'react-router-dom';

function SeoSignalBlock({ snapshot }) {
  if (!snapshot) return null;

  const homepageKeywords = Array.isArray(snapshot.homepage_keywords) ? snapshot.homepage_keywords : [];
  const strongestKeywords = Array.isArray(snapshot.strongest_keywords) ? snapshot.strongest_keywords.slice(0, 6) : [];
  const emerging = Array.isArray(snapshot.emerging_search_terms) ? snapshot.emerging_search_terms.slice(0, 6) : [];

  if (!homepageKeywords.length && !strongestKeywords.length && !emerging.length) return null;

  return (
    <section className="category-section">
      <div className="seo-link-hub seo-automation-public-block">
        <div className="section-header">
          <h2 className="section-title">Trending CCTV Searches Around Bhubaneswar</h2>
        </div>
        <p className="seo-link-hub-copy">
          This live keyword block refreshes from Camigo search demand and local CCTV buying intent to keep the homepage aligned with what customers are actively searching for.
        </p>

        {homepageKeywords.length ? (
          <>
            <h3 className="seo-automation-public-heading">Priority homepage keywords</h3>
            <div className="local-seo-topic-list">
              {homepageKeywords.map((keyword) => (
                <Link key={keyword} to={`/shop?search=${encodeURIComponent(keyword)}`} className="seo-link-chip subtle">
                  {keyword}
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <div className="seo-automation-public-grid">
          <div className="seo-link-group">
            <h3>Strongest existing searches</h3>
            <div className="seo-link-list">
              {strongestKeywords.map((item) => (
                <Link key={item.keyword} to={`/shop?search=${encodeURIComponent(item.keyword)}`} className="seo-link-chip">
                  {item.keyword}
                </Link>
              ))}
            </div>
          </div>
          <div className="seo-link-group">
            <h3>Emerging customer queries</h3>
            <div className="seo-link-list">
              {emerging.map((item) => (
                <Link key={`${item.keyword}-${item.source}`} to={`/shop?search=${encodeURIComponent(item.keyword)}`} className="seo-link-chip subtle">
                  {item.keyword}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SeoSignalBlock;
