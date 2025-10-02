import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useCombatantLibrary } from '../../context/CombatantLibraryContext';
const defaultIcon = '⚔️';
const toCombatantInput = (state) => ({
    name: state.name.trim(),
    type: state.type,
    initiative: Number.isFinite(state.initiative) ? state.initiative : 0,
    maxHp: Math.max(1, Number.isFinite(state.maxHp) ? state.maxHp : 1),
    ac: Number.isFinite(state.ac) ? state.ac : undefined,
    icon: state.icon,
    note: state.note.trim() || undefined
});
const toTemplateInput = (state) => ({
    name: state.name.trim(),
    type: state.type,
    defaultInitiative: Number.isFinite(state.initiative) ? state.initiative : 0,
    maxHp: Math.max(1, Number.isFinite(state.maxHp) ? state.maxHp : 1),
    ac: Number.isFinite(state.ac) ? state.ac : null,
    icon: state.icon,
    note: state.note.trim() || undefined
});
const AddCombatantForm = ({ onCreate, iconOptions, onCancel }) => {
    const initialState = useMemo(() => ({
        name: '',
        type: 'player',
        initiative: 10,
        maxHp: 10,
        ac: 10,
        icon: iconOptions[0]?.icon ?? defaultIcon,
        note: ''
    }), [iconOptions]);
    const [formData, setFormData] = useState(initialState);
    const [feedback, setFeedback] = useState(null);
    const [localError, setLocalError] = useState(null);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const { templates, isLoading, isMutating, error, refresh, saveTemplate, updateTemplate, removeTemplate } = useCombatantLibrary();
    const editingTemplate = useMemo(() => (editingTemplateId ? templates.find((template) => template.id === editingTemplateId) ?? null : null), [editingTemplateId, templates]);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!formData.name.trim())
            return;
        onCreate(toCombatantInput(formData));
        setFormData(initialState);
        setEditingTemplateId(null);
        setFeedback(null);
    };
    const handleApplyTemplate = (template, stayOpen = false) => {
        setEditingTemplateId(null);
        onCreate({
            name: template.name,
            type: template.type,
            initiative: template.defaultInitiative,
            maxHp: template.maxHp,
            ac: template.ac ?? undefined,
            icon: template.icon,
            note: template.note ?? undefined
        }, stayOpen ? { stayOpen: true } : undefined);
    };
    const handleFillFromTemplate = (template) => {
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
    const handleEditTemplate = (template) => {
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
            }
            else {
                setLocalError('Could not update combatant in the library.');
            }
        }
        else {
            const created = await saveTemplate(payload);
            if (created) {
                setFeedback('Saved to library.');
            }
            else {
                setLocalError('Could not save combatant to the library.');
            }
        }
    };
    return (_jsxs("form", { className: "add-combatant", onSubmit: handleSubmit, children: [_jsxs("div", { className: "add-combatant-head", children: [_jsx("h3", { children: "Add Combatant" }), editingTemplateId ? (_jsx("button", { type: "button", className: "ghost", onClick: handleCancelEdit, disabled: isMutating, "aria-label": editingTemplate ? 'Cancel editing ' + editingTemplate.name : 'Cancel editing current template', children: "Cancel Edit" })) : null, onCancel && (_jsx("button", { type: "button", className: "add-combatant-close", onClick: onCancel, "aria-label": "Close add combatant form", children: "\u00D7" }))] }), _jsxs("div", { className: "add-combatant-grid", children: [_jsxs("section", { className: "saved-combatant-panel", children: [_jsxs("div", { className: "saved-combatant-head", children: [_jsx("h4", { children: "Saved Combatants" }), _jsx("button", { type: "button", className: "ghost", onClick: () => void refresh(), disabled: isLoading, children: isLoading ? 'Refreshing…' : 'Refresh' })] }), error && _jsx("p", { className: "form-warning", children: error }), _jsx("div", { className: "saved-combatant-scroll", children: isLoading ? (_jsx("p", { className: "empty-state-text", children: "Loading saved combatants\u2026" })) : templates.length === 0 ? (_jsx("p", { className: "empty-state-text", children: "No saved combatants yet. Save one from this form or any active combatant." })) : (_jsx("ul", { className: "saved-combatant-list", children: templates.map((template) => (_jsxs("li", { children: [_jsx("button", { type: "button", className: "saved-combatant-avatar", onClick: () => handleFillFromTemplate(template), title: "Load into form", children: _jsx("span", { children: template.icon }) }), _jsxs("div", { className: "saved-combatant-info", children: [_jsx("strong", { children: template.name }), _jsxs("span", { className: "saved-combatant-meta", children: [template.type, " \u00B7 Init ", template.defaultInitiative, " \u00B7 HP ", template.maxHp] })] }), _jsxs("div", { className: "saved-combatant-actions", children: [_jsx("button", { type: "button", className: "ghost", onClick: () => handleApplyTemplate(template, true), children: "Add" }), _jsx("button", { type: "button", className: "ghost", onClick: () => handleEditTemplate(template), "aria-pressed": editingTemplateId === template.id, children: "Edit" }), _jsx("button", { type: "button", className: "ghost danger", onClick: () => void removeTemplate(template.id), disabled: isMutating, children: "Delete" })] })] }, template.id))) })) })] }), _jsxs("section", { className: "manual-combatant-form", children: [_jsxs("label", { children: ["Name", _jsx("input", { type: "text", value: formData.name, onChange: (event) => {
                                            setFormData((prev) => ({ ...prev, name: event.target.value }));
                                            setFeedback(null);
                                        }, placeholder: "Name or descriptor", required: true })] }), _jsxs("label", { children: ["Type", _jsxs("select", { value: formData.type, onChange: (event) => {
                                            setFormData((prev) => ({ ...prev, type: event.target.value }));
                                            setFeedback(null);
                                        }, children: [_jsx("option", { value: "player", children: "Player" }), _jsx("option", { value: "ally", children: "Ally" }), _jsx("option", { value: "enemy", children: "Enemy" })] })] }), _jsxs("div", { className: "inline", children: [_jsxs("label", { children: ["Initiative", _jsx("input", { type: "number", value: formData.initiative, onChange: (event) => {
                                                    setFormData((prev) => ({ ...prev, initiative: Number(event.target.value) }));
                                                    setFeedback(null);
                                                }, min: -10, max: 50 })] }), _jsxs("label", { children: ["Max HP", _jsx("input", { type: "number", value: formData.maxHp, onChange: (event) => {
                                                    setFormData((prev) => ({ ...prev, maxHp: Number(event.target.value) }));
                                                    setFeedback(null);
                                                }, min: 1 })] }), _jsxs("label", { children: ["AC", _jsx("input", { type: "number", value: formData.ac, onChange: (event) => {
                                                    setFormData((prev) => ({ ...prev, ac: Number(event.target.value) }));
                                                    setFeedback(null);
                                                }, min: 0 })] })] }), _jsxs("label", { children: ["Icon", _jsx("select", { value: formData.icon, onChange: (event) => {
                                            setFormData((prev) => ({ ...prev, icon: event.target.value }));
                                            setFeedback(null);
                                        }, children: iconOptions.map((option) => (_jsxs("option", { value: option.icon, children: [option.icon, " ", option.label] }, option.id))) })] }), _jsxs("label", { children: ["Notes", _jsx("textarea", { value: formData.note, onChange: (event) => {
                                            setFormData((prev) => ({ ...prev, note: event.target.value }));
                                            setFeedback(null);
                                        }, rows: 3, placeholder: "Opening position, tactics, loot\u2026" })] }), localError && _jsx("p", { className: "form-warning", children: localError }), feedback && _jsx("p", { className: "form-feedback", children: feedback }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "submit", className: "primary", children: "Add to Encounter" }), _jsx("button", { type: "button", className: "ghost", onClick: () => void handleSaveTemplate(), disabled: isMutating, children: isMutating ? 'Saving…' : editingTemplateId ? 'Update Template' : 'Save to Library' })] })] })] })] }));
};
export default AddCombatantForm;
