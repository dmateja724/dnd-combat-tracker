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
  const aliveCombatants = useMemo(
    () =>
      combatants.filter(
        (combatant) => combatant.hp.current > 0 && (combatant.deathSaves?.status ?? 'pending') !== 'dead'
      ),
    [combatants]
  );

  const fallbackAttackerId = useMemo(() => {
    if (!aliveCombatants.length) return '';
    if (defaultAttackerId && aliveCombatants.some((combatant) => combatant.id === defaultAttackerId)) {
      return defaultAttackerId;
    }
    return aliveCombatants[0]?.id ?? '';
  }, [aliveCombatants, defaultAttackerId]);

  const [attackerId, setAttackerId] = useState(fallbackAttackerId);
  const [targetId, setTargetId] = useState<string>('');
  const [damageType, setDamageType] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attackerId && aliveCombatants.some((combatant) => combatant.id === attackerId)) {
      return;
    }
    setAttackerId(fallbackAttackerId);
  }, [attackerId, aliveCombatants, fallbackAttackerId]);

  useEffect(() => {
    const availableTargets = aliveCombatants.filter((combatant) => combatant.id !== attackerId);
    if (availableTargets.some((combatant) => combatant.id === targetId)) {
      return;
    }
    if (targetId !== '') {
      setTargetId('');
    }
  }, [attackerId, aliveCombatants, targetId]);

  useEffect(() => {
    if (defaultAttackerId && aliveCombatants.some((combatant) => combatant.id === defaultAttackerId)) {
      setAttackerId(defaultAttackerId);
    }
  }, [aliveCombatants, defaultAttackerId]);

  const attacker = aliveCombatants.find((combatant) => combatant.id === attackerId) ?? null;
  const targetOptions = useMemo(
    () => aliveCombatants.filter((combatant) => combatant.id !== attackerId),
    [aliveCombatants, attackerId]
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
    if (!amount.trim()) {
      setError('Enter a non-negative damage amount.');
      return;
    }
    const numericAmount = Number.parseInt(amount, 10);
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

  const canSubmit = attacker && target && aliveCombatants.length > 1 && amount.trim() !== '';

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
          <select value={attackerId} onChange={(event) => setAttackerId(event.target.value)} disabled={aliveCombatants.length === 0}>
            {aliveCombatants.length === 0 ? (
              <option value="" disabled>
                No living combatants
              </option>
            ) : null}
            {aliveCombatants.map((combatant) => (
              <option key={combatant.id} value={combatant.id}>
                {combatant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={targetOptions.length === 0}>
            <option value="" disabled={targetOptions.length > 0}>
              {targetOptions.length === 0 ? 'No valid targets' : 'Select target'}
            </option>
            {targetOptions.map((combatant) => (
              <option key={combatant.id} value={combatant.id}>
                {combatant.name}
              </option>
            ))}
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
            <dt className="attack-summary-label">Attacker</dt>
            <dd className="attack-summary-value">
              {attacker ? `${attacker.name} (${attacker.hp.current}/${attacker.hp.max} HP)` : '—'}
            </dd>
          </div>
          <div className="attack-summary-item">
            <dt className="attack-summary-label">Target</dt>
            <dd className="attack-summary-value">
              {target ? `${target.name} (${target.hp.current}/${target.hp.max} HP)` : '—'}
            </dd>
          </div>
          <div className="attack-summary-item full">
            <dt className="attack-summary-label">Damage</dt>
            <dd className="attack-summary-value">
              {`${damageType.trim() || 'Damage'} · ${Math.max(0, Number.parseInt(amount || '0', 10) || 0)} HP`}
            </dd>
          </div>
        </dl>
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
