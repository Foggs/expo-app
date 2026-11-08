import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { signInWithGameCenter } from "@/lib/gameCenter";
import { holdSessionTokenUntil, onSessionTokenRotated } from "@/lib/sessionToken";

export type PlayerIdentityStatus = "checking" | "linked" | "declined" | "unavailable" | "error";

type PlayerIdentity = {
  status: PlayerIdentityStatus;
  /** The Game Center name, shown only on this device and never sent to the server. */
  displayName: string | null;
  /**
   * Increases whenever the device token is replaced (the linked player signed
   * out or changed), so open connections can drop the old identity.
   */
  tokenGeneration: number;
};

const PlayerIdentityContext = createContext<PlayerIdentity>({
  status: "checking",
  displayName: null,
  tokenGeneration: 0,
});

export function PlayerIdentityProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<PlayerIdentityStatus>("checking");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tokenGeneration, setTokenGeneration] = useState(0);
  const inFlightRef = useRef(false);
  const statusRef = useRef<PlayerIdentityStatus>("checking");

  const attemptSignIn = useCallback((relinkWhenUnchanged: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const check = signInWithGameCenter({ relinkWhenUnchanged });
    // Requests wait for this check so they never use a token it replaces.
    holdSessionTokenUntil(check);
    void check
      .then((result) => {
        statusRef.current = result.status;
        setStatus(result.status);
        setDisplayName(result.status === "linked" ? result.displayName : null);
      })
      .catch((error: unknown) => {
        console.warn(
          "[GameCenter] Sign-in could not be linked; continuing with this device's identity:",
          error instanceof Error ? error.message : error,
        );
        statusRef.current = "error";
        setStatus("error");
        setDisplayName(null);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, []);

  // Bumped for every replacement as it happens, including when a later step
  // of the same sign-in check fails.
  useEffect(() => onSessionTokenRotated(() => setTokenGeneration((generation) => generation + 1)), []);

  useEffect(() => {
    attemptSignIn(true);
    // On returning to the foreground: retry a failed link, and re-check a
    // linked player, who may have signed out of Game Center in Settings.
    // Declines are respected until the next launch.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && (statusRef.current === "error" || statusRef.current === "linked")) {
        attemptSignIn(false);
      }
    });
    return () => subscription.remove();
  }, [attemptSignIn]);

  const value = useMemo(
    () => ({ status, displayName, tokenGeneration }),
    [status, displayName, tokenGeneration],
  );

  return (
    <PlayerIdentityContext.Provider value={value}>
      {children}
    </PlayerIdentityContext.Provider>
  );
}

export function usePlayerIdentity(): PlayerIdentity {
  return useContext(PlayerIdentityContext);
}
