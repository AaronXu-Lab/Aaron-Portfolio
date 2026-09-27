import { useMemo, useState } from "react";
import { icons } from "../data/showcase";
import { Icon } from "../specimens/shared";

export function IconsPage() {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<"All" | "16" | "20">("All");
  const groups = useMemo(() => {
    const byName = new Map<string, typeof icons>();
    for (const icon of icons) byName.set(icon.name, [...(byName.get(icon.name) ?? []), icon]);
    const needle = query.trim().toLowerCase();
    return [...byName]
      .filter(([name]) => name.toLowerCase().includes(needle))
      .map(([name, list]) => {
        const shown = size === "All" ? list : list.filter((icon) => String(icon.size) === size);
        return [name, shown.length ? shown : list] as const;
      });
  }, [query, size]);

  return (
    <div className="page-stack">
      <header className="page-title-row">
        <div>
          <span className="eyebrow">ICONS</span>
          <h1>Icons</h1>
          <p>
            {new Set(icons.map((icon) => icon.name)).size} icons exported from the Figma icon set, drawn
            on 16 and 20 pt grids and tinted by the current text color.
          </p>
        </div>
      </header>
      <div className="icon-toolbar">
        <label className="icon-search">
          <span className="sr-only">Search icons</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search icons"
            type="search"
            value={query}
          />
        </label>
        <div className="axis-segments" role="group" aria-label="Grid size">
          {(["All", "16", "20"] as const).map((option) => (
            <button aria-pressed={size === option} key={option} onClick={() => setSize(option)} type="button">
              {option === "All" ? "All" : `${option} pt`}
            </button>
          ))}
        </div>
      </div>
      <div className="icon-wall">
        {groups.map(([name, list]) => (
          <figure className="icon-tile" key={name}>
            <div className="icon-tile-glyphs">
              {list.map((icon) => (
                <Icon key={icon.file} name={icon.name} size={icon.size} variant={icon.variant ?? undefined} />
              ))}
            </div>
            <figcaption>{name}</figcaption>
          </figure>
        ))}
      </div>
      {groups.length === 0 && <p className="icon-empty">No icons match “{query}”.</p>}
    </div>
  );
}
