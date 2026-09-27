import { collections, inventory, references } from "../data/catalog";
import { publicStyles, sections, showcaseStats } from "../data/showcase";

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
    value: publicStyles.length,
    detail: "Paint · Text · Effect · Grid",
    page: "styles",
    tone: "blue",
  },
  {
    label: "Components",
    value: showcaseStats.items,
    detail: `${showcaseStats.variants} variants · ${showcaseStats.sections} pages`,
    page: "components",
    tone: "orange",
  },
  {
    label: "Icons",
    value: showcaseStats.icons,
    detail: "16 and 20 pt grids",
    page: "icons",
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
            Variables, styles, components and icons from the Figma library,
            rebuilt as live web specimens that share one semantic token graph.
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
              onClick={() => onNavigate("icons")}
            >
              Browse icons
            </button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-card orbit-card-a">
            <span>VAR</span>
            <strong>{inventory.variables}</strong>
          </div>
          <div className="orbit-card orbit-card-b">
            <span>CMP</span>
            <strong>{showcaseStats.items}</strong>
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
                <span aria-hidden="true" style={{ "--orbit-index": index } as React.CSSProperties}>
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
            <span className="eyebrow">COMPONENTS</span>
            <h2>Browse by component</h2>
          </div>
          <button
            className="text-action"
            onClick={() => onNavigate("components")}
          >
            All {sections.length} pages →
          </button>
        </div>
        <div className="reference-strip">
          {references
            .filter((reference) => sections.some((section) => section.slug === reference.slug))
            .slice(0, 7)
            .map((reference) => (
              <button
                className="reference-tile"
                key={reference.id}
                onClick={() => onNavigate(`components/${reference.slug}`)}
              >
                <span className="reference-image-window">
                  <img alt="" src={reference.src} />
                </span>
                <strong>{reference.name}</strong>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
