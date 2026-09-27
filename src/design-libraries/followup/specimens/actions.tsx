import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Props } from "../data/showcase";
import type { RendererMap, SpecimenProps } from "./registry";
import { Icon, Placeholder, on } from "./shared";
import "./actions.css";

// Button, Menu, Dialog, Notification, Toast and Batch Operator specimens.
// Geometry, type and colour follow the Figma source; hover looks come from the
// Button page's "Normal - Hover" / "Active - Hover" columns and the menu's hovered row.

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const keyOf = (props: Props) => JSON.stringify(props);

/* ---------- Button (550:2246) ---------- */

type ButtonType = "Icon+Text" | "Text" | "Icon";
type ButtonStyle = "Filled" | "Light" | "Outline" | "Plain";
type ButtonSize = "Small" | "Regular" | "Large";
type ButtonState = "Normal" | "Disable" | "Active" | "Loading";

function Btn({
  type = "Text",
  style = "Filled",
  size = "Large",
  state = "Normal",
  text = "Button Text",
  icon,
  live = false,
  className,
  label,
  onClick,
}: {
  type?: ButtonType;
  style?: ButtonStyle;
  size?: ButtonSize;
  state?: ButtonState;
  text?: string;
  icon?: ReactNode;
  live?: boolean;
  className?: string;
  label?: string;
  onClick?: () => void;
}) {
  // Outline buttons with an Active variant toggle it on click, like a filter chip.
  const toggles = live && style === "Outline" && state === "Normal" && type !== "Text";
  const [pressed, setPressed] = useState(false);
  const shown: ButtonState = toggles && pressed ? "Active" : state;
  const loading = shown === "Loading";
  const iconSize = 16;
  const glyph =
    shown === "Active" ? (
      <Icon name="xmark" variant="16" size={iconSize} />
    ) : loading ? (
      <Icon name="loader" variant="16" size={iconSize} className={cx(live && "fu-actions-spin")} />
    ) : (
      (icon ?? <Placeholder />)
    );
  return (
    <button
      aria-busy={loading || undefined}
      aria-label={type === "Icon" ? (label ?? text) : undefined}
      aria-pressed={toggles ? pressed : undefined}
      className={cx(
        "fu-actions-btn",
        `fu-actions-btn--${size.toLowerCase()}`,
        `fu-actions-btn--${type === "Icon+Text" ? "icon-text" : type.toLowerCase()}`,
        `fu-actions-btn--${style.toLowerCase()}`,
        `is-${shown.toLowerCase()}`,
        live && "is-live",
        className,
      )}
      disabled={shown === "Disable"}
      onClick={() => {
        if (toggles) setPressed(!pressed);
        onClick?.();
      }}
      tabIndex={live ? undefined : -1}
      type="button"
    >
      {type !== "Text" && glyph}
      {type !== "Icon" && <span className="fu-actions-btn-text">{text}</span>}
      {type === "Text" && loading && (
        <span className="fu-actions-btn-loader">
          <Icon name="loader" variant="16" size={16} className={cx(live && "fu-actions-spin")} />
        </span>
      )}
    </button>
  );
}

function ButtonSpec({ props, interactive }: SpecimenProps) {
  return (
    <Btn
      live={interactive}
      size={props.Size as ButtonSize}
      state={props.State as ButtonState}
      style={props.Style as ButtonStyle}
      type={props.Type as ButtonType}
    />
  );
}

/* ---------- Button/20 size icon (6631:49370) ---------- */

function Button20Spec({ props, interactive }: SpecimenProps) {
  const style = props.Style as ButtonStyle;
  const toggles = interactive && style === "Outline" && props.State === "Normal";
  const [pressed, setPressed] = useState(false);
  const state = toggles && pressed ? "Active" : props.State;
  const glyph =
    state === "Active" ? (
      <Icon name="xmark" variant="20" size={20} />
    ) : state === "Loading" ? (
      <Icon name="loader" variant="20" size={20} className={cx(interactive && "fu-actions-spin")} />
    ) : (
      <Placeholder size={20} />
    );
  return (
    <button
      aria-busy={state === "Loading" || undefined}
      aria-label="Button"
      aria-pressed={toggles ? pressed : undefined}
      className={cx(
        "fu-actions-btn fu-actions-btn--icon20 fu-actions-btn--icon",
        `fu-actions-btn--${style.toLowerCase()}`,
        `is-${state.toLowerCase()}`,
        interactive && "is-live",
      )}
      disabled={state === "Disable"}
      onClick={() => toggles && setPressed(!pressed)}
      tabIndex={interactive ? undefined : -1}
      type="button"
    >
      {glyph}
    </button>
  );
}

