export interface AnniversaryEvent {
  id: string;
  siteId: string;
  name: string;
  description?: string;
  type: 'birthday' | 'death' | 'wedding';
  date: any;
  month: number;
  day: number;
  year: number;
  isAnnual: boolean;
  createdBy: string;
  createdAt: any;
}
