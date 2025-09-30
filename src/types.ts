export type CombatantType = 'player' | 'enemy' | 'ally';

export interface StatusEffectTemplate {
  id: string;
  label: string;
  description?: string;
  color: string;
  icon: string;
}

export interface StatusEffectInstance extends StatusEffectTemplate {
  instanceId: string;
  remainingRounds: number | null;
  note?: string;
}

export interface Combatant {
  id: string;
  name: string;
  type: CombatantType;
  initiative: number;
  hp: {
    current: number;
    max: number;
  };
  ac?: number;
  icon: string;
  statuses: StatusEffectInstance[];
  note?: string;
  isHidden?: boolean;
}

export interface EncounterState {
  combatants: Combatant[];
  activeCombatantId: string | null;
  round: number;
  startedAt?: string;
}
