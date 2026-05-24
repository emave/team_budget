'use client';

import { useState, useTransition } from 'react';
import { useMessages } from '@/app/_i18n-provider';
import { inviteMember } from '@/server/actions/members-server';
import { MiniField, MiniInput } from '../../../_components/mini-field';
import { MiniButton } from '../../../_components/mini-button';

export function InviteForm() {
  const m = useMessages();
  const [hint, setHint] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const inv = await inviteMember({ displayNameHint: hint || undefined });
        const botUsername =
          (window as { __BOT_USERNAME__?: string }).__BOT_USERNAME__ ?? '';
        const url = botUsername
          ? `https://t.me/${botUsername}?start=invite_${inv.token}`
          : `invite_${inv.token}`;
        setLink(url);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function copyLink() {
    if (!link) return;
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } catch {
      /* ignore */
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => undefined,
      );
    }
  }

  if (link) {
    return (
      <>
        <p style={{ fontSize: 14, color: 'var(--mini-text)' }}>{m.members.shareLink}</p>
        <button
          type="button"
          onClick={copyLink}
          className="mini-button mini-button--secondary"
          style={{ wordBreak: 'break-all', textAlign: 'left', justifyContent: 'flex-start' }}
          title={m.mini.inviteCopyHint}
        >
          {link}
        </button>
        <p className="mini-helper">
          {copied ? m.mini.copied : m.mini.inviteCopyHint}
        </p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <MiniField label={m.members.displayNameLabel}>
        <MiniInput
          placeholder={m.members.displayNamePlaceholder}
          value={hint}
          onChange={(e) => setHint(e.currentTarget.value)}
        />
      </MiniField>
      <MiniButton type="submit" disabled={pending}>
        {pending ? '…' : m.members.generateLink}
      </MiniButton>
      {error && <div className="mini-error">{error}</div>}
    </form>
  );
}
