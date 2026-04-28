import { useEffect, useMemo, useState } from "react";

import {
  getCurrentSession,
  sendMagicLinkSignIn,
  signOut,
  subscribeToAuthStateChanges,
} from "../../app/auth";
import {
  fetchRemoteSnapshot,
  fetchRemoteSnapshotMetadata,
  uploadRemoteSnapshot,
} from "../../app/remote-storage";
import { downloadPersistedStateBackup } from "../../app/storage";
import {
  compareSnapshotMetadata,
  getLocalSnapshotInfo,
  getSyncComparisonSummary,
  markLocalSnapshotSynced,
} from "../../app/sync";
import { getSupabaseAvailability } from "../../app/supabase";
import type { SyncComparison } from "../../app/sync-types";
import type { PersistedState } from "../../types";

type SettingsSyncSectionProps = {
  snapshot: PersistedState;
  replacePersistedState: (state: PersistedState) => void;
};

function formatTimestamp(value?: string): string {
  if (!value) {
    return "not synced yet";
  }

  return new Date(value).toLocaleString();
}

function canBackupBeforePull(comparison: SyncComparison | null): boolean {
  return Boolean(
    comparison?.remote &&
      ["remote-only", "no-local-changes", "diverged"].includes(comparison.kind)
  );
}

export function SettingsSyncSection({
  snapshot,
  replacePersistedState,
}: SettingsSyncSectionProps) {
  const availability = getSupabaseAvailability();
  const [email, setEmail] = useState("");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [remoteComparison, setRemoteComparison] = useState<SyncComparison | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const localSnapshotInfo = useMemo(() => getLocalSnapshotInfo(snapshot), [snapshot]);

  async function refreshRemoteState(nextUserId: string) {
    setIsRefreshing(true);

    const result = await fetchRemoteSnapshotMetadata(nextUserId);

    if (!result.success) {
      setErrorMessage(result.error);
      setRemoteComparison(null);
      setIsRefreshing(false);
      return;
    }

    setRemoteComparison(compareSnapshotMetadata(localSnapshotInfo, result.data));
    setErrorMessage("");
    setIsRefreshing(false);
  }

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      const sessionResult = await getCurrentSession();

      if (!isActive) {
        return;
      }

      if (!sessionResult.success) {
        setErrorMessage(sessionResult.error);
        setIsLoadingSession(false);
        return;
      }

      setAuthEmail(sessionResult.user?.email ?? null);
      setUserId(sessionResult.user?.id ?? null);
      setIsLoadingSession(false);

      if (sessionResult.user?.id) {
        void refreshRemoteState(sessionResult.user.id);
      }
    }

    void loadSession();

    const unsubscribe = subscribeToAuthStateChanges((_event, session) => {
      if (!isActive) {
        return;
      }

      setAuthEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setStatusMessage("");
      setErrorMessage("");

      if (session?.user.id) {
        void refreshRemoteState(session.user.id);
      } else {
        setRemoteComparison(null);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [localSnapshotInfo.snapshotHash]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    setRemoteComparison((current) => {
      if (!current?.remote) {
        return current;
      }

      return compareSnapshotMetadata(localSnapshotInfo, current.remote);
    });
  }, [localSnapshotInfo, userId]);

  async function handleSendMagicLink() {
    setIsSendingLink(true);
    setStatusMessage("");
    setErrorMessage("");

    const result = await sendMagicLinkSignIn(email.trim());

    if (result.success) {
      setStatusMessage("magic link sent. check your email to finish sign-in.");
    } else {
      setErrorMessage(result.error);
    }

    setIsSendingLink(false);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setStatusMessage("");
    setErrorMessage("");

    const result = await signOut();

    if (result.success) {
      setStatusMessage("signed out. local-only mode is still active on this device.");
      setRemoteComparison(null);
    } else {
      setErrorMessage(result.error);
    }

    setIsSigningOut(false);
  }

  function handleBackupBeforePull() {
    setIsBackingUp(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      downloadPersistedStateBackup(snapshot);
      setStatusMessage("local backup exported. you can pull from cloud when ready.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "failed to export local backup"
      );
    }

    setIsBackingUp(false);
  }

  async function handlePush() {
    if (!userId) {
      return;
    }

    if (
      remoteComparison &&
      ["remote-only", "no-local-changes", "diverged"].includes(remoteComparison.kind)
    ) {
      const confirmed = window.confirm(
        "pushing will overwrite the current cloud snapshot. continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    setIsPushing(true);
    setStatusMessage("");
    setErrorMessage("");

    const result = await uploadRemoteSnapshot(userId, snapshot);

    if (!result.success) {
      setErrorMessage(result.error);
      setIsPushing(false);
      return;
    }

    markLocalSnapshotSynced(snapshot, result.data.metadata);
    setRemoteComparison(
      compareSnapshotMetadata(getLocalSnapshotInfo(snapshot), result.data.metadata)
    );
    setStatusMessage("local snapshot pushed to cloud.");
    setIsPushing(false);
  }

  async function handlePull() {
    if (!userId) {
      return;
    }

    const result = await fetchRemoteSnapshot(userId);

    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }

    if (!result.data) {
      setErrorMessage("no cloud snapshot exists yet for this account.");
      return;
    }

    const confirmed = window.confirm(
      "pulling from cloud replaces this device's current local data. export a backup first if you want a restore point. continue?"
    );

    if (!confirmed) {
      return;
    }

    setIsPulling(true);
    setStatusMessage("");
    setErrorMessage("");
    replacePersistedState(result.data.snapshot);
    markLocalSnapshotSynced(result.data.snapshot, result.data.metadata);
    setRemoteComparison(
      compareSnapshotMetadata(
        getLocalSnapshotInfo(result.data.snapshot),
        result.data.metadata
      )
    );
    setStatusMessage("cloud snapshot pulled into local storage.");
    setIsPulling(false);
  }

  async function handleSyncNow() {
    if (!userId) {
      return;
    }

    const metadataResult = await fetchRemoteSnapshotMetadata(userId);

    if (!metadataResult.success) {
      setErrorMessage(metadataResult.error);
      return;
    }

    const comparison = compareSnapshotMetadata(localSnapshotInfo, metadataResult.data);
    setRemoteComparison(comparison);

    if (comparison.kind === "identical") {
      setStatusMessage("local and cloud snapshots already match.");
      setErrorMessage("");
      return;
    }

    if (comparison.kind === "no-remote-snapshot" || comparison.kind === "local-only") {
      await handlePush();
      return;
    }

    if (comparison.kind === "remote-only" || comparison.kind === "no-local-changes") {
      await handlePull();
      return;
    }

    setErrorMessage("local and cloud diverged. choose push or pull explicitly.");
  }

  const comparisonSummary = remoteComparison
    ? getSyncComparisonSummary(remoteComparison)
    : "sign in to compare this device with the cloud snapshot";
  const showBackupBeforePull = canBackupBeforePull(remoteComparison);

  return (
    <div className="section-card stack-md">
      <div className="section-header">
        <div className="section-title-group">
          <h2 className="section-title">cloud sync</h2>
          <p className="section-subtitle">
            local storage remains primary. cloud sync is explicit, snapshot-based,
            and optional.
          </p>
        </div>
      </div>

      {!availability.available ? (
        <p className="message-box message-box--error">{availability.error}</p>
      ) : null}

      <div className="summary-grid summary-grid--wide">
        <div className="summary-card summary-card--info">
          <div className="summary-card__label">local snapshot</div>
          <div className="summary-card__value">{formatTimestamp(localSnapshotInfo.updatedAt)}</div>
        </div>
        <div className="summary-card summary-card--info">
          <div className="summary-card__label">cloud status</div>
          <div className="summary-card__value settings-sync-summary">{comparisonSummary}</div>
        </div>
      </div>

      {!authEmail ? (
        <div className="stack-sm">
          <p className="muted-text">
            signed out users keep the full local-first app experience. sign in only if
            you want explicit cross-device snapshot sync.
          </p>

          <div className="form-grid">
            <label className="field">
              <span className="field__label">email</span>
              <input
                className="control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={!availability.available || isSendingLink || isLoadingSession}
              />
            </label>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void handleSendMagicLink()}
              className="button button--primary"
              disabled={
                !availability.available ||
                isSendingLink ||
                isLoadingSession ||
                email.trim().length === 0
              }
            >
              send magic link
            </button>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <p className="muted-text">
            signed in as <strong>{authEmail}</strong>. push and pull stay explicit;
            sync now only takes the obvious safe action.
          </p>

          <div className="settings-sync-meta">
            <span>device id: {localSnapshotInfo.deviceId}</span>
            <span>last cloud sync: {formatTimestamp(localSnapshotInfo.lastSyncedAt)}</span>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => void handlePush()}
              className="button button--primary"
              disabled={isPushing || isPulling || isRefreshing || isBackingUp}
            >
              push local to cloud
            </button>
            <button
              type="button"
              onClick={() => void handlePull()}
              className="button button--secondary"
              disabled={isPushing || isPulling || isRefreshing || isBackingUp}
            >
              pull cloud to this device
            </button>
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              className="button button--secondary"
              disabled={isPushing || isPulling || isRefreshing || isBackingUp}
            >
              sync now
            </button>
            <button
              type="button"
              onClick={() => {
                if (userId) {
                  void refreshRemoteState(userId);
                }
              }}
              className="button button--muted"
              disabled={!userId || isRefreshing || isPushing || isPulling || isBackingUp}
            >
              refresh status
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="button button--muted"
              disabled={isSigningOut}
            >
              sign out
            </button>
          </div>

          {showBackupBeforePull ? (
            <div className="message-box settings-sync-safety-box">
              <p className="muted-text">
                pulling from cloud replaces this device's current local data. export a
                local backup first if you want a restore point before overwriting.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={handleBackupBeforePull}
                  className="button button--secondary"
                  disabled={isBackingUp || isPulling || isPushing || isRefreshing}
                >
                  backup local before pull
                </button>
              </div>
            </div>
          ) : null}

          <p className="muted-text">
            cloud pulls go through the same migration-aware validation path as backup
            import before they can replace local data.
          </p>
        </div>
      )}

      {errorMessage ? <p className="message message--error">{errorMessage}</p> : null}
      {statusMessage ? <p className="message message--success">{statusMessage}</p> : null}
    </div>
  );
}
