import type { ImportNotice, StoredFeedPack } from '../domain/models';
import { createStoredFeedPack, filterPackByValidatedFeeds, parseFeedImport } from './feedPacks';
import { validateStreamUrl } from './streams';

export interface ImportFeedsResult {
  notices: ImportNotice[];
  packs: StoredFeedPack[];
}

export async function importFeedFiles(files: File[]): Promise<ImportFeedsResult> {
  const notices: ImportNotice[] = [];
  const packs: StoredFeedPack[] = [];

  for (const file of files) {
    try {
      const parsedPack = parseFeedImport(file.name, await file.text());
      const uniqueUrls = [...new Set(parsedPack.airports.flatMap((airport) => airport.feeds.map((feed) => feed.streamUrl)))];
      const validations = Object.fromEntries(
        await Promise.all(uniqueUrls.map(async (streamUrl) => [streamUrl, await validateStreamUrl(streamUrl)] as const))
      );
      const filteredPack = filterPackByValidatedFeeds(parsedPack, validations);

      for (const result of Object.values(validations)) {
        if (!result.ok) {
          notices.push({
            fileName: file.name,
            level: 'warning',
            message: `${result.streamUrl} was skipped: ${result.reason ?? 'not browser-readable'}`
          });
        }
      }

      if (filteredPack.airports.length === 0) {
        notices.push({
          fileName: file.name,
          level: 'error',
          message: 'No compatible direct stream URLs remained after validation.'
        });
        continue;
      }

      packs.push(createStoredFeedPack(filteredPack, file.name));
      const airportSummary = filteredPack.airports.length === 1 ? ` into ${filteredPack.airports[0].icao}` : '';
      notices.push({
        fileName: file.name,
        level: 'info',
        message: `Imported ${filteredPack.airports.reduce((sum, airport) => sum + airport.feeds.length, 0)} compatible feeds${airportSummary}.`
      });
    } catch (error) {
      notices.push({
        fileName: file.name,
        level: 'error',
        message: error instanceof Error ? error.message : 'Import failed.'
      });
    }
  }

  return {
    notices,
    packs
  };
}
