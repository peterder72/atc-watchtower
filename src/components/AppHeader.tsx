import { cn } from '../lib/cn';
import { Button, SegmentedControl } from './ui/common';
import { StatusStrip } from './StatusStrip';
import { eyebrowClass, mutedTextClass } from './ui/styles';

interface AppHeaderProps {
  activeView: 'library' | 'console';
  importedAirports: number;
  liveFloorStatus: string;
  onOpenSettings: () => void;
  onViewChange: (view: 'library' | 'console') => void;
  selectedFeeds: number;
}

const viewLabels = {
  console: 'Console',
  library: 'Library'
} as const;

export function AppHeader({
  activeView,
  importedAirports,
  liveFloorStatus,
  onOpenSettings,
  onViewChange,
  selectedFeeds
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'grid gap-3 rounded-[8px] border border-[var(--wt-border-strong)] bg-[var(--wt-panel)] px-4 py-3 shadow-[var(--wt-shadow-panel)] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start'
      )}
    >
      <div className="grid gap-4">
        <div className="max-w-4xl space-y-1.5">
          <p className={eyebrowClass}>ATC Watchtower</p>
          <h1 className="text-[1.1rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)] sm:text-[1.25rem]">
            Priority ATC Monitor
          </h1>
          <p className={cn(mutedTextClass, 'max-w-3xl text-[0.84rem] leading-5')}>
            Import local playlists, set feed order, and monitor whichever transmission owns the floor.
          </p>
        </div>
        <StatusStrip importedAirports={importedAirports} liveFloorStatus={liveFloorStatus} selectedFeeds={selectedFeeds} />
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <SegmentedControl
          ariaLabel="Primary views"
          className="w-full sm:w-auto"
          options={(['library', 'console'] as const).map((view) => ({ label: viewLabels[view], value: view }))}
          value={activeView}
          onChange={onViewChange}
        />

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button size="compact" variant="secondary" onClick={onOpenSettings}>
            Settings
          </Button>
        </div>
      </div>
    </header>
  );
}
