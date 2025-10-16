import { FormEvent, useMemo, useState } from 'react';
import { AddCombatantInput } from '../../hooks/useCombatTracker';
import { useCombatantLibrary } from '../../context/CombatantLibraryContext';
import type { CombatantTemplate, CombatantTemplateInput } from '../../types';

interface AddCombatantFormProps {
  onCreate: (payload: AddCombatantInput, options?: { stayOpen?: boolean }) => void;
  iconOptions: { id: string; label: string; icon: string }[];
  onCancel?: () => void;
}

type FormState = {
  name: string;
  type: AddCombatantInput['type'];
  initiative: string;
  maxHp: string;
  ac: string;
  icon: string;
  note: string;
};

const defaultIcon = '⚔️';

const toCombatantInput = (state: FormState): AddCombatantInput => {
  const parsedInitiative = Number.parseInt(state.initiative, 10);
  const parsedMaxHp = Number.parseInt(state.maxHp, 10);
  const parsedAc = Number.parseInt(state.ac, 10);

  return {
    name: state.name.trim(),
    type: state.type,
    initiative: Number.isFinite(parsedInitiative) ? parsedInitiative : 0,
    maxHp: Math.max(1, Number.isFinite(parsedMaxHp) ? parsedMaxHp : 1),
    ac: Number.isFinite(parsedAc) ? parsedAc : undefined,
    icon: state.icon,
    note: state.note.trim() || undefined
  };
};

const toTemplateInput = (state: FormState): CombatantTemplateInput => {
  const parsedInitiative = Number.parseInt(state.initiative, 10);
  const parsedMaxHp = Number.parseInt(state.maxHp, 10);
  const parsedAc = Number.parseInt(state.ac, 10);

  return {
    name: state.name.trim(),
    type: state.type,
    defaultInitiative: Number.isFinite(parsedInitiative) ? parsedInitiative : 0,
    maxHp: Math.max(1, Number.isFinite(parsedMaxHp) ? parsedMaxHp : 1),
    ac: Number.isFinite(parsedAc) ? parsedAc : null,
    icon: state.icon,
    note: state.note.trim() || undefined
  };
};

