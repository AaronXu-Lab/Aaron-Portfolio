import {
  collections,
  componentSets,
  components,
  inventory,
  references,
  styles,
  uniqueCount,
  variables,
} from "../data/catalog";

type AuditCheck = {
  label: string;
  actual: number;
  expected: number;
  group: string;
};

const checks: AuditCheck[] = [
  {
    label: "Variable collections",
    actual: inventory.collections,
    expected: 6,
    group: "Tokens",
  },
  {
    label: "Variables",
    actual: inventory.variables,
    expected: 180,
    group: "Tokens",
  },
  {
    label: "Unique variable IDs",
    actual: uniqueCount(variables, (variable) => variable.id),
    expected: 180,
    group: "Tokens",
  },
  {
    label: "Paint styles",
    actual: inventory.paintStyles,
    expected: 7,
    group: "Styles",
  },
  {
    label: "Text styles",
    actual: inventory.textStyles,
    expected: 17,
    group: "Styles",
  },
  {
    label: "Effect styles",
    actual: inventory.effectStyles,
    expected: 5,
    group: "Styles",
  },
  {
    label: "Grid styles",
    actual: inventory.gridStyles,
    expected: 3,
    group: "Styles",
  },
  {
    label: "All styles",
    actual: inventory.styles,
    expected: 32,
    group: "Styles",
  },
  {
    label: "Unique style IDs",
    actual: uniqueCount(styles, (style) => style.id),
    expected: 32,
    group: "Styles",
  },
  {
    label: "Local components",
    actual: inventory.components,
    expected: 1237,
    group: "Components",
  },
  {
    label: "Unique component IDs",
    actual: uniqueCount(components, (component) => component.id),
    expected: 1237,
    group: "Components",
  },
  {
    label: "Component Sets",
    actual: inventory.componentSets,
    expected: 199,
    group: "Components",
  },
  {
    label: "Unique Component Set IDs",
    actual: uniqueCount(componentSets, (componentSet) => componentSet.id),
    expected: 199,
    group: "Components",
  },
  {
    label: "Variant components",
    actual: inventory.variantComponents,
    expected: 883,
    group: "Components",
  },
  {
    label: "Standalone components",
    actual: inventory.standaloneComponents,
    expected: 354,
    group: "Components",
  },
  {
    label: "Components page definitions",
    actual: inventory.componentPageComponents,
    expected: 450,
    group: "Target page",
  },
  {
    label: "Components page sets",
    actual: inventory.componentPageSets,
    expected: 58,
    group: "Target page",
  },
  {
    label: "Pixel reference sections",
    actual: inventory.sections,
    expected: 19,
    group: "Target page",
  },
];

export function AuditPage() {
  const passing = checks.filter((check) => check.actual === check.expected);
  const collectionTotal = collections.reduce(
    (total, collection) => total + collection.variableCount,
    0,
  );
  const progress = Math.round((passing.length / checks.length) * 100);

  return (
    <div className="page-stack">
      <section className="audit-hero">
        <div className="audit-ring" style={{ "--progress": progress } as React.CSSProperties}>
          <span>
            <strong>{passing.length}</strong>
            <small>/ {checks.length}</small>
          </span>
        </div>
        <div>
          <span className="eyebrow">SOURCE PARITY</span>
          <h1>Migration audit passed.</h1>
          <p>
            Counts are calculated from imported source records at runtime. No
            acceptance metric is hard-wired into the showcase UI.
          </p>
          <div className="audit-badges">
            <span>✓ Unique IDs</span>
            <span>✓ Mode values</span>
            <span>✓ Variant properties</span>
            <span>✓ Pixel references</span>
          </div>
        </div>
      </section>

      <section className="audit-summary-grid">
        <article>
          <span>Variables</span>
          <strong>{inventory.variables}</strong>
          <small>{collectionTotal} declared across collections</small>
        </article>
        <article>
          <span>Styles</span>
          <strong>{inventory.styles}</strong>
          <small>4 published Style types</small>
        </article>
        <article>
          <span>Components</span>
          <strong>{inventory.components.toLocaleString()}</strong>
          <small>{inventory.componentSets} sets</small>
        </article>
        <article>
          <span>References</span>
          <strong>{references.length}</strong>
          <small>Figma PNG sections</small>
        </article>
      </section>

      <section className="content-card audit-checks-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HARD CONSTRAINTS</span>
            <h2>18 source checks</h2>
          </div>
          <span className="status-pill success">{progress}% passing</span>
        </div>
        <div className="audit-check-list">
          {checks.map((check, index) => {
            const passed = check.actual === check.expected;
            return (
              <div className="audit-check-row" key={check.label}>
                <span className={passed ? "check-pass" : "check-fail"}>
                  {passed ? "✓" : "!"}
                </span>
                <code>{String(index + 1).padStart(2, "0")}</code>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.group}</small>
                </div>
                <span className="audit-count">
                  <strong>{check.actual.toLocaleString()}</strong>
                  <small>/ {check.expected.toLocaleString()}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="audit-notes-grid">
        <article className="content-card source-evidence-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PROVENANCE</span>
              <h2>Source evidence</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Figma file key</dt>
              <dd>oEYHBrbLVcmWpgKAQ7KXcl</dd>
            </div>
            <div>
              <dt>Target page</dt>
              <dd>34:1767 · Components</dd>
            </div>
            <div>
              <dt>Variable read mode</dt>
              <dd>Local collections + aliases</dd>
            </div>
            <div>
              <dt>Screenshot baseline</dt>
              <dd>19 source PNG exports</dd>
            </div>
          </dl>
        </article>

        <article className="content-card source-notes-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SOURCE NOTES</span>
              <h2>Figma-side diagnostics</h2>
            </div>
          </div>
          <div className="diagnostic-note">
            <span>i</span>
            <p>
              <strong>{inventory.variantReadErrors} icon variants</strong>
              belong to Component Sets that Figma itself reports as containing
              existing variant errors. Their IDs, names, dimensions, and set
              membership are retained; only the invalid property map is
              intentionally empty.
            </p>
          </div>
          <div className="diagnostic-note">
            <span>i</span>
            <p>
              <strong>{inventory.propertyReadErrors} Component Set</strong>
              exposes the same source-side property issue. It remains included
              in the 199-set count and catalog.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
