import { IconCheck, IconCopy, IconDownload, IconDownloadOff, IconExternalLink } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

export function UsageLink({ protocol, url, layer }: { protocol: string; url: string; layer?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url);
    setCopied(true);
  }, [url]);

  if (protocol === "GEONORGE:DOWNLOAD" || (protocol === "GEONORGE:FILEDOWNLOAD" && url.endsWith("capabilities/"))) {
    return (
      <p>
        <a href={url} target="_blank" rel="noreferrer" role="button">
          Geonorge Nedlastingsløsning <IconExternalLink />
        </a>
      </p>
    );
  }

  switch (protocol) {
    case "OGC:WMS":
    case "OGC:WFS":
    case "OGC:WMTS":
      return (
        <p className="row">
          <button type="button" onClick={handleCopy} title={url}>
            Kopier lenke til {protocol.split(":").pop()} GetCapabilities {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Åpne i nettleser <IconExternalLink />
          </a>
          {layer && <span>Kartlag: {layer}</span>}
        </p>
      );

    case "OGC:WCS":
    case "OGC:WPS":
    case "OGC:CSW":
      return (
        <p className="row">
          <button type="button" onClick={handleCopy} title={url}>
            Kopier lenke til {protocol.split(":").pop()} GetCapabilities {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Åpne i nettleser <IconExternalLink />
          </a>
        </p>
      );

    case "OGC:OAPIF":
      return (
        <p className="row">
          <button type="button" onClick={handleCopy} title={url}>
            Kopier lenke til OGC API - Features {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Åpne i nettleser <IconExternalLink />
          </a>
        </p>
      );

    case "W3C:REST":
      return (
        <p className="row">
          <button type="button" onClick={handleCopy} title={url}>
            Kopier lenke til REST API {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Åpne i nettleser <IconExternalLink />
          </a>
        </p>
      );

    case "W3C:AtomFeed":
      return (
        <p className="row">
          <button type="button" onClick={handleCopy} title={url}>
            Kopier lenke til Atom feed {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            Åpne i nettleser <IconExternalLink />
          </a>
        </p>
      );

    case "WWW:LINK-1.0-http--link":
      return (
        <p>
          <a href={url} target="_blank" rel="noreferrer" role="button">
            Lenke <IconExternalLink />
          </a>
        </p>
      );

    case "WWW:DOWNLOAD-1.0-http--download":
    case "GEONORGE:FILEDOWNLOAD":
      return (
        <p>
          <a href={url} target="_blank" rel="noreferrer" role="button">
            Last ned fil <IconDownload />
          </a>
        </p>
      );

    case "GEONORGE:OFFLINE":
      return (
        <p>
          <a href={url} target="_blank" rel="noreferrer" role="button">
            Last ned fil <IconDownloadOff />
          </a>
        </p>
      );

    default:
      return (
        <p>
          <a href={url} target="_blank" rel="noreferrer" role="button">
            {protocol} <IconExternalLink />
          </a>
        </p>
      );
  }
}
