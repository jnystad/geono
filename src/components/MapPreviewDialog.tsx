import { useEffect, useMemo, useRef, useState } from "react";
import proj4 from "proj4";
import Map from "ol/Map";
import View from "ol/View";
import ImageLayer from "ol/layer/Image";
import Graticule from "ol/layer/Graticule";
import OSM from "ol/source/OSM";
import Raster from "ol/source/Raster";
import Attribution from "ol/control/Attribution";
import MousePosition from "ol/control/MousePosition";
import Zoom from "ol/control/Zoom";
import ScaleLine from "ol/control/ScaleLine";
import { fromEPSGCode, register } from "ol/proj/proj4";
import { transform } from "ol/proj";
import { degreesToStringHDMS } from "ol/coordinate";
import { WmtsLayerRenderer } from "./WmtsLayerRenderer";
import { LoadingIndicator } from "../ol/LoadingIndicator";
import "ol/ol.css";
import "./MapPreviewDialog.scss";

register(proj4);

export function MapPreviewDialog({
  url,
  protocol,
  layer,
  onClose,
}: {
  url: string;
  protocol: string;
  layer?: string;
  onClose: () => void;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map>();
  const [projection, setProjection] = useState<string>("EPSG:3857");

  useEffect(() => {
    let map: Map;
    let destroyed = false;
    async function initMap() {
      if (!mapDivRef.current) return;
      try {
        console.log("Initializing map");
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
        } else if (projection !== "EPSG:4326") {
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
        console.log("Activating map with projection", projection);
        setMap(map);
      } catch (err) {
        console.error(err);
      }
    }
    initMap();
    return () => {
      destroyed = true;
      console.log("Destroying map");
      setMap(undefined);
      map?.setTarget(undefined);
    };
  }, [mapDivRef, url, layer, projection]);

  const LayerRenderer = useMemo(() => {
    switch (protocol) {
      case "OGC:WMTS":
        return WmtsLayerRenderer;
    }
  }, [protocol]);

  return (
    <dialog open>
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
    </dialog>
  );
}
