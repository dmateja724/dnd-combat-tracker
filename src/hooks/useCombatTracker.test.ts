import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCombatTracker } from './useCombatTracker';

const { loadEncounterMock, saveEncounterMock } = vi.hoisted(() => ({
  loadEncounterMock: vi.fn().mockResolvedValue(null),
  saveEncounterMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../data/encounterDb', () => ({
  loadEncounter: loadEncounterMock,
  saveEncounter: saveEncounterMock
}));

describe('useCombatTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds combatants and sorts them by initiative', async () => {
    const { result } = renderHook(() => useCombatTracker(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.actions.addCombatant({
        name: 'Cleric',
        type: 'ally',
        initiative: 12,
        maxHp: 18,
        icon: '🛡️'
      });
      result.current.actions.addCombatant({
        name: 'Rogue',
        type: 'player',
        initiative: 18,
        maxHp: 22,
        icon: '🗡️'
      });
    });

    const names = result.current.state.combatants.map((combatant) => combatant.name);
    expect(names).toEqual(['Rogue', 'Cleric']);

    const logMessages = result.current.state.log.map((entry) => entry.message);
    expect(logMessages).toContain('Rogue joined the encounter.');
    expect(logMessages).toContain('Cleric joined the encounter.');
  });

  it('advances turns and increments rounds when wrapping', async () => {
    const { result } = renderHook(() => useCombatTracker(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.actions.addCombatant({
        name: 'Fighter',
        type: 'player',
        initiative: 14,
        maxHp: 30
      });
      result.current.actions.addCombatant({
        name: 'Goblin',
        type: 'enemy',
        initiative: 10,
        maxHp: 7
      });
      result.current.actions.startEncounter();
    });

    const firstActive = result.current.state.activeCombatantId;
    expect(firstActive).not.toBeNull();

    act(() => {
      result.current.actions.advanceTurn();
    });

    const secondActive = result.current.state.activeCombatantId;
    expect(secondActive).not.toBeNull();
    expect(secondActive).not.toEqual(firstActive);
    expect(result.current.state.round).toBe(1);

    act(() => {
      result.current.actions.advanceTurn();
    });

    expect(result.current.state.activeCombatantId).toEqual(firstActive);
    expect(result.current.state.round).toBe(2);

    const turnMessages = result.current.state.log
      .filter((entry) => entry.type === 'turn')
      .map((entry) => entry.message);
    const lastTurnMessage = turnMessages[turnMessages.length - 1];
    expect(lastTurnMessage).toContain('Turn advanced to');
  });

  it('applies damage deltas and records log entries', async () => {
    const { result } = renderHook(() => useCombatTracker(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.actions.addCombatant({
        name: 'Paladin',
        type: 'player',
        initiative: 16,
        maxHp: 35
      });
    });

    const targetId = result.current.state.combatants[0].id;

    act(() => {
      result.current.actions.applyDelta(targetId, 8);
    });

    const updated = result.current.state.combatants.find((combatant) => combatant.id === targetId);
    expect(updated?.hp.current).toBe(27);

    const lastLog = result.current.state.log[result.current.state.log.length - 1];
    expect(lastLog?.type).toBe('damage');
    expect(lastLog?.message).toContain('took 8 damage');
  });

  it('handles full combat lifecycle with persistence and broadcasts', async () => {
    const sampleState = {
      combatants: [
        {
          id: 'alpha',
          name: 'Alpha',
          type: 'player',
          initiative: 15,
          hp: { current: 20, max: 20 },
          ac: 16,
          icon: '🛡️',
          statuses: [],
          note: 'Leader',
          deathSaves: null
        },
        {
          id: 'bravo',
          name: 'Bravo',
          type: 'enemy',
          initiative: 12,
          hp: { current: 18, max: 18 },
          ac: 13,
          icon: '⚔️',
          statuses: [],
          note: undefined,
          deathSaves: null
        }
      ],
      activeCombatantId: 'alpha',
      round: 1,
      startedAt: new Date().toISOString(),
      log: []
    };
    loadEncounterMock.mockResolvedValueOnce(sampleState);

    const createdChannels: any[] = [];
    const OriginalBroadcastChannel = global.BroadcastChannel;
    // @ts-expect-error extend mock channel for tracking
    global.BroadcastChannel = class extends OriginalBroadcastChannel {
      constructor(name: string) {
        super(name);
        createdChannels.push(this);
      }
    };

    try {
      const { result } = renderHook(() => useCombatTracker('encounter-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.actions.startEncounter();
      });

      const [persistentTemplate, expiringTemplateCandidate] = result.current.presets.statuses;
      const expiringTemplate = expiringTemplateCandidate ?? persistentTemplate;
      expect(persistentTemplate).toBeDefined();
      expect(expiringTemplate).toBeDefined();

      act(() => {
        result.current.actions.addStatus('alpha', persistentTemplate, null, 'persistent');
      });
      const persistentStatusId = result.current.state.combatants
        .find((combatant) => combatant.id === 'alpha')
        ?.statuses[0]?.instanceId;
      expect(persistentStatusId).toBeTruthy();

      act(() => {
        result.current.actions.removeStatus('alpha', persistentStatusId as string);
      });

      act(() => {
        result.current.actions.addStatus('alpha', expiringTemplate, 1, 'temporary');
        result.current.actions.recordAttack({
          attackerId: 'alpha',
          targetId: 'bravo',
          amount: 5,
          damageType: 'slashing'
        });
        result.current.actions.recordAttack({
          attackerId: 'unknown',
          targetId: 'bravo',
          amount: 0,
          damageType: ''
        });
        result.current.actions.recordHeal({
          targetId: 'bravo',
          amount: 3,
          healingType: 'potion'
        });
        result.current.actions.recordHeal({
          targetId: 'bravo',
          amount: 0,
          healingType: ''
        });
        result.current.actions.applyDelta('bravo', 2);
        result.current.actions.applyDelta('bravo', -1);
        result.current.actions.updateCombatant('bravo', {
          hp: { current: 10, max: 18 },
          name: 'Bravo Renamed',
          ac: 14,
          note: 'Updated',
          icon: '🛡️'
        });
        result.current.actions.setActiveCombatant('bravo');
      });

      act(() => {
        result.current.actions.advanceTurn();
        result.current.actions.advanceTurn();
        result.current.actions.rewindTurn();
        result.current.actions.rewindTurn();
      });

      act(() => {
        result.current.actions.startDeathSaves('bravo', 2);
        result.current.actions.recordDeathSaveResult('bravo', 'failure', 2);
        result.current.actions.setDeathSaveCounts('bravo', 3, 0);
        result.current.actions.markCombatantDead('bravo', 3);
        result.current.actions.clearDeathSaves('bravo');
        result.current.actions.addCombatant({
          name: 'Charlie',
          type: 'ally',
          initiative: 11,
          maxHp: 22,
          ac: 15,
          icon: '🎯',
          note: 'Support'
        });
      });

      const charlieId = result.current.state.combatants.find((c) => c.name === 'Charlie')?.id;
      expect(charlieId).toBeTruthy();

      await waitFor(() => expect(saveEncounterMock).toHaveBeenCalled());

      act(() => {
        if (charlieId) {
          result.current.actions.removeCombatant(charlieId);
        }
        result.current.actions.clearLog();
      });

      expect(result.current.state.log).toHaveLength(0);

      act(() => {
        result.current.actions.applyDelta('bravo', 50);
      });

      const defeatEntry = result.current.state.log.find((entry) => entry.type === 'death');
      expect(defeatEntry?.message).toContain('defeated');

      act(() => {
        result.current.actions.resetEncounter();
      });
      expect(result.current.state.combatants).toHaveLength(0);

      act(() => {
        result.current.actions.startEncounter();
      });
      expect(result.current.state.activeCombatantId).toBeNull();

      act(() => {
        result.current.actions.hydrate(sampleState);
      });
      expect(result.current.state.combatants).toHaveLength(2);

      const broadcastPayload = {
        ...sampleState,
        round: 5
      };
      act(() => {
        const channelInstance = createdChannels[0];
        channelInstance?.postMessage({
          type: 'hydrate',
          payload: broadcastPayload,
          source: 'external-client'
        });
      });
      expect(result.current.state.round).toBe(5);
    } finally {
      global.BroadcastChannel = OriginalBroadcastChannel;
    }
  });
});
