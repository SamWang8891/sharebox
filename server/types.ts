export interface Env {
  R2_BUCKET: R2Bucket;
  DATABASE_URL: string;
  NEON_AUTH_URL?: string;
  NEON_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ADMIN_EMAILS: string;
  MAX_UPLOAD_SIZE?: string;
}

export type UserInfo = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  isAdmin: boolean;
};
