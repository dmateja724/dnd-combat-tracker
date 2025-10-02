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

export interface CombatantTemplate {
  id: string;
  name: string;
  type: CombatantType;
  defaultInitiative: number;
  maxHp: number;
  ac: number | null;
  icon: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CombatantTemplateInput {
  name: string;
  type: CombatantType;
  defaultInitiative: number;
  maxHp: number;
  ac?: number | null;
  icon?: string;
  note?: string;
}

export interface EncounterState {
  combatants: Combatant[];
  activeCombatantId: string | null;
  round: number;
  startedAt?: string;
}