/* ---------- Button/Huge (6631:43777) ---------- */

function HugeSpec({ props, interactive }: SpecimenProps) {
  return (
    <button
      className={cx(
        "fu-actions-huge",
        `fu-actions-huge--${props.Style.toLowerCase()}`,
        props.State === "Disable" && "is-disable",
        interactive && "is-live",
      )}
      disabled={props.State === "Disable"}
      tabIndex={interactive ? undefined : -1}
      type="button"
    >
      <span>Button Text</span>
    </button>
  );
}

/* ---------- Icon button rows: Buttons (4745:20020), Menu buttons (6197:46619) ---------- */

const iconButtons = [
  { icon: <Icon name="bubble.empty" size={16} />, label: "Comment" },
  { icon: <Icon name="dot.3" variant="16" size={16} />, label: "More" },
  { icon: <Icon name="plus" variant="16" size={16} />, label: "Add" },
];

function IconButtons({ count, live, compact }: { count: number; live: boolean; compact?: boolean }) {
  return (
    <div className={cx("fu-actions-iconrow", compact && "is-compact")}>
      {iconButtons.slice(3 - count).map((button) => (
        <button
          aria-label={button.label}
          className={cx("fu-actions-iconbtn", live && "is-live")}
          key={button.label}
          tabIndex={live ? undefined : -1}
          type="button"
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
}

/* ---------- Menu Item (4134:24614) ---------- */

const menuPic =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALdSURBVHgB7Zo9b9NQFIbfGAanU8KWTE3GMpGwJRJUTrekv6CCLBUjE8ijR0ssWdmapr8ApVMTIUTaCXejY/CUdAsTNlBR7jExWKFp7vVXbKmP5Hza0vvee87x8bUzmKNpWs7+Zr9EBk/Z101csy1JZGCyVxO/0NXf6Af/fmaoqrrJ/ngPJEz0ckxI2NZ13fxj4LX6BekR72LKG/Kje+ortc3moY30kbv6efVdYlPxHGklgydS4pJVBKZdQvpi34tjINWk3sB9kZ1L5RIaOw0Ui0XIsoywGY/HMD4ZODfOuY/hNqA0FEd8lJTLZWfLP8hjeDLkOoYrhKrVauTivTQaDccID1wzUHlc+fvZtm0MTgawLRthImdlZ5Dc0FR2FIzfjlcex2XAOxok/nR0iqhotprOe7FQ5NpfuApZloWo8M4qzQgPQlXoJgqFAnL5HC6nl5jNZoibQAa8lYnE97o9TKdTxInvE5mbdC75fB7N3SbixreBrJz9/7dsFnHj2wCFDJ05vYw+jhA3gXKgd9iDoijOyJMZkRYgLAIZoLJ33D/GOglcRnmgJnDr4ZaTN5Zt4Wx0FlrJjdQAtQVUmaiX8lKv1zEYDLgbttuIzACV1b1ne07rfRPUsFHu9N/1EYRIDJBoEk8mbqNWq6FUKuHo8Mh3SIV+RVapVrD/Yn+leBcyK7L/IqHOgN+LHhJPJi4+X0CUUAwsS1YRyEStXoMogQ2sStaoCWSAN1mjxLcBStbWbiuS1QkRfBmIY4WCF2EDJHydIbMI13mAViJckiSe4DIwmUwQN4vXGsvgMhBG0yUKLTHywGWARiNOE8PBkPviiDuJqf2lhotW6XiX/USgPKNQpYHiDR9CqAoZhuFsSeLuBse6IQMm0ospzW/hp5MMGbjGB6SVDLqS/EPupHIWmGZd1w8kraN9ZV+2U2WCtJJmzJ9WcVFVtc1Cih49SO7jNizk5Q25o2ls4Bm/AQoq5MANAoQ6AAAAAElFTkSuQmCC";

function Checkbox({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="fu-actions-check is-checked" aria-hidden="true">
      <Icon name="checkbox.box" size={16} className="fu-actions-check-box" />
      <Icon name="checkbox.checkmark" size={16} className="fu-actions-check-mark" />
    </span>
  ) : (
    <span className="fu-actions-check" aria-hidden="true" />
  );
}

function MenuItemRow({
  props,
  live,
  text = "Item’s text generally uses the action name",
  selected = false,
  onSelect,
  width,
}: {
  props: Props;
  live: boolean;
  text?: string;
  selected?: boolean;
  onSelect?: () => void;
  width?: number;
}) {
  const type = props.Type ?? "Text";
  const multiple = props["Text Line"] === "Multiple";
  const showCheckbox = on(props["Show Checkbox"]);
  const showContent = on(props["Show Content"]);
  const showTail = on(props["Show Tail"]);
  const showDescription = on(props["Show Description"]);
  const [checked, setChecked] = useState(false);
  const pic = type === "Pic+Text";
  const checkbox = showCheckbox && (
    pic ? (
      <span className="fu-actions-mi-prefix">
        <Checkbox checked={checked} />
      </span>
    ) : (
      <Checkbox checked={checked} />
    )
  );
  const leading =
    type === "Icon+Text" ? (
      <Placeholder />
    ) : type === "Char Block+Text" ? (
      <span className="fu-actions-charblock">
        <span>P</span>
      </span>
    ) : pic ? (
      <img alt="" className="fu-actions-pic" height={20} src={menuPic} width={20} />
    ) : null;
  const body = (
    <>
      {/* Figma draws the Icon+Text / Multiple checkbox after the icon. */}
      {!(type === "Icon+Text" && multiple) && checkbox}
      {leading}
      {type === "Icon+Text" && multiple && checkbox}
      <span className="fu-actions-mi-main">
        <span className="fu-actions-mi-row">
          <span className="fu-actions-mi-text">
            <span>{text}</span>
          </span>
          {showContent && (
            <span className="fu-actions-mi-content">
              <span>content</span>
            </span>
          )}
          {showTail && (
            <span className="fu-actions-mi-tail">
              <span>
                <Icon name="eye" size={16} />
              </span>
            </span>
          )}
          {selected && (
            <span className="fu-actions-mi-tail">
              <span>
                <Icon name="checkmark" variant="16" size={16} />
              </span>
            </span>
          )}
        </span>
        {showDescription && (
          <span className="fu-actions-mi-desc">
            Description is for user to better understand Item’s behavior.
          </span>
        )}
      </span>
    </>
  );
  const className = cx(
    "fu-actions-mi",
    type === "Text" && "is-text",
    pic && "is-pic",
    multiple && "is-multiple",
    type === "Icon+Text" && multiple && "is-icon-multiple",
    live && "is-live",
  );
  const style = width ? { width } : undefined;
  if (!live) return <div className={className} style={style}>{body}</div>;
  return (
    <button
      aria-pressed={showCheckbox ? checked : undefined}
      className={className}
      onClick={() => {
        if (showCheckbox) setChecked(!checked);
        onSelect?.();
      }}
      role={onSelect ? "option" : undefined}
      aria-selected={onSelect ? selected : undefined}
      style={style}
      type="button"
    >
      {body}
    </button>
  );
}

/* ---------- Menu Header, Scroll Bar, Search Box, Divider ---------- */

function MenuHeader({ props }: SpecimenProps) {
  return (
    <div className={cx("fu-actions-mh", props.Type === "Icon+Text" && "has-icon")}>
      {props.Type === "Icon+Text" && <Icon name="circle.i.header" size={16} />}
      <span className="fu-actions-mh-main">
        <span className="fu-actions-mh-text">
          <span>Header</span>
        </span>
        {on(props["Show Content"]) && <span className="fu-actions-mh-content">content</span>}
      </span>
    </div>
  );
}

function ScrollBar({ props, interactive }: SpecimenProps) {
  return (
    <div
      aria-hidden="true"
      className={cx("fu-actions-sb", props.State === "Active" && "is-active", interactive && "is-live")}
    >
      <span />
    </div>
  );
}

function SearchBox({ interactive }: SpecimenProps) {
  return (
    <label className="fu-actions-search">
      <input aria-label="Search" placeholder="Search" readOnly={!interactive} tabIndex={interactive ? undefined : -1} type="text" />
    </label>
  );
}

/* ---------- Dialog (1065:5795) ---------- */

function DialogInput({ live }: { live: boolean }) {
  return (
    <input
      aria-label="Dialog input"
      className="fu-actions-input"
      defaultValue="Text"
      readOnly={!live}
      tabIndex={live ? undefined : -1}
      type="text"
    />
  );
}

const dropdownOptions = ["Item 1", "Item 2", "Item 3"];

function DialogDropdown({ live }: { live: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("Text");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="fu-actions-dd" ref={root}>
      <button
        aria-expanded={live ? open : undefined}
        aria-haspopup="listbox"
        className={cx("fu-actions-input fu-actions-dd-trigger", open && "is-open")}
        onClick={() => setOpen(!open)}
        tabIndex={live ? undefined : -1}
        type="button"
      >
        <span>{value}</span>
        <Icon name="chevron.down" variant="large" size={16} />
      </button>
      {live && open && (
        <div className="fu-actions-menu" role="listbox">
          {dropdownOptions.map((option) => (
            <MenuItemRow
              key={option}
              live
              onSelect={() => {
                setValue(option);
                setOpen(false);
              }}
              props={{ Type: "Text", "Text Line": "Single" }}
              selected={option === value}
              text={option}
              width={408}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DialogActions({ live }: { live: boolean }) {
  return (
    <div className="fu-actions-dialog-action">
      <Btn live={live} size="Large" style="Outline" text="Action" type="Text" />
      <Btn live={live} size="Large" style="Filled" text="Action" type="Text" />
    </div>
  );
}

function DialogSpec({ props, interactive }: SpecimenProps) {
  const type = props.Type;
  const description = type.startsWith("Description");
  const field = type.endsWith("Inputbox") ? (
    <DialogInput live={interactive} />
  ) : type.endsWith("Dropdown") ? (
    <DialogDropdown live={interactive} />
  ) : null;
  const text = (
    <span className="fu-actions-dialog-desc">
      <span>It is recommended to use less than 3 lines of text to further elaborate on the content of the alert.</span>
    </span>
  );
  return (
    <section
      aria-label="Dialog Title"
      className={cx(
        "fu-actions-dialog",
        type === "Custom Content" && "is-custom",
        (field || type === "Custom Content") && !description && "is-loose",
      )}
    >
      <div className="fu-actions-dialog-head">
        <div aria-level={3} className="fu-actions-dialog-title" role="heading">
          Dialog Title
        </div>
        {description && field ? (
          <div className="fu-actions-dialog-group">
            {text}
            {field}
          </div>
        ) : description ? (
          text
        ) : (
          field
        )}
        {type === "Custom Content" && on(props["Area Hint"]) && (
          <div className="fu-actions-dialog-area">
            <span>Content Area</span>
          </div>
        )}
      </div>
      <DialogActions live={interactive} />
    </section>
  );
}

/* ---------- Dialog Buttons (1065:4991) ---------- */

function DialogButtons({ props, interactive }: SpecimenProps) {
  return (
    <div className="fu-actions-dbtns">
      {on(props["Show Assist Button"]) && (
        <Btn live={interactive} size="Large" style="Outline" text="Action" type="Text" />
      )}
      <div className="fu-actions-dbtns-main">
        {props.Type === "2" && <Btn live={interactive} size="Large" style="Outline" text="Action" type="Text" />}
        <Btn live={interactive} size="Large" style="Filled" text="Action" type="Text" />
      </div>
    </div>
  );
}

/* ---------- Dismissible wrapper (Notification, Bulk Editing) ---------- */

function Restorable({
  live,
  label,
  children,
}: {
  live: boolean;
  label: string;
  children: (dismiss: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!live || open) return <>{children(() => setOpen(false))}</>;
  return <Btn live size="Regular" style="Outline" text={label} type="Text" onClick={() => setOpen(true)} />;
}

/* ---------- Table Cell Divider (2924:5730), Notification (2116:18508) ---------- */

function TableCellDivider({ active }: { active?: boolean }) {
  return <span aria-hidden="true" className={cx("fu-actions-tcd", active && "is-active")} />;
}

function PlainAction({
  live,
  label,
  icon,
  onClick,
  text,
}: {
  live: boolean;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  text?: string;
}) {
  return (
    <button
      aria-label={text ? undefined : label}
      className={cx("fu-actions-plain", text && "has-text", live && "is-live")}
      onClick={onClick}
      tabIndex={live ? undefined : -1}
      type="button"
    >
      {icon}
      {text && <span>{text}</span>}
    </button>
  );
}

function NotificationSpec({ props, interactive }: SpecimenProps) {
  const showIcon = on(props["Show Icon"]);
  const showButtons = on(props["Show Buttons"]);
  const variant = `${showIcon ? "i" : "n"}${showButtons ? "b" : "n"}`;
  return (
    <Restorable label="Show notification" live={interactive}>
      {(dismiss) => (
        <div className={cx("fu-actions-noti", !showButtons && "is-bare")} role="status">
          <div className={cx("fu-actions-noti-info", showIcon && "has-icon")}>
            {showIcon && <Icon name="circle.i.header" size={16} />}
            <span className="fu-actions-noti-text">
              <span className={`is-${variant}`}>Notification Information</span>
            </span>
          </div>
          <div className="fu-actions-noti-buttons">
            {showButtons && (
              <PlainAction
                icon={<Icon name="arrow.uturn.left" size={16} />}
                label="Undo"
                live={interactive}
                onClick={dismiss}
                text="Undo"
              />
            )}
            <TableCellDivider />
            <PlainAction icon={<Icon name="xmark" variant="16" size={16} />} label="Close" live={interactive} onClick={dismiss} />
          </div>
        </div>
      )}
    </Restorable>
  );
}

/* ---------- Toast (2554:12549) ---------- */

function Toast() {
  return (
    <div className="fu-actions-toast" role="status">
      <Icon name="circle.i.header" size={16} />
      <span className="fu-actions-toast-text">
        <span>Toast</span>
      </span>
    </div>
  );
}

/* ---------- Bulk Editing (5761:16846) ---------- */

function BulkEditing({ interactive }: SpecimenProps) {
  return (
    <Restorable label="Show bulk editing" live={interactive}>
      {(dismiss) => (
        <div className="fu-actions-bulk" role="toolbar" aria-label="Bulk editing">
          <PlainAction
            icon={<Icon name="xmark" variant="16" size={16} />}
            label="Clear selection"
            live={interactive}
            onClick={dismiss}
          />
          <span className="fu-actions-bulk-count">0 selected</span>
          <div className="fu-actions-bulk-buttons">
            {[1, 2, 3, 4].map((index) => (
              <PlainAction icon={<Placeholder />} key={index} label="Button Text" live={interactive} text="Button Text" />
            ))}
          </div>
        </div>
      )}
    </Restorable>
  );
}

/* ---------- Registry ---------- */

const renderers: RendererMap = {
  "550:2246": (p) => <ButtonSpec key={keyOf(p.props)} {...p} />,
  "6631:49370": (p) => <Button20Spec key={keyOf(p.props)} {...p} />,
  "6631:43777": (p) => <HugeSpec {...p} />,
  "4745:20020": ({ props, interactive }) => <IconButtons count={Number(props.Count)} live={interactive} />,
  "4134:24614": ({ props, interactive }) => <MenuItemRow key={keyOf(props)} live={interactive} props={props} />,
  "4153:27294": (p) => <MenuHeader {...p} />,
  "514:1684": (p) => <ScrollBar {...p} />,
  "4153:31941": (p) => <SearchBox {...p} />,
  "4153:25100": () => (
    <div aria-hidden="true" className="fu-actions-divider">
      <span />
    </div>
  ),
  "6197:46619": ({ interactive }) => <IconButtons compact count={2} live={interactive} />,
  "1065:5795": (p) => <DialogSpec key={keyOf(p.props)} {...p} />,
  "1065:4991": (p) => <DialogButtons {...p} />,
  "2116:18508": (p) => <NotificationSpec key={keyOf(p.props)} {...p} />,
  "2924:5730": ({ props }) => <TableCellDivider active={props.isActive === "True"} />,
  "2554:12549": () => <Toast />,
  "5761:16846": (p) => <BulkEditing {...p} />,
};

export default renderers;
