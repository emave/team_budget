'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '@/app/_i18n-provider';

type State = 'init' | 'authing' | 'error' | 'no-telegram';

export function MiniAuthGate() {
  const m = useMessages();
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
          <h2 style={{ marginBottom: 8, color: 'var(--mini-text)' }}>{m.mini.openInTelegramTitle}</h2>
          <p style={{ color: 'var(--mini-hint)' }}>{m.mini.openInTelegramBody}</p>
        </>
      )}
      {(state === 'init' || state === 'authing') && (
        <p style={{ color: 'var(--mini-hint)' }}>{m.mini.signingIn}</p>
      )}
      {state === 'error' && (
        <>
          <h2 style={{ marginBottom: 8, color: 'var(--mini-text)' }}>{m.mini.signInFailed}</h2>
          <p style={{ color: 'var(--mini-danger-fg)' }}>{msg}</p>
        </>
      )}
    </main>
  );
}
