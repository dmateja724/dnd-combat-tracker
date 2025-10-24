import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { exportAccountArchive, importAccountArchive, restoreAccountFromFile } from './accountBackup';
import type { CombatantTemplate, EncounterState } from '../types';
import type { EncounterSummary } from '../data/encounterDb';

const mockTemplates: CombatantTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Warrior',
    type: 'ally',
    defaultInitiative: 12,
    maxHp: 30,
    ac: 16,
    icon: '🛡️',
    note: 'Front line',
    createdAt: 'now',
    updatedAt: 'now'
  }
];

const encounterSummary = (overrides?: Partial<EncounterSummary>): EncounterSummary => ({
  id: 'enc-1',
  name: 'Battle',
  createdAt: 'now',
  updatedAt: 'now',
  ...overrides
});

const encounterState: EncounterState = {
  combatants: [
    {
      id: 'c1',
      name: 'Fighter',
      type: 'player',
      initiative: 15,
      hp: { current: 30, max: 30 },
      ac: 17,
      icon: '🗡️',
      statuses: [],
      deathSaves: null
    }
  ],
  activeCombatantId: 'c1',
  round: 1,
  startedAt: new Date().toISOString(),
  log: []
};

type CombatantLibraryModule = typeof import('../data/combatantLibrary');
type EncounterDbModule = typeof import('../data/encounterDb');

const combatantLibraryMocks = vi.hoisted(() => {
  const listCombatantTemplates = vi.fn<
    Parameters<CombatantLibraryModule['listCombatantTemplates']>,
    ReturnType<CombatantLibraryModule['listCombatantTemplates']>
  >(async () => mockTemplates);
  const deleteCombatantTemplate = vi.fn<
    Parameters<CombatantLibraryModule['deleteCombatantTemplate']>,
    ReturnType<CombatantLibraryModule['deleteCombatantTemplate']>
  >(async () => true);
  const createCombatantTemplate = vi.fn<
    Parameters<CombatantLibraryModule['createCombatantTemplate']>,
    ReturnType<CombatantLibraryModule['createCombatantTemplate']>
  >(async () => mockTemplates[0]);

  return {
    listCombatantTemplates,
    deleteCombatantTemplate,
    createCombatantTemplate
  };
});

const encounterDbMocks = vi.hoisted(() => {
  const listEncounters = vi.fn<
    Parameters<EncounterDbModule['listEncounters']>,
    ReturnType<EncounterDbModule['listEncounters']>
  >(async () => [encounterSummary()]);
  const deleteEncounter = vi.fn<
    Parameters<EncounterDbModule['deleteEncounter']>,
    ReturnType<EncounterDbModule['deleteEncounter']>
  >(async () => true);
  const createEncounter = vi.fn<
    Parameters<EncounterDbModule['createEncounter']>,
    ReturnType<EncounterDbModule['createEncounter']>
  >(async (name?: string) => encounterSummary({ id: `enc-${name}`, name: name ?? 'Imported' }));
  const loadEncounter = vi.fn<
    Parameters<EncounterDbModule['loadEncounter']>,
    ReturnType<EncounterDbModule['loadEncounter']>
  >(async () => encounterState);
  const saveEncounter = vi.fn<
    Parameters<EncounterDbModule['saveEncounter']>,
    ReturnType<EncounterDbModule['saveEncounter']>
  >(async () => undefined);

  return {
    listEncounters,
    deleteEncounter,
    createEncounter,
    loadEncounter,
    saveEncounter
  };
});

vi.mock('../data/combatantLibrary', () => combatantLibraryMocks);

vi.mock('../data/encounterDb', () => encounterDbMocks);

const { listCombatantTemplates, deleteCombatantTemplate, createCombatantTemplate } = combatantLibraryMocks;
const { listEncounters, deleteEncounter, createEncounter, loadEncounter, saveEncounter } = encounterDbMocks;

const buildArchive = async (options?: { invalidTemplate?: boolean; brokenEncounter?: boolean }) => {
  const zip = new JSZip();
  const libraryExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: [
      {
        name: 'Warrior',
        type: 'ally',
        defaultInitiative: 12,
        maxHp: 30,
        ac: 16,
        icon: '🛡️',
        note: 'Front line'
      },
      ...(options?.invalidTemplate
        ? [
            {
              name: '',
              type: 'invalid',
              defaultInitiative: 'bad',
              maxHp: -1,
              icon: '',
              note: ''
            }
          ]
        : [])
    ]
  };
  zip.file('combatant-library.json', JSON.stringify(libraryExport));

  const encounterFolder = zip.folder('encounters');
  if (encounterFolder) {
    encounterFolder.file(
      'battle-enc-archive.json',
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        encounter: encounterSummary(),
        state: encounterState
      })
    );
    if (options?.brokenEncounter) {
      encounterFolder.file('broken.json', JSON.stringify({ version: 99 }));
    }
  }

  zip.file(
    'metadata.json',
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      encounterCount: 1,
      templateCount: 1
    })
  );

  const data = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([data], 'backup.zip', { type: 'application/zip' });
};

