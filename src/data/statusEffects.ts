import { StatusEffectTemplate } from '../types';

export const STATUS_EFFECT_LIBRARY: StatusEffectTemplate[] = [
  {
    id: 'blinded',
    label: 'Blinded',
    description: "Creature can't see, fails sight checks, and attackers have advantage.",
    color: '#2563eb',
    icon: '👁️‍🗨️'
  },
  {
    id: 'charmed',
    label: 'Charmed',
    description: "Charmed creature can't attack the charmer and the charmer has advantage on social checks.",
    color: '#fbbf24',
    icon: '💘'
  },
  {
    id: 'deafened',
    label: 'Deafened',
    description: "Creature can't hear and automatically fails hearing-based checks.",
    color: '#f87171',
    icon: '🔕'
  },
  {
    id: 'exhaustion',
    label: 'Exhaustion',
    description: 'Apply level-based penalties to ability checks, speed, and more.',
    color: '#6b7280',
    icon: '😩'
  },
  {
    id: 'frightened',
    label: 'Frightened',
    description: "Disadvantage while the source is in sight and can't willingly move closer.",
    color: '#f59e0b',
    icon: '😱'
  },
  {
    id: 'grappled',
    label: 'Grappled',
    description: 'Speed becomes 0 and ends if grappler is incapacitated or moved away.',
    color: '#34d399',
    icon: '🪢'
  },
  {
    id: 'incapacitated',
    label: 'Incapacitated',
    description: "Creature can't take actions or reactions.",
    color: '#a855f7',
    icon: '🚫'
  },
  {
    id: 'invisible',
    label: 'Invisible',
    description: "Invisible creature can't be seen, has advantage to attack, and attackers have disadvantage.",
    color: '#93c5fd',
    icon: '👻'
  },
  {
    id: 'paralyzed',
    label: 'Paralyzed',
    description: 'Incapacitated, fails Str/Dex saves, attackers have advantage and crit within 5 feet.',
    color: '#14b8a6',
    icon: '🧊'
  },
  {
    id: 'petrified',
    label: 'Petrified',
    description: 'Transformed to stone, incapacitated, and resistant to all damage.',
    color: '#7c3aed',
    icon: '🗿'
  },
  {
    id: 'poisoned',
    label: 'Poisoned',
    description: 'Disadvantage on attack rolls and ability checks.',
    color: '#22c55e',
    icon: '☠️'
  },
  {
    id: 'prone',
    label: 'Prone',
    description: 'Speed 0 to stand; attackers within 5 feet have advantage, others have disadvantage.',
    color: '#f97316',
    icon: '🛌'
  },
  {
    id: 'restrained',
    label: 'Restrained',
    description: 'Speed 0, disadvantage on attacks and Dex saves, attackers have advantage.',
    color: '#ef4444',
    icon: '⛓️'
  },
  {
    id: 'stunned',
    label: 'Stunned',
    description: 'Incapacitated, fails Str/Dex saves, attackers have advantage.',
    color: '#fb7185',
    icon: '💫'
  },
  {
    id: 'unconscious',
    label: 'Unconscious',
    description: 'Unaware, drops prone, and attackers have advantage and crit within 5 feet.',
    color: '#6366f1',
    icon: '💤'
  }
];
