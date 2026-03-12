import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_STATE, createAirportKey } from '../domain/models';
import { normalizeAppState } from './appState';
import { createStoredFeedPack, parsePls } from './feedPacks';

function createSingleFeedPack(fileName: string, label: string, streamUrl: string) {
  return createStoredFeedPack(
    parsePls(
      `[playlist]
File1=${streamUrl}
Title1=${label}
NumberOfEntries=1`,
      fileName
    ),
    fileName
  );
}

describe('normalizeAppState', () => {
  it('remaps selected feeds and squelch thresholds when duplicate feeds are consolidated', () => {
    const firstPack = createSingleFeedPack('eheh_app.pls', 'EHEH Approach', 'https://example.com/eheh-app');
    const duplicatePack = createSingleFeedPack(
      'eheh_app_again.pls',
      'EHEH Approach Duplicate',
      'https://example.com/eheh-app'
    );
    const survivingFeedId = firstPack.airports[0].feeds[0].id;
    const duplicateFeedId = duplicatePack.airports[0].feeds[0].id;

    const normalizedState = normalizeAppState(
      {
        ...DEFAULT_APP_STATE,
        selectedAirportKey: createAirportKey(duplicatePack.packId, 'EHEH'),
        selectedFeedIds: [duplicateFeedId],
        feedSquelchThresholdsDb: {
          [duplicateFeedId]: -54,
          stale: -48
        }
      },
      [firstPack, duplicatePack]
    );

    expect(normalizedState.selectedAirportKey).toBe(createAirportKey(firstPack.packId, 'EHEH'));
    expect(normalizedState.selectedFeedIds).toEqual([survivingFeedId]);
    expect(normalizedState.feedSquelchThresholdsDb).toEqual({
      [survivingFeedId]: -54
    });
  });
});
