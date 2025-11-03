export interface IMember {
  id: string;
  displayName: string;
  uid: string;
  siteId: string;
  role: 'admin' | 'member' | 'pending';
  firstName: string;
  email: string;
  blogEnabled?: boolean;
  defaultLocale?: string; // User's preferred language (e.g., 'en', 'he', 'tr')
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  createdAt: any;
  updatedAt: any;
}
