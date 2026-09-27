import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import "./navigation.css";

type Notify = (message: string) => void;
const icon = (name: string) => `/design-libraries/flomo/icons/${name}.svg`;
/** Boolean component properties (not variant axes): Figma default when the prop is absent. */
const flag = (value: string | undefined, fallback = true) => (value === undefined ? fallback : value === "True");

function Chevron() {
  return <Icon src={icon("chevron-down")} className="fm-navigation-chevron" />;
}

function Separator() {
  return <Icon src={icon("breadcrumb-separator")} className="fm-navigation-separator" size={8} style={{ height: 36 }} />;
}

/** Breadcrumb 304:65246 (Count; Show Home boolean). */
function Breadcrumb({ count, home = true, notify }: { count: string; home?: boolean; notify: Notify }) {
  const showHome = home && count !== "Limit Space";
  return (
    <nav className="fm-navigation-breadcrumb" aria-label="层级">
      {showHome && (
        <>
          <button type="button" className="fm-navigation-home fm-press" aria-label="首页" onClick={() => notify("点击了首页")}>
            <Icon src={icon("house")} />
          </button>
          <Separator />
        </>
      )}
      {(count === ">2" || count === "Limit Space") && (
        <>
          <button type="button" className="fm-navigation-level fm-press" aria-label="更多层级" onClick={() => notify("点击了折叠的层级")}>
            ...
          </button>
          <Separator />
        </>
      )}
      {count === "2" && (
        <>
          <button type="button" className="fm-navigation-level fm-press" onClick={() => notify("点击了「Level 1」")}>
            Level 1
          </button>
          <Separator />
        </>
      )}
      <button type="button" className="fm-navigation-expand fm-press" aria-current="page" onClick={() => notify("点击了当前层级「Title」")}>
        <span>Title</span>
        <Chevron />
      </button>
    </nav>
  );
}

/** NavigationBar-Buttons 24:9445 */
function NavButtons({ count, notify }: { count: string; notify: Notify }) {
  const labels = count === "3" ? ["Button 3", "Button 2", "Button 1"] : count === "2" ? ["Button 2", "Button 1"] : ["Button 1"];
  return (
    <div className="fm-navigation-buttons">
      {labels.map((label) => (
        <button key={label} type="button" className="fm-navigation-text-btn fm-press" onClick={() => notify(`点击了「${label}」`)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Search({ notify }: { notify: Notify }) {
  return (
    <div className="fm-navigation-search">
      <label className="fm-navigation-search-content">
        <Icon src={icon("magnifyingglass")} />
        <span className="sr-only">搜索</span>
        <input className="fm-navigation-search-input" type="search" placeholder="⌘+K" />
      </label>
      <button type="button" className="fm-navigation-filter fm-press" aria-label="筛选" onClick={() => notify("点击了筛选")}>
        <Icon src={icon("line-3-vertical-decrease")} />
      </button>
    </div>
  );
}

/** NavigationBar 24:9641 (Layout × Type × Trailing; Show Leading / Show Expand booleans). */
function NavigationBar({
  layout,
  type,
  trailing,
  leading,
  expand,
  notify,
}: {
  layout: string;
  type: string;
  trailing: string;
  leading: boolean;
  expand: boolean;
  notify: Notify;
}) {
  const left = layout === "Align Left";
  const logo = <Icon src={icon("logo-text")} className="fm-navigation-logo" size={48} style={{ height: 16 }} />;
  // Title Part: centred absolutely (Center) or inline after the Leading button (Align Left).
  let title = null;
  if (type === "Logo" || type === "Text")
    title = (
      <button
        type="button"
        className="fm-navigation-title fm-press"
        data-type={type}
        data-layout={left ? "left" : "center"}
        aria-label={type === "Logo" ? "flomo" : undefined}
        onClick={() => notify(expand ? "点击了标题，展开切换菜单" : "点击了标题")}
      >
        {type === "Logo" ? logo : <span className="fm-navigation-title-text">Title</span>}
        {expand && (left ? <Chevron /> : <span className="fm-navigation-expand-icon"><Chevron /></span>)}
      </button>
    );
  else if (type === "Text+Description")
    title = (
      <div className="fm-navigation-title" data-type={type} data-layout="center">
        <span className="fm-navigation-title-text">Title</span>
        <span className="fm-navigation-description">Description</span>
      </div>
    );
  else if (type === "Breadcrumb") title = <Breadcrumb count="1" notify={notify} />;

  return (
    <header
      className="fm-navigation"
      data-layout={left ? "left" : "center"}
      data-trailing={trailing.toLowerCase()}
      data-type={type}
    >
      <div className="fm-navigation-leading">
        {leading && (
          <button type="button" className="fm-navigation-icon-btn fm-press" aria-label="Leading 按钮" onClick={() => notify("点击了 Leading 按钮")}>
            <Icon src={icon("dash-rectangle-16")} />
          </button>
        )}
        {left && title}
      </div>
      {trailing === "Buttons" && <NavButtons count="1" notify={notify} />}
      {trailing === "Search" && (
        <div className="fm-navigation-trailing-search">
          <Search notify={notify} />
        </div>
      )}
      {!left && title && <div className="fm-navigation-center">{title}</div>}
    </header>
  );
}

const module: FamilyModule = {
  description:
    "导航栏位于页面顶部，承载返回或菜单入口、页面标题与层级、以及页面级操作；标题可居中或左对齐，右侧可放文字按钮或搜索框。",
  // Show Leading / Show Expand / Show Home are Figma boolean properties, not variant names.
  defaults: {
    "24:9641": { Layout: "Center", Type: "No Title", Trailing: "None", "Show Leading": "True", "Show Expand": "True" },
    "304:65246": { Count: "1", "Show Home": "True" },
  },
  requires: {
    "24:9641": {
      "Show Expand": { when: (p) => p.Type === "Logo" || p.Type === "Text", hint: "仅在 Type=Logo 或 Type=Text 时生效。" },
    },
  },
  axes: {
    "24:9641": [
      { name: "Layout", values: ["Center", "Align Left"] },
      { name: "Type", values: ["No Title", "Logo", "Text", "Text+Description", "Breadcrumb"] },
      { name: "Trailing", values: ["None", "Buttons", "Search"] },
      { name: "Show Leading", values: ["False", "True"] },
      { name: "Show Expand", values: ["False", "True"] },
    ],
    "304:65246": [
      { name: "Count", values: ["1", "2", ">2", "Limit Space"] },
      { name: "Show Home", values: ["False", "True"] },
    ],
  },
  renderers: {
    "24:9641": ({ props, notify }) => (
      <NavigationBar
        layout={props.Layout}
        type={props.Type}
        trailing={props.Trailing}
        leading={flag(props["Show Leading"])}
        expand={flag(props["Show Expand"])}
        notify={notify}
      />
    ),
    "24:9445": ({ props, notify }) => <NavButtons count={props.Count ?? "1"} notify={notify} />,
    "304:65246": ({ props, notify }) => (
      <Breadcrumb count={props.Count ?? "1"} home={flag(props["Show Home"])} notify={notify} />
    ),
  },
};
export default module;
