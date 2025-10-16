import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Combatant, StatusEffectTemplate } from '../types';
import { UpdateCombatantInput } from '../hooks/useCombatTracker';
import Modal from './Modal';
import { useCombatantLibrary } from '../context/CombatantLibraryContext';

interface CombatantCardProps {
  combatant: Combatant;
  isActive: boolean;
  statusPresets: StatusEffectTemplate[];
  onCenter: () => void;
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onRemove: () => void;
  onUpdate: (changes: UpdateCombatantInput) => void;
  onAddStatus: (template: StatusEffectTemplate, remaining: number | null, note?: string) => void;
  onRemoveStatus: (statusId: string) => void;
  onSetDeathSaveCounts: (successes: number, failures: number) => void;
  onClearDeathSaves: () => void;
  onRecordDeathSave: (result: 'success' | 'failure') => void;
}

const quickDamageValues = [1, 5, 10];
const quickHealValues = [1, 5, 10];

const typeToLabel: Record<Combatant['type'], string> = {
  player: 'Adventurer',
  ally: 'Ally',
  enemy: 'Enemy'
};

const CombatantCard = ({
  combatant,
  isActive,
  statusPresets,
  onCenter,
  onDamage,
  onHeal,
  onRemove,
  onUpdate,
  onAddStatus,
  onRemoveStatus,
  onSetDeathSaveCounts,
  onClearDeathSaves,
  onRecordDeathSave
}: CombatantCardProps) => {
  const [customValue, setCustomValue] = useState('');
  const [noteDraft, setNoteDraft] = useState(combatant.note ?? '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string>(statusPresets[0]?.id ?? 'custom');
  const [customStatusLabel, setCustomStatusLabel] = useState('');
  const [customStatusIcon, setCustomStatusIcon] = useState('✦');
  const [customStatusColor, setCustomStatusColor] = useState('#ffb703');
  const [rounds, setRounds] = useState<number | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const { templates, saveTemplate, isMutating } = useCombatantLibrary();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetStatusDraft = () => {
    setSelectedStatusId(statusPresets[0]?.id ?? 'custom');
    setRounds('');
    setStatusNote('');
    setCustomStatusLabel('');
    setCustomStatusIcon('✦');
    setCustomStatusColor('#ffb703');
  };

  const handleOpenStatusPanel = () => {
    resetStatusDraft();
    setStatusPanelOpen(true);
  };

  const closeStatusPanel = () => {
    resetStatusDraft();
    setStatusPanelOpen(false);
  };

  useEffect(() => {
    setNoteDraft(combatant.note ?? '');
  }, [combatant.note, combatant.id]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const healthPercent = useMemo(() => {
    if (combatant.hp.max === 0) return 0;
    return Math.round((combatant.hp.current / combatant.hp.max) * 100);
  }, [combatant.hp.current, combatant.hp.max]);

  const isDefeated = combatant.hp.current <= 0;
  const isCustomValueEmpty = customValue.trim() === '';
  const deathSaves = combatant.deathSaves ?? null;
  const deathSaveStatus = deathSaves?.status ?? null;
  const deathSaveSuccesses = deathSaves?.successes ?? 0;
  const deathSaveFailures = deathSaves?.failures ?? 0;
  const hasDeathSaves = deathSaves !== null;
  const deathSavesLocked = !deathSaves || deathSaves.status === 'dead';
  const canRecordRoll = deathSaveStatus === 'pending';
  const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';
  const isEnemy = combatant.type === 'enemy';
  const youDiedOverlayActive = isPlayerOrAlly && deathSaveStatus === 'dead';
  const enemyFelledOverlayActive = isEnemy && isDefeated;
  const overlayVariant = youDiedOverlayActive ? 'you-died' : enemyFelledOverlayActive ? 'enemy-felled' : null;
  const overlayText = overlayVariant === 'enemy-felled' ? 'ENEMY FELLED' : 'YOU DIED';

  const handleSuccessChipClick = (index: number) => {
    if (!deathSaves || deathSavesLocked) return;
    const desired = index + 1;
    const nextSuccesses = deathSaveSuccesses === desired ? desired - 1 : desired;
    onSetDeathSaveCounts(nextSuccesses, deathSaveFailures);
  };

  const handleFailureChipClick = (index: number) => {
    if (!deathSaves || deathSaveStatus === 'dead') return;
    const desired = index + 1;
    const nextFailures = deathSaveFailures === desired ? desired - 1 : desired;
    onSetDeathSaveCounts(deathSaveSuccesses, nextFailures);
  };

  const handleResetDeathSaves = () => {
    if (!deathSaves) return;
    onSetDeathSaveCounts(0, 0);
  };

  const handleNoteSubmit = () => {
    onUpdate({ note: noteDraft });
    setIsEditingNote(false);
  };

  const handleStatusSubmit = (event: FormEvent) => {
    event.preventDefault();
    let template: StatusEffectTemplate | undefined;
    if (selectedStatusId === 'custom') {
      if (!customStatusLabel.trim()) return;
      const slug = customStatusLabel
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      template = {
        id: 'custom-' + slug,
        label: customStatusLabel.trim(),
        color: customStatusColor,
        icon: customStatusIcon || '✦'
      };
    } else {
      template = statusPresets.find((item) => item.id === selectedStatusId);
    }

    if (!template) return;
    const normalizedRounds = rounds === '' ? null : Math.max(0, Math.round(Number(rounds)));
    onAddStatus(template, normalizedRounds, statusNote.trim() || undefined);
    closeStatusPanel();
  };

  const handleSaveToLibrary = async () => {
    if (saveState === 'saving') return;
    setSaveState('saving');
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    const result = await saveTemplate({
      name: combatant.name,
      type: combatant.type,
      defaultInitiative: combatant.initiative,
      maxHp: combatant.hp.max,
      ac: combatant.ac ?? null,
      icon: combatant.icon,
      note: combatant.note ?? undefined
    });
    if (result) {
      setSaveState('saved');
      resetTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    } else {
      setSaveState('error');
      resetTimerRef.current = setTimeout(() => setSaveState('idle'), 4000);
    }
  };

  const normalizedNote = combatant.note ? combatant.note.trim() : '';

  const isInLibrary = useMemo(() => {
    return templates.some((template) => {
      const templateNote = template.note ? template.note.trim() : '';
      return (
        template.name === combatant.name &&
        template.type === combatant.type &&
        template.defaultInitiative === combatant.initiative &&
        template.maxHp === combatant.hp.max &&
        (template.ac ?? null) === (combatant.ac ?? null) &&
        template.icon === combatant.icon &&
        templateNote === normalizedNote
      );
    });
  }, [combatant.ac, combatant.hp.max, combatant.icon, combatant.initiative, combatant.name, combatant.type, normalizedNote, templates]);

  const saveButtonLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Retry Save' : 'Save to Library';
  const isSaveDisabled = saveState === 'saving' || isMutating;

  const hpWidth = Math.max(0, Math.min(healthPercent, 100)) + '%';

  return (
    <article
      className={clsx('combatant-card', 'is-' + combatant.type, {
        active: isActive,
        defeated: isDefeated
      })}
    >
      {overlayVariant ? (
        <div className={clsx('death-overlay', overlayVariant)} aria-hidden="true">
          <span className={clsx('death-overlay-text', overlayVariant)}>{overlayText}</span>
        </div>
      ) : null}
      <header className="card-head">
        <button className="avatar" onClick={onCenter} type="button">
          <span>{combatant.icon}</span>
        </button>
        <div className="identity">
          <h3>{combatant.name}</h3>
          <div className="meta">
            <span className={'tag tag-' + combatant.type}>{typeToLabel[combatant.type]}</span>
            <span className="tag">Init {combatant.initiative}</span>
            {combatant.ac ? <span className="tag">AC {combatant.ac}</span> : null}
          </div>
        </div>
        <div className="card-actions">
          {!isInLibrary ? (
            <button
              type="button"
              className="ghost"
              onClick={() => void handleSaveToLibrary()}
              disabled={isSaveDisabled}
            >
              {saveButtonLabel}
            </button>
          ) : null}
          <button type="button" className="ghost danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </header>

      <section className="hp-block">
        <div className="hp-info">
          <strong>{combatant.hp.current}</strong>
          <span>/ {combatant.hp.max} HP</span>
        </div>
        <div className="hp-bar">
          <div className="hp-progress" style={{ width: hpWidth }} />
        </div>
      </section>

      <section className="controls">
        {hasDeathSaves ? (
          <div className="death-saves-panel">
            <div className="death-saves-head">
              <h4>Death Saves</h4>
              {deathSaveStatus === 'stable' ? (
                <span className="death-saves-pill stable">Stable</span>
              ) : deathSaveStatus === 'dead' ? (
                <span className="death-saves-pill dead">Dead</span>
              ) : null}
            </div>
            <div className="death-saves-body">
              <div className="death-saves-tracks">
                <div className="death-saves-track">
                  <span className="death-saves-label">Successes</span>
                  <div className="death-saves-chips" role="group" aria-label="Death save successes">
                    {[0, 1, 2].map((slot) => {
                      const filled = slot < deathSaveSuccesses;
                      return (
                        <button
                          key={'success-' + slot}
                          type="button"
                          className={clsx('death-save-chip', 'success', { filled })}
                          onClick={() => handleSuccessChipClick(slot)}
                          disabled={deathSavesLocked}
                          aria-pressed={filled}
                          aria-label={`Toggle success ${slot + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="death-saves-track">
                  <span className="death-saves-label">Failures</span>
                  <div className="death-saves-chips" role="group" aria-label="Death save failures">
                    {[0, 1, 2].map((slot) => {
                      const filled = slot < deathSaveFailures;
                      return (
                        <button
                          key={'failure-' + slot}
                          type="button"
                          className={clsx('death-save-chip', 'failure', { filled })}
                          onClick={() => handleFailureChipClick(slot)}
                          disabled={!deathSaves || deathSaveStatus === 'dead'}
                          aria-pressed={filled}
                          aria-label={`Toggle failure ${slot + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="death-saves-roll">
                <span className="death-saves-label">Record Roll</span>
                <div className="death-saves-roll-buttons">
                  <button
                    type="button"
                    className="success"
                    onClick={() => onRecordDeathSave('success')}
                    disabled={!canRecordRoll}
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onRecordDeathSave('failure')}
                    disabled={!canRecordRoll}
                  >
                    Failure
                  </button>
                </div>
              </div>
            </div>
            <p className="death-saves-summary">
              {deathSaveStatus === 'pending'
                ? 'Roll each round until 3 successes or failures.'
                : deathSaveStatus === 'stable'
                ? 'This combatant is stable at 0 HP.'
                : 'This combatant has died.'}
            </p>
            <div className="death-saves-actions">
              <button
                type="button"
                className="ghost"
                onClick={handleResetDeathSaves}
                disabled={!deathSaves || (deathSaveSuccesses === 0 && deathSaveFailures === 0)}
              >
                Reset Counters
              </button>
              <button type="button" className="ghost" onClick={onClearDeathSaves}>
                Exit Death Saves
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="quick-row">
              <span>Damage</span>
              <div>
                {quickDamageValues.map((value) => (
                  <button key={'dmg-' + value} type="button" onClick={() => onDamage(value)}>
                    -{value}
                  </button>
                ))}
              </div>
            </div>
            <div className="quick-row">
              <span>Heal</span>
              <div>
                {quickHealValues.map((value) => (
                  <button key={'heal-' + value} type="button" onClick={() => onHeal(value)}>
                    +{value}
                  </button>
                ))}
              </div>
            </div>
            <form
              className="custom-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (isCustomValueEmpty) return;
                const amount = Math.max(0, Number.parseInt(customValue, 10) || 0);
                if (amount === 0) return;
                onDamage(amount);
                setCustomValue('');
              }}
            >
              <label htmlFor={'custom-amount-' + combatant.id}>Custom</label>
              <input
                id={'custom-amount-' + combatant.id}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*$/.test(value)) {
                    setCustomValue(value);
                  }
                }}
                placeholder="0"
              />
              <button type="submit" className="primary" disabled={isCustomValueEmpty}>
                Apply Damage
              </button>
              <button
                type="button"
                className="success"
                disabled={isCustomValueEmpty}
                onClick={() => {
                  if (isCustomValueEmpty) return;
                  const amount = Math.max(0, Number.parseInt(customValue, 10) || 0);
                  if (amount === 0) return;
                  onHeal(amount);
                  setCustomValue('');
                }}
              >
                Apply Heal
              </button>
            </form>
          </>
        )}
      </section>

      <div className="card-bottom">
        <section className="status-section">
          <div className="status-head">
            <h4>Status Effects</h4>
            <button type="button" className="ghost" onClick={handleOpenStatusPanel}>
              Add
            </button>
          </div>

          <div className="status-chips">
            {combatant.statuses.length === 0 && <span className="muted">None</span>}
            {combatant.statuses.map((status) => {
              const isExhaustion = status.id === 'exhaustion';
              const exhaustionLevel = status.level ?? 1;
              return (
                <button
                  key={status.instanceId}
                  type="button"
                  className={clsx('status-chip', { 'has-meta': isExhaustion })}
                  style={{ backgroundColor: status.color }}
                  onClick={() => onRemoveStatus(status.instanceId)}
                  title={status.note || status.description || status.label}
                >
                  <span className="icon">{status.icon}</span>
                  <span className="status-text">
                    {isExhaustion ? <span className="status-meta">Level: {exhaustionLevel}</span> : null}
                    <span>{status.label}</span>
                  </span>
                  {status.remainingRounds !== null ? <span className="rounds">{status.remainingRounds}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="notes-section">
          <div className="notes-head">
            <h4>Notes</h4>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (isEditingNote) {
                  setIsEditingNote(false);
                  setNoteDraft(combatant.note ?? '');
                } else {
                  setIsEditingNote(true);
                }
              }}
            >
              {isEditingNote ? 'Cancel' : combatant.note ? 'Edit' : 'Add'}
            </button>
          </div>
          {isEditingNote ? (
            <div className="notes-editor">
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Battlefield reminders, resistances, tactics…"
                rows={3}
              />
              <button type="button" className="primary" onClick={handleNoteSubmit}>
                Save Note
              </button>
            </div>
          ) : (
            <p className={clsx('notes-copy', { muted: !combatant.note })}>
              {combatant.note || 'No notes yet'}
            </p>
          )}
        </section>
      </div>

      <Modal
        isOpen={statusPanelOpen}
        onClose={closeStatusPanel}
        ariaLabel={`Add status effect for ${combatant.name}`}
      >
        <div className="status-modal">
          <div className="status-modal-head">
            <h3>Add Status Effect</h3>
            <button type="button" className="ghost" onClick={closeStatusPanel}>
              Close
            </button>
          </div>
          <form className="status-form" onSubmit={handleStatusSubmit}>
            <label>
              Preset
              <select value={selectedStatusId} onChange={(event) => setSelectedStatusId(event.target.value)}>
                {statusPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.icon} {preset.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>

            {selectedStatusId === 'custom' ? (
              <div className="custom-status-fields">
                <label>
                  Label
                  <input
                    type="text"
                    value={customStatusLabel}
                    onChange={(event) => setCustomStatusLabel(event.target.value)}
                    placeholder="Status name"
                    required
                  />
                </label>
                <label>
                  Icon
                  <input
                    type="text"
                    value={customStatusIcon}
                    maxLength={2}
                    onChange={(event) => setCustomStatusIcon(event.target.value)}
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={customStatusColor}
                    onChange={(event) => setCustomStatusColor(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <label>
              Rounds
              <input
                type="number"
                min={0}
                value={rounds}
                onChange={(event) => {
                  const value = event.target.value;
                  setRounds(value === '' ? '' : Number(value));
                }}
                placeholder="∞"
              />
            </label>

            <label>
              Note
              <input
                type="text"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                placeholder="Optional reminder"
              />
            </label>

            <div className="status-actions">
              <button type="submit" className="primary">
                Add Status
              </button>
              <button type="button" className="ghost" onClick={closeStatusPanel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </article>
  );
};

export default CombatantCard;
