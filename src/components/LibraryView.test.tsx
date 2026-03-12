import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AirportEntry, createAirportKey } from '../domain/models';
import { LibraryView } from './LibraryView';

function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'all',
    dropEffect: 'move',
    setData(type: string, value: string) {
      store.set(type, value);
    },
    getData(type: string) {
      return store.get(type) ?? '';
    }
  } as unknown as DataTransfer;
}

const airports: AirportEntry[] = [
  {
    key: createAirportKey('pack-eheh', 'EHEH'),
    packId: 'pack-eheh',
    packName: 'EHEH',
    airport: {
      icao: 'EHEH',
      name: 'EHEH',
      feeds: [
        {
          id: 'tower',
          label: 'EHEH Tower',
          streamUrl: 'https://example.com/tower',
          defaultPriority: 1
        },
        {
          id: 'ground',
          label: 'EHEH Ground',
          streamUrl: 'https://example.com/ground',
          defaultPriority: 2
        }
      ]
    }
  },
  {
    key: createAirportKey('pack-kjfk', 'KJFK'),
    packId: 'pack-kjfk',
    packName: 'KJFK',
    airport: {
      icao: 'KJFK',
      name: 'KJFK',
      feeds: [
        {
          id: 'kjfk-twr',
          label: 'KJFK Tower',
          streamUrl: 'https://example.com/kjfk-twr',
          defaultPriority: 1
        }
      ]
    }
  }
];

afterEach(() => {
  cleanup();
});

function renderLibraryView(overrides: Partial<ComponentProps<typeof LibraryView>> = {}) {
  const props: ComponentProps<typeof LibraryView> = {
    airports,
    selectedAirportKey: airports[0].key,
    feeds: airports[0].airport.feeds,
    selectedFeedIds: [],
    feedPriorities: {
      tower: 1,
      ground: 2,
      'kjfk-twr': 1
    },
    importNotices: [],
    isBusy: false,
    isListening: false,
    onImportFiles: vi.fn(),
    onAirportChange: vi.fn(),
    onToggleFeed: vi.fn(),
    onReorderFeed: vi.fn(),
    onMoveFeed: vi.fn(),
    ...overrides
  };

  render(<LibraryView {...props} />);
  return props;
}

describe('LibraryView drag and drop', () => {
  it('reorders feeds even if dragover cannot read the custom payload', () => {
    const props = renderLibraryView();
    const dataTransfer = createDataTransfer();
    const source = screen.getByText('EHEH Ground').closest('label');
    const target = screen.getByText('EHEH Tower').closest('label');

    expect(source).toBeTruthy();
    expect(target).toBeTruthy();

    fireEvent.dragStart(source!, { dataTransfer });
    fireEvent.dragOver(target!, { dataTransfer });
    fireEvent.drop(target!, { dataTransfer });

    expect(props.onReorderFeed).toHaveBeenCalledWith('ground', 'tower');
  });

  it('moves feeds into another pack even if dragover payload lookup is blank', () => {
    const props = renderLibraryView();
    const dataTransfer = createDataTransfer();
    const source = screen.getAllByText('EHEH Tower')[0]?.closest('label');
    const targetPack = screen.getByRole('button', { name: /KJFK/i });

    expect(source).toBeTruthy();

    fireEvent.dragStart(source!, { dataTransfer });
    dataTransfer.getData = () => '';
    fireEvent.dragOver(targetPack, { dataTransfer });
    fireEvent.drop(targetPack, { dataTransfer });

    expect(props.onMoveFeed).toHaveBeenCalledWith('tower', airports[0].key, airports[1].key);
  });

  it('keeps the reorder target highlight while dragging across child elements', () => {
    renderLibraryView();
    const dataTransfer = createDataTransfer();
    const source = screen.getByText('EHEH Ground').closest('label');
    const target = screen.getByText('EHEH Tower').closest('label');
    const targetChild = within(target!).getByText('Priority');

    expect(source).toBeTruthy();
    expect(target).toBeTruthy();

    fireEvent.dragStart(source!, { dataTransfer });
    dataTransfer.getData = () => '';
    fireEvent.dragOver(target!, { dataTransfer });

    expect(target!.className).toContain('border-[rgba(99,212,199,0.45)]');

    fireEvent.dragLeave(target!, { dataTransfer, relatedTarget: targetChild });

    expect(target!.className).toContain('border-[rgba(99,212,199,0.45)]');
  });
});
