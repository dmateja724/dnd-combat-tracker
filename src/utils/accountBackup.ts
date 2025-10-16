import JSZip from 'jszip';
import { createCombatantTemplate, deleteCombatantTemplate, listCombatantTemplates } from '../data/combatantLibrary';
import {
  createEncounter,
  deleteEncounter,
  listEncounters,
  loadEncounter,
  saveEncounter,
  type EncounterSummary
} from '../data/encounterDb';
import type { CombatantLibraryExport, CombatantTemplateInput, CombatantType, EncounterState } from '../types';

interface AccountMetadata {
  version: 1;
  exportedAt: string;
  encounterCount: number;
  templateCount: number;
}

interface EncounterExportPayload {
  version: 1;
  exportedAt: string;
  encounter: EncounterSummary;
  state: EncounterState;
}

export interface AccountExportResult {
  blob: Blob;
  fileName: string;
  exportedAt: string;
  encounterCount: number;
  templateCount: number;
  skippedEncounters: string[];
}

export interface AccountImportResult {
  templateCount: number;
  encounterCount: number;
  createdEncounters: { id: string; name: string }[];
  errors: string[];
}

export interface AccountRestoreOptions {
  refreshCombatantLibrary?: () => Promise<void> | void;
  refreshEncounters?: () => Promise<void> | void;
  selectEncounter?: (id: string | null) => void;
}

export interface AccountRestoreOutcome {
  summary: string;
  warnings: string[];
  defaultEncounterId: string | null;
  result: AccountImportResult;
}

const sanitizeFileName = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'encounter';
};

const toTemplateInput = (template: unknown): CombatantTemplateInput | null => {
  if (!template || typeof template !== 'object') {
    return null;
  }
  const record = template as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const type = record.type;
  if (!name) return null;
  if (type !== 'player' && type !== 'ally' && type !== 'enemy' && type !== 'boss') return null;

  const initiativeValue = Number(record.defaultInitiative);
  const maxHpValue = Number(record.maxHp);
  if (!Number.isFinite(initiativeValue) || !Number.isFinite(maxHpValue) || maxHpValue <= 0) {
    return null;
  }

  const acInput = record.ac;
  let ac: number | null | undefined = null;
  if (acInput === null || acInput === undefined || acInput === '') {
    ac = null;
  } else {
    const numericAc = Number(acInput);
    if (!Number.isFinite(numericAc) || numericAc < 0) {
      return null;
    }
    ac = Math.round(numericAc);
  }

  const icon = typeof record.icon === 'string' && record.icon.trim() ? record.icon : '⚔️';
  const note = typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined;

  return {
    name,
    type: type as CombatantType,
    defaultInitiative: Math.round(initiativeValue),
    maxHp: Math.max(1, Math.round(maxHpValue)),
    ac,
    icon,
    note
  };
};

const parseEncounterExport = (value: unknown): EncounterExportPayload | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  if (typeof record.exportedAt !== 'string') return null;
  const encounter = record.encounter;
  if (typeof encounter !== 'object' || encounter === null) return null;
  const encounterRecord = encounter as Record<string, unknown>;
  if (typeof encounterRecord.id !== 'string' || typeof encounterRecord.name !== 'string') return null;
  if (typeof encounterRecord.createdAt !== 'string' || typeof encounterRecord.updatedAt !== 'string') return null;
  const state = record.state as EncounterState | undefined;
  if (!state || !Array.isArray(state.combatants) || typeof state.round !== 'number') {
    return null;
  }
  return {
    version: 1,
    exportedAt: record.exportedAt,
    encounter: {
      id: encounterRecord.id,
      name: encounterRecord.name,
      createdAt: encounterRecord.createdAt,
      updatedAt: encounterRecord.updatedAt
    },
    state
  };
};

