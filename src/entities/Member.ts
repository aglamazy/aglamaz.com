export interface IMember {
  id: string;
  uid: string;
  siteId: string;
  role: 'admin' | 'member';
  displayName: string;
  firstName: string;
  email: string;
  createdAt: any;
  updatedAt: any;
} 