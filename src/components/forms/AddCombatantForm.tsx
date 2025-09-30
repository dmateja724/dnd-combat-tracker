import { FormEvent, useState } from 'react';
import { AddCombatantInput } from '../../hooks/useCombatTracker';

interface AddCombatantFormProps {
  onCreate: (payload: AddCombatantInput) => void;
  iconOptions: { id: string; label: string; icon: string }[];
  onCancel?: () => void;
}

type FormState = {
  name: string;
  type: AddCombatantInput['type'];
  initiative: number;
  maxHp: number;
  ac: number;
  icon: string;
  note: string;
};

const defaultIcon = '⚔️';

const AddCombatantForm = ({ onCreate, iconOptions, onCancel }: AddCombatantFormProps) => {
  const initialState: FormState = {
    name: '',
    type: 'player',
    initiative: 10,
    maxHp: 10,
    ac: 10,
    icon: iconOptions[0]?.icon ?? defaultIcon,
    note: ''
  };

  const [formData, setFormData] = useState<FormState>(initialState);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;
    onCreate({
      name: formData.name.trim(),
      type: formData.type,
      initiative: Number(formData.initiative) || 0,
      maxHp: Math.max(1, Number(formData.maxHp) || 1),
      ac: Number.isNaN(Number(formData.ac)) ? undefined : Number(formData.ac),
      icon: formData.icon,
      note: formData.note.trim() || undefined
    });
    setFormData({
      ...initialState,
      icon: iconOptions[0]?.icon ?? defaultIcon
    });
  };

  return (
    <form className="add-combatant" onSubmit={handleSubmit}>
      <div className="add-combatant-head">
        <h3>Add Combatant</h3>
        {onCancel && (
          <button type="button" className="add-combatant-close" onClick={onCancel} aria-label="Close add combatant form">
            ×
          </button>
        )}
      </div>
      <label>
        Name
        <input
          type="text"
          value={formData.name}
          onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Name or descriptor"
          required
        />
      </label>

      <label>
        Type
        <select
          value={formData.type}
          onChange={(event) =>
            setFormData((prev) => ({ ...prev, type: event.target.value as AddCombatantInput['type'] }))
          }
        >
          <option value="player">Player</option>
          <option value="ally">Ally</option>
          <option value="enemy">Enemy</option>
        </select>
      </label>

      <div className="inline">
        <label>
          Initiative
          <input
            type="number"
            value={formData.initiative}
            onChange={(event) => setFormData((prev) => ({ ...prev, initiative: Number(event.target.value) }))}
            min={-10}
            max={50}
          />
        </label>
        <label>
          Max HP
          <input
            type="number"
            value={formData.maxHp}
            onChange={(event) => setFormData((prev) => ({ ...prev, maxHp: Number(event.target.value) }))}
            min={1}
          />
        </label>
        <label>
          AC
          <input
            type="number"
            value={formData.ac}
            onChange={(event) => setFormData((prev) => ({ ...prev, ac: Number(event.target.value) }))}
            min={0}
          />
        </label>
      </div>

      <label>
        Icon
        <select
          value={formData.icon}
          onChange={(event) => setFormData((prev) => ({ ...prev, icon: event.target.value }))}
        >
          {iconOptions.map((option) => (
            <option key={option.id} value={option.icon}>
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Notes
        <textarea
          value={formData.note}
          onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
          rows={3}
          placeholder="Opening position, tactics, loot…"
        />
      </label>

      <button type="submit" className="primary wide">
        Add to Encounter
      </button>
    </form>
  );
};

export default AddCombatantForm;
