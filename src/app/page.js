'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EntryPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // If already have a session, go straight to portal
  useEffect(() => {
    const saved = sessionStorage.getItem('callerName');
    if (saved) {
      router.push('/portal');
    } else {
      setLoading(false);
    }
  }, [router]);

  function handleStart(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    sessionStorage.setItem('callerName', trimmed.toUpperCase());
    router.push('/portal');
  }

  if (loading) {
    return (
      <div className="login-container">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nlp-banner.jpg"
          alt="Next Level Music & Prayer Festival — Saturday 16th May, 2026 — Excel London"
          style={{
            width: '100%',
            maxWidth: '380px',
            borderRadius: '16px',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        />
        <h1>NLP UK &amp; Europe 2026</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Call Campaign Portal</p>

        <form onSubmit={handleStart}>
          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Enter your full name (e.g. KINGSLEY JOHN)"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={40}
              style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '1.1rem', fontWeight: 600 }}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg">
            Start Calling <i className="fas fa-arrow-right"></i>
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          No account needed — just enter your name and go.
        </p>
      </div>
    </div>
  );
}
