import { cn } from '../lib/cn';
import { eyebrowClass, mutedTextClass, panelClass } from './ui/styles';

interface AppHeaderProps {
  activeView: 'library' | 'console';
  onViewChange: (view: 'library' | 'console') => void;
}

const viewLabels = {
  console: 'Console',
  library: 'Library'
} as const;

export function AppHeader({ activeView, onViewChange }: AppHeaderProps) {
  return (
    <header className={cn(panelClass, 'relative overflow-hidden')}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,212,199,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,138,76,0.16),transparent_40%)]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className={eyebrowClass}>ATC Watchtower</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
            ATC feed library and listening console
          </h1>
          <p className={mutedTextClass}>
            Import local playlists, pick an airport, and let the priority engine decide which active feed stays on air.
          </p>
        </div>

        <nav
          aria-label="Primary views"
          className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.06] p-1 backdrop-blur"
        >
          {(['library', 'console'] as const).map((view) => (
            <button
              key={view}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                activeView === view
                  ? 'bg-gradient-to-r from-teal to-cyan-100 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-stone-100'
              )}
              type="button"
              onClick={() => onViewChange(view)}
            >
              {viewLabels[view]}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
