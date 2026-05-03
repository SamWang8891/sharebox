import { StackClientApp } from "@stackframe/react";

export const stackApp = new StackClientApp({
  projectId: import.meta.env.VITE_STACK_PROJECT_ID as string,
  publishableClientKey: import.meta.env
    .VITE_STACK_PUBLISHABLE_CLIENT_KEY as string,
  tokenStore: "cookie",
  urls: {
    home: "/",
    afterSignIn: "/dashboard",
    afterSignUp: "/dashboard",
    afterSignOut: "/",
    handler: "/handler",
  },
});
