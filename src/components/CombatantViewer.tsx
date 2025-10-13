import type { CSSProperties, ReactNode } from 'react';
import ViewerCombatantCard from './ViewerCombatantCard';
import { useEncounterContext } from '../context/EncounterContext';
import { useCombatTracker } from '../hooks/useCombatTracker';

type CarouselItemStyle = CSSProperties & {
  '--offset'?: number;
  '--abs-offset'?: number;
};

const CombatantViewer = () => {
  const { selectedEncounterId, selectedEncounter } = useEncounterContext();
  const { state, isLoading } = useCombatTracker(selectedEncounterId);

  const normalizedActiveIndex = state.activeIndex >= 0 ? state.activeIndex : 0;
  const activeCombatant = state.combatants[normalizedActiveIndex];

  let content: ReactNode;
  if (isLoading) {
    content = (
      <div className="empty-state">
        <h3>Loading encounter…</h3>
        <p>Hang tight while we mirror the latest state.</p>
      </div>
    );
  } else if (!selectedEncounterId) {
    content = (
      <div className="empty-state">
        <h3>No encounter selected</h3>
        <p>Select an encounter in the main tracker to project it here.</p>
      </div>
    );
  } else if (state.combatants.length === 0) {
    content = (
      <div className="empty-state">
        <h3>Waiting for combatants</h3>
        <p>The encounter is ready once the GM adds combatants.</p>
      </div>
    );
  } else {
    content = (
      <div className="combatant-carousel viewer-carousel">
        <div className="combatant-carousel-track">
          {state.combatants.map((combatant, index) => {
            const isActive = index === normalizedActiveIndex;
            const offset = index - normalizedActiveIndex;
            const distance = Math.abs(offset);
            const style: CarouselItemStyle = {
              '--offset': offset,
              '--abs-offset': distance,
              zIndex: state.combatants.length - distance,
              opacity: distance > 2 ? 0 : Math.max(0.25, 1 - distance * 0.18),
              pointerEvents: 'none'
            };

            return (
              <div key={combatant.id} className={`combatant-carousel-item${isActive ? ' active' : ''}`} style={style}>
                <ViewerCombatantCard combatant={combatant} isActive={isActive} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-shell viewer-shell">
      <header className="viewer-header">
        <div className="viewer-heading">
          <h1>{selectedEncounter?.name ?? 'Encounter Viewer'}</h1>
          <p className="viewer-subtitle">
            {selectedEncounterId ? `Round ${state.round}` : 'Waiting for encounter selection'}
          </p>
        </div>
        <div className="viewer-meta">
          <span className="viewer-label">Active Turn</span>
          <span className="viewer-value">{activeCombatant?.name ?? '—'}</span>
        </div>
      </header>

      <main className="viewer-main">{content}</main>
    </div>
  );
};

export default CombatantViewer;
