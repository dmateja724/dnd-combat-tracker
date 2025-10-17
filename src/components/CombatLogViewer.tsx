import { useMemo } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import { useEncounterContext } from '../context/EncounterContext';
import type { CombatLogEntry, CombatLogEventType } from '../types';

const typeIcons: Record<CombatLogEventType, string> = {
  attack: '⚔️',
  damage: '🗡️',
  heal: '✨',
  turn: '⏱️',
  'status-add': '➕',
  'status-remove': '➖',
  'combatant-add': '🎯',
  'combatant-remove': '🚪',
  death: '💀',
  info: 'ℹ️'
};

const typeLabels: Record<CombatLogEventType, string> = {
  attack: 'Attack',
  damage: 'Damage',
  heal: 'Heal',
  turn: 'Turn',
  'status-add': 'Status Added',
  'status-remove': 'Status Removed',
  'combatant-add': 'Combatant Added',
  'combatant-remove': 'Combatant Removed',
  death: 'Death',
  info: 'Info'
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const renderEntry = (entry: CombatLogEntry) => (
  <article key={entry.id} className={`combat-log-item combat-log-item--${entry.type}`}>
    <div className="combat-log-icon" aria-hidden="true">
      {typeIcons[entry.type]}
    </div>
    <div className="combat-log-content">
      <header>
        <span className="combat-log-type">{typeLabels[entry.type]}</span>
        <span className="combat-log-time">{formatTimestamp(entry.timestamp)}</span>
      </header>
      <p>{entry.message}</p>
      <footer>
        <span>Round {entry.round}</span>
        {typeof entry.amount === 'number' ? <span>{entry.amount} HP</span> : null}
      </footer>
    </div>
  </article>
);

const CombatLogViewer = () => {
  const { selectedEncounterId, selectedEncounter } = useEncounterContext();
  const { state, actions, isLoading } = useCombatTracker(selectedEncounterId);

  const entries = useMemo(() => [...state.log].reverse(), [state.log]);

  let body: JSX.Element;
  if (isLoading) {
    body = (
      <div className="combat-log-empty">
        <h3>Loading encounter…</h3>
        <p>Fetching the latest battle notes.</p>
      </div>
    );
  } else if (!selectedEncounterId) {
    body = (
      <div className="combat-log-empty">
        <h3>No encounter selected</h3>
        <p>Choose an encounter in the main tracker to view its combat log.</p>
      </div>
    );
  } else if (entries.length === 0) {
    body = (
      <div className="combat-log-empty">
        <h3>Log is empty</h3>
        <p>Actions like damage, healing, status changes, and turns will appear here.</p>
      </div>
    );
  } else {
    body = <div className="combat-log-list">{entries.map(renderEntry)}</div>;
  }

  return (
    <div className="tracker-shell log-viewer-shell">
      <header className="log-viewer-header">
        <div className="log-viewer-title">
          <h1>{selectedEncounter?.name ?? 'Combat Log'}</h1>
          <p className="log-viewer-subtitle">
            {selectedEncounterId ? `Round ${state.round}` : 'Awaiting encounter selection'}
          </p>
        </div>
        <div className="log-viewer-meta">
          <div className="log-viewer-count">
            <span className="log-meta-label">Entries</span>
            <span className="log-meta-value">{state.log.length}</span>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => actions.clearLog()}
            disabled={state.log.length === 0}
          >
            Clear Log
          </button>
        </div>
      </header>
      <main className="log-viewer-main">{body}</main>
    </div>
  );
};

export default CombatLogViewer;
