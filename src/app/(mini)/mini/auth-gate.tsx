'use client';

import { useEffect, useState } from 'react';

type State = 'init' | 'authing' | 'error' | 'no-telegram';

export function MiniAuthGate() {
  const [state, setState] = useState<State>('init');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) {
      setState('no-telegram');
      return;
    }
    setState('authing');
    fetch('/api/auth/telegram/mini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    })
      .then(async (res) => {
        if (res.ok) {
          window.location.reload();
        } else {
          const text = await res.text();
          setState('error');
          setMsg(text || `HTTP ${res.status}`);
        }
      })
      .catch((err: unknown) => {
        setState('error');
        setMsg(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <main style={{ padding: 24, textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
      {state === 'no-telegram' && (
        <>
          <h2 style={{ marginBottom: 8 }}>Open in Telegram</h2>
          <p style={{ color: '#666' }}>This Mini App works only inside the Telegram app.</p>
        </>
      )}
      {(state === 'init' || state === 'authing') && (
        <p style={{ color: '#666' }}>Signing in…</p>
      )}
      {state === 'error' && (
        <>
          <h2 style={{ marginBottom: 8 }}>Sign-in failed</h2>
          <p style={{ color: '#b91c1c' }}>{msg}</p>
        </>
      )}
    </main>
  );
}
