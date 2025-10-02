import type { CombatantTemplate, CombatantTemplateInput } from '../types';

const API_BASE = '/api/combatants';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCombatantType = (value: unknown): value is CombatantTemplate['type'] =>
  value === 'player' || value === 'ally' || value === 'enemy';

const parseTemplate = (value: unknown): CombatantTemplate | null => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (!isCombatantType(value.type)) return null;
  if (typeof value.defaultInitiative !== 'number') return null;
  if (typeof value.maxHp !== 'number') return null;
  if (typeof value.icon !== 'string') return null;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null;

  const normalizedAc = typeof value.ac === 'number' ? value.ac : null;
  const note = typeof value.note === 'string' ? value.note : null;

  return {
    id: value.id,
    name: value.name,
    type: value.type,
    defaultInitiative: value.defaultInitiative,
    maxHp: value.maxHp,
    ac: normalizedAc,
    icon: value.icon,
    note,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
};

export const listCombatantTemplates = async (): Promise<CombatantTemplate[]> => {
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
      .map((candidate) => parseTemplate(candidate))
      .filter((candidate): candidate is CombatantTemplate => candidate !== null);
  } catch (error) {
    console.warn('Failed to load combatant templates', error);
    return [];
  }
};

export const createCombatantTemplate = async (
  input: CombatantTemplateInput
): Promise<CombatantTemplate | null> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = parseTemplate(await response.json());
    return payload;
  } catch (error) {
    console.warn('Failed to save combatant template', error);
    return null;
  }
};

export const deleteCombatantTemplate = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (response.status === 404) {
      return false;
    }
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return true;
  } catch (error) {
    console.warn('Failed to delete combatant template', error);
    return false;
  }
};
