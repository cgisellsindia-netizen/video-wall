import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

function SeoSignalBlock({ snapshot }) {
  if (!snapshot) return null;

  const homepageKeywords = Array.isArray(snapshot.homepage_keywords) ? snapshot.homepage_keywords : [];
  const strongestKeywords = Array.isArray(snapshot.strongest_keywords) ? snapshot.strongest_keywords.slice(0, 6) : [];
  const keywordBank = Array.isArray(snapshot.keyword_bank) ? snapshot.keyword_bank.slice(0, 6) : [];
  const emerging = Array.isArray(snapshot.emerging_search_terms) ? snapshot.emerging_search_terms.slice(0, 6) : [];
  const harvested = Array.isArray(snapshot.harvested_keywords) ? snapshot.harvested_keywords.slice(0, 6) : [];
  const localFocus = Array.isArray(snapshot.local_focus) && snapshot.local_focus.length
    ? snapshot.local_focus.join(', ')
    : 'Patia, Bhubaneswar, Odisha';
  const generatedHeading = snapshot?.generated_copy?.homepage_heading || 'Trending CCTV Searches Around Bhubaneswar';
  const generatedParagraph = snapshot?.generated_copy?.homepage_paragraph || '';
  const trackedKeywords = useMemo(
    () => Array.from(new Set([
      ...homepageKeywords,
      ...strongestKeywords.map((item) => item.keyword),
      ...keywordBank.map((item) => item.keyword)
    ])),
    [homepageKeywords, strongestKeywords, keywordBank]
  );
  const trackedKeyRef = useRef('');

  if (!homepageKeywords.length && !strongestKeywords.length && !emerging.length && !keywordBank.length) return null;

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
      <details className="seo-link-hub seo-automation-public-block seo-automation-disclosure">
        <summary className="seo-automation-disclosure-summary">
          <span className="seo-automation-disclosure-title">Popular CCTV searches in Bhubaneswar</span>
          <span className="seo-automation-disclosure-meta">{localFocus}</span>
        </summary>

        <div className="seo-automation-disclosure-body">
          <p className="seo-link-hub-copy">
            {generatedParagraph || 'This live keyword block refreshes from Camigo search demand and local CCTV buying intent to keep the homepage aligned with what customers are actively searching for.'}
          </p>
          <p className="checkout-note" style={{ marginTop: 8 }}>
            {`Local focus: ${localFocus} - Last keyword refresh: ${snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString() : 'Pending'} - Fresh suggestions pulled: ${snapshot?.harvested_keyword_count || 0}`}
          </p>

          {homepageKeywords.length ? (
            <>
              <h3 className="seo-automation-public-heading">{generatedHeading}</h3>
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
              <h3>Stored winning keywords</h3>
              <div className="seo-link-list">
                {keywordBank.map((item) => (
                  <Link
                    key={`${item.keyword}-bank`}
                    to={`/shop?search=${encodeURIComponent(item.keyword)}`}
                    className="seo-link-chip subtle"
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
            <div className="seo-link-group">
              <h3>Freshly harvested keyword ideas</h3>
              <div className="seo-link-list">
                {harvested.map((item) => (
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
      </details>
    </section>
  );
}

export default SeoSignalBlock;
