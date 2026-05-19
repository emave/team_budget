import { env } from '@/server/env';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const e = env();
  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Team Budget — Sign in</h1>
      <p>Sign in with your Telegram account to access the team budget.</p>
      <script async src="https://telegram.org/js/telegram-widget.js?22" />
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
    </main>
  );
}
