import Link from 'next/link';

export function MiniBack({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="mini-back">
      {children}
    </Link>
  );
}
