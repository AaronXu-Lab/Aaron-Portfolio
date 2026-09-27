import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Props } from "../data/showcase";
import type { RendererMap } from "./registry";
import { Icon, Placeholder, on } from "./shared";
import "./advanced-b.css";

// Advance Component, filter/table half (Figma frame 6906:46616).

const PIC = "/design-libraries/followup/assets/pic.placeholder.png";

/** Figma `Pic` (Size=20, PlaceHolder=false): the exported image, radius 3. */
const Pic = () => <img alt="" className="fu-advb-pic" height={20} src={PIC} width={20} />;

function IconButton({
  icon,
  variant,
  label,
  className = "",
  onClick,
}: {
  icon: string;
  variant?: string;
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button aria-label={label} className={`fu-advb-btn fu-advb-ibtn ${className}`} onClick={onClick} type="button">
      <Icon name={icon} size={16} variant={variant} />
    </button>
  );
}

/** Figma Checkbox-Input (Unchecked / Checked) as a live checkbox. */
function Check({
  checked,
  onChange,
  label,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`fu-advb-btn fu-advb-check ${checked ? "is-checked" : ""} ${className}`}
      onClick={() => onChange(!checked)}
      role="checkbox"
      type="button"
    >
      {checked && (
        <>
          <Icon className="fu-advb-check-box" name="checkbox.box" />
          <Icon className="fu-advb-check-mark" name="checkbox.checkmark" />
        </>
      )}
    </button>
  );
}

/** Trigger + popover menu styled like the library's Menu (Menu Item, Shadow/Popover). */
function MenuButton({
  className,
  label,
  options,
  value,
  onChange,
  children,
}: {
  className: string;
  label: string;
  options: string[];
  value?: string;
  onChange?: (option: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const place = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open" || !trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      element.style.left = `${Math.min(rect.left, window.innerWidth - 208)}px`;
      element.style.top = `${rect.bottom + 4}px`;
    };
    element.addEventListener("beforetoggle", place);
    return () => element.removeEventListener("beforetoggle", place);
  }, []);
  return (
    <>
      <button
        aria-haspopup="menu"
        aria-label={label}
        className={`fu-advb-btn ${className}`}
        popoverTarget={id}
        ref={trigger}
        type="button"
      >
        {children}
      </button>
      <div className="fu-advb fu-advb-menu" id={id} popover="auto" ref={menu} role="menu">
        {options.map((option) => (
          <button
            aria-checked={option === value}
            className="fu-advb-btn fu-advb-menu-item"
            key={option}
            onClick={() => {
              onChange?.(option);
              menu.current?.hidePopover();
            }}
            role={value === undefined ? "menuitem" : "menuitemradio"}
            type="button"
          >
            <span className="fu-advb-menu-text">{option}</span>
            {option === value && <Icon className="fu-advb-menu-check" name="checkmark" variant="16" />}
          </button>
        ))}
      </div>
    </>
  );
}

/** Figma Dropdown mini: text + chevron, used by "Match all" and "And". */
function DropdownMini({ className, options }: { className: string; options: string[] }) {
  const [value, setValue] = useState(options[0]);
  return (
    <MenuButton className={className} label={value} onChange={setValue} options={options} value={value}>
      <span className="fu-advb-mini">
        <span className="fu-advb-mini-text">{value}</span>
        <Icon name="chevron.down.legacy" />
      </span>
    </MenuButton>
  );
}

// Filter Condition/Cell (4416:16925)
function FilterConditionCell({
  type,
  showRhs,
  showMore,
}: {
  type: string;
  showRhs: boolean;
  showMore: boolean;
}) {
  return (
    <div className="fu-advb fu-advb-fcc">
      <span className="fu-advb-fcc-lhs">Key</span>
      <span className="fu-advb-fcc-group">
        <span className="fu-advb-fcc-op">Is</span>
        {showRhs && type === "Text" && <span className="fu-advb-fcc-value">Value</span>}
        {showRhs && type === "Pic+Text" && (
          <span className="fu-advb-fcc-people">
            <Pic />
            <span className="fu-advb-fcc-lhs">Value</span>
          </span>
        )}
        {showRhs && type === "Pics" && (
          <span className="fu-advb-fcc-people fu-advb-fcc-pics">
            <Pic />
            <Pic />
            {showMore && <span className="fu-advb-more">+2</span>}
          </span>
        )}
        <IconButton icon="xmark" label="Remove condition" variant="16" />
      </span>
    </div>
  );
}

