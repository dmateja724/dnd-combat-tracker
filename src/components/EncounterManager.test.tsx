import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EncounterManager from './EncounterManager';

const encounterContextMock: any = {
  encounters: [],
  selectedEncounterId: null as string | null,
  selectedEncounter: null,
  isLoading: false,
  error: null as string | null,
  refreshEncounters: vi.fn().mockResolvedValue(undefined),
  selectEncounter: vi.fn(),
  createEncounter: vi.fn().mockResolvedValue(null),
  deleteEncounter: vi.fn().mockResolvedValue(true),
  renameEncounter: vi.fn().mockResolvedValue(null)
};

const combatantLibraryMock: any = {
  refresh: vi.fn().mockResolvedValue(undefined)
};

const restoreAccountFromFile = vi.fn().mockResolvedValue({
  summary: 'Imported 1 template and 1 encounter.',
  warnings: [],
  defaultEncounterId: 'default',
  result: {
    templateCount: 1,
    encounterCount: 1,
    createdEncounters: [{ id: 'default', name: 'Restored' }],
    errors: []
  }
});
vi.mock('../utils/accountBackup', () => ({
  restoreAccountFromFile: (...args: unknown[]) => restoreAccountFromFile(...args)
}));

vi.mock('../context/EncounterContext', () => ({
  useEncounterContext: () => encounterContextMock
}));

vi.mock('../context/CombatantLibraryContext', () => ({
  useCombatantLibrary: () => combatantLibraryMock
}));

