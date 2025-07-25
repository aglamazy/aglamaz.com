import { decodeAndValidateToken } from "../utils/token";


export class User {
  static async me() {
    const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
    if (!match) return null;
    try {
      const decoded = decodeAndValidateToken(match[1]);
      return decoded;
    } catch (err) {
      return null;
    }
  }

  static async loginWithRedirect(_redirectUrl: string) {
    window.location.reload();
  }
} 