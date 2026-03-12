import { StatCard } from './ui/common';

interface StatusStripProps {
  importedAirports: number;
  selectedFeeds: number;
  liveFloorStatus: string;
}

export function StatusStrip({ importedAirports, selectedFeeds, liveFloorStatus }: StatusStripProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <StatCard label="Imported airports" value={importedAirports} />
      <StatCard label="Selected feeds" value={selectedFeeds} />
      <StatCard label="Live floor" value={liveFloorStatus} />
    </section>
  );
}
