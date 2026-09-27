import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type RefObject,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { RendererMap, SpecimenProps } from "./registry";
import { Icon, on } from "./shared";
import "./advanced-a.css";

// Advance Component (part A): Name Card, Container Selector, Uploader/Image, Header Bar, Page Title,
// Timer, Tool Tips, Panel, Top bars, No Content. Raster assets are Figma exports in /assets.
const asset = (file: string) => `/design-libraries/followup/assets/${file}`;

type Kind = "filled" | "outline" | "plain";

function Btn({
  kind,
  className = "",
  children,
  ...rest
}: { kind: Kind; className?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`fu-adva-btn fu-adva-btn--${kind} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Figma's "Button" Small Text (Filled / Outline): 28px high, min 64px wide. */
function TextBtn({ kind, children }: { kind: "filled" | "outline"; children: string }) {
  return (
    <Btn kind={kind} className="fu-adva-btn--text">
      <span className={kind === "filled" ? "fu-adva-desc-em" : "fu-adva-desc"}>{children}</span>
    </Btn>
  );
}

function IconBtn({ icon, variant, size, label, className = "", ...rest }: {
  icon: string;
  variant?: string;
  size: 16 | 20;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Btn kind="plain" className={`fu-adva-btn--i${size} ${className}`} aria-label={label} {...rest}>
      <Icon name={icon} variant={variant} size={size} />
    </Btn>
  );
}

const VDivider = () => <span aria-hidden="true" className="fu-adva-vdiv" />;

/** Figma dashed stroke (inside), drawn as SVG so the dash pattern and sub-pixel width match. */
const Dash = ({ className }: { className: string }) => (
  <svg aria-hidden="true" className={`fu-adva-dash ${className}`}>
    <rect />
  </svg>
);

/** Closes a popover on outside pointer-down or Escape. */
function useDismiss(open: boolean, setOpen: (open: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, setOpen]);
  return ref;
}

/**
 * Library Menu look: popover card, 4px padding, 2px gap, menu items with a checkmark tail.
 * Rendered in the top layer (popover) and anchored to `anchor`, so the playground stage never clips it.
 */
function Menu({
  items,
  value,
  onPick,
  anchor,
}: {
  items: string[];
  value: string;
  onPick: (item: string) => void;
  anchor: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const name = `--fu-adva-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  useEffect(() => {
    const menu = ref.current;
    const host = anchor.current;
    if (!menu || !host) return;
    const box = host.getBoundingClientRect();
    host.style.setProperty("anchor-name", name);
    menu.style.setProperty("position-anchor", name);
    menu.style.setProperty("--fu-adva-x", `${box.left}px`);
    menu.style.setProperty("--fu-adva-y", `${box.bottom + 4}px`);
    menu.showPopover();
    menu.querySelector<HTMLButtonElement>('[aria-checked="true"], button')?.focus();
    return () => {
      host.style.removeProperty("anchor-name");
    };
  }, [anchor, name]);
  return (
    <div className="fu-adva-menu" popover="manual" ref={ref} role="menu">
      {items.map((item) => (
        <button
          aria-checked={item === value}
          className="fu-adva-menu-item"
          key={item}
          onClick={() => onPick(item)}
          role="menuitemradio"
          type="button"
        >
          <span className="fu-adva-multi fu-adva-menu-text">{item}</span>
          {item === value && (
            <span className="fu-adva-menu-tail">
              <Icon name="checkmark" variant="16" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Copy reused from the Container Selector's space list.
const spaces = [
  "Demo Only",
  "Design",
  "Product Development",
  "Workspace For UX Test",
  "Development Team",
  "Test Cases",
  "Operation Service",
  "Strategy Planning",
];

/* ─── Name Card ─── */

function NameCard({ props }: SpecimenProps) {
  const status = props.Status ?? "Online";
  const off = status === "Deactive";
  return (
    <div className={`fu-adva-namecard${off ? " is-off" : ""}`}>
      <div className="fu-adva-namecard-info">
        <img alt="" className="fu-adva-namecard-avatar" src={asset("name-card-avatar.png")} />
        <div className="fu-adva-namecard-texts">
          <div className="fu-adva-namecard-line">
            <span className="fu-adva-inter fu-adva-namecard-name">Display Name</span>
            {off ? (
              <span role="img" aria-label="Deactivated" className="fu-adva-namecard-null">
                <Icon name="null" size={16} />
              </span>
            ) : (
              <span role="img" aria-label={status} className={`fu-adva-dot fu-adva-dot--${status.toLowerCase()}`} />
            )}
          </div>
          <span className="fu-adva-desc fu-adva-namecard-mail">example@mail.com</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel (also the shell of Container Selector) ─── */

function PanelBox({
  title,
  showTitle = true,
  showButtons = true,
  showAssist = false,
  area,
  className = "",
}: {
  title: string;
  showTitle?: boolean;
  showButtons?: boolean;
  showAssist?: boolean;
  area?: boolean;
  className?: string;
}) {
  return (
    <div className={`fu-adva-panel ${className}`}>
      <div className={`fu-adva-panel-main${showButtons ? "" : " fu-adva-panel-main--end"}`}>
        {showTitle && <span className="fu-adva-group fu-adva-panel-title">{title}</span>}
        {area && (
          <div className="fu-adva-panel-area">
            <Dash className="fu-adva-dash--area" />
            <span className="fu-adva-inter">Content Area</span>
          </div>
        )}
      </div>
      {showButtons && (
        <div className="fu-adva-panel-foot">
          <div className="fu-adva-panel-assist">
            {showAssist && (
              <Btn kind="plain">
                <Icon name="trash" variant="16" />
                <span className="fu-adva-desc">Clear all</span>
              </Btn>
            )}
          </div>
          <div className="fu-adva-panel-btns">
            <TextBtn kind="outline">Third</TextBtn>
            <TextBtn kind="outline">Secondary</TextBtn>
            <TextBtn kind="filled">Primary</TextBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ props }: SpecimenProps) {
  return (
    <PanelBox
      area={on(props["Show Content Area"])}
      showAssist={on(props["Show Assist Button"])}
      showButtons={on(props["Show Buttons"])}
      showTitle={on(props["Show Title"])}
      title="Panel Title"
    />
  );
}

/* ─── Container Selector ─── */

type Row = { icon: string; label: string; depth?: number };

const spaceRows: Row[] = spaces.map((label) => ({ icon: "space", label }));
const folderRows: Row[] = [
  { icon: "folder.collapse", label: "Folder" },
  { icon: "folder.collapse", label: "Subfolder", depth: 1 },
  { icon: "folder.collapse", label: "Collapse Folder" },
];
const boardRows: Row[] = [
  { icon: "board", label: "Let’s started here" },
  { icon: "folder.expand", label: "Folder" },
  { icon: "board", label: "Board 1", depth: 1 },
  { icon: "folder.expand", label: "Subfolder", depth: 1 },
  { icon: "board", label: "Board 3", depth: 2 },
  { icon: "board", label: "Board 2" },
  { icon: "folder.collapse", label: "Collapse Folder" },
];
const columns = ["Item", "Due date", "Assignee", "Status", "Time tracking"];
const items = [
  "Project Proposal Draft",
  "Marketing Campaign Plan",
  "Website Redesign Mockup",
  "Q4 Financial Report",
  "Product Launch Event",
  "Customer Feedback Analysis",
  "App Feature Update Documentation",
  "Team Building Workshop Planning",
];

/** Left Panel Item rows; the selected row carries the bold checkmark tail. */
function RowList({
  rows,
  initial,
  interactive,
  className,
}: {
  rows: Row[];
  initial: number;
  interactive: boolean;
  className: string;
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <div className={`fu-adva-cs-list ${className}`} role={interactive ? "listbox" : undefined}>
      {rows.map((row, index) => {
        const active = index === selected;
        const content = (
          <>
            <Icon name={row.icon} variant="20" size={20} />
            <span className="fu-adva-cs-rowtext">
              <span className="fu-adva-body fu-adva-cs-label">{row.label}</span>
              {active && <Icon name="checkmark.bold" size={16} />}
            </span>
          </>
        );
        const className = `fu-adva-cs-row${active ? " is-selected" : ""}`;
        const style = { marginLeft: (row.depth ?? 0) * 24 };
        return interactive ? (
          <button
            aria-selected={active}
            className={className}
            key={row.label + index}
            onClick={() => setSelected(index)}
            role="option"
            style={style}
            type="button"
          >
            {content}
          </button>
        ) : (
          <div className={className} key={row.label + index} style={style}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function SpaceDropdown({ interactive }: { interactive: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("Space 1 / App 1");
  const ref = useDismiss(open, setOpen);
  return (
    <div className="fu-adva-anchor fu-adva-cs-field" ref={ref}>
      <button
        aria-expanded={interactive ? open : undefined}
        aria-haspopup="menu"
        className={`fu-adva-cs-dropdown${open ? " is-open" : ""}`}
        onClick={() => interactive && setOpen(!open)}
        type="button"
      >
        <Icon name="space" variant="16" />
        <span className="fu-adva-body fu-adva-cs-value">{value}</span>
        <Icon name="chevron.down" variant="large" />
      </button>
      {open && (
        <Menu
          anchor={ref}
          items={spaces}
          onPick={(item) => {
            setValue(item);
            setOpen(false);
          }}
          value={value}
        />
      )}
    </div>
  );
}

function FilterInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="fu-adva-cs-input">
      <span className="fu-adva-sr">{placeholder}</span>
      <input
        className="fu-adva-body"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </label>
  );
}

function ColumnPanel({ interactive }: { interactive: boolean }) {
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const shown = columns.filter((column) => column.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="fu-adva-cs-col">
      <FilterInput onChange={setQuery} placeholder="Filter Columns" value={query} />
      <div className="fu-adva-cs-divwrap">
        <span className="fu-adva-hdiv" />
        <div className="fu-adva-cs-menu">
          {shown.map((column) => {
            const isChecked = checked.includes(column);
            return (
              <label className="fu-adva-cs-menurow" key={column}>
                <input
                  checked={isChecked}
                  className="fu-adva-check"
                  disabled={!interactive}
                  onChange={() =>
                    setChecked(isChecked ? checked.filter((c) => c !== column) : [...checked, column])
                  }
                  type="checkbox"
                />
                <span className="fu-adva-check-box" aria-hidden="true">
                  {isChecked && <Icon name="checkbox.checkmark" size={16} />}
                </span>
                <span className="fu-adva-cs-menutext">
                  <span className="fu-adva-multi">{column}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ItemPanel({ interactive }: { interactive: boolean }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(items[0]);
  const shown = items.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="fu-adva-cs-col">
      <FilterInput onChange={setQuery} placeholder="Filter Items" value={query} />
      <div className="fu-adva-cs-divwrap">
        <span className="fu-adva-hdiv" />
        <div className="fu-adva-cs-menu" role="listbox">
          {shown.map((item) => (
            <button
              aria-selected={item === selected}
              className="fu-adva-cs-menurow"
              disabled={!interactive}
              key={item}
              onClick={() => setSelected(item)}
              role="option"
              type="button"
            >
              <Icon name="line.3.vertical" variant="16" />
              <span className="fu-adva-cs-menutext fu-adva-cs-menutext--single">
                <span className="fu-adva-body">{item}</span>
              </span>
              {item === selected && (
                <span className="fu-adva-cs-tail">
                  <span>
                    <Icon name="checkmark" variant="16" />
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContainerSelector({ props, interactive }: SpecimenProps) {
  const type = props.Type ?? "Space";
  const split = type === "Board+Column" || type === "Board+Item";
  const title = {
    Space: "Select space",
    "Folder or App": "Select location",
    Board: "Select board",
    "Board+Column": "Select column",
    "Board+Item": "Select item",
  }[type];
  let content: ReactNode;
  if (split) {
    content = (
      <>
        <div className="fu-adva-cs-col">
          <SpaceDropdown interactive={interactive} />
          <div className="fu-adva-cs-divwrap">
            <span className="fu-adva-hdiv" />
            <RowList className="fu-adva-cs-list--fill" initial={0} interactive={interactive} rows={boardRows} />
          </div>
        </div>
        <span aria-hidden="true" className="fu-adva-cs-vline" />
        {type === "Board+Column" ? <ColumnPanel interactive={interactive} /> : <ItemPanel interactive={interactive} />}
      </>
    );
  } else {
    const list =
      type === "Space" ? (
        <RowList className="fu-adva-cs-list--space" initial={2} interactive={interactive} rows={spaceRows} />
      ) : type === "Board" ? (
        <RowList className="fu-adva-cs-list--fill" initial={-1} interactive={interactive} rows={boardRows} />
      ) : (
        <RowList className="fu-adva-cs-list--fixed" initial={-1} interactive={interactive} rows={folderRows} />
      );
    content = (
      <>
        {type !== "Space" && <SpaceDropdown interactive={interactive} />}
        <div className="fu-adva-cs-divwrap">
          <span className="fu-adva-hdiv" />
          {list}
        </div>
      </>
    );
  }
  return (
    <div className={`fu-adva-cs${split ? " fu-adva-cs--wide" : ""}`} key={type}>
      <PanelBox className="fu-adva-cs-panel" title={title ?? ""} />
      <div className={`fu-adva-cs-content${split ? " fu-adva-cs-content--split" : type === "Space" ? " fu-adva-cs-content--space" : ""}`}>
        {content}
      </div>
    </div>
  );
}

/* ─── Uploader/Image ─── */

function Uploader({ props, interactive }: SpecimenProps) {
  const type = props.Type ?? "Description";
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked);
  }, [picked]);
  const image = picked ?? (on(props["Show Background"]) ? asset("uploader-image.png") : null);
  const large = type === "Title+Description";
  const inner = (
    <>
      {!image && <Dash className="fu-adva-dash--up" />}
      {image && (
        <>
          <img alt="" className="fu-adva-up-image" src={image} />
          <span className="fu-adva-up-mask" />
        </>
      )}
      <span className={`fu-adva-up-content${large ? " fu-adva-up-content--lg" : ""}`}>
        {type === "Icon+Description" && <Icon name="picture" size={16} />}
        {large && <span className="fu-adva-group fu-adva-up-title">Title</span>}
        <span className="fu-adva-desc">Description</span>
      </span>
    </>
  );
  const className = `fu-adva-up${large ? " fu-adva-up--lg" : ""}${image ? " has-image" : ""}`;
  if (!interactive) return <div className={className}>{inner}</div>;
  return (
    <label className={className}>
      <input
        accept="image/*"
        aria-label="Upload image"
        className="fu-adva-up-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setPicked(URL.createObjectURL(file));
        }}
        type="file"
      />
      {inner}
    </label>
  );
}

/* ─── Header Bar ─── */

function HeaderBar({ props, interactive }: SpecimenProps) {
  const type = props.Type ?? "Dropdown only";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Title");
  const ref = useDismiss(open, setOpen);
  if (type === "Back") {
    return (
      <div className="fu-adva-hb">
        <Btn kind="plain" className="fu-adva-btn--p8 fu-adva-hb-back">
          <Icon name="chevron.left" variant="medium" />
          <span className="fu-adva-body">Button Text</span>
        </Btn>
      </div>
    );
  }
  const dropdownOnly = type === "Dropdown only";
  const toggle = () => interactive && setOpen(!open);
  const menuProps = { "aria-expanded": interactive ? open : undefined, "aria-haspopup": "menu" as const, onClick: toggle };
  const titleInner = (
    <>
      <span className="fu-adva-hb-pic">
        <img alt="" src={asset("header-bar-pic.png")} />
        {on(props["Show badge"]) && <span className="fu-adva-hb-badge" role="img" aria-label="Updates" />}
      </span>
      <span className="fu-adva-body fu-adva-hb-title">{title}</span>
      {dropdownOnly && <Icon name="chevron.down" variant="large" />}
    </>
  );
  return (
    <div className="fu-adva-hb fu-adva-hb--row">
      <div className="fu-adva-anchor fu-adva-hb-leading" ref={ref}>
        {dropdownOnly ? (
          <Btn kind="plain" className={`fu-adva-btn--p8 fu-adva-hb-name${open ? " is-open" : ""}`} {...menuProps}>
            {titleInner}
          </Btn>
        ) : (
          <>
            <Btn kind="plain" className="fu-adva-btn--p8 fu-adva-hb-name">
              {titleInner}
            </Btn>
            <VDivider />
            <IconBtn icon="chevron.down" variant="large" label="Switch" size={16} className={open ? "is-open" : ""} {...menuProps} />
          </>
        )}
        {open && (
          <Menu
            anchor={ref}
            items={spaces}
            onPick={(item) => {
              setTitle(item);
              setOpen(false);
            }}
            value={title}
          />
        )}
      </div>
      <div className="fu-adva-hb-tails">
        {on(props["Show Tail button"]) && (
          <>
            <IconBtn icon="cloud.checkmark" variant="20" label="Saved" size={20} className="fu-adva-btn--w28" />
            <IconBtn icon="search.legacy" variant="20" label="Search" size={20} className="fu-adva-btn--w28" />
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page Title ─── */

function PageTitle({ props, interactive }: SpecimenProps) {
  const type = props.Type ?? "Title";
  const [tab, setTab] = useState(0);
  const description = on(props["Show Description"]) && <span className="fu-adva-multi fu-adva-pt-desc">Description</span>;
  if (type === "Tab") {
    return (
      <div className="fu-adva-pt">
        <div className="fu-adva-pt-block fu-adva-pt-block--tab">
          <div className="fu-adva-pt-tabs" role="tablist">
            {["Tab 1", "Tab 2"].map((label, index) => (
              <button
                aria-selected={tab === index}
                className="fu-adva-pt-tab"
                key={label}
                onClick={() => interactive && setTab(index)}
                role="tab"
                type="button"
              >
                <span className="fu-adva-page">{label}</span>
              </button>
            ))}
          </div>
          {description}
        </div>
      </div>
    );
  }
  const block = (
    <div className="fu-adva-pt-block">
      <div className="fu-adva-pt-row">
        <span className="fu-adva-page fu-adva-pt-title">Page Title</span>
        {on(props["Show Buttons"]) && (
          <Btn kind="filled" className="fu-adva-btn--lg">
            <Icon name="icon.placeholder" variant="16" />
            <span className="fu-adva-body-em">Button Text</span>
          </Btn>
        )}
      </div>
      {description}
    </div>
  );
  if (type === "Title") return <div className="fu-adva-pt">{block}</div>;
  return (
    <div className="fu-adva-pt fu-adva-pt--back">
      <button className="fu-adva-pt-back" type="button">
        <Icon name="chevron.left" variant="large" />
        <span className="fu-adva-desc">Back</span>
      </button>
      {block}
    </div>
  );
}

/* ─── Timer ─── */

function Timer({ props, interactive }: SpecimenProps) {
  const [running, setRunning] = useState(props.Type !== "Stop");
  useEffect(() => setRunning(props.Type !== "Stop"), [props.Type]);
  return (
    <div className="fu-adva-timer">
      <button
        aria-label={running ? "Pause timer" : "Start timer"}
        className={`fu-adva-timer-ctrl${running ? "" : " is-stopped"}`}
        onClick={() => interactive && setRunning(!running)}
        type="button"
      >
        <Icon name={running ? "pause" : "play.legacy"} size={16} />
      </button>
    </div>
  );
}

/* ─── Tool Tips ─── */

const tipText = "Tooltips Text.Tooltips Text.Tooltips Text.";

function TipArrow({ vertical }: { vertical: boolean }) {
  return (
    <span className={`fu-adva-tip-arrow${vertical ? "" : " fu-adva-tip-arrow--h"}`}>
      <img alt="" src={asset("tooltip-arrow.svg")} />
    </span>
  );
}

function Tip({ position, align, id, onClose, hidden = false }: {
  position: string;
  align: string;
  id?: string;
  onClose?: () => void;
  hidden?: boolean;
}) {
  const vertical = position === "Left" || position === "Right";
  const arrow = vertical ? (
    <span className="fu-adva-tip-varrow">
      <TipArrow vertical />
    </span>
  ) : (
    <span className="fu-adva-tip-harrow">
      <TipArrow vertical={false} />
    </span>
  );
  return (
    <div
      className={`fu-adva-tip fu-adva-tip--${position.toLowerCase()} fu-adva-tip--${align.toLowerCase()}${hidden ? " is-hidden" : ""}`}
      id={id}
      role="tooltip"
    >
      {position === "Right" && arrow}
      <div className="fu-adva-tip-box">
        <span className="fu-adva-tip-textwrap">
          <span className="fu-adva-inter fu-adva-tip-text">{tipText}</span>
        </span>
        {onClose ? (
          <button aria-label="Close" className="fu-adva-tip-close" onClick={onClose} type="button">
            <Icon name="xmark" variant="16" />
          </button>
        ) : (
          <span className="fu-adva-tip-close">
            <Icon name="xmark" variant="16" />
          </span>
        )}
      </div>
      {position !== "Right" && arrow}
    </div>
  );
}

// Point the arrow tip at: offset along the arrow edge (14px inset + half the 12px arrow).
const arrowOffset: Record<string, number> = { Leading: 20, Center: 0, Tail: -20 };

function ToolTips({ props, interactive }: SpecimenProps) {
  const position = props.Position ?? "Above";
  const align = props["Arrow Align"] ?? "Leading";
  const id = useId();
  const [open, setOpen] = useState(true);
  if (!interactive) return <Tip align={align} position={position} />;
  return (
    <div
      className={`fu-adva-tipdemo fu-adva-tipdemo--${position.toLowerCase()} fu-adva-tipdemo--${align.toLowerCase()}`}
      style={{ "--fu-adva-shift": `${arrowOffset[align]}px` } as CSSProperties}
    >
      <Tip align={align} hidden={!open} id={id} onClose={() => setOpen(false)} position={position} />
      <button
        aria-describedby={open ? id : undefined}
        aria-label="Show tooltip"
        className="fu-adva-btn fu-adva-btn--plain fu-adva-btn--i16 fu-adva-tipdemo-anchor"
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        type="button"
      >
        <Icon name="circle.i" variant="16" />
      </button>
    </div>
  );
}

/* ─── Top bars ─── */

function PeopleButtons() {
  return (
    <div className="fu-adva-people">
      <div className="fu-adva-people-avatars">
        {[
          ["m", "cyan"],
          ["o", "magenta"],
          ["g", "yellow"],
        ].map(([file, tone]) => (
          <img alt="" className={`fu-adva-avatar fu-adva-avatar--${tone}`} key={file} src={asset(`avatar-${file}.jpg`)} />
        ))}
      </div>
      <div className="fu-adva-people-btns">
        <IconBtn icon="people.plus" variant="20" label="Invite" size={20} />
        <IconBtn icon="circle.checkmark" variant="20" label="Action items" size={20} />
        <IconBtn icon="bubble" variant="20" label="Comments" size={20} />
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <div className="fu-adva-topbar">
      <div className="fu-adva-nav-left">
        <span className="fu-adva-group fu-adva-nav-title">Title</span>
        <VDivider />
        <Btn kind="filled" className="fu-adva-btn--text">
          <span className="fu-adva-inter fu-adva-inter-em">New item</span>
        </Btn>
        <VDivider />
        <Btn kind="plain" className="fu-adva-nav-btn">
          <Icon name="filter" size={16} />
          <span className="fu-adva-inter">Filter</span>
        </Btn>
        <VDivider />
        <div className="fu-adva-nav-group">
          {[
            ["dot.3", "16", "Menu"],
            ["eye", undefined, "Display"],
            ["search.legacy", "16", "Find"],
          ].map(([icon, variant, label]) => (
            <Btn kind="plain" className="fu-adva-nav-btn" key={label}>
              <Icon name={icon!} variant={variant} size={16} />
              <span className="fu-adva-inter">{label}</span>
            </Btn>
          ))}
        </div>
      </div>
      <div className="fu-adva-nav-right">
        <PeopleButtons />
      </div>
      <span aria-hidden="true" className="fu-adva-pagediv" />
    </div>
  );
}

function ModalBar() {
  return (
    <div className="fu-adva-topbar fu-adva-topbar--modal">
      <TextBtn kind="outline">Button Text</TextBtn>
      <div className="fu-adva-modal-title">
        <span className="fu-adva-modal-ghost">
          <Icon name="sparkles" size={16} />
        </span>
        <span className="fu-adva-group">Title</span>
        <Icon name="sparkles" size={16} />
      </div>
      <TextBtn kind="outline">Button Text</TextBtn>
      <span aria-hidden="true" className="fu-adva-pagediv" />
    </div>
  );
}

function Pagination({ interactive }: SpecimenProps) {
  const [page, setPage] = useState(0);
  const total = 3;
  const start = page * 2 + 1;
  const end = Math.min(start + 1, total);
  return (
    <div className="fu-adva-pager">
      <span className="fu-adva-desc fu-adva-pager-text" aria-live="polite">
        {start === end ? `${start} of ${total}` : `${start}-${end} of ${total}`}
      </span>
      <div className="fu-adva-pager-btns">
        <IconBtn disabled={page === 0} icon="chevron.left" label="Previous page" onClick={() => interactive && setPage(0)} size={16} variant="large" />
        <IconBtn disabled={end === total} icon="chevron.right" label="Next page" onClick={() => interactive && setPage(1)} size={16} variant="large" />
      </div>
    </div>
  );
}

function SwitchTail({ interactive }: SpecimenProps) {
  const [checked, setChecked] = useState(false);
  const id = useId();
  return (
    <div className="fu-adva-switchtail">
      <span className="fu-adva-body fu-adva-switchtail-label" id={id}>
        Enable
      </span>
      <button
        aria-checked={checked}
        aria-labelledby={id}
        className="fu-adva-switch"
        onClick={() => interactive && setChecked(!checked)}
        role="switch"
        type="button"
      >
        <span className="fu-adva-switch-knob" />
      </button>
    </div>
  );
}

/* ─── No Content ─── */

function NoContent() {
  return (
    <div className="fu-adva-empty">
      <img alt="" className="fu-adva-empty-image" src={asset("no-content.png")} />
      <div className="fu-adva-empty-texts">
        <span className="fu-adva-inter fu-adva-empty-title">Title</span>
        <span className="fu-adva-inter fu-adva-empty-desc">Description</span>
      </div>
      <Btn kind="outline" className="fu-adva-empty-btn">
        <span className="fu-adva-inter">Action Button</span>
      </Btn>
    </div>
  );
}

const renderers: RendererMap = {
  "6216:32636": (p) => <NameCard {...p} />,
  "6176:29939": (p) => <ContainerSelector {...p} />,
  "6916:36213": (p) => <Uploader {...p} />,
  "7062:40256": (p) => <HeaderBar key={p.props.Type} {...p} />,
  "5761:16854": (p) => <PageTitle {...p} />,
  "4955:30299": (p) => <Timer {...p} />,
  "3520:7094": (p) => <ToolTips {...p} />,
  "7664:51585": (p) => <Panel {...p} />,
  "1564:14717": () => <NavBar />,
  "1970:7630": () => <ModalBar />,
  "6410:100842": () => <PeopleButtons />,
  "5761:16842": (p) => <Pagination {...p} />,
  "7544:46304": (p) => <SwitchTail {...p} />,
  "6458:130934": () => <NoContent />,
};

export default renderers;
