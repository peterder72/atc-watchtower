import type { EngineSnapshot, FeedDef } from '../domain/models';

interface ConsoleViewProps {
  airportName: string;
  feeds: FeedDef[];
  feedPriorities: Record<string, number>;
  engineSnapshot: EngineSnapshot;
  onStart: () => void;
  onStop: () => void;
}

function formatLevel(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

function formatTime(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(1);
}

export function ConsoleView({
  airportName,
  feeds,
  feedPriorities,
  engineSnapshot,
  onStart,
  onStop
}: ConsoleViewProps) {
  const canStart = feeds.length > 0 && !engineSnapshot.running;
  const activeSpeaker = engineSnapshot.floorFeedId
    ? feeds.find((feed) => feed.id === engineSnapshot.floorFeedId)?.label ?? engineSnapshot.floorFeedId
    : null;

  return (
    <section className="panel stack-lg">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Console</p>
          <h2>{airportName || 'No airport selected'}</h2>
          <p className="console-speaker">
            {activeSpeaker ? `Current speaker: ${activeSpeaker}` : 'Current speaker: none detected'}
          </p>
        </div>
        <div className="console-actions">
          <button className="secondary-button" type="button" disabled={!engineSnapshot.running} onClick={onStop}>
            Stop
          </button>
          <button className="primary-button" type="button" disabled={!canStart} onClick={onStart}>
            Start listening
          </button>
        </div>
      </div>

      {feeds.length === 0 ? (
        <p className="muted">Select one or more feeds in the Library before starting the console.</p>
      ) : (
        <>
          <div className="console-grid">
            {feeds.map((feed) => {
              const runtime = engineSnapshot.feeds[feed.id];
              const level = runtime ? Math.min(runtime.peak * 600, 100) : 0;

              return (
                <article key={feed.id} className={`feed-card ${runtime?.isFloor ? 'is-floor' : ''}`}>
                  <div className="feed-card-header">
                    <div>
                      <p className="eyebrow">Feed</p>
                      <h3>{feed.label}</h3>
                    </div>
                    <span className="priority-pill">P{feedPriorities[feed.id] ?? feed.defaultPriority}</span>
                  </div>

                  <div className="status-row">
                    <span className={`status-pill ${runtime?.isFloor ? 'status-floor' : runtime?.gateOpen ? 'status-active' : 'status-idle'}`}>
                      {runtime?.isFloor ? 'Talking now' : runtime?.gateOpen ? 'Signal detected' : 'Idle'}
                    </span>
                    <span className={`status-pill ${runtime?.status === 'error' ? 'status-error' : 'status-tech'}`}>
                      {runtime?.status ?? 'idle'}
                    </span>
                  </div>

                  <div className="meter-block">
                    <div className="meter-labels">
                      <span>Peak</span>
                      <span>{formatLevel(runtime?.peak ?? 0)}</span>
                    </div>
                    <div className="meter-track">
                      <span className="meter-fill" style={{ width: `${level}%` }} />
                    </div>
                  </div>

                  <dl className="feed-facts">
                    <div>
                      <dt>Gate</dt>
                      <dd>{runtime?.gateOpen ? 'open' : 'closed'}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>{feedPriorities[feed.id] ?? feed.defaultPriority}</dd>
                    </div>
                    <div>
                      <dt>Floor owner</dt>
                      <dd>{engineSnapshot.floorFeedId === feed.id ? 'current' : 'no'}</dd>
                    </div>
                  </dl>

                  {runtime?.error ? <p className="error-text">{runtime.error}</p> : null}
                </article>
              );
            })}
          </div>

          <section className="subpanel stack-sm debug-panel">
            <div>
              <p className="eyebrow">Debug</p>
              <h3>Signal pipeline</h3>
            </div>
            {feeds.map((feed) => {
              const runtime = engineSnapshot.feeds[feed.id];
              return (
                <div key={feed.id} className="debug-row">
                  <strong>{feed.label}</strong>
                  <span>mode: {runtime?.analysisMode ?? 'none'}</span>
                  <span>status: {runtime?.status ?? 'idle'}</span>
                  <span>gate: {runtime?.gateOpen ? 'open' : 'closed'}</span>
                  <span>floor: {runtime?.isFloor ? 'yes' : 'no'}</span>
                  <span>peak: {formatLevel(runtime?.peak ?? 0)}</span>
                  <span>readyState: {runtime?.readyState ?? -1}</span>
                  <span>networkState: {runtime?.networkState ?? -1}</span>
                  <span>currentTime: {formatTime(runtime?.currentTime)}</span>
                  <span>paused: {runtime?.paused ? 'yes' : 'no'}</span>
                  <span>captureTracks: {runtime?.captureTrackCount ?? 0}</span>
                  <span>{runtime?.debug ?? 'no debug message'}</span>
                </div>
              );
            })}
          </section>
        </>
      )}
    </section>
  );
}
