import { describe, expect, it, vi } from 'vitest';
import { validateStreamUrl } from './streams';

describe('validateStreamUrl', () => {
  it('accepts readable audio responses', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([255, 242, 32]), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg'
        }
      })
    );

    const result = await validateStreamUrl('https://example.com/live', fetchMock);

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects non-audio content types', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not audio', {
        status: 200,
        headers: {
          'Content-Type': 'text/html'
        }
      })
    );

    const result = await validateStreamUrl('https://example.com/live', fetchMock);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unexpected content type/i);
  });
});
