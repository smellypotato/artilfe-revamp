import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";
const supabase = createClient(supabaseUrl, serviceKey);

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function sanitize(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  const authResult = await requireAuth(request);
  if ("response" in authResult) return authResult.response;

  try {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, { status: 405 });
    }

    const formData = await request.formData();
    const categoryKey = String(formData.get("categoryKey") ?? "");
    const itemId = String(formData.get("itemId") ?? "");
    const file = formData.get("file");

    if (!categoryKey || !itemId || !(file instanceof File)) {
      return jsonResponse({ error: "Missing categoryKey, itemId, or file." }, { status: 400 });
    }

    const extension =
      extensionByType[file.type] ??
      file.name.split(".").pop()?.toLowerCase() ??
      "bin";
    const imagePath = `${sanitize(categoryKey)}/${sanitize(itemId)}.${extension}`;

    const { error } = await supabase.storage
      .from("images")
      .upload(imagePath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("images").getPublicUrl(imagePath);

    return jsonResponse({
      path: imagePath,
      publicUrl: data.publicUrl,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
