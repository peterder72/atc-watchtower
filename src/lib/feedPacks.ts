import {
  type AirportDef,
  type FeedPackV1,
  type FeedDef,
  type FeedValidationResult,
  type StoredFeedPack,
  createAirportKey
} from '../domain/models';

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function parseIniLike(text: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith(';') || line.startsWith('[')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function inferAirportIdentity(label: string, fileName: string): Pick<AirportDef, 'icao' | 'name'> {
  const candidate = label.match(/\b([A-Z]{4})\b/)?.[1] ?? stripExtension(fileName).match(/\b([A-Z]{4})\b/i)?.[1];
  const icao = candidate?.toUpperCase() ?? 'IMPT';

  if (icao === 'IMPT') {
    return { icao, name: 'Imported feeds' };
  }

  return {
    icao,
    name: icao
  };
}

function inferFrequency(label: string): string | undefined {
  return label.match(/\b\d{3}(?:\.\d{1,3})?\b/)?.[0];
}

function createFeed(idSeed: string, label: string, streamUrl: string, defaultPriority: number): FeedDef {
  return {
    id: `${slugify(idSeed)}-${slugify(label) || 'feed'}`,
    label,
    streamUrl,
    frequency: inferFrequency(label),
    defaultPriority
  };
}

function collectAirports(entries: Array<{ label: string; streamUrl: string }>, fileName: string): AirportDef[] {
  const airportMap = new Map<string, AirportDef>();

  entries.forEach((entry, index) => {
    const identity = inferAirportIdentity(entry.label, fileName);
    const existing = airportMap.get(identity.icao) ?? {
      icao: identity.icao,
      name: identity.name,
      feeds: []
    };

    existing.feeds.push(createFeed(`${identity.icao}-${index + 1}`, entry.label, entry.streamUrl, index + 1));
    airportMap.set(identity.icao, existing);
  });

  return [...airportMap.values()].sort((left, right) => left.icao.localeCompare(right.icao));
}

export function parsePls(text: string, fileName: string): FeedPackV1 {
  const data = parseIniLike(text);
  const entries: Array<{ label: string; streamUrl: string }> = [];
  const declaredCount = Number.parseInt(data.NumberOfEntries ?? '0', 10);
  const maxEntries = Number.isFinite(declaredCount) && declaredCount > 0 ? declaredCount : 32;

  for (let index = 1; index <= maxEntries; index += 1) {
    const streamUrl = data[`File${index}`];
    if (!streamUrl) {
      continue;
    }

    const label = data[`Title${index}`] ?? `${stripExtension(fileName)} #${index}`;
    entries.push({ label, streamUrl });
  }

  if (!entries.length) {
    throw new Error('Playlist did not contain any feed entries.');
  }

  return {
    version: 1,
    name: stripExtension(fileName),
    airports: collectAirports(entries, fileName)
  };
}

export function parseM3u(text: string, fileName: string): FeedPackV1 {
  const entries: Array<{ label: string; streamUrl: string }> = [];
  let pendingLabel: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      pendingLabel = line.split(',').slice(1).join(',').trim() || undefined;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    const label = pendingLabel ?? `${stripExtension(fileName)} #${entries.length + 1}`;
    entries.push({ label, streamUrl: line });
    pendingLabel = undefined;
  }

  if (!entries.length) {
    throw new Error('Playlist did not contain any playable URLs.');
  }

  return {
    version: 1,
    name: stripExtension(fileName),
    airports: collectAirports(entries, fileName)
  };
}

function isFeedDef(value: unknown): value is FeedDef {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<FeedDef>;
  return typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.streamUrl === 'string' &&
    typeof candidate.defaultPriority === 'number';
}

export function parseFeedPackJson(text: string): FeedPackV1 {
  const parsed = JSON.parse(text) as Partial<FeedPackV1>;

  if (parsed.version !== 1 || !Array.isArray(parsed.airports) || typeof parsed.name !== 'string') {
    throw new Error('JSON file is not a valid FeedPackV1 document.');
  }

  for (const airport of parsed.airports) {
    if (
      !airport ||
      typeof airport !== 'object' ||
      typeof airport.icao !== 'string' ||
      typeof airport.name !== 'string' ||
      !Array.isArray(airport.feeds) ||
      !airport.feeds.every(isFeedDef)
    ) {
      throw new Error('JSON file contains an invalid airport or feed definition.');
    }
  }

  return parsed as FeedPackV1;
}

