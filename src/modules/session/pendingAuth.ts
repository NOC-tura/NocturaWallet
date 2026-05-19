/**
 * Cross-screen auth resolver — bridges SendScreen (calling site) and the
 * UnlockSend modal (auth surface). SendScreen calls `awaitUserAuth()` to
 * suspend before broadcast; the modal calls `approveAuth()` on PIN/biometric
 * success or `cancelAuth()` on user dismiss. SendScreen then either continues
 * with the broadcast or aborts cleanly.
 *
 * Module-level state is intentional: this is a singleton bridge between two
 * screens that mount independently. Only one auth request can be pending at a
 * time — any prior pending promise is rejected when a new awaitUserAuth() call
 * lands (defensive: prevents zombie resolvers if the modal stack ever loses
 * track of a previous request).
 */

type Resolver = (approved: boolean) => void;

let pending: Resolver | null = null;

export function awaitUserAuth(): Promise<boolean> {
  if (pending) {
    pending(false);
    pending = null;
  }
  return new Promise<boolean>(resolve => {
    pending = resolve;
  });
}

export function approveAuth(): void {
  if (pending) {
    pending(true);
    pending = null;
  }
}

export function cancelAuth(): void {
  if (pending) {
    pending(false);
    pending = null;
  }
}

export function hasPendingAuth(): boolean {
  return pending !== null;
}
