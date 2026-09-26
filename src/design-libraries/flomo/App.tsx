import { useEffect, useMemo, useState, type CSSProperties } from "react";
import catalog from "./catalog.json";
import { FlomoSpecimen, OverlayDemo } from "./components";
import { documentation, specs } from "./specs";

const pages = {
  components: "组件",
  tokens: "设计变量",
  styles: "样式",
  icons: "图标",
  source: "源库目录",
};
type Page = keyof typeof pages;
const figma = (node: string) =>
  `https://www.figma.com/design/Tvq9bNPX2M0SksYFiEvaW7/?node-id=${node.replace(":", "-")}`;
function route() {
  const [page, family] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    page: (page in pages ? page : "components") as Page,
    family: catalog.families.some((f) => f.id === family) ? family : "button",
  };
}
function ComponentPanel({ familyID }: { familyID: string }) {
  const family = catalog.families.find((f) => f.id === familyID)!;
  const spec = specs[familyID];
  const [config, setConfig] = useState(spec?.defaults || {});
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("");
  const definitions = catalog.components.filter(
    (c) => c.sectionID === family.nodeID,
  );
  const notify = (value: string) => setStatus(value);
  return (
    <>
      <header className="fm-page-heading">
        <div>
          <p className="fm-kicker">Components</p>
          <h1>{family.name}</h1>
          <p>{spec?.description || documentation[familyID]}</p>
        </div>
        <a
          className="fm-source-link"
          href={figma(family.nodeID)}
          target="_blank"
          rel="noreferrer"
        >
          Figma ↗
        </a>
      </header>
      {spec ? (
        <>
          <section className="fm-panel">
            <div className="fm-section-title">
              <h2>默认示例</h2>
              <button
                className="fm-text-button"
                onClick={() => {
                  setConfig({ ...spec.defaults });
                  setRevision((n) => n + 1);
                  setStatus("已重置");
                }}
              >
                重置
              </button>
            </div>
            <div className="fm-controls">
              {spec.axes.map((axis) => (
                <label key={axis.name}>
                  <span>{axis.name}</span>
                  <select
                    value={config[axis.name]}
                    onChange={(e) =>
                      setConfig({ ...config, [axis.name]: e.target.value })
                    }
                  >
                    {axis.values.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="fm-stage fm-default-stage">
              <FlomoSpecimen
                key={revision}
                family={familyID}
                config={config}
                notify={notify}
                demo
              />
            </div>
            {spec.note && <p className="fm-note">{spec.note}</p>}
            <p className="fm-status" role="status">
              {status || "可在预览中直接操作。"}
            </p>
          </section>
          <section className="fm-properties">
            <h2>属性对比</h2>
            {spec.axes.map((axis) => (
              <div className="fm-axis" key={axis.name}>
                <h3>{axis.name}</h3>
                <div
                  className="fm-comparison"
                  style={
                    {
                      "--count":
                        axis.values.length === 4
                          ? 2
                          : Math.min(axis.values.length, 3),
                    } as CSSProperties
                  }
                >
                  {axis.values.map((value) => (
                    <div className="fm-comparison-item" key={value}>
                      <code>
                        {axis.name}={value}
                      </code>
                      <div className="fm-stage">
                        <FlomoSpecimen
                          key={revision}
                          family={familyID}
                          config={{ ...config, [axis.name]: value }}
                          notify={notify}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
          {["dialog", "sheet", "menu", "snackbar"].includes(familyID) && (
            <section className="fm-demo">
              <h2>交互演示</h2>
              <OverlayDemo
                key={revision}
                family={familyID}
                config={config}
                notify={notify}
              />
            </section>
          )}
        </>
      ) : (
        <div className="fm-panel fm-documentation">
          <span>文档条目</span>
          <h2>{family.name}</h2>
          <p>{documentation[familyID]}</p>
          <a
            className="fm-source-link"
            href={figma(family.nodeID)}
            target="_blank"
            rel="noreferrer"
          >
            查看源设计 ↗
          </a>
        </div>
      )}
      <details className="fm-definitions">
        <summary>
          源库定义 <span>{definitions.length}</span>
        </summary>
        <p>
          这里保留原设计的平台、变体名称与尺寸；上方按 SwiftUI 组件能力提供 Web
          示例。
        </p>
        <div className="fm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>组件 / 变体</th>
                <th>尺寸</th>
                <th>源节点</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.componentSetName && (
                      <strong>
                        {c.componentSetName}
                        <br />
                      </strong>
                    )}
                    {c.name}
                  </td>
                  <td>
                    {c.width} × {c.height}
                  </td>
                  <td>
                    <a href={figma(c.id)} target="_blank" rel="noreferrer">
                      {c.id} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
function Tokens({ theme }: { theme: string }) {
  const collections = [
    ...new Set(catalog.variables.map((v) => v.collectionName)),
  ];
  const [collection, setCollection] = useState(collections[0]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("");
  const modes = [
    ...new Set(
      catalog.variables
        .filter((v) => v.collectionName === collection)
        .flatMap((v) => v.values.map((value) => value.mode)),
    ),
  ];
  const active = modes.includes(mode)
    ? mode
    : modes.includes(theme)
      ? theme
      : modes[0];
  const variables = catalog.variables.filter(
    (v) =>
      v.collectionName === collection &&
      `${v.name} ${v.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="设计变量"
        kicker="Design Tokens"
        description="完整保留五组源变量及模式、解析值和引用关系。"
      />
      <div className="fm-filter">
        <label>
          集合
          <select
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value);
              setMode("");
            }}
          >
            {collections.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          模式
          <select value={active} onChange={(e) => setMode(e.target.value)}>
            {modes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="fm-search">
          搜索变量
          <input
            type="search"
            placeholder="名称或节点 ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <p className="fm-result-count">{variables.length} 个变量</p>
      <div className="fm-token-grid">
        {variables.map((v) => {
          const value = v.values.find((s) => s.mode === active) || v.values[0];
          return (
            <article className="fm-token" key={v.id}>
              {v.resolvedType === "COLOR" && (
                <div
                  className="fm-swatch"
                  style={{ background: value.value }}
                />
              )}
              <div>
                <strong>{v.name}</strong>
                <code>{value.value}</code>
                {value.alias && <small>↳ {value.alias}</small>}
              </div>
            </article>
          );
        })}
      </div>
      {!variables.length && <EmptyResults />}
    </>
  );
}
function PageHeading({
  title,
  kicker,
  description,
}: {
  title: string;
  kicker: string;
  description: string;
}) {
  return (
    <header className="fm-page-heading">
      <div>
        <p className="fm-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
function EmptyResults() {
  return (
    <p className="fm-no-results" role="status">
      没有匹配项，试试其他关键词。
    </p>
  );
}
function Styles() {
  const [type, setType] = useState("Text");
  const types = ["Text", "Paint", "Effect"];
  const rows = catalog.styles.filter((s) =>
    type === "Text"
      ? "family" in s
      : type === "Paint"
        ? "colors" in s
        : "effects" in s,
  );
  return (
    <>
      <PageHeading
        title="样式"
        kicker="Styles"
        description="18 个文字样式、16 个填充样式与 5 个效果样式。"
      />
      <div className="fm-filter-buttons">
        {types.map((t) => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="fm-style-grid">
        {rows.map((s) => (
          <article className="fm-style-card" key={s.id}>
            <div className="fm-style-sample">
              {s.family && (
                <span
                  style={{
                    fontFamily: `"${s.family}", sans-serif`,
                    fontSize: s.size,
                    lineHeight: `${s.lineHeight}px`,
                    fontWeight: s.fontStyle === "Semibold" ? 600 : 400,
                    letterSpacing:
                      s.letterSpacingUnit === "PERCENT"
                        ? `${s.letterSpacing / 100}em`
                        : `${s.letterSpacing}px`,
                  }}
                >
                  记录想法，持续发生。
                  <br />
                  Capture a thought.
                </span>
              )}
              {s.colors && s.gradientTransform && s.locations && (
                <div
                  className="fm-paint"
                  style={{
                    background: `linear-gradient(${Math.round((Math.atan2(s.gradientTransform[1], s.gradientTransform[0]) * 180) / Math.PI + 90)}deg, ${s.colors
                      .map((color, i) => ({
                        color,
                        position: s.locations?.[i] ?? 0,
                      }))
                      .sort((a, b) => a.position - b.position)
                      .map((stop) => `${stop.color} ${stop.position * 100}%`)
                      .join(", ")})`,
                  }}
                />
              )}
              {s.effects && (
                <div className="fm-effect-sample">
                  {s.effects.some((e) => e.type === "BACKGROUND_BLUR") && (
                    <span className="fm-effect-underlay">Aa</span>
                  )}
                  <span
                    className="fm-effect-surface"
                    style={{
                      boxShadow: s.effects
                        .filter((e) => e.type === "DROP_SHADOW")
                        .map(
                          (e) =>
                            `${e.offsetX}px ${e.offsetY}px ${e.radius}px ${e.spread}px ${e.color}`,
                        )
                        .join(","),
                      backdropFilter: s.effects.some(
                        (e) => e.type === "BACKGROUND_BLUR",
                      )
                        ? `blur(${s.effects[0].radius}px)`
                        : undefined,
                    }}
                  >
                    Text
                  </span>
                </div>
              )}
            </div>
            <h2>{s.name}</h2>
            <small>
              {"size" in s
                ? `${s.size} / ${s.lineHeight} · ${s.fontStyle}`
                : s.colors
                  ? s.colors.join(" → ")
                  : s.effects
                      ?.map((e) => `${e.type} · ${e.radius}px`)
                      .join(" · ")}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}
function Icons() {
  const [query, setQuery] = useState("");
  const records = catalog.components.filter(
    (c) =>
      c.pageID === "119:9158" &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="图标"
        kicker="Icons"
        description="展示仓库附带的原始 SVG；没有附带图形资源的定义保留名称与源节点。"
      />
      <label className="fm-search">
        搜索图标
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="图标名称"
        />
      </label>
      <p className="fm-result-count">
        {records.length} 个定义 · {Object.keys(catalog.icons).length} 个 SVG
        资源
      </p>
      <div className="fm-icon-grid">
        {records.map((c) => {
          const src = (catalog.icons as Record<string, string>)[c.id];
          return (
            <a
              key={c.id}
              href={figma(c.id)}
              target="_blank"
              rel="noreferrer"
              className="fm-icon-card"
            >
              {src ? (
                <img loading="lazy" src={src} width="28" height="28" alt="" />
              ) : (
                <span className="fm-icon-missing">源节点 ↗</span>
              )}
              <strong>{c.name}</strong>
              <small>{c.id}</small>
            </a>
          );
        })}
      </div>
      {!records.length && <EmptyResults />}
    </>
  );
}
function Source() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState("All");
  const records = useMemo(
    () =>
      catalog.components.filter(
        (c) =>
          (page === "All" || c.pageName === page) &&
          `${c.name} ${c.sectionName} ${c.componentSetName} ${c.id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, page],
  );
  return (
    <>
      <PageHeading
        title="源库目录"
        kicker="Source Catalog"
        description="从提供的 SwiftUI 仓库导入的静态快照，保留原始命名与节点关系。"
      />
      <div className="fm-metrics">
        {[
          [catalog.variables.length, "变量"],
          [catalog.styles.length, "样式"],
          [catalog.components.length, "组件定义"],
          [catalog.families.length, "组件分组"],
        ].map(([n, label]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="fm-note">
        Web 展示覆盖 20 组组件，另外 3
        组为源设计文档。源库的跨平台变体作为目录保留，不将每条目录记录视作独立的
        Web 实现。
      </p>
      <div className="fm-filter">
        <label>
          源页面
          <select value={page} onChange={(e) => setPage(e.target.value)}>
            <option>All</option>
            {[...new Set(catalog.components.map((c) => c.pageName))].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
        </label>
        <label className="fm-search">
          搜索定义
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名称、分组或节点 ID"
          />
        </label>
      </div>
      <p className="fm-result-count">{records.length} 条定义</p>
      <div className="fm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>组件 / 变体</th>
              <th>来源</th>
              <th>源节点</th>
            </tr>
          </thead>
          <tbody>
            {records.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.componentSetName || c.name}</strong>
                  {c.componentSetName && (
                    <>
                      <br />
                      {c.name}
                    </>
                  )}
                </td>
                <td>{c.sectionName || c.pageName}</td>
                <td>
                  <a href={figma(c.id)} target="_blank" rel="noreferrer">
                    {c.id} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!records.length && <EmptyResults />}
    </>
  );
}
export default function App() {
  const [current, setCurrent] = useState(route);
  const [theme, setTheme] = useState("Light");
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const change = () => {
      setCurrent(route());
      setMenu(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.flomoTheme = theme;
  }, [theme]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu) {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".fm-mobile-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menu]);
  const navigate = (page: Page, family = current.family) => {
    location.hash = `#/${page}/${family}`;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <div className="fm-shell">
      <header className="fm-topbar">
        <a href="/design/more/">← 更多组件库</a>
        <div>
          <span className="fm-topbar-name">flomo / {pages[current.page]}</span>
          <label className="fm-theme-control">
            <span className="sr-only">外观</span>
            <select
              aria-label="外观"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {["Light", "Dark", "Dark Elevated"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            className="fm-mobile-toggle"
            aria-label={menu ? "关闭导航" : "打开导航"}
            aria-expanded={menu}
            aria-controls="flomo-sidebar"
            onClick={() => setMenu(!menu)}
          >
            {menu ? "×" : "☰"}
          </button>
        </div>
      </header>
      <aside className="fm-sidebar" id="flomo-sidebar" data-open={menu}>
        <a href="#/components/button" className="fm-brand">
          <span>
            flomo<span className="fm-brand-dot">.</span>
          </span>
          <small>Design Library</small>
        </a>
        <nav aria-label="组件库导航">
          {Object.entries(pages).map(([id, label]) => (
            <button
              key={id}
              aria-current={current.page === id ? "page" : undefined}
              onClick={() => navigate(id as Page)}
            >
              <span>{label}</span>
              <small>
                {id === "components"
                  ? "23"
                  : id === "tokens"
                    ? "667"
                    : id === "styles"
                      ? "39"
                      : id === "icons"
                        ? "42 SVG"
                        : "381"}
              </small>
            </button>
          ))}
        </nav>
        {current.page === "components" && (
          <>
            <label className="fm-family-filter">
              <span className="sr-only">筛选组件</span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="筛选组件…"
              />
            </label>
            <nav className="fm-family-nav" aria-label="组件分组">
              {catalog.families
                .filter((f) =>
                  f.name.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((f) => (
                  <button
                    key={f.id}
                    aria-current={f.id === current.family ? "page" : undefined}
                    onClick={() => navigate("components", f.id)}
                  >
                    <span>{f.name}</span>
                    {documentation[f.id] && <small>文档</small>}
                  </button>
                ))}
            </nav>
          </>
        )}
        <p className="fm-sidebar-note">
          SwiftUI → Web
          <br />
          源库的细节，浏览器里的交互。
        </p>
      </aside>
      {menu && (
        <button
          className="fm-scrim"
          aria-label="关闭导航遮罩"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="fm-main" id="main-content">
        {current.page === "components" ? (
          <ComponentPanel key={current.family} familyID={current.family} />
        ) : current.page === "tokens" ? (
          <Tokens theme={theme} />
        ) : current.page === "styles" ? (
          <Styles />
        ) : current.page === "icons" ? (
          <Icons />
        ) : (
          <Source />
        )}
        <footer className="fm-footer">
          <span>flomo · Web component library</span>
          <a href="/design/more/">浏览更多组件库 ↗</a>
        </footer>
      </main>
    </div>
  );
}
