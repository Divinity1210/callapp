'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDashboardData } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('date');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const param = viewType === 'allTime' ? 'allTime' : selectedDate;
      if (!param) return;
      const result = await getDashboardData(param);
      if (result && !result.error) setData(result);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [viewType, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const progressPct = data ? Math.round((data.global.attempted / Math.max(data.global.total, 1)) * 100) : 0;
  const remaining = data ? data.global.total - data.global.attempted - data.global.inProgress : 0;
  const s = data?.filtered?.statuses || {};
  const attending = s['Attending'] || 0;
  const notAttending = s['Not Attending'] || 0;
  const noAnswer = s['No Answer / Voicemail'] || 0;
  const invalid = s['Incorrect Number'] || 0;
  const remove = s['Remove from Database'] || 0;
  const callBack = s['Call Back'] || 0;
  const filteredTotal = attending + notAttending + noAnswer + invalid + remove + callBack;

  const callersSorted = data ? Object.entries(data.filtered?.callers || {})
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total) : [];

  const timeLabel = viewType === 'allTime' ? 'All-Time' : selectedDate;
  const inc = data?.filtered?.incentives || {};

  return (
    <div className="page-wide">
      {/* Header */}
      <div className="card card-accent" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>
          <i className="fas fa-fire-alt" style={{ color: 'var(--accent)' }}></i> NLP 2026 Dashboard
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 'auto' }} value={viewType} onChange={e => setViewType(e.target.value)}>
            <option value="date">📅 Specific Date</option>
            <option value="allTime">🌍 All-Time</option>
          </select>
          {viewType === 'date' && (
            <input type="date" className="form-input" style={{ width: 'auto' }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          )}
          <button onClick={fetchData} className="btn btn-primary btn-sm"><i className="fas fa-sync-alt"></i> Refresh</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto (30s)
          </label>
          <a href="/portal" className="btn btn-dark btn-sm"><i className="fas fa-phone"></i> Portal</a>
        </div>
      </div>

      {loading ? (
        <div className="loading-state mt-3"><div className="spinner spinner-lg"></div><p className="mt-2">Compiling statistics...</p></div>
      ) : data && (
        <div className="grid-3 mt-2">
          {/* Overall Progress */}
          <div className="card">
            <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '12px' }}>
              Overall Progress
              {data.global.inProgress > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                  <i className="fas fa-headset"></i> {data.global.inProgress} active
                </span>
              )}
            </h2>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }}>{progressPct}%</div>
            </div>
            <div className="stat-row"><span className="stat-label">Total Leads</span><span className="stat-value">{(data.global.total || 0).toLocaleString()}</span></div>
            <div className="stat-row"><span className="stat-label">Leads Called</span><span className="stat-value">{(data.global.attempted || 0).toLocaleString()}</span></div>
            <div className="stat-row"><span className="stat-label">Currently Active</span><span className="stat-value" style={{ color: 'var(--accent)' }}>{data.global.inProgress || 0}</span></div>
            <div className="stat-row"><span className="stat-label">Remaining</span><span className="stat-value stat-highlight">{remaining.toLocaleString()}</span></div>
          </div>

          {/* Outcomes */}
          <div className="card card-accent">
            <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '12px' }}>
              Outcomes — {timeLabel}
            </h2>
            <div className="stat-row" style={{ background: 'var(--accent-glow)', padding: '8px', borderRadius: '6px' }}>
              <span className="stat-label" style={{ color: 'var(--accent-light)', fontWeight: 700 }}>Total Calls</span>
              <span className="stat-value stat-highlight">{filteredTotal}</span>
            </div>
            <div className="stat-row"><span className="stat-label">✅ Attending</span><span className="stat-value stat-highlight">{attending}</span></div>
            <div className="stat-row"><span className="stat-label">❌ Not Attending</span><span className="stat-value">{notAttending}</span></div>
            <div className="stat-row"><span className="stat-label">⏳ Call Back</span><span className="stat-value">{callBack}</span></div>
            <div className="stat-row"><span className="stat-label">📵 No Answer</span><span className="stat-value">{noAnswer}</span></div>
            <div className="stat-row"><span className="stat-label">🚫 Incorrect</span><span className="stat-value">{invalid}</span></div>
            <div className="stat-row"><span className="stat-label">🗑️ Removed</span><span className="stat-value">{remove}</span></div>
          </div>

          {/* Logistics */}
          <div className="card">
            <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '12px' }}>
              Logistics — {timeLabel}
            </h2>
            <div className="stat-row"><span className="stat-label">🚌 Transport Requests</span><span className="stat-value stat-highlight">{data.filtered?.transportRequests || 0}</span></div>
            <div className="stat-row"><span className="stat-label">👶 Children Expected</span><span className="stat-value stat-highlight">{data.filtered?.totalChildren || 0}</span></div>
            <div className="stat-row"><span className="stat-label">💍 Singles Connection</span><span className="stat-value">{inc.singles || 0}</span></div>
            <div className="stat-row"><span className="stat-label">💼 Career &amp; Business</span><span className="stat-value">{inc.career || 0}</span></div>
            <div className="stat-row"><span className="stat-label">🙏 Personal Prayers</span><span className="stat-value">{inc.prayers || 0}</span></div>
            <div className="stat-row"><span className="stat-label">📸 Artist Pictures</span><span className="stat-value">{inc.pictures || 0}</span></div>
          </div>

          {/* Caller Leaderboard */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '12px' }}>
              <i className="fas fa-trophy" style={{ color: 'var(--gold)' }}></i> Volunteer Performance — {timeLabel}
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>#</th><th>Name / Initials</th><th style={{ textAlign: 'center' }}>Calls Made</th><th style={{ textAlign: 'center' }}>&quot;Attending&quot; Secured</th></tr></thead>
                <tbody>
                  {callersSorted.length === 0 ? (
                    <tr><td colSpan="4" className="text-center text-muted" style={{ padding: '2rem' }}>No calls for this timeframe</td></tr>
                  ) : callersSorted.map((c, i) => (
                    <tr key={c.name}>
                      <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                      <td><strong>{c.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>{c.total}</td>
                      <td style={{ textAlign: 'center', color: 'var(--accent-light)', fontWeight: 700 }}>{c.attending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
