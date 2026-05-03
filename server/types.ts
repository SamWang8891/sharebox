export interface Env {
  R2_BUCKET: R2Bucket;
  DATABASE_URL: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  ADMIN_EMAILS: string;
  MAX_UPLOAD_SIZE?: string;
  /** Optional, used to sign short-lived file access tokens. Falls back to CLERK_SECRET_KEY. */
  FILE_TOKEN_SECRET?: string;
}

export type UserInfo = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
};
