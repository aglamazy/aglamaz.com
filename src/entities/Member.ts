export interface IMember {
  id: string;
  uid: string;
  siteId: string;
  role: 'admin' | 'member' | 'pending';
  displayName: string;
  firstName: string;
  email: string;
  blogEnabled?: boolean;
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  createdAt: any;
  updatedAt: any;
}
