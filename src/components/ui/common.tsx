import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  buttonClass,
  type ButtonVariant,
  fieldLabelClass,
  eyebrowClass,
  insetBlockClass,
  mutedTextClass,
  segmentedShellClass,
  statCardClass,
  titleClass
} from './styles';

const toneClass = {
  neutral: 'border-[var(--wt-border)] bg-[var(--wt-screen)] text-[var(--wt-muted)]',
  accent: 'border-[rgba(244,176,62,0.55)] bg-[rgba(244,176,62,0.14)] text-[var(--wt-accent)]',
  warning: 'border-[rgba(244,176,62,0.55)] bg-[rgba(244,176,62,0.1)] text-[var(--wt-accent)]',
  success: 'border-[rgba(143,220,154,0.55)] bg-[rgba(143,220,154,0.12)] text-[var(--wt-ok)]',
  danger: 'border-[rgba(255,118,97,0.55)] bg-[rgba(255,118,97,0.12)] text-[var(--wt-danger)]'
} as const;

export type Tone = keyof typeof toneClass;

interface SectionHeadingProps {
  actions?: ReactNode;
  className?: string;
  description?: string;
  eyebrow: string;
  level?: 'h2' | 'h3';
  title: string;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
}

interface ToneTagProps {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}

interface StatusFieldProps {
  className?: string;
  label: string;
  tone?: Tone;
  value: ReactNode;
}

interface EmptyStateProps {
  children: ReactNode;
  className?: string;
}

interface MeterRailProps {
  className?: string;
  label: string;
  tone?: Tone;
  value: number;
  valueText: ReactNode;
}

interface LogRowProps {
  className?: string;
  message: ReactNode;
  title: ReactNode;
  tone?: Tone;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  className?: string;
  options: ReadonlyArray<{
    disabled?: boolean;
    label: string;
    value: T;
  }>;
  value: T;
  onChange: (value: T) => void;
}

export function Button({
  className,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} type={type} {...props} />;
}

export function SectionHeading({
  actions,
  className,
  description,
  eyebrow,
  level = 'h2',
  title
}: SectionHeadingProps) {
  const TitleTag = level;

  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="space-y-2">
        <p className={eyebrowClass}>{eyebrow}</p>
        <TitleTag className={titleClass}>{title}</TitleTag>
        {description ? <p className={mutedTextClass}>{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <article className={statCardClass}>
      <span className={fieldLabelClass}>{label}</span>
      <strong className="mt-2 block text-[1.05rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">{value}</strong>
    </article>
  );
}

export function ToneTag({ children, className, tone = 'neutral' }: ToneTagProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit rounded-[4px] border px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em]',
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusField({ className, label, tone = 'neutral', value }: StatusFieldProps) {
  return (
    <article className={cn(statCardClass, toneClass[tone], className)}>
      <span className={fieldLabelClass}>{label}</span>
      <strong className="mt-2 block text-[0.95rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">{value}</strong>
    </article>
  );
}

export function EmptyState({ children, className }: EmptyStateProps) {
  return <div className={cn(insetBlockClass, mutedTextClass, className)}>{children}</div>;
}

export function MeterRail({ className, label, tone = 'neutral', value, valueText }: MeterRailProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const railToneClass =
    tone === 'success'
      ? 'bg-[var(--wt-ok)]'
      : tone === 'danger'
        ? 'bg-[var(--wt-danger)]'
        : tone === 'accent' || tone === 'warning'
          ? 'bg-[var(--wt-accent)]'
          : 'bg-[var(--wt-text-dim)]';

  return (
    <div className={cn(insetBlockClass, 'grid gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className={fieldLabelClass}>{label}</span>
        <strong className="text-[0.8rem] font-semibold text-[var(--wt-text)]">{valueText}</strong>
      </div>
      <div className="h-3 rounded-[4px] border border-[var(--wt-border)] bg-[var(--wt-panel)] p-[2px]">
        <span className={cn('block h-full rounded-[2px] transition-[width] duration-75', railToneClass)} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}

export function LogRow({ className, message, title, tone = 'neutral' }: LogRowProps) {
  return (
    <li className={cn('grid gap-1 rounded-[6px] border px-3 py-3 md:grid-cols-[minmax(160px,220px)_minmax(0,1fr)]', toneClass[tone], className)}>
      <strong className="text-[0.82rem] font-semibold uppercase tracking-[0.06em] text-[var(--wt-text)]">{title}</strong>
      <span className="text-[0.84rem] leading-5">{message}</span>
    </li>
  );
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  options,
  value,
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div aria-label={ariaLabel} className={cn(segmentedShellClass, className)} role="tablist">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            aria-selected={selected}
            className={cn(
              'rounded-[5px] border px-3 py-2 text-[0.76rem] font-semibold uppercase tracking-[0.08em] transition duration-150',
              selected
                ? 'border-[var(--wt-accent-strong)] bg-[var(--wt-accent)] text-[var(--wt-ink-strong)]'
                : 'border-transparent bg-transparent text-[var(--wt-muted)] enabled:hover:border-[var(--wt-border-strong)] enabled:hover:text-[var(--wt-text)]'
            )}
            disabled={option.disabled}
            role="tab"
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
