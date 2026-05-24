import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/bot', () => ({
  getBot: vi.fn(),
}));

const setEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = 'test:0123456789';
  process.env.BOT_USERNAME = 'test_bot';
  process.env.BOOTSTRAP_ADMIN_TELEGRAM_ID = '1';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
  process.env.SESSION_SECRET = 'a'.repeat(32);
  process.env.TELEGRAM_WEBHOOK_SECRET = 'abc123';
};

describe('POST /api/bot/webhook', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv();
  });

  it('rejects requests without secret header', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }));
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong secret', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'wrong',
        'content-type': 'application/json',
      },
      body: '{}',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON', async () => {
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'abc123',
        'content-type': 'application/json',
      },
      body: 'not json',
    }));
    expect(res.status).toBe(400);
  });

  it('dispatches valid update to bot.handleUpdate and returns 200', async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    const { getBot } = await import('@/server/bot');
    (getBot as ReturnType<typeof vi.fn>).mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      handleUpdate: handle,
    });
    const { POST } = await import('@/app/api/bot/webhook/route');
    const update = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 1, type: 'private' },
        text: '/start',
      },
    };
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'abc123',
        'content-type': 'application/json',
      },
      body: JSON.stringify(update),
    }));
    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalledWith(update);
  });

  it('returns 200 even if handler throws (logs error)', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('boom'));
    const { getBot } = await import('@/server/bot');
    (getBot as ReturnType<typeof vi.fn>).mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      handleUpdate: handle,
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/bot/webhook/route');
    const res = await POST(new Request('http://x/api/bot/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'abc123',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ update_id: 1 }),
    }));
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
