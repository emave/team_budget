import { resolveLocaleForRequest } from '@/server/i18n/resolve';
import { getMessages } from '@/shared/i18n';
import { LocaleChip } from './locale-chip';

export async function MiniHeader() {
  const locale = await resolveLocaleForRequest();
  const m = getMessages(locale);
  return (
    <header className="mini-header">
      <span className="mini-header__brand">{m.brand}</span>
      <LocaleChip />
    </header>
  );
}
