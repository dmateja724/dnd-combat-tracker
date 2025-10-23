import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import clsx from 'clsx';
import { useCombatTracker } from '../hooks/useCombatTracker';
import { useDeathShowcase } from '../hooks/useDeathShowcase';
import CombatantCard from './CombatantCard';
import DeathShowcase from './DeathShowcase';
import ViewerCombatantCard from './ViewerCombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import AttackActionForm from './forms/AttackActionForm';
import HealActionForm from './forms/HealActionForm';
import Modal from './Modal';
import type { Combatant, StatusEffectTemplate } from '../types';
import { useAuth } from '../context/AuthContext';
import { useEncounterContext } from '../context/EncounterContext';
import EncounterManager from './EncounterManager';
import { useCombatantLibrary } from '../context/CombatantLibraryContext';
import { APP_VERSION } from '../version';
import { exportAccountArchive, restoreAccountFromFile } from '../utils/accountBackup';

type CarouselItemStyle = CSSProperties & {
  '--offset'?: number;
  '--abs-offset'?: number;
};

const CombatTracker = () => {
  const { selectedEncounterId, selectedEncounter, refreshEncounters, selectEncounter } = useEncounterContext();
  const { state, actions, presets, isLoading } = useCombatTracker(selectedEncounterId);
  const { user, handleSignOut } = useAuth();
  const { refresh: refreshCombatantLibrary } = useCombatantLibrary();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttackModalOpen, setIsAttackModalOpen] = useState(false);
  const [isHealModalOpen, setIsHealModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(!selectedEncounterId);
  const [lastRoll, setLastRoll] = useState<{ die: number; result: number } | null>(null);
  const viewerWindowRef = useRef<Window | null>(null);
  const logWindowRef = useRef<Window | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isExportingAccount, setIsExportingAccount] = useState(false);
  const [isImportingAccount, setIsImportingAccount] = useState(false);
  const accountImportInputRef = useRef<HTMLInputElement | null>(null);
  const [deathSaveDecisionQueue, setDeathSaveDecisionQueue] = useState<string[]>([]);
  const previousHpRef = useRef<Map<string, number>>(new Map());
  const { activeShowcase: activeDeathShowcase, dismiss: dismissDeathShowcase } = useDeathShowcase({
    encounterId: selectedEncounterId,
    combatants: state.combatants,
    log: state.log
  });

  const handleAddStatus = (combatantId: string, template: StatusEffectTemplate, rounds: number | null, note?: string) => {
    actions.addStatus(combatantId, template, rounds, note);
  };

  const activeDeathDecisionId = deathSaveDecisionQueue[0] ?? null;
  const activeDeathDecisionCombatant =
    activeDeathDecisionId ? state.combatants.find((candidate) => candidate.id === activeDeathDecisionId) ?? null : null;
  useEffect(() => {
    setIsSelectionModalOpen(!selectedEncounterId);
  }, [selectedEncounterId]);

  useEffect(() => {
    return () => {
      const popup = viewerWindowRef.current;
      if (popup && !popup.closed) {
        popup.close();
      }
      const logPopup = logWindowRef.current;
      if (logPopup && !logPopup.closed) {
        logPopup.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const menu = accountMenuRef.current;
      const button = accountButtonRef.current;
      if (!menu || !button) return;
      if (menu.contains(target) || button.contains(target)) {
        return;
      }
      setIsAccountMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const needsDecision = (combatant: Combatant) =>
      (combatant.type === 'player' || combatant.type === 'ally') &&
      combatant.hp.current <= 0 &&
      !combatant.deathSaves;

    const prevHpMap = previousHpRef.current;
    const nextHpMap = new Map<string, number>();
    const additions: string[] = [];

    state.combatants.forEach((combatant) => {
      nextHpMap.set(combatant.id, combatant.hp.current);
      const previousValue = prevHpMap.get(combatant.id);
      if (needsDecision(combatant) && (previousValue === undefined || previousValue > 0)) {
        additions.push(combatant.id);
      }
    });

    previousHpRef.current = nextHpMap;

    setDeathSaveDecisionQueue((queue) => {
      const filtered = queue.filter((id) => {
        const combatant = state.combatants.find((candidate) => candidate.id === id);
        return combatant ? needsDecision(combatant) : false;
      });
      const existing = new Set(filtered);
      additions.forEach((id) => existing.add(id));
      return Array.from(existing);
    });
  }, [state.combatants]);

  const handleResetEncounter = () => {
    if (!selectedEncounterId) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Reset this encounter? This action cannot be undone.');
      if (!confirmed) {
        return;
      }
    }
    actions.resetEncounter();
    setIsAccountMenuOpen(false);
  };

  const handleCloseSelectionModal = () => {
    if (!selectedEncounterId) return;
    setIsSelectionModalOpen(false);
  };

  const handleOpenEncounterSelector = () => {
    setIsAccountMenuOpen(false);
    setIsSelectionModalOpen(true);
  };

  const handleMarkUnconscious = (combatantId: string) => {
    actions.startDeathSaves(combatantId, state.round);
    setDeathSaveDecisionQueue((queue) => queue.filter((id) => id !== combatantId));
  };

  const handleMarkDead = (combatantId: string) => {
    actions.markCombatantDead(combatantId, state.round);
    setDeathSaveDecisionQueue((queue) => queue.filter((id) => id !== combatantId));
  };

  const handleRecordDeathSave = (combatantId: string, result: 'success' | 'failure') => {
    actions.recordDeathSaveResult(combatantId, result, state.round);
  };

  const rollDie = (sides: number) => {
    const result = Math.floor(Math.random() * sides) + 1;
    setLastRoll({ die: sides, result });
  };

  const openViewerWindow = () => {
    if (typeof window === 'undefined') return;
    setIsAccountMenuOpen(false);

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

  const openLogWindow = () => {
    if (typeof window === 'undefined') return;
    setIsAccountMenuOpen(false);

    const existing = logWindowRef.current;
    if (existing && existing.closed) {
      logWindowRef.current = null;
    } else if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const screenWidth = window.screen?.availWidth ?? window.innerWidth;
    const screenHeight = window.screen?.availHeight ?? window.innerHeight;
    const width = Math.min(460, screenWidth);
    const height = Math.min(720, screenHeight);
    const left = window.screenX + Math.max(0, window.outerWidth - width - 20);
    const top = window.screenY + 40;
    const features = [
      'popup=yes',
      'resizable=yes',
      'scrollbars=yes',
      `width=${Math.round(width)}`,
      `height=${Math.round(height)}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`
    ].join(',');
    const popup = window.open('/log', 'combat-log-viewer', features);
    if (!popup) {
      window.alert('Allow pop-ups to open the combat log view.');
      return;
    }
    logWindowRef.current = popup;
    popup.focus();
  };

  const handleExportAccount = async () => {
    if (typeof window === 'undefined') return;
    if (isExportingAccount) return;
    setIsExportingAccount(true);
    setIsAccountMenuOpen(false);
    try {
      const result = await exportAccountArchive();
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (result.skippedEncounters.length > 0) {
        window.alert(
          `Export completed with warnings. Skipped ${result.skippedEncounters.length} encounter` +
            `${result.skippedEncounters.length === 1 ? '' : 's'} during export.`
        );
      }
    } catch (error) {
      console.error('Failed to export account archive', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred during export.';
      window.alert('Could not export account: ' + message);
    } finally {
      setIsExportingAccount(false);
    }
  };

  const handleImportAccountClick = () => {
    if (isImportingAccount) return;
    const input = accountImportInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handleAccountImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (typeof window === 'undefined') {
      console.warn('Import is only available in the browser.');
      return;
    }
    const confirmed = window.confirm(
      'Importing a backup will replace your current combatant library and encounters. Continue?'
    );
    if (!confirmed) {
      return;
    }

    setIsImportingAccount(true);
    setIsAccountMenuOpen(false);
    selectEncounter(null);
    try {
      const { summary, warnings } = await restoreAccountFromFile(file, {
        refreshCombatantLibrary,
        refreshEncounters,
        selectEncounter
      });

      if (warnings.length > 0) {
        window.alert(`${summary}\n\nWarnings:\n- ${warnings.join('\n- ')}`);
      } else {
        window.alert(summary);
      }
    } catch (error) {
      console.error('Failed to import account archive', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred during import.';
      window.alert('Could not import account: ' + message);
    } finally {
      setIsImportingAccount(false);
    }
  };


  const rawAccountName = user?.email ?? 'Unknown User';
  const accountLabel = rawAccountName.includes('@') ? rawAccountName.split('@')[0] : rawAccountName;
  const accountNameClass = clsx('account-name', {
    'account-name--small': accountLabel.length > 18,
    'account-name--xsmall': accountLabel.length > 26
  });

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
      {activeDeathShowcase ? (
        <DeathShowcase
          card={<ViewerCombatantCard combatant={activeDeathShowcase.combatant} isActive />}
          message={activeDeathShowcase.logEntry.message}
          onDismiss={dismissDeathShowcase}
        />
      ) : null}
      <header className="tracker-header">
        <div className="tracker-top-row">
          <div className="tracker-heading">
            <h1>{selectedEncounter?.name ?? 'Untitled Encounter'}</h1>
          </div>
          <div className="tracker-round">
            <span className="label">Round</span>
            <span className="value">{state.round}</span>
          </div>
          <div className="tracker-meta">
            <div className="account-menu-wrapper">
              <button
                type="button"
                className="account-trigger"
                onClick={() => setIsAccountMenuOpen((value) => !value)}
                aria-haspopup="true"
                aria-expanded={isAccountMenuOpen}
                aria-label="Account menu"
                ref={accountButtonRef}
                disabled={!selectedEncounterId}
                title="Account menu"
              >
                <span aria-hidden="true" className="account-trigger-icon">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              <input
                ref={accountImportInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(event) => void handleAccountImportFile(event)}
                style={{ display: 'none' }}
              />
              {isAccountMenuOpen ? (
                <div className="account-menu" role="menu" ref={accountMenuRef}>
                  <div className="account-menu-header" role="presentation">
                    <span className={accountNameClass}>{accountLabel}</span>
                  </div>
                  <button type="button" onClick={handleOpenEncounterSelector} role="menuitem">
                    Switch Encounter
                  </button>
                  <button type="button" onClick={openLogWindow} role="menuitem">
                    Open Combat Log
                  </button>
                  <button type="button" onClick={openViewerWindow} role="menuitem" disabled={!selectedEncounterId}>
                    Open Player View
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportAccount()}
                    role="menuitem"
                    disabled={isExportingAccount || isImportingAccount}
                  >
                    {isExportingAccount ? 'Exporting…' : 'Export Account'}
                  </button>
                  <button
                    type="button"
                    onClick={handleImportAccountClick}
                    role="menuitem"
                    disabled={isImportingAccount || isExportingAccount}
                  >
                    {isImportingAccount ? 'Importing…' : 'Import Account'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEncounter}
                    role="menuitem"
                    disabled={!selectedEncounterId}
                  >
                    Reset Encounter
                  </button>
                  <button type="button" onClick={() => void handleSignOut()} role="menuitem">
                    Sign Out
                  </button>
                  <div className="account-version" role="presentation">
                    Version {APP_VERSION}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="header-secondary">
          <button
            type="button"
            className="primary header-add-combatant"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!selectedEncounterId}
          >
            Add Combatant
          </button>
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
        </div>
      </header>

      <div className="tracker-main">
        <section className="combatant-strip">
          <div className="turn-controls turn-controls--carousel">
            <button type="button" onClick={actions.rewindTurn} className="ghost">
              ⏮ Prev
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setIsAttackModalOpen(true)}
              disabled={state.combatants.length < 2}
            >
              ⚔️ Attack
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setIsHealModalOpen(true)}
              disabled={state.combatants.length === 0}
            >
              ✨ Heal
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
                        onSetDeathSaveCounts={(successes, failures) =>
                          actions.setDeathSaveCounts(combatant.id, successes, failures)
                        }
                        onClearDeathSaves={() => actions.clearDeathSaves(combatant.id)}
                        onRecordDeathSave={(result) => handleRecordDeathSave(combatant.id, result)}
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
      <Modal
        isOpen={Boolean(activeDeathDecisionCombatant)}
        onClose={() => {}}
        ariaLabel="Death state prompt"
      >
        {activeDeathDecisionCombatant ? (
          <div className="death-prompt-shell">
            <div className="death-prompt">
              <h3>{activeDeathDecisionCombatant.name} is at 0 HP</h3>
              <p>
                Choose <strong>Unconscious</strong> to begin tracking death saves automatically, or
                mark them as dead if there is no chance of recovery.
              </p>
              <div className="death-prompt-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => handleMarkUnconscious(activeDeathDecisionCombatant.id)}
                >
                  Unconscious
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => handleMarkDead(activeDeathDecisionCombatant.id)}
                >
                  Dead
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        isOpen={isAttackModalOpen}
        onClose={() => setIsAttackModalOpen(false)}
        ariaLabel="Resolve attack form"
      >
        <AttackActionForm
          combatants={state.combatants}
          defaultAttackerId={state.activeCombatantId}
          onSubmit={(payload) => {
            actions.recordAttack(payload);
            setIsAttackModalOpen(false);
          }}
          onCancel={() => setIsAttackModalOpen(false)}
        />
      </Modal>
      <Modal
        isOpen={isHealModalOpen}
        onClose={() => setIsHealModalOpen(false)}
        ariaLabel="Apply healing form"
      >
        <HealActionForm
          combatants={state.combatants}
          defaultTargetId={state.activeCombatantId}
          onSubmit={(payload) => {
            actions.recordHeal(payload);
            setIsHealModalOpen(false);
          }}
          onCancel={() => setIsHealModalOpen(false)}
        />
      </Modal>
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
