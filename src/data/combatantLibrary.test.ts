import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCombatantTemplate,
  deleteCombatantTemplate,
  listCombatantTemplates,
  updateCombatantTemplate
} from './combatantLibrary';

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error allow override
  global.fetch = fetchMock;
});

afterEach(() => {
  fetchMock.mockReset();
  global.fetch = originalFetch;
});

const buildTemplateResponse = () => ({
  id: 'tmpl-1',
  name: 'Archer',
  type: 'ally',
  defaultInitiative: 12,
  maxHp: 18,
  ac: 15,
  icon: '🏹',
  note: 'Ranged support',
  createdAt: 'now',
  updatedAt: 'later'
});

describe('combatantLibrary API helpers', () => {
  it('listCombatantTemplates returns parsed templates', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [buildTemplateResponse(), { invalid: true }]
    });

    const result = await listCombatantTemplates();
    expect(fetchMock).toHaveBeenCalledWith('/api/combatants', expect.objectContaining({ method: 'GET' }));
    expect(result).toHaveLength(1);
    expect(result[0].note).toBe('Ranged support');
  });

  it('listCombatantTemplates handles unauthorized and errors gracefully', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await listCombatantTemplates()).toEqual([]);

    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await listCombatantTemplates()).toEqual([]);

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ not: 'an array' }) });
    expect(await listCombatantTemplates()).toEqual([]);
  });

  it('createCombatantTemplate sends payload and parses response', async () => {
    const response = buildTemplateResponse();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => response
    });

    const result = await createCombatantTemplate({
      name: 'Archer',
      type: 'ally',
      defaultInitiative: 12,
      maxHp: 18,
      ac: 15,
      icon: '🏹',
      note: 'Ranged support'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/combatants',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"name":"Archer"') })
    );
    expect(result?.name).toBe('Archer');

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const unauthorized = await createCombatantTemplate({
      name: 'Invalid',
      type: 'ally',
      defaultInitiative: 10,
      maxHp: 10,
      ac: 12,
      icon: '❌'
    });
    expect(unauthorized).toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const rejected = await createCombatantTemplate({
      name: 'Retry',
      type: 'ally',
      defaultInitiative: 1,
      maxHp: 1,
      icon: '⚠️'
    });
    expect(rejected).toBeNull();
  });

  it('updateCombatantTemplate updates and parses templates', async () => {
    const response = { ...buildTemplateResponse(), name: 'Updated' };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => response
    });

    const result = await updateCombatantTemplate('tmpl-1', {
      name: 'Updated',
      type: 'ally',
      defaultInitiative: 15,
      maxHp: 20,
      ac: 16,
      icon: '🛡️'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/combatants/tmpl-1',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('"name":"Updated"') })
    );
    expect(result?.name).toBe('Updated');

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const failure = await updateCombatantTemplate('tmpl-1', {
      name: 'Fail',
      type: 'ally',
      defaultInitiative: 1,
      maxHp: 1,
      icon: '❌'
    });
    expect(failure).toBeNull();
  });

  it('deleteCombatantTemplate returns deletion outcome', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await deleteCombatantTemplate('tmpl-1')).toBe(true);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await deleteCombatantTemplate('tmpl-1')).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await deleteCombatantTemplate('tmpl-1')).toBe(false);
  });
});
