import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useEncounterContext } from '../context/EncounterContext';
const EncounterManager = ({ onClose, disableClose = false }) => {
    const { encounters, selectedEncounterId, isLoading, error, refreshEncounters, selectEncounter, createEncounter, deleteEncounter, renameEncounter } = useEncounterContext();
    const [encounterName, setEncounterName] = useState('');
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        void refreshEncounters();
    }, [refreshEncounters]);
    const handleCreateEncounter = async (event) => {
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
    const handleSelectEncounter = (id) => {
        selectEncounter(id);
        if (!disableClose) {
            onClose?.();
        }
    };
    const handleRenameEncounter = async (id, currentName) => {
        const nextName = window.prompt('Rename encounter', currentName);
        if (!nextName || nextName.trim() === currentName) {
            return;
        }
        await renameEncounter(id, nextName.trim());
    };
    const handleDeleteEncounter = async (id) => {
        const confirmed = window.confirm('Delete this encounter? This action cannot be undone.');
        if (!confirmed)
            return;
        const deleted = await deleteEncounter(id);
        if (deleted && selectedEncounterId === id && disableClose) {
            // force refresh so UI updates; modal will remain open until new selection is made
            await refreshEncounters();
        }
    };
    return (_jsxs("div", { className: "auth-card encounter-manager", children: [_jsx("h1", { children: "Select Encounter" }), _jsx("p", { className: "auth-subtitle", children: "Choose a saved encounter or create a fresh one for your party." }), (error || formError) && _jsx("p", { className: "auth-error", children: formError ?? error }), _jsxs("form", { className: "auth-form", onSubmit: handleCreateEncounter, children: [_jsx("label", { htmlFor: "encounterName", children: "Create Encounter" }), _jsx("input", { id: "encounterName", type: "text", placeholder: "e.g. Siege of Neverwinter", value: encounterName, onChange: (event) => setEncounterName(event.target.value), disabled: isSubmitting, required: true }), _jsx("button", { type: "submit", className: "primary", disabled: isSubmitting, children: isSubmitting ? 'Creating…' : 'Create Encounter' })] }), _jsxs("div", { className: "encounter-list", children: [_jsxs("div", { className: "encounter-list-header", children: [_jsx("h2", { children: "Saved Encounters" }), _jsx("button", { type: "button", className: "ghost", onClick: () => void refreshEncounters(), disabled: isLoading, children: isLoading ? 'Refreshing…' : 'Refresh' })] }), isLoading && encounters.length === 0 ? (_jsx("p", { className: "muted", children: "Loading encounters\u2026" })) : encounters.length === 0 ? (_jsx("p", { className: "muted", children: "No encounters yet. Create one above to get started." })) : (_jsx("ul", { className: "encounter-list-items", children: encounters.map((encounter) => (_jsxs("li", { className: encounter.id === selectedEncounterId ? 'active' : '', children: [_jsxs("div", { className: "details", children: [_jsx("h3", { children: encounter.name }), _jsxs("span", { className: "timestamp", children: ["Updated ", new Date(encounter.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })] })] }), _jsxs("div", { className: "actions", children: [_jsx("button", { type: "button", className: "primary", onClick: () => handleSelectEncounter(encounter.id), children: "Open" }), _jsx("button", { type: "button", className: "ghost", onClick: () => handleRenameEncounter(encounter.id, encounter.name), children: "Rename" }), _jsx("button", { type: "button", className: "ghost danger", onClick: () => void handleDeleteEncounter(encounter.id), children: "Delete" })] })] }, encounter.id))) }))] })] }));
};
export default EncounterManager;
