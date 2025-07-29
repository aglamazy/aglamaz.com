import { decodeAndValidateToken } from "../utils/token";


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
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (!match) return null;
    try {
      const decoded = decodeAndValidateToken(match[1]);
      return decoded as IUser;
    } catch (err) {
      return null;
    }
  }

  static async loginWithRedirect(_redirectUrl: string) {
    window.location.reload();
  }
} 