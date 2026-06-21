import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";
const supabase = createClient(supabaseUrl, serviceKey);

const DEFAULT_BUCKET = Deno.env.get("STORAGE_BUCKET") ?? "images";
const DEFAULT_LIMIT_BYTES = Number(
  Deno.env.get("STORAGE_LIMIT_BYTES") ?? String(1024 * 1024 * 1024),
);
const WARNING_THRESHOLD = Number(
  Deno.env.get("STORAGE_WARNING_THRESHOLD") ?? "0.95",
);

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const authResult = await requireAuth(request);
  if ("response" in authResult) return authResult.response;

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const bucket = url.searchParams.get("bucket") ?? DEFAULT_BUCKET;
    const limitBytes = Number(
      url.searchParams.get("limitBytes") ?? DEFAULT_LIMIT_BYTES,
    );

    const { data, error } = await supabase.rpc("get_storage_bucket_usage", {
      bucket_name: bucket,
    });

    if (error) throw error;

    const usedBytes = Number(data ?? 0);
    const usedPercent =
      limitBytes > 0 ? Number(((usedBytes / limitBytes) * 100).toFixed(1)) : 0;
    const warningThresholdPercent = Math.round(WARNING_THRESHOLD * 100);
    const isWarning = usedBytes / limitBytes >= WARNING_THRESHOLD;

    return jsonResponse({
      bucket,
      usedBytes,
      limitBytes,
      usedPercent,
      warningThresholdPercent,
      isWarning,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
