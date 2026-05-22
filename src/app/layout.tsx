import type { Viewport } from 'next';
import { Providers } from './providers';
import { I18nProvider } from './_i18n-provider';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { FONT_FAMILY } from '@/ui/fonts';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata() {
  const locale = await resolveLocaleForRequest();
  return { title: getMessages(locale).brand };
}

const globalCss = `
html, body {
  font-family: ${FONT_FAMILY};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
}
button, input, select, textarea {
  font-family: inherit;
}
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveLocaleForRequest();
  return (
    <html lang={locale}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
