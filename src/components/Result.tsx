import { IconLock, IconLockOpen } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { SearchResult } from "../types/SearchResult";
import "./Result.scss";
import { toTypeText } from "../utils/toTypeText";
import { TypeIcon } from "./TypeIcon";

export function Result({ result, active }: { result: SearchResult; active: boolean }) {
  const navigate = useNavigate();
  return (
    <article
      id={result.uuid}
      onClick={() => navigate(`/id/${result.uuid}`)}
      className={`result ${active ? "active" : ""}`}
    >
      {result.thumbnail && (
        <img
          src={result.thumbnail}
          style={{
            float: "right",
            margin: "0 0 0 1em",
            width: "3.5em",
            height: "3.5em",
            borderRadius: ".5em",
            objectFit: "cover",
          }}
        />
      )}
      <h3>
        <span dangerouslySetInnerHTML={{ __html: result.title }} />
      </h3>
      <p className="abstract" dangerouslySetInnerHTML={{ __html: result.abstract }}></p>
      <p>
        <small>
          <TypeIcon type={result.type} protocol={result.protocol} /> {toTypeText(result.type)} fra {result.publisher}
        </small>
      </p>

      {result.isOpen ? (
        <IconLockOpen className="lock" color="var(--ins-color)" />
      ) : (
        <IconLock className="lock" color="var(--del-color)" />
      )}
    </article>
  );
}
