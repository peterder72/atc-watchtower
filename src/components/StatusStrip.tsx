import { StatusField } from './ui/common';

interface StatusStripProps {
  importedAirports: number;
  selectedFeeds: number;
  liveFloorStatus: string;
}

export function StatusStrip({ importedAirports, selectedFeeds, liveFloorStatus }: StatusStripProps) {
  return (
    <section className="grid gap-2 sm:grid-cols-3">
      <StatusField label="Imported airports" value={importedAirports} />
      <StatusField label="Selected feeds" value={selectedFeeds} />
      <StatusField label="Live floor" tone={liveFloorStatus === 'Active' ? 'success' : 'neutral'} value={liveFloorStatus} />
    </section>
  );
}
