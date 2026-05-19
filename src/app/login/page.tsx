import { env } from '@/server/env';

export default function LoginPage() {
  const e = env();
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 8 }}>Team Budget</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>Sign in with your Telegram account.</p>
        <div
          dangerouslySetInnerHTML={{
            __html: `
            <script async src="https://telegram.org/js/telegram-widget.js?22"
              data-telegram-login="${e.BOT_USERNAME}"
              data-size="large"
              data-auth-url="${e.NEXT_PUBLIC_BASE_URL}/api/auth/telegram/callback"
              data-request-access="write"></script>
          `,
          }}
        />
      </div>
    </main>
  );
}
