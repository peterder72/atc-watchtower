import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_PROCESSING_SETTINGS } from '../domain/models';
import { AudioSettingsDialog } from './AudioSettingsDialog';

afterEach(() => {
  cleanup();
});

describe('AudioSettingsDialog', () => {
  it('renders the current settings values and reports slider changes', () => {
    const onChange = vi.fn();

    render(
      <AudioSettingsDialog
        isOpen
        settings={{
          attackMs: 80,
          hangMs: 500,
          openDeltaDb: 9,
          closeGapDb: 5
        }}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Tune gate timing and sensitivity' })).toBeTruthy();
    expect((screen.getByLabelText('Transmission start delay') as HTMLInputElement).value).toBe('80');
    expect((screen.getByLabelText('Transmission end hold') as HTMLInputElement).value).toBe('500');
    expect((screen.getByLabelText('Open sensitivity') as HTMLInputElement).value).toBe('9');
    expect((screen.getByLabelText('Close hysteresis') as HTMLInputElement).value).toBe('5');

    fireEvent.change(screen.getByLabelText('Transmission start delay'), {
      target: { value: '120' }
    });

    expect(onChange).toHaveBeenCalledWith('attackMs', 120);
  });

  it('resets back to the shared defaults', () => {
    const onReset = vi.fn();

    render(
      <AudioSettingsDialog
        isOpen
        settings={DEFAULT_AUDIO_PROCESSING_SETTINGS}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
