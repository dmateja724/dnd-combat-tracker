import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { AddCombatantInput } from '../../hooks/useCombatTracker';
import { useCombatantLibrary } from '../../context/CombatantLibraryContext';
import type { CombatantLibraryExport, CombatantTemplate, CombatantTemplateInput } from '../../types';

interface AddCombatantFormProps {
  onCreate: (payload: AddCombatantInput, options?: { stayOpen?: boolean }) => void;
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

const toCombatantInput = (state: FormState): AddCombatantInput => ({
  name: state.name.trim(),
  type: state.type,
  initiative: Number.isFinite(state.initiative) ? state.initiative : 0,
  maxHp: Math.max(1, Number.isFinite(state.maxHp) ? state.maxHp : 1),
  ac: Number.isFinite(state.ac) ? state.ac : undefined,
  icon: state.icon,
  note: state.note.trim() || undefined
});

const toTemplateInput = (state: FormState): CombatantTemplateInput => ({
  name: state.name.trim(),
  type: state.type,
  defaultInitiative: Number.isFinite(state.initiative) ? state.initiative : 0,
  maxHp: Math.max(1, Number.isFinite(state.maxHp) ? state.maxHp : 1),
  ac: Number.isFinite(state.ac) ? state.ac : null,
  icon: state.icon,
  note: state.note.trim() || undefined
});

const AddCombatantForm = ({ onCreate, iconOptions, onCancel }: AddCombatantFormProps) => {
  const initialState: FormState = useMemo(
    () => ({
      name: '',
      type: 'player',
      initiative: 10,
      maxHp: 10,
      ac: 10,
      icon: iconOptions[0]?.icon ?? defaultIcon,
      note: ''
    }),
    [iconOptions]
  );

  const [formData, setFormData] = useState<FormState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    templates,
    isLoading,
    isMutating,
    error,
    refresh,
    saveTemplate,
    updateTemplate,
    removeTemplate,
    importTemplates
  } =
    useCombatantLibrary();

  const editingTemplate = useMemo(
    () => (editingTemplateId ? templates.find((template) => template.id === editingTemplateId) ?? null : null),
    [editingTemplateId, templates]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;
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
      initiative: template.defaultInitiative,
      maxHp: template.maxHp,
      ac: template.ac ?? 10,
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

  const handleExportLibrary = () => {
    setLibraryError(null);
    const payload: CombatantLibraryExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: templates.map((template) => ({
        name: template.name,
        type: template.type,
        defaultInitiative: template.defaultInitiative,
        maxHp: template.maxHp,
        ac: template.ac ?? null,
        icon: template.icon,
        note: template.note ?? undefined
      }))
    };

    if (typeof window === 'undefined') {
      setLibraryError('Export is only available in the browser.');
      setLibraryMessage(null);
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadName = `combatant-library-${payload.exportedAt.slice(0, 10)}.json`;
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const count = templates.length;
      setLibraryMessage(
        `Exported ${count} combatant${count === 1 ? '' : 's'} to ${downloadName}.`
      );
    } catch (err) {
      console.error('Failed to export combatant library', err);
      setLibraryError('Could not generate the export file.');
      setLibraryMessage(null);
    }
  };

