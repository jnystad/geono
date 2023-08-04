import Map from "ol/Map";
import Control from "ol/control/Control";
import "./LoadingIndicator.scss";

export class LoadingIndicator extends Control {
  constructor() {
    const element = document.createElement("div");
    element.className = "ol-loading-indicator";

    super({
      element: element,
    });
  }

  setMap(map: Map | null): void {
    super.setMap(map);
    if (map) {
      map.on("loadstart", this.handleLoadStart.bind(this));
      map.on("loadend", this.handleLoadEnd.bind(this));
    }
  }

  handleLoadStart(): void {
    this.element.classList.add("ol-loading");
  }

  handleLoadEnd(): void {
    this.element.classList.remove("ol-loading");
  }
}
