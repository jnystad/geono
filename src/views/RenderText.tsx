import { useMemo } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import { Link } from "react-router-dom";

export function RenderText({ text }: { text: string }) {
  const children = useMemo(() => {
    const plain = text
      .replace(/(<([^>]+)>)/g, "")
      .replace(/ +/g, " ")
      .replace(/\n /g, "\n")
      .replace(/\n+/g, "\n\n");

    const result = [];
    let buffer = "";
    for (const c of plain + " ") {
      if (c === "h" && !buffer.startsWith("http")) {
        result.push(buffer);
        buffer = c;
      } else if (!c.match(/[\w\d\-_\/:.?=&%~]/) && buffer.startsWith("http")) {
        const match = buffer.match(/https:\/\/kartkatalog.geonorge.no\/metadata\/.*\/(.*)/);
        if (match) {
          const uuid = match[1];
          result.push(
            <Link key={result.length} to={`/id/${uuid}`}>
              Lenke
            </Link>
          );
        } else {
          let domain = buffer.match(/https?:\/\/([^/]+)/)?.[1];
          if (domain?.startsWith("www.")) domain = domain.slice(4);
          let href = buffer;
          let dot = "";
          if (href.endsWith(".")) {
            href = href.slice(0, -1);
            dot = ".";
          }
          result.push(
            <>
              <a href={href} key={result.length} target="_blank" rel="noreferrer">
                {domain} <IconExternalLink />
              </a>
              {dot}
            </>
          );
        }
        buffer = c;
      } else {
        buffer += c;
      }
    }
    result.push(buffer);
    return result;
  }, [text]);

  return <>{children}</>;
}
