import { useEffect, useMemo, useRef, useState } from "react";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import TileWMS from "ol/source/TileWMS";
import ImageWMS from "ol/source/ImageWMS";
import { WmsLayer, useWmsCapabilities } from "../hooks/useWmsCapabilities";
import { containsExtent, intersects } from "ol/extent";
import { transformExtent } from "ol/proj";
import { IconInfoCircle, IconLoader2 } from "@tabler/icons-react";

interface LayerEntry {
  id: string;
  title: string;
  layer: WmsLayer;
}

function reduceLayers(level: number) {
  return function reduceLayers_(acc: LayerEntry[], layer: WmsLayer): LayerEntry[] {
    const res = [...acc];
    if (layer.Name)
      res.push({
        id: layer.Name,
        title: "\u2013".repeat(level) + " " + (layer.Title || layer.Name),
        layer,
      });
    if (layer.Layer) res.push(...layer.Layer.reduce(reduceLayers(level + 1), []));
    return res;
  };
}

export function WmsLayerRenderer({
  id,
  map,
  url,
  layer: initialLayer,
  projection,
  onProjectionChange,
}: {
  id: string;
  map?: Map;
  url: string;
  layer?: string;
  projection: string;
  onProjectionChange: (projection: string) => void;
}) {
  const { capabilities, loading } = useWmsCapabilities(`/api/wms/capabilities/${id}`);
  const [layer, setLayer] = useState(initialLayer);
  const [singleTile, setSingleTile] = useState(false);
  const [legendUrl, setLegendUrl] = useState<string>();
  const [showLegend, setShowLegend] = useState(false);
  const layerSourceRef = useRef<ImageWMS | TileWMS>();

  const layers = useMemo(() => {
    if (!capabilities || !capabilities.Capability || !capabilities.Capability.Layer) return [];
    return capabilities.Capability?.Layer ? [capabilities.Capability.Layer].reduce(reduceLayers(0), []) : [];
  }, [capabilities]);

  const projections = useMemo(() => {
    if (!capabilities || !capabilities.Capability || !capabilities.Capability.Layer) return [];
    return (capabilities.Capability.Layer.CRS ?? []).filter((crs) => crs.startsWith("EPSG:"));
  }, [capabilities]);

  const layerDef = useMemo(() => {
    if (!layer || !layers.length) return;
    return layers.find((l) => l.id === layer);
  }, [layer, layers]);

  useEffect(() => {
    if (!capabilities) return;
    if (layer) return;
    if (!capabilities.Capability || !capabilities.Capability.Layer) return;
    const l = capabilities.Capability.Layer;
    if (l?.Name) setLayer(l.Name);
  }, [capabilities, layer]);

  useEffect(() => {
    let mapLayer: unknown;
    async function initLayer() {
      const projection = map?.getView().getProjection();
      if (!map || !layerDef || !capabilities) return;

      let layerUrl: string;
      try {
        const getMapUrl = capabilities.Capability?.Request.GetMap.DCPType[0].HTTP.Get.OnlineResource;
        if (!getMapUrl) throw new Error("No GetMap URL");
        layerUrl = getMapUrl.replace(/^http:/, "https:");
      } catch (e) {
        layerUrl = url.split("?")[0].replace(/^http:/, "https:");
      }

      if (singleTile) {
        const source = new ImageWMS({
          url: layerUrl,
          params: {
            LAYERS: layerDef.layer.Name,
            VERSION: capabilities.version,
            FORMAT: "image/png",
            TRANSPARENT: true,
          },
          projection,
          attributions: layerDef.layer.Attribution?.Title ? [layerDef.layer.Attribution.Title] : undefined,
          crossOrigin: "anonymous",
        });
        const imageLayer = new ImageLayer({ source, zIndex: 1 });
        map.addLayer(imageLayer);
        layerSourceRef.current = source;
        mapLayer = imageLayer;
      } else {
        const source = new TileWMS({
          url: layerUrl,
          params: {
            LAYERS: layerDef.layer.Name,
            VERSION: capabilities.version,
            FORMAT: "image/png",
            TRANSPARENT: true,
            TILED: true,
          },
          projection,
          attributions: layerDef.layer.Attribution?.Title ? [layerDef.layer.Attribution.Title] : undefined,
          crossOrigin: "anonymous",
          wrapX: false,
        });
        const tileLayer = new TileLayer({ source, zIndex: 1 });
        map.addLayer(tileLayer);
        layerSourceRef.current = source;
        mapLayer = tileLayer;
      }

      let layerExtent: number[] | undefined;
      if (layerDef.layer.EX_GeographicBoundingBox) {
        layerExtent = transformExtent(
          layerDef.layer.EX_GeographicBoundingBox,
          "EPSG:4326",
          projection?.getCode() ?? "EPSG:3857"
        );
      } else {
        const bbox =
          layerDef.layer.BoundingBox?.find((b) => b.crs === projection?.getCode()) ??
          layerDef.layer.BoundingBox?.find((b) => b.crs === "EPSG:4326") ??
          layerDef.layer.BoundingBox?.find((b) => b.crs === "EPSG:4258");

        if (bbox) {
          layerExtent = bbox.extent;
          if (capabilities?.version === "1.3.0") {
            // WMS version 1.3.0 follows projection axis order, handle the most common
            switch (bbox.crs) {
              case "EPSG:4326":
              case "EPSG:4258":
                layerExtent = [layerExtent[1], layerExtent[0], layerExtent[3], layerExtent[2]];
                break;
            }
          }
          if (bbox.crs !== projection?.getCode()) {
            layerExtent = transformExtent(layerExtent, bbox.crs, projection?.getCode() ?? "EPSG:3857");
          }
        }
      }

      if (layerExtent) {
        const extent = map.getView().calculateExtent();
        if (
          !intersects(extent, layerExtent) ||
          containsExtent(extent, layerExtent) ||
          (map.getView().getZoom() ?? 0) < 6
        )
          map.getView().fit(layerExtent);
      }
    }
    initLayer();

    return () => {
      if (mapLayer) {
        map?.removeLayer(mapLayer as TileLayer<TileWMS>);
      }
    };
  }, [capabilities, layer, layerDef, map, url, singleTile]);

  useEffect(() => {
    if (!map) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    function setUrl() {
      if (!map) return;
      setLegendUrl(layerSourceRef.current?.getLegendUrl(map.getView().getResolution(), { SLD_VERSION: "1.1.0" }));
    }
    function updateUrl() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(setUrl, 500);
    }
    setUrl();
    map.getView().on("change:resolution", updateUrl);
    return () => {
      map.getView().un("change:resolution", updateUrl);
    };
  }, [map, layer]);

  if (layers.length === 0)
    return loading ? (
      <p className="loading row">
        <IconLoader2 />
        Laster...
      </p>
    ) : (
      <p className="error">
        Ingen tilgjengelige kartlag! Det kan hende denne tjenesten krever autentisering eller har andre begrensninger.
      </p>
    );

  const minScaleDenominator = layerDef?.layer.MinScaleDenominator;
  const maxScaleDenominator = layerDef?.layer.MaxScaleDenominator;

  return (
    <form className="row wrap" onSubmit={(e) => e.preventDefault()}>
      <select value={layer} onChange={(e) => setLayer(e.target.value)} required>
        <option value="">Velg lag</option>
        {layers.map((layer) => (
          <option key={layer.id} value={layer.id}>
            {layer.title}
            {layer.title !== layer.id ? ` (${layer.id})` : ""}
            {layer.layer.MinScaleDenominator || layer.layer.MaxScaleDenominator
              ? (layer.layer.MaxScaleDenominator
                  ? ` fra 1:${layer.layer.MaxScaleDenominator.toLocaleString("nb", {
                      useGrouping: true,
                      maximumFractionDigits: 0,
                    })}`
                  : "") +
                (layer.layer.MinScaleDenominator
                  ? ` til 1:${layer.layer.MinScaleDenominator.toLocaleString("nb", {
                      useGrouping: true,
                      maximumFractionDigits: 0,
                    })}`
                  : "")
              : ""}
          </option>
        ))}
      </select>
      {projections.length > 0 && (
        <select
          value={projection}
          onChange={(e) => {
            onProjectionChange(e.target.value);
          }}
          required
          style={{ flex: "0 0 140px" }}
        >
          <option value="" disabled>
            Projeksjon
          </option>
          {projections.map((projection) => (
            <option key={projection} value={projection}>
              {projection}
            </option>
          ))}
        </select>
      )}
      <span style={{ minWidth: "150px", display: "block" }}>
        <label>
          <input
            type="radio"
            name="tiled"
            id="tiled"
            checked={!singleTile}
            onChange={(e) => e.target.checked && setSingleTile(false)}
          />
          <span>Flisbasert</span>
        </label>
        <label>
          <input
            type="radio"
            name="tiled"
            id="single-tile"
            checked={singleTile}
            onChange={(e) => e.target.checked && setSingleTile(true)}
          />
          <span>Enkeltbilde</span>
        </label>
      </span>
      {minScaleDenominator !== undefined || maxScaleDenominator !== undefined ? (
        <span className="scale-denominators row">
          <IconInfoCircle />
          <span>
            Kartlaget er synlig{" "}
            {maxScaleDenominator !== undefined && (
              <>fra 1:{maxScaleDenominator.toLocaleString("nb-NO", { useGrouping: true, maximumFractionDigits: 0 })}</>
            )}{" "}
            {minScaleDenominator !== undefined && (
              <>til 1:{minScaleDenominator.toLocaleString("nb-NO", { useGrouping: true, maximumFractionDigits: 0 })}</>
            )}
          </span>
        </span>
      ) : null}
      {legendUrl && (
        <>
          <button
            type="button"
            onClick={() => setShowLegend(!showLegend)}
            className={showLegend ? "" : "outline"}
            title="Vis tegnforklaring"
          >
            <IconInfoCircle />
          </button>
          {showLegend && (
            <div className="legend">
              <h6>Tegnforklaring</h6>
              <img src={legendUrl} />
            </div>
          )}
        </>
      )}
    </form>
  );
}
