'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getNextContact, searchContacts, getContactById,
  submitCallData, skipContactAPI,
  backupSave, removeBackup, getPendingSaves, retryPendingSaves
} from '@/lib/api';

const STATUS_OPTIONS = [
  { label: '✅ Attending (Yes)', value: 'Attending' },
  { label: '⏳ Call Back / Maybe', value: 'Call Back' },
  { label: '❌ Not Attending', value: 'Not Attending' },
  { label: '📵 No Answer / Voicemail', value: 'No Answer / Voicemail' },
  { label: '🚫 Incorrect Number', value: 'Incorrect Number' },
  { label: '🗑️ Remove from Database', value: 'Remove from Database' },
];

const INCENTIVE_OPTIONS = [
  'Singles Connections', 'Career & Business',
  'Personalised Prayers', 'Pictures with Artists'
];

const CALL_SCRIPT = [
  { title: '1. Introduction', icon: 'comment-dots', lines: [
    { type: 'dialogue', text: 'Hello, my name is {NAME}, I am calling on behalf of Pastor Bolaji of the Next Level Prayer Conference Team. Just wanted to quickly check in, do you have a minute?' },
    { type: 'dialogue', text: 'I just wanted to confirm, are you aware of Next Level Prayer (NLP) UK & Europe 2026 happening at the Excel London on the 16th of May?' },
    { type: 'instruction', text: 'If YES:' },
    { type: 'dialogue', text: "Perfect, that's great." },
    { type: 'instruction', text: 'If NO:' },
    { type: 'dialogue', text: 'No worries at all, let me quickly share. NLP is a powerful prayer and worship gathering where people come together for clarity, direction, healings and real transformation.' },
  ]},
  { title: '2. Invitation', icon: 'ticket-alt', lines: [
    { type: 'dialogue', text: 'I would love to personally invite you to attend, Are you planning to be there?' },
    { type: 'instruction', text: 'If YES / MAYBE:' },
    { type: 'dialogue', text: 'That is great. Can I quickly confirm, should I count you as attending? (Goal: Get a Firm Yes)' },
  ]},
  { title: '3. Push Incentives', icon: 'star', lines: [
    { type: 'dialogue', text: 'Also, we have created a few side attractions for attendees this year. Would you be interested in any of these?' },
    { type: 'instruction', text: 'Let them choose, check all that apply:' },
  ]},
  { title: '4. End', icon: 'door-open', lines: [
    { type: 'dialogue', text: 'Honestly, it is one of those moments you do not want to miss. I will strongly encourage you to plan for it properly. Thank you for your time.' },
  ]},
];

