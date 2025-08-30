export interface IMember {
  id: string;
  uid: string;
  siteId: string;
  role: 'admin' | 'member' | 'pending';
  displayName: string;
  firstName: string;
  email: string;
  blogEnabled?: boolean;
  createdAt: any;
  updatedAt: any;
}
