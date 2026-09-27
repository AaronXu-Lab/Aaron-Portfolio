import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type ToggleEvent,
} from "react";
import type { RendererMap } from "./registry";
import { Icon, Placeholder, on } from "./shared";
import "./lists.css";

// List Item, Left Panel Item, File Item, Group Title and Name Card sections.
// Geometry follows the Figma auto-layout of each variant; see lists.css for tokens.

type Live = { interactive: boolean };

/** Local state seeded from a prop and re-seeded when the prop changes. */
function useSeeded<T>(value: T) {
  const [state, setState] = useState(value);
  useEffect(() => setState(value), [value]);
  return [state, setState] as const;
}

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(" ");

/* ---------- atoms ---------- */

function Pic({ size }: { size: 20 | 24 }) {
  return <span aria-hidden="true" className="fu-lists-pic" style={{ width: size, height: size }} />;
}

function CharBlock({ size }: { size: 16 | 20 }) {
  return (
    <span aria-hidden="true" className={`fu-lists-char fu-lists-char--${size}`}>
      <span>O</span>
    </span>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden="true" className={cx("fu-lists-box", checked && "is-checked")}>
      {checked && <Icon name="checkbox.checkmark" size={16} />}
    </span>
  );
}

/** Figma "Switch" (664:2759). */
function Switch({
  isOn,
  enable,
  large,
  text,
  interactive,
  label = "Switch",
}: {
  isOn: boolean;
  enable: boolean;
  large: boolean;
  text: boolean;
  label?: string;
} & Live) {
  const [value, setValue] = useSeeded(isOn);
  return (
    <button
      aria-checked={value}
      aria-label={text ? undefined : label}
      className={cx(
        "fu-lists-switch",
        large && "fu-lists-switch--large",
        text && "fu-lists-switch--text",
        interactive && "fu-lists-live",
      )}
      data-on={value}
      disabled={!enable}
      onClick={() => setValue(!value)}
      role="switch"
      type="button"
    >
      {text && <span className="fu-lists-switch-text">Text</span>}
      <span className="fu-lists-switch-knob" />
    </button>
  );
}

const menuOptions = ["Text 1", "Text 2"];

/**
 * Figma "Tail/Dropdown" (650:2278): Dropdown mini trigger with a library-style menu.
 * The menu is a top-layer popover anchored to the trigger, so stages that scroll never clip it.
 */
