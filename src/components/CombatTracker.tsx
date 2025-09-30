import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import InitiativeList from './InitiativeList';
import CombatantCard from './CombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import type { StatusEffectTemplate } from '../types';

type CarouselItemStyle = CSSProperties & {
  '--offset'?: number;
  '--abs-offset'?: number;
};

const CombatTracker = () => {
  const { state, actions, presets } = useCombatTracker();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const initiativeScrollRef = useRef<HTMLDivElement | null>(null);
  const initiativeRefs = useRef(new Map<string, HTMLLIElement>());

  const handleAddStatus = (combatantId: string, template: StatusEffectTemplate, rounds: number | null, note?: string) => {
    actions.addStatus(combatantId, template, rounds, note);
  };

  const scrollItemIntoView = (container: HTMLElement, element: HTMLElement) => {
    const containerWidth = container.clientWidth;
    const containerScroll = container.scrollLeft;
    const elementLeft = element.offsetLeft;
    const elementWidth = element.offsetWidth;
    const elementRight = elementLeft + elementWidth;
    const containerRight = containerScroll + containerWidth;

    if (elementLeft >= containerScroll && elementRight <= containerRight) {
      return;
    }

    const target = elementLeft - (containerWidth - elementWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  };

  useEffect(() => {
    if (!state.activeCombatantId) return;
    const container = initiativeScrollRef.current;
    const item = initiativeRefs.current.get(state.activeCombatantId);
    if (!container || !item) return;
    scrollItemIntoView(container, item);
  }, [state.activeCombatantId, state.combatants]);

  const activeIndex = state.activeCombatantId
    ? state.combatants.findIndex((combatant) => combatant.id === state.activeCombatantId)
    : 0;
  const normalizedActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <h1>D&D Combat Tracker</h1>
          <p className="tracker-subtitle">Keep the encounter flowing with initiative, damage, and status tracking.</p>
        </div>
        <div className="tracker-round">
          <span className="label">Round</span>
          <span className="value">{state.round}</span>
        </div>
        <div className="turn-controls">
          <button type="button" onClick={actions.rewindTurn} className="ghost">
            ⏮ Prev
          </button>
          <button type="button" onClick={actions.advanceTurn} className="primary">
            Next ⏭
          </button>
        </div>
      </header>

      <div className="tracker-main">
        <section className="initiative-bar">
          <div className="panel-head">
            <h2>Initiative Order</h2>
            <button
              type="button"
              className="ghost"
              onClick={() => setShowCreatePanel((value) => !value)}
            >
              {showCreatePanel ? 'Close' : 'Add Combatant'}
            </button>
          </div>

          <div className="initiative-scroll" ref={initiativeScrollRef}>
            <InitiativeList
              combatants={state.combatants}
              activeId={state.activeCombatantId}
              onSelect={actions.setActiveCombatant}
              registerItemRef={(id, node) => {
                if (node) {
                  initiativeRefs.current.set(id, node);
                } else {
                  initiativeRefs.current.delete(id);
                }
              }}
            />
          </div>

          {showCreatePanel && (
            <AddCombatantForm
              onCreate={(payload) => {
                actions.addCombatant(payload);
                setShowCreatePanel(false);
              }}
              iconOptions={presets.icons}
            />
          )}

          <button type="button" className="ghost wide" onClick={actions.resetEncounter}>
            Reset Encounter
          </button>
        </section>

        <section className="combatant-strip">
          {state.combatants.length === 0 ? (
            <div className="empty-state">
              <h3>No combatants yet</h3>
              <p>Add heroes and foes to begin tracking this encounter.</p>
              {!showCreatePanel && (
                <button type="button" className="primary" onClick={() => setShowCreatePanel(true)}>
                  Add Combatant
                </button>
              )}
            </div>
          ) : (
            <div className="combatant-carousel">
              <div className="combatant-carousel-track">
                {state.combatants.map((combatant, index) => {
                  const isActive = combatant.id === state.activeCombatantId || (!state.activeCombatantId && index === normalizedActiveIndex);
                  const offset = index - normalizedActiveIndex;
                  const distance = Math.abs(offset);
                  const style: CarouselItemStyle = {
                    '--offset': offset,
                    '--abs-offset': distance,
                    zIndex: state.combatants.length - distance,
                    opacity: distance > 2 ? 0 : Math.max(0.2, 1 - distance * 0.18),
                    pointerEvents: distance > 2 ? 'none' : 'auto'
                  };

                  return (
                    <div
                      key={combatant.id}
                      className={`combatant-carousel-item${isActive ? ' active' : ''}`}
                      style={style}
                    >
                      <CombatantCard
                        combatant={combatant}
                        isActive={isActive}
                        onCenter={() => actions.setActiveCombatant(combatant.id)}
                        onDamage={(amount) => actions.applyDelta(combatant.id, amount)}
                        onHeal={(amount) => actions.applyDelta(combatant.id, -amount)}
                        onRemove={() => actions.removeCombatant(combatant.id)}
                        onUpdate={(changes) => actions.updateCombatant(combatant.id, changes)}
                        onAddStatus={(template, rounds, note) => handleAddStatus(combatant.id, template, rounds, note)}
                        onRemoveStatus={(statusId) => actions.removeStatus(combatant.id, statusId)}
                        statusPresets={presets.statuses}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CombatTracker;
