import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type ToggleEvent,
} from "react";
import type { RendererMap, SpecimenProps } from "./registry";
import { Icon, Placeholder, on } from "./shared";
import "./form-controls.css";

// Inputbox, Dropdown, Checkbox, Radio Button and Segment sections.
// Colors come from the Figma variables App.tsx writes to :root (--followup-*).

/* ---------- Menu (popover listbox shared by every dropdown trigger) ---------- */

type PickerProps = {
  interactive: boolean;
  disabled?: boolean;
  className: string;
  data?: Record<string, string>;
  options: string[];
  selected: string[];
  multiple?: boolean;
  pics?: boolean;
  onPick: (option: string) => void;
  children: ReactNode;
};

function Picker({ interactive, disabled, className, data, options, selected, multiple, pics, onPick, children }: PickerProps) {
  const raw = useId().replace(/[^\w-]/g, "");
  const menuId = `fu-form-menu-${raw}`;
  const anchor = { "--fu-form-anchor": `--fu-form-anchor-${raw}` } as CSSProperties;
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const live = interactive && !disabled;

  const toggled = (event: ToggleEvent<HTMLDivElement>) => {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    if (!isOpen || !menu.current) return;
    // ponytail: fixed coordinates for browsers without CSS anchor positioning; they don't follow page scroll.
    if (!CSS.supports("anchor-name: --a") && trigger.current) {
      const box = trigger.current.getBoundingClientRect();
      Object.assign(menu.current.style, { top: `${box.bottom + 4}px`, left: `${box.left}px` });
    }
    focusItem();
  };

  const focusItem = () => menu.current?.querySelector<HTMLElement>('[aria-selected="true"], [role="option"]')?.focus();

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? -1 : null;
    if (event.key === "Tab") menu.current?.hidePopover();
    if (next === null || items.length === 0) return;
    event.preventDefault();
    items.at(next % items.length)?.focus();
  };

  return (
    <>
      <button
        {...data}
        aria-expanded={live ? open : undefined}
        aria-haspopup={live ? "listbox" : undefined}
        className={className}
        disabled={disabled}
        onKeyDown={(event) => {
          if (live && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            menu.current?.showPopover();
            focusItem();
          }
        }}
        popoverTarget={live ? menuId : undefined}
        ref={trigger}
        style={anchor}
        tabIndex={interactive ? undefined : -1}
        type="button"
      >
        {children}
      </button>
      {live && (
        <div
          aria-multiselectable={multiple || undefined}
          className="fu-form-menu"
          id={menuId}
          onKeyDown={navigate}
          onToggle={toggled}
          popover="auto"
          ref={menu}
          role="listbox"
          style={anchor}
        >
          <div className="fu-form-menu-list">
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <button
                  aria-selected={checked}
                  className="fu-form-menu-item"
                  key={option}
                  onClick={() => {
                    onPick(option);
                    if (!multiple) menu.current?.hidePopover();
                  }}
                  role="option"
                  type="button"
                >
                  {pics && <span className="fu-form-pic" />}
                  <span className="fu-form-menu-text">{option}</span>
                  {checked && <Icon className="fu-form-menu-check" name="checkmark" variant="16" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

const menuOptions = ["Text 1", "Text 2", "Text 3"];

/* ---------- Inputbox ---------- */

const Chevron = () => <Icon name="chevron.down.legacy" />;
const Divider = () => <span className="fu-form-divider" aria-hidden="true" />;

/** Dropdown mini (4963:30417): Text / Icon / Icon+Text / Pic+Text, optional chevron. */
function DropdownMini({
  interactive,
  disabled,
  type = "Text",
  chevron = true,
  initial,
}: {
  interactive: boolean;
  disabled?: boolean;
  type?: string;
  chevron?: boolean;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Picker
      className="fu-form-mini"
      disabled={disabled}
      interactive={interactive}
      onPick={setValue}
      options={menuOptions}
      selected={[value]}
    >
      {(type === "Icon" || type === "Icon+Text") && <Placeholder />}
      {type === "Pic+Text" && <span className="fu-form-pic" />}
      {type !== "Icon" && <span className="fu-form-mini-text">{value}</span>}
      {chevron && <Chevron />}
    </Picker>
  );
}

function Inputbox({ props, interactive }: SpecimenProps) {
  const { Line: line, Size: size, Type: type, State: state } = props;
  const disabled = state === "Disable";
  const [value, setValue] = useState("Text");
  const field = useRef<HTMLInputElement>(null);
  const tail = on(props["Show Tail"]) && !disabled && (!interactive || value !== "");
  const common = {
    "aria-label": "Inputbox",
    className: line === "Multiple" ? "fu-form-area" : "fu-form-field",
    disabled,
    onChange: (event: { target: { value: string } }) => setValue(event.target.value),
    placeholder: "Text",
    readOnly: !interactive,
    tabIndex: interactive ? undefined : -1,
    value,
  };
  const mini = <DropdownMini disabled={disabled} initial="Options" interactive={interactive} />;
  const textTail = (
    <div className="fu-form-texttail">
      <div className="fu-form-wrap">
        <input {...common} ref={field} />
      </div>
      {tail && (
        <button
          aria-label="Clear"
          className="fu-form-tail"
          onClick={() => {
            setValue("");
            field.current?.focus();
          }}
          tabIndex={interactive ? undefined : -1}
          type="button"
        >
          <Icon name="xmark" variant="16" />
        </button>
      )}
    </div>
  );

  return (
    <div className="fu-form-input" data-line={line} data-size={size} data-state={state} data-type={type}>
      {line === "Multiple" ? (
        <textarea {...common} rows={2} />
      ) : (
        <div className="fu-form-content">
          {type === "Icon+Text" && <Placeholder />}
          {type === "Option+Text" && (
            <div className="fu-form-group">
              {mini}
              <Divider />
            </div>
          )}
          {textTail}
          {type === "Text+Option" && (
            <div className="fu-form-group">
              <Divider />
              {mini}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inputbox Tail/Stepper (836:22055): 24×24, chevrons centred 6px above and below the middle. */
function Stepper({ interactive }: SpecimenProps) {
  const tabIndex = interactive ? undefined : -1;
  return (
    <div className="fu-form-stepper" role="group" aria-label="Stepper">
      <button aria-label="Increase" className="fu-form-step" data-dir="up" tabIndex={tabIndex} type="button">
        <Icon name="chevron.up.legacy" />
      </button>
      <button aria-label="Decrease" className="fu-form-step" data-dir="down" tabIndex={tabIndex} type="button">
        <Icon name="chevron.down.legacy" />
      </button>
    </div>
  );
}

/* ---------- Dropdown ---------- */

const valueOptions = ["Value 1", "Value 2", "Value 3", "Value 4"];
const picOptions = ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5", "Image 6"];

function Label({ children, state = "Normal", pics }: { children: ReactNode; state?: string; pics?: boolean }) {
  return (
    <span className="fu-form-label" data-pics={pics || undefined} data-state={state}>
      {children}
    </span>
  );
}

function Dropdown({ props, interactive }: SpecimenProps) {
  const { Style: style, Size: size, Type: type, State: state } = props;
  const multiple = style === "Multiple";
  const pics = type === "Pics";
  const [picked, setPicked] = useState<string[]>(multiple ? (pics ? picOptions : valueOptions.slice(0, 3)) : []);
  const single = picked[0] ?? "Text";
  const pick = (option: string) =>
    setPicked(multiple ? (picked.includes(option) ? picked.filter((item) => item !== option) : [...picked, option]) : [option]);
  const shown = pics ? 5 : 2;

  return (
    <Picker
      className="fu-form-dd"
      data={{ "data-size": size, "data-state": state, "data-style": style, "data-type": type }}
      disabled={state === "Disable"}
      interactive={interactive}
      multiple={multiple}
      onPick={pick}
      options={multiple ? (pics ? picOptions : valueOptions) : menuOptions}
      pics={pics}
      selected={multiple ? picked : [single]}
    >
      <span className="fu-form-dd-content">
        {type === "Icon+Text" && <Icon name="text.legacy" />}
        {type === "Emoji+Text" && <span className="fu-form-emoji">🇺🇸</span>}
        {type === "Pic+Text" && <span className="fu-form-pic" />}
        {!multiple && <span className="fu-form-dd-text">{single}</span>}
        {multiple &&
          picked.slice(0, shown).map((item) =>
            pics ? (
              <span className="fu-form-pic" key={item} />
            ) : (
              <Label key={item} state={state}>
                {item}
              </Label>
            ),
          )}
        {multiple && picked.length > shown && (
          <Label pics={pics} state={state}>
            ...
          </Label>
        )}
      </span>
      {on(props["Show Chevron"]) && <Icon name="chevron.down" variant="large" />}
    </Picker>
  );
}

/* ---------- Labels ---------- */

function TipLabel({ props }: SpecimenProps) {
  return (
    <div className="fu-form-tip" data-position={props.Position}>
      {on(props["Show Icon"]) && <Placeholder />}
      <span className="fu-form-tip-text">Tip Label</span>
    </div>
  );
}

function MultiplyLabel({ props, interactive }: SpecimenProps) {
  const [removed, setRemoved] = useState(false);
  if (removed) return null;
  return (
    <span className="fu-form-mlabel" data-style={props.Style}>
      <span className="fu-form-mlabel-value">
        {on(props["Show Icon"]) && <Icon name="text.legacy" />}
        Text
      </span>
      {props.Cancelable === "True" && (
        <button
          aria-label="Remove Text"
          className="fu-form-mlabel-x"
          onClick={() => setRemoved(true)}
          tabIndex={interactive ? undefined : -1}
          type="button"
        >
          <Icon name="xmark" variant="16" />
        </button>
      )}
    </span>
  );
}

/* ---------- Checkbox, Radio, Segment ---------- */

type Checked = boolean | "mixed";

function Checkbox({ props, interactive }: SpecimenProps) {
  const initial: Checked = props.Status === "Checked" ? true : props.Status === "Indeterminate" ? "mixed" : false;
  const [checked, setChecked] = useState<Checked>(initial);
  return (
    <button
      aria-checked={checked}
      aria-label="Checkbox"
      className="fu-form-check"
      disabled={props.Disable === "true"}
      onClick={() => setChecked(checked !== true)}
      role="checkbox"
      tabIndex={interactive ? undefined : -1}
      type="button"
    />
  );
}

function Radio({ props, interactive }: SpecimenProps) {
  const [checked, setChecked] = useState(props.Status === "Checked");
  return (
    <button
      aria-checked={checked}
      aria-label="Radio button"
      className="fu-form-radio"
      disabled={props.Disable === "true"}
      onClick={() => setChecked(true)}
      role="radio"
      tabIndex={interactive ? undefined : -1}
      type="button"
    />
  );
}

function SegmentOption({ props, interactive }: SpecimenProps) {
  const [selected, setSelected] = useState(props.Select === "True");
  const icon = props.Type === "Icon";
  return (
    <button
      aria-label={icon ? "Grid" : undefined}
      aria-pressed={selected}
      className="fu-form-seg"
      data-type={props.Type}
      onClick={() => setSelected(!selected)}
      tabIndex={interactive ? undefined : -1}
      type="button"
    >
      {icon ? <Icon className="fu-form-seg-icon" name="square.4.grid" /> : "Text"}
    </button>
  );
}

/* ---------- Registration ---------- */

// Remount on prop change so local state (typed text, selection, toggles) never contradicts the chosen variant.
const keyed = (Component: (p: SpecimenProps) => ReactNode) => (p: SpecimenProps) => (
  <Component key={JSON.stringify(p.props)} {...p} />
);

const renderers: RendererMap = {
  "4728:13398": keyed(Inputbox),
  "4963:30417": keyed(({ props, interactive }) => (
    <DropdownMini chevron={on(props["Show Chevron"])} initial="Dropdown Text" interactive={interactive} type={props.Type} />
  )),
  "836:22055": keyed(Stepper),
  "5355:34616": keyed(Dropdown),
  "7623:15957": keyed(TipLabel),
  "7538:42055": keyed(MultiplyLabel),
  "6433:23544": () => (
    <div className="fu-form-desc">
      <span>Description</span>
    </div>
  ),
  "166:524": keyed(Checkbox),
  "205:150": keyed(Radio),
  "2261:133245": keyed(SegmentOption),
};

export default renderers;