export function parseFeedImport(fileName: string, text: string): FeedPackV1 {
  if (/\.pls$/i.test(fileName)) {
    return parsePls(text, fileName);
  }

  if (/\.m3u8?$/i.test(fileName)) {
    return parseM3u(text, fileName);
  }

  if (/\.json$/i.test(fileName)) {
    return parseFeedPackJson(text);
  }

  throw new Error(`Unsupported file type for ${fileName}.`);
}

function cloneAirport(airport: AirportDef): AirportDef {
  return {
    icao: airport.icao,
    name: airport.name,
    feeds: airport.feeds.map((feed) => ({ ...feed }))
  };
}

export function createStoredFeedPack(pack: FeedPackV1, sourceFileName: string): StoredFeedPack {
  const packId = crypto.randomUUID();
  const normalizedName = pack.airports.length === 1 ? pack.airports[0].icao : pack.name;

  return {
    ...pack,
    name: normalizedName,
    packId,
    sourceFileName,
    importedAt: Date.now(),
    airports: pack.airports.map((airport) => ({
      ...cloneAirport(airport),
      feeds: airport.feeds.map((feed) => ({
        ...feed,
        id: `${packId}:${feed.id}`
      }))
    }))
  };
}

export function createPriorityMap(pack: StoredFeedPack): Record<string, number> {
  return Object.fromEntries(
    pack.airports.flatMap((airport) => airport.feeds.map((feed, index) => [feed.id, index + 1]))
  );
}

function cloneStoredPack(pack: StoredFeedPack): StoredFeedPack {
  return {
    ...pack,
    airports: pack.airports.map(cloneAirport)
  };
}

function splitAirportKey(airportKey: string): { packId: string; icao: string } | null {
  const [packId, icao] = airportKey.split('::');
  if (!packId || !icao) {
    return null;
  }

  return { packId, icao: icao.toUpperCase() };
}

function normalizeFeedOrder(feeds: FeedDef[]): FeedDef[] {
  return feeds.map((feed, index) => ({
    ...feed,
    defaultPriority: index + 1
  }));
}

function pruneEmptyPacks(packs: StoredFeedPack[]): StoredFeedPack[] {
  return packs
    .map((pack) => ({
      ...pack,
      airports: pack.airports
        .map((airport) => ({
          ...airport,
          feeds: normalizeFeedOrder(airport.feeds)
        }))
        .filter((airport) => airport.feeds.length > 0)
    }))
    .filter((pack) => pack.airports.length > 0);
}

function canonicalizeStreamUrl(streamUrl: string): string {
  try {
    const parsed = new URL(streamUrl);
    parsed.hash = '';
    if (parsed.hostname.endsWith('liveatc.net')) {
      parsed.searchParams.delete('nocache');
    }
    return parsed.toString();
  } catch {
    return streamUrl.trim().toLowerCase();
  }
}

export interface ConsolidatedPackResult {
  packs: StoredFeedPack[];
  packIdMap: Record<string, string>;
  feedIdMap: Record<string, string>;
}

export function consolidateStoredPacks(packs: StoredFeedPack[]): ConsolidatedPackResult {
  const consolidated: StoredFeedPack[] = [];
  const singleAirportIndex = new Map<string, number>();
  const packIdMap: Record<string, string> = {};
  const feedIdMap: Record<string, string> = {};

  for (const pack of packs) {
    const current = cloneStoredPack(pack);

    if (current.airports.length !== 1) {
      consolidated.push(current);
      packIdMap[current.packId] = current.packId;
      continue;
    }

    const airport = current.airports[0];
    const airportKey = airport.icao.toUpperCase();
    const existingIndex = singleAirportIndex.get(airportKey);

    if (existingIndex === undefined) {
      current.name = airport.icao;
      consolidated.push(current);
      singleAirportIndex.set(airportKey, consolidated.length - 1);
      packIdMap[current.packId] = current.packId;
      continue;
    }

    const targetPack = consolidated[existingIndex];
    const targetAirport = targetPack.airports[0];
    const knownFeeds = new Map(
      targetAirport.feeds.map((feed) => [canonicalizeStreamUrl(feed.streamUrl), feed])
    );

    packIdMap[current.packId] = targetPack.packId;

    for (const feed of airport.feeds) {
      const streamKey = canonicalizeStreamUrl(feed.streamUrl);
      const existingFeed = knownFeeds.get(streamKey);

      if (existingFeed) {
        feedIdMap[feed.id] = existingFeed.id;
        continue;
      }

      targetAirport.feeds.push(feed);
      knownFeeds.set(streamKey, feed);
    }

    targetPack.importedAt = Math.max(targetPack.importedAt, current.importedAt);
  }

  return {
    packs: consolidated,
    packIdMap,
    feedIdMap
  };
}

