import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { createCombatantTemplate, deleteCombatantTemplate, listCombatantTemplates, updateCombatantTemplate } from '../data/combatantLibrary';
const CombatantLibraryContext = createContext(undefined);
export const CombatantLibraryProvider = ({ children }) => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMutating, setIsMutating] = useState(false);
    const [error, setError] = useState(null);
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
        }
        catch (err) {
            console.error('Failed to refresh combatant templates', err);
            setError(err instanceof Error ? err.message : 'Failed to load saved combatants');
            setTemplates([]);
        }
        finally {
            setIsLoading(false);
        }
    }, [user]);
    useEffect(() => {
        if (user) {
            void refresh();
        }
        else {
            setTemplates([]);
            setError(null);
        }
    }, [refresh, user]);
    const saveTemplate = useCallback(async (input) => {
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
            setTemplates((current) => [...current.filter((template) => template.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)));
            return created;
        }
        catch (err) {
            console.error('Failed to save combatant template', err);
            setError(err instanceof Error ? err.message : 'Failed to save combatant template');
            return null;
        }
        finally {
            setIsMutating(false);
        }
    }, [user]);
    const updateTemplate = useCallback(async (id, input) => {
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
            setTemplates((current) => [...current.filter((template) => template.id !== updated.id), updated].sort((a, b) => a.name.localeCompare(b.name)));
            return updated;
        }
        catch (err) {
            console.error('Failed to update combatant template', err);
            setError(err instanceof Error ? err.message : 'Failed to update combatant template');
            return null;
        }
        finally {
            setIsMutating(false);
        }
    }, [user]);
    const removeTemplate = useCallback(async (id) => {
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
        }
        catch (err) {
            console.error('Failed to delete combatant template', err);
            setError(err instanceof Error ? err.message : 'Failed to delete combatant template');
            return false;
        }
        finally {
            setIsMutating(false);
        }
    }, [user]);
    const value = useMemo(() => ({ templates, isLoading, isMutating, error, refresh, saveTemplate, updateTemplate, removeTemplate }), [error, isLoading, isMutating, refresh, removeTemplate, saveTemplate, templates, updateTemplate]);
    return _jsx(CombatantLibraryContext.Provider, { value: value, children: children });
};
export const useCombatantLibrary = () => {
    const context = useContext(CombatantLibraryContext);
    if (!context) {
        throw new Error('useCombatantLibrary must be used within a CombatantLibraryProvider');
    }
    return context;
};
