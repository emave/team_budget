import { Providers } from './providers';
import { I18nProvider } from './_i18n-provider';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';

export async function generateMetadata() {
  const locale = await resolveLocaleForRequest();
  return { title: getMessages(locale).brand };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocaleForRequest();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
