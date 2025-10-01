import { FormEvent, useEffect, useState } from 'react';
import { useEncounterContext } from '../context/EncounterContext';

interface EncounterManagerProps {
  onClose?: () => void;
  disableClose?: boolean;
}

const EncounterManager = ({ onClose, disableClose = false }: EncounterManagerProps) => {
  const {
    encounters,
    selectedEncounterId,
    isLoading,
    error,
    refreshEncounters,
    selectEncounter,
    createEncounter,
    deleteEncounter,
    renameEncounter
  } = useEncounterContext();
  const [encounterName, setEncounterName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void refreshEncounters();
  }, [refreshEncounters]);

  const handleCreateEncounter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (encounterName.trim().length === 0) {
      setFormError('Please provide a name for the encounter.');
      return;
    }

    setIsSubmitting(true);
    const summary = await createEncounter(encounterName.trim());
    setIsSubmitting(false);
    if (!summary) {
      return;
    }
    setEncounterName('');
    if (!disableClose) {
      onClose?.();
    }
  };

  const handleSelectEncounter = (id: string) => {
    selectEncounter(id);
    if (!disableClose) {
      onClose?.();
    }
  };

  const handleRenameEncounter = async (id: string, currentName: string) => {
    const nextName = window.prompt('Rename encounter', currentName);
    if (!nextName || nextName.trim() === currentName) {
      return;
    }
    await renameEncounter(id, nextName.trim());
  };

  const handleDeleteEncounter = async (id: string) => {
    const confirmed = window.confirm('Delete this encounter? This action cannot be undone.');
    if (!confirmed) return;
    const deleted = await deleteEncounter(id);
    if (deleted && selectedEncounterId === id && disableClose) {
      // force refresh so UI updates; modal will remain open until new selection is made
      await refreshEncounters();
    }
  };

  return (
    <div className="auth-card encounter-manager">
      <h1>Select Encounter</h1>
      <p className="auth-subtitle">Choose a saved encounter or create a fresh one for your party.</p>
      {(error || formError) && <p className="auth-error">{formError ?? error}</p>}

      <form className="auth-form" onSubmit={handleCreateEncounter}>
        <label htmlFor="encounterName">Create Encounter</label>
        <input
          id="encounterName"
          type="text"
          placeholder="e.g. Siege of Neverwinter"
          value={encounterName}
          onChange={(event) => setEncounterName(event.target.value)}
          disabled={isSubmitting}
          required
        />
        <button type="submit" className="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Encounter'}
        </button>
      </form>

      <div className="encounter-list">
        <div className="encounter-list-header">
          <h2>Saved Encounters</h2>
          <button type="button" className="ghost" onClick={() => void refreshEncounters()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {isLoading && encounters.length === 0 ? (
          <p className="muted">Loading encounters…</p>
        ) : encounters.length === 0 ? (
          <p className="muted">No encounters yet. Create one above to get started.</p>
        ) : (
          <ul className="encounter-list-items">
            {encounters.map((encounter) => (
              <li key={encounter.id} className={encounter.id === selectedEncounterId ? 'active' : ''}>
                <div className="details">
                  <h3>{encounter.name}</h3>
                  <span className="timestamp">
                    Updated {new Date(encounter.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="actions">
                  <button type="button" className="primary" onClick={() => handleSelectEncounter(encounter.id)}>
                    Open
                  </button>
                  <button type="button" className="ghost" onClick={() => handleRenameEncounter(encounter.id, encounter.name)}>
                    Rename
                  </button>
                  <button type="button" className="ghost danger" onClick={() => void handleDeleteEncounter(encounter.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EncounterManager;
