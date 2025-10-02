import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useCombatTracker } from '../hooks/useCombatTracker';
import InitiativeList from './InitiativeList';
import CombatantCard from './CombatantCard';
import AddCombatantForm from './forms/AddCombatantForm';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useEncounterContext } from '../context/EncounterContext';
import EncounterManager from './EncounterManager';
const CombatTracker = () => {
    const { selectedEncounterId, selectedEncounter } = useEncounterContext();
    const { state, actions, presets, isLoading } = useCombatTracker(selectedEncounterId);
    const { user, handleSignOut } = useAuth();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(!selectedEncounterId);
    const [lastRoll, setLastRoll] = useState(null);
    const initiativeScrollRef = useRef(null);
    const initiativeRefs = useRef(new Map());
    const handleAddStatus = (combatantId, template, rounds, note) => {
        actions.addStatus(combatantId, template, rounds, note);
    };
    const scrollItemIntoView = (container, element) => {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        if (elementRect.top < containerRect.top) {
            container.scrollBy({ top: elementRect.top - containerRect.top - 12, behavior: 'smooth' });
            return;
        }
        if (elementRect.bottom > containerRect.bottom) {
            container.scrollBy({ top: elementRect.bottom - containerRect.bottom + 12, behavior: 'smooth' });
        }
    };
    useEffect(() => {
        if (!state.activeCombatantId)
            return;
        const container = initiativeScrollRef.current;
        const item = initiativeRefs.current.get(state.activeCombatantId);
        if (!container || !item)
            return;
        scrollItemIntoView(container, item);
    }, [state.activeCombatantId, state.combatants]);
    useEffect(() => {
        setIsSelectionModalOpen(!selectedEncounterId);
    }, [selectedEncounterId]);
    const handleCloseSelectionModal = () => {
        if (!selectedEncounterId)
            return;
        setIsSelectionModalOpen(false);
    };
    const rollDie = (sides) => {
        const result = Math.floor(Math.random() * sides) + 1;
        setLastRoll({ die: sides, result });
    };
    const activeIndex = state.activeCombatantId
        ? state.combatants.findIndex((combatant) => combatant.id === state.activeCombatantId)
        : 0;
    const normalizedActiveIndex = activeIndex === -1 ? 0 : activeIndex;
    if (isLoading) {
        return (_jsx("div", { className: "tracker-shell", children: _jsxs("div", { className: "empty-state", children: [_jsx("h3", { children: "Loading encounter\u2026" }), _jsx("p", { children: "Please wait while we retrieve the latest state." })] }) }));
    }
    return (_jsxs("div", { className: "tracker-shell", children: [_jsxs("header", { className: "tracker-header", children: [_jsxs("div", { children: [_jsx("h1", { children: "D&D Combat Tracker" }), _jsx("p", { className: "tracker-subtitle", children: "Keep the encounter flowing with initiative, damage, and status tracking." }), _jsxs("div", { className: "dice-tray", "aria-live": "polite", children: [_jsx("div", { className: "dice-buttons", children: [20, 12, 10, 8, 6, 4].map((sides) => (_jsxs("button", { type: "button", className: "ghost", onClick: () => rollDie(sides), children: ["d", sides] }, 'die-' + sides))) }), _jsx("p", { className: `dice-result${lastRoll ? '' : ' is-empty'}`, children: lastRoll ? `Rolled d${lastRoll.die}: ${lastRoll.result}` : 'Roll a die to see the result here.' })] })] }), _jsxs("div", { className: "tracker-round", children: [_jsx("span", { className: "label", children: "Round" }), _jsx("span", { className: "value", children: state.round })] }), _jsxs("div", { className: "tracker-meta", children: [_jsxs("div", { className: "session-info", children: [_jsx("span", { className: "session-label", children: "Encounter" }), _jsx("span", { className: "session-value", children: selectedEncounter?.name ?? 'Untitled Encounter' }), _jsx("button", { type: "button", className: "ghost", onClick: () => setIsSelectionModalOpen(true), children: "Switch" })] }), _jsxs("div", { className: "session-info", children: [_jsx("span", { className: "session-label", children: "Signed in as" }), _jsx("span", { className: "session-value", children: user?.email }), _jsx("button", { type: "button", className: "ghost", onClick: () => void handleSignOut(), children: "Sign Out" })] }), _jsxs("div", { className: "turn-controls", children: [_jsx("button", { type: "button", onClick: actions.rewindTurn, className: "ghost", children: "\u23EE Prev" }), _jsx("button", { type: "button", onClick: actions.advanceTurn, className: "primary", children: "Next \u23ED" })] })] })] }), _jsxs("div", { className: "tracker-main", children: [_jsx("aside", { className: "initiative-column", children: _jsxs("section", { className: "initiative-bar", children: [_jsxs("div", { className: "panel-head", children: [_jsx("h2", { children: "Initiative Order" }), _jsx("button", { type: "button", className: "ghost", onClick: () => setIsCreateModalOpen(true), children: "Add Combatant" })] }), _jsx("div", { className: "initiative-scroll", ref: initiativeScrollRef, children: _jsx(InitiativeList, { combatants: state.combatants, activeId: state.activeCombatantId, onSelect: actions.setActiveCombatant, registerItemRef: (id, node) => {
                                            if (node) {
                                                initiativeRefs.current.set(id, node);
                                            }
                                            else {
                                                initiativeRefs.current.delete(id);
                                            }
                                        } }) }), _jsx("button", { type: "button", className: "ghost wide", onClick: actions.resetEncounter, children: "Reset Encounter" })] }) }), _jsx("section", { className: "combatant-strip", children: state.combatants.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("h3", { children: "No combatants yet" }), _jsx("p", { children: "Add heroes and foes to begin tracking this encounter." }), !isCreateModalOpen && (_jsx("button", { type: "button", className: "primary", onClick: () => setIsCreateModalOpen(true), children: "Add Combatant" }))] })) : (_jsx("div", { className: "combatant-carousel", children: _jsx("div", { className: "combatant-carousel-track", children: state.combatants.map((combatant, index) => {
                                    const isActive = combatant.id === state.activeCombatantId || (!state.activeCombatantId && index === normalizedActiveIndex);
                                    const offset = index - normalizedActiveIndex;
                                    const distance = Math.abs(offset);
                                    const style = {
                                        '--offset': offset,
                                        '--abs-offset': distance,
                                        zIndex: state.combatants.length - distance,
                                        opacity: distance > 2 ? 0 : Math.max(0.2, 1 - distance * 0.18),
                                        pointerEvents: isActive ? 'auto' : 'none'
                                    };
                                    return (_jsx("div", { className: `combatant-carousel-item${isActive ? ' active' : ''}`, style: style, children: _jsx(CombatantCard, { combatant: combatant, isActive: isActive, onCenter: () => actions.setActiveCombatant(combatant.id), onDamage: (amount) => actions.applyDelta(combatant.id, amount), onHeal: (amount) => actions.applyDelta(combatant.id, -amount), onRemove: () => actions.removeCombatant(combatant.id), onUpdate: (changes) => actions.updateCombatant(combatant.id, changes), onAddStatus: (template, rounds, note) => handleAddStatus(combatant.id, template, rounds, note), onRemoveStatus: (statusId) => actions.removeStatus(combatant.id, statusId), statusPresets: presets.statuses }) }, combatant.id));
                                }) }) })) })] }), _jsx(Modal, { isOpen: isCreateModalOpen, onClose: () => setIsCreateModalOpen(false), ariaLabel: "Add combatant form", children: _jsx(AddCombatantForm, { onCreate: (payload) => {
                        actions.addCombatant(payload);
                        setIsCreateModalOpen(false);
                    }, iconOptions: presets.icons, onCancel: () => setIsCreateModalOpen(false) }) }), _jsx(Modal, { isOpen: isSelectionModalOpen, onClose: handleCloseSelectionModal, ariaLabel: "Encounter selection", children: _jsx(EncounterManager, { onClose: handleCloseSelectionModal, disableClose: !selectedEncounterId }) })] }));
};
export default CombatTracker;
