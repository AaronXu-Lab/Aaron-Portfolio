import { useEffect, useMemo, useState } from "react";
import {
  cssVariableName,
  resolveVariableValue,
  valueToCss,
  variables,
} from "./data/catalog";
import { icons, sections, showcaseStats } from "./data/showcase";
import { ComponentsPage } from "./pages/ComponentsPage";
import { IconsPage } from "./pages/IconsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StylesPage } from "./pages/StylesPage";
import { TokensPage } from "./pages/TokensPage";

type PageName = "overview" | "tokens" | "styles" | "components" | "icons";

const pages: Record<
  PageName,
  { label: string; eyebrow: string; glyph: string }
> = {
  overview: { label: "Overview", eyebrow: "LIBRARY HOME", glyph: "⌂" },
  tokens: { label: "Design Tokens", eyebrow: "VARIABLES", glyph: "◉" },
  styles: { label: "Styles", eyebrow: "PUBLISHED STYLES", glyph: "Aa" },
  components: { label: "Components", eyebrow: "COMPONENTS", glyph: "◇" },
  icons: { label: "Icons", eyebrow: "ICONS", glyph: "✦" },
};

const themeModes = ["Default", "Blue", "Green", "Orange"];

type Route = { page: PageName; slug?: string; item?: string };

function routeFromHash(): Route {
  const [page, slug, item] = window.location.hash.replace(/^#\/?/, "").split("/");
  return page in pages ? { page: page as PageName, slug, item } : { page: "overview" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const page = route.page;
  const [themeMode, setThemeMode] = useState("Default");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const variable of variables.filter((item) => item.resolvedType === "FLOAT")) {
      const value = resolveVariableValue(variable, variable.values[0]?.modeName, themeMode);
      if (typeof value === "number") root.style.setProperty(cssVariableName(variable.name), `${value}px`);
    }
    for (const variable of variables.filter(
      (item) => item.resolvedType === "COLOR",
    )) {
      const mode =
        variable.collectionName === "Color/Theme"
          ? themeMode
          : variable.collectionName === "Color/Tokens"
            ? "Normal"
            : variable.values[0]?.modeName;
      const value = resolveVariableValue(variable, mode, themeMode);
      root.style.setProperty(cssVariableName(variable.name), valueToCss(value));
    }
    root.dataset.theme = themeMode.toLocaleLowerCase();
  }, [themeMode]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setSearchOpen(true);
      }
      if (event.key === "Escape") { setSearchOpen(false); setMobileNavigationOpen(false); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    const tokenResults = variables
      .filter((item) => item.name.toLocaleLowerCase().includes(query))
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        type: "Token",
        title: item.name,
        detail: item.collectionName,
        page: "tokens",
      }));
    const componentResults = sections
      .flatMap((section) => section.items.map((item) => ({ section, item })))
      .filter(({ item }) => item.name.toLocaleLowerCase().includes(query))
      .slice(0, 5)
      .map(({ section, item }) => ({
        id: item.id,
        type: "Component",
        title: item.name,
        detail: `${section.name} · ${item.variants.length} variant${item.variants.length === 1 ? "" : "s"}`,
        page: `components/${section.slug}/${item.slug}`,
      }));
    const iconResults = [...new Set(icons.map((icon) => icon.name))]
      .filter((name) => name.toLocaleLowerCase().includes(query))
      .slice(0, 3)
      .map((name) => ({ id: `icon-${name}`, type: "Icon", title: name, detail: "Icons", page: "icons" }));
    return [...componentResults, ...tokenResults, ...iconResults].slice(0, 8);
  }, [search]);

  function navigate(target: string) {
    window.location.hash = `#/${target}`;
    setRoute(routeFromHash());
    setMobileNavigationOpen(false);
    setSearchOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <div className="app-shell">
      <button
        aria-label="Close navigation"
        className={`mobile-scrim ${mobileNavigationOpen ? "open" : ""}`}
        onClick={() => setMobileNavigationOpen(false)}
      />
      <aside
        className={`sidebar ${mobileNavigationOpen ? "mobile-open" : ""}`}
      >
        <button className="brand" onClick={() => navigate("overview")}>
          <span className="brand-mark">
            <i />
            <strong>f</strong>
          </span>
          <span>
            <strong>followup</strong>
            <small>Design Library</small>
          </span>
        </button>

        <a className="library-back" href="/design/more/">← 更多组件库</a>
        <nav className="primary-navigation" aria-label="Primary navigation">
          <span className="navigation-label">LIBRARY</span>
          {(["overview", "tokens", "styles", "icons"] as PageName[]).map((key) => (
            <button
              aria-current={page === key ? "page" : undefined}
              className={page === key ? "active" : ""}
              key={key}
              onClick={() => navigate(key)}
            >
              <span className="nav-glyph">{pages[key].glyph}</span>
              <span>{pages[key].label}</span>
              {key === "icons" && <small>{showcaseStats.icons}</small>}
            </button>
          ))}
          {(["Components", "Scenary"] as const).map((group) => (
            <div className="section-navigation" key={group}>
              <span className="navigation-label secondary-label">{group.toUpperCase()}</span>
              {sections
                .filter((section) => section.group === group)
                .map((section) => {
                  const active = page === "components" && (route.slug ?? sections[0].slug) === section.slug;
                  return (
                    <button
                      aria-current={active ? "page" : undefined}
                      className={active ? "active" : ""}
                      key={section.slug}
                      onClick={() => navigate(`components/${section.slug}`)}
                    >
                      <span>{section.name}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="theme-control">
          <div>
            <span className="navigation-label">THEME COLOR</span>
            <small>{themeMode}</small>
          </div>
          <div className="theme-dots">
            {themeModes.map((mode) => (
              <button
                aria-label={`${mode} theme`}
                className={`${mode.toLocaleLowerCase()} ${
                  themeMode === mode ? "active" : ""
                }`}
                key={mode}
                onClick={() => setThemeMode(mode)}
                title={mode}
              />
            ))}
          </div>
        </div>

      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              aria-label="Open navigation"
              className="mobile-menu-button"
              onClick={() => setMobileNavigationOpen(true)}
            >
              ☰
            </button>
            <div>
              <span>{pages[page].eyebrow}</span>
              <strong>{pages[page].label}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <button
                aria-expanded={searchOpen}
                aria-label="Search the library"
                className="global-search-trigger"
                onClick={() => setSearchOpen(true)}
              >
                <span>⌕</span>
                <span>Search the library</span>
                <kbd>⌘ K</kbd>
              </button>
              {searchOpen && (
                <div className="search-popover">
                  <label>
                    <span>⌕</span>
                    <input
                      autoFocus
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setSearchOpen(false);
                      }}
                      placeholder="Search components, tokens and icons"
                      value={search}
                    />
                    <button
                      aria-label="Close search"
                      onClick={() => setSearchOpen(false)}
                    >
                      ×
                    </button>
                  </label>
                  <div className="search-results">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => navigate(result.page)}
                      >
                        <span className="search-result-glyph">
                          {result.type === "Token" ? "◉" : result.type === "Icon" ? "✦" : "◇"}
                        </span>
                        <span>
                          <strong>{result.title}</strong>
                          <small>{result.detail}</small>
                        </span>
                        <em>{result.type}</em>
                      </button>
                    ))}
                    {search && searchResults.length === 0 && (
                      <p>Nothing matches “{search}”.</p>
                    )}
                    {!search && (
                      <p>Type a component, token or icon name to jump there.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <a
              className="figma-link"
              href="https://www.figma.com/design/oEYHBrbLVcmWpgKAQ7KXcl/followup_%F0%9F%92%8E-Design-Library?node-id=34-1767"
              rel="noreferrer"
              target="_blank"
            >
              Open Figma ↗
            </a>
          </div>
        </header>

        <main className="page-container" id="library-main">
          {page === "overview" && <OverviewPage onNavigate={navigate} />}
          {page === "tokens" && <TokensPage themeMode={themeMode} />}
          {page === "styles" && <StylesPage />}
          {page === "components" && (
            <ComponentsPage itemSlug={route.item} onNavigate={navigate} slug={route.slug} />
          )}
          {page === "icons" && <IconsPage />}
        </main>
      </div>
    </div>
  );
}
