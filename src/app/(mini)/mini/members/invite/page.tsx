import { requireAdmin } from '@/server/auth/server-helpers';
import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { MiniInit } from '../../init';
import { MiniBack } from '../../../_components/mini-back';
import { InviteForm } from './invite-form';

export default async function MiniInvitePage() {
  await requireAdmin();
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <>
      <MiniInit />
      <MiniBack href="/mini/members">{m.mini.back}</MiniBack>
      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: 'var(--mini-text)' }}>
        {m.members.inviteModalTitle}
      </h2>
      <InviteForm />
    </>
  );
}