  const handleImportClick = () => {
    setLibraryError(null);
    setLibraryMessage(null);
    if (templates.length > 0) {
      setLibraryError('Import is only available when your library is empty.');
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setLibraryError(null);
    setLibraryMessage(null);

    if (templates.length > 0) {
      setLibraryError('Import is only available when your library is empty.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        setLibraryError('Uploaded file was not a valid combatant library export.');
        return;
      }

      const candidate = parsed as Partial<CombatantLibraryExport>;
      if (candidate.version !== 1 || !Array.isArray(candidate.templates)) {
        setLibraryError('Unsupported library file format.');
        return;
      }

      const parseCandidate = (value: unknown): CombatantTemplateInput | null => {
        if (!value || typeof value !== 'object') return null;
        const record = value as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        const type = record.type;
        if (!name || typeof type !== 'string' || (type !== 'player' && type !== 'ally' && type !== 'enemy')) {
          return null;
        }

        const initiativeValue = Number(record.defaultInitiative);
        const maxHpValue = Number(record.maxHp);
        if (!Number.isFinite(initiativeValue) || !Number.isFinite(maxHpValue) || maxHpValue <= 0) {
          return null;
        }

        const acValue = record.ac;
        let normalizedAc: number | null;
        if (acValue === null || acValue === undefined || acValue === '') {
          normalizedAc = null;
        } else {
          const numericAc = Number(acValue);
          if (!Number.isFinite(numericAc) || numericAc < 0) {
            return null;
          }
          normalizedAc = Math.round(numericAc);
        }

        const iconValue = typeof record.icon === 'string' && record.icon.trim() ? record.icon : defaultIcon;
        const noteValue = typeof record.note === 'string' ? record.note.trim() : '';

        return {
          name,
          type: type as CombatantTemplateInput['type'],
          defaultInitiative: Math.round(initiativeValue),
          maxHp: Math.max(1, Math.round(maxHpValue)),
          ac: normalizedAc,
          icon: iconValue,
          note: noteValue ? noteValue : undefined
        };
      };

      const normalized = candidate.templates
        .map((entry) => parseCandidate(entry))
        .filter((entry): entry is CombatantTemplateInput => entry !== null);

      const skipped = candidate.templates.length - normalized.length;
      if (normalized.length === 0) {
        setLibraryError('No valid combatants found in the uploaded file.');
        return;
      }

      const result = await importTemplates(normalized);
      const importedCount = result.imported;
      const failedCount = skipped + result.failed;

      if (importedCount > 0) {
        setLibraryMessage(`Imported ${importedCount} combatant${importedCount === 1 ? '' : 's'} from file.`);
        setFeedback(null);
        setLocalError(null);
      }

      if (failedCount > 0) {
        setLibraryError(`Skipped ${failedCount} invalid combatant${failedCount === 1 ? '' : 's'} during import.`);
      } else {
        setLibraryError(null);
      }
    } catch (err) {
      console.error('Failed to import combatant library', err);
      setLibraryError('Could not read the uploaded file.');
      setLibraryMessage(null);
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
              <button
                type="button"
                className="ghost"
                onClick={handleExportLibrary}
                disabled={isLoading || isMutating || templates.length === 0}
              >
                Export
              </button>
              <button type="button" className="ghost" onClick={handleImportClick} disabled={isMutating}>
                Import
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(event) => void handleImportFile(event)}
            style={{ display: 'none' }}
          />
          {error && <p className="form-warning">{error}</p>}
          {libraryError && <p className="form-warning">{libraryError}</p>}
          {libraryMessage && <p className="form-feedback">{libraryMessage}</p>}
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
                type="number"
                value={formData.initiative}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, initiative: Number(event.target.value) }));
                  setFeedback(null);
                }}
                min={-10}
                max={50}
              />
            </label>
            <label>
              Max HP
              <input
                type="number"
                value={formData.maxHp}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, maxHp: Number(event.target.value) }));
                  setFeedback(null);
                }}
                min={1}
              />
            </label>
            <label>
              AC
              <input
                type="number"
                value={formData.ac}
                onChange={(event) => {
                  setFormData((prev) => ({ ...prev, ac: Number(event.target.value) }));
                  setFeedback(null);
                }}
                min={0}
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
              }}
              rows={3}
              placeholder="Opening position, tactics, loot…"
            />
          </label>

          {localError && <p className="form-warning">{localError}</p>}
          {feedback && <p className="form-feedback">{feedback}</p>}

          <div className="form-actions">
            <button type="submit" className="primary">
              Add to Encounter
            </button>
            <button type="button" className="ghost" onClick={() => void handleSaveTemplate()} disabled={isMutating}>
              {isMutating ? 'Saving…' : editingTemplateId ? 'Update Template' : 'Save to Library'}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
};

export default AddCombatantForm;
