import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { parsePersistedStateValue } from "./storage";
import { ensureLocalSnapshotInfo } from "./sync";
import { getSupabaseAvailability } from "./supabase";
import type {
  RemoteSnapshotMetadata,
  RemoteSnapshotRecord,
} from "./sync-types";
import type { PersistedState } from "../types";

type RemoteStorageResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

const remoteSnapshotMetadataRowSchema = z.object({
  user_id: z.string().min(1),
  schema_version: z.number().int(),
  updated_at: z.string(),
  device_id: z.string().nullable().optional(),
  snapshot_hash: z.string().min(1),
});

const remoteSnapshotRowSchema = remoteSnapshotMetadataRowSchema.extend({
  snapshot: z.unknown(),
});

function resolveClient(client?: SupabaseClient): RemoteStorageResult<SupabaseClient> {
  if (client) {
    return {
      success: true,
      data: client,
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
    data: availability.client,
  };
}

function isNoRowsError(error: { code?: string } | null): boolean {
  return error?.code === "PGRST116";
}

export function parseRemoteSnapshotMetadataRow(
  row: unknown
): RemoteStorageResult<RemoteSnapshotMetadata> {
  const parsed = remoteSnapshotMetadataRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "invalid remote snapshot metadata",
    };
  }

  return {
    success: true,
    data: {
      userId: parsed.data.user_id,
      schemaVersion: parsed.data.schema_version,
      updatedAt: parsed.data.updated_at,
      deviceId: parsed.data.device_id ?? "unknown-device",
      snapshotHash: parsed.data.snapshot_hash,
    },
  };
}

export function parseRemoteSnapshotRow(
  row: unknown
): RemoteStorageResult<RemoteSnapshotRecord> {
  const parsed = remoteSnapshotRowSchema.safeParse(row);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "invalid remote snapshot row",
    };
  }

  const migrated = parsePersistedStateValue(parsed.data.snapshot);

  if (!migrated.success) {
    return migrated;
  }

  return {
    success: true,
    data: {
      metadata: {
        userId: parsed.data.user_id,
        schemaVersion: parsed.data.schema_version,
        updatedAt: parsed.data.updated_at,
        deviceId: parsed.data.device_id ?? "unknown-device",
        snapshotHash: parsed.data.snapshot_hash,
      },
      snapshot: migrated.data,
    },
  };
}

export async function fetchRemoteSnapshotMetadata(
  userId: string,
  client?: SupabaseClient
): Promise<RemoteStorageResult<RemoteSnapshotMetadata | null>> {
  const resolved = resolveClient(client);

  if (!resolved.success) {
    return resolved;
  }

  const { data, error } = await resolved.data
    .from("user_snapshots")
    .select("user_id, schema_version, updated_at, device_id, snapshot_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data) {
    return {
      success: true,
      data: null,
    };
  }

  return parseRemoteSnapshotMetadataRow(data);
}

export async function fetchRemoteSnapshot(
  userId: string,
  client?: SupabaseClient
): Promise<RemoteStorageResult<RemoteSnapshotRecord | null>> {
  const resolved = resolveClient(client);

  if (!resolved.success) {
    return resolved;
  }

  const { data, error } = await resolved.data
    .from("user_snapshots")
    .select("user_id, schema_version, snapshot, updated_at, device_id, snapshot_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data) {
    return {
      success: true,
      data: null,
    };
  }

  return parseRemoteSnapshotRow(data);
}

export async function uploadRemoteSnapshot(
  userId: string,
  snapshot: PersistedState,
  client?: SupabaseClient
): Promise<RemoteStorageResult<RemoteSnapshotRecord>> {
  const resolved = resolveClient(client);

  if (!resolved.success) {
    return resolved;
  }

  const localSnapshotInfo = ensureLocalSnapshotInfo(snapshot);
  const updatedAt = new Date().toISOString();

  const { data, error } = await resolved.data
    .from("user_snapshots")
    .upsert(
      {
        user_id: userId,
        schema_version: snapshot.version,
        snapshot,
        updated_at: updatedAt,
        device_id: localSnapshotInfo.deviceId,
        snapshot_hash: localSnapshotInfo.snapshotHash,
      },
      {
        onConflict: "user_id",
      }
    )
    .select("user_id, schema_version, snapshot, updated_at, device_id, snapshot_hash")
    .single();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return parseRemoteSnapshotRow(data);
}
