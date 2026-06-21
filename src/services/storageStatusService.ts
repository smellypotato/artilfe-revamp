import { getAuthHeaders, handleUnauthorizedResponse } from "./authService";
import { supabaseEdgeConfig } from "./supabaseEdgeConfig";

export interface StorageStatus {
  bucket: string;
  usedBytes: number;
  limitBytes: number;
  usedPercent: number;
  warningThresholdPercent: number;
  isWarning: boolean;
}

type StorageStatusListener = (status: StorageStatus | null) => void;

const storageStatusUrl = `${supabaseEdgeConfig.url}/functions/v1/storage-status`;
const listeners = new Set<StorageStatusListener>();
let latestStatus: StorageStatus | null = null;
let refreshPromise: Promise<StorageStatus | null> | null = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener(latestStatus);
  }
}

export function subscribeStorageStatus(listener: StorageStatusListener) {
  listeners.add(listener);
  listener(latestStatus);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshStorageStatus() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(storageStatusUrl, {
        headers: await getAuthHeaders(false),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (await handleUnauthorizedResponse(response)) {
          return latestStatus;
        }
        throw new Error(payload.error ?? "Unable to load storage status.");
      }

      latestStatus = payload as StorageStatus;
      notifyListeners();
      return latestStatus;
    } catch (error) {
      console.error("Unable to refresh storage status", error);
      return latestStatus;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function checkStorageAfterDataFetch() {
  void refreshStorageStatus();
}
