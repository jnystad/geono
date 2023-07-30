import { RecordType } from "./RecordType";

export interface BasicRecord {
  uuid: string;
  type: RecordType;
  title: string;
  publisher?: string;
  protocol?: string;
}

export interface EntryRecord extends BasicRecord {
  abstract: string;
  purpose?: string;
  owner?: string;
  keywords?: string[];
  constraints?: Constraints;
  graphics?: Graphic[];
  url?: string;
  layer?: string;
  spatialType?: string;
  bbox?: number[];
  crs?: string[];
  spec?: {
    operatesOn?: string[];
    serviceType?: string;
  };
  distributions?: Distribution[];
  created?: string;
  updated?: string;
  published?: string;
  parent?: BasicRecord;
  operatedOnBy: BasicRecord[];
  operatesOn: BasicRecord[];
}

export interface Constraints {
  useLimitation?: string;
  accessConstraints?: string;
  otherConstraints?: string;
  useConstraints?: string;
  useConstraintsLink?: string;
  useConstraintsText?: string;
  securityConstraints?: string;
  securityConstraintsNote?: string;
}

export interface Graphic {
  url: string;
  type: string;
}

export interface Distribution {
  name: string;
  version?: string;
  url?: string;
  protocol?: string;
  layer?: string;
}
