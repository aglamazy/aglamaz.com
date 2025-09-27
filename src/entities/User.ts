import {apiFetchSilent} from "@/utils/apiFetch";

export interface IUser {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  user_id: string;
  needsCredentialSetup?: boolean;
}

export class User {
  static async me(): Promise<IUser | null> {
    try {
      return await apiFetchSilent<IUser>('/api/auth/me');
    } catch {
      return null;
    }
  }
}
