import axios from "axios";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Row } from "./components/Layout";
import { Result } from "./components/Result";
import { useDebounce } from "./hooks/useDebounce";
import { LoadingMask } from "./components/LoadingMask";
import { ResultView } from "./views/ResultView";
import { Outlet, Route, Routes, useNavigate, useParams } from "react-router";
import { BrowserRouter } from "react-router-dom";
import { SearchResult } from "./types/SearchResult";
import "./App.scss";

function MainLayout() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>();
  const [loading, setLoading] = useState(false);
  const lastSearch = useRef("");
  const debouncedQuery = useDebounce(query, 750);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { id } = useParams<{ id: string }>();
  const selected = useMemo(() => results?.find((r) => r.uuid === id), [results, id]);
  const [firstAfterSearch, setFirstAfterSearch] = useState(true);
  const navigate = useNavigate();

  const handleSearch = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (debouncedQuery === lastSearch.current) return;
      lastSearch.current = debouncedQuery;

      setLoading(true);

      try {
        const res = await axios.get<SearchResult[]>("/api/search", {
          params: { q: debouncedQuery, limit: 100 },
        });

        setResults(res.data);
        setFirstAfterSearch(true);
        resultsRef.current?.scrollTo(0, 0);

        if (window.innerWidth <= 1000 && window.location.pathname !== "/") {
          navigate("/");
        }
      } catch (e) {
        console.error(e);
        setResults(undefined);
      }
      setLoading(false);
    },
    [debouncedQuery, navigate]
  );

  useEffect(() => {
    if (debouncedQuery) {
      handleSearch({ preventDefault: () => {} } as unknown as FormEvent<HTMLFormElement>);
    } else {
      setResults(undefined);
    }
  }, [debouncedQuery, handleSearch]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!results || !results.length) return;
      let newUuid;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (firstAfterSearch) {
            newUuid = results[0].uuid;
          } else if (selected) {
            const index = results.indexOf(selected);
            if (index < results.length - 1) {
              newUuid = results[index + 1].uuid;
            }
          } else if (results.length > 0) {
            newUuid = results[0].uuid;
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (selected) {
            const index = results.indexOf(selected);
            if (index > 0) {
              newUuid = results[index - 1].uuid;
            }
          }
          break;
      }
      if (newUuid) {
        navigate(`/id/${newUuid}`);
        const el = document.getElementById(newUuid);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    },
    [results, selected, navigate, firstAfterSearch]
  );

  useEffect(() => {
    setFirstAfterSearch(false);
  }, [selected?.uuid]);

  return (
    <>
      <header>
        <form onSubmit={handleSearch} onKeyDown={handleKey}>
          <Row>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk i norske geodata"
              autoFocus
              accessKey="s"
            />
            <button type="submit" tabIndex={-1}>
              Søk
            </button>
          </Row>
          <p
            className="hint"
            style={{
              opacity: results?.length ? 0.5 : 0,
            }}
          >
            <small>Bruk piltastene (opp og ned) for å navigere gjennom resultatene.</small>
          </p>
        </form>
      </header>
      <aside tabIndex={results?.length ? 0 : -1} onKeyDown={handleKey} ref={resultsRef}>
        {results ? (
          results.length ? (
            results.map((result) => (
              <Result key={result.uuid} active={result.uuid === selected?.uuid} result={result} />
            ))
          ) : (
            <div className="empty">
              <h3>Ingen resultater</h3>
              <p>Prøv å søke på noe annet, f.eks. vær, eiendom, WMS, Kartverket eller liknende.</p>
            </div>
          )
        ) : (
          <div className="empty">
            <h3>Finn norske geodata</h3>
            <p>Skriv inn det du leter etter i søkefeltet over for å søke i norske geodata.</p>
            <p>Dette er en uoffisiell tjeneste som søker i Geonorges oversikt over datasett og tjenester.</p>
            <p>Datagrunnlaget blir synkronisert ukentlig.</p>
            <p style={{ opacity: 0.8 }}>
              Utviklet av Jørgen Nystad.{" "}
              <a href="https://github.com/jnystad/geono" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </p>
          </div>
        )}
        {loading && <LoadingMask />}
      </aside>
      <Outlet />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="/id/:id" element={<ResultView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
