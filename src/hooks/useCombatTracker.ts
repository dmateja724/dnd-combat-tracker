import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { STATUS_EFFECT_LIBRARY } from '../data/statusEffects';
import { COMBATANT_ICON_LIBRARY } from '../data/combatantIcons';
import { loadEncounter, saveEncounter } from '../data/encounterDb';
import type { Combatant, EncounterState, StatusEffectTemplate } from '../types';
import { defaultEncounter, sortCombatants, trackerReducer } from './useCombatTrackerReducer';
import type { AddCombatantInput, UpdateCombatantInput, AttackActionInput, HealActionInput } from './useCombatTrackerReducer';

export type { AddCombatantInput, UpdateCombatantInput, AttackActionInput, HealActionInput } from './useCombatTrackerReducer';

interface TrackerBroadcastMessage {
  type: 'hydrate';
  payload: EncounterState;
  source: string;
}

const BROADCAST_CHANNEL_PREFIX = 'combat-tracker:encounter:';

const fallbackIcons = COMBATANT_ICON_LIBRARY.map((item) => item.icon);

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

  const startEncounter = useCallback(() => {
    dispatch({ type: 'start-encounter' });
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
      startEncounter,
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
