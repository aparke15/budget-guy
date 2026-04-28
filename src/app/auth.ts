import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

import { getSupabaseAvailability } from "./supabase";

type AuthResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

type SessionResult =
  | {
      success: true;
      session: Session | null;
      user: User | null;
    }
  | {
      success: false;
      error: string;
    };

type ResolvedClientResult =
  | {
      success: true;
      client: SupabaseClient;
    }
  | {
      success: false;
      error: string;
    };

function resolveClient(client?: SupabaseClient): ResolvedClientResult {
  if (client) {
    return {
      success: true,
      client,
    };
  }

  const availability = getSupabaseAvailability();

  if (!availability.available) {
    return {
      success: false,
      error: availability.error,
    };
  }

  return {
    success: true,
    client: availability.client,
  };
}

function getAuthErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function sendMagicLinkSignIn(
  email: string,
  client?: SupabaseClient
): Promise<AuthResult> {
  const resolved = resolveClient(client);

  if (!resolved.success || !resolved.client) {
    return resolved;
  }

  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await resolved.client.auth.signInWithOtp({
    email,
    options: redirectTo
      ? {
          emailRedirectTo: redirectTo,
        }
      : undefined,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}

export async function signOut(client?: SupabaseClient): Promise<AuthResult> {
  const resolved = resolveClient(client);

  if (!resolved.success || !resolved.client) {
    return resolved;
  }

  const { error } = await resolved.client.auth.signOut();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}

export async function getCurrentSession(client?: SupabaseClient): Promise<SessionResult> {
  const resolved = resolveClient(client);

  if (!resolved.success) {
    return resolved;
  }

  try {
    const { data, error } = await resolved.client.auth.getSession();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      session: data.session,
      user: data.session?.user ?? null,
    };
  } catch (error) {
    return {
      success: false,
      error: getAuthErrorMessage(error, "failed to read current auth session"),
    };
  }
}

export function subscribeToAuthStateChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
  client?: SupabaseClient
): () => void {
  const resolved = resolveClient(client);

  if (!resolved.success || !resolved.client) {
    return () => {};
  }

  const subscription = resolved.client.auth.onAuthStateChange(callback);

  return () => {
    subscription.data.subscription.unsubscribe();
  };
}
