import { apiFetch } from "@/utils/apiFetch";

export interface IUser {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  user_id: string;
}

export class User {
  static async me(): Promise<IUser | null> {
    try {
      const res = await apiFetch<IUser>('/api/auth/me');
      return res;
    } catch {
      return null;
    }
  }
}