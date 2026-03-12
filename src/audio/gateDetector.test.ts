import { describe, expect, it } from 'vitest';
import { DEFAULT_GATE_CONFIG, GateDetector } from './gateDetector';

function frameWithAmplitude(amplitude: number): Float32Array {
  return new Float32Array(960).fill(amplitude);
}

describe('GateDetector', () => {
  it('opens after three hot frames and closes after the hang time', () => {
    const detector = new GateDetector();
    const events = [];

    for (let index = 0; index < 3; index += 1) {
      events.push(...detector.processFrame('feed', frameWithAmplitude(0.2), index * DEFAULT_GATE_CONFIG.frameDurationMs));
    }

    expect(events.some((event) => event.type === 'gate-open')).toBe(true);

    let closeEvents = 0;
    for (let index = 0; index < 20; index += 1) {
      const result = detector.processFrame(
        'feed',
        frameWithAmplitude(0.0001),
        (index + 3) * DEFAULT_GATE_CONFIG.frameDurationMs
      );
      closeEvents += result.filter((event) => event.type === 'gate-close').length;
    }

    expect(closeEvents).toBe(1);
  });

  it('stays closed on quiet frames while still emitting level data', () => {
    const detector = new GateDetector();

    const events = detector.processFrame('feed', frameWithAmplitude(0.0001), 0);

    expect(events.some((event) => event.type === 'level')).toBe(true);
    expect(events.some((event) => event.type === 'gate-open')).toBe(false);
    expect(detector.isGateOpen()).toBe(false);
  });

  it('honors non-default attack and hang timings', () => {
    const detector = new GateDetector({
      attackMs: 100,
      hangMs: 200
    });

    for (let index = 0; index < 4; index += 1) {
      detector.processFrame('feed', frameWithAmplitude(0.2), index * DEFAULT_GATE_CONFIG.frameDurationMs);
    }

    expect(detector.isGateOpen()).toBe(false);

    const openEvents = detector.processFrame('feed', frameWithAmplitude(0.2), 80);
    expect(openEvents.some((event) => event.type === 'gate-open')).toBe(true);
    expect(detector.isGateOpen()).toBe(true);

    for (let index = 0; index < 9; index += 1) {
      detector.processFrame('feed', frameWithAmplitude(0.0001), 100 + index * DEFAULT_GATE_CONFIG.frameDurationMs);
    }

    expect(detector.isGateOpen()).toBe(true);

    const closeEvents = detector.processFrame('feed', frameWithAmplitude(0.0001), 280);
    expect(closeEvents.some((event) => event.type === 'gate-close')).toBe(true);
    expect(detector.isGateOpen()).toBe(false);
  });

  it('closes an already-open gate when the squelch floor is raised', () => {
    const detector = new GateDetector({
      configuredFloorDb: -68
    });

    for (let index = 0; index < 3; index += 1) {
      detector.processFrame('feed', frameWithAmplitude(0.004), index * DEFAULT_GATE_CONFIG.frameDurationMs);
    }

    expect(detector.isGateOpen()).toBe(true);

    detector.setConfiguredFloorDb(-35);

    let closeEvents = 0;
    for (let index = 0; index < 20; index += 1) {
      const result = detector.processFrame(
        'feed',
        frameWithAmplitude(0.004),
        (index + 3) * DEFAULT_GATE_CONFIG.frameDurationMs
      );
      closeEvents += result.filter((event) => event.type === 'gate-close').length;
    }

    expect(closeEvents).toBe(1);
    expect(detector.isGateOpen()).toBe(false);
  });
});
