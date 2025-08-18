import { decodeAndValidateToken } from "../utils/token";
import { ACCESS_TOKEN } from "@/constants";

export interface IUser {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  user_id: string;
}

export class User {
  static async me(): Promise<IUser | null> {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${ACCESS_TOKEN}=([^;]*)`)
    );
    if (!match) return null;
    try {
      const decoded = decodeAndValidateToken(match[1]);
      return decoded as IUser;
    } catch (err) {
      return null;
    }
  }
} 