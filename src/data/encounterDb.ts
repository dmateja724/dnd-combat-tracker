import type { Combatant, CombatLogEntry, DeathSaveState, EncounterState, StatusEffectInstance } from '../types';

const API_BASE = '/api/encounters';

export interface EncounterSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCombatantType = (value: unknown): value is Combatant['type'] =>
  value === 'player' || value === 'ally' || value === 'enemy' || value === 'boss';

const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const coerceDeathSaves = (value: unknown): DeathSaveState | null => {
  if (!isRecord(value)) return null;
  const statusValue = value.status;
  if (statusValue !== 'pending' && statusValue !== 'stable' && statusValue !== 'dead') {
    return null;
  }
  const successesValue = Number(value.successes);
  const failuresValue = Number(value.failures);
  if (!Number.isFinite(successesValue) || !Number.isFinite(failuresValue)) {
    return null;
  }
  const startedAtValue = Number(value.startedAtRound);
  if (!Number.isFinite(startedAtValue)) {
    return null;
  }
  const lastRollRaw = value.lastRollRound;
  const lastRollRound =
    typeof lastRollRaw === 'number' && Number.isFinite(lastRollRaw)
      ? clampTo(Math.round(lastRollRaw), 1, Number.MAX_SAFE_INTEGER)
      : null;

  const successes = clampTo(Math.round(successesValue), 0, 3);
  const failures = clampTo(Math.round(failuresValue), 0, 3);
  const startedAtRound = clampTo(Math.max(1, Math.round(startedAtValue)), 1, Number.MAX_SAFE_INTEGER);

  let status: DeathSaveState['status'] = statusValue;
  if (status === 'pending') {
    if (failures >= 3) {
      status = 'dead';
    } else if (successes >= 3) {
      status = 'stable';
    }
  }

  return {
    status,
    successes,
    failures,
    startedAtRound,
    lastRollRound
  };
};

const coerceStatus = (value: unknown): StatusEffectInstance | null => {
  if (!isRecord(value)) return null;
  if (typeof value.instanceId !== 'string') return null;
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return null;
  if (typeof value.icon !== 'string' || typeof value.color !== 'string') return null;
  if (!(typeof value.remainingRounds === 'number' || value.remainingRounds === null)) return null;
  const level = value.level;
  const normalizedLevel = typeof level === 'number' && Number.isFinite(level) ? Math.max(1, Math.round(level)) : undefined;

  return {
    id: value.id,
    label: value.label,
    description: typeof value.description === 'string' ? value.description : undefined,
    color: value.color,
    icon: value.icon,
    instanceId: value.instanceId,
    remainingRounds: value.remainingRounds,
    note: typeof value.note === 'string' ? value.note : undefined,
    level: normalizedLevel
  };
};

const coerceLogEntry = (value: unknown): CombatLogEntry | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string') return null;
  if (
    value.type !== 'info' &&
    value.type !== 'attack' &&
    value.type !== 'damage' &&
    value.type !== 'heal' &&
    value.type !== 'turn' &&
    value.type !== 'status-add' &&
    value.type !== 'status-remove' &&
    value.type !== 'combatant-add' &&
    value.type !== 'combatant-remove'
  ) {
    return null;
  }
  if (typeof value.message !== 'string') return null;
  if (typeof value.timestamp !== 'string') return null;
  if (typeof value.round !== 'number') return null;

  return {
    id: value.id,
    type: value.type,
    message: value.message,
    timestamp: value.timestamp,
    round: value.round,
    combatantId: typeof value.combatantId === 'string' ? value.combatantId : undefined,
    amount: typeof value.amount === 'number' ? value.amount : undefined
  };
};

