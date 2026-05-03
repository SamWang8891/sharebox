export interface Env {
  R2_BUCKET: R2Bucket;
  DATABASE_URL: string;
  STACK_PROJECT_ID: string;
  STACK_PUBLISHABLE_CLIENT_KEY: string;
  STACK_SECRET_SERVER_KEY: string;
  ADMIN_EMAILS: string;
  MAX_UPLOAD_SIZE?: string;
  /** Optional, used to sign short-lived file access tokens for password-protected files. Falls back to STACK_SECRET_SERVER_KEY. */
  FILE_TOKEN_SECRET?: string;
}

export type UserInfo = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
};
