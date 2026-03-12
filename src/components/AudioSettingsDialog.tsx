import { useEffect, useId } from 'react';
import {
  ATTACK_MS_STEP,
  CLOSE_GAP_DB_STEP,
  DEFAULT_AUDIO_PROCESSING_SETTINGS,
  HANG_MS_STEP,
  MAX_ATTACK_MS,
  MAX_CLOSE_GAP_DB,
  MAX_HANG_MS,
  MAX_OPEN_DELTA_DB,
  MIN_ATTACK_MS,
  MIN_CLOSE_GAP_DB,
  MIN_HANG_MS,
  MIN_OPEN_DELTA_DB,
  OPEN_DELTA_DB_STEP,
  type AudioProcessingSettings
} from '../domain/models';
import { cn } from '../lib/cn';
import { Button } from './ui/common';
import { eyebrowClass, insetBlockClass, mutedTextClass, panelClass } from './ui/styles';

interface AudioSettingsDialogProps {
  isOpen: boolean;
  settings: AudioProcessingSettings;
  onChange: (setting: keyof AudioProcessingSettings, value: number) => void;
  onClose: () => void;
  onReset: () => void;
}

interface SliderControlProps {
  description: string;
  formatValue: (value: number) => string;
  label: string;
  max: number;
  min: number;
  name: keyof AudioProcessingSettings;
  onChange: (setting: keyof AudioProcessingSettings, value: number) => void;
  step: number;
  value: number;
}

function SliderControl({
  description,
  formatValue,
  label,
  max,
  min,
  name,
  onChange,
  step,
  value
}: SliderControlProps) {
  const inputId = useId();

  return (
    <div className={cn(insetBlockClass, 'grid gap-3')}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-stone-100" htmlFor={inputId}>
          {label}
        </label>
        <strong className="text-sm font-semibold text-stone-100">{formatValue(value)}</strong>
      </div>
      <p className={mutedTextClass}>{description}</p>
      <input
        id={inputId}
        className="w-full accent-accent"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(name, event.currentTarget.valueAsNumber)}
      />
      <div className="flex justify-between gap-3 text-xs text-slate-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

function formatMilliseconds(value: number): string {
  return `${value} ms`;
}

function formatDecibels(value: number): string {
  return `${value} dB`;
}

export function AudioSettingsDialog({ isOpen, settings, onChange, onClose, onReset }: AudioSettingsDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(panelClass, 'w-full max-w-2xl space-y-5 border-white/12 bg-slate-950/95 shadow-2xl')}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className={eyebrowClass}>Audio settings</p>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-100" id={titleId}>
              Tune gate timing and sensitivity
            </h2>
            <p className={mutedTextClass}>Changes apply live while listening and save automatically.</p>
          </div>

          <Button aria-label="Close audio settings" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SliderControl
            description="How long a signal must stay hot before the gate opens. Watchtower adds matching monitor delay so the start of each call is preserved, and higher values increase latency."
            formatValue={formatMilliseconds}
            label="Transmission start delay"
            max={MAX_ATTACK_MS}
            min={MIN_ATTACK_MS}
            name="attackMs"
            onChange={onChange}
            step={ATTACK_MS_STEP}
            value={settings.attackMs}
          />
          <SliderControl
            description="How long the gate stays open after the signal drops."
            formatValue={formatMilliseconds}
            label="Transmission end hold"
            max={MAX_HANG_MS}
            min={MIN_HANG_MS}
            name="hangMs"
            onChange={onChange}
            step={HANG_MS_STEP}
            value={settings.hangMs}
          />
          <SliderControl
            description="How far above the noise floor a signal must rise to open."
            formatValue={formatDecibels}
            label="Open sensitivity"
            max={MAX_OPEN_DELTA_DB}
            min={MIN_OPEN_DELTA_DB}
            name="openDeltaDb"
            onChange={onChange}
            step={OPEN_DELTA_DB_STEP}
            value={settings.openDeltaDb}
          />
          <SliderControl
            description="How much quieter a signal must get before the gate closes."
            formatValue={formatDecibels}
            label="Close hysteresis"
            max={MAX_CLOSE_GAP_DB}
            min={MIN_CLOSE_GAP_DB}
            name="closeGapDb"
            onChange={onChange}
            step={CLOSE_GAP_DB_STEP}
            value={settings.closeGapDb}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onReset}>
            Reset defaults
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>

        <p className="text-xs text-slate-400">
          Defaults: {formatMilliseconds(DEFAULT_AUDIO_PROCESSING_SETTINGS.attackMs)} start delay,{' '}
          {formatMilliseconds(DEFAULT_AUDIO_PROCESSING_SETTINGS.hangMs)} end hold,{' '}
          {formatDecibels(DEFAULT_AUDIO_PROCESSING_SETTINGS.openDeltaDb)} open delta,{' '}
          {formatDecibels(DEFAULT_AUDIO_PROCESSING_SETTINGS.closeGapDb)} close gap.
        </p>
      </div>
    </div>
  );
}
