import { useState } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import InitiativeList from './InitiativeList';
import CombatantCard from './CombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import type { StatusEffectTemplate } from '../types';

const CombatTracker = () => {
  const { state, actions, presets } = useCombatTracker();
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const handleAddStatus = (combatantId: string, template: StatusEffectTemplate, rounds: number | null, note?: string) => {
    actions.addStatus(combatantId, template, rounds, note);
  };

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

      <div className="tracker-layout">
        <aside className="initiative-column">
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

          <InitiativeList
            combatants={state.combatants}
            activeId={state.activeCombatantId}
            onSelect={actions.setActiveCombatant}
          />

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
        </aside>

        <section className="combatant-grid">
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
            state.combatants.map((combatant) => (
              <CombatantCard
                key={combatant.id}
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
            ))
          )}
        </section>
      </div>
    </div>
  );
};

export default CombatTracker;
