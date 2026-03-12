import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateStreamUrlMock = vi.hoisted(() => vi.fn());

vi.mock('./streams', () => ({
  validateStreamUrl: validateStreamUrlMock
}));

import { importFeedFiles, STREAM_VALIDATION_CONCURRENCY } from './importFeeds';

function createPlaylistFile(fileName: string, urls: string[]) {
  const body = `#EXTM3U
${urls.map((streamUrl, index) => `#EXTINF:-1,EHAM Feed ${index + 1}\n${streamUrl}`).join('\n')}`;

  return {
    name: fileName,
    text: async () => body
  } as File;
}

beforeEach(() => {
  validateStreamUrlMock.mockReset();
});

describe('importFeedFiles', () => {
  it('limits concurrent stream validation requests', async () => {
    const urls = Array.from(
      { length: STREAM_VALIDATION_CONCURRENCY + 4 },
      (_, index) => `https://example.com/stream-${index + 1}`
    );
    let activeCount = 0;
    let maxActiveCount = 0;

    validateStreamUrlMock.mockImplementation(async (streamUrl: string) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      await new Promise((resolve) => setTimeout(resolve, 0));

      activeCount -= 1;
      return {
        streamUrl,
        ok: true
      };
    });

    await importFeedFiles([createPlaylistFile('eham.m3u', urls)]);

    expect(validateStreamUrlMock).toHaveBeenCalledTimes(urls.length);
    expect(maxActiveCount).toBeLessThanOrEqual(STREAM_VALIDATION_CONCURRENCY);
  });

  it('reuses validation results across files in the same import batch', async () => {
    validateStreamUrlMock.mockImplementation(async (streamUrl: string) => ({
      streamUrl,
      ok: true
    }));

    await importFeedFiles([
      createPlaylistFile('eham.m3u', [
        'https://example.com/shared',
        'https://example.com/tower'
      ]),
      createPlaylistFile('eham-2.m3u', [
        'https://example.com/shared',
        'https://example.com/ground'
      ])
    ]);

    expect(validateStreamUrlMock).toHaveBeenCalledTimes(3);
  });
});
