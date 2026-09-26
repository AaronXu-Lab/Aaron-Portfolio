import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { LiveSpecimen } from "../components/LiveSpecimen";
import {
  componentSets,
  components,
  inventory,
  references,
  sourcePageOrder,
  type ComponentSetRecord,
  type FigmaComponent,
  type ReferenceSection,
} from "../data/catalog";

type ComponentView = "sections" | "sets" | "records";

const recordsPerPage = 48;

function setComponents(componentSet: ComponentSetRecord): FigmaComponent[] {
  const ids = new Set(componentSet.componentIds);
  return components
    .filter((component) => ids.has(component.id))
    .sort((left, right) => left.pageOrder - right.pageOrder);
}

function setForComponent(
  component: FigmaComponent,
): ComponentSetRecord | null {
  if (!component.componentSet) return null;
  return (
    componentSets.find(
      (componentSet) => componentSet.id === component.componentSet?.id,
    ) ?? null
  );
}

function setsForReference(reference: ReferenceSection): ComponentSetRecord[] {
  const direct = componentSets.filter(
    (componentSet) =>
      componentSet.pageName === "Components" &&
      componentSet.topLevel?.id === reference.id,
  );
  if (direct.length) return direct;

  const setIds = new Set(
    components
      .filter(
        (component) =>
          component.pageName === "Components" &&
          component.topLevel?.id === reference.id,
      )
      .map((component) => component.componentSet?.id)
      .filter(Boolean),
  );
  return componentSets.filter((componentSet) => setIds.has(componentSet.id));
}

function ReferenceSectionCard({
  reference,
  onOpen,
}: {
  reference: ReferenceSection;
  onOpen: () => void;
}) {
  const sets = setsForReference(reference);
  const variants = sets.reduce(
    (result, componentSet) => result + componentSet.variantCount,
    0,
  );
  return (
    <article className="reference-section-card">
      <button className="reference-section-image" onClick={onOpen}>
        <img alt={`${reference.name} Figma reference`} src={reference.src} />
        <span>Open pixel reference ↗</span>
      </button>
      <div className="reference-section-copy">
        <div>
          <span className="eyebrow">FIGMA {reference.id}</span>
          <h3>{reference.name}</h3>
          <p>
            {sets.length} component set{sets.length === 1 ? "" : "s"} ·{" "}
            {variants} variants
          </p>
        </div>
        <span className="reference-size">
          {reference.originalWidth} × {reference.originalHeight}
        </span>
      </div>
      <div className="section-live-preview">
        {sets.slice(0, 2).map((componentSet) => (
          <LiveSpecimen
            compact
            component={setComponents(componentSet)[0]}
            componentSet={componentSet}
            key={componentSet.id}
          />
        ))}
        {sets.length === 0 && (
          <div className="documentation-preview">
            <span>◇</span>
            <strong>Documentation section</strong>
          </div>
        )}
      </div>
    </article>
  );
}

function ComponentSetCard({
  componentSet,
  onOpen,
}: {
  componentSet: ComponentSetRecord;
  onOpen: () => void;
}) {
  const variants = setComponents(componentSet);
  const propertyNames = Object.keys(componentSet.variantGroupProperties);
  return (
    <article className="component-set-card">
      <div className="set-live-stage">
        <LiveSpecimen
          compact
          component={variants[0]}
          componentSet={componentSet}
        />
      </div>
      <div className="set-card-copy">
        <div>
          <span className="source-chip">{componentSet.pageName}</span>
          <code>{componentSet.id}</code>
        </div>
        <h3>{componentSet.name}</h3>
        <p>
          {componentSet.variantCount} variant
          {componentSet.variantCount === 1 ? "" : "s"}
        </p>
        <div className="property-chip-row">
          {propertyNames.slice(0, 3).map((propertyName) => (
            <span key={propertyName}>{propertyName}</span>
          ))}
          {propertyNames.length > 3 && <span>+{propertyNames.length - 3}</span>}
        </div>
      </div>
      <button className="open-card-button" onClick={onOpen}>
        Inspect set <span>→</span>
      </button>
    </article>
  );
}

