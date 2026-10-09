import { sql } from "@vercel/postgres";

export { sql };

export type User = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_label: string | null;
  created_at: string;
};
