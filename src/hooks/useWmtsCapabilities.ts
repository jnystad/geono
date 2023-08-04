import { useEffect, useState } from "react";
import WMTSCapabilities from "ol/format/WMTSCapabilities";
import axios from "axios";

interface Capabilites {
  Contents?: {
    Layer: {
      Title: string;
      Identifier: string;
      Format: string[];
      TileMatrixSetLink: {
        TileMatrixSet: string;
      }[];
      Style: {
        Title: string;
        Identifier: string;
      }[];
      WGS84BoundingBox: number[];
    }[];
    TileMatrixSet: {
      Identifier: string;
      SupportedCRS: string;
      TileMatrix: {
        Identifier: string;
        ScaleDenominator: number;
        TopLeftCorner: number[];
        TileWidth: number;
        TileHeight: number;
        MatrixWidth: number;
        MatrixHeight: number;
      }[];
    }[];
  };
}

export function useWmtsCapabilities(url: string) {
  const [result, setResult] = useState<Capabilites>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    axios
      .get(url)
      .then((response) => {
        const parser = new WMTSCapabilities();
        const result = parser.read(response.data);
        setResult(result);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setError(true);
        setLoading(false);
      });
  }, [url]);

  return { capabilities: result, error, loading };
}
