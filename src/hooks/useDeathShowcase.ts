import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Combatant, CombatLogEntry } from '../types';

const DEFAULT_DURATION_MS = 4200;
const STORAGE_PREFIX = 'combat-tracker:death-showcase:';

interface DeathShowcaseQueueItem {
  combatantSnapshot: Combatant;
  logEntry: CombatLogEntry;
}

interface UseDeathShowcaseOptions {
  encounterId: string | null;
  combatants: Combatant[];
  log: CombatLogEntry[];
  durationMs?: number;
}

export interface DeathShowcaseState {
  combatant: Combatant;
  logEntry: CombatLogEntry;
}

const loadSeenIds = (encounterId: string | null): Set<string> => {
  if (!encounterId || typeof window === 'undefined') {
    return new Set();
  }
  try {
    const data = window.localStorage.getItem(STORAGE_PREFIX + encounterId);
    if (!data) {
      return new Set();
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    }
  } catch (error) {
    console.warn('Failed to load death showcase history', error);
  }
  return new Set();
};

const persistSeenIds = (encounterId: string | null, set: Set<string>) => {
  if (!encounterId || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_PREFIX + encounterId, JSON.stringify(Array.from(set)));
  } catch (error) {
    console.warn('Failed to persist death showcase history', error);
  }
};

export const useDeathShowcase = ({
  encounterId,
  combatants,
  log,
  durationMs = DEFAULT_DURATION_MS
}: UseDeathShowcaseOptions) => {
  const [queue, setQueue] = useState<DeathShowcaseQueueItem[]>([]);
  const [active, setActive] = useState<DeathShowcaseQueueItem | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const encounterRef = useRef<string | null>(null);
  const initialSnapshotCapturedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (encounterRef.current === encounterId) {
      return;
    }
    encounterRef.current = encounterId;
    initialSnapshotCapturedRef.current = false;
    setQueue([]);
    setActive(null);
    if (!encounterId) {
      seenIdsRef.current = new Set();
      return;
    }
    seenIdsRef.current = loadSeenIds(encounterId);
  }, [encounterId]);

  useEffect(() => {
    const deathLogs = log.filter((entry) => entry.type === 'death');
    const seenIds = seenIdsRef.current;
    const currentEncounterId = encounterRef.current;

    if (!initialSnapshotCapturedRef.current) {
      if (deathLogs.length > 0) {
        let hasNewSeen = false;
        deathLogs.forEach((entry) => {
          if (!seenIds.has(entry.id)) {
            seenIds.add(entry.id);
            hasNewSeen = true;
          }
        });
        if (hasNewSeen) {
          persistSeenIds(currentEncounterId, seenIds);
        }
      }
      initialSnapshotCapturedRef.current = true;
      return;
    }

    const unseenLogs = deathLogs.filter((entry) => !seenIds.has(entry.id));
    if (unseenLogs.length === 0) {
      return;
    }

    const additions = unseenLogs
      .map<DeathShowcaseQueueItem | null>((entry) => {
        if (!entry.combatantId) {
          return null;
        }
        const combatant = combatants.find((item) => item.id === entry.combatantId);
        if (!combatant) {
          return null;
        }
        const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';
        const isDeadStatus = combatant.deathSaves?.status === 'dead';
        const isAtZeroHp = combatant.hp.current <= 0;
        const shouldShowcase = isAtZeroHp && (!isPlayerOrAlly || isDeadStatus);
        if (!shouldShowcase) {
          return null;
        }
        return {
          combatantSnapshot: combatant,
          logEntry: entry
        };
      })
      .filter((item): item is DeathShowcaseQueueItem => item !== null);

    if (additions.length === 0) {
      return;
    }

    additions.forEach((item) => {
      seenIds.add(item.logEntry.id);
    });
    persistSeenIds(currentEncounterId, seenIds);

    setQueue((current) => [...current, ...additions]);
  }, [combatants, log]);

  useEffect(() => {
    if (active || queue.length === 0) {
      return;
    }

    setActive(queue[0]);
    setQueue((current) => current.slice(1));
  }, [queue, active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setActive(null);
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, durationMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActive(null);
  }, []);

  const activeShowcase = useMemo<DeathShowcaseState | null>(() => {
    if (!active) {
      return null;
    }
    const liveCombatant = combatants.find((item) => item.id === active.combatantSnapshot.id);
    return {
      combatant: liveCombatant ?? active.combatantSnapshot,
      logEntry: active.logEntry
    };
  }, [active, combatants]);

  return {
    activeShowcase,
    isShowcaseActive: activeShowcase !== null,
    pendingCount: queue.length + (activeShowcase ? 1 : 0),
    dismiss
  };
};
