import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type SupabaseAvailability =
  | {
      available: true;
      client: SupabaseClient;
      config: SupabaseConfig;
    }
  | {
      available: false;
      error: string;
    };

let cachedClient: SupabaseClient | null | undefined;

function normalizeEnvValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSupabaseConfig(
  env: Record<string, unknown> = import.meta.env
): SupabaseConfig | null {
  const url = normalizeEnvValue(env.vite_supabase_url ?? env.VITE_SUPABASE_URL);
  const anonKey = normalizeEnvValue(
    env.vite_supabase_anon_key ?? env.VITE_SUPABASE_ANON_KEY
  );

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

export function getSupabaseAvailability(): SupabaseAvailability {
  const config = resolveSupabaseConfig();

  if (!config) {
    return {
      available: false,
      error:
        "supabase env vars are missing. local-only mode still works, but cloud auth and sync are disabled.",
    };
  }

  if (cachedClient === undefined) {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  const client = cachedClient;

  if (!client) {
    return {
      available: false,
      error: "failed to initialize supabase client",
    };
  }

  return {
    available: true,
    client,
    config,
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const availability = getSupabaseAvailability();
  return availability.available ? availability.client : null;
}

export function initializeSupabaseAuth(): void {
  getSupabaseClient();
}
