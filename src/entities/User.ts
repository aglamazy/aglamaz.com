export interface IUser {
  aud: string;
  auth_time: number;
  email: string;
  email_verified: boolean;
  exp: number;
  firebase: any;
  iat: number;
  iss: string;
  name: string;
  picture: string;
  sub: string;
  user_id: string;
}

export class User {
  static async me(): Promise<IUser | null> {
    try {
      const res = await fetch('/api/session');
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch (err) {
      return null;
    }
  }

  static async loginWithRedirect(_redirectUrl: string) {
    window.location.reload();
  }
} 