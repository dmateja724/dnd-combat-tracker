import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  createEncounter as apiCreateEncounter,
  deleteEncounter as apiDeleteEncounter,
  listEncounters,
  renameEncounter as apiRenameEncounter,
  type EncounterSummary
} from '../data/encounterDb';

interface EncounterContextValue {
  encounters: EncounterSummary[];
  selectedEncounterId: string | null;
  selectedEncounter: EncounterSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshEncounters: () => Promise<void>;
  selectEncounter: (id: string | null) => void;
  createEncounter: (name?: string) => Promise<EncounterSummary | null>;
  renameEncounter: (id: string, name: string) => Promise<EncounterSummary | null>;
  deleteEncounter: (id: string) => Promise<boolean>;
}

const EncounterContext = createContext<EncounterContextValue | undefined>(undefined);

const ENCOUNTER_STORAGE_KEY = 'combat-tracker:selectedEncounterId';

const readStoredEncounterId = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ENCOUNTER_STORAGE_KEY);
};

export const EncounterProvider = ({ children }: { children: ReactNode }) => {
  const { user, isBootstrapping } = useAuth();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(() => readStoredEncounterId());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEncounters = useCallback(async () => {
    if (!user) {
      if (isBootstrapping) {
        return;
      }
      setEncounters([]);
      setSelectedEncounterId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const list = await listEncounters();
      setEncounters(list);
      setSelectedEncounterId((current) => {
        if (current && list.some((encounter) => encounter.id === current)) {
          return current;
        }
        const stored = readStoredEncounterId();
        if (stored && list.some((encounter) => encounter.id === stored)) {
          return stored;
        }
        return null;
      });
    } catch (err) {
      console.error('Failed to refresh encounters', err);
      setError(err instanceof Error ? err.message : 'Failed to load encounters');
      setEncounters([]);
      setSelectedEncounterId(null);
    } finally {
      setIsLoading(false);
    }
  }, [isBootstrapping, user]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }
    if (user) {
      void refreshEncounters();
    } else {
      setEncounters([]);
      setSelectedEncounterId(null);
    }
  }, [isBootstrapping, refreshEncounters, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedEncounterId) {
      window.localStorage.setItem(ENCOUNTER_STORAGE_KEY, selectedEncounterId);
    } else {
      window.localStorage.removeItem(ENCOUNTER_STORAGE_KEY);
    }
  }, [selectedEncounterId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ENCOUNTER_STORAGE_KEY) return;
      setSelectedEncounterId(event.newValue);
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const selectEncounter = useCallback((id: string | null) => {
    setSelectedEncounterId(id);
  }, []);

  const createEncounter = useCallback(
    async (name?: string) => {
      if (!user) {
        setError('You must be signed in to create encounters.');
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        const summary = await apiCreateEncounter(name);
        if (!summary) {
          throw new Error('Encounter creation failed.');
        }
        setEncounters((current) => [summary, ...current]);
        setSelectedEncounterId(summary.id);
        return summary;
      } catch (err) {
        console.error('Failed to create encounter', err);
        setError(err instanceof Error ? err.message : 'Failed to create encounter');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const renameEncounter = useCallback(async (id: string, name: string) => {
    if (!user) {
      setError('You must be signed in to rename encounters.');
      return null;
    }
    setError(null);
    try {
      const summary = await apiRenameEncounter(id, name);
      if (!summary) {
        throw new Error('Encounter rename failed.');
      }
      setEncounters((current) =>
        current.map((encounter) => (encounter.id === id ? { ...encounter, name: summary.name, updatedAt: summary.updatedAt } : encounter))
      );
      return summary;
    } catch (err) {
      console.error('Failed to rename encounter', err);
      setError(err instanceof Error ? err.message : 'Failed to rename encounter');
      return null;
    }
  }, [user]);

  const deleteEncounter = useCallback(async (id: string) => {
    if (!user) {
      setError('You must be signed in to delete encounters.');
      return false;
    }
    setError(null);
    try {
      const success = await apiDeleteEncounter(id);
      if (success) {
        setEncounters((current) => current.filter((encounter) => encounter.id !== id));
        setSelectedEncounterId((current) => (current === id ? null : current));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete encounter', err);
      setError(err instanceof Error ? err.message : 'Failed to delete encounter');
      return false;
    }
  }, [user]);

  const value = useMemo<EncounterContextValue>(() => {
    const selectedEncounter = selectedEncounterId
      ? encounters.find((encounter) => encounter.id === selectedEncounterId) ?? null
      : null;

    return {
      encounters,
      selectedEncounterId,
      selectedEncounter,
      isLoading,
      error,
      refreshEncounters,
      selectEncounter,
      createEncounter,
      renameEncounter,
      deleteEncounter
    };
  }, [createEncounter, deleteEncounter, encounters, error, isLoading, refreshEncounters, renameEncounter, selectEncounter, selectedEncounterId]);

  return <EncounterContext.Provider value={value}>{children}</EncounterContext.Provider>;
};

export const useEncounterContext = () => {
  const context = useContext(EncounterContext);
  if (!context) {
    throw new Error('useEncounterContext must be used within an EncounterProvider');
  }
  return context;
};
