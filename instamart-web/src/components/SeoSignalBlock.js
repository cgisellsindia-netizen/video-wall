import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

function SeoSignalBlock({ snapshot }) {
  if (!snapshot) return null;

  const homepageKeywords = Array.isArray(snapshot.homepage_keywords) ? snapshot.homepage_keywords : [];
  const strongestKeywords = Array.isArray(snapshot.strongest_keywords) ? snapshot.strongest_keywords.slice(0, 6) : [];
  const emerging = Array.isArray(snapshot.emerging_search_terms) ? snapshot.emerging_search_terms.slice(0, 6) : [];
  const generatedParagraph = snapshot?.generated_copy?.homepage_paragraph || '';
  const trackedKeywords = useMemo(
    () => Array.from(new Set([...homepageKeywords, ...strongestKeywords.map((item) => item.keyword)])),
    [homepageKeywords, strongestKeywords]
  );
  const trackedKeyRef = useRef('');

  if (!homepageKeywords.length && !strongestKeywords.length && !emerging.length) return null;

  useEffect(() => {
    const fingerprint = trackedKeywords.join('|');
    if (!fingerprint || trackedKeyRef.current === fingerprint) return;
    trackedKeyRef.current = fingerprint;
    trackedKeywords.forEach((keyword) => {
      fetch(`${API_URL}/seo-automation/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          placement: 'homepage',
          action: 'impression'
        })
      }).catch(() => {});
    });
  }, [trackedKeywords]);

  const handleKeywordClick = (keyword) => {
    fetch(`${API_URL}/seo-automation/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword,
        placement: 'homepage',
        action: 'click'
      })
    }).catch(() => {});
  };

  return (
    <section className="category-section">
      <div className="seo-link-hub seo-automation-public-block">
        <div className="section-header">
          <h2 className="section-title">Trending CCTV Searches Around Bhubaneswar</h2>
        </div>
        <p className="seo-link-hub-copy">
          {generatedParagraph || 'This live keyword block refreshes from Camigo search demand and local CCTV buying intent to keep the homepage aligned with what customers are actively searching for.'}
        </p>

        {homepageKeywords.length ? (
          <>
            <h3 className="seo-automation-public-heading">Priority homepage keywords</h3>
            <div className="local-seo-topic-list">
              {homepageKeywords.map((keyword) => (
                <Link
                  key={keyword}
                  to={`/shop?search=${encodeURIComponent(keyword)}`}
                  className="seo-link-chip subtle"
                  onClick={() => handleKeywordClick(keyword)}
                >
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
                <Link
                  key={item.keyword}
                  to={`/shop?search=${encodeURIComponent(item.keyword)}`}
                  className="seo-link-chip"
                  onClick={() => handleKeywordClick(item.keyword)}
                >
                  {item.keyword}
                </Link>
              ))}
            </div>
          </div>
          <div className="seo-link-group">
            <h3>Emerging customer queries</h3>
            <div className="seo-link-list">
              {emerging.map((item) => (
                <Link
                  key={`${item.keyword}-${item.source}`}
                  to={`/shop?search=${encodeURIComponent(item.keyword)}`}
                  className="seo-link-chip subtle"
                  onClick={() => handleKeywordClick(item.keyword)}
                >
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
