import { useEffect, useState } from 'react';
import type { DisplayInfo } from '../../shared/types';

export function useDisplays() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.windowSaver.listDisplays().then((d) => {
      if (!cancelled) setDisplays(d);
    });
    const unsubscribe = window.windowSaver.onDisplaysChanged((d) => setDisplays(d));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return displays;
}
