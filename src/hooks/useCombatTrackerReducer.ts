import { nanoid } from 'nanoid';
import {
  Combatant,
  CombatantType,
  CombatLogEntry,
  CombatLogEventType,
  DeathSaveState,
  DeathSaveStatus,
  EncounterState,
  StatusEffectInstance,
  StatusEffectTemplate
} from '../types';

export interface AddCombatantInput {
  name: string;
  type: CombatantType;
  initiative: number;
  maxHp: number;
  ac?: number;
  icon?: string;
  note?: string;
}

export interface UpdateCombatantInput {
  name?: string;
  initiative?: number;
  hp?: Partial<Combatant['hp']>;
  ac?: number;
  icon?: string;
  note?: string;
  deathSaves?: DeathSaveState | null;
}

export interface AttackActionInput {
  attackerId: string;
  targetId: string;
  amount: number;
  damageType: string;
}

export interface HealActionInput {
  targetId: string;
  amount: number;
  healingType: string;
}

export type TrackerAction =
  | { type: 'add-combatant'; payload: Combatant }
  | { type: 'remove-combatant'; payload: { id: string } }
  | { type: 'update-combatant'; payload: { id: string; changes: UpdateCombatantInput } }
  | { type: 'apply-delta'; payload: { id: string; delta: number } }
  | { type: 'attack'; payload: AttackActionInput }
  | { type: 'heal'; payload: HealActionInput }
  | { type: 'set-active'; payload: { id: string | null } }
  | { type: 'start-encounter' }
  | { type: 'advance' }
  | { type: 'rewind' }
  | { type: 'add-status'; payload: { id: string; status: StatusEffectInstance } }
  | { type: 'remove-status'; payload: { id: string; statusId: string } }
  | { type: 'clear-log' }
  | { type: 'start-death-saves'; payload: { id: string; round: number } }
  | { type: 'mark-dead'; payload: { id: string; round: number } }
  | { type: 'record-death-save'; payload: { id: string; result: 'success' | 'failure'; round: number } }
  | { type: 'set-death-save-counts'; payload: { id: string; successes: number; failures: number } }
  | { type: 'clear-death-saves'; payload: { id: string } }
  | { type: 'hydrate'; payload: EncounterState };

export type TrackerState = EncounterState;

const MAX_LOG_ENTRIES = 1000;

const appendLog = (log: CombatLogEntry[], entry: CombatLogEntry | null): CombatLogEntry[] => {
  if (!entry) return log;
  const next = [...log, entry];
  if (next.length <= MAX_LOG_ENTRIES) {
    return next;
  }
  return next.slice(next.length - MAX_LOG_ENTRIES);
};

const appendLogs = (log: CombatLogEntry[], entries: Array<CombatLogEntry | null | undefined>): CombatLogEntry[] =>
  entries.reduce((accumulator, entry) => appendLog(accumulator, entry ?? null), log);

const createLogEntry = (
  type: CombatLogEventType,
  message: string,
  round: number,
  extras?: Partial<Pick<CombatLogEntry, 'combatantId' | 'amount'>>
): CombatLogEntry => ({
  id: nanoid(10),
  type,
  message,
  round,
  timestamp: new Date().toISOString(),
  ...extras
});

const createZeroHpLog = (
  before: Combatant | undefined,
  after: Combatant | undefined,
  round: number
): CombatLogEntry | null => {
  if (!before || !after) return null;
  if (before.hp.current <= 0) return null;
  if (after.hp.current > 0) return null;

  const message =
    after.type === 'player' || after.type === 'ally'
      ? `${after.name} fell unconscious.`
      : `${after.name} was defeated.`;

  return createLogEntry('death', message, round, { combatantId: after.id });
};

export const sortCombatants = (combatants: Combatant[]) =>
  [...combatants].sort((a, b) => {
    if (b.initiative === a.initiative) {
      return a.name.localeCompare(b.name);
    }
    return b.initiative - a.initiative;
  });

