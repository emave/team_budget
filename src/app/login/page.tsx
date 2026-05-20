import { env } from '@/server/env';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const e = env();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 8 }}>{m.auth.loginTitle}</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>{m.auth.loginSubtitle}</p>
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
