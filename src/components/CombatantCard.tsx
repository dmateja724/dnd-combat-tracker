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
  onRemoveStatus
}: CombatantCardProps) => {
  const [customValue, setCustomValue] = useState(6);
  const [noteDraft, setNoteDraft] = useState(combatant.note ?? '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<string>(statusPresets[0]?.id ?? 'custom');
  const [customStatusLabel, setCustomStatusLabel] = useState('');
  const [customStatusIcon, setCustomStatusIcon] = useState('✦');
  const [customStatusColor, setCustomStatusColor] = useState('#ffb703');
  const [rounds, setRounds] = useState<number | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const { saveTemplate, isMutating } = useCombatantLibrary();
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
          <button
            type="button"
            className="ghost"
            onClick={() => void handleSaveToLibrary()}
            disabled={isSaveDisabled}
          >
            {saveButtonLabel}
          </button>
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
            const amount = Math.max(0, Number(customValue) || 0);
            if (amount === 0) return;
            onDamage(amount);
          }}
        >
          <label htmlFor={'custom-amount-' + combatant.id}>Custom</label>
          <input
            id={'custom-amount-' + combatant.id}
            type="number"
            min={0}
            value={customValue}
            onChange={(event) => setCustomValue(Number(event.target.value))}
          />
          <button type="submit" className="primary">
            Apply Damage
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              const amount = Math.max(0, Number(customValue) || 0);
              if (amount === 0) return;
              onHeal(amount);
            }}
          >
            Apply Heal
          </button>
        </form>
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
            {combatant.statuses.map((status) => (
              <button
                key={status.instanceId}
                type="button"
                className="status-chip"
                style={{ backgroundColor: status.color }}
                onClick={() => onRemoveStatus(status.instanceId)}
                title={status.note || status.description || status.label}
              >
                <span className="icon">{status.icon}</span>
                <span>{status.label}</span>
                {status.remainingRounds !== null ? <span className="rounds">{status.remainingRounds}</span> : null}
              </button>
            ))}
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
