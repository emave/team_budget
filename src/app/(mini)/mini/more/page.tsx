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

      <MiniSection heading={m.mini.activitySection}>
        <MiniLinkRow
          href="/mini/spendings"
          title={<>🛒 {m.nav.spendings}</>}
          subtitle={<span>{m.mini.moreOnSpendings}</span>}
        />
        {isAdmin && (
          <MiniLinkRow
            href="/mini/history"
            title={<>📈 {m.mini.viewHistory}</>}
            subtitle={<span>{m.mini.moreOnHistory}</span>}
          />
        )}
      </MiniSection>

      {isAdmin && (
        <MiniSection heading={m.mini.adminSection}>
          <MiniLinkRow
            href="/mini/guests"
            title={<>👥 {m.nav.guests}</>}
            subtitle={<span>{m.mini.moreOnGuests}</span>}
          />
          <MiniLinkRow
            href="/mini/settings"
            title={<>⚙️ {m.nav.settings}</>}
            subtitle={<span>{m.mini.moreOnSettings}</span>}
          />
        </MiniSection>
      )}

      <MiniSection heading={m.mini.teamSection}>
        <MiniLinkRow
          href="/mini/info"
          title={<>ℹ️ {m.mini.infoTitle}</>}
          subtitle={<span>{m.mini.moreOnInfo}</span>}
        />
      </MiniSection>

      <MiniTabs />
    </>
  );
}