const coerceCombatant = (value: unknown): Combatant | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!isCombatantType(value.type) || typeof value.initiative !== 'number') return null;
  if (!isRecord(value.hp) || typeof value.hp.current !== 'number' || typeof value.hp.max !== 'number') {
    return null;
  }

  const statuses = Array.isArray(value.statuses)
    ? value.statuses
        .map((status) => coerceStatus(status))
        .filter((status): status is StatusEffectInstance => status !== null)
    : [];
  const deathSaves = 'deathSaves' in value ? coerceDeathSaves(value.deathSaves) : null;

  return {
    id: value.id,
    name: value.name,
    type: value.type as Combatant['type'],
    initiative: value.initiative,
    hp: {
      current: value.hp.current,
      max: value.hp.max
    },
    ac: typeof value.ac === 'number' ? value.ac : undefined,
    icon: typeof value.icon === 'string' ? value.icon : '❓',
    statuses,
    note: typeof value.note === 'string' ? value.note : undefined,
    isHidden: typeof value.isHidden === 'boolean' ? value.isHidden : undefined,
    deathSaves
  };
};

const sanitizeEncounter = (value: EncounterState): EncounterState => ({
  ...value,
  combatants: value.combatants.map((combatant) => ({
    ...combatant,
    statuses: Array.isArray(combatant.statuses) ? combatant.statuses : [],
    deathSaves: coerceDeathSaves(combatant.deathSaves) ?? null
  })),
  log: Array.isArray(value.log)
    ? value.log
        .map((entry) =>
          coerceLogEntry(entry)
        )
        .filter((entry): entry is CombatLogEntry => entry !== null)
    : []
});

const parseEncounter = (value: unknown): EncounterState | null => {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.combatants)) return null;

  const combatants = value.combatants
    .map((candidate) => coerceCombatant(candidate))
    .filter((candidate): candidate is Combatant => candidate !== null);

  if (combatants.length !== value.combatants.length) {
    return null;
  }

  const round = typeof value.round === 'number' ? value.round : 1;
  const activeCombatantId = typeof value.activeCombatantId === 'string' || value.activeCombatantId === null
    ? (value.activeCombatantId as EncounterState['activeCombatantId'])
    : null;
  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : undefined;
  const log = Array.isArray(value.log)
    ? value.log
        .map((candidate) => coerceLogEntry(candidate))
        .filter((candidate): candidate is CombatLogEntry => candidate !== null)
    : [];

  return sanitizeEncounter({
    combatants,
    activeCombatantId,
    round,
    startedAt,
    log
  });
};

const parseSummary = (value: unknown): EncounterSummary | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null;
  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
};

export const listEncounters = async (): Promise<EncounterSummary[]> => {
  try {
    const response = await fetch(API_BASE, { method: 'GET', credentials: 'include' });
    if (response.status === 401) {
      return [];
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload
      .map((candidate) => parseSummary(candidate))
      .filter((candidate): candidate is EncounterSummary => candidate !== null);
  } catch (error) {
    console.warn('Failed to list encounters', error);
    return [];
  }
};

export const createEncounter = async (name?: string): Promise<EncounterSummary | null> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(name ? { name } : {})
    });

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = parseSummary(await response.json());
    return payload;
  } catch (error) {
    console.warn('Failed to create encounter', error);
    return null;
  }
};

export const loadEncounter = async (id: string): Promise<EncounterState | null> => {
  try {
    const response = await fetch(`${API_BASE}/${id}`, { method: 'GET', credentials: 'include' });
    if (response.status === 404) {
      return null;
    }
    if (response.status === 401) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || !('state' in payload)) {
      return null;
    }
    return parseEncounter(payload.state);
  } catch (error) {
    console.warn('Failed to load encounter from API', error);
    return null;
  }
};

export const saveEncounter = async (id: string, state: EncounterState): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/${id}/state`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sanitizeEncounter(state))
    });

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Encounter not found');
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn('Failed to persist encounter via API', error);
  }
};

export const renameEncounter = async (id: string, name: string): Promise<EncounterSummary | null> => {
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = parseSummary(await response.json());
    return payload;
  } catch (error) {
    console.warn('Failed to rename encounter', error);
    return null;
  }
};

export const deleteEncounter = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return true;
  } catch (error) {
    console.warn('Failed to delete encounter', error);
    return false;
  }
};
