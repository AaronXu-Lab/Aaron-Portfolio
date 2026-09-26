import {
  collections,
  componentsByPage,
  inventory,
  references,
  sourcePageOrder,
} from "../data/catalog";

type OverviewPageProps = {
  onNavigate: (page: string) => void;
};

const metrics = [
  {
    label: "Design variables",
    value: inventory.variables,
    detail: `${inventory.collections} collections`,
    page: "tokens",
    tone: "purple",
  },
  {
    label: "Published styles",
    value: inventory.styles,
    detail: "Paint · Text · Effect · Grid",
    page: "styles",
    tone: "blue",
  },
  {
    label: "Local components",
    value: inventory.components,
    detail: `${inventory.componentSets} component sets`,
    page: "components",
    tone: "orange",
  },
  {
    label: "Source checks",
    value: 18,
    detail: "18 of 18 passing",
    page: "audit",
    tone: "green",
  },
];

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">FOLLOWUP · DESIGN LIBRARY</span>
          <h1>One source of truth, reconstructed for the web.</h1>
          <p>
            Every local Variable, Style, Component, Component Set, and source
            page is indexed from Figma. The interactive specimens below use
            the same semantic token graph.
          </p>
          <div className="hero-actions">
            <button
              className="primary-action"
              onClick={() => onNavigate("components")}
            >
              Explore components <span>→</span>
            </button>
            <button
              className="secondary-action"
              onClick={() => onNavigate("audit")}
            >
              View source audit
            </button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-card orbit-card-a">
            <span>VAR</span>
            <strong>{inventory.variables}</strong>
          </div>
          <div className="orbit-card orbit-card-b">
            <span>SET</span>
            <strong>{inventory.componentSets}</strong>
          </div>
          <div className="orbit-core">
            <span>F</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Inventory overview">
        {metrics.map((metric) => (
          <button
            className={`metric-card tone-${metric.tone}`}
            key={metric.label}
            onClick={() => onNavigate(metric.page)}
          >
            <span>{metric.label}</span>
            <strong>{metric.value.toLocaleString()}</strong>
            <small>{metric.detail}</small>
            <i aria-hidden="true">↗</i>
          </button>
        ))}
      </section>

      <section className="overview-columns">
        <article className="content-card source-map-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SOURCE MAP</span>
              <h2>Component distribution</h2>
            </div>
            <span className="status-pill">1,237 unique IDs</span>
          </div>
          <div className="distribution-list">
            {sourcePageOrder.map((pageName) => {
              const count = componentsByPage[pageName]?.length ?? 0;
              const percent = (count / inventory.components) * 100;
              return (
                <div className="distribution-row" key={pageName}>
                  <div>
                    <span>{pageName}</span>
                    <strong>{count}</strong>
                  </div>
                  <span className="distribution-track">
                    <i style={{ width: `${Math.max(percent, 0.8)}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="content-card collections-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TOKEN GRAPH</span>
              <h2>Six connected collections</h2>
            </div>
          </div>
          <div className="collection-orbits">
            {collections.map((collection, index) => (
              <button
                className="collection-orbit"
                key={collection.id}
                onClick={() => onNavigate("tokens")}
              >
                <span style={{ "--orbit-index": index } as React.CSSProperties}>
                  {collection.name.charAt(0)}
                </span>
                <div>
                  <strong>{collection.name}</strong>
                  <small>
                    {collection.variableCount} variables ·{" "}
                    {collection.modes.length} mode
                    {collection.modes.length === 1 ? "" : "s"}
                  </small>
                </div>
                <i>→</i>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="content-card reference-preview-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PIXEL REFERENCES</span>
            <h2>Figma component sections</h2>
          </div>
          <button
            className="text-action"
            onClick={() => onNavigate("components")}
          >
            Open all {references.length} sections →
          </button>
        </div>
        <div className="reference-strip">
          {references.slice(0, 7).map((reference) => (
            <button
              className="reference-tile"
              key={reference.id}
              onClick={() => onNavigate("components")}
            >
              <span className="reference-image-window">
                <img alt="" src={reference.src} />
              </span>
              <strong>{reference.name}</strong>
              <small>{reference.id}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
