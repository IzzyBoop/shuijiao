import { useEffect, useState } from 'preact/hooks';

/**
 * App-wide states that the bottom banner reports. They come from outside the component
 * tree (the service worker, the database, Vite's chunk loader), so they live here
 * rather than in a component.
 */
export interface AppStatus {
  /** A new version is installed and waiting; calling this switches to it and reloads. */
  update: (() => void) | null;
  /**
   * This tab is out of date and must reload: the portal was updated in another tab
   * ('other-tab'), or a part of the page couldn't be loaded ('files-missing').
   */
  reload: 'other-tab' | 'files-missing' | null;
  /** A database upgrade is waiting for other open tabs of the portal to close. */
  blocked: boolean;
}

let status: AppStatus = { update: null, reload: null, blocked: false };
const listeners = new Set<(s: AppStatus) => void>();

export function setAppStatus(patch: Partial<AppStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function getAppStatus(): AppStatus {
  return status;
}

export function useAppStatus(): AppStatus {
  const [value, setValue] = useState(status);
  useEffect(() => {
    listeners.add(setValue);
    setValue(status); // in case it changed before this component subscribed
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
