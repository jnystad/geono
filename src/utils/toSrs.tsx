export function toSrs(crs?: string) {
  if (!crs) return null;
  if (/^urn:(x-)?ogc:def:crs:EPSG:(.*:)?(\w+)$/.test(crs)) {
    return crs.replace(/urn:(x-)?ogc:def:crs:EPSG:(.*:)?(\w+)$/, "EPSG:$3");
  }
  if (/^EPSG:\d+$/.test(crs)) {
    return crs;
  }
  return null;
}
