import { requireUser } from '@/server/auth/server-helpers';
import { getDb } from '@/server/db/client';
import { getMemberOutstandingDebt } from '@/server/domain/charges';
import { listMemberCreditBalances } from '@/server/domain/credit';
import { users } from '@/server/db/schema';
import { listPendingInvites } from '@/server/domain/invites';
import { formatCents } from '@/shared/format';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { formatDate, getMessages } from '@/shared/i18n';
import { MiniInit } from '../init';
import { MiniTabs } from '../tabs';
import { MiniSection } from '../../_components/mini-section';
import { MiniRow } from '../../_components/mini-row';
import { MiniBadge } from '../../_components/mini-badge';
import { MiniEmpty } from '../../_components/mini-empty';
import { MiniLinkRow } from '../../_components/mini-link-row';
import { MiniLinkButton } from '../../_components/mini-button';

export default async function MiniMembersPage() {
  const user = await requireUser();
  const db = getDb();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  const isAdmin = user.role === 'admin';

  const all = db.select().from(users).all();
  const [debts, credits] = await Promise.all([
    Promise.all(all.map((u) => getMemberOutstandingDebt(db, u.id))),
    listMemberCreditBalances(db),
  ]);
  const creditByUser = new Map(credits.map((c) => [c.userId, c.balance]));
  const rows = all.map((u, i) => ({
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    debt: debts[i] ?? 0,
    credit: creditByUser.get(u.id) ?? 0,
  }));

  const pendingInvites = isAdmin ? await listPendingInvites(db) : [];

  return (
    <>
      <MiniInit />
      <div className="mini-toolbar">
        <h2 style={{ fontSize: 18, margin: 0, color: 'var(--mini-text)', flex: 1 }}>
          {m.members.title}
        </h2>
        {isAdmin && (
          <MiniLinkButton href="/mini/members/invite" variant="primary" inline>
            {m.mini.inviteCta}
          </MiniLinkButton>
        )}
      </div>

      <MiniSection>
        {rows.length === 0 ? (
          <MiniEmpty>{m.common.none}</MiniEmpty>
        ) : (
          rows.map((r) => (
            <MiniLinkRow
              key={r.id}
              href={`/mini/members/${r.id}`}
              title={
                <>
                  {r.displayName}
                  {!r.isActive && (
                    <span style={{ color: 'var(--mini-hint)' }}> {m.common.inactive}</span>
                  )}
                </>
              }
              subtitle={
                <>
                  <span>
                    {r.role === 'admin' ? m.members.roleAdmin : m.members.roleMember}
                  </span>
                  {r.credit > 0 && (
                    <MiniBadge variant="success">{formatCents(r.credit)}</MiniBadge>
                  )}
                </>
              }
              right={
                r.debt > 0 ? (
                  <MiniBadge variant="danger">
                    {m.common.owesAmount(formatCents(r.debt))}
                  </MiniBadge>
                ) : (
                  <MiniBadge variant="success">{m.members.settledBadge}</MiniBadge>
                )
              }
            />
          ))
        )}
      </MiniSection>

      {isAdmin && (
        <MiniSection heading={m.members.pendingInvitesTitle}>
          {pendingInvites.length === 0 ? (
            <MiniEmpty>{m.members.noPendingInvites}</MiniEmpty>
          ) : (
            pendingInvites.map((p) => (
              <MiniRow
                key={p.id}
                title={p.displayNameHint || m.mini.linkPlaceholder}
                subtitle={<span>{formatDate(p.createdAt, locale)}</span>}
                right={
                  <MiniBadge variant="neutral">
                    {p.token.slice(0, 8)}…
                  </MiniBadge>
                }
              />
            ))
          )}
        </MiniSection>
      )}

      <MiniTabs />
    </>
  );
}
