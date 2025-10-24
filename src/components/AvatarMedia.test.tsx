import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarMedia from './AvatarMedia';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';

const mockCombatantLibrary = {
  templates: [] as any[],
  saveTemplate: vi.fn(),
  isMutating: false
};

vi.mock('../context/CombatantLibraryContext', () => ({
  useCombatantLibrary: () => mockCombatantLibrary
}));

const createCombatant = (overrides: Partial<Combatant>): Combatant => ({
  id: 'c-1',
  name: 'Test Combatant',
  type: 'player',
  initiative: 12,
  hp: { current: 20, max: 20 },
  icon: '🛡️',
  statuses: [],
  ...overrides
});

const createHandlers = () => ({
  onCenter: vi.fn(),
  onDamage: vi.fn(),
  onHeal: vi.fn(),
  onRemove: vi.fn(),
  onUpdate: vi.fn(),
  onAddStatus: vi.fn(),
  onRemoveStatus: vi.fn(),
  onSetDeathSaveCounts: vi.fn(),
  onClearDeathSaves: vi.fn(),
  onRecordDeathSave: vi.fn()
});

describe('AvatarMedia', () => {
  beforeEach(() => {
    mockCombatantLibrary.templates = [];
    mockCombatantLibrary.isMutating = false;
    mockCombatantLibrary.saveTemplate.mockReset();
  });

  it('renders image icons as img elements', () => {
    const imageUrl = 'https://cdn.example.com/avatar.png';
    render(<AvatarMedia icon={imageUrl} />);

    const image = screen.getByRole('img', { hidden: true });
    expect(image).toHaveAttribute('src', imageUrl);
    expect(image).toHaveClass('avatar-media', 'avatar-media-image');
  });

  it('renders emoji icons as spans with emoji styling', () => {
    render(<AvatarMedia icon="🐉" />);

    const emoji = screen.getByText('🐉');
    expect(emoji).toHaveClass('avatar-media', 'avatar-media-emoji');
    expect(emoji).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies has-image class to CombatantCard avatar when icon is an image', () => {
    const combatant = createCombatant({ icon: 'https://cdn.example.com/avatar.png' });
    const handlers = createHandlers();

    const { container } = render(
      <CombatantCard
        combatant={combatant}
        isActive={false}
        statusPresets={[]}
        {...handlers}
      />
    );

    const avatarButton = container.querySelector('button.avatar');
    expect(avatarButton).not.toBeNull();
    expect(avatarButton).toHaveClass('has-image');

    const image = avatarButton?.querySelector('img.avatar-media-image');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('src', combatant.icon);
  });

  it('applies has-emoji class to CombatantCard avatar when icon is an emoji', () => {
    const combatant = createCombatant({ icon: '🐲' });
    const handlers = createHandlers();

    const { container } = render(
      <CombatantCard
        combatant={combatant}
        isActive={false}
        statusPresets={[]}
        {...handlers}
      />
    );

    const avatarButton = container.querySelector('button.avatar');
    expect(avatarButton).not.toBeNull();
    expect(avatarButton).toHaveClass('has-emoji');

    const emoji = avatarButton?.querySelector('span.avatar-media-emoji');
    expect(emoji).not.toBeNull();
    expect(emoji).toHaveTextContent('🐲');
  });
});
