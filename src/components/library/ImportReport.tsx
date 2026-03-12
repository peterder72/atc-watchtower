import type { ImportNotice } from '../../domain/models';
import { cn } from '../../lib/cn';
import { SectionHeading } from '../ui/common';
import { subPanelClass } from '../ui/styles';

interface ImportReportProps {
  notices: ImportNotice[];
}

const noticeToneClass = {
  error: 'bg-danger/16 text-rose-100',
  info: 'bg-success/10 text-emerald-100',
  warning: 'bg-amber-300/12 text-amber-100'
} as const;

export function ImportReport({ notices }: ImportReportProps) {
  return (
    <article className={cn(subPanelClass, 'space-y-4')}>
      <SectionHeading eyebrow="Import Report" level="h3" title="Compatibility checks" />
      <ul className="grid gap-3">
        {notices.map((notice, index) => (
          <li key={`${notice.fileName}-${index}`} className={cn('grid gap-1 rounded-2xl px-4 py-3', noticeToneClass[notice.level])}>
            <strong className="text-sm font-semibold">{notice.fileName}</strong>
            <span className="text-sm leading-6">{notice.message}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
