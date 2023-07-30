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
        setResult(res.data);
      } catch (error) {
        console.error(error);
        setResult(null);
      }
    }
    fetchResult();
  }, [id]);

  return result;
}
