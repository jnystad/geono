import {
  IconApiApp,
  IconAppWindow,
  IconFileDatabase,
  IconListDetails,
  IconMap,
  IconMapHeart,
  IconPolygon,
  IconRss,
  IconSearch,
  IconServer,
} from "@tabler/icons-react";
import { RecordType } from "../types/RecordType";

export function TypeIcon({ type, protocol }: { type: RecordType; protocol?: string }) {
  switch (type) {
    case "dataset":
      return <IconFileDatabase />;
    case "series":
      return <IconListDetails />;
    case "service":
      switch (protocol) {
        case "OGC:WMS":
          return <IconMap />;

        case "OGC:WMTS":
          return <IconMapHeart />;

        case "OGC:WFS":
          return <IconPolygon />;

        case "OGC:CSW":
          return <IconSearch />;

        case "W3C:REST":
        case "W3C:SOAP":
          return <IconApiApp />;

        case "W3C:AtomFeed":
        case "W3C:RSS":
          return <IconRss />;
      }
      return <IconServer />;

    case "software":
      return <IconAppWindow />;
  }
}
