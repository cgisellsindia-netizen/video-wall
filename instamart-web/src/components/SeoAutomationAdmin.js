import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../api';

function SeoAutomationAdmin({ token, setMessage }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [refreshMinutesInput, setRefreshMinutesInput] = useState('20');
  const [countdownLabel, setCountdownLabel] = useState('');

  const loadSnapshot = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/seo-automation`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load SEO automation snapshot');
      }
      setSnapshot(data || {});
      setRefreshMinutesInput(String(data?.refresh_minutes || 20));
    } catch (nextError) {
      setError(nextError.message || 'Unable to load SEO automation snapshot');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSnapshot();
  }, [token]);

  useEffect(() => {
    if (!snapshot?.next_refresh_at) {
      setCountdownLabel('');
      return undefined;
    }

    const renderCountdown = () => {
      const nextRun = Date.parse(snapshot.next_refresh_at);
      if (!Number.isFinite(nextRun)) {
        setCountdownLabel('');
        return;
      }
      const diffMs = nextRun - Date.now();
      if (diffMs <= 0) {
        setCountdownLabel('Running auto update...');
        return;
      }
      const totalSeconds = Math.ceil(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setCountdownLabel(`Next auto update in ${minutes}m ${String(seconds).padStart(2, '0')}s`);
    };

    renderCountdown();
    const timer = window.setInterval(renderCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.next_refresh_at]);

  useEffect(() => {
    if (!snapshot?.next_refresh_at || !token) return undefined;
    const nextRun = Date.parse(snapshot.next_refresh_at);
    if (!Number.isFinite(nextRun)) return undefined;
    const delayMs = Math.max(0, nextRun - Date.now()) + 15000;
    const timer = window.setTimeout(() => {
      loadSnapshot();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [snapshot?.next_refresh_at, token, loadSnapshot]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/seo-automation/refresh`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to refresh SEO automation snapshot');
      }
      setSnapshot(data?.snapshot || null);
      setRefreshMinutesInput(String(data?.snapshot?.refresh_minutes || refreshMinutesInput));
      setMessage?.(data?.message || 'SEO automation refreshed.');
    } catch (nextError) {
      const message = nextError.message || 'Unable to refresh SEO automation snapshot';
      setError(message);
      setMessage?.(message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!token) return;
    setSavingSettings(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/seo-automation/settings`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_minutes: refreshMinutesInput })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to save SEO automation settings');
      }
      setSnapshot(data?.snapshot || null);
      setRefreshMinutesInput(String(data?.snapshot?.refresh_minutes || refreshMinutesInput));
      setMessage?.(data?.message || 'SEO automation settings saved.');
    } catch (nextError) {
      const message = nextError.message || 'Unable to save SEO automation settings';
      setError(message);
      setMessage?.(message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="card seo-automation-panel">
        <p>Loading SEO intelligence...</p>
      </div>
    );
  }

  return (
    <div className="card seo-automation-panel">
      <div className="seo-automation-header">
        <div>
          <span className="phone-verify-eyebrow">SEO intelligence</span>
          <h3 style={{ margin: '6px 0 8px' }}>Autonomous keyword automation</h3>
          <p className="checkout-note" style={{ margin: 0 }}>
            Camigo now tracks real on-site search terms, local CCTV intent phrases, and priority keyword opportunities for Patia, Bhubaneswar, and Odisha.
          </p>
        </div>
        <div className="seo-automation-actions">
          <button className="btn btn-sm btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Manual update'}
          </button>
        </div>
      </div>

      {error ? <div className="admin-message">{error}</div> : null}

      <div className="seo-automation-meta">
        <span className="tag tag-info">Auto refresh: every {snapshot?.refresh_minutes || 20} minutes</span>
        <span className="tag tag-success">Last generated: {snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString() : 'Pending'}</span>
        <span className="tag">Local focus: {(snapshot?.local_focus || []).join(', ') || 'Patia, Bhubaneswar, Odisha'}</span>
        <span className="tag">Tracked signals: {snapshot?.tracked_signal_count || 0}</span>
        <span className="tag">Tracked performance rows: {snapshot?.tracked_performance_count || 0}</span>
        <span className="tag">Harvested suggestions: {snapshot?.harvested_keyword_count || 0}</span>
        <span className="tag tag-warning">{countdownLabel || 'Next auto update pending'}</span>
      </div>

      <div className="seo-automation-settings">
        <div className="seo-automation-settings-field">
          <label htmlFor="seo-refresh-minutes">Update interval (minutes)</label>
          <input
            id="seo-refresh-minutes"
            type="number"
            min="5"
            max="180"
            value={refreshMinutesInput}
            onChange={(event) => setRefreshMinutesInput(event.target.value)}
          />
        </div>
        <button className="btn btn-sm btn-secondary" onClick={handleSaveSettings} disabled={savingSettings}>
          {savingSettings ? 'Saving...' : 'Save interval'}
        </button>
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
          <h4>Stored best keyword bank</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.keyword_bank || []).slice(0, 12).map((item) => (
              <div key={item.keyword} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>Clicks {item.clicks || 0} · Score {item.score || 0}</span>
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

        <article className="seo-automation-card">
          <h4>Fresh external keyword harvest</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.harvested_keywords || []).map((item) => (
              <div key={`${item.keyword}-${item.source}`} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>{String(item.source || 'harvest').replaceAll('_', ' ')} · Weight {item.weight || 1}</span>
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
              <strong>Homepage heading</strong>
              <p>{snapshot?.generated_copy?.homepage_heading || 'Not generated yet.'}</p>
            </div>
            <div className="seo-automation-copy-box">
              <strong>Homepage paragraph</strong>
              <p>{snapshot?.generated_copy?.homepage_paragraph || 'Not generated yet.'}</p>
            </div>
            <div className="seo-automation-copy-box">
              <strong>Shop heading</strong>
              <p>{snapshot?.generated_copy?.shop_heading || 'Not generated yet.'}</p>
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