const AddCombatantForm = ({ onCreate, iconOptions, onCancel }: AddCombatantFormProps) => {
  const initialState: FormState = useMemo(
    () => ({
      name: '',
      type: 'player',
      initiative: '',
      maxHp: '',
      ac: '',
      icon: iconOptions[0]?.icon ?? defaultIcon,
      note: ''
    }),
    [iconOptions]
  );

  const [formData, setFormData] = useState<FormState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const numericFieldsFilled =
    formData.initiative.trim() !== '' && formData.maxHp.trim() !== '' && formData.ac.trim() !== '';

  const {
    templates,
    isLoading,
    isMutating,
    error,
    refresh,
    saveTemplate,
    updateTemplate,
    removeTemplate
  } =
    useCombatantLibrary();

  const editingTemplate = useMemo(
    () => (editingTemplateId ? templates.find((template) => template.id === editingTemplateId) ?? null : null),
    [editingTemplateId, templates]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;
    if (!numericFieldsFilled) {
      setLocalError('Enter initiative, max HP, and AC before adding to the encounter.');
      return;
    }
    setLocalError(null);
    onCreate(toCombatantInput(formData));
    setFormData(initialState);
    setEditingTemplateId(null);
    setFeedback(null);
  };

  const handleApplyTemplate = (template: CombatantTemplate, stayOpen = false) => {
    setEditingTemplateId(null);
    onCreate(
      {
        name: template.name,
        type: template.type,
        initiative: template.defaultInitiative,
        maxHp: template.maxHp,
        ac: template.ac ?? undefined,
        icon: template.icon,
        note: template.note ?? undefined
      },
      stayOpen ? { stayOpen: true } : undefined
    );
  };

  const handleFillFromTemplate = (template: CombatantTemplate) => {
    setEditingTemplateId(null);
    setFormData({
      name: template.name,
      type: template.type,
      initiative: String(template.defaultInitiative ?? ''),
      maxHp: String(template.maxHp ?? ''),
      ac: template.ac !== null && template.ac !== undefined ? String(template.ac) : '',
      icon: template.icon,
      note: template.note ?? ''
    });
    setFeedback('Template values loaded into the form.');
    setLocalError(null);
  };

  const handleEditTemplate = (template: CombatantTemplate) => {
    handleFillFromTemplate(template);
    setEditingTemplateId(template.id);
    setFeedback('Editing "' + template.name + '" from the library.');
  };

  const handleCancelEdit = () => {
    setEditingTemplateId(null);
    setFeedback('Edit canceled.');
    setLocalError(null);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      setLocalError('Enter a name before saving to the library.');
      return;
    }
    if (!numericFieldsFilled) {
      setLocalError('Enter initiative, max HP, and AC before saving to the library.');
      return;
    }
    setLocalError(null);
    setFeedback(null);
    const payload = toTemplateInput(formData);
    if (editingTemplateId) {
      const updated = await updateTemplate(editingTemplateId, payload);
      if (updated) {
        setFeedback('Template updated.');
      } else {
        setLocalError('Could not update combatant in the library.');
      }
    } else {
      const created = await saveTemplate(payload);
      if (created) {
        setFeedback('Saved to library.');
      } else {
        setLocalError('Could not save combatant to the library.');
      }
    }
  };

  return (
    <form className="add-combatant" onSubmit={handleSubmit}>
      <div className="add-combatant-head">
        <h3>Add Combatant</h3>
        {editingTemplateId ? (
          <button
            type="button"
            className="ghost"
            onClick={handleCancelEdit}
            disabled={isMutating}
            aria-label={editingTemplate ? 'Cancel editing ' + editingTemplate.name : 'Cancel editing current template'}
          >
            Cancel Edit
          </button>
        ) : null}
        {onCancel && (
          <button type="button" className="add-combatant-close" onClick={onCancel} aria-label="Close add combatant form">
            ×
          </button>
        )}
      </div>
      <div className="add-combatant-grid">
        <section className="saved-combatant-panel">
          <div className="saved-combatant-head">
            <h4>Saved Combatants</h4>
            <div className="saved-combatant-tools">
              <button type="button" className="ghost" onClick={() => void refresh()} disabled={isLoading}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          {error && <p className="form-warning">{error}</p>}
          <div className="saved-combatant-scroll">
            {isLoading ? (
              <p className="empty-state-text">Loading saved combatants…</p>
            ) : templates.length === 0 ? (
              <p className="empty-state-text">No saved combatants yet. Save one from this form or any active combatant.</p>
            ) : (
              <ul className="saved-combatant-list">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      className="saved-combatant-avatar"
                      onClick={() => handleFillFromTemplate(template)}
                      title="Load into form"
                    >
                      <span>{template.icon}</span>
                    </button>
                    <div className="saved-combatant-info">
                      <strong>{template.name}</strong>
                      <span className="saved-combatant-meta">
                        {template.type} · Init {template.defaultInitiative} · HP {template.maxHp}
                      </span>
                    </div>
                    <div className="saved-combatant-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleApplyTemplate(template, true)}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleEditTemplate(template)}
                        aria-pressed={editingTemplateId === template.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => void removeTemplate(template.id)}
                        disabled={isMutating}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="manual-combatant-form">
          <label>
            Name
            <input
              type="text"
              value={formData.name}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, name: event.target.value }));
                setFeedback(null);
                setLocalError(null);
              }}
              placeholder="Name or descriptor"
              required
            />
          </label>

          <label>
            Type
            <select
              value={formData.type}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, type: event.target.value as AddCombatantInput['type'] }));
                setFeedback(null);
                setLocalError(null);
              }}
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
                type="text"
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={formData.initiative}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^-?\d*$/.test(value)) {
                    setFormData((prev) => ({ ...prev, initiative: value }));
                    setFeedback(null);
                    setLocalError(null);
                  }
                }}
                placeholder="0"
              />
            </label>
            <label>
              Max HP
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.maxHp}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*$/.test(value)) {
                    setFormData((prev) => ({ ...prev, maxHp: value }));
                    setFeedback(null);
                    setLocalError(null);
                  }
                }}
                placeholder="0"
              />
            </label>
            <label>
              AC
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.ac}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*$/.test(value)) {
                    setFormData((prev) => ({ ...prev, ac: value }));
                    setFeedback(null);
                    setLocalError(null);
                  }
                }}
                placeholder="0"
              />
            </label>
          </div>

          <label>
            Icon
            <select
              value={formData.icon}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, icon: event.target.value }));
                setFeedback(null);
                setLocalError(null);
              }}
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
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, note: event.target.value }));
                setFeedback(null);
                setLocalError(null);
              }}
              rows={3}
              placeholder="Opening position, tactics, loot…"
            />
          </label>

          {localError && <p className="form-warning">{localError}</p>}
          {feedback && <p className="form-feedback">{feedback}</p>}

          <div className="form-actions">
            <button type="submit" className="primary" disabled={!numericFieldsFilled}>
              Add to Encounter
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => void handleSaveTemplate()}
              disabled={isMutating || !numericFieldsFilled}
            >
              {isMutating ? 'Saving…' : editingTemplateId ? 'Update Template' : 'Save to Library'}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
};

export default AddCombatantForm;
