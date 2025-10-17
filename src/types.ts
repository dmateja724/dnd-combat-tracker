export type CombatantType = 'player' | 'enemy' | 'ally' | 'boss';

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
  level?: number;
}

export type DeathSaveStatus = 'pending' | 'stable' | 'dead';

export interface DeathSaveState {
  status: DeathSaveStatus;
  successes: number;
  failures: number;
  startedAtRound: number;
  lastRollRound: number | null;
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
  deathSaves?: DeathSaveState | null;
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

export interface CombatantLibraryExport {
  version: 1;
  exportedAt: string;
  templates: CombatantTemplateInput[];
}

export type CombatLogEventType =
  | 'info'
  | 'attack'
  | 'damage'
  | 'heal'
  | 'turn'
  | 'status-add'
  | 'status-remove'
  | 'combatant-add'
  | 'combatant-remove'
  | 'death';

export interface CombatLogEntry {
  id: string;
  type: CombatLogEventType;
  message: string;
  timestamp: string;
  round: number;
  combatantId?: string;
  amount?: number;
}

export interface EncounterState {
  combatants: Combatant[];
  activeCombatantId: string | null;
  round: number;
  startedAt?: string;
  log: CombatLogEntry[];
}
