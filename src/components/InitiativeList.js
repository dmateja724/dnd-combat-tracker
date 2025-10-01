import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
const InitiativeList = ({ combatants, activeId, onSelect, registerItemRef }) => {
    if (combatants.length === 0) {
        return _jsx("p", { className: "muted", children: "No turn order yet." });
    }
    return (_jsx("ol", { className: "initiative-list", children: combatants.map((combatant, index) => {
            const isActive = combatant.id === activeId;
            const statusCount = combatant.statuses.length;
            const defeated = combatant.hp.current <= 0;
            return (_jsx("li", { className: isActive ? 'active' : undefined, ref: (node) => registerItemRef?.(combatant.id, node), children: _jsxs("button", { type: "button", className: "initiative-row", onClick: () => onSelect(combatant.id), children: [_jsx("span", { className: "order", children: index + 1 }), _jsx("span", { className: "icon", children: combatant.icon }), _jsxs("div", { className: "info", children: [_jsx("strong", { children: combatant.name }), _jsxs("span", { className: "meta", children: ["Init ", combatant.initiative, _jsx("span", { "aria-hidden": "true", children: " \u2022 " }), "HP ", combatant.hp.current, "/", combatant.hp.max, statusCount > 0 ? (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": "true", children: " \u2022 " }), statusCount, " status", statusCount > 1 ? 'es' : ''] })) : null] })] }), _jsx("span", { className: 'type ' + combatant.type, children: defeated ? 'Down' : combatant.type })] }) }, combatant.id));
        }) }));
};
export default InitiativeList;
