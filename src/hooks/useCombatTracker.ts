import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { STATUS_EFFECT_LIBRARY } from '../data/statusEffects';
import { COMBATANT_ICON_LIBRARY } from '../data/combatantIcons';
import { loadEncounter, saveEncounter } from '../data/encounterDb';

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

type TrackerAction =
  | { type: 'add-combatant'; payload: Combatant }
  | { type: 'remove-combatant'; payload: { id: string } }
  | { type: 'update-combatant'; payload: { id: string; changes: UpdateCombatantInput } }
  | { type: 'apply-delta'; payload: { id: string; delta: number } }
  | { type: 'attack'; payload: AttackActionInput }
  | { type: 'heal'; payload: HealActionInput }
  | { type: 'set-active'; payload: { id: string | null } }
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

type TrackerState = EncounterState;

interface TrackerBroadcastMessage {
  type: 'hydrate';
  payload: EncounterState;
  source: string;
}

const BROADCAST_CHANNEL_PREFIX = 'combat-tracker:encounter:';

const MAX_LOG_ENTRIES = 250;

const appendLog = (log: CombatLogEntry[], entry: CombatLogEntry | null): CombatLogEntry[] => {
  if (!entry) return log;
  const next = [...log, entry];
  if (next.length <= MAX_LOG_ENTRIES) {
    return next;
  }
  return next.slice(next.length - MAX_LOG_ENTRIES);
};

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

const sortCombatants = (combatants: Combatant[]) =>
  [...combatants].sort((a, b) => {
    if (b.initiative === a.initiative) {
      return a.name.localeCompare(b.name);
    }
    return b.initiative - a.initiative;
  });

const decrementStatusDurations = (combatants: Combatant[]) =>
  combatants.map((combatant) => ({
    ...combatant,
    statuses: combatant.statuses
      .map((status) => {
        if (status.remainingRounds === null) {
          return status;
        }
        const next = status.remainingRounds - 1;
        return { ...status, remainingRounds: next };
      })
      .filter((status) => status.remainingRounds === null || status.remainingRounds > 0)
  }));

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

