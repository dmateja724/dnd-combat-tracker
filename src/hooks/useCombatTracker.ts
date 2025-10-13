import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Combatant,
  CombatantType,
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
}

type TrackerAction =
  | { type: 'add-combatant'; payload: Combatant }
  | { type: 'remove-combatant'; payload: { id: string } }
  | { type: 'update-combatant'; payload: { id: string; changes: UpdateCombatantInput } }
  | { type: 'apply-delta'; payload: { id: string; delta: number } }
  | { type: 'set-active'; payload: { id: string | null } }
  | { type: 'advance' }
  | { type: 'rewind' }
  | { type: 'add-status'; payload: { id: string; status: StatusEffectInstance } }
  | { type: 'remove-status'; payload: { id: string; statusId: string } }
  | { type: 'hydrate'; payload: EncounterState };

type TrackerState = EncounterState;

interface TrackerBroadcastMessage {
  type: 'hydrate';
  payload: EncounterState;
  source: string;
}

const BROADCAST_CHANNEL_PREFIX = 'combat-tracker:encounter:';

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

const trackerReducer = (state: TrackerState, action: TrackerAction): TrackerState => {
  switch (action.type) {
    case 'hydrate': {
      const sanitized = action.payload.combatants.map((combatant) => ({
        ...combatant,
        statuses: combatant.statuses ?? []
      }));
      const hydrated = {
        ...action.payload,
        combatants: sortCombatants(sanitized)
      };
      return hydrated;
    }
    case 'add-combatant': {
      const combatants = sortCombatants([...state.combatants, action.payload]);
      const activeCombatantId = combatants.length === 1 ? combatants[0].id : state.activeCombatantId;
      return {
        ...state,
        combatants,
        activeCombatantId
      };
    }
    case 'remove-combatant': {
      const combatants = state.combatants.filter((c) => c.id !== action.payload.id);
      let { activeCombatantId } = state;
      if (activeCombatantId === action.payload.id) {
        activeCombatantId = combatants[0]?.id ?? null;
      }
      return {
        ...state,
        combatants,
        activeCombatantId
      };
    }
    case 'update-combatant': {
      const combatants = sortCombatants(
        state.combatants.map((combatant) =>
          combatant.id === action.payload.id
            ? {
                ...combatant,
                ...action.payload.changes,
                hp: {
                  ...combatant.hp,
                  ...action.payload.changes.hp,
                  current: Math.min(
                    combatant.hp.max,
                    Math.max(0, action.payload.changes.hp?.current ?? combatant.hp.current)
                  ),
                  max: action.payload.changes.hp?.max ?? combatant.hp.max
                }
              }
            : combatant
        )
      );
      return {
        ...state,
        combatants
      };
    }
    case 'apply-delta': {
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== action.payload.id) return combatant;
        const next = Math.max(0, Math.min(combatant.hp.max, combatant.hp.current - action.payload.delta));
        return {
          ...combatant,
          hp: {
            ...combatant.hp,
            current: next
          }
        };
      });
      return {
        ...state,
        combatants
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
      return {
        combatants,
        activeCombatantId: combatants[nextIndex]?.id ?? null,
        round: wrapped ? state.round + 1 : state.round,
        startedAt: state.startedAt ?? new Date().toISOString()
      };
    }
    case 'rewind': {
      if (state.combatants.length === 0) return state;
      const sorted = sortCombatants(state.combatants);
      const currentIndex = sorted.findIndex((combatant) => combatant.id === state.activeCombatantId);
      const nextIndex = currentIndex === -1 ? sorted.length - 1 : (currentIndex - 1 + sorted.length) % sorted.length;
      const wrapped = currentIndex !== -1 && currentIndex === 0;
      return {
        ...state,
        combatants: sorted,
        activeCombatantId: sorted[nextIndex]?.id ?? null,
        round: wrapped && state.round > 1 ? state.round - 1 : state.round
      };
    }
    case 'add-status': {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === action.payload.id
          ? {
              ...combatant,
              statuses: [...combatant.statuses, action.payload.status]
            }
          : combatant
      );
      return {
        ...state,
        combatants
      };
    }
    case 'remove-status': {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === action.payload.id
          ? {
              ...combatant,
              statuses: combatant.statuses.filter((status) => status.instanceId !== action.payload.statusId)
            }
          : combatant
      );
      return {
        ...state,
        combatants
      };
    }
    default:
      return state;
  }
};

const fallbackIcons = COMBATANT_ICON_LIBRARY.map((item) => item.icon);

const defaultEncounter = (): EncounterState => ({
  combatants: [],
  activeCombatantId: null,
  round: 1
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
      note: input.note
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
      setActiveCombatant,
      advanceTurn,
      rewindTurn,
      addStatus,
      removeStatus,
      resetEncounter,
      hydrate
    },
    presets,
    isLoading: isHydrating
  };
};
