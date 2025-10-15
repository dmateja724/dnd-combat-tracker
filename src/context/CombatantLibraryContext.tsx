import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { CombatantTemplate, CombatantTemplateInput } from '../types';
import {
  createCombatantTemplate,
  deleteCombatantTemplate,
  listCombatantTemplates,
  updateCombatantTemplate
} from '../data/combatantLibrary';

interface CombatantLibraryContextValue {
  templates: CombatantTemplate[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveTemplate: (input: CombatantTemplateInput) => Promise<CombatantTemplate | null>;
  updateTemplate: (id: string, input: CombatantTemplateInput) => Promise<CombatantTemplate | null>;
  removeTemplate: (id: string) => Promise<boolean>;
  importTemplates: (inputs: CombatantTemplateInput[]) => Promise<{ imported: number; failed: number }>;
}

const CombatantLibraryContext = createContext<CombatantLibraryContextValue | undefined>(undefined);

export const CombatantLibraryProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CombatantTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const list = await listCombatantTemplates();
      setTemplates(list);
    } catch (err) {
      console.error('Failed to refresh combatant templates', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved combatants');
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setTemplates([]);
      setError(null);
    }
  }, [refresh, user]);

  const saveTemplate = useCallback(
    async (input: CombatantTemplateInput) => {
      if (!user) {
        setError('You must be signed in to save combatants.');
        return null;
      }
      setIsMutating(true);
      setError(null);
      try {
        const created = await createCombatantTemplate(input);
        if (!created) {
          throw new Error('Failed to save combatant template.');
        }
        setTemplates((current) =>
          [...current.filter((template) => template.id !== created.id), created].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        return created;
      } catch (err) {
        console.error('Failed to save combatant template', err);
        setError(err instanceof Error ? err.message : 'Failed to save combatant template');
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [user]
  );

  const updateTemplate = useCallback(
    async (id: string, input: CombatantTemplateInput) => {
      if (!user) {
        setError('You must be signed in to edit combatants.');
        return null;
      }
      setIsMutating(true);
      setError(null);
      try {
        const updated = await updateCombatantTemplate(id, input);
        if (!updated) {
          throw new Error('Failed to update combatant template.');
        }
        setTemplates((current) =>
          [...current.filter((template) => template.id !== updated.id), updated].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        return updated;
      } catch (err) {
        console.error('Failed to update combatant template', err);
        setError(err instanceof Error ? err.message : 'Failed to update combatant template');
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [user]
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      if (!user) {
        setError('You must be signed in to delete combatants.');
        return false;
      }
      setIsMutating(true);
      setError(null);
      try {
        const success = await deleteCombatantTemplate(id);
        if (success) {
          setTemplates((current) => current.filter((template) => template.id !== id));
        }
        return success;
      } catch (err) {
        console.error('Failed to delete combatant template', err);
        setError(err instanceof Error ? err.message : 'Failed to delete combatant template');
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [user]
  );

  const importTemplates = useCallback(
    async (inputs: CombatantTemplateInput[]) => {
      if (!user) {
        setError('You must be signed in to import combatants.');
        return { imported: 0, failed: inputs.length };
      }
      if (inputs.length === 0) {
        return { imported: 0, failed: 0 };
      }

      setIsMutating(true);
      setError(null);

      const created: CombatantTemplate[] = [];
      let failed = 0;
      let processed = 0;

      try {
        for (const input of inputs) {
          processed += 1;
          const template = await createCombatantTemplate(input);
          if (template) {
            created.push(template);
          } else {
            failed += 1;
          }
        }

        if (created.length > 0) {
          setTemplates((current) => {
            const next = [...current];
            for (const template of created) {
              const existingIndex = next.findIndex((candidate) => candidate.id === template.id);
              if (existingIndex === -1) {
                next.push(template);
              } else {
                next[existingIndex] = template;
              }
            }
            return next.sort((a, b) => a.name.localeCompare(b.name));
          });
        }

        if (failed > 0) {
          setError(failed === inputs.length ? 'Failed to import combatant templates.' : 'Some combatants could not be imported.');
        }

        return { imported: created.length, failed };
      } catch (err) {
        console.error('Failed to import combatant templates', err);
        setError(err instanceof Error ? err.message : 'Failed to import combatant templates');
        const remainingFailures = inputs.length - processed;
        return { imported: created.length, failed: failed + Math.max(remainingFailures, 0) };
      } finally {
        setIsMutating(false);
      }
    },
    [user]
  );

  const value = useMemo<CombatantLibraryContextValue>(
    () => ({
      templates,
      isLoading,
      isMutating,
      error,
      refresh,
      saveTemplate,
      updateTemplate,
      removeTemplate,
      importTemplates
    }),
    [error, importTemplates, isLoading, isMutating, refresh, removeTemplate, saveTemplate, templates, updateTemplate]
  );

  return <CombatantLibraryContext.Provider value={value}>{children}</CombatantLibraryContext.Provider>;
};

export const useCombatantLibrary = () => {
  const context = useContext(CombatantLibraryContext);
  if (!context) {
    throw new Error('useCombatantLibrary must be used within a CombatantLibraryProvider');
  }
  return context;
};
