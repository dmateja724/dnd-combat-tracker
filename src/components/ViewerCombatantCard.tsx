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
  const deathSaves = combatant.deathSaves ?? null;
  const deathSaveStatus = deathSaves?.status ?? null;
  const isDeathSavesActive = !!deathSaves;
  const showHealthValues = combatant.type !== 'enemy';
  const showHpSection = !isDeathSavesActive;
  const healthPercent = combatant.hp.max === 0 ? 0 : Math.round((combatant.hp.current / combatant.hp.max) * 100);
  const hpWidth = Math.max(0, Math.min(healthPercent, 100)) + '%';
  const isDefeated = combatant.hp.current <= 0;
  const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';
  const showDeathOverlay = isPlayerOrAlly && deathSaveStatus === 'dead';

  return (
    <article
      className={clsx('combatant-card viewer-card', 'is-' + combatant.type, {
        active: isActive,
        defeated: isDefeated
      })}
    >
      {showDeathOverlay ? (
        <div className="death-overlay" aria-hidden="true">
          <span className="death-overlay-text">YOU DIED</span>
        </div>
      ) : null}
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

      {showHpSection ? (
        <section className="hp-block viewer-hp-block">
          {showHealthValues ? (
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
      ) : null}

      {deathSaves ? (
        <section className="viewer-death-saves">
          <div className="death-saves-head">
            <h4>Death Saves</h4>
            {deathSaveStatus === 'stable' ? (
              <span className="death-saves-pill stable">Stable</span>
            ) : deathSaveStatus === 'dead' ? (
              <span className="death-saves-pill dead">Dead</span>
            ) : null}
          </div>
          <div className="death-saves-tracks">
            <div className="death-saves-track">
              <span className="death-saves-label">Successes</span>
              <div className="death-saves-chips">
                {[0, 1, 2].map((slot) => (
                  <span
                    key={'viewer-success-' + slot}
                    className={clsx('death-save-chip', 'success', { filled: slot < (deathSaves?.successes ?? 0), readonly: true })}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
            <div className="death-saves-track">
              <span className="death-saves-label">Failures</span>
              <div className="death-saves-chips">
                {[0, 1, 2].map((slot) => (
                  <span
                    key={'viewer-failure-' + slot}
                    className={clsx('death-save-chip', 'failure', { filled: slot < (deathSaves?.failures ?? 0), readonly: true })}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