export const exportAccountArchive = async (): Promise<AccountExportResult> => {
  const exportedAt = new Date().toISOString();
  const zip = new JSZip();

  const templates = await listCombatantTemplates();
  const libraryExport: CombatantLibraryExport = {
    version: 1,
    exportedAt,
    templates: templates.map((template) => ({
      name: template.name,
      type: template.type,
      defaultInitiative: template.defaultInitiative,
      maxHp: template.maxHp,
      ac: template.ac ?? null,
      icon: template.icon,
      note: template.note ?? undefined
    }))
  };

  zip.file('combatant-library.json', JSON.stringify(libraryExport, null, 2));

  const encounters = await listEncounters();
  const encounterFolder = zip.folder('encounters');
  const skippedEncounters: string[] = [];

  for (const encounter of encounters) {
    const state = await loadEncounter(encounter.id);
    if (!state) {
      skippedEncounters.push(encounter.name);
      continue;
    }
    const payload: EncounterExportPayload = {
      version: 1,
      exportedAt,
      encounter,
      state
    };
    const safeName = sanitizeFileName(encounter.name || 'encounter');
    const fileName = `${safeName}-${encounter.id}.json`;
    encounterFolder?.file(fileName, JSON.stringify(payload, null, 2));
  }

  const metadata: AccountMetadata = {
    version: 1,
    exportedAt,
    encounterCount: encounters.length,
    templateCount: templates.length
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = `combat-tracker-backup-${exportedAt.slice(0, 10)}.zip`;

  return {
    blob,
    fileName,
    exportedAt,
    encounterCount: encounters.length,
    templateCount: templates.length,
    skippedEncounters
  };
};

export const importAccountArchive = async (file: File): Promise<AccountImportResult> => {
  const errors: string[] = [];
  const createdEncounters: { id: string; name: string }[] = [];

  const zip = await JSZip.loadAsync(file);
  const libraryFile = zip.file('combatant-library.json');
  if (!libraryFile) {
    throw new Error('Archive is missing combatant-library.json');
  }

  let libraryPayload: CombatantLibraryExport | null = null;
  try {
    const text = await libraryFile.async('string');
    const parsed = JSON.parse(text) as CombatantLibraryExport;
    if (parsed.version !== 1 || !Array.isArray(parsed.templates)) {
      throw new Error('Unsupported library file format.');
    }
    libraryPayload = parsed;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to parse combatant library file.');
  }

  const encounterEntries = zip.filter((path) => path.startsWith('encounters/') && path.endsWith('.json'));
  const encounterPayloads: EncounterExportPayload[] = [];

  for (const entry of encounterEntries) {
    try {
      const text = await entry.async('string');
      const parsed = JSON.parse(text) as unknown;
      const payload = parseEncounterExport(parsed);
      if (payload) {
        encounterPayloads.push(payload);
      } else {
        errors.push(`Skipped invalid encounter file: ${entry.name}`);
      }
    } catch (error) {
      errors.push(`Failed to parse encounter file: ${entry.name}`);
    }
  }

  const existingTemplates = await listCombatantTemplates();
  for (const template of existingTemplates) {
    await deleteCombatantTemplate(template.id);
  }

  const existingEncounters = await listEncounters();
  for (const encounter of existingEncounters) {
    await deleteEncounter(encounter.id);
  }

  let templateCount = 0;
  if (libraryPayload) {
    for (const template of libraryPayload.templates) {
      const normalized = toTemplateInput(template);
      if (!normalized) {
        errors.push(`Skipped invalid template: ${template?.name ?? 'Unknown'}`);
        continue;
      }
      const created = await createCombatantTemplate(normalized);
      if (created) {
        templateCount += 1;
      } else {
        errors.push(`Failed to import template: ${normalized.name}`);
      }
    }
  }

  let encounterCount = 0;

  for (const payload of encounterPayloads) {
    const summary = await createEncounter(payload.encounter.name);
    if (!summary) {
      errors.push(`Failed to recreate encounter: ${payload.encounter.name}`);
      continue;
    }
    try {
      await saveEncounter(summary.id, payload.state);
      encounterCount += 1;
      createdEncounters.push({ id: summary.id, name: summary.name });
    } catch (error) {
      errors.push(`Failed to restore encounter state: ${payload.encounter.name}`);
    }
  }

  return {
    templateCount,
    encounterCount,
    createdEncounters,
    errors
  };
};

export const restoreAccountFromFile = async (
  file: File,
  options: AccountRestoreOptions
): Promise<AccountRestoreOutcome> => {
  const result = await importAccountArchive(file);

  if (options.refreshCombatantLibrary) {
    await options.refreshCombatantLibrary();
  }
  if (options.refreshEncounters) {
    await options.refreshEncounters();
  }

  const defaultEncounterId = result.createdEncounters[0]?.id ?? null;
  if (defaultEncounterId && options.selectEncounter) {
    options.selectEncounter(defaultEncounterId);
  }

  const summary =
    `Imported ${result.templateCount} combatant template${result.templateCount === 1 ? '' : 's'} ` +
    `and ${result.encounterCount} encounter${result.encounterCount === 1 ? '' : 's'}.`;

  return {
    summary,
    warnings: result.errors,
    defaultEncounterId,
    result
  };
};
