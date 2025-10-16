import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Combatant } from '../../types';
import type { HealActionInput } from '../../hooks/useCombatTracker';

const HEALING_SOURCES = ['Cure Wounds', 'Healing Word', 'Lay on Hands', 'Potion of Healing', 'Aid', 'Regeneration'];

interface HealActionFormProps {
  combatants: Combatant[];
  defaultTargetId?: string | null;
  onSubmit: (payload: HealActionInput) => void;
  onCancel: () => void;
}

const HealActionForm = ({ combatants, defaultTargetId, onSubmit, onCancel }: HealActionFormProps) => {
  const fallbackTargetId = useMemo(() => {
    if (!combatants.length) return '';
    if (defaultTargetId && combatants.some((combatant) => combatant.id === defaultTargetId)) {
      return defaultTargetId;
    }
    return combatants[0]?.id ?? '';
  }, [combatants, defaultTargetId]);

  const [targetId, setTargetId] = useState(fallbackTargetId);
  const [healingType, setHealingType] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetId && combatants.some((combatant) => combatant.id === targetId)) {
      return;
    }
    setTargetId(fallbackTargetId);
  }, [combatants, fallbackTargetId, targetId]);

  useEffect(() => {
    if (defaultTargetId && combatants.some((combatant) => combatant.id === defaultTargetId)) {
      setTargetId(defaultTargetId);
    }
  }, [combatants, defaultTargetId]);

  const target = combatants.find((combatant) => combatant.id === targetId) ?? null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!targetId) {
      setError('Choose a recipient.');
      return;
    }
    if (!amount.trim()) {
      setError('Enter a non-negative healing amount.');
      return;
    }
    const numericAmount = Number.parseInt(amount, 10);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError('Enter a non-negative healing amount.');
      return;
    }
    setError(null);
    onSubmit({
      targetId,
      amount: numericAmount,
      healingType: healingType.trim()
    });
  };

  const datalistId = 'healing-source-options';
  const canSubmit = target && amount.trim() !== '';

  return (
    <div className="attack-action-modal">
      <header className="attack-action-head">
        <div>
          <h3>Apply Healing</h3>
          <p>Select recipient, optional source, and total HP to restore.</p>
        </div>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <form className="attack-action-form" onSubmit={handleSubmit}>
        <label>
          Recipient
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={combatants.length === 0}>
            {combatants.length === 0 ? (
              <option value="">No combatants</option>
            ) : (
              combatants.map((combatant) => (
                <option key={combatant.id} value={combatant.id}>
                  {combatant.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Source
          <input
            type="text"
            list={datalistId}
            value={healingType}
            onChange={(event) => setHealingType(event.target.value)}
            placeholder="Spell, potion, etc."
          />
          <datalist id={datalistId}>
            {HEALING_SOURCES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label>
          Healing Amount
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amount}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d*$/.test(value)) {
                setAmount(value);
              }
            }}
            placeholder="0"
          />
        </label>
        <dl className="attack-summary">
          <div className="attack-summary-item">
            <dt className="attack-summary-label">Recipient</dt>
            <dd className="attack-summary-value">
              {target ? `${target.name} (${target.hp.current}/${target.hp.max} HP)` : '—'}
            </dd>
          </div>
          <div className="attack-summary-item full">
            <dt className="attack-summary-label">Healing</dt>
            <dd className="attack-summary-value">
              {`${healingType.trim() || 'Healing'} · ${Math.max(0, Number.parseInt(amount || '0', 10) || 0)} HP`}
            </dd>
          </div>
        </dl>
        {error ? <p className="form-warning">{error}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={!canSubmit}>
            Apply Healing
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
};

export default HealActionForm;
