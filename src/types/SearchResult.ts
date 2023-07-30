import { RecordType } from "./RecordType";

export interface SearchResult {
  uuid: string;
  type: RecordType;
  title: string;
  abstract: string;
  publisher?: string;
  protocol: string;
  isOpen: boolean;
  thumbnail?: string;
}
