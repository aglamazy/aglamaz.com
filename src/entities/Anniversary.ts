export interface AnniversaryEvent {
  id: string;
  siteId: string;
  ownerId: string;
  name: string;
  description?: string;
  type: 'birthday' | 'death' | 'wedding';
  date: any;
  month: number;
  day: number;
  year: number;
  isAnnual: boolean;
  imageUrl?: string;
  createdAt: any;
  imageUrl?: string;
}