export default function PortalPage() {
  const router = useRouter();
  const [callerName, setCallerName] = useState('');
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState('');
  const [incentives, setIncentives] = useState([]);
  const [transport, setTransport] = useState('');
  const [childrenCount, setChildrenCount] = useState('');
  const [otherAdults, setOtherAdults] = useState('');
  const [comment, setComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimer = useRef(null);
  const hasLoadedRef = useRef(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  function resetForm() {
    setStatus(''); setIncentives([]); setTransport('');
    setChildrenCount(''); setOtherAdults(''); setComment('');
  }

  function formatPhone(phone) {
    if (!phone) return '';
    let num = String(phone).trim().replace(/[\s\-\(\)]/g, '');
    if (num.startsWith('+447')) return num;
    if (num.startsWith('447')) return '+' + num;
    if (num.startsWith('07')) return num;
    if (num.startsWith('7')) return '+44' + num;
    return phone;
  }

  // Init — check session
  useEffect(() => {
    const saved = sessionStorage.getItem('callerName');
    if (!saved) { router.push('/'); return; }
    setCallerName(saved);
    const pending = getPendingSaves();
    if (pending.length > 0) {
      setPendingCount(pending.length);
      retryPendingSaves().then(() => setPendingCount(getPendingSaves().length));
    }
  }, [router]);

  // Load first contact
  useEffect(() => {
    if (callerName && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadNext();
    }
  }, [callerName]);

  async function loadNext() {
    if (!callerName) return;
    setLoading(true); resetForm();
    try {
      const data = await getNextContact(callerName);
      setContact(!data || data.empty ? null : data);
    } catch (err) { showToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }

  // Search debounce
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchContacts(searchQuery);
        setSearchResults(Array.isArray(r) ? r : []);
      } catch { setSearchResults([]); }
    }, 400);
  }, [searchQuery]);

  async function loadById(id) {
    setSearchQuery(''); setSearchResults([]); setLoading(true); resetForm();
    try {
      const data = await getContactById(id, callerName);
      if (!data) { showToast('Contact not found', 'error'); loadNext(); return; }
      if (data.locked) { showToast(`Lead is being called by ${data.lockedBy}`, 'error'); loadNext(); return; }
      if (data.alreadyCalled && !confirm(`Already called by ${data.previousCaller || 'someone'} (${data.status}). Call again?`)) { loadNext(); return; }
      setContact(data);
    } catch { showToast('Error loading contact', 'error'); loadNext(); }
    finally { setLoading(false); }
  }

  function toggleIncentive(v) {
    setIncentives(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  }

  async function handleSubmit(retry = 0) {
    if (!status) { showToast('Please select a call outcome', 'error'); return; }
    if (!contact) return;
    setSaving(true);
    const payload = { id: contact.id, rowIndex: contact.rowIndex, status, callerInitials: callerName, comment: comment || '' };
    if (status === 'Attending' || status === 'Call Back') {
      payload.incentives = incentives; payload.transport = transport;
      payload.children = childrenCount; payload.otherAdults = otherAdults;
    }
    if (retry === 0) backupSave(payload);
    try {
      await submitCallData(payload);
      removeBackup(payload.id);
      showToast('✅ Saved successfully!');
      setTimeout(() => { setSaving(false); loadNext(); }, 600);
    } catch (err) {
      if (retry < 3) {
        showToast(`⏳ Retrying (${retry + 2}/4)...`, 'error');
        setTimeout(() => handleSubmit(retry + 1), (retry + 1) * 2000);
      } else {
        showToast('❌ Save failed. Data backed up locally.', 'error');
        setSaving(false); setPendingCount(getPendingSaves().length);
      }
    }
  }

  async function handleSkip() {
    if (!contact) return;
    try { await skipContactAPI(contact.id, contact.rowIndex); } catch {}
    loadNext();
  }

  function changeName() {
    const n = prompt('Change your caller name:', callerName);
    if (n?.trim()) { const u = n.trim().toUpperCase(); setCallerName(u); sessionStorage.setItem('callerName', u); }
  }

  async function handleLogout() {
    if (contact) { try { await skipContactAPI(contact.id, contact.rowIndex); } catch {} }
    sessionStorage.removeItem('callerName'); router.push('/');
  }

  const showInc = status === 'Attending' || status === 'Call Back';

  if (!callerName) return <div className="loading-state" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner spinner-lg"></div></div>;

  return (
    <>
      <header className="app-header">
        <h1>NLP UK &amp; Europe 2026</h1>
        <div className="subtitle">Call Campaign Portal</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span className="caller-badge" onClick={changeName} style={{ cursor: 'pointer' }}>
            <i className="fas fa-user"></i> {callerName} <i className="fas fa-pen" style={{ fontSize: '0.65rem', marginLeft: '2px' }}></i>
          </span>
          <a href="/dashboard" className="caller-badge" style={{ background: 'var(--bg-elevated)', textDecoration: 'none', color: 'var(--text-primary)' }}>
            <i className="fas fa-chart-line"></i> Dashboard
          </a>
          <button onClick={handleLogout} className="caller-badge" style={{ background: 'var(--danger)', border: 'none', cursor: 'pointer', color: 'white' }}>
            <i className="fas fa-sign-out-alt"></i> Exit
          </button>
        </div>
      </header>

      <div className="page-container">
        {pendingCount > 0 && (
          <div className="card" style={{ background: 'var(--warning-bg)', border: '2px solid var(--warning)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div><strong style={{ color: 'var(--warning)' }}>⚠️ {pendingCount} unsaved call(s)</strong><br /><small className="text-muted">Click Retry to recover.</small></div>
            <button className="btn btn-primary btn-sm" onClick={async () => { await retryPendingSaves(); setPendingCount(getPendingSaves().length); }}>Retry Now</button>
          </div>
        )}

        <div className="card" style={{ marginBottom: '1rem' }}>
          <input type="text" className="form-input" placeholder="🔍 Search leads by name or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchResults.length > 0 && <div style={{ marginTop: '8px' }}>{searchResults.map(item => {
            const locked = item.status === 'In Progress';
            return (<div key={item.id} className={`search-result ${locked ? 'locked' : ''}`} onClick={() => !locked && loadById(item.id)}>
              <div><strong>{item.name}</strong><br /><small className="text-muted"><i className="fas fa-phone"></i> {formatPhone(item.phone)}</small></div>
              {locked && <span className="badge badge-warning"><i className="fas fa-lock"></i> In Progress</span>}
              {item.status === 'Attending' && <span className="badge badge-success">✅ Attending</span>}
            </div>);
          })}</div>}
        </div>

        {loading ? (
          <div className="card loading-state"><div className="spinner spinner-lg"></div><p className="mt-2">Fetching next lead...</p></div>
        ) : !contact ? (
          <div className="card text-center" style={{ padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ color: 'var(--gold)' }}>All Leads Attempted!</h2>
            <p className="text-muted mt-1">The queue is empty. Great job!</p>
            <button onClick={loadNext} className="btn btn-primary mt-3"><i className="fas fa-sync-alt"></i> Check Again</button>
          </div>
        ) : (
          <div className="card card-accent">
            <div className="text-center mb-2">
              <div className="contact-name">{contact.name}</div>
              <a href={`tel:${formatPhone(contact.phone)}`} className="btn-call">
                <i className="fas fa-phone-alt"></i> Call: {formatPhone(contact.phone)}
              </a>
            </div>

            {CALL_SCRIPT.map((s, i) => (
              <div key={i} className="script-box">
                <h3><i className={`fas fa-${s.icon}`}></i> {s.title}</h3>
                {s.lines.map((l, j) => (
                  <div key={j} className={l.type === 'instruction' ? 'script-instruction' : 'script-dialogue'}>
                    {l.type === 'dialogue' ? `"${l.text.replace('{NAME}', callerName)}"` : l.text}
                  </div>
                ))}
              </div>
            ))}

            <div className="form-group" style={{ borderTop: '2px dashed var(--border)', paddingTop: '1.5rem' }}>
              <label className="form-label">Call Outcome / Status</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">-- Select Status --</option>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {showInc && (
              <div className="conditional-panel">
                <div className="form-group"><div className="checkbox-grid">
                  {INCENTIVE_OPTIONS.map(inc => (
                    <label key={inc} className="checkbox-item">
                      <input type="checkbox" checked={incentives.includes(inc)} onChange={() => toggleIncentive(inc)} /> {inc}
                    </label>
                  ))}
                </div></div>
                <div className="form-group"><label className="form-label"><i className="fas fa-bus"></i> Bus transportation?</label>
                  <input type="text" className="form-input" placeholder="City & Postcode (blank if No)" value={transport} onChange={e => setTransport(e.target.value)} /></div>
                <div className="form-group"><label className="form-label"><i className="fas fa-child"></i> Children?</label>
                  <input type="number" className="form-input" min="0" placeholder="Number" value={childrenCount} onChange={e => setChildrenCount(e.target.value)} /></div>
                <div className="form-group"><label className="form-label"><i className="fas fa-user-friends"></i> Other adults?</label>
                  <textarea className="form-textarea" placeholder="Name, Email, Phone..." value={otherAdults} onChange={e => setOtherAdults(e.target.value)}></textarea></div>
              </div>
            )}

            <div className="form-group mt-2"><label className="form-label">Comments / Notes</label>
              <textarea className="form-textarea" placeholder="Any extra notes?" value={comment} onChange={e => setComment(e.target.value)}></textarea></div>

            <button onClick={() => handleSubmit()} className="btn btn-primary btn-full btn-lg" disabled={saving}>
              {saving ? <><span className="spinner"></span> SAVING...</> : <><i className="fas fa-save"></i> Save &amp; Next Lead</>}
            </button>
            <button onClick={handleSkip} className="btn btn-dark btn-full mt-1" disabled={saving}>
              <i className="fas fa-forward"></i> Skip This Lead
            </button>
          </div>
        )}
      </div>

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type} show`}>{toast.message}</div></div>}
    </>
  );
}
