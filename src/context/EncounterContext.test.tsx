import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EncounterProvider, useEncounterContext } from './EncounterContext';

const authState: any = {
  user: { id: 'user-1', email: 'hero@example.com' },
  isLoading: false,
  isBootstrapping: false,
  error: null,
  handleSignIn: vi.fn(),
  handleSignUp: vi.fn(),
  handleSignOut: vi.fn()
};

const listEncountersMock = vi.fn();
const createEncounterMock = vi.fn();
const renameEncounterMock = vi.fn();
const deleteEncounterMock = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('../data/encounterDb', () => ({
  listEncounters: (...args: unknown[]) => listEncountersMock(...args),
  createEncounter: (...args: unknown[]) => createEncounterMock(...args),
  renameEncounter: (...args: unknown[]) => renameEncounterMock(...args),
  deleteEncounter: (...args: unknown[]) => deleteEncounterMock(...args)
}));

const wrapper = ({ children }: { children: ReactNode }) => <EncounterProvider>{children}</EncounterProvider>;

describe('EncounterContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authState.user = { id: 'user-1', email: 'hero@example.com' };
    authState.isLoading = false;
    authState.isBootstrapping = false;
  });

  afterEach(() => {
    authState.user = { id: 'user-1', email: 'hero@example.com' };
  });

  it('loads encounters on mount and respects stored selection', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'Goblin Ambush', createdAt: now, updatedAt: now }
    ]);
    localStorage.setItem('combat-tracker:selectedEncounterId', 'enc-1');

    const { result } = renderHook(() => useEncounterContext(), { wrapper });

    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());
    expect(result.current.encounters).toHaveLength(1);
    expect(result.current.selectedEncounterId).toBe('enc-1');
  });

  it('clears selected encounter when stored id no longer exists', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([{ id: 'enc-1', name: 'Only', createdAt: now, updatedAt: now }]);
    localStorage.setItem('combat-tracker:selectedEncounterId', 'missing');

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    expect(result.current.selectedEncounterId).toBeNull();
  });

  it('creates a new encounter and updates selection', async () => {
    listEncountersMock.mockResolvedValue([]);
    const createdAt = new Date().toISOString();
    const summary = {
      id: 'enc-new',
      name: 'Dragon Lair',
      createdAt,
      updatedAt: createdAt
    };
    createEncounterMock.mockResolvedValue(summary);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    await act(async () => {
      const created = await result.current.createEncounter('Dragon Lair');
      expect(created).toEqual(summary);
    });

    expect(result.current.encounters[0]).toEqual(summary);
    expect(result.current.selectedEncounterId).toBe('enc-new');
  });

  it('handles API failure when creating encounter', async () => {
    listEncountersMock.mockResolvedValue([]);
    createEncounterMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    await act(async () => {
      const created = await result.current.createEncounter('Broken');
      expect(created).toBeNull();
    });

    expect(result.current.error).toBe('Encounter creation failed.');
  });

  it('rejects encounter mutations when user is not authenticated', async () => {
    authState.user = null;
    listEncountersMock.mockResolvedValue([]);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    expect(listEncountersMock).not.toHaveBeenCalled();

    await act(async () => {
      const created = await result.current.createEncounter('Forbidden');
      expect(created).toBeNull();
    });

    expect(createEncounterMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/signed in/i);
    expect(result.current.encounters).toEqual([]);
  });

  it('renames encounters and handles API failures', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'Old', createdAt: now, updatedAt: now }
    ]);
    const renamedSummary = { id: 'enc-1', name: 'New', createdAt: now, updatedAt: now };
    renameEncounterMock.mockResolvedValue(renamedSummary);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    await act(async () => {
      const updated = await result.current.renameEncounter('enc-1', 'New');
      expect(updated).toEqual(renamedSummary);
    });

    expect(result.current.encounters[0].name).toBe('New');

    renameEncounterMock.mockResolvedValueOnce(null);
    await act(async () => {
      const updateFailure = await result.current.renameEncounter('enc-1', 'Broken');
      expect(updateFailure).toBeNull();
    });
    expect(result.current.error).toBe('Encounter rename failed.');
  });

  it('deletes encounters and clears selection when necessary', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'One', createdAt: now, updatedAt: now },
      { id: 'enc-2', name: 'Two', createdAt: now, updatedAt: now }
    ]);
    deleteEncounterMock.mockResolvedValue(true);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    act(() => {
      result.current.selectEncounter('enc-1');
    });

    await act(async () => {
      const removed = await result.current.deleteEncounter('enc-1');
      expect(removed).toBe(true);
    });

    expect(result.current.encounters).toHaveLength(1);
    expect(result.current.selectedEncounterId).toBeNull();
    expect(window.localStorage.getItem('combat-tracker:selectedEncounterId')).toBeNull();

    deleteEncounterMock.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      const removed = await result.current.deleteEncounter('enc-2');
      expect(removed).toBe(false);
    });
    expect(result.current.error).toBe('network');
  });

  it('does not mutate state when delete API returns false', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'Keep', createdAt: now, updatedAt: now }
    ]);
    deleteEncounterMock.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    await act(async () => {
      const removed = await result.current.deleteEncounter('enc-1');
      expect(removed).toBe(false);
    });

    expect(result.current.encounters).toHaveLength(1);
  });

  it('persists selection to localStorage and receives storage events', async () => {
    const now = new Date().toISOString();
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'Stored', createdAt: now, updatedAt: now }
    ]);

    const { result } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());

    act(() => {
      result.current.selectEncounter('enc-1');
    });

    expect(window.localStorage.getItem('combat-tracker:selectedEncounterId')).toBe('enc-1');

    const event = new StorageEvent('storage', {
      key: 'combat-tracker:selectedEncounterId',
      newValue: 'enc-external'
    });
    window.dispatchEvent(event);

    await waitFor(() => expect(result.current.selectedEncounterId).toBe('enc-external'));
  });

  it('refreshes encounters to empty state when user logs out', async () => {
    listEncountersMock.mockResolvedValue([
      { id: 'enc-1', name: 'Will be cleared', createdAt: 'now', updatedAt: 'now' }
    ]);

    const { result, rerender } = renderHook(() => useEncounterContext(), { wrapper });
    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());
    expect(result.current.encounters).toHaveLength(1);

    authState.user = null;
    rerender();

    await waitFor(() => expect(result.current.encounters).toEqual([]));
    expect(result.current.selectedEncounterId).toBeNull();
  });

  it('records errors when refresh encounters fails', async () => {
    listEncountersMock.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useEncounterContext(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('network'));
    expect(result.current.encounters).toEqual([]);
  });

  it('removes storage listeners on unmount', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    listEncountersMock.mockResolvedValue([]);
    const { unmount } = renderHook(() => useEncounterContext(), { wrapper });

    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());
    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('skips refresh while bootstrapping without a user', async () => {
    authState.user = null;
    authState.isBootstrapping = true;
    listEncountersMock.mockResolvedValue([]);

    const { rerender } = renderHook(() => useEncounterContext(), { wrapper });

    expect(listEncountersMock).not.toHaveBeenCalled();

    authState.isBootstrapping = false;
    authState.user = { id: 'user-1', email: 'hero@example.com' };

    rerender();

    await waitFor(() => expect(listEncountersMock).toHaveBeenCalled());
  });
});
