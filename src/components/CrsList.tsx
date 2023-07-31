import { useMemo } from "react";

export function CrsList({ crs }: { crs: string[] }) {
  const epsg = useMemo(() => {
    let epsg = crs;
    if (epsg.length === 1)
      epsg = epsg[0]
        .split(",")
        .map((c) => c.trim())
        .map((c) => (!isNaN(parseInt(c)) ? `EPSG:${c}` : c));

    return epsg.map((c) =>
      /http:\/\/www.opengis.net\/def\/crs\/EPSG\/0\/\d+/.test(c) ? `EPSG:${c.split("/").pop()}` : c
    );
  }, [crs]);
  return (
    <>
      <h5>Projeksjoner</h5>
      <p>
        {epsg.map((c, i) => (
          <a href={`https://epsg.io/${c.split(":").pop()}`} key={i} className="tag" target="_blank" rel="noreferrer">
            {c}
          </a>
        ))}
      </p>
    </>
  );
}
