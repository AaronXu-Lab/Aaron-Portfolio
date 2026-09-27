import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import { Chip, ICONS, Switch } from "./list";
import "./menu.css";

const icon = (name: string) => `/design-libraries/flomo/icons/${name}`;

type ItemOptions = {
  type?: string;
  trailing?: string;
  text?: string;
  description?: string;
  tone?: "destructive";
  checked?: boolean;
  role?: "menuitem" | "menuitemcheckbox";
  interactive?: boolean;
  onSelect?: () => void;
};

/** Menu Item 279:22101 (Type × Trailing); `tone` / `checked` follow the Status examples in the section. */
function MenuItem({ type = "Text", trailing = "None", text = "Text", description, tone, checked, role, interactive, onSelect }: ItemOptions) {
  const [on, setOn] = useState(true);
  const isSwitch = trailing === "Switch";
  const content = (
    <>
      <span className="fm-menu-content">
        {type === "Icon+Text" && <Icon src={ICONS.placeholder} className="fm-menu-lead" />}
        {type === "Emoji+Text" && (
          <span className="fm-menu-emoji" aria-hidden="true">
            😃
          </span>
        )}
        <span className="fm-menu-texts">
          <span className="fm-menu-text">{text}</span>
          {description && <span className="fm-menu-desc">{description}</span>}
        </span>
      </span>
      {trailing === "Icon" && <Icon src={checked ? icon("checkmark.svg") : ICONS.chevronRight} className="fm-menu-trail" />}
      {trailing === "Detail" && <span className="fm-menu-detail">Detail</span>}
      {trailing === "Badge" && <span className="fm-menu-badge">42</span>}
      {trailing === "Chip" && <Chip type="Pro" />}
      {isSwitch && (
        <span className="fm-menu-switch">
          <Switch checked={on} />
        </span>
      )}
    </>
  );
  const attrs = { "data-trailing": trailing, "data-tone": tone, "data-checked": checked };
  if (!interactive)
    return (
      <div className="fm-menu-item" {...attrs}>
        {content}
      </div>
    );
  return (
    <button
      type="button"
      role={role}
      aria-checked={role && isSwitch ? on : undefined}
      aria-pressed={!role && isSwitch ? on : undefined}
      tabIndex={role ? -1 : undefined}
      className="fm-menu-item fm-press"
      {...attrs}
      onClick={() => {
        if (isSwitch) setOn(!on);
        onSelect?.();
      }}
    >
      {content}
    </button>
  );
}

function TopAction({ type = "Icon+Text", src = ICONS.placeholder, text = "Text", role, interactive, onSelect }: {
  type?: string;
  src?: string;
  text?: string;
  role?: "menuitem";
  interactive?: boolean;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      <Icon src={src} size={type === "Icon" ? 20 : 16} />
      {type !== "Icon" && <span className="fm-menu-topaction-text">{text}</span>}
    </>
  );
  return interactive ? (
    <button
      type="button"
      role={role}
      tabIndex={role ? -1 : undefined}
      aria-label={type === "Icon" ? text : undefined}
      className="fm-menu-topaction fm-press"
      data-type={type}
      onClick={onSelect}
    >
      {inner}
    </button>
  ) : (
    <span className="fm-menu-topaction" data-type={type}>
      {inner}
    </span>
  );
}

const Divider = () => <div className="fm-menu-divider" role="separator" />;

/* Figma "Example" menu (803:47707): top actions, note actions, footnote. */
const TOP = [
  ["分享", icon("square-and-arrow-up.svg")],
  ["编辑", icon("pencil-line.svg")],
  ["复制", icon("square-on-square.svg")],
];
const ACTIONS = ["置顶", "加入浮窗", "发现相关笔记", "查看详情", "显示历史版本", "引用", "修改日期", "删除"];

function MenuDemo({ notify }: { notify: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const select = (label: string) => {
    notify(`已选择「${label}」`);
    close();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next !== undefined) {
      e.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };
  return (
    <div className="fm-menu-demo">
      <button
        ref={trigger}
        type="button"
        className="fm-menu-trigger fm-press"
        aria-label="更多操作"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="fm-menu-demo-popover"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon src={ICONS.ellipsis} />
      </button>
      <div
        ref={menu}
        id="fm-menu-demo-popover"
        className="fm-menu fm-menu-popover"
        role="menu"
        aria-label="笔记操作"
        data-open={open}
        onKeyDown={onKeyDown}
      >
        <div className="fm-menu-group fm-menu-toprow" role="group" aria-label="常用操作">
          {TOP.map(([label, src]) => (
            <TopAction key={label} src={src} text={label} role="menuitem" interactive onSelect={() => select(label)} />
          ))}
        </div>
        <Divider />
        <div className="fm-menu-group" role="group">
          {ACTIONS.map((label) => (
            <MenuItem
              key={label}
              text={label}
              tone={label === "删除" ? "destructive" : undefined}
              role="menuitem"
              interactive
              onSelect={() => select(label)}
            />
          ))}
        </div>
        <Divider />
        <div className="fm-menu-group">
          <div className="fm-menu-footnote">
            <span>字数统计：123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const module: FamilyModule = {
  description: "菜单承载一组临时操作：点击控件弹出，支持分组、顶部大按钮与尾部附属信息。",
  axes: {
    "279:22101": [
      { name: "Type", values: ["Text", "Icon+Text", "Emoji+Text"] },
      { name: "Trailing", values: ["None", "Detail", "Icon", "Badge", "Chip", "Switch"] },
      // Figma boolean property, not a variant name.
      { name: "Show Description", values: ["False", "True"] },
    ],
  },
  defaults: { "279:22101": { Type: "Text", Trailing: "None", "Show Description": "False" } },
  renderers: {
    "279:22101": ({ props, interactive, notify }) => (
      <MenuItem
        type={props.Type}
        trailing={props.Trailing}
        description={props["Show Description"] === "True" ? "Description" : undefined}
        interactive={interactive}
        onSelect={() => notify(props.Trailing === "Switch" ? "已切换开关" : "点击了菜单项")}
      />
    ),
    "279:22854": () => <Divider />,
    "6896:20921": ({ props, interactive, notify }) => (
      <TopAction type={props.Type} interactive={interactive} onSelect={() => notify("点击了「Text」")} />
    ),
  },
  demo: (notify) => <MenuDemo notify={notify} />,
};

export default module;
