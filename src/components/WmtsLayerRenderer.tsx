import { useEffect, useMemo, useState } from "react";
import Map from "ol/Map";
import Tile from "ol/layer/Tile";
import WMTS, { optionsFromCapabilities } from "ol/source/WMTS";
import { useWmtsCapabilities } from "../hooks/useWmtsCapabilities";
import { transformExtent } from "ol/proj";
import { toSrs } from "../utils/toSrs";

export function WmtsLayerRenderer({
  map,
  url,
  layer: initialLayer,
  projection,
  onProjectionChange,
}: {
  map?: Map;
  url: string;
  layer?: string;
  projection: string;
  onProjectionChange: (projection: string) => void;
}) {
  const { capabilities } = useWmtsCapabilities(url);
  const [layer, setLayer] = useState(initialLayer);
  const [style, setStyle] = useState<string>();
  const [matrixSet, setMatrixSet] = useState<string>();

  const { layers, matrixSets } = useMemo(() => {
    if (!capabilities || !capabilities.Contents) return { layers: [], matrixSets: [] };
    const layers = capabilities.Contents.Layer.map((layer) => ({ id: layer.Identifier, title: layer.Title }));
    const matrixSets = capabilities.Contents.TileMatrixSet.map((set) => ({
      id: set.Identifier,
      srs: toSrs(set.SupportedCRS)!,
    }))
      .filter((set) => !!set.srs)
      .sort((a, b) => a.id.localeCompare(b.id));
    return { layers, matrixSets };
  }, [capabilities]);

  const { layerDef, supportedMatrixSets } = useMemo(() => {
    if (!capabilities || !capabilities.Contents || !layer)
      return { layerDef: undefined, supportedMatrixSets: undefined };
    const layerDef = capabilities.Contents.Layer.find((l) => l.Identifier === layer);
    if (!layerDef) return { layerDef: undefined, supportedMatrixSets: [] };
    const supportedMatrixSets = layerDef.TileMatrixSetLink.map((link) => link.TileMatrixSet).map(
      (set) => matrixSets.find((s) => s.id === set)!
    );
    return { layerDef, supportedMatrixSets };
  }, [capabilities, layer, matrixSets]);

  useEffect(() => {
    if (layers.length === 1) setLayer(layers[0].id);
  }, [layers]);

  useEffect(() => {
    if (!layer || !supportedMatrixSets) return;

    let matrixSetDef = supportedMatrixSets.find((set) => set.id === matrixSet);
    if (!matrixSetDef && supportedMatrixSets.length) {
      matrixSetDef = supportedMatrixSets.find((set) => set.srs === "EPSG:3857");
      if (!matrixSetDef) matrixSetDef = supportedMatrixSets[0];
      setMatrixSet(matrixSetDef.id);
    }

    if (!matrixSetDef || matrixSetDef.srs === projection) return;
    onProjectionChange(matrixSetDef.srs);
  }, [onProjectionChange, projection, matrixSet, supportedMatrixSets, layer]);

  useEffect(() => {
    let tileLayer: Tile<WMTS>;
    async function initLayer() {
      const projection = map?.getView().getProjection();
      if (!capabilities || !capabilities.Contents || !map || !projection || !layer || !layerDef) return;

      const matrixSetDef = supportedMatrixSets.find((set) => set.id === matrixSet);

      if (matrixSetDef?.srs !== projection.getCode()) {
        return;
      }

      const format = layerDef.Format.find((format) => format === "image/png") || layerDef.Format[0];

      const options = optionsFromCapabilities(capabilities, {
        layer,
        matrixSet,
        projection,
        style,
        format,
      });

      if (!options) {
        console.error("Could not create WMTS source from capabilities", capabilities);
        return;
      }

      options.urls = options.urls?.map((url) => url.replace(/^http:/, "https:"));

      const source = new WMTS(options);
      tileLayer = new Tile({ source, zIndex: 1 });
      map.addLayer(tileLayer);

      const bbox = layerDef.WGS84BoundingBox;
      if (bbox) {
        if (bbox[0] === -180.0 && bbox[2] === 180.0 && bbox[1] === -90.0 && bbox[3] === 90.0) {
          return;
        }
        const extent = transformExtent(bbox, "EPSG:4326", projection);
        map.getView().fit(extent);
      }
    }
    initLayer();

    return () => {
      if (tileLayer) {
        map?.removeLayer(tileLayer);
      }
    };
  }, [capabilities, layer, layerDef, map, matrixSet, style, supportedMatrixSets]);

  const supportedStyles = useMemo(() => {
    if (!layerDef || !capabilities || !capabilities.Contents) return;
    return layerDef.Style.map((style) => style.Identifier).filter(Boolean) as string[];
  }, [layerDef, capabilities]);

  if (layers.length === 0)
    return (
      <p className="error">
        Ingen tilgjengelige kartlag! Det kan hende denne tjenesten krever autentisering eller har andre begrensninger.
      </p>
    );

  return (
    <form className="row wrap" onSubmit={(e) => e.preventDefault()}>
      <select value={layer} onChange={(e) => setLayer(e.target.value)} required data-grow>
        <option value="">Velg lag</option>
        {layers.map((layer) => (
          <option key={layer.id} value={layer.id}>
            {layer.title}
            {layer.title !== layer.id ? ` (${layer.id})` : ""}
          </option>
        ))}
      </select>
      {supportedStyles && supportedStyles.length > 1 && (
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          {supportedStyles.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      )}
      <select value={matrixSet} onChange={(e) => e.target.value && setMatrixSet(e.target.value)}>
        {matrixSets.map((set) => (
          <option
            key={set.id}
            value={set.id}
            disabled={!!supportedMatrixSets && !supportedMatrixSets.find((s) => s.id === set.id)}
          >
            {set.id}
          </option>
        ))}
      </select>
    </form>
  );
}
