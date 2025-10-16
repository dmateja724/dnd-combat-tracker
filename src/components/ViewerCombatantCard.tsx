import clsx from 'clsx';
import { Combatant } from '../types';

const typeToLabel: Record<Combatant['type'], string> = {
  player: 'Adventurer',
  ally: 'Ally',
  enemy: 'Enemy'
};

interface ViewerCombatantCardProps {
  combatant: Combatant;
  isActive: boolean;
}

const ViewerCombatantCard = ({ combatant, isActive }: ViewerCombatantCardProps) => {
  const showHealth = combatant.type !== 'enemy';
  const healthPercent = combatant.hp.max === 0 ? 0 : Math.round((combatant.hp.current / combatant.hp.max) * 100);
  const hpWidth = Math.max(0, Math.min(healthPercent, 100)) + '%';
  const isDefeated = combatant.hp.current <= 0;

  return (
    <article
      className={clsx('combatant-card viewer-card', 'is-' + combatant.type, {
        active: isActive,
        defeated: isDefeated
      })}
    >
      <header className="card-head viewer-card-head">
        <div className="avatar viewer-avatar" aria-hidden="true">
          <span>{combatant.icon}</span>
        </div>
        <div className="identity">
          <h3>{combatant.name}</h3>
          <div className="meta">
            <span className={'tag tag-' + combatant.type}>{typeToLabel[combatant.type]}</span>
            <span className="tag">Init {combatant.initiative}</span>
          </div>
        </div>
      </header>

      <section className="hp-block viewer-hp-block">
        {showHealth ? (
          <>
            <div className="hp-info">
              <strong>{combatant.hp.current}</strong>
              <span>/ {combatant.hp.max} HP</span>
            </div>
            <div className="hp-bar">
              <div className="hp-progress" style={{ width: hpWidth }} />
            </div>
          </>
        ) : (
          <div className="hp-hidden">
            <span className="hp-hidden-label">HP Hidden</span>
            <span className="hp-hidden-value">???</span>
          </div>
        )}
      </section>

      <section className="status-section viewer-status-section">
        <div className="status-head">
          <h4>Status Effects</h4>
        </div>
        <div className="status-chips">
          {combatant.statuses.length === 0 ? (
            <span className="muted">None</span>
          ) : (
            combatant.statuses.map((status) => {
              const isExhaustion = status.id === 'exhaustion';
              const exhaustionLevel = status.level ?? 1;
              return (
                <div
                  key={status.instanceId}
                  className={clsx('status-chip', { 'has-meta': isExhaustion })}
                  style={{ backgroundColor: status.color }}
                  title={status.note || status.description || status.label}
                >
                  <span className="icon">{status.icon}</span>
                  <span className="status-text">
                    {isExhaustion ? <span className="status-meta">Level: {exhaustionLevel}</span> : null}
                    <span>{status.label}</span>
                  </span>
                  {status.remainingRounds !== null ? <span className="rounds">{status.remainingRounds}</span> : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </article>
  );
};

export default ViewerCombatantCard;
