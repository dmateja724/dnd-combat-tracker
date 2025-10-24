import clsx from 'clsx';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { AddCombatantInput } from '../../hooks/useCombatTracker';
import { useCombatantLibrary } from '../../context/CombatantLibraryContext';
import type { CombatantTemplate, CombatantTemplateInput } from '../../types';
import AvatarMedia from '../AvatarMedia';
import { isImageIcon } from '../../utils/iconHelpers';

interface AddCombatantFormProps {
  onCreate: (payload: AddCombatantInput, options?: { stayOpen?: boolean }) => void;
  iconOptions: { id: string; label: string; icon: string }[];
  onCancel?: () => void;
  onStartEncounter?: () => void;
  showStartEncounter?: boolean;
  startEncounterDisabled?: boolean;
}

type IconMode = 'emoji' | 'image';

type FormState = {
  name: string;
  type: AddCombatantInput['type'];
  initiative: string;
  maxHp: string;
  ac: string;
  iconMode: IconMode;
  emojiIcon: string;
  imageIcon: string | null;
  note: string;
};

const defaultIcon = '⚔️';
const MAX_ICON_BYTES = 500 * 1024;

const resolveIcon = (state: FormState) => {
  if (state.iconMode === 'image') {
    return state.imageIcon?.trim() ?? '';
  }
  return state.emojiIcon.trim();
};

const toCombatantInput = (state: FormState): AddCombatantInput => {
  const parsedInitiative = Number.parseInt(state.initiative, 10);
  const parsedMaxHp = Number.parseInt(state.maxHp, 10);
  const parsedAc = Number.parseInt(state.ac, 10);
  const iconValue = resolveIcon(state) || defaultIcon;

  return {
    name: state.name.trim(),
    type: state.type,
    initiative: Number.isFinite(parsedInitiative) ? parsedInitiative : 0,
    maxHp: Math.max(1, Number.isFinite(parsedMaxHp) ? parsedMaxHp : 1),
    ac: Number.isFinite(parsedAc) ? parsedAc : undefined,
    icon: iconValue,
    note: state.note.trim() || undefined
  };
};

const toTemplateInput = (state: FormState): CombatantTemplateInput => {
  const parsedInitiative = Number.parseInt(state.initiative, 10);
  const parsedMaxHp = Number.parseInt(state.maxHp, 10);
  const parsedAc = Number.parseInt(state.ac, 10);
  const iconValue = resolveIcon(state) || defaultIcon;

  return {
    name: state.name.trim(),
    type: state.type,
    defaultInitiative: Number.isFinite(parsedInitiative) ? parsedInitiative : 0,
    maxHp: Math.max(1, Number.isFinite(parsedMaxHp) ? parsedMaxHp : 1),
    ac: Number.isFinite(parsedAc) ? parsedAc : null,
    icon: iconValue,
    note: state.note.trim() || undefined
  };
};