describe('accountBackup utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports account archives with encounters and templates', async () => {
    listEncounters.mockResolvedValueOnce([
      encounterSummary({ id: 'enc-1', name: 'Battle of Neverwinter!!!' }),
      encounterSummary({ id: 'enc-2', name: 'Skipped Encounter' })
    ]);
    loadEncounter.mockResolvedValueOnce(encounterState);
    loadEncounter.mockResolvedValueOnce(null);

    const result = await exportAccountArchive();

    expect(listCombatantTemplates).toHaveBeenCalled();
    expect(listEncounters).toHaveBeenCalled();
    expect(loadEncounter).toHaveBeenCalledTimes(2);
    expect(result.skippedEncounters).toEqual(['Skipped Encounter']);
    expect(result.encounterCount).toBe(2);

    const zipContents = await JSZip.loadAsync(result.blob);
    const library = await zipContents.file('combatant-library.json')?.async('string');
    expect(library).toContain('Warrior');
    const encounterFiles = zipContents.folder('encounters')?.filter(() => true) ?? [];
    expect(encounterFiles.some((entry) => entry.name.includes('battle-of-neverwinter'))).toBe(true);
  });

  it('imports account archives and reports warnings', async () => {
    listCombatantTemplates.mockResolvedValueOnce(mockTemplates);
    listEncounters.mockResolvedValueOnce([encounterSummary({ id: 'old', name: 'Old Encounter' })]);
    saveEncounter.mockRejectedValueOnce(new Error('persist fail'));
    const file = await buildArchive({ invalidTemplate: true, brokenEncounter: true });

    const outcome = await importAccountArchive(file);

    expect(deleteCombatantTemplate).toHaveBeenCalledWith('tmpl-1');
    expect(deleteEncounter).toHaveBeenCalledWith('old');
    expect(createCombatantTemplate).toHaveBeenCalled();
    expect(createEncounter).toHaveBeenCalled();
    expect(saveEncounter).toHaveBeenCalled();
    expect(outcome.templateCount).toBeGreaterThan(0);
    expect(outcome.encounterCount).toBe(0);
    expect(outcome.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Failed to restore encounter state'),
        expect.stringContaining('Skipped invalid template')
      ])
    );
  });

  it('records failures when new encounters cannot be created', async () => {
    createEncounter.mockResolvedValueOnce(null);
    const file = await buildArchive();

    const outcome = await importAccountArchive(file);

    expect(outcome.errors).toContainEqual(expect.stringContaining('Failed to recreate encounter'));
  });

  it('restores account archives and triggers callbacks', async () => {
    const file = await buildArchive({ brokenEncounter: true });
    const refreshCombatantLibrary = vi.fn();
    const refreshEncounters = vi.fn();
    const selectEncounter = vi.fn();

    const outcome = await restoreAccountFromFile(file, {
      refreshCombatantLibrary,
      refreshEncounters,
      selectEncounter
    });

    expect(refreshCombatantLibrary).toHaveBeenCalled();
    expect(refreshEncounters).toHaveBeenCalled();
    expect(selectEncounter).toHaveBeenCalledWith(expect.stringContaining('enc-'));
    expect(outcome.summary).toContain('Imported');
  });

  it('restores account even when no encounters are recreated', async () => {
    createEncounter.mockResolvedValueOnce(null);
    const file = await buildArchive();

    const refresh = vi.fn();
    const outcome = await restoreAccountFromFile(file, {
      refreshCombatantLibrary: refresh,
      refreshEncounters: refresh
    });

    expect(outcome.defaultEncounterId).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('throws when combatant library file is missing', async () => {
    const zip = new JSZip();
    const encounterFolder = zip.folder('encounters');
    encounterFolder?.file('enc.json', JSON.stringify({ version: 1, encounter: encounterSummary(), state: encounterState }));
    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([data], 'invalid.zip', { type: 'application/zip' });

    await expect(importAccountArchive(file)).rejects.toThrow(/combatant-library.json/);
  });
});
