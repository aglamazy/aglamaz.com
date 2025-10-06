export interface ISite {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: any;
  updatedAt: any;
  translations?: Record<string, string>;
}
