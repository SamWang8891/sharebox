import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export const authClient = createAuthClient(window.location.origin, {
  adapter: BetterAuthReactAdapter(),
});

export const { signIn, signOut, useSession } = authClient;