const trackerReducer = (state: TrackerState, action: TrackerAction): TrackerState => {
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
      const activeCombatantId = combatants.length === 1 ? combatants[0].id : state.activeCombatantId;
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
      let logEntry: CombatLogEntry | null = null;
      const combatants = sortCombatants(
        state.combatants.map((combatant) => {
          if (combatant.id !== action.payload.id) {
            return combatant;
          }
          const changes = action.payload.changes;
          const nextMax = clamp(changes.hp?.max ?? combatant.hp.max, 0, Number.MAX_SAFE_INTEGER);
          const hasExplicitCurrent =
            changes.hp && Object.prototype.hasOwnProperty.call(changes.hp, 'current');
          const requestedCurrent = hasExplicitCurrent
            ? changes.hp?.current ?? combatant.hp.current
            : combatant.hp.current;
          const nextCurrent = clamp(requestedCurrent ?? combatant.hp.current, 0, nextMax);
          const nextDeathSaves = resolveDeathSavesAfterHpChange(combatant, nextCurrent, changes.deathSaves);
          return {
            ...combatant,
            ...changes,
            hp: {
              current: nextCurrent,
              max: nextMax
            },
            deathSaves: nextDeathSaves
          };
        })
      );
      const targetBefore = state.combatants.find((combatant) => combatant.id === action.payload.id);
      const targetAfter = combatants.find((combatant) => combatant.id === action.payload.id);
      if (targetBefore && targetAfter) {
        const explicitHpChange = typeof action.payload.changes.hp?.current === 'number';
        const maxWasUpdated = typeof action.payload.changes.hp?.max === 'number';
        const hpChange =
          explicitHpChange || maxWasUpdated
            ? targetAfter.hp.current - targetBefore.hp.current
            : 0;
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
            targetAfter.hp.max < targetBefore.hp.max;
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
          action.payload.changes.initiative !== undefined ||
          action.payload.changes.ac !== undefined ||
          action.payload.changes.note !== undefined ||
          action.payload.changes.icon !== undefined ||
          action.payload.changes.name !== undefined ||
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
        log: appendLog(state.log, logEntry)
      };
    }
    case 'apply-delta': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) return combatant;
        const next = Math.max(0, Math.min(combatant.hp.max, combatant.hp.current - action.payload.delta));
        const amountChanged = Math.abs(next - combatant.hp.current);
        if (amountChanged > 0) {
          if (action.payload.delta > 0) {
            logEntry = createLogEntry(
              'damage',
              `${combatant.name} took ${amountChanged} damage (${next}/${combatant.hp.max}).`,
              state.round,
              { combatantId: combatant.id, amount: amountChanged }
            );
          } else {
            logEntry = createLogEntry(
              'heal',
              `${combatant.name} regained ${amountChanged} HP (${next}/${combatant.hp.max}).`,
              state.round,
              { combatantId: combatant.id, amount: amountChanged }
            );
          }
        }
        return {
          ...combatant,
          hp: {
            ...combatant.hp,
            current: next
          },
          deathSaves: resolveDeathSavesAfterHpChange(combatant, next, undefined)
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
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
      const combatants =
        appliedDamage > 0
          ? state.combatants.map((combatant) =>
              combatant.id === target.id
                ? {
                    ...combatant,
                    hp: {
                      ...combatant.hp,
                      current: nextHp
                    },
                    deathSaves: resolveDeathSavesAfterHpChange(combatant, nextHp, undefined)
                  }
                : combatant
            )
          : state.combatants;
      const attackerName = attacker ? attacker.name : 'Unknown attacker';
      const targetName = target.name;
      const damageType = action.payload.damageType.trim();
      const damageLabel =
        damageType && damageType.toLowerCase().endsWith('damage') ? damageType : damageType ? `${damageType} damage` : 'damage';
      const logEntry = createLogEntry(
        'attack',
        `${attackerName} dealt ${appliedDamage} ${damageLabel} to ${targetName} (${nextHp}/${target.hp.max}).`,
        state.round,
        {
          combatantId: target.id,
          amount: appliedDamage
        }
      );
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
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
      const combatants =
        appliedHealing > 0
          ? state.combatants.map((combatant) =>
              combatant.id === target.id
                ? {
                    ...combatant,
                    hp: {
                      ...combatant.hp,
                      current: nextHp
                    },
                    deathSaves: resolveDeathSavesAfterHpChange(combatant, nextHp, undefined)
                  }
                : combatant
            )
          : state.combatants;
      const targetName = target.name;
      const healingType = action.payload.healingType.trim();
      const healingSuffix = healingType ? ` via ${healingType}` : '';
      const logEntry = createLogEntry(
        'heal',
        `${targetName} regained ${appliedHealing} HP${healingSuffix} (${nextHp}/${target.hp.max}).`,
        state.round,
        {
          combatantId: target.id,
          amount: appliedHealing
        }
      );
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'set-active':
      return {
        ...state,
        activeCombatantId: action.payload.id
      };
    case 'advance': {
      if (state.combatants.length === 0) return state;
      const sorted = sortCombatants(state.combatants);
      const currentIndex = sorted.findIndex((combatant) => combatant.id === state.activeCombatantId);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % sorted.length;
      const wrapped = currentIndex !== -1 && nextIndex === 0;
      const combatants = wrapped ? decrementStatusDurations(sorted) : sorted;
      const nextRound = wrapped ? state.round + 1 : state.round;
      const nextCombatant = combatants[nextIndex];
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
        log: appendLog(state.log, entry)
      };
    }
    case 'rewind': {
      if (state.combatants.length === 0) return state;
      const sorted = sortCombatants(state.combatants);
      const currentIndex = sorted.findIndex((combatant) => combatant.id === state.activeCombatantId);
      const nextIndex = currentIndex === -1 ? sorted.length - 1 : (currentIndex - 1 + sorted.length) % sorted.length;
      const wrapped = currentIndex !== -1 && currentIndex === 0;
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
      let startedCombatant: Combatant | null = null;
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        if (combatant.deathSaves?.status === 'pending' || combatant.deathSaves?.status === 'dead') {
          return combatant;
        }
        startedCombatant = combatant;
        return {
          ...combatant,
          deathSaves: createDeathSaveState(action.payload.round)
        };
      });
      const entry =
        startedCombatant !== null
          ? createLogEntry(
              'info',
              `${startedCombatant.name} is making death saving throws.`,
              state.round,
              { combatantId: startedCombatant.id }
            )
          : null;
      return {
        ...state,
        combatants,
        log: appendLog(state.log, entry)
      };
    }
    case 'mark-dead': {
      let markedCombatant: Combatant | null = null;
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        if (combatant.deathSaves?.status === 'dead') {
          return combatant;
        }
        markedCombatant = combatant;
        const startedAtRound = combatant.deathSaves?.startedAtRound ?? action.payload.round;
        return {
          ...combatant,
          deathSaves: {
            status: 'dead',
            successes: 0,
            failures: 3,
            startedAtRound,
            lastRollRound: action.payload.round
          }
        };
      });
      const entry =
        markedCombatant !== null
          ? createLogEntry('info', `${markedCombatant.name} has died.`, state.round, {
              combatantId: markedCombatant.id
            })
          : null;
      return {
        ...state,
        combatants,
        log: appendLog(state.log, entry)
      };
    }
    case 'record-death-save': {
      let logEntry: CombatLogEntry | null = null;
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
        const current = combatant.deathSaves;
        if (!current || current.status === 'dead' || current.status === 'stable') {
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
        if (status === 'dead' && current.status !== 'dead') {
          logEntry = createLogEntry(
            'info',
            `${combatant.name} succumbed to their wounds.`,
            state.round,
            { combatantId: combatant.id }
          );
        } else if (status === 'stable' && current.status !== 'stable') {
          logEntry = createLogEntry(
            'info',
            `${combatant.name} stabilized at 0 HP.`,
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
          deathSaves: updated
        };
      });
      return {
        ...state,
        combatants,
        log: appendLog(state.log, logEntry)
      };
    }
    case 'set-death-save-counts': {
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) {
          return combatant;
        }
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
        return {
          ...combatant,
          deathSaves: {
            status,
            successes,
            failures,
            startedAtRound,
            lastRollRound
          }
        };
      });
      return {
        ...state,
        combatants
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

const fallbackIcons = COMBATANT_ICON_LIBRARY.map((item) => item.icon);

const defaultEncounter = (): EncounterState => ({
  combatants: [],
  activeCombatantId: null,
  round: 1,
  log: []
});

export const useCombatTracker = (encounterId: string | null) => {
  const initialEncounterRef = useRef<EncounterState | null>(null);
  if (!initialEncounterRef.current) {
    initialEncounterRef.current = defaultEncounter();
  }

  const [state, dispatch] = useReducer(trackerReducer, initialEncounterRef.current);
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    instanceIdRef.current = nanoid(6);
  }
  const channelRef = useRef<BroadcastChannel | null>(null);
  const skipSaveRef = useRef(false);
  const skipBroadcastRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      if (!encounterId) {
        hasHydratedRef.current = true;
        setIsHydrating(false);
        dispatch({ type: 'hydrate', payload: defaultEncounter() });
        return;
      }

      hasHydratedRef.current = false;
      setIsHydrating(true);

      const stored = await loadEncounter(encounterId);
      if (isCancelled) return;
      hasHydratedRef.current = true;
      setIsHydrating(false);
      dispatch({ type: 'hydrate', payload: stored ?? defaultEncounter() });
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [encounterId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!('BroadcastChannel' in window)) {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      return;
    }
    if (!encounterId) {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      return;
    }

    const channelName = BROADCAST_CHANNEL_PREFIX + encounterId;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<TrackerBroadcastMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type !== 'hydrate') return;
      if (message.source === instanceIdRef.current) return;
      skipSaveRef.current = true;
      skipBroadcastRef.current = true;
      dispatch({ type: 'hydrate', payload: message.payload });
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [encounterId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (!encounterId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    void saveEncounter(encounterId, state);
  }, [encounterId, state]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (!encounterId) return;
    if (skipBroadcastRef.current) {
      skipBroadcastRef.current = false;
      return;
    }
    const channel = channelRef.current;
    if (!channel) return;
    try {
      const message: TrackerBroadcastMessage = {
        type: 'hydrate',
        payload: state,
        source: instanceIdRef.current
      };
      channel.postMessage(message);
    } catch (error) {
      console.warn('Failed to broadcast encounter update', error);
    }
  }, [encounterId, state]);

  const addCombatant = useCallback((input: AddCombatantInput) => {
    const combatant: Combatant = {
      id: nanoid(8),
      name: input.name,
      type: input.type,
      initiative: input.initiative,
      hp: {
        current: input.maxHp,
        max: input.maxHp
      },
      ac: input.ac,
      icon: input.icon ?? fallbackIcons[Math.floor(Math.random() * fallbackIcons.length)],
      statuses: [],
      note: input.note,
      deathSaves: null
    };
    dispatch({ type: 'add-combatant', payload: combatant });
  }, []);

  const removeCombatant = useCallback((id: string) => {
    dispatch({ type: 'remove-combatant', payload: { id } });
  }, []);

  const updateCombatant = useCallback((id: string, changes: UpdateCombatantInput) => {
    dispatch({ type: 'update-combatant', payload: { id, changes } });
  }, []);

  const applyDelta = useCallback((id: string, delta: number) => {
    dispatch({ type: 'apply-delta', payload: { id, delta } });
  }, []);

  const recordAttack = useCallback((input: AttackActionInput) => {
    dispatch({ type: 'attack', payload: input });
  }, []);

  const recordHeal = useCallback((input: HealActionInput) => {
    dispatch({ type: 'heal', payload: input });
  }, []);

  const startDeathSaves = useCallback((id: string, round: number) => {
    dispatch({ type: 'start-death-saves', payload: { id, round } });
  }, []);

  const markCombatantDead = useCallback((id: string, round: number) => {
    dispatch({ type: 'mark-dead', payload: { id, round } });
  }, []);

  const recordDeathSaveResult = useCallback((id: string, result: 'success' | 'failure', round: number) => {
    dispatch({ type: 'record-death-save', payload: { id, result, round } });
  }, []);

  const setDeathSaveCounts = useCallback((id: string, successes: number, failures: number) => {
    dispatch({ type: 'set-death-save-counts', payload: { id, successes, failures } });
  }, []);

  const clearDeathSaves = useCallback((id: string) => {
    dispatch({ type: 'clear-death-saves', payload: { id } });
  }, []);

  const setActiveCombatant = useCallback((id: string) => {
    dispatch({ type: 'set-active', payload: { id } });
  }, []);

  const advanceTurn = useCallback(() => {
    dispatch({ type: 'advance' });
  }, []);

  const rewindTurn = useCallback(() => {
    dispatch({ type: 'rewind' });
  }, []);

  const addStatus = useCallback(
    (id: string, template: StatusEffectTemplate, remainingRounds: number | null, note?: string) => {
      const status: StatusEffectInstance = {
        ...template,
        instanceId: nanoid(10),
        remainingRounds,
        note
      };
      dispatch({ type: 'add-status', payload: { id, status } });
    },
    []
  );

  const removeStatus = useCallback((id: string, statusId: string) => {
    dispatch({ type: 'remove-status', payload: { id, statusId } });
  }, []);

  const resetEncounter = useCallback(() => {
    const fallback = defaultEncounter();
    dispatch({ type: 'hydrate', payload: fallback });
  }, []);

  const hydrate = useCallback((encounter: EncounterState) => {
    dispatch({ type: 'hydrate', payload: encounter });
  }, []);

  const clearLog = useCallback(() => {
    dispatch({ type: 'clear-log' });
  }, []);

  const derived = useMemo(() => {
    const combatants = sortCombatants(state.combatants);
    const activeIndex = combatants.findIndex((combatant) => combatant.id === state.activeCombatantId);
    return {
      ...state,
      combatants,
      activeIndex
    };
  }, [state]);

  const presets = useMemo(
    () => ({
      statuses: STATUS_EFFECT_LIBRARY,
      icons: COMBATANT_ICON_LIBRARY
    }),
    []
  );

  return {
    state: derived,
    actions: {
      addCombatant,
      removeCombatant,
      updateCombatant,
      applyDelta,
      recordAttack,
      recordHeal,
      startDeathSaves,
      markCombatantDead,
      recordDeathSaveResult,
      setDeathSaveCounts,
      clearDeathSaves,
      setActiveCombatant,
      advanceTurn,
      rewindTurn,
      addStatus,
      removeStatus,
      resetEncounter,
      hydrate,
      clearLog
    },
    presets,
    isLoading: isHydrating
  };
};
