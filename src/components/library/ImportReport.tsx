import type { ImportNotice } from '../../domain/models';
import { cn } from '../../lib/cn';
import { LogRow, SectionHeading, type Tone } from '../ui/common';
import { subPanelClass } from '../ui/styles';

interface ImportReportProps {
  notices: ImportNotice[];
}

const noticeToneClass = {
  error: 'danger',
  info: 'success',
  warning: 'warning'
} satisfies Record<ImportNotice['level'], Tone>;

export function ImportReport({ notices }: ImportReportProps) {
  return (
    <article className={cn(subPanelClass, 'space-y-4')}>
      <SectionHeading
        eyebrow="Import Report"
        level="h3"
        title="Compatibility Log"
        description="Browser-side checks for playlist parsing and stream compatibility."
      />
      <ul className="grid gap-3">
        {notices.map((notice, index) => (
          <LogRow key={`${notice.fileName}-${index}`} message={notice.message} title={notice.fileName} tone={noticeToneClass[notice.level]} />
        ))}
      </ul>
    </article>
  );
}
