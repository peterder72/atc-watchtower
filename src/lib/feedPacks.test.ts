import { describe, expect, it } from 'vitest';
import {
  consolidateStoredPacks,
  createPriorityMap,
  createStoredFeedPack,
  filterPackByValidatedFeeds,
  formatAirportLabel,
  moveFeedToAirport,
  parseM3u,
  parsePls,
  reorderFeedWithinAirport
} from './feedPacks';
import { createAirportKey } from '../domain/models';

describe('parsePls', () => {
  it('parses a .pls file into a feed pack', () => {
    const pack = parsePls(
      `[playlist]
File1=https://d.liveatc.net/eheh3_app
Title1=EHEH Approach #1
Length1=-1
NumberOfEntries=1`,
      'eheh3_app.pls'
    );

    expect(pack.version).toBe(1);
    expect(pack.airports).toHaveLength(1);
    expect(pack.airports[0].icao).toBe('EHEH');
    expect(pack.airports[0].feeds[0].streamUrl).toBe('https://d.liveatc.net/eheh3_app');
  });

  it('throws when the playlist does not expose any files', () => {
    expect(() => parsePls('[playlist]\nNumberOfEntries=0', 'empty.pls')).toThrow(/did not contain any feed entries/i);
  });
});

describe('parseM3u', () => {
  it('parses extended labels and URLs', () => {
    const pack = parseM3u(
      `#EXTM3U
#EXTINF:-1,EHAM Tower
https://example.com/tower
#EXTINF:-1,EHAM Ground
https://example.com/ground`,
      'eham.m3u'
    );

    expect(pack.airports[0].icao).toBe('EHAM');
    expect(pack.airports[0].feeds).toHaveLength(2);
  });
});

describe('stored feed packs', () => {
  it('scopes imported feed ids to the pack id and exposes default priorities', () => {
    const pack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://d.liveatc.net/eheh3_app
Title1=EHEH Approach #1
NumberOfEntries=1`,
        'eheh3_app.pls'
      ),
      'eheh3_app.pls'
    );

    const priorityMap = createPriorityMap(pack);
    const [feedId] = Object.keys(priorityMap);
    expect(feedId.startsWith(`${pack.packId}:`)).toBe(true);
    expect(priorityMap[feedId]).toBe(1);
    expect(pack.name).toBe('EHEH');
  });

  it('drops invalid feeds after validation', () => {
    const pack = parseM3u(
      `#EXTM3U
#EXTINF:-1,EHAM Tower
https://example.com/tower
#EXTINF:-1,EHAM Ground
https://example.com/ground`,
      'eham.m3u'
    );

    const filtered = filterPackByValidatedFeeds(pack, {
      'https://example.com/tower': { streamUrl: 'https://example.com/tower', ok: true },
      'https://example.com/ground': { streamUrl: 'https://example.com/ground', ok: false }
    });

    expect(filtered.airports[0].feeds).toHaveLength(1);
    expect(filtered.airports[0].feeds[0].label).toContain('Tower');
  });

  it('merges multiple single-airport playlist imports into one airport pack', () => {
    const approachPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://d.liveatc.net/eheh3_app
Title1=EHEH Approach #1
NumberOfEntries=1`,
        'eheh3_app.pls'
      ),
      'eheh3_app.pls'
    );
    const towerPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://d.liveatc.net/eheh_twr
Title1=EHEH Tower
NumberOfEntries=1`,
        'eheh_twr.pls'
      ),
      'eheh_twr.pls'
    );

    const consolidated = consolidateStoredPacks([approachPack, towerPack]);

    expect(consolidated.packs).toHaveLength(1);
    expect(consolidated.packIdMap[towerPack.packId]).toBe(approachPack.packId);
    expect(consolidated.packs[0].name).toBe('EHEH');
    expect(consolidated.packs[0].airports[0].feeds).toHaveLength(2);
  });

  it('deduplicates repeated imports of the same stream within one airport pack', () => {
    const firstPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://d.liveatc.net/eheh3_app
Title1=EHEH Approach #1
NumberOfEntries=1`,
        'eheh3_app.pls'
      ),
      'eheh3_app.pls'
    );
    const secondPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://d.liveatc.net/eheh3_app
Title1=EHEH Approach Duplicate
NumberOfEntries=1`,
        'eheh3_app-again.pls'
      ),
      'eheh3_app-again.pls'
    );

    const consolidated = consolidateStoredPacks([firstPack, secondPack]);
    const duplicateFeedId = secondPack.airports[0].feeds[0].id;

    expect(consolidated.packs).toHaveLength(1);
    expect(consolidated.packs[0].airports[0].feeds).toHaveLength(1);
    expect(consolidated.feedIdMap[duplicateFeedId]).toBe(firstPack.airports[0].feeds[0].id);
  });

  it('reorders feeds so the top row becomes P1', () => {
    const pack = createStoredFeedPack(
      parseM3u(
        `#EXTM3U
#EXTINF:-1,EHAM Tower
https://example.com/tower
#EXTINF:-1,EHAM Ground
https://example.com/ground`,
        'eham.m3u'
      ),
      'eham.m3u'
    );
    const airportKey = createAirportKey(pack.packId, pack.airports[0].icao);
    const [tower, ground] = pack.airports[0].feeds;

    const reordered = reorderFeedWithinAirport([pack], airportKey, ground.id, tower.id);

    expect(reordered[0].airports[0].feeds.map((feed) => feed.label)).toEqual(['EHAM Ground', 'EHAM Tower']);
  });

  it('moves a feed into a different airport pack', () => {
    const ehamPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://example.com/tower
Title1=EHAM Tower
NumberOfEntries=1`,
        'eham_twr.pls'
      ),
      'eham_twr.pls'
    );
    const ehehPack = createStoredFeedPack(
      parsePls(
        `[playlist]
File1=https://example.com/approach
Title1=EHEH Approach
NumberOfEntries=1`,
        'eheh_app.pls'
      ),
      'eheh_app.pls'
    );

    const moved = moveFeedToAirport(
      [ehamPack, ehehPack],
      createAirportKey(ehamPack.packId, 'EHAM'),
      createAirportKey(ehehPack.packId, 'EHEH'),
      ehamPack.airports[0].feeds[0].id
    );

    expect(moved).toHaveLength(1);
    expect(moved[0].airports[0].icao).toBe('EHEH');
    expect(moved[0].airports[0].feeds).toHaveLength(2);
  });

  it('deduplicates repeated airport labels in the UI formatter', () => {
    expect(formatAirportLabel({ icao: 'EHEH', name: 'EHEH' }, 'EHEH')).toBe('EHEH');
    expect(formatAirportLabel({ icao: 'KJFK', name: 'John F. Kennedy' }, 'New York pack')).toBe(
      'KJFK · John F. Kennedy · New York pack'
    );
  });
});