const decrementStatusDurations = (
  combatants: Combatant[]
): {
  combatants: Combatant[];
  expiredStatuses: Array<{ ownerId: string; ownerName: string; status: StatusEffectInstance }>;
} => {
  const expiredStatuses: Array<{ ownerId: string; ownerName: string; status: StatusEffectInstance }> = [];
  const updatedCombatants = combatants.map((combatant) => {
    const nextStatuses: StatusEffectInstance[] = [];
    combatant.statuses.forEach((status) => {
      if (status.remainingRounds === null) {
        nextStatuses.push(status);
        return;
      }
      const next = status.remainingRounds - 1;
      if (next > 0) {
        nextStatuses.push({ ...status, remainingRounds: next });
      } else {
        expiredStatuses.push({ ownerId: combatant.id, ownerName: combatant.name, status });
      }
    });
    return {
      ...combatant,
      statuses: nextStatuses
    };
  });
  return {
    combatants: updatedCombatants,
    expiredStatuses
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createDeathSaveState = (round: number): DeathSaveState => ({
  status: 'pending',
  successes: 0,
  failures: 0,
  startedAtRound: round,
  lastRollRound: null
});

const sanitizeDeathSaves = (value: DeathSaveState | null | undefined): DeathSaveState | null => {
  if (!value) {
    return null;
  }
  let status: DeathSaveStatus;
  if (value.status === 'stable' || value.status === 'dead') {
    status = value.status;
  } else {
    status = 'pending';
  }
  const successes = clamp(Math.round(value.successes ?? 0), 0, 3);
  const failures = clamp(Math.round(value.failures ?? 0), 0, 3);
  const startedAtRound = clamp(Math.round(value.startedAtRound ?? 1), 1, Number.MAX_SAFE_INTEGER);
  const lastRollRound =
    typeof value.lastRollRound === 'number' && Number.isFinite(value.lastRollRound)
      ? clamp(Math.round(value.lastRollRound), 1, Number.MAX_SAFE_INTEGER)
      : null;
  let normalizedStatus: DeathSaveStatus = status;
  if (normalizedStatus === 'pending') {
    if (successes >= 3) {
      normalizedStatus = 'stable';
    } else if (failures >= 3) {
      normalizedStatus = 'dead';
    }
  }
  return {
    status: normalizedStatus,
    successes,
    failures,
    startedAtRound,
    lastRollRound
  };
};

const resolveDeathSavesAfterHpChange = (
  combatant: Combatant,
  nextHp: number,
  override: DeathSaveState | null | undefined
): DeathSaveState | null => {
  if (override !== undefined) {
    return sanitizeDeathSaves(override);
  }
  return nextHp > 0 ? null : combatant.deathSaves ?? null;
};

const isTurnEligible = (combatant: Combatant) => {
  if (combatant.hp.current > 0) {
    return true;
  }
  const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';
  if (!isPlayerOrAlly) {
    return false;
  }
  const deathStatus = combatant.deathSaves?.status ?? 'pending';
  return deathStatus !== 'dead';
};

interface HpUpdateInput {
  targetId: string;
  nextHp: number;
  round: number;
  nextMax?: number;
  overrideDeathSaves?: DeathSaveState | null | undefined;
  extraChanges?: (combatant: Combatant) => Partial<Combatant>;
}

interface HpUpdateResult {
  combatants: Combatant[];
  before: Combatant | null;
  after: Combatant | null;
  delta: number;
  zeroHpLog: CombatLogEntry | null;
  maxChanged: boolean;
}

const applyHpUpdate = (state: TrackerState, params: HpUpdateInput): HpUpdateResult => {
  const { targetId, nextHp, nextMax, round, overrideDeathSaves, extraChanges } = params;
  const before = state.combatants.find((candidate) => candidate.id === targetId) ?? null;
  if (!before) {
    return {
      combatants: state.combatants,
      before: null,
      after: null,
      delta: 0,
      zeroHpLog: null,
      maxChanged: false
    };
  }

  const additionalChanges = extraChanges ? extraChanges(before) : {};
  const resolvedMax = clamp(typeof nextMax === 'number' ? nextMax : before.hp.max, 0, Number.MAX_SAFE_INTEGER);
  const clampedHp = clamp(nextHp, 0, resolvedMax);
  const resolvedDeathSaves = resolveDeathSavesAfterHpChange(before, clampedHp, overrideDeathSaves);

  const after: Combatant = {
    ...before,
    ...additionalChanges,
    hp: {
      current: clampedHp,
      max: resolvedMax
    },
    deathSaves: resolvedDeathSaves
  };

  const combatants = state.combatants.map((combatant) => (combatant.id === before.id ? after : combatant));
  const zeroHpLog = createZeroHpLog(before, after, round);

  return {
    combatants,
    before,
    after,
    delta: clampedHp - before.hp.current,
    zeroHpLog,
    maxChanged: resolvedMax !== before.hp.max
  };
};

export const trackerReducer = (state: TrackerState, action: TrackerAction): TrackerState => {
  switch (action.type) {
    case 'hydrate': {
      const sanitized = action.payload.combatants.map((combatant) => ({
        ...combatant,
        statuses: combatant.statuses ?? [],
        deathSaves: sanitizeDeathSaves(combatant.deathSaves)
      }));
      const hydrated = {
        ...action.payload,
        combatants: sortCombatants(sanitized),
        log: Array.isArray(action.payload.log) ? action.payload.log : []
      };
      return hydrated;
    }
    case 'add-combatant': {
      const combatants = sortCombatants([...state.combatants, action.payload]);
      const encounterStarted = Boolean(state.startedAt);
      const activeCombatantId = encounterStarted ? state.activeCombatantId ?? combatants[0]?.id ?? null : combatants[0]?.id ?? null;
      const entry = createLogEntry(
        'combatant-add',
        `${action.payload.name} joined the encounter.`,
        state.round,
        { combatantId: action.payload.id }
      );
      return {
        ...state,
        combatants,
        activeCombatantId,
        log: appendLog(state.log, entry)
      };
    }
    case 'remove-combatant': {
      const combatants = state.combatants.filter((c) => c.id !== action.payload.id);
      let { activeCombatantId } = state;
      if (activeCombatantId === action.payload.id) {
        activeCombatantId = combatants[0]?.id ?? null;
      }
      const removed = state.combatants.find((combatant) => combatant.id === action.payload.id);
      const entry = removed
        ? createLogEntry('combatant-remove', `${removed.name} left the encounter.`, state.round, {
            combatantId: removed.id
          })
        : null;
      return {
        ...state,
        combatants,
        activeCombatantId,
        log: appendLog(state.log, entry)
      };
    }
    case 'update-combatant': {
      const { id, changes } = action.payload;
      const targetBefore = state.combatants.find((combatant) => combatant.id === id);
      if (!targetBefore) {
        return state;
      }

      const { hp: hpChanges, deathSaves: deathSavesOverride, ...otherChanges } = changes;
      const hasExplicitCurrent =
        hpChanges && Object.prototype.hasOwnProperty.call(hpChanges, 'current');
      const requestedCurrent = hasExplicitCurrent
        ? hpChanges?.current ?? targetBefore.hp.current
        : targetBefore.hp.current;
      const proposedMax = hpChanges?.max ?? targetBefore.hp.max;
      const nextMax = clamp(proposedMax, 0, Number.MAX_SAFE_INTEGER);
      const nextCurrent = clamp(requestedCurrent ?? targetBefore.hp.current, 0, nextMax);

      const result = applyHpUpdate(state, {
        targetId: id,
        nextHp: nextCurrent,
        nextMax,
        round: state.round,
        overrideDeathSaves: deathSavesOverride,
        extraChanges: () => otherChanges
      });

      const combatants = sortCombatants(result.combatants);
      const targetAfter = combatants.find((combatant) => combatant.id === id);
      let logEntry: CombatLogEntry | null = null;

      if (result.before && targetAfter) {
        const explicitHpChange = typeof hpChanges?.current === 'number';
        const maxWasUpdated = typeof hpChanges?.max === 'number';
        const hpChange = explicitHpChange || maxWasUpdated ? result.delta : 0;

        if (hpChange > 0) {
          logEntry = createLogEntry(
            'heal',
            `${targetAfter.name} regained ${hpChange} HP (${targetAfter.hp.current}/${targetAfter.hp.max}).`,
            state.round,
            {
              combatantId: targetAfter.id,
              amount: hpChange
            }
          );
        } else if (hpChange < 0) {
          const clampedToMax =
            maxWasUpdated &&
            !explicitHpChange &&
            targetAfter.hp.current === targetAfter.hp.max &&
            targetAfter.hp.max < result.before.hp.max;
          if (clampedToMax) {
            logEntry = createLogEntry(
              'info',
              `${targetAfter.name}'s HP capped at new maximum (${targetAfter.hp.max}).`,
              state.round,
              { combatantId: targetAfter.id }
            );
          } else {
            logEntry = createLogEntry(
              'damage',
              `${targetAfter.name} took ${Math.abs(hpChange)} damage (${targetAfter.hp.current}/${targetAfter.hp.max}).`,
              state.round,
              {
                combatantId: targetAfter.id,
                amount: Math.abs(hpChange)
              }
            );
          }
        } else if (
          changes.initiative !== undefined ||
          changes.ac !== undefined ||
          changes.note !== undefined ||
          changes.icon !== undefined ||
          changes.name !== undefined ||
          maxWasUpdated
        ) {
          logEntry = createLogEntry('info', `${targetAfter.name}'s details were updated.`, state.round, {
            combatantId: targetAfter.id
          });
        }
      }

      return {
        ...state,
        combatants,
        log: appendLogs(state.log, [logEntry, result.zeroHpLog])
      };
    }
    case 'apply-delta': {
      const { id, delta } = action.payload;
      const targetBefore = state.combatants.find((combatant) => combatant.id === id);
      if (!targetBefore) {
        return state;
      }

      const nextHp = Math.max(0, Math.min(targetBefore.hp.max, targetBefore.hp.current - delta));
      const result = applyHpUpdate(state, {
        targetId: id,
        nextHp,
        round: state.round
      });

      let logEntry: CombatLogEntry | null = null;
      if (result.before && result.after) {
        const amountChanged = Math.abs(result.delta);
        if (amountChanged > 0) {
          if (delta > 0) {
            logEntry = createLogEntry(
              'damage',
              `${result.after.name} took ${amountChanged} damage (${result.after.hp.current}/${result.after.hp.max}).`,
              state.round,
              { combatantId: result.after.id, amount: amountChanged }
            );
          } else {
            logEntry = createLogEntry(
              'heal',
              `${result.after.name} regained ${amountChanged} HP (${result.after.hp.current}/${result.after.hp.max}).`,
              state.round,
              { combatantId: result.after.id, amount: amountChanged }
            );
          }
        }
      }

      return {
        ...state,
        combatants: result.combatants,
        log: appendLogs(state.log, [logEntry, result.zeroHpLog])
      };
    }
    case 'attack': {
      const attacker = state.combatants.find((combatant) => combatant.id === action.payload.attackerId);
      const target = state.combatants.find((combatant) => combatant.id === action.payload.targetId);
      if (!target) {
        return state;
      }
      const sanitizedAmount = Number.isFinite(action.payload.amount) ? Math.max(0, Math.round(action.payload.amount)) : 0;
      const appliedDamage = Math.min(target.hp.current, sanitizedAmount);
      const nextHp = target.hp.current - appliedDamage;
      const result = applyHpUpdate(state, {
        targetId: target.id,
        nextHp,
        round: state.round
      });
      const attackerName = attacker ? attacker.name : 'Unknown attacker';
      const targetAfter = result.after ?? target;
      const damageType = action.payload.damageType.trim();
      const damageLabel =
        damageType && damageType.toLowerCase().endsWith('damage') ? damageType : damageType ? `${damageType} damage` : 'damage';
      const logEntry =
        appliedDamage > 0
          ? createLogEntry(
              'attack',
              `${attackerName} dealt ${appliedDamage} ${damageLabel} to ${targetAfter.name} (${targetAfter.hp.current}/${targetAfter.hp.max}).`,
              state.round,
              {
                combatantId: targetAfter.id,
                amount: appliedDamage
              }
            )
          : null;
      return {
        ...state,
        combatants: result.combatants,
        log: appendLogs(state.log, [logEntry, result.zeroHpLog])
      };
    }
    case 'heal': {
      const target = state.combatants.find((combatant) => combatant.id === action.payload.targetId);
      if (!target) {
        return state;
      }
      const sanitizedAmount = Number.isFinite(action.payload.amount) ? Math.max(0, Math.round(action.payload.amount)) : 0;
      const missingHp = Math.max(0, target.hp.max - target.hp.current);
      const appliedHealing = Math.min(missingHp, sanitizedAmount);
      const nextHp = Math.min(target.hp.max, target.hp.current + appliedHealing);
      const result = applyHpUpdate(state, {
        targetId: target.id,
        nextHp,
        round: state.round
      });
      const targetAfter = result.after ?? target;
      const healingType = action.payload.healingType.trim();
      const healingSuffix = healingType ? ` via ${healingType}` : '';
      const logEntry =
        appliedHealing > 0
          ? createLogEntry(
              'heal',
              `${targetAfter.name} regained ${appliedHealing} HP${healingSuffix} (${targetAfter.hp.current}/${targetAfter.hp.max}).`,
              state.round,
              {
                combatantId: targetAfter.id,
                amount: appliedHealing
              }
            )
          : null;
      return {
        ...state,
        combatants: result.combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'set-active':
      return {
        ...state,
        activeCombatantId: action.payload.id
      };
    case 'start-encounter': {
      if (state.combatants.length === 0) {
        return state;
      }
      const combatants = sortCombatants(state.combatants);
      const first = combatants[0] ?? null;
      const entry = first
        ? createLogEntry(
            'turn',
            `Encounter started. ${first.name} is up first.`,
            state.round,
            { combatantId: first.id }
          )
        : null;
      return {
        ...state,
        combatants,
        activeCombatantId: first?.id ?? null,
        startedAt: state.startedAt ?? new Date().toISOString(),
        log: appendLog(state.log, entry)
      };
    }
    case 'advance': {
      if (state.combatants.length === 0) return state;
      const sorted = sortCombatants(state.combatants);
      const currentIndex = sorted.findIndex((combatant) => combatant.id === state.activeCombatantId);
      const aliveIndices = sorted.reduce<number[]>((indices, combatant, index) => {
        if (isTurnEligible(combatant)) {
          indices.push(index);
        }
        return indices;
      }, []);
      let nextIndex: number;
      if (aliveIndices.length > 0) {
        if (currentIndex === -1) {
          nextIndex = aliveIndices[0];
        } else {
          const nextAlive = aliveIndices.find((index) => index > currentIndex);
          if (nextAlive === undefined) {
            nextIndex = aliveIndices[0];
          } else {
            nextIndex = nextAlive;
          }
        }
      } else {
        nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % sorted.length;
      }
      const wrapped = currentIndex !== -1 && nextIndex <= currentIndex;
      const decrementResult = wrapped
        ? decrementStatusDurations(sorted)
        : {
            combatants: sorted,
            expiredStatuses: [] as Array<{ ownerId: string; ownerName: string; status: StatusEffectInstance }>
          };
      const { combatants, expiredStatuses } = decrementResult;
      const nextRound = wrapped ? state.round + 1 : state.round;
      const nextCombatant = combatants[nextIndex];
      const statusExpirationEntries = expiredStatuses.map((item) =>
        createLogEntry(
          'status-remove',
          `${item.status.icon} ${item.status.label} expired from ${item.ownerName}.`,
          nextRound,
          { combatantId: item.ownerId }
        )
      );
      const entry = nextCombatant
        ? createLogEntry(
            'turn',
            `Turn advanced to ${nextCombatant.name}${wrapped ? ` — Round ${nextRound}` : ''}.`,
            nextRound,
            { combatantId: nextCombatant.id }
          )
        : null;
      return {
        combatants,
        activeCombatantId: combatants[nextIndex]?.id ?? null,
        round: nextRound,
        startedAt: state.startedAt ?? new Date().toISOString(),
        log: appendLogs(state.log, [...statusExpirationEntries, entry])
      };
    }
    case 'rewind': {
      if (state.combatants.length === 0) return state;
      const sorted = sortCombatants(state.combatants);
      const currentIndex = sorted.findIndex((combatant) => combatant.id === state.activeCombatantId);
      const aliveIndices = sorted.reduce<number[]>((indices, combatant, index) => {
        if (isTurnEligible(combatant)) {
          indices.push(index);
        }
        return indices;
      }, []);
      let nextIndex: number;
      let wrapped = false;
      if (aliveIndices.length > 0) {
        if (currentIndex === -1) {
          nextIndex = aliveIndices[aliveIndices.length - 1];
        } else {
          const previousAliveCandidates = aliveIndices.filter((index) => index < currentIndex);
          if (previousAliveCandidates.length === 0) {
            nextIndex = aliveIndices[aliveIndices.length - 1];
            wrapped = true;
          } else {
            nextIndex = previousAliveCandidates[previousAliveCandidates.length - 1];
          }
        }
      } else {
        nextIndex =
          currentIndex === -1 ? sorted.length - 1 : (currentIndex - 1 + sorted.length) % sorted.length;
        wrapped = currentIndex !== -1 && currentIndex === 0;
      }
      const nextRound = wrapped && state.round > 1 ? state.round - 1 : state.round;
      const nextCombatant = sorted[nextIndex];
      const entry = nextCombatant
        ? createLogEntry(
            'turn',
            `Rewound turn to ${nextCombatant.name}${wrapped ? ` — Round ${nextRound}` : ''}.`,
            nextRound,
            { combatantId: nextCombatant.id }
          )
        : null;
      return {
        ...state,
        combatants: sorted,
        activeCombatantId: sorted[nextIndex]?.id ?? null,
        round: nextRound,
        log: appendLog(state.log, entry)
      };
    }
    case 'add-status': {
      const ownerIndex = state.combatants.findIndex((combatant) => combatant.id === action.payload.id);
      if (ownerIndex === -1) {
        return state;
      }
      const owner = state.combatants[ownerIndex];
      const incomingStatus = action.payload.status;
      let updatedStatuses: StatusEffectInstance[];
      let logMessage: string | null = null;

      if (incomingStatus.id === 'exhaustion') {
        const existing = owner.statuses.find((status) => status.id === 'exhaustion');
        if (existing) {
          const nextLevel = (existing.level ?? 1) + 1;
          const mergedStatus: StatusEffectInstance = {
            ...existing,
            level: nextLevel,
            remainingRounds: incomingStatus.remainingRounds ?? existing.remainingRounds,
            note: incomingStatus.note ?? existing.note
          };
          updatedStatuses = owner.statuses.map((status) =>
            status.instanceId === existing.instanceId ? mergedStatus : status
          );
          logMessage = `${owner.name}'s ${incomingStatus.icon} ${incomingStatus.label} increased to Level ${nextLevel}.`;
        } else {
          const initialStatus: StatusEffectInstance = {
            ...incomingStatus,
            level: 1
          };
          updatedStatuses = [...owner.statuses, initialStatus];
          logMessage = `${owner.name} gained ${incomingStatus.icon} ${incomingStatus.label} (Level 1).`;
        }
      } else {
        updatedStatuses = [...owner.statuses, incomingStatus];
        logMessage = `${owner.name} gained ${incomingStatus.icon} ${incomingStatus.label}${
          incomingStatus.remainingRounds !== null ? ` (${incomingStatus.remainingRounds} rounds)` : ''
        }.`;
      }

      const combatants = state.combatants.map((combatant, index) =>
        index === ownerIndex
          ? {
              ...combatant,
              statuses: updatedStatuses
            }
          : combatant
      );

      const entry =
        logMessage !== null
          ? createLogEntry('status-add', logMessage, state.round, {
              combatantId: owner.id
            })
          : null;

      return {
        ...state,
        combatants,
        log: appendLog(state.log, entry)
      };
    }
    case 'remove-status': {
      const owner = state.combatants.find((combatant) => combatant.id === action.payload.id);
      const removedStatus = owner?.statuses.find((status) => status.instanceId === action.payload.statusId);
      const combatants = state.combatants.map((combatant) =>
        combatant.id === action.payload.id
          ? {
              ...combatant,
              statuses: combatant.statuses.filter((status) => status.instanceId !== action.payload.statusId)
            }
          : combatant
      );
      const entry =
        owner && removedStatus
          ? createLogEntry(
              'status-remove',
              `${removedStatus.icon} ${removedStatus.label} was removed from ${owner.name}.`,
              state.round,
              { combatantId: owner.id }
            )
          : null;
      return {
        ...state,
        combatants,
        log: appendLog(state.log, entry)
      };
    }
    case 'start-death-saves': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map<Combatant>((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        if (combatant.deathSaves?.status === 'pending' || combatant.deathSaves?.status === 'dead') {
          return combatant;
        }
        logEntry = createLogEntry(
          'info',
          `${combatant.name} is making death saving throws.`,
          state.round,
          { combatantId: combatant.id }
        );
        return {
          ...combatant,
          deathSaves: createDeathSaveState(action.payload.round)
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'mark-dead': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map<Combatant>((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        if (combatant.deathSaves?.status === 'dead') {
          return combatant;
        }
        const startedAtRound = combatant.deathSaves?.startedAtRound ?? action.payload.round;
        const updatedDeathSaves: DeathSaveState = {
          status: 'dead',
          successes: 0,
          failures: 3,
          startedAtRound,
          lastRollRound: action.payload.round
        };
        logEntry = createLogEntry('death', `${combatant.name} has died.`, state.round, {
          combatantId: combatant.id
        });
        return {
          ...combatant,
          deathSaves: updatedDeathSaves
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'record-death-save': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map<Combatant>((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        const current = combatant.deathSaves;
        if (!current) {
          return combatant;
        }
        const previousStatus = current.status;
        if (previousStatus === 'dead' || previousStatus === 'stable') {
          return combatant;
        }
        let successes = current.successes;
        let failures = current.failures;
        if (action.payload.result === 'success') {
          successes = clamp(successes + 1, 0, 3);
        } else {
          failures = clamp(failures + 1, 0, 3);
        }
        let status: DeathSaveStatus;
        if (failures >= 3) {
          status = 'dead';
        } else if (successes >= 3) {
          status = 'stable';
        } else {
          status = 'pending';
        }
        const updated: DeathSaveState = {
          status,
          successes,
          failures,
          startedAtRound: current.startedAtRound,
          lastRollRound: action.payload.round
        };
        let nextDeathSaves: DeathSaveState | null = updated;
        let nextHp = combatant.hp;
        if (status === 'dead') {
          logEntry = createLogEntry(
            'death',
            `${combatant.name} succumbed to their wounds.`,
            state.round,
            { combatantId: combatant.id }
          );
        } else if (status === 'stable') {
          const revivedHp =
            combatant.hp.max > 0
              ? Math.min(combatant.hp.max, Math.max(1, combatant.hp.current))
              : 1;
          if (revivedHp !== combatant.hp.current) {
            nextHp = {
              ...combatant.hp,
              current: revivedHp
            };
          }
          nextDeathSaves = null;
          logEntry = createLogEntry(
            'info',
            `${combatant.name} stabilized and regained consciousness (1 HP).`,
            state.round,
            { combatantId: combatant.id }
          );
        } else {
          const message =
            action.payload.result === 'success'
              ? `${combatant.name} succeeded on a death saving throw (${successes}/3).`
              : `${combatant.name} failed a death saving throw (${failures}/3).`;
          logEntry = createLogEntry('info', message, state.round, { combatantId: combatant.id });
        }
        return {
          ...combatant,
          hp: nextHp,
          deathSaves: nextDeathSaves
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'set-death-save-counts': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map<Combatant>((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        const previousStatus = combatant.deathSaves?.status ?? null;
        const successes = clamp(Math.round(action.payload.successes), 0, 3);
        const failures = clamp(Math.round(action.payload.failures), 0, 3);
        let status: DeathSaveStatus;
        if (failures >= 3) {
          status = 'dead';
        } else if (successes >= 3) {
          status = 'stable';
        } else {
          status = 'pending';
        }
        const startedAtRound = combatant.deathSaves?.startedAtRound ?? state.round;
        const lastRollRound = successes === 0 && failures === 0 ? null : combatant.deathSaves?.lastRollRound ?? null;
        const updated: DeathSaveState = {
          status,
          successes,
          failures,
          startedAtRound,
          lastRollRound
        };
        let nextDeathSaves: DeathSaveState | null = updated;
        let nextHp = combatant.hp;
        if (status === 'dead' && combatant.deathSaves?.status !== 'dead') {
          logEntry = createLogEntry(
            'death',
            `${combatant.name} has died.`,
            state.round,
            { combatantId: combatant.id }
          );
        } else if (status === 'stable' && previousStatus !== 'stable') {
          const revivedHp =
            combatant.hp.max > 0
              ? Math.min(combatant.hp.max, Math.max(1, combatant.hp.current))
              : 1;
          if (revivedHp !== combatant.hp.current) {
            nextHp = {
              ...combatant.hp,
              current: revivedHp
            };
          }
          nextDeathSaves = null;
          logEntry = createLogEntry(
            'info',
            `${combatant.name} stabilized and regained consciousness (1 HP).`,
            state.round,
            { combatantId: combatant.id }
          );
        } else if (status === 'pending' && previousStatus !== 'pending') {
          logEntry = createLogEntry(
            'info',
            `${combatant.name} is making death saving throws.`,
            state.round,
            { combatantId: combatant.id }
          );
        }
        return {
          ...combatant,
          hp: nextHp,
          deathSaves: nextDeathSaves
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'clear-death-saves': {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === action.payload.id
          ? {
              ...combatant,
              deathSaves: null
            }
          : combatant
      );
      return {
        ...state,
        combatants
      };
    }
    case 'clear-log':
      if (state.log.length === 0) {
        return state;
      }
      return {
        ...state,
        log: []
      };
    default:
      return state;
  }
};

export const defaultEncounter = (): EncounterState => ({
  combatants: [],
  activeCombatantId: null,
  round: 1,
  log: []
});
