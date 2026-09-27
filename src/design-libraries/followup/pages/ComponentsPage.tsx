import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  exactVariant,
  sectionBySlug,
  sections,
  type Axis,
  type Props,
  type ShowcaseItem,
} from "../data/showcase";
import { renderers, type Renderer } from "../specimens/registry";

const variantLabel = (props: Props) =>
  Object.entries(props)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

function Missing({ item }: { item: ShowcaseItem }) {
  return <p className="specimen-missing">{item.name} has no web specimen yet.</p>;
}

function AxisControl({
  axis,
  value,
  onChange,
}: {
  axis: Axis;
  value: string;
  onChange: (value: string) => void;
}) {
  if (axis.values.length > 5) {
    return (
      <label className="axis-control">
        <span>{axis.name}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {axis.values.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="axis-control" role="group" aria-label={axis.name}>
      <span>{axis.name}</span>
      <div className="axis-segments">
        {axis.values.map((option) => (
          <button
            aria-pressed={option === value}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function VariantMatrix({ item, render }: { item: ShowcaseItem; render: Renderer }) {
  return (
    <div className="variant-matrix">
      <h3>
        All variants <small>{item.variants.length}</small>
      </h3>
      <div className="variant-scroll" tabIndex={0} aria-label={`${item.name} variants, scrollable`}>
        <div className="variant-canvas" style={{ width: item.width, height: item.height }}>
          {item.variants.map((variant) => (
            <div
              aria-label={variantLabel(variant.props)}
              className="variant-cell"
              key={variant.id}
              role="img"
              style={{ left: variant.x, top: variant.y, width: variant.width, height: variant.height }}
              title={variantLabel(variant.props)}
            >
              <div inert>{render({ props: variant.props, interactive: false })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemPanel({ item }: { item: ShowcaseItem }) {
  const [props, setProps] = useState<Props>(item.defaults);
  const render = renderers[item.id];
  const drawn = item.axes.length === 0 || exactVariant(item, props);
  // Specimens wider than the stage scale down proportionally (not below 50%) instead of being clipped.
  const stage = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const widest = Math.max(...item.variants.map((variant) => variant.width));
    const observer = new ResizeObserver(() => {
      const inner = node.firstElementChild as HTMLElement;
      const padding = parseFloat(getComputedStyle(inner).paddingLeft) * 2;
      setZoom(Math.max(0.5, Math.min(1, (node.clientWidth - padding) / widest)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [item]);
  return (
    <section className="content-card item-panel" id={`item-${item.slug}`}>
      <header className="item-head">
        <h2>{item.name}</h2>
        {item.axes.length > 0 && (
          <button className="text-action" onClick={() => setProps(item.defaults)} type="button">
            Reset
          </button>
        )}
      </header>
      {item.axes.length > 0 && (
        <div className="item-controls">
          {item.axes.map((axis) => (
            <AxisControl
              axis={axis}
              key={axis.name}
              onChange={(value) => setProps({ ...props, [axis.name]: value })}
              value={props[axis.name]}
            />
          ))}
        </div>
      )}
      <div className="item-stage" ref={stage}>
        <div className="item-stage-inner">
          <div style={zoom < 1 ? ({ zoom } as CSSProperties) : undefined}>
            {render ? render({ props, interactive: true }) : <Missing item={item} />}
          </div>
        </div>
      </div>
      {!drawn && <p className="item-note">This combination isn’t drawn in the Figma source.</p>}
      {render && item.variants.length > 1 && <VariantMatrix item={item} render={render} />}
    </section>
  );
}

export function ComponentsPage({
  slug,
  itemSlug,
  onNavigate,
}: {
  slug?: string;
  itemSlug?: string;
  onNavigate: (target: string) => void;
}) {
  const section = sectionBySlug(slug);
  const variants = section.items.reduce((total, item) => total + item.variants.length, 0);

  useEffect(() => {
    if (!itemSlug) return;
    document.getElementById(`item-${itemSlug}`)?.scrollIntoView({ block: "start" });
  }, [section.slug, itemSlug]);

  return (
    <div className="page-stack">
      <label className="section-switcher">
        <span>Component</span>
        <select value={section.slug} onChange={(event) => onNavigate(`components/${event.target.value}`)}>
          {(["Components", "Scenary"] as const).map((group) => (
            <optgroup key={group} label={group}>
              {sections
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <header className="page-title-row">
        <div>
          <span className="eyebrow">{section.group.toUpperCase()}</span>
          <h1>{section.name}</h1>
          <p>
            {section.items.length} component{section.items.length === 1 ? "" : "s"} · {variants} variant
            {variants === 1 ? "" : "s"}, each rendered live from the Figma source.
          </p>
        </div>
      </header>
      {section.items.length > 1 && (
        <nav className="item-index" aria-label={`${section.name} components`}>
          {section.items.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                document.getElementById(`item-${item.slug}`)?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                })
              }
              type="button"
            >
              {item.name}
            </button>
          ))}
        </nav>
      )}
      {section.items.map((item) => (
        <ItemPanel item={item} key={item.id} />
      ))}
    </div>
  );
}
