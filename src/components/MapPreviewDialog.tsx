import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import proj4 from "proj4";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import Graticule from "ol/layer/Graticule";
import OSM from "ol/source/OSM";
import WMTS, { optionsFromCapabilities } from "ol/source/WMTS";
import Raster from "ol/source/Raster";
import Attribution from "ol/control/Attribution";
import MousePosition from "ol/control/MousePosition";
import Zoom from "ol/control/Zoom";
import ScaleLine from "ol/control/ScaleLine";
import { fromEPSGCode, register } from "ol/proj/proj4";
import { transform } from "ol/proj";
import { degreesToStringHDMS } from "ol/coordinate";
import { WmtsLayerRenderer } from "./WmtsLayerRenderer";
import { WmsLayerRenderer } from "./WmsLayerRenderer";
import { LoadingIndicator } from "../ol/LoadingIndicator";
import "ol/ol.css";
import "./MapPreviewDialog.scss";
import TileGrid from "ol/tilegrid/TileGrid";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { useWmtsCapabilities } from "../hooks/useWmtsCapabilities";

proj4.defs("EPSG:4258", "+proj=longlat +ellps=GRS80 +no_defs +type=crs");
register(proj4);

export function MapPreviewDialog({
  id,
  url,
  protocol,
  layer,
  onClose,
}: {
  id: string;
  url: string;
  protocol: string;
  layer?: string;
  onClose: () => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map>();
  const [projection, setProjection] = useState<string>("EPSG:3857");
  const { capabilities: openWmtsCapabilities } = useWmtsCapabilities(
    `https://opencache.statkart.no/gatekeeper/gk/gk.open_wmts?request=GetCapabilities&service=WMTS`
  );

  useEffect(() => {
    let map: Map;
    let destroyed = false;
    async function initMap() {
      if (!mapDivRef.current) return;
      try {
        const layers = [];
        if (projection === "EPSG:3857") {
          const osm = new OSM();
          const grayscale = new Raster({
            sources: [osm],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            operation: (pixels: any) => {
              const pixel = pixels[0];
              pixel[0] = pixel[1] = pixel[2] = (pixel[0] + pixel[1] + pixel[2]) / 3;
              return pixel;
            },
          });
          layers.push(
            new ImageLayer({
              source: grayscale,
              opacity: 0.4,
            })
          );
        } else {
          try {
            const options = optionsFromCapabilities(openWmtsCapabilities, {
              layer: "topo4graatone",
              matrixSet: projection,
              format: "image/png",
              style: "default",
            });

            if (options) {
              const wmts = new WMTS(options);
              layers.push(
                new TileLayer({
                  source: wmts,
                  opacity: 0.4,
                })
              );
            }
          } catch (err) {}
        }

        if (projection !== "EPSG:4326" && projection !== "EPSG:3857") {
          await fromEPSGCode(projection);
        }

        if (projection === "EPSG:4326" || projection === "EPSG:3857") {
          const graticule = new Graticule({
            zIndex: 100,
            opacity: 0.3,
            showLabels: true,
          });
          layers.push(graticule);
        }

        const center = transform([12, 65], "EPSG:4326", projection);

        map = new Map({
          target: mapDivRef.current,
          layers,
          view: new View({
            projection,
            center,
            zoom: 3,
          }),
          controls: [
            new Attribution(),
            new Zoom(),
            new MousePosition({
              projection: "EPSG:4326",
              coordinateFormat: (coordinate) => {
                if (!coordinate) return "";
                const [lon, lat] = coordinate;
                return degreesToStringHDMS("NS", lat, 2) + " " + degreesToStringHDMS("EW", lon, 2);
              },
            }),
            new ScaleLine(),
            new LoadingIndicator(),
          ],
        });
        if (destroyed) return;
        setMap(map);
      } catch (err) {
        console.error(err);
      }
    }
    initMap();
    return () => {
      destroyed = true;
      setMap(undefined);
      map?.setTarget(undefined);
    };
  }, [mapDivRef, url, layer, projection, openWmtsCapabilities]);

  const LayerRenderer = useMemo(() => {
    switch (protocol) {
      case "OGC:WMTS":
        return WmtsLayerRenderer;
      case "OGC:WMS":
        return WmsLayerRenderer;
    }
  }, [protocol]);

  return (
    <DialogPortal>
      <article className="map-preview-dialog">
        <header>
          <a
            href="#close"
            className="close"
            title="Lukk"
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
          />
          {url.split("?")[0]}
        </header>
        <section>
          {LayerRenderer && (
            <LayerRenderer
              id={id}
              url={url}
              layer={layer}
              map={map}
              projection={projection}
              onProjectionChange={setProjection}
            />
          )}
          <div ref={mapDivRef} className="map" />
        </section>
      </article>
    </DialogPortal>
  );
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return createPortal(<dialog open>{children}</dialog>, document.body);
}
