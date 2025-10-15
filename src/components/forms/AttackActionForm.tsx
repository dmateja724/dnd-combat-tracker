import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Combatant } from '../../types';
import type { AttackActionInput } from '../../hooks/useCombatTracker';

const DAMAGE_TYPES = [
  'Slashing',
  'Piercing',
  'Bludgeoning',
  'Fire',
  'Cold',
  'Lightning',
  'Thunder',
  'Poison',
  'Acid',
  'Psychic',
  'Radiant',
  'Necrotic',
  'Force'
];

interface AttackActionFormProps {
  combatants: Combatant[];
  defaultAttackerId?: string | null;
  onSubmit: (payload: AttackActionInput) => void;
  onCancel: () => void;
}

const AttackActionForm = ({ combatants, defaultAttackerId, onSubmit, onCancel }: AttackActionFormProps) => {
  const fallbackAttackerId = useMemo(() => {
    if (!combatants.length) return '';
    if (defaultAttackerId && combatants.some((combatant) => combatant.id === defaultAttackerId)) {
      return defaultAttackerId;
    }
    return combatants[0]?.id ?? '';
  }, [combatants, defaultAttackerId]);

  const [attackerId, setAttackerId] = useState(fallbackAttackerId);
  const [targetId, setTargetId] = useState<string>(() => {
    const candidates = combatants.filter((combatant) => combatant.id !== fallbackAttackerId);
    return candidates[0]?.id ?? '';
  });
  const [damageType, setDamageType] = useState(DAMAGE_TYPES[0] ?? 'Damage');
  const [amount, setAmount] = useState('5');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attackerId && combatants.some((combatant) => combatant.id === attackerId)) {
      return;
    }
    setAttackerId(fallbackAttackerId);
  }, [attackerId, combatants, fallbackAttackerId]);

  useEffect(() => {
    const availableTargets = combatants.filter((combatant) => combatant.id !== attackerId);
    if (availableTargets.some((combatant) => combatant.id === targetId)) {
      return;
    }
    setTargetId(availableTargets[0]?.id ?? '');
  }, [attackerId, combatants, targetId]);

  useEffect(() => {
    if (defaultAttackerId && combatants.some((combatant) => combatant.id === defaultAttackerId)) {
      setAttackerId(defaultAttackerId);
    }
  }, [combatants, defaultAttackerId]);

  const attacker = combatants.find((combatant) => combatant.id === attackerId) ?? null;
  const targetOptions = useMemo(
    () => combatants.filter((combatant) => combatant.id !== attackerId),
    [combatants, attackerId]
  );
  const target = targetOptions.find((combatant) => combatant.id === targetId) ?? null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!attackerId) {
      setError('Choose an attacker.');
      return;
    }
    if (!targetId) {
      setError('Choose a target.');
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError('Enter a non-negative damage amount.');
      return;
    }
    setError(null);
    onSubmit({
      attackerId,
      targetId,
      amount: numericAmount,
      damageType: damageType.trim()
    });
  };

  const datalistId = 'damage-type-options';

  const canSubmit = attacker && target && combatants.length > 1;

  return (
    <div className="attack-action-modal">
      <header className="attack-action-head">
        <div>
          <h3>Resolve Attack</h3>
          <p>Select attacker, target, damage type, and total damage to apply.</p>
        </div>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <form className="attack-action-form" onSubmit={handleSubmit}>
        <label>
          Attacker
          <select value={attackerId} onChange={(event) => setAttackerId(event.target.value)}>
            {combatants.map((combatant) => (
              <option key={combatant.id} value={combatant.id}>
                {combatant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={targetOptions.length === 0}>
            {targetOptions.length === 0 ? (
              <option value="">No valid targets</option>
            ) : (
              targetOptions.map((combatant) => (
                <option key={combatant.id} value={combatant.id}>
                  {combatant.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label>
          Damage Type
          <input
            type="text"
            list={datalistId}
            value={damageType}
            onChange={(event) => setDamageType(event.target.value)}
            placeholder="Slashing, Fire, etc."
          />
          <datalist id={datalistId}>
            {DAMAGE_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label>
          Damage Amount
          <input
            type="number"
            min={0}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
        </label>
        <div className="attack-summary">
          <div>
            <span className="attack-summary-label">Attacker</span>
            <span className="attack-summary-value">
              {attacker ? `${attacker.name} (${attacker.hp.current}/${attacker.hp.max} HP)` : '—'}
            </span>
          </div>
          <div>
            <span className="attack-summary-label">Target</span>
            <span className="attack-summary-value">
              {target ? `${target.name} (${target.hp.current}/${target.hp.max} HP)` : '—'}
            </span>
          </div>
          <div>
            <span className="attack-summary-label">Damage</span>
            <span className="attack-summary-value">
              {`${damageType.trim() || 'Damage'} · ${Math.max(0, Number(amount) || 0)} HP`}
            </span>
          </div>
        </div>
        {error ? <p className="form-warning">{error}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={!canSubmit}>
            Apply Damage
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
};

export default AttackActionForm;
