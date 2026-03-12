import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import {
  buttonClass,
  type ButtonVariant,
  eyebrowClass,
  mutedTextClass,
  statCardClass,
  titleClass
} from './styles';

const pillToneClass = {
  neutral: 'bg-white/8 text-slate-300',
  accent: 'bg-accent/18 text-orange-100',
  warning: 'bg-amber-300/16 text-amber-100',
  success: 'bg-teal/18 text-teal-100',
  danger: 'bg-danger/18 text-rose-100'
} as const;

export type PillTone = keyof typeof pillToneClass;

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

interface StatusPillProps {
  children: ReactNode;
  className?: string;
  tone?: PillTone;
}

interface EmptyStateProps {
  children: ReactNode;
  className?: string;
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
      <span className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <strong className="mt-2 block text-2xl font-semibold tracking-tight text-stone-100">{value}</strong>
    </article>
  );
}

export function StatusPill({ children, className, tone = 'neutral' }: StatusPillProps) {
  return (
    <span className={cn('inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium', pillToneClass[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ children, className }: EmptyStateProps) {
  return <p className={cn(mutedTextClass, className)}>{children}</p>;
}