describe('EncounterManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    encounterContextMock.encounters = [];
    encounterContextMock.selectedEncounterId = null;
    encounterContextMock.selectedEncounter = null;
    encounterContextMock.isLoading = false;
    encounterContextMock.error = null;
    encounterContextMock.refreshEncounters = vi.fn().mockResolvedValue(undefined);
    encounterContextMock.selectEncounter = vi.fn();
    encounterContextMock.createEncounter = vi.fn().mockResolvedValue({
      id: 'enc-123',
      name: 'Created Encounter',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    encounterContextMock.deleteEncounter = vi.fn().mockResolvedValue(true);
    encounterContextMock.renameEncounter = vi.fn().mockResolvedValue(null);
    combatantLibraryMock.refresh = vi.fn().mockResolvedValue(undefined);
    restoreAccountFromFile.mockResolvedValue({
      summary: 'Imported 1 template and 1 encounter.',
      warnings: [],
      defaultEncounterId: 'default',
      result: {
        templateCount: 1,
        encounterCount: 1,
        createdEncounters: [{ id: 'default', name: 'Restored' }],
        errors: []
      }
    });
    // @ts-expect-error jsdom globals
    window.confirm = vi.fn().mockReturnValue(true);
    // @ts-expect-error jsdom globals
    window.prompt = vi.fn();
    // @ts-expect-error jsdom globals
    window.alert = vi.fn();
  });

  it('refreshes encounters on mount', async () => {
    render(<EncounterManager />);

    await waitFor(() => expect(encounterContextMock.refreshEncounters).toHaveBeenCalled());
  });

  it('manually refreshes encounters via the refresh button', async () => {
    render(<EncounterManager />);

    await userEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    expect(encounterContextMock.refreshEncounters).toHaveBeenCalledTimes(2);
  });

  it('shows loading indicator when encounters are fetching', () => {
    encounterContextMock.isLoading = true;
    render(<EncounterManager />);

    expect(screen.getByText(/Loading encounters/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refreshing/ })).toBeDisabled();
  });

  it('displays context errors when present', () => {
    encounterContextMock.error = 'Server unavailable';
    render(<EncounterManager />);

    expect(screen.getByText(/Server unavailable/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no encounters', () => {
    render(<EncounterManager />);

    expect(
      screen.getByText(/No encounters yet\. Create one above or import a saved account/i)
    ).toBeInTheDocument();
  });

  it('creates a new encounter with trimmed name', async () => {
    render(<EncounterManager />);
    const user = userEvent.setup();

    const input = screen.getByLabelText(/Create Encounter/i);
    await user.type(input, '  Forest Ambush  ');
    await user.click(screen.getByRole('button', { name: /Create Encounter/i }));

    await waitFor(() => expect(encounterContextMock.createEncounter).toHaveBeenCalledWith('Forest Ambush'));
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('does not close modal when encounter creation fails', async () => {
    encounterContextMock.createEncounter = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    render(<EncounterManager onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Create Encounter/i), 'Failed Encounter');
    await userEvent.click(screen.getByRole('button', { name: /Create Encounter/i }));

    await waitFor(() => expect(encounterContextMock.createEncounter).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Create Encounter/i) as HTMLInputElement).value).toBe('Failed Encounter');
  });

  it('invokes onClose after successful encounter creation when allowed', async () => {
    const onClose = vi.fn();
    render(<EncounterManager onClose={onClose} />);

    await userEvent.type(screen.getByLabelText(/Create Encounter/i), 'Success');
    await userEvent.click(screen.getByRole('button', { name: /Create Encounter/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('opens an encounter and invokes callbacks', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-1',
        name: 'Goblin Raid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const onClose = vi.fn();
    render(<EncounterManager onClose={onClose} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(encounterContextMock.selectEncounter).toHaveBeenCalledWith('enc-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps modal open when disableClose is set', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-1',
        name: 'Stay Open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    const onClose = vi.fn();
    render(<EncounterManager onClose={onClose} disableClose />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(encounterContextMock.selectEncounter).toHaveBeenCalledWith('enc-1');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays validation error for empty encounter name', async () => {
    render(<EncounterManager />);

    fireEvent.submit(screen.getByRole('button', { name: /Create Encounter/i }).closest('form') as HTMLFormElement);

    expect(screen.getByText(/Please provide a name/)).toBeInTheDocument();
    expect(encounterContextMock.createEncounter).not.toHaveBeenCalled();
  });

  it('renames encounter when prompt returns new value', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-2',
        name: 'Original Name',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    // @ts-expect-error test override
    window.prompt = vi.fn().mockReturnValue('Updated Name');

    render(<EncounterManager />);

    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(encounterContextMock.renameEncounter).toHaveBeenCalledWith('enc-2', 'Updated Name');
  });

  it('does not rename when prompt canceled', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-3',
        name: 'Keep Name',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    // @ts-expect-error test override
    window.prompt = vi.fn().mockReturnValue(null);

    render(<EncounterManager />);

    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(encounterContextMock.renameEncounter).not.toHaveBeenCalled();
  });

  it('does not rename when prompt returns same name', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-4',
        name: 'Same Name',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    // @ts-expect-error test override
    window.prompt = vi.fn().mockReturnValue('Same Name');

    render(<EncounterManager />);

    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(encounterContextMock.renameEncounter).not.toHaveBeenCalled();
  });

  it('handles delete flow and refresh when disableClose is true', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-delete',
        name: 'Delete Me',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    encounterContextMock.selectedEncounterId = 'enc-delete';
    encounterContextMock.deleteEncounter = vi.fn().mockResolvedValue(true);

    encounterContextMock.selectEncounter = vi.fn();
    render(<EncounterManager disableClose />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(encounterContextMock.deleteEncounter).toHaveBeenCalledWith('enc-delete');
    expect(encounterContextMock.refreshEncounters).toHaveBeenCalledTimes(2);
  });

  it('does not delete encounter when confirmation is declined', async () => {
    encounterContextMock.encounters = [
      {
        id: 'enc-deny',
        name: 'Keep',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    // @ts-expect-error test override
    window.confirm = vi.fn().mockReturnValue(false);

    render(<EncounterManager />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(encounterContextMock.deleteEncounter).not.toHaveBeenCalled();
  });

  it('triggers file input for account import', async () => {
    render(<EncounterManager />);
    const importButton = screen.getByRole('button', { name: /Import Account/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const clickSpy = vi.spyOn(fileInput, 'click');

    await userEvent.click(importButton);

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('does not trigger multiple file dialogs while importing', async () => {
    let resolveImport: (value: unknown) => void = () => {};
    restoreAccountFromFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );

    render(<EncounterManager />);
    const importButton = screen.getByRole('button', { name: /Import Account/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    await userEvent.click(importButton);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const file = new File(['zip'], 'backup.zip', { type: 'application/zip' });
    await fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /Importing/ })).toBeDisabled());

    await userEvent.click(importButton);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    resolveImport({
      summary: 'Done',
      warnings: [],
      defaultEncounterId: 'enc-imported',
      result: {
        templateCount: 1,
        encounterCount: 1,
        createdEncounters: [{ id: 'enc-imported', name: 'Imported Encounter' }],
        errors: []
      }
    });
  });

  it('cancels account import when user declines confirm', async () => {
    const file = new File(['zip'], 'backup.zip', { type: 'application/zip' });
    // @ts-expect-error test override
    window.confirm = vi.fn().mockReturnValue(false);
    render(<EncounterManager />);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(hiddenInput, { target: { files: [file] } });

    expect(window.confirm).toHaveBeenCalled();
    expect(restoreAccountFromFile).not.toHaveBeenCalled();
  });

  it('ignores account import when no file is selected', async () => {
    render(<EncounterManager />);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(hiddenInput, { target: { files: [] } });

    expect(restoreAccountFromFile).not.toHaveBeenCalled();
  });

  it('imports account and reports warnings', async () => {
    const warnings = ['Template skipped'];
    restoreAccountFromFile.mockResolvedValueOnce({
      summary: 'Imported with warnings',
      warnings,
      defaultEncounterId: 'restored',
      result: {
        templateCount: 1,
        encounterCount: 1,
        createdEncounters: [{ id: 'restored', name: 'Restored Encounter' }],
        errors: warnings
      }
    });
    const file = new File(['zip'], 'backup.zip', { type: 'application/zip' });
    const selectSpy = encounterContextMock.selectEncounter;
    render(<EncounterManager />);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => expect(restoreAccountFromFile).toHaveBeenCalled());
    expect(selectSpy).toHaveBeenCalledWith(null);
    const [, options] = restoreAccountFromFile.mock.calls[0] ?? [];
    expect(options).toMatchObject({
      selectEncounter: encounterContextMock.selectEncounter
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Warnings'));
  });

  it('passes through errors during account import', async () => {
    restoreAccountFromFile.mockRejectedValueOnce(new Error('bad import'));
    const file = new File(['zip'], 'backup.zip', { type: 'application/zip' });
    const selectSpy = encounterContextMock.selectEncounter;
    render(<EncounterManager disableClose />);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(hiddenInput, { target: { files: [file] } });

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Could not import account')));
    expect(selectSpy).toHaveBeenCalledWith(null);
  });

  it('alerts summary when import completes without warnings', async () => {
    restoreAccountFromFile.mockResolvedValueOnce({
      summary: 'Imported successfully',
      warnings: [],
      defaultEncounterId: 'restored-clean',
      result: {
        templateCount: 1,
        encounterCount: 1,
        createdEncounters: [{ id: 'restored-clean', name: 'Restored Clean' }],
        errors: []
      }
    });
    render(<EncounterManager />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(fileInput, { target: { files: [new File(['zip'], 'backup.zip')] } });

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Imported successfully'));
  });

});
