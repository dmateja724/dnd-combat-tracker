import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncounterState } from '../types';
import {
  createEncounter,
  deleteEncounter,
  listEncounters,
  loadEncounter,
  renameEncounter,
  saveEncounter
} from './encounterDb';

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  // @ts-expect-error allow override for tests
  global.fetch = fetchMock;
});

afterEach(() => {
  fetchMock.mockReset();
  global.fetch = originalFetch;
});

describe('encounterDb API helpers', () => {
  it('listEncounters returns only valid summaries', async () => {
    const valid = {
      id: 'enc-1',
      name: 'Bandit Camp',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z'
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [valid, { id: 2 }]
    });

    const result = await listEncounters();

    expect(fetchMock).toHaveBeenCalledWith('/api/encounters', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual([valid]);
  });

  it('listEncounters handles unauthorized and errors gracefully', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const unauthorized = await listEncounters();
    expect(unauthorized).toEqual([]);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => []
    });
    const errored = await listEncounters();
    expect(errored).toEqual([]);

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const rejected = await listEncounters();
    expect(rejected).toEqual([]);
  });

  it('createEncounter posts payload and returns summary', async () => {
    const summary = {
      id: 'enc-2',
      name: 'Forest Skirmish',
      createdAt: '2024-02-01T00:00:00.000Z',
      updatedAt: '2024-02-01T00:00:00.000Z'
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => summary
    });

    const result = await createEncounter('Forest Skirmish');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/encounters',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Forest Skirmish' })
      })
    );
    expect(result).toEqual(summary);
  });

  it('createEncounter returns null on authorization failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const result = await createEncounter('Nope');
    expect(result).toBeNull();
  });

  it('createEncounter supports unnamed encounters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'enc-blank',
        name: 'Untitled',
        createdAt: 'now',
        updatedAt: 'now'
      })
    });

    await createEncounter();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/encounters',
      expect.objectContaining({ body: JSON.stringify({}) })
    );
  });

  it('loadEncounter returns null when not found', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404
    });

    const result = await loadEncounter('missing');

    expect(fetchMock).toHaveBeenCalledWith('/api/encounters/missing', expect.objectContaining({ method: 'GET' }));
    expect(result).toBeNull();
  });

  it('loadEncounter returns null when unauthorized', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const result = await loadEncounter('unauthorized');
    expect(result).toBeNull();
  });

  it('loadEncounter parses valid payloads and sanitizes entries', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        state: {
          combatants: [
            {
              id: 'c1',
              name: 'Foe',
              type: 'enemy',
              initiative: 12,
              hp: { current: 10, max: 12 },
              icon: '⚔️',
              statuses: [],
              deathSaves: { status: 'pending', successes: 10, failures: 0, startedAtRound: 1 }
            }
          ],
          activeCombatantId: 'c1',
          round: 2,
          startedAt: 'now',
          log: []
        }
      })
    });

    const result = await loadEncounter('exists');
    expect(result?.combatants[0].deathSaves?.status).toBe('stable');
  });

  it('saveEncounter sends sanitized payload and swallows errors', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const state: EncounterState = {
      combatants: [],
      activeCombatantId: null,
      round: 1,
      startedAt: undefined,
      log: []
    };

    await saveEncounter('enc-1', state);
    expect(fetchMock).toHaveBeenCalledWith('/api/encounters/enc-1/state', expect.objectContaining({ method: 'PUT' }));

    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await saveEncounter('enc-1', state);
  });

  it('renameEncounter parses summaries and handles failures', async () => {
    const summary = {
      id: 'enc-5',
      name: 'Renamed',
      createdAt: 'now',
      updatedAt: 'later'
    };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => summary });
    const result = await renameEncounter('enc-5', 'Renamed');
    expect(result).toEqual(summary);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const failure = await renameEncounter('enc-5', 'Broken');
    expect(failure).toBeNull();
  });

  it('deleteEncounter returns boolean based on response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const success = await deleteEncounter('enc-6');
    expect(success).toBe(true);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const missing = await deleteEncounter('enc-6');
    expect(missing).toBe(false);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const unauthorized = await deleteEncounter('enc-6');
    expect(unauthorized).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error('network'));
    const failure = await deleteEncounter('enc-6');
    expect(failure).toBe(false);
  });
});
