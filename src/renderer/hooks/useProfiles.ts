import { useCallback, useEffect, useState } from 'react';
import type { Profile, Step } from '../../shared/types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await window.windowSaver.listProfiles();
    setProfiles(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProfile = useCallback(
    async (name: string) => {
      await window.windowSaver.createProfile(name);
      await refresh();
    },
    [refresh],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      await window.windowSaver.deleteProfile(id);
      await refresh();
    },
    [refresh],
  );

  const updateProfile = useCallback(
    async (id: string, changes: Partial<Pick<Profile, 'name' | 'hotkey' | 'steps'>>) => {
      await window.windowSaver.updateProfile(id, changes);
      await refresh();
    },
    [refresh],
  );

  const setSteps = useCallback(
    async (id: string, steps: Step[]) => {
      await updateProfile(id, { steps });
    },
    [updateProfile],
  );

  const runProfile = useCallback(async (id: string) => {
    return window.windowSaver.runProfile(id);
  }, []);

  const stopProfile = useCallback(async (id: string) => {
    return window.windowSaver.stopProfile(id);
  }, []);

  return { profiles, loading, refresh, createProfile, deleteProfile, updateProfile, setSteps, runProfile, stopProfile };
}
