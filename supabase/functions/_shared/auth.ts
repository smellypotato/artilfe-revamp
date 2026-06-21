import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";

export async function requireAuth(
  request: Request,
): Promise<{ user: User } | { response: Response }> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      response: jsonResponse({ error: "Missing authorization header." }, { status: 401 }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: jsonResponse({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { user };
}
