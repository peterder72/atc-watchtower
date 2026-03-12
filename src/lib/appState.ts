import { type AppState, createAirportKey } from '../domain/models';
import { consolidateStoredPacks, listAirportEntries } from './feedPacks';

function remapAirportKey(airportKey: string | null, packIdMap: Record<string, string>): string | null {
  if (!airportKey) {
    return null;
  }

  const [packId, icao] = airportKey.split('::');
  if (!packId || !icao) {
    return airportKey;
  }

  return createAirportKey(packIdMap[packId] ?? packId, icao);
}

export function normalizeAppState(
  previous: AppState,
  nextPacks: AppState['packs'],
  preferredAirportKeys: Array<string | null> = []
): AppState {
  const consolidation = consolidateStoredPacks(nextPacks);
  const airports = listAirportEntries(consolidation.packs);
  const availableAirportKeys = new Set(airports.map((entry) => entry.key));
  const availableFeedIds = new Set(
    consolidation.packs.flatMap((pack) => pack.airports.flatMap((airport) => airport.feeds.map((feed) => feed.id)))
  );

  const selectedAirportKey =
    [...preferredAirportKeys, previous.selectedAirportKey]
      .map((airportKey) => remapAirportKey(airportKey, consolidation.packIdMap))
      .find((airportKey): airportKey is string => {
        if (!airportKey) {
          return false;
        }

        return availableAirportKeys.has(airportKey);
      }) ??
    airports[0]?.key ??
    null;

  return {
    packs: consolidation.packs,
    selectedFeedIds: previous.selectedFeedIds
      .map((feedId) => consolidation.feedIdMap[feedId] ?? feedId)
      .filter((feedId, index, collection) => availableFeedIds.has(feedId) && collection.indexOf(feedId) === index),
    selectedAirportKey
  };
}
