import { useMemo, useState } from "react";
import {
  inventory,
  rgbaToCss,
  styles,
  type FigmaStyle,
  type RGBAValue,
} from "../data/catalog";

type StyleType = "TEXT" | "PAINT" | "EFFECT" | "GRID";

type PaintRecord = {
  type: string;
  color?: RGBAValue;
  gradientStops?: Array<{ color: RGBAValue; position: number }>;
};

type EffectRecord = {
  type: string;
  radius?: number;
  spread?: number;
  color?: RGBAValue;
  offset?: { x: number; y: number };
};

function paintBackground(style: FigmaStyle): string {
  const paint = style.paints?.[0] as PaintRecord | undefined;
  if (!paint) return "var(--surface-muted)";
  if (paint.type === "SOLID" && paint.color) return rgbaToCss(paint.color);
  if (paint.gradientStops?.length) {
    return `linear-gradient(135deg, ${paint.gradientStops
      .map(
        (stop) =>
          `${rgbaToCss(stop.color)} ${Math.round(stop.position * 100)}%`,
      )
      .join(", ")})`;
  }
  return "var(--surface-muted)";
}

function effectStyle(style: FigmaStyle): React.CSSProperties {
  const effect = style.effects?.[0] as EffectRecord | undefined;
  if (!effect) return {};
  if (effect.type === "DROP_SHADOW" && effect.color) {
    return {
      boxShadow: `${effect.offset?.x ?? 0}px ${effect.offset?.y ?? 0}px ${
        effect.radius ?? 0
      }px ${effect.spread ?? 0}px ${rgbaToCss(effect.color)}`,
    };
  }
  if (effect.type.includes("BLUR")) {
    return {
      backdropFilter: `blur(${effect.radius ?? 0}px)`,
      background: "rgb(255 255 255 / 56%)",
    };
  }
  return {};
}

function styleMetric(type: StyleType): number {
  return styles.filter((style) => style.styleType === type).length;
}

function TextStyleCard({ style }: { style: FigmaStyle }) {
  const lineHeight =
    style.lineHeight?.unit === "PIXELS"
      ? `${style.lineHeight.value}px`
      : style.lineHeight?.unit === "PERCENT"
        ? `${style.lineHeight.value}%`
        : "normal";
  return (
    <article className="text-style-card">
      <div className="style-preview-surface">
        <span
          style={{
            fontFamily: `"${style.fontName?.family}", sans-serif`,
            fontSize: style.fontSize,
            fontWeight: style.fontName?.style.includes("Bold") ? 600 : 400,
            letterSpacing:
              style.letterSpacing?.unit === "PIXELS"
                ? style.letterSpacing.value
                : undefined,
            lineHeight,
            textTransform:
              style.textCase === "UPPER" ? "uppercase" : undefined,
          }}
        >
          Follow up with clarity.
        </span>
      </div>
      <div className="style-card-copy">
        <strong>{style.name}</strong>
        <span>
          {style.fontName?.family} · {style.fontName?.style}
        </span>
        <code>
          {style.fontSize}px / {lineHeight}
        </code>
      </div>
    </article>
  );
}

function PaintStyleCard({ style }: { style: FigmaStyle }) {
  return (
    <article className="paint-style-card">
      <span
        className="paint-style-preview"
        style={{ background: paintBackground(style) }}
      />
      <div>
        <strong>{style.name}</strong>
        <small>{(style.paints?.[0] as PaintRecord | undefined)?.type}</small>
      </div>
      <code>{style.id.slice(0, 12)}…</code>
    </article>
  );
}

function EffectStyleCard({ style }: { style: FigmaStyle }) {
  const effect = style.effects?.[0] as EffectRecord | undefined;
  return (
    <article className="effect-style-card">
      <div className="effect-demo-stage">
        <span style={effectStyle(style)}>Fx</span>
      </div>
      <div>
        <strong>{style.name}</strong>
        <small>{effect?.type?.replaceAll("_", " ")}</small>
      </div>
      <code>{effect?.radius ?? 0}px</code>
    </article>
  );
}

function GridStyleCard({ style }: { style: FigmaStyle }) {
  const grid = style.layoutGrids?.[0] as
    | { pattern?: string; sectionSize?: number; gutterSize?: number }
    | undefined;
  return (
    <article className="grid-style-card">
      <span
        className={`grid-demo ${grid?.pattern?.toLocaleLowerCase() ?? ""}`}
      >
        <i />
      </span>
      <div>
        <strong>{style.name}</strong>
        <small>{grid?.pattern ?? "GRID"}</small>
      </div>
      <code>{grid?.sectionSize ?? grid?.gutterSize ?? 0}px</code>
    </article>
  );
}

export function StylesPage() {
  const [type, setType] = useState<StyleType>("TEXT");
  const [search, setSearch] = useState("");
  const visibleStyles = useMemo(
    () =>
      styles.filter(
        (style) =>
          style.styleType === type &&
          style.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ),
    [search, type],
  );

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <span className="eyebrow">LOCAL STYLES</span>
          <h1>Published Styles</h1>
          <p>
            Typography, gradients, effects, and layout guides reconstructed
            from the file’s 32 local Style records.
          </p>
        </div>
        <div className="title-metric">
          <strong>{inventory.styles}</strong>
          <span>styles</span>
        </div>
      </section>

      <section className="style-type-tabs">
        {(
          [
            ["TEXT", "Text", inventory.textStyles],
            ["PAINT", "Paint", inventory.paintStyles],
            ["EFFECT", "Effect", inventory.effectStyles],
            ["GRID", "Grid", inventory.gridStyles],
          ] as const
        ).map(([value, label, count]) => (
          <button
            className={value === type ? "active" : ""}
            key={value}
            onClick={() => setType(value)}
          >
            <span className={`style-type-icon ${value.toLowerCase()}`}>
              {value === "TEXT"
                ? "Aa"
                : value === "PAINT"
                  ? "◒"
                  : value === "EFFECT"
                    ? "✦"
                    : "▦"}
            </span>
            <span>
              <strong>{label}</strong>
              <small>{count} styles</small>
            </span>
          </button>
        ))}
      </section>

      <section className="content-card style-browser">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{type} CATALOG</span>
            <h2>
              {type.charAt(0)}
              {type.slice(1).toLocaleLowerCase()} styles
            </h2>
          </div>
          <label className="search-field compact-search">
            <span>⌕</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter styles"
              value={search}
            />
          </label>
        </div>

        <div className={`style-grid type-${type.toLocaleLowerCase()}`}>
          {visibleStyles.map((style) => {
            if (type === "TEXT")
              return <TextStyleCard key={style.id} style={style} />;
            if (type === "PAINT")
              return <PaintStyleCard key={style.id} style={style} />;
            if (type === "EFFECT")
              return <EffectStyleCard key={style.id} style={style} />;
            return <GridStyleCard key={style.id} style={style} />;
          })}
        </div>

        <footer className="browser-footnote">
          <span className="status-dot" />
          <span>
            Showing {visibleStyles.length} of {styleMetric(type)} {type} styles
          </span>
          <code>IDs preserved from Figma</code>
        </footer>
      </section>
    </div>
  );
}
