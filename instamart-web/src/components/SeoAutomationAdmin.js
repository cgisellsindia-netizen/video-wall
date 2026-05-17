import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../api';

function SeoAutomationAdmin({ token, setMessage }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [refreshMinutesInput, setRefreshMinutesInput] = useState('20');
  const [manualSuggestionsInput, setManualSuggestionsInput] = useState('');
  const [searchConsolePropertyInput, setSearchConsolePropertyInput] = useState('');
  const [searchConsoleServiceAccountInput, setSearchConsoleServiceAccountInput] = useState('');
  const [clearSearchConsole, setClearSearchConsole] = useState(false);
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
      setManualSuggestionsInput(Array.isArray(data?.manual_suggestions) ? data.manual_suggestions.join('\n') : '');
      setSearchConsolePropertyInput(data?.search_console?.property || '');
      setSearchConsoleServiceAccountInput('');
      setClearSearchConsole(false);
    } catch (nextError) {
      setError(nextError.message || 'Unable to load SEO automation snapshot');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

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
      setManualSuggestionsInput(Array.isArray(data?.snapshot?.manual_suggestions) ? data.snapshot.manual_suggestions.join('\n') : manualSuggestionsInput);
      setSearchConsolePropertyInput(data?.snapshot?.search_console?.property || searchConsolePropertyInput);
      setClearSearchConsole(false);
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
        body: JSON.stringify({
          refresh_minutes: refreshMinutesInput,
          manual_suggestions: manualSuggestionsInput,
          search_console_property: searchConsolePropertyInput,
          search_console_service_account_json: searchConsoleServiceAccountInput,
          clear_search_console: clearSearchConsole
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to save SEO automation settings');
      }
      setSnapshot(data?.snapshot || null);
      setRefreshMinutesInput(String(data?.snapshot?.refresh_minutes || refreshMinutesInput));
      setManualSuggestionsInput(Array.isArray(data?.snapshot?.manual_suggestions) ? data.snapshot.manual_suggestions.join('\n') : manualSuggestionsInput);
      setSearchConsolePropertyInput(data?.snapshot?.search_console?.property || searchConsolePropertyInput);
      setSearchConsoleServiceAccountInput('');
      setClearSearchConsole(false);
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
        <span className="tag">Manual priorities: {snapshot?.manual_suggestions?.length || 0}</span>
        <span className="tag">Tracked performance rows: {snapshot?.tracked_performance_count || 0}</span>
        <span className="tag">Harvested suggestions: {snapshot?.harvested_keyword_count || 0}</span>
        <span className="tag">Harvest source: {snapshot?.harvested_keyword_source || 'pending'}</span>
        <span className="tag">Visibility source: {snapshot?.visibility_source || 'pending'}</span>
        <span className="tag">Google top 10: {snapshot?.ranking_summary?.top10_keywords || 0}</span>
        <span className="tag">Avg rank: {snapshot?.ranking_summary?.average_position ?? 'Not found yet'}</span>
        <span className="tag tag-warning">{countdownLabel || 'Next auto update pending'}</span>
      </div>

      <div className="seo-automation-settings">
        <div className="seo-automation-settings-field">
          <label htmlFor="seo-refresh-minutes">Update interval (minutes)</label>
          <input
            id="seo-refresh-minutes"
            type="number"
            min="1"
            max="180"
            value={refreshMinutesInput}
            onChange={(event) => setRefreshMinutesInput(event.target.value)}
          />
        </div>
        <div className="seo-automation-settings-field seo-automation-settings-field-wide">
          <label htmlFor="seo-manual-suggestions">Manual keyword suggestions for the SEO machine</label>
          <textarea
            id="seo-manual-suggestions"
            rows="5"
            value={manualSuggestionsInput}
            onChange={(event) => setManualSuggestionsInput(event.target.value)}
            placeholder={'One keyword per line\ncctv camera patia\nip camera bhubaneswar\nsecurity camera installation odisha'}
          />
        </div>
        <div className="seo-automation-settings-field seo-automation-settings-field-wide">
          <label htmlFor="seo-search-console-property">Google Search Console property</label>
          <input
            id="seo-search-console-property"
            type="text"
            value={searchConsolePropertyInput}
            onChange={(event) => setSearchConsolePropertyInput(event.target.value)}
            placeholder="sc-domain:getcamigo.com or https://getcamigo.com/"
          />
        </div>
        <div className="seo-automation-settings-field seo-automation-settings-field-wide">
          <label htmlFor="seo-search-console-service-account">Search Console service account JSON</label>
          <textarea
            id="seo-search-console-service-account"
            rows="6"
            value={searchConsoleServiceAccountInput}
            onChange={(event) => setSearchConsoleServiceAccountInput(event.target.value)}
            placeholder={'Paste the full Google service account JSON here to set or replace it.\nLeave this box empty while saving if you want to keep the existing secret.'}
            disabled={clearSearchConsole}
          />
        </div>
        <label className="checkout-note" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={clearSearchConsole}
            onChange={(event) => setClearSearchConsole(event.target.checked)}
          />
          Clear the stored Search Console property and service account on save
        </label>
        <button className="btn btn-sm btn-secondary" onClick={handleSaveSettings} disabled={savingSettings}>
          {savingSettings ? 'Saving...' : 'Save SEO settings'}
        </button>
      </div>
      <p className="checkout-note" style={{ marginTop: 8 }}>
        Fastest safe mode is 1 minute. More aggressive than that is likely to get external keyword and ranking checks throttled without improving Google ranking speed. Manual suggestions entered here are also folded into the stored keyword bank, rank checks, and next SEO refresh cycle.
      </p>
      <p className="checkout-note" style={{ marginTop: 8 }}>
        For Google-safe reporting, add your Search Console property and a service account JSON, then grant that service account access inside Google Search Console. Once connected, Camigo will prefer approved Search Console query/click/impression data over block-prone SERP scraping.
      </p>

      <div className="seo-automation-grid">
        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Google-safe Search Console status</h4>
          <div className="seo-automation-opportunities">
            <div className="seo-automation-opportunity">
              <div>
                <strong>{snapshot?.search_console?.connected ? 'Connected' : snapshot?.search_console?.configured ? 'Configured but not connected' : 'Not configured yet'}</strong>
                <p>
                  {snapshot?.search_console?.connected
                    ? `Using ${snapshot?.search_console?.query_count || 0} Search Console query rows from ${snapshot?.search_console?.property || 'your property'}`
                    : snapshot?.search_console?.error || 'Add a property and service account to stop depending on Google result-page scraping.'}
                </p>
                {snapshot?.search_console?.service_account_email ? (
                  <p style={{ marginTop: 6 }}>
                    Service account: <code>{snapshot.search_console.service_account_email}</code>
                  </p>
                ) : null}
              </div>
              <code>
                {snapshot?.search_console?.checked_at
                  ? `Checked ${new Date(snapshot.search_console.checked_at).toLocaleString()}`
                  : 'Waiting for setup'}
              </code>
            </div>
          </div>
          <div className="seo-automation-chip-list" style={{ marginTop: 12 }}>
            {(snapshot?.search_console?.top_queries || []).map((item) => (
              <div key={`search-console-${item.keyword}`} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>{`${item.clicks || 0} clicks - ${item.impressions || 0} impressions - Avg pos ${item.position ?? 'n/a'}`}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Best current search rankings</h4>
          <div className="seo-automation-opportunities">
            {(snapshot?.best_ranked_keywords || []).map((item) => (
              <div key={`best-rank-${item.keyword}`} className="seo-automation-opportunity">
                <div>
                  <strong>{item.keyword}</strong>
                  <p>
                    {item.found && item.position
                      ? `Best detected rank is #${item.position}`
                      : `Not detected yet in tracked results`}
                  </p>
                </div>
                <code>
                  {item.source === 'duckduckgo_fallback' ? 'DuckDuckGo fallback' : 'Google'}
                </code>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Manual priority Google rankings</h4>
          <div className="seo-automation-opportunities">
            {(snapshot?.manual_priority_rankings || []).map((item) => (
              <div key={`manual-rank-${item.keyword}`} className="seo-automation-opportunity">
                <div>
                  <strong>{item.keyword}</strong>
                  <p>
                    {item.found && item.position
                      ? `Manual priority is ranking around position #${item.position}`
                      : `${item.error || `Manual priority is not found in top ${item.results_scanned || 20} results yet`}`}
                  </p>
                </div>
                <code>
                  {item.checked_at
                    ? `${item.source === 'duckduckgo_fallback' ? 'DuckDuckGo fallback' : 'Google'} - Checked ${new Date(item.checked_at).toLocaleString()}`
                    : 'Waiting for rank check'}
                </code>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card seo-automation-card-wide">
          <h4>Google rank tracker</h4>
          <div className="seo-automation-opportunities">
            {(snapshot?.rankings || []).map((item) => (
              <div key={item.keyword} className="seo-automation-opportunity">
                <div>
                  <strong>{item.keyword}</strong>
                  <p>
                    {item.found && item.position
                      ? `Currently around Google position #${item.position}`
                      : `${item.error || `Not found in top ${item.results_scanned || 20} results yet`}`}
                  </p>
                </div>
                <code>
                  {item.checked_at
                    ? `${item.source === 'duckduckgo_fallback' ? 'DuckDuckGo fallback' : 'Google'} - Checked ${new Date(item.checked_at).toLocaleString()}`
                    : 'Waiting for rank check'}
                </code>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card">
          <h4>Strongest existing keywords</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.strongest_keywords || []).map((item) => (
              <div key={item.keyword} className="seo-automation-chip">
                <strong>{item.keyword}</strong>
                <span>{`Score ${item.score || 0} - Hits ${item.hits || 0}`}</span>
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
                <span>{`Clicks ${item.clicks || 0} - Score ${item.score || 0}`}</span>
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
                <span>{`${item.hits || 0} searches - ${String(item.source || 'signal').replaceAll('_', ' ')}`}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="seo-automation-card">
          <h4>Manual keyword suggestions</h4>
          <div className="seo-automation-chip-list">
            {(snapshot?.manual_suggestions || []).map((keyword) => (
              <div key={`${keyword}-manual`} className="seo-automation-chip">
                <strong>{keyword}</strong>
                <span>Manual priority</span>
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
                <span>{`${String(item.source || 'harvest').replaceAll('_', ' ')} - Weight ${item.weight || 1}`}</span>
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
                    <span>{`${item.impressions} impressions - ${item.clicks} clicks`}</span>
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