function ComponentRecordCard({
  component,
  onOpen,
}: {
  component: FigmaComponent;
  onOpen: (componentSet: ComponentSetRecord) => void;
}) {
  const componentSet = setForComponent(component);
  return (
    <article className="component-record-card">
      <div className="record-preview">
        <LiveSpecimen
          compact
          component={component}
          componentSet={componentSet}
        />
      </div>
      <div className="record-copy">
        <span>
          {component.pageName} · {component.pageOrder + 1}
        </span>
        <strong>{component.name}</strong>
        <code>{component.id}</code>
        <div className="property-chip-row">
          {Object.entries(component.variantProperties)
            .slice(0, 3)
            .map(([name, value]) => (
              <span key={name}>
                {name}: {value}
              </span>
            ))}
          {component.variantReadError && (
            <span className="source-warning">Source set error</span>
          )}
        </div>
      </div>
      {componentSet && (
        <button
          aria-label={`Inspect ${componentSet.name}`}
          className="record-open"
          onClick={() => onOpen(componentSet)}
        >
          ↗
        </button>
      )}
    </article>
  );
}

function SetInspector({
  componentSet,
  onClose,
}: {
  componentSet: ComponentSetRecord;
  onClose: () => void;
}) {
  const variants = setComponents(componentSet);
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const selected =
    variants.find((variant) => variant.id === selectedId) ?? variants[0];
  const reference = references.find(
    (item) => item.id === componentSet.topLevel?.id,
  );

  useEffect(() => {
    setSelectedId(variants[0]?.id ?? "");
  }, [componentSet.id]);

  return (
    <Modal className="inspector-backdrop" label={`${componentSet.name} inspector`} onClose={onClose}>
      <aside
        aria-label={`${componentSet.name} inspector`}
        className="set-inspector"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">
              {componentSet.pageName} · {componentSet.id}
            </span>
            <h2>{componentSet.name}</h2>
            <p>
              {componentSet.variantCount} variants ·{" "}
              {Object.keys(componentSet.variantGroupProperties).length} variant
              properties
            </p>
          </div>
          <button
            aria-label="Close inspector"
            className="inspector-close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="inspector-scroll">
          <section>
            <div className="inspector-section-heading">
              <strong>Interactive specimen</strong>
              <span>Web implementation</span>
            </div>
            <div className="inspector-live-stage">
              <LiveSpecimen
                component={selected}
                componentSet={componentSet}
              />
            </div>
          </section>

          {reference && (
            <section>
              <div className="inspector-section-heading">
                <strong>Figma reference</strong>
                <span>Pixel baseline</span>
              </div>
              <a
                className="inspector-reference"
                href={reference.src}
                rel="noreferrer"
                target="_blank"
              >
                <img alt={`${reference.name} source`} src={reference.src} />
              </a>
            </section>
          )}

          <section>
            <div className="inspector-section-heading">
              <strong>Variants</strong>
              <span>{variants.length} source components</span>
            </div>
            <div className="variant-selector">
              {variants.map((variant) => (
                <button
                  className={selected?.id === variant.id ? "active" : ""}
                  key={variant.id}
                  onClick={() => setSelectedId(variant.id)}
                >
                  <span>{variant.name}</span>
                  <code>{variant.id}</code>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="inspector-section-heading">
              <strong>Property model</strong>
              <span>Figma Component Set</span>
            </div>
            <div className="property-table">
              {Object.entries(componentSet.variantGroupProperties).map(
                ([name, definition]) => (
                  <div key={name}>
                    <strong>{name}</strong>
                    <span>{definition.values.join(" · ")}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      </aside>
    </Modal>
  );
}

function ReferenceModal({
  reference,
  onClose,
}: {
  reference: ReferenceSection;
  onClose: () => void;
}) {
  return (
    <Modal className="reference-modal" label={`${reference.name} reference`} onClose={onClose}>
      <div
        className="reference-modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">FIGMA PIXEL REFERENCE</span>
            <h2>{reference.name}</h2>
            <p>
              Node {reference.id} · {reference.originalWidth} ×{" "}
              {reference.originalHeight}
            </p>
          </div>
          <button className="inspector-close" aria-label="Close reference" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="reference-canvas">
          <img alt={`${reference.name} Figma reference`} src={reference.src} />
        </div>
      </div>
    </Modal>
  );
}

export function ComponentsPage() {
  const [view, setView] = useState<ComponentView>("sections");
  const [search, setSearch] = useState("");
  const [pageName, setPageName] = useState("All pages");
  const [recordPage, setRecordPage] = useState(0);
  const [inspectedSet, setInspectedSet] = useState<ComponentSetRecord | null>(
    null,
  );
  const [reference, setReference] = useState<ReferenceSection | null>(null);

  const filteredSets = useMemo(
    () =>
      componentSets.filter(
        (componentSet) =>
          (pageName === "All pages" || componentSet.pageName === pageName) &&
          componentSet.name
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      ),
    [pageName, search],
  );

  const filteredRecords = useMemo(
    () =>
      components.filter(
        (component) =>
          (pageName === "All pages" || component.pageName === pageName) &&
          `${component.name} ${component.componentSet?.name ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      ),
    [pageName, search],
  );

  useEffect(() => setRecordPage(0), [pageName, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / recordsPerPage),
  );
  const pagedRecords = filteredRecords.slice(
    recordPage * recordsPerPage,
    (recordPage + 1) * recordsPerPage,
  );

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">LOCAL COMPONENT CATALOG</span>
          <h1>Components</h1>
          <p>
            Browse 19 source sections, 199 Component Sets, or every one of the
            file’s 1,237 local Component definitions.
          </p>
        </div>
        <div className="title-metric">
          <strong>{inventory.components.toLocaleString()}</strong>
          <span>components</span>
        </div>
      </section>

      <section className="component-view-switcher">
        {(
          [
            ["sections", "Sections", inventory.sections],
            ["sets", "Component Sets", inventory.componentSets],
            ["records", "All Definitions", inventory.components],
          ] as const
        ).map(([value, label, count]) => (
          <button
            className={view === value ? "active" : ""}
            key={value}
            onClick={() => setView(value)}
          >
            <span>{label}</span>
            <strong>{count.toLocaleString()}</strong>
          </button>
        ))}
      </section>

      {view === "sections" ? (
        <section className="reference-section-grid">
          {references.map((item) => (
            <ReferenceSectionCard
              key={item.id}
              onOpen={() => setReference(item)}
              reference={item}
            />
          ))}
        </section>
      ) : (
        <section className="content-card component-browser">
          <div className="browser-toolbar">
            <label className="search-field">
              <span>⌕</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  view === "sets"
                    ? "Search Component Sets"
                    : "Search all definitions"
                }
                value={search}
              />
            </label>
            <div className="page-filter">
              <select
                aria-label="Filter by source page"
                onChange={(event) => setPageName(event.target.value)}
                value={pageName}
              >
                <option>All pages</option>
                {sourcePageOrder.map((sourcePage) => (
                  <option key={sourcePage}>{sourcePage}</option>
                ))}
              </select>
            </div>
            <span className="result-count">
              {(view === "sets"
                ? filteredSets.length
                : filteredRecords.length
              ).toLocaleString()}{" "}
              results
            </span>
          </div>

          {view === "sets" ? (
            <div className="component-set-grid">
              {filteredSets.map((componentSet) => (
                <ComponentSetCard
                  componentSet={componentSet}
                  key={componentSet.id}
                  onOpen={() => setInspectedSet(componentSet)}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="component-record-grid">
                {pagedRecords.map((component) => (
                  <ComponentRecordCard
                    component={component}
                    key={component.id}
                    onOpen={setInspectedSet}
                  />
                ))}
              </div>
              <nav className="pagination" aria-label="Component pages">
                <button
                  disabled={recordPage === 0}
                  onClick={() => setRecordPage((page) => Math.max(0, page - 1))}
                >
                  ← Previous
                </button>
                <span>
                  Page {recordPage + 1} of {totalPages}
                </span>
                <button
                  disabled={recordPage >= totalPages - 1}
                  onClick={() =>
                    setRecordPage((page) => Math.min(totalPages - 1, page + 1))
                  }
                >
                  Next →
                </button>
              </nav>
            </>
          )}
        </section>
      )}

      {inspectedSet && (
        <SetInspector
          componentSet={inspectedSet}
          onClose={() => setInspectedSet(null)}
        />
      )}
      {reference && (
        <ReferenceModal
          onClose={() => setReference(null)}
          reference={reference}
        />
      )}
    </div>
  );
}