// Filter Condition/List (8959:39335)
function FilterConditionList({
  type,
  showLhsIcon,
  showRhs,
  showMore,
  showVariable,
  onRemove,
}: {
  type: string;
  showLhsIcon: boolean;
  showRhs: boolean;
  showMore: boolean;
  showVariable: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="fu-advb fu-advb-fcl">
      <div className="fu-advb-fcl-content">
        <span className="fu-advb-fcl-lhs">
          {showLhsIcon && <Placeholder />}
          <span className="fu-advb-fcl-text">Key</span>
        </span>
        <span className="fu-advb-fcl-op">Is</span>
        {showRhs && type === "Text" && (
          <span className="fu-advb-fcl-rhs">
            <span className="fu-advb-fcl-text">Value</span>
          </span>
        )}
        {showRhs && type === "Pic+Text" && (
          <span className="fu-advb-fcl-rhs fu-advb-fcl-rhs--pic">
            <span className="fu-advb-fcl-pictext">
              <Pic />
              <span className="fu-advb-fcl-text fu-advb-fcl-text--14">Value</span>
            </span>
          </span>
        )}
        {showRhs && type === "Pics" && (
          <span className="fu-advb-fcl-rhs fu-advb-fcl-rhs--pic">
            <span className="fu-advb-fcl-pics">
              <Pic />
              <Pic />
              <Pic />
              <Pic />
              <Pic />
              {showMore && <span className="fu-advb-more fu-advb-more--list">...</span>}
            </span>
          </span>
        )}
        {showVariable && <IconButton className="fu-advb-varbtn" icon="square.f.variable" label="Insert variable" />}
      </div>
      <IconButton className="fu-advb-fcl-remove" icon="xmark" label="Remove condition" onClick={onRemove} variant="16" />
    </div>
  );
}

// Filters/Cell (7021:67670)
function FiltersCell({ size, showSave, showMatch }: { size: string; showSave: boolean; showMatch: boolean }) {
  const buttons = (
    <div className="fu-advb-fc-buttons">
      {showMatch && <DropdownMini className="fu-advb-fc-match" options={["Match all", "Match any"]} />}
      <button className="fu-advb-btn fu-advb-clear" type="button">
        Clear
      </button>
    </div>
  );
  return (
    <div className={`fu-advb fu-advb-fc ${size === "Narrow" ? "fu-advb-fc--narrow" : ""}`}>
      <div className="fu-advb-fc-contents">
        <FilterConditionCell showMore showRhs type="Text" />
        <FilterConditionCell showMore showRhs type="Pic+Text" />
        <IconButton className="fu-advb-outline" icon="plus" label="Add filter" variant="16" />
        {showSave && (
          <button className="fu-advb-btn fu-advb-outline fu-advb-fc-save" type="button">
            <span>Save filter</span>
          </button>
        )}
      </div>
      {size === "Narrow" ? <div className="fu-advb-fc-end">{buttons}</div> : buttons}
    </div>
  );
}

// Filters/List (9121:43774)
function FiltersList({ layout }: { layout: string }) {
  const wide = layout === "Wide";
  const [rows, setRows] = useState([0, 1]);
  const condition = (id: number) => (
    <FilterConditionList
      onRemove={() => setRows((current) => current.filter((row) => row !== id))}
      showLhsIcon
      showMore
      showRhs
      showVariable={false}
      type="Text"
    />
  );
  const join = <DropdownMini className="fu-advb-fl-join" options={["And", "Or"]} />;
  return (
    <div className={`fu-advb fu-advb-fl ${wide ? "fu-advb-fl--wide" : ""}`}>
      <div className="fu-advb-fl-conds">
        {rows.map((id, index) =>
          wide ? (
            <div className="fu-advb-fl-row" key={id}>
              {index === 0 ? (
                <span className="fu-advb-fl-join">
                  <span className="fu-advb-mini-text fu-advb-fl-where">Only if</span>
                </span>
              ) : (
                join
              )}
              {condition(id)}
            </div>
          ) : (
            <Fragment key={id}>
              {index > 0 && join}
              {condition(id)}
            </Fragment>
          ),
        )}
      </div>
      <button
        className="fu-advb-btn fu-advb-fl-add"
        onClick={() => setRows((current) => [...current, Math.max(-1, ...current) + 1])}
        type="button"
      >
        <Icon name="plus" variant="16" />
        <span className="fu-advb-fl-add-text">Add condition</span>
      </button>
    </div>
  );
}