export function listAirportEntries(packs: StoredFeedPack[]) {
  return packs.flatMap((pack) =>
    pack.airports.map((airport) => ({
      key: createAirportKey(pack.packId, airport.icao),
      packId: pack.packId,
      airport,
      packName: pack.name
    }))
  );
}

export function createPriorityMapForPacks(packs: StoredFeedPack[]): Record<string, number> {
  return Object.fromEntries(packs.flatMap((pack) => Object.entries(createPriorityMap(pack))));
}

export function formatAirportLabel(airport: Pick<AirportDef, 'icao' | 'name'>, packName?: string): string {
  const seen = new Set<string>();
  return [airport.icao, airport.name, packName]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment))
    .filter((segment) => {
      const key = segment.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(' · ');
}

export function reorderFeedWithinAirport(
  packs: StoredFeedPack[],
  airportKey: string,
  draggedFeedId: string,
  targetFeedId: string
): StoredFeedPack[] {
  if (draggedFeedId === targetFeedId) {
    return packs;
  }

  const targetAirportRef = splitAirportKey(airportKey);
  if (!targetAirportRef) {
    return packs;
  }

  return packs.map((pack) => {
    if (pack.packId !== targetAirportRef.packId) {
      return cloneStoredPack(pack);
    }

    return {
      ...cloneStoredPack(pack),
      airports: pack.airports.map((airport) => {
        if (airport.icao.toUpperCase() !== targetAirportRef.icao) {
          return cloneAirport(airport);
        }

        const feeds = airport.feeds.map((feed) => ({ ...feed }));
        const draggedIndex = feeds.findIndex((feed) => feed.id === draggedFeedId);
        const targetIndex = feeds.findIndex((feed) => feed.id === targetFeedId);

        if (draggedIndex === -1 || targetIndex === -1) {
          return {
            ...cloneAirport(airport),
            feeds: normalizeFeedOrder(feeds)
          };
        }

        const [draggedFeed] = feeds.splice(draggedIndex, 1);
        feeds.splice(targetIndex, 0, draggedFeed);

        return {
          ...cloneAirport(airport),
          feeds: normalizeFeedOrder(feeds)
        };
      })
    };
  });
}

export function moveFeedToAirport(
  packs: StoredFeedPack[],
  sourceAirportKey: string,
  targetAirportKey: string,
  feedId: string
): StoredFeedPack[] {
  if (sourceAirportKey === targetAirportKey) {
    return packs;
  }

  const sourceRef = splitAirportKey(sourceAirportKey);
  const targetRef = splitAirportKey(targetAirportKey);
  if (!sourceRef || !targetRef) {
    return packs;
  }

  const clonedPacks = packs.map(cloneStoredPack);
  let movingFeed: FeedDef | null = null;

  for (const pack of clonedPacks) {
    if (pack.packId !== sourceRef.packId) {
      continue;
    }

    for (const airport of pack.airports) {
      if (airport.icao.toUpperCase() !== sourceRef.icao) {
        continue;
      }

      const feedIndex = airport.feeds.findIndex((feed) => feed.id === feedId);
      if (feedIndex === -1) {
        continue;
      }

      const [removedFeed] = airport.feeds.splice(feedIndex, 1);
      movingFeed = removedFeed;
      airport.feeds = normalizeFeedOrder(airport.feeds);
      break;
    }
  }

  if (!movingFeed) {
    return packs;
  }

  for (const pack of clonedPacks) {
    if (pack.packId !== targetRef.packId) {
      continue;
    }

    for (const airport of pack.airports) {
      if (airport.icao.toUpperCase() !== targetRef.icao) {
        continue;
      }

      airport.feeds = normalizeFeedOrder([...airport.feeds, movingFeed]);
      return pruneEmptyPacks(clonedPacks);
    }
  }

  return packs;
}

export function filterPackByValidatedFeeds(
  pack: FeedPackV1,
  validations: Record<string, FeedValidationResult>
): FeedPackV1 {
  return {
    ...pack,
    airports: pack.airports
      .map((airport) => ({
        ...airport,
        feeds: airport.feeds.filter((feed) => validations[feed.streamUrl]?.ok)
      }))
      .filter((airport) => airport.feeds.length > 0)
  };
}
