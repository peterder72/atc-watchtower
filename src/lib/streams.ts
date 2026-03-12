import type { FeedValidationResult } from '../domain/models';

const DEFAULT_VALIDATION_TIMEOUT_MS = 7000;

export async function validateStreamUrl(
  streamUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_VALIDATION_TIMEOUT_MS
): Promise<FeedValidationResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(streamUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        Accept: 'audio/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return {
        streamUrl,
        ok: false,
        status: response.status,
        reason: `HTTP ${response.status}`
      };
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('audio') && !contentType.includes('mpeg') && !contentType.includes('aac')) {
      return {
        streamUrl,
        ok: false,
        status: response.status,
        contentType,
        reason: `Unexpected content type: ${contentType || 'unknown'}`
      };
    }

    if (response.body) {
      const reader = response.body.getReader();
      const firstChunk = await reader.read();
      await reader.cancel().catch(() => undefined);

      if (firstChunk.done || !firstChunk.value?.length) {
        return {
          streamUrl,
          ok: false,
          status: response.status,
          contentType,
          reason: 'Stream returned no readable audio bytes.'
        };
      }
    }

    return {
      streamUrl,
      ok: true,
      status: response.status,
      contentType
    };
  } catch (error) {
    return {
      streamUrl,
      ok: false,
      reason: error instanceof Error ? error.message : 'Unknown validation error'
    };
  } finally {
    clearTimeout(timeout);
  }
}
