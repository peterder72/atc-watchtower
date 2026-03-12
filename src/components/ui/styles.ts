import { cn } from '../../lib/cn';

export const pageShellClass = 'mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-8 lg:px-8';
export const panelClass = 'rounded-[28px] border border-white/10 bg-slate-950/72 p-5 shadow-panel backdrop-blur-xl';
export const subPanelClass = 'rounded-[24px] border border-white/10 bg-slate-950/88 p-4 shadow-panel backdrop-blur-xl';
export const statCardClass = 'rounded-[24px] border border-white/10 bg-slate-950/72 px-4 py-4 shadow-panel backdrop-blur-xl';
export const feedCardClass = 'rounded-[24px] border border-white/10 bg-slate-950/72 p-4 backdrop-blur-xl';
export const insetBlockClass = 'rounded-[18px] bg-white/[0.04] p-3';
export const eyebrowClass = 'text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-teal';
export const titleClass = 'text-xl font-semibold tracking-tight text-stone-100';
export const mutedTextClass = 'text-sm leading-6 text-slate-300/75';

const buttonBaseClass =
  'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-150 disabled:pointer-events-none disabled:opacity-45';

const buttonVariantClass = {
  primary: 'bg-gradient-to-r from-accent to-amber-300 text-slate-950 enabled:hover:-translate-y-px enabled:hover:brightness-105',
  secondary: 'border border-white/10 bg-white/7 text-stone-100 enabled:hover:border-white/20 enabled:hover:bg-white/10'
} as const;

export type ButtonVariant = keyof typeof buttonVariantClass;

export function buttonClass(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(buttonBaseClass, buttonVariantClass[variant], className);
}
