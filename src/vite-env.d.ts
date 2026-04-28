/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly vite_supabase_url?: string;
  readonly vite_supabase_anon_key?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
