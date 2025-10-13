import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import InitiativeList from './InitiativeList';
import CombatantCard from './CombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import Modal from './Modal';
import type { StatusEffectTemplate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useEncounterContext } from '../context/EncounterContext';
import EncounterManager from './EncounterManager';

type CarouselItemStyle = CSSProperties & {
  '--offset'?: number;
  '--abs-offset'?: number;
};

const CombatTracker = () => {
  const { selectedEncounterId, selectedEncounter } = useEncounterContext();
  const { state, actions, presets, isLoading } = useCombatTracker(selectedEncounterId);
  const { user, handleSignOut } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(!selectedEncounterId);
  const [lastRoll, setLastRoll] = useState<{ die: number; result: number } | null>(null);
  const initiativeScrollRef = useRef<HTMLDivElement | null>(null);
  const initiativeRefs = useRef(new Map<string, HTMLLIElement>());
  const viewerWindowRef = useRef<Window | null>(null);

  const handleAddStatus = (combatantId: string, template: StatusEffectTemplate, rounds: number | null, note?: string) => {
    actions.addStatus(combatantId, template, rounds, note);
  };

  const scrollItemIntoView = (container: HTMLElement, element: HTMLElement) => {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (elementRect.top < containerRect.top) {
      container.scrollBy({ top: elementRect.top - containerRect.top - 12, behavior: 'smooth' });
      return;
    }

    if (elementRect.bottom > containerRect.bottom) {
      container.scrollBy({ top: elementRect.bottom - containerRect.bottom + 12, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!state.activeCombatantId) return;
    const container = initiativeScrollRef.current;
    const item = initiativeRefs.current.get(state.activeCombatantId);
    if (!container || !item) return;
    scrollItemIntoView(container, item);
  }, [state.activeCombatantId, state.combatants]);

  useEffect(() => {
    setIsSelectionModalOpen(!selectedEncounterId);
  }, [selectedEncounterId]);

  useEffect(() => {
    return () => {
      const popup = viewerWindowRef.current;
      if (popup && !popup.closed) {
        popup.close();
      }
    };
  }, []);

  const handleCloseSelectionModal = () => {
    if (!selectedEncounterId) return;
    setIsSelectionModalOpen(false);
  };

  const rollDie = (sides: number) => {
    const result = Math.floor(Math.random() * sides) + 1;
    setLastRoll({ die: sides, result });
  };

  const openViewerWindow = () => {
    if (typeof window === 'undefined') return;

    const existing = viewerWindowRef.current;
    if (existing && existing.closed) {
      viewerWindowRef.current = null;
    } else if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const screenWidth = window.screen?.availWidth ?? window.innerWidth;
    const screenHeight = window.screen?.availHeight ?? window.innerHeight;
    const width = Math.min(1200, screenWidth);
    const height = Math.min(900, screenHeight);
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const features = [
      'popup=yes',
      'resizable=yes',
      'scrollbars=yes',
      `width=${Math.round(width)}`,
      `height=${Math.round(height)}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`
    ].join(',');
    const popup = window.open('/viewer', 'combatant-viewer', features);
    if (!popup) {
      window.alert('Allow pop-ups to open the player view.');
      return;
    }
    viewerWindowRef.current = popup;
    popup.focus();
  };


  const activeIndex = state.activeCombatantId
    ? state.combatants.findIndex((combatant) => combatant.id === state.activeCombatantId)
    : 0;
  const normalizedActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  if (isLoading) {
    return (
      <div className="tracker-shell">
        <div className="empty-state">
          <h3>Loading encounter…</h3>
          <p>Please wait while we retrieve the latest state.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div className="tracker-top-row">
          <div className="tracker-heading">
            <h1>D&D Combat Tracker</h1>
            <p className="tracker-subtitle">Keep the encounter flowing with initiative, damage, and status tracking.</p>
          </div>
          <div className="tracker-round">
            <span className="label">Round</span>
            <span className="value">{state.round}</span>
          </div>
          <div className="session-info">
            <span className="session-label">Encounter</span>
            <span className="session-value">{selectedEncounter?.name ?? 'Untitled Encounter'}</span>
            <button type="button" className="ghost" onClick={() => setIsSelectionModalOpen(true)}>
              Switch
            </button>
          </div>
          <div className="session-info">
            <span className="session-label">Signed in as</span>
            <span className="session-value">{user?.email}</span>
            <button type="button" className="ghost" onClick={() => void handleSignOut()}>
              Sign Out
            </button>
          </div>
          <div className="session-info session-info--viewer">
            <span className="session-label">Player View</span>
            {!selectedEncounterId && (
              <span className="session-value">Select an encounter</span>
            )}
            <button
              type="button"
              className="ghost"
              onClick={openViewerWindow}
              disabled={!selectedEncounterId}
            >
              Open Viewer
            </button>
          </div>
        </div>
        <div className="dice-tray" aria-live="polite">
          <div className="dice-buttons">
            {[20, 12, 10, 8, 6, 4].map((sides) => (
              <button
                key={'die-' + sides}
                type="button"
                className="ghost"
                onClick={() => rollDie(sides)}
              >
                d{sides}
              </button>
            ))}
          </div>
          <p className={`dice-result${lastRoll ? '' : ' is-empty'}`}>
            {lastRoll ? `Rolled d${lastRoll.die}: ${lastRoll.result}` : 'Roll a die to see the result here.'}
          </p>
        </div>
      </header>

      <div className="tracker-main">
        <aside className="initiative-column">
          <section className="initiative-bar">
            <div className="panel-head">
              <h2>Initiative Order</h2>
              <button type="button" className="ghost" onClick={() => setIsCreateModalOpen(true)}>
                Add Combatant
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

            <button type="button" className="ghost wide" onClick={actions.resetEncounter}>
              Reset Encounter
            </button>
          </section>
        </aside>

        <section className="combatant-strip">
          <div className="turn-controls turn-controls--carousel">
            <button type="button" onClick={actions.rewindTurn} className="ghost">
              ⏮ Prev
            </button>
            <button type="button" onClick={actions.advanceTurn} className="primary">
              Next ⏭
            </button>
          </div>
          {state.combatants.length === 0 ? (
            <div className="empty-state">
              <h3>No combatants yet</h3>
              <p>Add heroes and foes to begin tracking this encounter.</p>
              {!isCreateModalOpen && (
                <button type="button" className="primary" onClick={() => setIsCreateModalOpen(true)}>
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
                    pointerEvents: isActive ? 'auto' : 'none'
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
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} ariaLabel="Add combatant form">
        <AddCombatantForm
          onCreate={(payload, options) => {
            actions.addCombatant(payload);
            if (!options?.stayOpen) {
              setIsCreateModalOpen(false);
            }
          }}
          iconOptions={presets.icons}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>
      <Modal
        isOpen={isSelectionModalOpen}
        onClose={handleCloseSelectionModal}
        ariaLabel="Encounter selection"
      >
        <EncounterManager onClose={handleCloseSelectionModal} disableClose={!selectedEncounterId} />
      </Modal>
    </div>
  );
};

export default CombatTracker;
