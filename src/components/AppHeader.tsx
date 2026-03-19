import { cn } from '../lib/cn';
import { Button, SegmentedControl } from './ui/common';
import { StatusStrip } from './StatusStrip';
import { eyebrowClass, mutedTextClass, panelClass } from './ui/styles';

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
    <header className={cn(panelClass, 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start')}>
      <div className="grid gap-4">
        <div className="max-w-4xl space-y-2">
          <p className={eyebrowClass}>ATC Watchtower</p>
          <h1 className="text-[1.2rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)] sm:text-[1.35rem]">
            Priority ATC Monitor
          </h1>
          <p className={mutedTextClass}>
            Import local playlists, set feed order, and monitor whichever transmission owns the floor.
          </p>
        </div>
        <StatusStrip importedAirports={importedAirports} liveFloorStatus={liveFloorStatus} selectedFeeds={selectedFeeds} />
      </div>

      <div className="grid gap-3 xl:justify-items-end">
        <SegmentedControl
          ariaLabel="Primary views"
          options={(['library', 'console'] as const).map((view) => ({ label: viewLabels[view], value: view }))}
          value={activeView}
          onChange={onViewChange}
        />

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <Button variant="secondary" onClick={onOpenSettings}>
            Settings
          </Button>
        </div>
      </div>
    </header>
  );
}
