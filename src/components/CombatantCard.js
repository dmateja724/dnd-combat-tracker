import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
const quickDamageValues = [1, 5, 10];
const quickHealValues = [1, 5, 10];
const typeToLabel = {
    player: 'Adventurer',
    ally: 'Ally',
    enemy: 'Enemy'
};
const CombatantCard = ({ combatant, isActive, statusPresets, onCenter, onDamage, onHeal, onRemove, onUpdate, onAddStatus, onRemoveStatus }) => {
    const [customValue, setCustomValue] = useState(6);
    const [noteDraft, setNoteDraft] = useState(combatant.note ?? '');
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [statusPanelOpen, setStatusPanelOpen] = useState(false);
    const [selectedStatusId, setSelectedStatusId] = useState(statusPresets[0]?.id ?? '');
    const [customStatusLabel, setCustomStatusLabel] = useState('');
    const [customStatusIcon, setCustomStatusIcon] = useState('✦');
    const [customStatusColor, setCustomStatusColor] = useState('#ffb703');
    const [rounds, setRounds] = useState('');
    const [statusNote, setStatusNote] = useState('');
    useEffect(() => {
        setNoteDraft(combatant.note ?? '');
    }, [combatant.note, combatant.id]);
    const healthPercent = useMemo(() => {
        if (combatant.hp.max === 0)
            return 0;
        return Math.round((combatant.hp.current / combatant.hp.max) * 100);
    }, [combatant.hp.current, combatant.hp.max]);
    const isDefeated = combatant.hp.current <= 0;
    const handleNoteSubmit = () => {
        onUpdate({ note: noteDraft });
        setIsEditingNote(false);
    };
    const handleStatusSubmit = (event) => {
        event.preventDefault();
        let template;
        if (selectedStatusId === 'custom') {
            if (!customStatusLabel.trim())
                return;
            const slug = customStatusLabel
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-');
            template = {
                id: 'custom-' + slug,
                label: customStatusLabel.trim(),
                color: customStatusColor,
                icon: customStatusIcon || '✦'
            };
        }
        else {
            template = statusPresets.find((item) => item.id === selectedStatusId);
        }
        if (!template)
            return;
        const normalizedRounds = rounds === '' ? null : Math.max(0, Math.round(Number(rounds)));
        onAddStatus(template, normalizedRounds, statusNote.trim() || undefined);
        setStatusPanelOpen(false);
        setRounds('');
        setStatusNote('');
        setCustomStatusLabel('');
        setCustomStatusIcon('✦');
    };
    const hpWidth = Math.max(0, Math.min(healthPercent, 100)) + '%';
    return (_jsxs("article", { className: clsx('combatant-card', 'is-' + combatant.type, {
            active: isActive,
            defeated: isDefeated
        }), children: [_jsxs("header", { className: "card-head", children: [_jsx("button", { className: "avatar", onClick: onCenter, type: "button", children: _jsx("span", { children: combatant.icon }) }), _jsxs("div", { className: "identity", children: [_jsx("h3", { children: combatant.name }), _jsxs("div", { className: "meta", children: [_jsx("span", { className: 'tag tag-' + combatant.type, children: typeToLabel[combatant.type] }), _jsxs("span", { className: "tag", children: ["Init ", combatant.initiative] }), combatant.ac ? _jsxs("span", { className: "tag", children: ["AC ", combatant.ac] }) : null] })] }), _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", className: "ghost", onClick: onCenter, children: isActive ? 'Current Turn' : 'Set Active' }), _jsx("button", { type: "button", className: "ghost danger", onClick: onRemove, children: "Remove" })] })] }), _jsxs("section", { className: "hp-block", children: [_jsxs("div", { className: "hp-info", children: [_jsx("strong", { children: combatant.hp.current }), _jsxs("span", { children: ["/ ", combatant.hp.max, " HP"] })] }), _jsx("div", { className: "hp-bar", children: _jsx("div", { className: "hp-progress", style: { width: hpWidth } }) })] }), _jsxs("section", { className: "controls", children: [_jsxs("div", { className: "quick-row", children: [_jsx("span", { children: "Damage" }), _jsx("div", { children: quickDamageValues.map((value) => (_jsxs("button", { type: "button", onClick: () => onDamage(value), children: ["-", value] }, 'dmg-' + value))) })] }), _jsxs("div", { className: "quick-row", children: [_jsx("span", { children: "Heal" }), _jsx("div", { children: quickHealValues.map((value) => (_jsxs("button", { type: "button", onClick: () => onHeal(value), children: ["+", value] }, 'heal-' + value))) })] }), _jsxs("form", { className: "custom-row", onSubmit: (event) => {
                            event.preventDefault();
                            const amount = Math.max(0, Number(customValue) || 0);
                            if (amount === 0)
                                return;
                            onDamage(amount);
                        }, children: [_jsx("label", { htmlFor: 'custom-amount-' + combatant.id, children: "Custom" }), _jsx("input", { id: 'custom-amount-' + combatant.id, type: "number", min: 0, value: customValue, onChange: (event) => setCustomValue(Number(event.target.value)) }), _jsx("button", { type: "submit", className: "primary", children: "Apply Damage" }), _jsx("button", { type: "button", className: "ghost", onClick: () => {
                                    const amount = Math.max(0, Number(customValue) || 0);
                                    if (amount === 0)
                                        return;
                                    onHeal(amount);
                                }, children: "Apply Heal" })] })] }), _jsxs("div", { className: "card-bottom", children: [_jsxs("section", { className: "status-section", children: [_jsxs("div", { className: "status-head", children: [_jsx("h4", { children: "Status Effects" }), _jsx("button", { type: "button", className: "ghost", onClick: () => setStatusPanelOpen((open) => !open), children: statusPanelOpen ? 'Close' : 'Add' })] }), _jsxs("div", { className: "status-chips", children: [combatant.statuses.length === 0 && _jsx("span", { className: "muted", children: "None" }), combatant.statuses.map((status) => (_jsxs("button", { type: "button", className: "status-chip", style: { backgroundColor: status.color }, onClick: () => onRemoveStatus(status.instanceId), title: status.note || status.description || status.label, children: [_jsx("span", { className: "icon", children: status.icon }), _jsx("span", { children: status.label }), status.remainingRounds !== null ? _jsx("span", { className: "rounds", children: status.remainingRounds }) : null] }, status.instanceId)))] }), statusPanelOpen ? (_jsxs("form", { className: "status-form", onSubmit: handleStatusSubmit, children: [_jsxs("label", { children: ["Preset", _jsxs("select", { value: selectedStatusId, onChange: (event) => setSelectedStatusId(event.target.value), children: [statusPresets.map((preset) => (_jsxs("option", { value: preset.id, children: [preset.icon, " ", preset.label] }, preset.id))), _jsx("option", { value: "custom", children: "Custom\u2026" })] })] }), selectedStatusId === 'custom' ? (_jsxs("div", { className: "custom-status-fields", children: [_jsxs("label", { children: ["Label", _jsx("input", { type: "text", value: customStatusLabel, onChange: (event) => setCustomStatusLabel(event.target.value), placeholder: "Status name", required: true })] }), _jsxs("label", { children: ["Icon", _jsx("input", { type: "text", value: customStatusIcon, maxLength: 2, onChange: (event) => setCustomStatusIcon(event.target.value) })] }), _jsxs("label", { children: ["Color", _jsx("input", { type: "color", value: customStatusColor, onChange: (event) => setCustomStatusColor(event.target.value) })] })] })) : null, _jsxs("label", { children: ["Rounds", _jsx("input", { type: "number", min: 0, value: rounds, onChange: (event) => {
                                                    const value = event.target.value;
                                                    setRounds(value === '' ? '' : Number(value));
                                                }, placeholder: "\u221E" })] }), _jsxs("label", { children: ["Note", _jsx("input", { type: "text", value: statusNote, onChange: (event) => setStatusNote(event.target.value), placeholder: "Optional reminder" })] }), _jsxs("div", { className: "status-actions", children: [_jsx("button", { type: "submit", className: "primary", children: "Add Status" }), _jsx("button", { type: "button", className: "ghost", onClick: () => setStatusPanelOpen(false), children: "Cancel" })] })] })) : null] }), _jsxs("section", { className: "notes-section", children: [_jsxs("div", { className: "notes-head", children: [_jsx("h4", { children: "Notes" }), _jsx("button", { type: "button", className: "ghost", onClick: () => {
                                            if (isEditingNote) {
                                                setIsEditingNote(false);
                                                setNoteDraft(combatant.note ?? '');
                                            }
                                            else {
                                                setIsEditingNote(true);
                                            }
                                        }, children: isEditingNote ? 'Cancel' : combatant.note ? 'Edit' : 'Add' })] }), isEditingNote ? (_jsxs("div", { className: "notes-editor", children: [_jsx("textarea", { value: noteDraft, onChange: (event) => setNoteDraft(event.target.value), placeholder: "Battlefield reminders, resistances, tactics\u2026", rows: 3 }), _jsx("button", { type: "button", className: "primary", onClick: handleNoteSubmit, children: "Save Note" })] })) : (_jsx("p", { className: clsx('notes-copy', { muted: !combatant.note }), children: combatant.note || 'No notes yet' }))] })] })] }));
};
export default CombatantCard;
