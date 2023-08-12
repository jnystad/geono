import axios from "axios";
import { useEffect, useState } from "react";
import { EntryRecord as CswRecord } from "../types/EntryRecord";

export function useResult(id: string) {
  const [result, setResult] = useState<CswRecord | null>();

  useEffect(() => {
    async function fetchResult() {
      setResult(undefined);
      try {
        const res = await axios.get<CswRecord>(`/api/id/${id}`);
        setResult(prepareResult(res.data));
      } catch (error) {
        console.error(error);
        setResult(null);
      }
    }
    fetchResult();
  }, [id]);

  return result;
}

function prepareProtocol(protocol?: string) {
  if (!protocol) return undefined;
  if (protocol.startsWith("OGC:WMS")) return "OGC:WMS";
  if (protocol.startsWith("OGC:WMTS")) return "OGC:WMTS";
  if (protocol.startsWith("OGC:WFS")) return "OGC:WFS";
  return protocol;
}

function prepareResult(result: CswRecord) {
  result.protocol = prepareProtocol(result.protocol);
  return result;
}
