export interface IMember {
  id: string;
  displayName: string;
  uid: string;
  siteId: string;
  role: 'admin' | 'member' | 'pending';
  firstName: string;
  email: string;
  blogEnabled?: boolean;
  avatarUrl?: string | null;
  avatarStoragePath?: string | null;
  createdAt: any;
  updatedAt: any;
}
