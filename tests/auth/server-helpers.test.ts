import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

describe('server-helpers smoke', () => {
  it('module loads', async () => {
    const m = await import('@/server/auth/server-helpers');
    expect(typeof m.getCurrentUser).toBe('function');
    expect(typeof m.requireUser).toBe('function');
    expect(typeof m.requireAdmin).toBe('function');
  });
});
