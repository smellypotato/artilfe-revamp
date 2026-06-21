const DEFAULT_RECORD_PREVIEW_LIMIT = 3;

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const appConfig = {
  recordPreviewLimit: readPositiveInteger(
    import.meta.env.VITE_DASHBOARD_RECORD_LIMIT,
    DEFAULT_RECORD_PREVIEW_LIMIT,
  ),
};
