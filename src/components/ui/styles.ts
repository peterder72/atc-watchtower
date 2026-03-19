import { cn } from '../../lib/cn';

export const pageShellClass = 'mx-auto flex min-h-screen w-full max-w-[112rem] flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:px-6';
export const panelClass =
  'rounded-[8px] border border-[var(--wt-border-strong)] bg-[var(--wt-panel)] px-4 py-4 shadow-[var(--wt-shadow-panel)]';
export const subPanelClass =
  'rounded-[7px] border border-[var(--wt-border)] bg-[var(--wt-panel-2)] px-4 py-4 shadow-[var(--wt-shadow-panel-soft)]';
export const statCardClass =
  'rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)] px-3 py-3 shadow-[var(--wt-shadow-panel-soft)]';
export const feedCardClass =
  'rounded-[7px] border border-[var(--wt-border)] bg-[var(--wt-panel-2)] p-4 shadow-[var(--wt-shadow-panel-soft)]';
export const insetBlockClass =
  'rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)] px-3 py-3 shadow-[var(--wt-shadow-panel-softer)]';
export const eyebrowClass = 'text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--wt-accent-soft)]';
export const fieldLabelClass = 'text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--wt-muted)]';
export const titleClass = 'text-[1.125rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]';
export const mutedTextClass = 'text-[0.9rem] leading-5 text-[var(--wt-muted)]';
export const segmentedShellClass = 'inline-grid grid-cols-2 gap-1 rounded-[7px] border border-[var(--wt-border)] bg-[var(--wt-screen)] p-1';

const buttonBaseClass =
  'inline-flex min-h-10 items-center justify-center rounded-[6px] border px-3 py-2 text-[0.82rem] font-semibold uppercase tracking-[0.08em] transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wt-accent)] disabled:pointer-events-none disabled:opacity-45';

const buttonVariantClass = {
  primary:
    'border-[var(--wt-accent-strong)] bg-[var(--wt-accent)] text-[var(--wt-ink-strong)] enabled:hover:border-[var(--wt-accent-strong)] enabled:hover:bg-[var(--wt-accent-strong)]',
  secondary:
    'border-[var(--wt-border-strong)] bg-[var(--wt-screen)] text-[var(--wt-text)] enabled:hover:border-[var(--wt-accent-soft)] enabled:hover:text-[var(--wt-accent)]',
  danger:
    'border-[var(--wt-tone-danger-border)] bg-[var(--wt-tone-danger-bg-strong)] text-[var(--wt-danger)] enabled:hover:border-[var(--wt-tone-danger-hover-border)] enabled:hover:bg-[var(--wt-tone-danger-hover-bg)]'
} as const;

export type ButtonVariant = keyof typeof buttonVariantClass;

export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(buttonBaseClass, buttonVariantClass[variant], className);
}
