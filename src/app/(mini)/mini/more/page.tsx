import { requireUser } from '@/server/auth/server-helpers';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniLinkRow } from '../../_components/mini-link-row';

export default async function MiniMorePage() {
  const user = await requireUser();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';

  return (
    <>
      <MiniInit />
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.mini.moreTitle}
      </h2>

      <MiniSection>
        <MiniLinkRow
          href="/mini/people"
          title={<>👤 {m.nav.people}</>}
          subtitle={<span>{m.mini.moreOnPeople}</span>}
        />
        {isAdmin && (
          <MiniLinkRow
            href="/mini/history"
            title={<>📈 {m.mini.viewHistory}</>}
            subtitle={<span>{m.mini.moreOnHistory}</span>}
          />
        )}
        <MiniLinkRow
          href="/mini/handbook"
          title={<>ℹ️ {m.mini.infoTitle}</>}
          subtitle={<span>{m.mini.moreOnInfo}</span>}
        />
        {isAdmin && (
          <MiniLinkRow
            href="/mini/settings"
            title={<>⚙️ {m.nav.settings}</>}
            subtitle={<span>{m.mini.moreOnSettings}</span>}
          />
        )}
      </MiniSection>

      <MiniTabs />
    </>
  );
}
