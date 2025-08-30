export interface IBlogPost {
  id: string;
  authorId: string;
  siteId: string;
  title: string;
  content: string;
  isPublic: boolean;
  likeCount?: number;
  shareCount?: number;
  createdAt: any;
  updatedAt: any;
}
