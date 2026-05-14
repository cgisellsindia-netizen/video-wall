import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

function SeoAutomationAdmin({ token, setMessage }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSnapshot = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/seo-automation`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load SEO automation snapshot');
      }
      setSnapshot(data || {});
    } catch (nextError) {
      setError(nextError.message || 'Unable to load SEO automation snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
  }, [token]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/seo-automation/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to refresh SEO automation snapshot');
      }
      setSnapshot(data?.snapshot || null);
      setMessage?.(data?.message || 'SEO automation refreshed.');
    } catch (nextError) {
      const message = nextError.message || 'Unable to refresh SEO automation snapshot';
      setError(message);
      setMessage?.(message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="card seo-automation-panel"><p>Loading SEO intelligence...</p></div>;
  }

  return (
    <div className="card seo-automation-panel">
      <div className="seo-automation-header">
        <div>
          <span className="phone-verify-eyebrow">SEO intelligence</span>
          <h3 style={{ margin: '6px 0 8px' }}>20-minute keyword automation snapshot</h3>
          <p className="checkout-note" style={{ margin: 0 }}>
            Camigo now tracks real on-site search terms, local CCTV intent phrases, and priority keyword opportunities for Bhubaneswar and Odisha.
          </p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh now'}
        </button>
      </div>

      {error ? <div className="admin-message">{error}</div> : null}

      <div className="seo-automation-meta">
        <span className="tag tag-info">Auto refresh: every {snapshot?.refresh_minutes || 20} minutes</span>
        <span className="tag tag-success">Last generated: {snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString() : 'Pending'}</span>
        <span className="tag">Tracked signals: {snapshot?.tracked_signal_count || 0}</span>
        <span className="tag">Tracked performance rows: {snapshot?.tracked_performance_count || 0}</span>
      </div>

      <div className="seo-automation-grid">
        <article className="seo-automation-card">
          <h4>Strongest existing keywords</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.strongest_keywords || []).map((item) => (
              <div key={item.keyword} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>Score {item.score || 0} · Hits {item.hits || 0}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card">
          <h4>Emerging search terms from customers</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.emerging_search_terms || []).map((item) => (
              <div key={`${item.keyword}-${item.source}`} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>{item.hits || 0} searches · {String(item.source || 'signal').replaceAll('_', ' ')}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Recommended next updates</h4>
          <div className="seo-automation-opportunities">
            {(snapshot?.opportunities || []).map((item) => (
              <div key={item.keyword} className="seo-automation-opportunity">
                <div>
                  <strong>{item.keyword}</strong>
                  <p>{item.action}</p>
                </div>
                <code>{item.page_hint}</code>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Live autonomous copy</h4>
          <div className="seo-automation-copy-preview">
            <div className="seo-automation-copy-box">
              <strong>Homepage paragraph</strong>
              <p>{snapshot?.generated_copy?.homepage_paragraph || 'Not generated yet.'}</p>
            </div>
            <div className="seo-automation-copy-box">
              <strong>Shop paragraph</strong>
              <p>{snapshot?.generated_copy?.shop_paragraph || 'Not generated yet.'}</p>
            </div>
          </div>
          {(snapshot?.generated_copy?.dropped_keywords || []).length ? (
            <div className="seo-automation-copy-dropped">
              <strong>Auto-rotated out for no clicks</strong>
              <div className="seo-automation-chip-list">
                {snapshot.generated_copy.dropped_keywords.map((item) => (
                  <div key={item.keyword} className="seo-automation-chip">
                    <strong>{item.keyword}</strong>
                    <span>{item.impressions} impressions · {item.clicks} clicks</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    </div>
  );
}

export default SeoAutomationAdmin;
