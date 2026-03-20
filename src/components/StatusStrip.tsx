import { fieldLabelClass } from './ui/styles';

interface StatusStripProps {
  importedAirports: number;
  selectedFeeds: number;
  liveFloorStatus: string;
}

export function StatusStrip({ importedAirports, selectedFeeds, liveFloorStatus }: StatusStripProps) {
  const items = [
    {
      label: 'Imported airports',
      toneClass: 'border-[var(--wt-border)] bg-[var(--wt-screen)]',
      value: importedAirports
    },
    {
      label: 'Selected feeds',
      toneClass: 'border-[var(--wt-border)] bg-[var(--wt-screen)]',
      value: selectedFeeds
    },
    {
      label: 'Live floor',
      toneClass:
        liveFloorStatus === 'Active'
          ? 'border-[var(--wt-tone-success-border)] bg-[var(--wt-tone-success-bg)]'
          : 'border-[var(--wt-border)] bg-[var(--wt-screen)]',
      value: liveFloorStatus
    }
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
      {items.map((item) => (
        <article
          key={item.label}
          className={`${item.toneClass} grid min-w-[10rem] gap-1 rounded-[6px] border px-3 py-2 shadow-[var(--wt-shadow-panel-soft)]`}
        >
          <span className={fieldLabelClass}>{item.label}</span>
          <strong className="text-[0.95rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
