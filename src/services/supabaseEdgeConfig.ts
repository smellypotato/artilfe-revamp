function requireEnv(name: string) {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill in your Supabase values.`);
  }
  return value;
}

export const supabaseEdgeConfig = {
  url: requireEnv("VITE_SUPABASE_URL"),
  publishableKey: requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
};
