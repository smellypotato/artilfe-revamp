/**
 * Storage limit is NOT configured in this component.
 * This banner only displays when the storage-status Edge Function reports isWarning.
 *
 * To update the storage limit or warning threshold:
 *
 * 1. Open Supabase Dashboard → Project → Edge Functions → Secrets
 *    (or run: supabase secrets set KEY=value)
 *
 * 2. Set STORAGE_LIMIT_BYTES to your plan quota in bytes, e.g.:
 *    - Free (1 GB):  1073741824
 *    - Pro (100 GB): 107374182400
 *
 * 3. Optional: set STORAGE_WARNING_THRESHOLD (default 0.95 = 95%), e.g. 0.9 for 90%
 *
 * 4. Optional: set STORAGE_BUCKET if the bucket name is not "images"
 *
 * 5. Redeploy is not required for secret-only changes; they apply on next function cold start.
 *    If you changed supabase/functions/storage-status/index.ts defaults, run:
 *    supabase functions deploy storage-status
 *
 * Source: supabase/functions/storage-status/index.ts
 */
import { useEffect, useState } from "react";
import "../Styles/StorageWarning.css";
import {
  subscribeStorageStatus,
  type StorageStatus,
} from "../services/storageStatusService";

export function StorageWarning() {
  const [status, setStatus] = useState<StorageStatus | null>(null);

  useEffect(() => subscribeStorageStatus(setStatus), []);

  if (!status?.isWarning) return null;

  return (
    <aside className="StorageWarning" role="status" aria-live="polite">
      <strong>儲存空間警告</strong>
      <p>
        圖片儲存已使用 {status.usedPercent}%（上限 {status.warningThresholdPercent}%）。
        請通知管理員處理。
      </p>
    </aside>
  );
}
