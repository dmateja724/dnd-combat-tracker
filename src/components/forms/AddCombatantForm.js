import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const defaultIcon = '⚔️';
const AddCombatantForm = ({ onCreate, iconOptions, onCancel }) => {
    const initialState = {
        name: '',
        type: 'player',
        initiative: 10,
        maxHp: 10,
        ac: 10,
        icon: iconOptions[0]?.icon ?? defaultIcon,
        note: ''
    };
    const [formData, setFormData] = useState(initialState);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!formData.name.trim())
            return;
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
    return (_jsxs("form", { className: "add-combatant", onSubmit: handleSubmit, children: [_jsxs("div", { className: "add-combatant-head", children: [_jsx("h3", { children: "Add Combatant" }), onCancel && (_jsx("button", { type: "button", className: "add-combatant-close", onClick: onCancel, "aria-label": "Close add combatant form", children: "\u00D7" }))] }), _jsxs("label", { children: ["Name", _jsx("input", { type: "text", value: formData.name, onChange: (event) => setFormData((prev) => ({ ...prev, name: event.target.value })), placeholder: "Name or descriptor", required: true })] }), _jsxs("label", { children: ["Type", _jsxs("select", { value: formData.type, onChange: (event) => setFormData((prev) => ({ ...prev, type: event.target.value })), children: [_jsx("option", { value: "player", children: "Player" }), _jsx("option", { value: "ally", children: "Ally" }), _jsx("option", { value: "enemy", children: "Enemy" })] })] }), _jsxs("div", { className: "inline", children: [_jsxs("label", { children: ["Initiative", _jsx("input", { type: "number", value: formData.initiative, onChange: (event) => setFormData((prev) => ({ ...prev, initiative: Number(event.target.value) })), min: -10, max: 50 })] }), _jsxs("label", { children: ["Max HP", _jsx("input", { type: "number", value: formData.maxHp, onChange: (event) => setFormData((prev) => ({ ...prev, maxHp: Number(event.target.value) })), min: 1 })] }), _jsxs("label", { children: ["AC", _jsx("input", { type: "number", value: formData.ac, onChange: (event) => setFormData((prev) => ({ ...prev, ac: Number(event.target.value) })), min: 0 })] })] }), _jsxs("label", { children: ["Icon", _jsx("select", { value: formData.icon, onChange: (event) => setFormData((prev) => ({ ...prev, icon: event.target.value })), children: iconOptions.map((option) => (_jsxs("option", { value: option.icon, children: [option.icon, " ", option.label] }, option.id))) })] }), _jsxs("label", { children: ["Notes", _jsx("textarea", { value: formData.note, onChange: (event) => setFormData((prev) => ({ ...prev, note: event.target.value })), rows: 3, placeholder: "Opening position, tactics, loot\u2026" })] }), _jsx("button", { type: "submit", className: "primary wide", children: "Add to Encounter" })] }));
};
export default AddCombatantForm;
