import { useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';
import { exportAccountArchive, restoreAccountFromFile } from '../utils/accountBackup';

interface UseAccountBackupOptions {
  refreshCombatantLibrary: () => Promise<void> | void;
  refreshEncounters: () => Promise<void> | void;
  selectEncounter: (id: string | null) => void;
}

interface AccountBackupHook {
  isExporting: boolean;
  isImporting: boolean;
  exportAccount: () => Promise<void>;
  importAccountFromFile: (file: File) => Promise<void>;
  handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const useAccountBackup = ({
  refreshCombatantLibrary,
  refreshEncounters,
  selectEncounter
}: UseAccountBackupOptions): AccountBackupHook => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportAccount = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportAccountArchive();
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (result.skippedEncounters.length > 0) {
        window.alert(
          `Export completed with warnings. Skipped ${result.skippedEncounters.length} encounter${result.skippedEncounters.length === 1 ? '' : 's'} during export.`
        );
      }
    } catch (error) {
      console.error('Failed to export account archive', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred during export.';
      window.alert('Could not export account: ' + message);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const importAccountFromFile = useCallback(
    async (file: File) => {
      if (typeof window === 'undefined') {
        console.warn('Import is only available in the browser.');
        return;
      }
      if (isImporting) {
        return;
      }
      const confirmed = window.confirm(
        'Importing a backup will replace your current combatant library and encounters. Continue?'
      );
      if (!confirmed) {
        return;
      }

      setIsImporting(true);
      selectEncounter(null);
      try {
        const { summary, warnings } = await restoreAccountFromFile(file, {
          refreshCombatantLibrary,
          refreshEncounters,
          selectEncounter
        });

        if (warnings.length > 0) {
          window.alert(`${summary}\n\nWarnings:\n- ${warnings.join('\n- ')}`);
        } else {
          window.alert(summary);
        }
      } catch (error) {
        console.error('Failed to import account archive', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred during import.';
        window.alert('Could not import account: ' + message);
      } finally {
        setIsImporting(false);
      }
    },
    [isImporting, refreshCombatantLibrary, refreshEncounters, selectEncounter]
  );

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      await importAccountFromFile(file);
    },
    [importAccountFromFile]
  );

  return {
    isExporting,
    isImporting,
    exportAccount,
    importAccountFromFile,
    handleFileInputChange
  };
};
