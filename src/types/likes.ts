export interface LikerInfo {
  uid: string;
  memberId?: string | null;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  likedAt?: string | null;
}

export interface ImageLikeMeta {
  index: number;
  count: number;
  likedByMe: boolean;
  likers: LikerInfo[];
}
