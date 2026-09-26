import { useEffect, useMemo, useState } from "react";
import {
  collections,
  resolveVariableValue,
  rgbaToCss,
  valueToLabel,
  variables,
  type FigmaVariable,
  type RGBAValue,
  type VariableValue,
} from "../data/catalog";

type TokensPageProps = {
  themeMode: string;
};

function isColor(value: VariableValue | null): value is RGBAValue {
  return typeof value === "object" && value !== null && "r" in value;
}

function TokenVisual({
  token,
  value,
}: {
  token: FigmaVariable;
  value: VariableValue | null;
}) {
  if (isColor(value)) {
    return (
      <span
        className="token-swatch"
        style={{ background: rgbaToCss(value) }}
      />
    );
  }

  if (typeof value === "number") {
    if (token.name.toLocaleLowerCase().includes("radius")) {
      return (
        <span
          className="radius-swatch"
          style={{ borderRadius: Math.min(value, 24) }}
        />
      );
    }
    return (
      <span className="number-swatch">
        <i style={{ width: `${Math.max(2, Math.min(value, 64))}px` }} />
      </span>
    );
  }

  return <span className="text-token-glyph">Aa</span>;
}

export function TokensPage({ themeMode }: TokensPageProps) {
  const [collectionName, setCollectionName] = useState("Color/Tokens");
  const collection =
    collections.find((item) => item.name === collectionName) ?? collections[0];
  const [mode, setMode] = useState(collection?.modes[0]?.name ?? "Mode 1");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");

  useEffect(() => {
    setMode(collection?.modes[0]?.name ?? "Mode 1");
  }, [collection?.id]);

  const visibleVariables = useMemo(
    () =>
      variables.filter(
        (variable) =>
          variable.collectionName === collectionName &&
          variable.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ),
    [collectionName, search],
  );

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">FIGMA VARIABLES</span>
          <h1>Design Tokens</h1>
          <p>
            Six collections, complete mode values, alias targets, and usage
            scopes. Every displayed value resolves from the exported Figma
            graph.
          </p>
        </div>
        <div className="title-metric">
          <strong>{variables.length}</strong>
          <span>variables</span>
        </div>
      </section>

      <section className="collection-tabs" aria-label="Variable collections">
        {collections.map((item) => (
          <button
            className={item.name === collectionName ? "active" : ""}
            key={item.id}
            onClick={() => setCollectionName(item.name)}
          >
            <span>{item.name}</span>
            <strong>{item.variableCount}</strong>
          </button>
        ))}
      </section>

      <section className="content-card token-browser">
        <div className="browser-toolbar">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${collectionName}`}
              value={search}
            />
          </label>
          <div className="mode-switcher" aria-label="Variable mode">
            {collection?.modes.map((item) => (
              <button
                className={mode === item.name ? "active" : ""}
                key={item.modeId}
                onClick={() => setMode(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="view-switcher">
            <button
              aria-label="Table view"
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              ☷
            </button>
            <button
              aria-label="Grid view"
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              ▦
            </button>
          </div>
        </div>

        <div className="collection-meta">
          <div>
            <span className="collection-mark">
              {collectionName.split("/").map((part) => part.charAt(0))}
            </span>
            <div>
              <strong>{collectionName}</strong>
              <small>
                {collection?.id} · {visibleVariables.length} shown
              </small>
            </div>
          </div>
          <span className="status-pill">
            {collection?.modes.length} mode
            {collection?.modes.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className={`token-list ${view}`}>
          {visibleVariables.map((token) => {
            const selected = token.values.find(
              (entry) => entry.modeName === mode,
            );
            const resolved = resolveVariableValue(token, mode, themeMode);
            return (
              <article className="token-row" key={token.id}>
                <TokenVisual token={token} value={resolved} />
                <div className="token-name">
                  <strong>{token.name}</strong>
                  <small>{token.resolvedType}</small>
                </div>
                <div className="token-value">
                  <code>{valueToLabel(resolved)}</code>
                  {selected?.aliasTargetName && (
                    <small>
                      ↳ {selected.aliasTargetCollectionName}/
                      {selected.aliasTargetName}
                    </small>
                  )}
                </div>
                <div className="token-scope">
                  <span>{token.scopes[0] ?? "ALL_SCOPES"}</span>
                  <code>{token.id.replace("VariableID:", "")}</code>
                </div>
              </article>
            );
          })}
        </div>

        {visibleVariables.length === 0 && (
          <div className="empty-state">
            <span>⌕</span>
            <strong>No matching token</strong>
            <p>Try a shorter name or switch collections.</p>
          </div>
        )}
      </section>
    </div>
  );
}
