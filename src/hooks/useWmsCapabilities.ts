import { useEffect, useState } from "react";
import WMSCapabilities from "ol/format/WMSCapabilities";
import axios, { AxiosError } from "axios";

type OnlineResource = string;

export interface WmsLayer {
  Title: string;
  Name?: string;
  Abstract: string;
  KeywordList: {
    Keyword: string[];
  };
  CRS: string[];
  EX_GeographicBoundingBox?: number[];
  BoundingBox?: {
    crs: string;
    extent: number[];
  }[];
  Dimension: {
    name: string;
    units: string;
    unitSymbol: string;
    default: string;
    multipleValues: boolean;
    nearestValue: boolean;
    current: boolean;
    values: string[];
  }[];
  Attribution: {
    Title: string;
    OnlineResource: OnlineResource;
    LogoURL: {
      Format: string;
      OnlineResource: OnlineResource;
    };
  };
  AuthorityURL: {
    name: string;
    OnlineResource: OnlineResource;
  }[];
  MetadataURL: {
    type: string;
    Format: string;
    OnlineResource: OnlineResource;
  }[];
  DataURL: {
    type: string;
    format: string;
    OnlineResource: OnlineResource;
  }[];
  FeatureListURL: {
    format: string;
    OnlineResource: OnlineResource;
  }[];
  Style: {
    Name: string;
    Title: string;
    Abstract: string;
    LegendURL: {
      width: number;
      height: number;
      Format: string;
      OnlineResource: OnlineResource;
    }[];
  }[];
  MinScaleDenominator: number;
  MaxScaleDenominator: number;
  Layer: WmsLayer[];
}

interface RequestDetails {
  Format: string[];
  DCPType: {
    HTTP: {
      Get: {
        OnlineResource: OnlineResource;
      };
      Post: {
        OnlineResource: OnlineResource;
      };
    };
  }[];
}

interface Request {
  GetCapabilities: RequestDetails;
  GetMap: RequestDetails;
  GetFeatureInfo?: RequestDetails;
  DescribeLayer?: RequestDetails;
  GetLegendGraphic?: RequestDetails;
  GetStyles?: RequestDetails;
}

interface Capabilites {
  version: string;
  Service: {
    Name: string;
    Title: string;
    Abstract: string;
    KeywordList: string[];
    OnlineResource: OnlineResource;
    ContactInformation: unknown;
    Fees: string;
    AccessConstraints: string;
    MaxWidth: number;
    MaxHeight: number;
  };
  Capability?: {
    Layer: WmsLayer;
    Request: Request;
  };
  Exception: string[];
}

export function useWmsCapabilities(url: string) {
  const [result, setResult] = useState<Capabilites>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    axios
      .get(url)
      .then((response) => {
        const parser = new WMSCapabilities();
        const result = parser.read(response.data);
        setResult(result);
        setLoading(false);
      })
      .catch((error: AxiosError) => {
        console.error(error);
        setError(true);
        setLoading(false);
      });
  }, [url]);

  return { capabilities: result, error, loading };
}