// Data Label (7809:43508)
function DataLabel({ active, showIcon }: { active: boolean; showIcon: boolean }) {
  const [pressed, setPressed] = useState(active);
  return (
    <button
      aria-pressed={pressed}
      className={`fu-advb fu-advb-btn fu-advb-dl ${pressed ? "is-active" : ""} ${showIcon ? "has-icon" : ""}`}
      onClick={() => setPressed(!pressed)}
      type="button"
    >
      {showIcon && <Placeholder />}
      <span>Text</span>
    </button>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="fu-advb-chip">
      <Placeholder />
      <span>{children}</span>
    </span>
  );
}

// Input with label (7809:57837)
function InputWithLabel({
  size,
  showText,
  showValue2,
  interactive,
}: {
  size: string;
  showText: boolean;
  showValue2: boolean;
  interactive: boolean;
}) {
  return (
    <label className={`fu-advb fu-advb-iwl ${size === "Regular" ? "fu-advb-iwl--regular" : ""}`}>
      <span className="fu-advb-iwl-inputs">
        <Chip>Value 1</Chip>
        {showText &&
          (interactive ? (
            <input aria-label="Input with label" className="fu-advb-iwl-text" defaultValue="Input" />
          ) : (
            <span className="fu-advb-iwl-text">Input</span>
          ))}
        {showValue2 && <Chip>Value 2</Chip>}
      </span>
    </label>
  );
}

