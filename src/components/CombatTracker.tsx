import { useEffect, useRef, useState } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import InitiativeList from './InitiativeList';
import CombatantCard from './CombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import type { StatusEffectTemplate } from '../types';

const CombatTracker = () => {
  const { state, actions, presets } = useCombatTracker();
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const initiativeScrollRef = useRef<HTMLDivElement | null>(null);
  const initiativeRefs = useRef(new Map<string, HTMLLIElement>());
  const combatantScrollRef = useRef<HTMLDivElement | null>(null);
  const combatantRefs = useRef(new Map<string, HTMLDivElement>());

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

  useEffect(() => {
    if (!state.activeCombatantId) return;
    const container = combatantScrollRef.current;
    const card = combatantRefs.current.get(state.activeCombatantId);
    if (!container || !card) return;
    scrollItemIntoView(container, card);
  }, [state.activeCombatantId, state.combatants]);

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <h1>Dungeons & Tactics</h1>
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
            <div className="combatant-scroll" ref={combatantScrollRef}>
              {state.combatants.map((combatant) => (
                <div
                  key={combatant.id}
                  className="combatant-card-wrapper"
                  ref={(node) => {
                    if (node) {
                      combatantRefs.current.set(combatant.id, node);
                    } else {
                      combatantRefs.current.delete(combatant.id);
                    }
                  }}
                >
                  <CombatantCard
                    combatant={combatant}
                    isActive={combatant.id === state.activeCombatantId}
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
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CombatTracker;