const AddCombatantForm = ({
  onCreate,
  iconOptions,
  onCancel,
  onStartEncounter,
  showStartEncounter = false,
  startEncounterDisabled = false
}: AddCombatantFormProps) => {
  const initialState: FormState = useMemo(
    () => ({
      name: '',
      type: 'player',
      initiative: '',
      maxHp: '',
      ac: '',
      iconMode: 'emoji',
      emojiIcon: iconOptions[0]?.icon ?? defaultIcon,
      imageIcon: null,
      note: ''
    }),
    [iconOptions]
  );

  const [formData, setFormData] = useState<FormState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const numericFieldsFilled =
    formData.initiative.trim() !== '' && formData.maxHp.trim() !== '' && formData.ac.trim() !== '';
  const hasPortrait = Boolean(resolveIcon(formData));
  const canSubmit = numericFieldsFilled && hasPortrait;

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
    if (!hasPortrait) {
      if (formData.iconMode === 'image' && !formData.imageIcon) {
        setIconError('Upload an image or switch to an emoji.');
      }
      setLocalError('Select a portrait before adding to the encounter.');
      return;
    }
    setLocalError(null);
    setIconError(null);
    onCreate(toCombatantInput(formData));
    setFormData(initialState);
    setEditingTemplateId(null);
    setFeedback(null);
    setIconError(null);
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
    const templateUsesImage = isImageIcon(template.icon);
    const fallbackEmoji = iconOptions[0]?.icon ?? defaultIcon;
    setFormData((prev) => ({
      name: template.name,
      type: template.type,
      initiative: String(template.defaultInitiative ?? ''),
      maxHp: String(template.maxHp ?? ''),
      ac: template.ac !== null && template.ac !== undefined ? String(template.ac) : '',
      iconMode: templateUsesImage ? 'image' : 'emoji',
      emojiIcon: templateUsesImage ? prev.emojiIcon || fallbackEmoji : template.icon || fallbackEmoji,
      imageIcon: templateUsesImage ? template.icon : prev.imageIcon,
      note: template.note ?? ''
    }));
    setFeedback('Template values loaded into the form.');
    setLocalError(null);
    setIconError(null);
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
    setIconError(null);
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
    if (!hasPortrait) {
      if (formData.iconMode === 'image' && !formData.imageIcon) {
        setIconError('Upload an image or switch to an emoji.');
      }
      setLocalError('Select a portrait before saving to the library.');
      return;
    }
    setLocalError(null);
    setFeedback(null);
    setIconError(null);
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

  const handleSetIconMode = (mode: IconMode) => {
    setFormData((prev) => (prev.iconMode === mode ? prev : { ...prev, iconMode: mode }));
    setIconError(null);
    setLocalError(null);
    setFeedback(null);
  };

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    const resetInput = () => {
      input.value = '';
    };
    if (!file) {
      setFormData((prev) => ({ ...prev, imageIcon: null }));
      setIconError(null);
      resetInput();
      return;
    }
    if (!file.type.startsWith('image/')) {
      setIconError('Select an image file (PNG or JPG).');
      resetInput();
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setIconError('Image must be 500 KB or smaller.');
      resetInput();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:image')) {
        setFormData((prev) => ({ ...prev, imageIcon: result }));
        setIconError(null);
        setLocalError(null);
        setFeedback(null);
      } else {
        setIconError('Unable to read image file.');
      }
    };
    reader.onerror = () => {
      setIconError('Unable to read image file.');
    };
    reader.readAsDataURL(file);
    resetInput();
  };

  const handleClearImage = () => {
    setFormData((prev) => ({ ...prev, imageIcon: null }));
    setIconError(null);
  };

  return (
    <form className="add-combatant" onSubmit={handleSubmit}>
      <div className="add-combatant-head">
        <div className="add-combatant-title">
          <h3>Add Combatant</h3>
        </div>
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
        {onCancel && !showStartEncounter && (
          <button type="button" className="add-combatant-close" onClick={onCancel} aria-label="Close add combatant form">
            ×
          </button>
        )}
      </div>
      <div className="add-combatant-toolbar">
        <div className="add-combatant-toolbar__lead">
          {onStartEncounter && showStartEncounter ? (
            <button
              type="button"
              className="primary add-combatant-toolbar__button"
              onClick={onStartEncounter}
              disabled={startEncounterDisabled}
            >
              Start Encounter
            </button>
          ) : null}
          <button
            type="button"
            className="ghost add-combatant-toolbar__button"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="add-combatant-toolbar__spacer" />
        <div className="add-combatant-toolbar__actions">
          <button type="submit" className="primary add-combatant-toolbar__button" disabled={!canSubmit}>
            Add to Encounter
          </button>
          <button
            type="button"
            className="ghost add-combatant-toolbar__button"
            onClick={() => void handleSaveTemplate()}
            disabled={isMutating || !canSubmit}
          >
            {isMutating ? 'Saving…' : editingTemplateId ? 'Update Template' : 'Save to Library'}
          </button>
        </div>
      </div>
      <div className="add-combatant-grid">
        <section className="saved-combatant-panel">
          <div className="saved-combatant-head">
            <h4>Saved Combatants</h4>
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
                      <AvatarMedia icon={template.icon} />
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
              <option value="boss">Boss</option>
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

          <div className="portrait-field">
            <div className="portrait-head">
              <span className="portrait-label">Portrait</span>
              <div className="portrait-mode-toggle" role="group" aria-label="Portrait option">
                <button
                  type="button"
                  className={clsx('portrait-mode-button', { active: formData.iconMode === 'emoji' })}
                  onClick={() => handleSetIconMode('emoji')}
                >
                  Emoji
                </button>
                <button
                  type="button"
                  className={clsx('portrait-mode-button', { active: formData.iconMode === 'image' })}
                  onClick={() => handleSetIconMode('image')}
                >
                  Image
                </button>
              </div>
            </div>
            {formData.iconMode === 'emoji' ? (
              <select
                value={formData.emojiIcon}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, emojiIcon: event.target.value }));
                  setFeedback(null);
                  setLocalError(null);
                  setIconError(null);
                }}
              >
                {iconOptions.map((option) => (
                  <option key={option.id} value={option.icon}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="portrait-upload">
                <div className="portrait-preview" aria-hidden={formData.imageIcon ? undefined : true}>
                  {formData.imageIcon ? (
                    <AvatarMedia
                      icon={formData.imageIcon}
                      decorative={false}
                      label={(formData.name || 'Combatant') + ' portrait preview'}
                    />
                  ) : (
                    <span className="portrait-placeholder">No image selected</span>
                  )}
                </div>
                <label className="portrait-upload-button">
                  <span>{formData.imageIcon ? 'Replace Image' : 'Select Image'}</span>
                  <input type="file" accept="image/*" onChange={handleIconFileChange} />
                </label>
                {formData.imageIcon ? (
                  <button type="button" className="ghost portrait-remove-button" onClick={handleClearImage}>
                    Remove Image
                  </button>
                ) : null}
                <p className="form-hint">PNG or JPG up to 500 KB.</p>
                {iconError ? <p className="form-warning">{iconError}</p> : null}
              </div>
            )}
          </div>

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
        </section>
      </div>
    </form>
  );
};

export default AddCombatantForm;