// Table Cell (4509:28748)
function TableCell({ checkbox, type, interactive }: { checkbox: string; type: string; interactive: boolean }) {
  const [checked, setChecked] = useState(false);
  const [isOn, setIsOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [voted, setVoted] = useState(false);
  const [choice, setChoice] = useState("Dropdown");
  const lead = checkbox !== "Null" && (
    <Check
      checked={checked}
      className={checkbox === "Out bound" ? "fu-advb-outbound" : ""}
      label="Select row"
      onChange={setChecked}
    />
  );
  let body: ReactNode;
  if (type === "Inputbox") {
    body = (
      <span className="fu-advb-tc-input">
        {interactive ? (
          <input aria-label="Cell value" className="fu-advb-tc-text" defaultValue="Inputbox" />
        ) : (
          <span className="fu-advb-tc-text">Inputbox</span>
        )}
      </span>
    );
  } else if (type === "Dropdown") {
    body = (
      <MenuButton
        className="fu-advb-tc-input fu-advb-tc-dropdown"
        label={choice}
        onChange={setChoice}
        options={["Dropdown", "Option 2", "Option 3"]}
        value={choice}
      >
        <span className="fu-advb-tc-text">{choice}</span>
      </MenuButton>
    );
  } else if (type === "Timer+Text" || type === "Vote") {
    body = (
      <span className="fu-advb-tc-content">
        {type === "Vote" ? (
          <button
            aria-label="Vote"
            aria-pressed={voted}
            className="fu-advb-btn fu-advb-tc-vote"
            onClick={() => setVoted(!voted)}
            type="button"
          >
            <Icon name={voted ? "thumbs.up.fill" : "thumbs.up"} size={20} variant="20" />
          </button>
        ) : (
          <button
            aria-label={running ? "Pause timer" : "Start timer"}
            className={`fu-advb-btn fu-advb-timer ${running ? "is-running" : ""}`}
            onClick={() => setRunning(!running)}
            type="button"
          >
            <span className="fu-advb-timer-control">
              <Icon name={running ? "pause" : "play.timer"} />
            </span>
          </button>
        )}
        <span className="fu-advb-tc-text fu-advb-tc-label">Text</span>
      </span>
    );
  } else if (type === "Checkbox") {
    body = <Check checked={checked} label="Cell checkbox" onChange={setChecked} />;
  } else {
    body = (
      <button
        aria-checked={isOn}
        aria-label="Cell switch"
        className={`fu-advb-btn fu-advb-switch ${isOn ? "is-on" : ""}`}
        onClick={() => setIsOn(!isOn)}
        role="switch"
        type="button"
      >
        <span className="fu-advb-switch-knob" />
      </button>
    );
  }
  const layout =
    type === "Checkbox" || type === "Switch"
      ? "fu-advb-tc--control"
      : type === "Timer+Text" || type === "Vote"
        ? "fu-advb-tc--content"
        : "";
  return (
    <div className={`fu-advb fu-advb-tc ${layout} fu-advb-tc--${checkbox === "Out bound" ? "out" : checkbox.toLowerCase()}`}>
      {lead}
      {body}
    </div>
  );
}

// Table Main Key (4509:45920)
function TableMainKey({ checkbox, showCounter, subitem }: { checkbox: string; showCounter: boolean; subitem: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className={`fu-advb fu-advb-mk fu-advb-mk--${checkbox === "Out bound" ? "out" : checkbox.toLowerCase()}`}>
      {checkbox !== "Null" && (
        <Check
          checked={checked}
          className={checkbox === "Out bound" ? "fu-advb-outbound" : ""}
          label="Select row"
          onChange={setChecked}
        />
      )}
      <div className="fu-advb-mk-actions">
        <div className="fu-advb-mk-contents">
          {subitem && <Icon className="fu-advb-mk-tip" name="subitem.tip" />}
          <span className="fu-advb-mk-text">Main Key</span>
          {showCounter && (
            <button aria-label="3 followers" className="fu-advb-btn fu-advb-follower fu-advb-mk-counter" type="button">
              <Icon name="square.2.curve" variant="16" />
              <span>3</span>
            </button>
          )}
        </div>
        <IconButton icon="circle.checkmark.plus" label="Add action item" variant="16" />
      </div>
    </div>
  );
}

// Table Header (5347:17640)
function TableHeader({
  checkbox,
  showMenu,
  showIcon,
  showFollower,
}: {
  checkbox: string;
  showMenu: boolean;
  showIcon: boolean;
  showFollower: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [ascending, setAscending] = useState(false);
  return (
    <div
      className={`fu-advb fu-advb-th fu-advb-th--${checkbox === "Out bound" ? "out" : checkbox.toLowerCase()} ${
        showMenu ? "has-menu" : ""
      }`}
    >
      {checkbox !== "Null" && (
        <Check
          checked={checked}
          className={checkbox === "Out bound" ? "fu-advb-outbound" : ""}
          label="Select all rows"
          onChange={setChecked}
        />
      )}
      <div className="fu-advb-th-contents">
        {showIcon && <Icon className="fu-advb-th-icon" name="circle.i.header" />}
        <div className="fu-advb-th-title">
          <span className="fu-advb-th-text">Header</span>
          {showFollower && (
            <IconButton
              className="fu-advb-follower"
              icon={ascending ? "arrow.up" : "arrow.down"}
              label={ascending ? "Sorted ascending" : "Sorted descending"}
              onClick={() => setAscending(!ascending)}
            />
          )}
        </div>
        {showMenu && (
          <MenuButton
            className="fu-advb-ibtn"
            label="Column menu"
            options={["Sort ascending", "Sort descending", "Hide column"]}
          >
            <Icon name="dot.3" variant="16" />
          </MenuButton>
        )}
      </div>
    </div>
  );
}

// Remount when the playground props change so local state never contradicts them.
const key = (props: Props) => JSON.stringify(props);

const renderers: RendererMap = {
  "4416:16925": ({ props }) => (
    <FilterConditionCell
      key={key(props)}
      showMore={on(props["Show More"])}
      showRhs={on(props["Show Rhs"])}
      type={props.Type}
    />
  ),
  "8959:39335": ({ props }) => (
    <FilterConditionList
      key={key(props)}
      showLhsIcon={on(props["Show Lhs Icon"])}
      showMore={on(props["Show More"])}
      showRhs={on(props["Show Rhs"])}
      showVariable={on(props["Show Variable"])}
      type={props.Type}
    />
  ),
  "7021:67670": ({ props }) => (
    <FiltersCell
      key={key(props)}
      showMatch={on(props["Show match"])}
      showSave={on(props["Show Save filter"])}
      size={props.Size}
    />
  ),
  "9121:43774": ({ props }) => <FiltersList key={key(props)} layout={props.Layout} />,
  "7809:43508": ({ props }) => (
    <DataLabel active={on(props.Active)} key={key(props)} showIcon={on(props["Show Icon"])} />
  ),
  "7809:57837": ({ props, interactive }) => (
    <InputWithLabel
      interactive={interactive}
      key={key(props)}
      showText={on(props["Show Text"])}
      showValue2={on(props["Show Value 2"])}
      size={props.Size}
    />
  ),
  "4509:28748": ({ props, interactive }) => (
    <TableCell checkbox={props.Checkbox} interactive={interactive} key={key(props)} type={props.Type} />
  ),
  "4509:45920": ({ props }) => (
    <TableMainKey
      checkbox={props.Checkbox}
      key={key(props)}
      showCounter={on(props["Show Counter"])}
      subitem={on(props.Subitem)}
    />
  ),
  "5347:17640": ({ props }) => (
    <TableHeader
      checkbox={props.Checkbox}
      key={key(props)}
      showFollower={on(props["Show Follower"])}
      showIcon={on(props["Show Icon"])}
      showMenu={on(props["Show Menu"])}
    />
  ),
};

export default renderers;