function TailDropdown({ interactive }: Live) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Dropdown Text");
  const id = `fu-lists-menu-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const onToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    if (isOpen) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      menu.current?.hidePopover();
    }
  };

  return (
    <span className="fu-lists-dropdown" style={{ "--fu-lists-anchor": `--${id}` } as CSSProperties}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx("fu-lists-tail-dropdown", interactive && "fu-lists-live")}
        popoverTarget={id}
        ref={trigger}
        type="button"
      >
        <span className="fu-lists-t14 fu-lists-muted">{label}</span>
        <Icon name="chevron.down.legacy" size={16} />
      </button>
      {interactive && (
        <div className="fu-lists-menu" id={id} onKeyDown={onMenuKey} onToggle={onToggle} popover="auto" ref={menu} role="menu">
          {menuOptions.map((option) => (
            <button
              className="fu-lists-menu-item"
              key={option}
              onClick={() => {
                setLabel(option);
                menu.current?.hidePopover();
                trigger.current?.focus();
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              <span className="fu-lists-t14">{option}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function TailSwitch({ interactive }: Live) {
  return (
    <span className="fu-lists-tail">
      <Switch enable interactive={interactive} isOn label="Tail switch" large={false} text={false} />
    </span>
  );
}

function TailCheckbox({ interactive }: Live) {
  const [checked, setChecked] = useState(false);
  return (
    <label className={cx("fu-lists-tail", interactive && "fu-lists-live")}>
      <input
        aria-label="Tail checkbox"
        checked={checked}
        className="fu-lists-native"
        onChange={(event) => setChecked(event.target.checked)}
        type="checkbox"
      />
      <CheckBox checked={checked} />
    </label>
  );
}

/** Small icon-only button used inside rows (Left Panel buttons, File Item tails). */
function IconButton({ icon, label, pad = 6 }: { icon: ReactNode; label: string; pad?: 4 | 6 }) {
  return (
    <button aria-label={label} className="fu-lists-icon-btn" style={{ padding: pad }} type="button">
      {icon}
    </button>
  );
}

/* ---------- List Item (5390:28723) ---------- */

function ListItem({ props, interactive }: { props: Record<string, string> } & Live) {
  const type = props.Type ?? "Text";
  const fixed = props["Fixed Width"] !== "False";
  const [checked, setChecked] = useSeeded(false);
  const checkboxRow = type === "Checkbox+Text";
  const Row = checkboxRow && interactive ? "label" : "div";

  let prefix: ReactNode = null;
  if (type === "Icon+Text") prefix = <Icon name="plus" size={16} variant="16" />;
  if (type === "Char+Text") prefix = <CharBlock size={16} />;
  if (checkboxRow)
    prefix = (
      <>
        {interactive && (
          <input
            aria-label="Item’s Text"
            checked={checked}
            className="fu-lists-native"
            onChange={(event) => setChecked(event.target.checked)}
            type="checkbox"
          />
        )}
        <CheckBox checked={checked} />
      </>
    );
  if (type === "Pic+Text")
    prefix = (
      <span className="fu-lists-li-pic">
        <Pic size={24} />
      </span>
    );

  return (
    <Row className={cx("fu-lists-li", fixed && "is-fixed", prefix !== null && "has-prefix", interactive && "fu-lists-live")}>
      {prefix}
      <span className="fu-lists-li-main">
        <span className="fu-lists-li-texts">
          <span className="fu-lists-li-text">Item’s Text</span>
          {on(props["Show Description"]) && <span className="fu-lists-li-desc">Description</span>}
        </span>
        {on(props["Show Content"]) && (
          <span className="fu-lists-li-content">
            <span className="fu-lists-t14 fu-lists-muted">content</span>
          </span>
        )}
        {on(props["Show Tail"]) && (
          <span className="fu-lists-li-tail">
            <TailDropdown interactive={interactive} />
          </span>
        )}
      </span>
    </Row>
  );
}

function ListDivider({ round }: { round: boolean }) {
  return (
    <div className="fu-lists-divider" role="separator">
      <span className={cx("fu-lists-divider-line", round && "is-round")} />
    </div>
  );
}

/* ---------- Left Panel Item (5936:28562) ---------- */

type Pad = [number, number, number, number, number, number?]; // top, right, bottom, left, gap, opacity

function leftPanelLayout(small: boolean, type: string, tail: string): Pad {
  if (type === "Expand+Text") {
    const right = tail === "Null" ? 16 : tail === "Content" ? 10 : small ? 8 : 4;
    return [4, right, 4, 4, small ? 6 : 4, small && tail === "Content" ? 0.4 : 1];
  }
  const withPrefix = type !== "Text";
  const y = small ? (withPrefix ? 6 : 8) : withPrefix ? 8 : 10;
  const right = tail === "Null" ? 16 : tail === "Content" ? (small ? 8 : 10) : small ? 8 : 4;
  let opacity = 1;
  if (small && tail === "Content") opacity = 0.4;
  else if (small && type === "Icon+Text") opacity = 0.9;
  return [y, right, y, small ? 6 : 8, withPrefix ? 8 : 0, opacity];
}

function LeftPanelItem({ props, interactive }: { props: Record<string, string> } & Live) {
  const small = props.Size === "Small";
  const type = props.Type ?? "Text";
  const tail = props.Tail ?? "Null";
  const secondary = props["Show Secondary Button"] !== "False";
  const [expanded, setExpanded] = useSeeded(true);
  const [top, right, bottom, left, gap, opacity = 1] = leftPanelLayout(small, type, tail);
  const tone = small ? "fu-lists-ink" : "fu-lists-ink-strong";
  const style: CSSProperties = { padding: `${top}px ${right}px ${bottom}px ${left}px`, gap, opacity };

  return (
    <div className={cx("fu-lists-lpi", tone, interactive && "fu-lists-live")} style={style}>
      {type === "Expand+Text" && secondary && (
        <button
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          className={cx("fu-lists-icon-btn", "fu-lists-expand", !expanded && "is-collapsed")}
          onClick={() => setExpanded(!expanded)}
          style={{ padding: small && tail === "Null" ? 4 : 6 }}
          type="button"
        >
          <Icon name="chevron.down.legacy" size={16} />
        </button>
      )}
      {type === "Icon+Text" && <Placeholder size={20} />}
      {type === "Pic+Text" && <Pic size={20} />}
      <span className="fu-lists-lpi-wrap" style={{ gap: tail === "Content" ? 24 : tail === "Null" ? 0 : 16 }}>
        <span className="fu-lists-t14 fu-lists-lpi-text">Text</span>
        {tail === "Content" && <span className="fu-lists-lpi-content">content</span>}
        {tail === "Buttons" && (
          <span className="fu-lists-lpi-buttons">
            {secondary && <IconButton icon={<Icon name="dot.3" size={16} variant="16" />} label="More" />}
            <IconButton icon={<Icon name="plus" size={16} variant="16" />} label="Add" />
          </span>
        )}
        {tail === "Icon" && <Icon className="fu-lists-lpi-check" name="checkmark.private" size={16} />}
      </span>
    </div>
  );
}

function LeftPanelHeader({ props }: { props: Record<string, string> }) {
  const withIcon = props.Type === "Icon+Text";
  return (
    <div className={cx("fu-lists-lph", withIcon && "has-icon")}>
      {withIcon && <Placeholder size={20} />}
      <span className="fu-lists-lph-wrap">
        <span className={cx("fu-lists-t14", "fu-lists-lph-text", withIcon && "fu-lists-inter")}>Header</span>
        {on(props["Show Content"]) && <span className="fu-lists-t14 fu-lists-lph-content">content</span>}
      </span>
    </div>
  );
}

/* ---------- File Item (3313:16102, 6825:40884) ---------- */

function FileItemNormal({ props, interactive }: { props: Record<string, string> } & Live) {
  const state = props.State ?? "Normal";
  const details = on(props["Show Details"]);
  return (
    <div className={cx("fu-lists-file", "fu-lists-file--normal", state === "Error" && "is-error", interactive && "fu-lists-live")}>
      <span className="fu-lists-file-main">
        {state === "Uploading" ? <Icon className="fu-lists-spin" name="loader" size={20} variant="20" /> : <Pic size={20} />}
        <span className="fu-lists-t14 fu-lists-file-name">file.extension</span>
      </span>
      {details && state !== "Error" && (
        <span className="fu-lists-t14 fu-lists-muted">{state === "Normal" ? "Size" : "Precent%"}</span>
      )}
      <IconButton
        icon={<Icon name={state === "Normal" ? "trash" : "xmark"} size={16} variant="16" />}
        label={state === "Normal" ? "Delete file" : state === "Uploading" ? "Cancel upload" : "Remove file"}
      />
    </div>
  );
}

function FileItemSimple({ props, interactive }: { props: Record<string, string> } & Live) {
  const state = props.State ?? "Normal";
  const tail = props.Tail ?? "Null";
  const padding = tail === "Button" ? "4px 4px 4px 8px" : "4px 8px";
  return (
    <div
      className={cx("fu-lists-file", "fu-lists-file--simple", state === "Error" && "is-error", interactive && "fu-lists-live")}
      style={{ padding }}
    >
      <span className="fu-lists-file-main">
        {state === "Uploading" ? (
          <Icon className="fu-lists-spin" name="loader" size={16} variant="16" />
        ) : (
          <Icon name="file.private" size={16} />
        )}
        <span className="fu-lists-t14 fu-lists-file-name">file.extension</span>
      </span>
      {tail === "Button" && (
        <IconButton
          icon={<Icon name={state === "Normal" ? "trash" : "xmark"} size={16} variant="16" />}
          label={state === "Normal" ? "Delete file" : state === "Uploading" ? "Cancel upload" : "Remove file"}
          pad={4}
        />
      )}
      {tail === "Content" && (
        <span className="fu-lists-t13 fu-lists-muted">{state === "Uploading" ? "Percent%" : "Size"}</span>
      )}
    </div>
  );
}

/* ---------- Group Title (6034:32784, 8176:24270) ---------- */

function GroupTitleTails({ type = "Buttons+Content", interactive }: { type?: string } & Live) {
  return (
    <span className={cx("fu-lists-gtt", interactive && "fu-lists-live")} style={{ gap: type === "Buttons+Content" ? 8 : 0 }}>
      {type !== "Content" && (
        <button aria-label="Add" className="fu-lists-outline-btn" type="button">
          <Icon name="plus" size={16} variant="16" />
        </button>
      )}
      {type !== "Buttons" && <span className="fu-lists-t14 fu-lists-gtt-content">Content</span>}
    </span>
  );
}

function GroupTitle({ props, interactive }: { props: Record<string, string> } & Live) {
  const type = props.Type ?? "Plain";
  const expand = props.Expand ?? "Null";
  const [expanded, setExpanded] = useSeeded(true);
  const tall = type !== "Plain";
  const inter = type === "Plain" && expand !== "Null";
  const toggle = (
    <button
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse group" : "Expand group"}
      className={cx(
        "fu-lists-gt-toggle",
        expand === "Out bound" && "is-outbound",
        !expanded && "is-collapsed",
        interactive && "fu-lists-live",
      )}
      onClick={() => setExpanded(!expanded)}
      style={expand === "Out bound" ? { top: tall ? 12 : 2 } : undefined}
      type="button"
    >
      <Icon name="chevron.down" size={16} variant="medium" />
    </button>
  );
  return (
    <div className="fu-lists-gt" style={{ height: tall ? 48 : 28, gap: expand === "Inline" ? 8 : 0 }}>
      {expand !== "Null" && toggle}
      <span className="fu-lists-gt-main">
        <span className={cx("fu-lists-gt-title", type === "Wrapped" && "is-wrapped", type === "+Pic" && "has-pic")}>
          {type === "+Pic" && <Pic size={20} />}
          <span className={cx("fu-lists-gt-text", inter && "fu-lists-inter")}>Group Title</span>
        </span>
        {on(props["Show Tail"]) && <GroupTitleTails interactive={interactive} />}
      </span>
    </div>
  );
}

/* ---------- Platte Cell (6450:30561) ---------- */

function PlatteCell({ props }: { props: Record<string, string> }) {
  const isNull = props.Type === "Null";
  const [selected, setSelected] = useSeeded(on(props.Selected));
  if (isNull)
    return (
      <button aria-label="No color" className="fu-lists-platte" type="button">
        <Icon className="fu-lists-platte-null" name="null" size={16} />
      </button>
    );
  return (
    <button
      aria-label="Red"
      aria-pressed={selected}
      className={cx("fu-lists-platte", selected && "is-selected")}
      onClick={() => setSelected(!selected)}
      type="button"
    >
      <span className="fu-lists-platte-color" />
    </button>
  );
}

const renderers: RendererMap = {
  "5390:28723": (p) => <ListItem {...p} />,
  "3140:24624": ({ props }) => <ListDivider round={props.Cap === "Round"} />,
  "664:2759": ({ props, interactive }) => (
    <Switch
      enable={on(props.Enable)}
      interactive={interactive}
      isOn={on(props.isOn)}
      large={props.Size === "Large"}
      text={props.Size === "Large" && on(props["Show Text"])}
    />
  ),
  "2061:9016": () => <CharBlock size={20} />,
  "2061:9018": () => <CharBlock size={16} />,
  "1343:6444": ({ interactive }) => <TailSwitch interactive={interactive} />,
  "650:2278": ({ interactive }) => <TailDropdown interactive={interactive} />,
  "7560:15781": ({ interactive }) => <TailCheckbox interactive={interactive} />,
  "5936:28562": (p) => <LeftPanelItem {...p} />,
  "5936:34298": ({ props }) => <LeftPanelHeader props={props} />,
  "5958:39673": () => (
    <div className="fu-lists-lpd" role="separator">
      <span />
    </div>
  ),
  "3313:16102": (p) => <FileItemNormal {...p} />,
  "6825:40884": (p) => <FileItemSimple {...p} />,
  "6034:32784": (p) => <GroupTitle {...p} />,
  "8176:24270": ({ props, interactive }) => <GroupTitleTails interactive={interactive} type={props.Type} />,
  "6450:30561": ({ props }) => <PlatteCell props={props} />,
};

export default renderers;
