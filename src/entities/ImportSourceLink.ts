export type ImportSourceType = 'dropbox' | 'google-photos';

export interface ImportSourceLink {
  url: string;
  type: ImportSourceType;
}
