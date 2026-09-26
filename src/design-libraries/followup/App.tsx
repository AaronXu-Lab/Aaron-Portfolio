import { useEffect, useMemo, useState } from "react";
import {
  componentSets,
  cssVariableName,
  resolveVariableValue,
  valueToCss,
  variables,
} from "./data/catalog";
import { AuditPage } from "./pages/AuditPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { StylesPage } from "./pages/StylesPage";
import { TokensPage } from "./pages/TokensPage";

type PageName = "overview" | "tokens" | "styles" | "components" | "audit";

const pages: Record<
  PageName,
  { label: string; eyebrow: string; glyph: string }
> = {
  overview: { label: "Overview", eyebrow: "LIBRARY HOME", glyph: "⌂" },
  tokens: { label: "Design Tokens", eyebrow: "VARIABLES", glyph: "◉" },
  styles: { label: "Styles", eyebrow: "PUBLISHED STYLES", glyph: "Aa" },
  components: { label: "Components", eyebrow: "LOCAL COMPONENTS", glyph: "◇" },
  audit: { label: "Source Audit", eyebrow: "MIGRATION STATUS", glyph: "✓" },
};

const themeModes = ["Default", "Blue", "Green", "Orange"];

function pageFromHash(): PageName {
  const hash = window.location.hash.replace(/^#\/?/, "") as PageName;
  return hash in pages ? hash : "overview";
}

export default function App() {
  const [page, setPage] = useState<PageName>(pageFromHash);
  const [themeMode, setThemeMode] = useState("Default");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
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
        page: "tokens" as PageName,
      }));
    const componentResults = componentSets
      .filter((item) => item.name.toLocaleLowerCase().includes(query))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        type: "Component Set",
        title: item.name,
        detail: `${item.variantCount} variants · ${item.pageName}`,
        page: "components" as PageName,
      }));
    return [...tokenResults, ...componentResults].slice(0, 8);
  }, [search]);

  function navigate(target: string) {
    const next = target as PageName;
    window.location.hash = `#/${next}`;
    setPage(next);
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
          {(Object.entries(pages) as Array<[PageName, (typeof pages)[PageName]]>)
            .slice(0, 4)
            .map(([key, item]) => (
              <button
                aria-current={page === key ? "page" : undefined}
                className={page === key ? "active" : ""}
                key={key}
                onClick={() => navigate(key)}
              >
                <span className="nav-glyph">{item.glyph}</span>
                <span>{item.label}</span>
                {key === "components" && <small>1,237</small>}
              </button>
            ))}

          <span className="navigation-label secondary-label">QUALITY</span>
          <button
            aria-current={page === "audit" ? "page" : undefined}
            className={page === "audit" ? "active" : ""}
            onClick={() => navigate("audit")}
          >
            <span className="nav-glyph">{pages.audit.glyph}</span>
            <span>{pages.audit.label}</span>
            <small className="nav-pass">18/18</small>
          </button>
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

        <footer className="sidebar-footer">
          <span className="sync-icon">✓</span>
          <div>
            <strong>Figma source snapshot</strong>
            <small>oEYH…KXcl · 34:1767</small>
          </div>
        </footer>
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
                aria-label="Search source catalog"
                className="global-search-trigger"
                onClick={() => setSearchOpen(true)}
              >
                <span>⌕</span>
                <span>Search source catalog</span>
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
                      placeholder="Search Variables and Component Sets"
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
                          {result.type === "Token" ? "◉" : "◇"}
                        </span>
                        <span>
                          <strong>{result.title}</strong>
                          <small>{result.detail}</small>
                        </span>
                        <em>{result.type}</em>
                      </button>
                    ))}
                    {search && searchResults.length === 0 && (
                      <p>No source records match “{search}”.</p>
                    )}
                    {!search && (
                      <p>Type a token or Component Set name to jump there.</p>
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
          {page === "components" && <ComponentsPage />}
          {page === "audit" && <AuditPage />}
        </main>
      </div>
    </div>
  );
}
