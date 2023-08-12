import { useMemo } from "react";
import { Row } from "../components/Layout";
import { IconExternalLink, IconLock, IconLockOpen, IconX } from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router";
import { useResult } from "../hooks/useResult";
import { CrsList } from "../components/CrsList";
import { UsageLink } from "../components/UsageLink";
import { toTypeText } from "../utils/toTypeText";
import { TypeIcon } from "../components/TypeIcon";
import "./ResultView.scss";
import { Link } from "react-router-dom";
import { RenderText } from "./RenderText";
import { Constraints } from "../types/EntryRecord";

export function ResultView() {
  const { id } = useParams<{ id: string }>();
  const result = useResult(id!);
  const navigate = useNavigate();

  const relatedServices = useMemo(() => {
    if (!result) return [];
    const c = result.operatedOnBy.filter((child) => child.type === "service") ?? [];
    const o = result.operatesOn.filter((child) => child.type === "service") ?? [];
    return [...c, ...o];
  }, [result]);

  const relatedDatasets = useMemo(() => {
    if (!result) return [];
    const c = result.operatedOnBy.filter((child) => child.type === "dataset") ?? [];
    const o = result.operatesOn.filter((child) => child.type === "dataset") ?? [];
    return [...c, ...o];
  }, [result]);

  const thumbnail = useMemo(() => {
    if (!result) return undefined;
    const graphics = result.graphics;
    return (
      graphics?.find((g) => g.type === "large_thumbnail") ??
      graphics?.find((g) => g.type === "medium") ??
      graphics?.find((g) => g.type === "original")
    );
  }, [result]);

  return (
    <main className="result-view">
      {result !== undefined ? (
        <section>
          <Row>
            <h2 data-grow>{result?.title ?? "Kunne ikke laste informasjon"}</h2>
            <button type="button" className="secondary outline" onClick={() => navigate("/")}>
              <IconX />
            </button>
          </Row>
          {result && (
            <>
              <div className="info-bar">
                <span>
                  {result.constraints?.accessConstraints === "no restrictions" ? (
                    <IconLockOpen color="var(--ins-color)" />
                  ) : (
                    <IconLock color="var(--del-color)" />
                  )}{" "}
                  <UseContraints constraints={result.constraints} />
                </span>{" "}
                <span>
                  <TypeIcon type={result.type} protocol={result.protocol} /> {toTypeText(result.type)} fra{" "}
                  {result.publisher}
                </span>{" "}
                <span>
                  <a
                    href={`https://kartkatalog.geonorge.no/metadata/uuid/${result.uuid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vis i Geonorge <IconExternalLink />
                  </a>
                </span>
              </div>
              <div className="abstract">
                {thumbnail && <img src={thumbnail.url} className="thumbnail" />}
                <p>
                  <RenderText text={result.abstract} />
                </p>
                {result.purpose && (
                  <>
                    <h4>Formål</h4>
                    <p>
                      <RenderText text={result.purpose} />
                    </p>
                  </>
                )}
              </div>
              <hr />

              {result.protocol && result.url ? (
                <UsageLink id={result.uuid} protocol={result.protocol} url={result.url} layer={result.layer} />
              ) : null}

              {relatedServices.length ? (
                <>
                  <h3>Relaterte tjenester</h3>
                  <ul>
                    {relatedServices.map((service) => (
                      <li key={service.uuid}>
                        <Link to={`/id/${service.uuid}`}>
                          <TypeIcon type={service.type} protocol={service.protocol} /> {service.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {relatedDatasets.length ? (
                <>
                  <h3>Relaterte datasett</h3>
                  <ul>
                    {relatedDatasets.map((dataset) => (
                      <li key={dataset.uuid}>
                        <Link to={`/id/${dataset.uuid}`}>
                          <TypeIcon type={dataset.type} protocol={dataset.protocol} />
                          {dataset.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h3>Detaljer</h3>
              {result.crs?.length ? <CrsList crs={result.crs} /> : null}
              <Row align="top" wrap>
                <dl>
                  <dt>Utgiver</dt>
                  <dd>{result.publisher}</dd>
                  <dt>Eier</dt>
                  <dd>{result.owner}</dd>
                  <dt>Opprettet</dt>
                  <dd>{result.created}</dd>
                  <dt>Sist endret</dt>
                  <dd>{result.updated}</dd>
                  <dt>Publisert</dt>
                  <dd>{result.published}</dd>
                </dl>
                <dl>
                  <dt>Bruksbegrens&shy;ninger</dt>
                  <dd>{result.constraints?.useLimitation ?? "-"}</dd>
                  <dt>Tilgangs&shy;restriksjoner</dt>
                  <dd>{toAccessText(result.constraints?.accessConstraints)}</dd>
                  <dt>Bruker&shy;restriksjoner</dt>
                  <dd>
                    <UseContraints constraints={result.constraints} />
                  </dd>
                  <dt>Sikkerhets&shy;nivå</dt>
                  <dd>{toSecurityText(result.constraints?.securityConstraints) ?? "-"}</dd>
                  {!!result.constraints?.securityConstraintsNote && (
                    <>
                      <dt>Sikkerhetsgradering, merknad</dt>
                      <dd>{result.constraints?.securityConstraintsNote}</dd>
                    </>
                  )}
                  {!!result.constraints?.otherConstraints && (
                    <>
                      <dt>Andre restriksjoner</dt>
                      <dd>{result.constraints?.otherConstraints}</dd>
                    </>
                  )}
                </dl>
              </Row>

              <details>
                <summary>JSON</summary>
                <code
                  style={{
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(result, null, "  ")}
                </code>
              </details>
            </>
          )}
        </section>
      ) : (
        <p>Laster...</p>
      )}
    </main>
  );
}

function toSecurityText(text: string | undefined) {
  switch (text) {
    case "unclassified":
      return "Ugradert";
    case "restricted":
      return "Begrenset";
    case "confidential":
      return "Fortrolig";
  }
  return text;
}

function toAccessText(text: string | undefined) {
  switch (text) {
    case "no restrictions":
      return "Åpne data";
    case "norway digital restricted":
      return "Norge digitalt (begrenset)";
    case "restricted":
      return "Begrenset";
    case "confidential":
      return "Fortrolig";
  }
  return text;
}

function toUseText(text: string | undefined) {
  switch (text) {
    case "otherRestrictions":
      return "Andre restriksjoner";
  }
  return text;
}

function UseContraints({ constraints }: { constraints?: Constraints }) {
  return constraints?.useConstraintsLink ? (
    <a href={constraints.useConstraintsLink} target="_blank" rel="noreferrer">
      {constraints?.useConstraintsText ?? constraints?.useConstraints}
    </a>
  ) : (
    <>{toUseText(constraints?.useConstraintsText ?? constraints?.useConstraints) ?? "-"}</>
  );
}
