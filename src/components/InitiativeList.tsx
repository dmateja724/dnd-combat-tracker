import { Combatant } from '../types';

interface InitiativeListProps {
  combatants: Combatant[];
  activeId: string | null;
  onSelect: (id: string) => void;
  registerItemRef?: (id: string, node: HTMLLIElement | null) => void;
}

const InitiativeList = ({ combatants, activeId, onSelect, registerItemRef }: InitiativeListProps) => {
  if (combatants.length === 0) {
    return <p className="muted">No turn order yet.</p>;
  }

  return (
    <ol className="initiative-list">
      {combatants.map((combatant, index) => {
        const isActive = combatant.id === activeId;
        const statusCount = combatant.statuses.length;
        const defeated = combatant.hp.current <= 0;
        return (
          <li
            key={combatant.id}
            className={isActive ? 'active' : undefined}
            ref={(node) => registerItemRef?.(combatant.id, node)}
          >
            <button type="button" className="initiative-row" onClick={() => onSelect(combatant.id)}>
              <span className="order">{index + 1}</span>
              <span className="icon">{combatant.icon}</span>
              <div className="info">
                <strong>{combatant.name}</strong>
                <span className="meta">
                  Init {combatant.initiative}
                  <span aria-hidden="true"> • </span>
                  HP {combatant.hp.current}/{combatant.hp.max}
                  {statusCount > 0 ? (
                    <>
                      <span aria-hidden="true"> • </span>
                      {statusCount} status{statusCount > 1 ? 'es' : ''}
                    </>
                  ) : null}
                </span>
              </div>
              <span className={'type ' + combatant.type}>
                {defeated ? 'Down' : combatant.type}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default InitiativeList;
