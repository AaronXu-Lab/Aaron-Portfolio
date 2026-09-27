import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { RendererMap } from "./registry";
import { Icon, on } from "./shared";
import "./scenary.css";

// Scenary page: Fragment / Display Panel and the "Almost there" calendar family.
// Live state resets through `key` whenever the playground props change.

type DayState = "Normal" | "Selected" | "Disable" | "Today";
type Cell = { text: string; state: DayState; key?: string };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ymd = (y: number, m: number, d: number) => `${y}-${m + 1}-${d}`;

/** Sunday-first month grid: trailing days of the previous month, the month, leading days of the next. */
function monthCells(year: number, month: number, selected: string | null, today: string | null): Cell[] {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = lead; i > 0; i--) cells.push({ text: String(prevDays - i + 1), state: "Disable" });
  for (let d = 1; d <= days; d++) {
    const key = ymd(year, month, d);
    cells.push({ text: String(d), key, state: key === selected ? "Selected" : key === today ? "Today" : "Normal" });
  }
  for (let d = 1; cells.length % 7; d++) cells.push({ text: String(d), state: "Disable" });
  return cells;
}

/* ---------- Passby / Day / Month ---------- */

function Passby({ type }: { type: string }) {
  return (
    <span className="fu-scen-passby">
      <span className="fu-scen-passby-bar" data-type={type} />
    </span>
  );
}

function Day({
  text,
  state,
  mini = false,
  passby = false,
  header = false,
  label,
  onPick,
}: {
  text: string;
  state: DayState;
  mini?: boolean;
  passby?: boolean;
  header?: boolean;
  label?: string;
  onPick?: () => void;
}) {
  const body = (
    <>
      {passby && state !== "Disable" && <span className="fu-scen-day-passby" />}
      <span className="fu-scen-day-text">{text}</span>
    </>
  );
  const common = {
    className: `fu-scen-day${header ? " is-header" : ""}`,
    "data-state": state,
    "data-mini": mini || undefined,
  };
  if (!onPick) return <span {...common}>{body}</span>;
  return (
    <button
      {...common}
      aria-current={state === "Today" ? "date" : undefined}
      aria-label={label}
      aria-pressed={state === "Selected"}
      disabled={state === "Disable"}
      onClick={onPick}
      type="button"
    >
      {body}
    </button>
  );
}

function Month({
  text,
  state,
  passby = false,
  onPick,
}: {
  text: string;
  state: DayState;
  passby?: boolean;
  onPick?: () => void;
}) {
  const body = (
    <>
      {passby && state !== "Disable" && <span className="fu-scen-month-passby" />}
      <span className="fu-scen-month-text">{text}</span>
    </>
  );
  if (!onPick)
    return (
      <span className="fu-scen-month" data-state={state}>
        {body}
      </span>
    );
  return (
    <button
      aria-current={state === "Today" ? "date" : undefined}
      aria-pressed={state === "Selected"}
      className="fu-scen-month"
      data-state={state}
      disabled={state === "Disable"}
      onClick={onPick}
      type="button"
    >
      {body}
    </button>
  );
}

/* ---------- Grid pickers ---------- */

function DaysGrid({
  cells,
  onPick,
  monthLabel,
}: {
  cells: Cell[];
  onPick?: (key: string) => void;
  monthLabel?: string;
}) {
  const mini = cells.length > 35;
  return (
    <div className="fu-scen-grid" role={onPick ? "group" : undefined} aria-label={monthLabel}>
      <div className="fu-scen-grid-head" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <Day header key={day} state="Normal" text={day} />
        ))}
      </div>
      <div className="fu-scen-grid-days" data-mini={mini || undefined}>
        {cells.map((cell, index) => (
          <Day
            key={index}
            label={cell.key && monthLabel ? `${cell.text} ${monthLabel}` : undefined}
            mini={mini}
            onPick={onPick && cell.key ? () => onPick(cell.key!) : undefined}
            state={cell.state}
            text={cell.text}
          />
        ))}
      </div>
    </div>
  );
}

// Grid Picker/Days variants are real months: 5 Lines = May 2024, 4 Lines = Feb 2026, 6 Lines = Aug 2025.
const GRID_MONTHS: Record<string, [number, number]> = {
  "5 Lines": [2024, 4],
  "4 Lines": [2026, 1],
  "6 Lines": [2025, 7],
};

function GridPickerDays({ lines, interactive }: { lines: string; interactive: boolean }) {
  const [year, month] = GRID_MONTHS[lines] ?? GRID_MONTHS["5 Lines"];
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <DaysGrid
      cells={monthCells(year, month, selected, null)}
      monthLabel={interactive ? `${MONTH_NAMES[month]} ${year}` : undefined}
      onPick={interactive ? setSelected : undefined}
    />
  );
}

/* ---------- Calendar ---------- */

function PlainButton({ label, children, onClick, className = "" }: {
  label?: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button aria-label={label} className={`fu-scen-btn ${className}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function Calendar({ type, interactive }: { type: string; interactive: boolean }) {
  // Static render reproduces Figma (May 2024, 15th selected); live render starts at today.
  const now = new Date();
  const today = interactive ? ymd(now.getFullYear(), now.getMonth(), now.getDate()) : null;
  const [view, setView] = useState(type === "Day" ? "day" : "year");
  const [cursor, setCursor] = useState(() =>
    interactive ? { y: now.getFullYear(), m: now.getMonth() } : { y: 2024, m: 4 },
  );
  const [selected, setSelected] = useState<string | null>(interactive ? null : ymd(2024, 4, 15));
  const isDay = view === "day";
  const [sy, sm] = selected ? selected.split("-").map(Number) : [NaN, NaN];

  const step = (delta: number) =>
    setCursor(({ y, m }) => (isDay ? { y: y + Math.floor((m + delta) / 12), m: (m + delta + 12) % 12 } : { y: y + delta, m }));

  return (
    <div className="fu-scen-cal">
      <div className="fu-scen-cal-body">
        <div className="fu-scen-cal-head">
          <button
            aria-label={isDay ? "Choose month" : "Choose day"}
            className="fu-scen-cal-title"
            onClick={() => setView(isDay ? "year" : "day")}
            type="button"
          >
            <span className="fu-scen-cal-title-content">
              <span className="fu-scen-cal-title-text">{isDay ? `${MONTHS[cursor.m]} ${cursor.y}` : cursor.y}</span>
            </span>
          </button>
          <div className="fu-scen-cal-actions">
            <PlainButton className="is-icon" label={isDay ? "Previous month" : "Previous year"} onClick={() => step(-1)}>
              <Icon name="chevron.left" size={16} variant="medium" />
            </PlainButton>
            <PlainButton className="is-icon" label={isDay ? "Next month" : "Next year"} onClick={() => step(1)}>
              <Icon name="chevron.right" size={16} variant="medium" />
            </PlainButton>
            <PlainButton
              className={`is-text${isDay ? "" : " is-secondary"}`}
              onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}
            >
              Today
            </PlainButton>
          </div>
        </div>
        <span className="fu-scen-divider" />
        {isDay ? (
          <DaysGrid
            cells={monthCells(cursor.y, cursor.m, selected, today)}
            monthLabel={interactive ? `${MONTH_NAMES[cursor.m]} ${cursor.y}` : undefined}
            onPick={interactive ? setSelected : undefined}
          />
        ) : (
          <div className="fu-scen-months">
            {MONTHS.map((name, m) => (
              <Month
                key={name}
                onPick={
                  interactive
                    ? () => {
                        setCursor({ y: cursor.y, m });
                        setView("day");
                      }
                    : undefined
                }
                state={
                  cursor.y === sy && m === sm - 1
                    ? "Selected"
                    : interactive && cursor.y === now.getFullYear() && m === now.getMonth()
                      ? "Today"
                      : "Normal"
                }
                text={name}
              />
            ))}
          </div>
        )}
      </div>
      <div className="fu-scen-cal-foot">
        <PlainButton className="is-text has-icon" onClick={() => setSelected(null)}>
          <Icon name="trash" size={16} variant="16" />
          Clear
        </PlainButton>
        <PlainButton className="is-text is-light">Done</PlainButton>
      </div>
    </div>
  );
}

/* ---------- Pic ---------- */

function Pic({ size, placeholder }: { size: string; placeholder: boolean }) {
  const px = size === "20" ? 20 : 24;
  return (
    <span className="fu-scen-pic" data-placeholder={placeholder || undefined} data-size={px}>
      {placeholder ? (
        <Icon name="square.dash.people" size={px - 4} variant={String(px - 4)} />
      ) : (
        <img alt="" className="fu-scen-pic-img" height={px} src="/design-libraries/followup/assets/pic.placeholder.png" width={px} />
      )}
    </span>
  );
}

/* ---------- Navigation Bar/Panel ---------- */

function NavigationPanel({ type, showCount }: { type: string; showCount: boolean }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="fu-scen-nav">
      {type === "Tabs" ? (
        <div className="fu-scen-nav-tabs" role="tablist">
          {["Tab 1", "Tab 2"].map((label, index) => (
            <button
              aria-selected={tab === index}
              className="fu-scen-nav-tab"
              key={label}
              onClick={() => setTab(index)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="fu-scen-nav-title">
          <span>Title</span>
          {showCount && <span className="fu-scen-nav-count">99+</span>}
        </div>
      )}
      <div className="fu-scen-nav-actions">
        <PlainButton className="is-icon" label="More">
          <Icon name="dot.3" size={16} variant="16" />
        </PlainButton>
        <PlainButton className="is-icon" label="Add">
          <Icon name="plus" size={16} variant="16" />
        </PlainButton>
      </div>
    </div>
  );
}

/* ---------- Segement ---------- */

function Segement({ width, count, selection, interactive }: {
  width: string;
  count: number;
  selection: number;
  interactive: boolean;
}) {
  const [picked, setPicked] = useState(selection);
  return (
    <div className="fu-scen-seg" data-fill={width === "Fill" || undefined} role="group">
      {Array.from({ length: count }, (_, index) => (
        <button
          aria-pressed={picked === index + 1}
          className="fu-scen-seg-opt"
          key={index}
          onClick={interactive ? () => setPicked(index + 1) : undefined}
          type="button"
        >
          Seg {index + 1}
        </button>
      ))}
    </div>
  );
}

/* ---------- Display Panel ---------- */

type Option = { label: string; icon?: string; secondary?: boolean };
const HAND: Option = { label: "Manual", icon: "hand.forefinger" };
const NULL: Option = { label: "Null", icon: "null" };
const STATUS = (n: number): Option => ({ label: `Status ${n}`, icon: "circle.half.fill", secondary: true });

// Figma draws only the current value of each dropdown; the siblings keep the same vocabulary.
const FIELDS: Record<string, Option[]> = {
  "Line height": [{ label: "Small" }, { label: "Medium" }, { label: "Large" }],
  "Group by": [HAND, NULL, STATUS(3)],
  "Sort by": [HAND, NULL],
  "Show columns": [{ label: "All" }, { label: "None" }],
  "Kanban by": [STATUS(1), STATUS(2), STATUS(3)],
  "Divide by": [NULL, STATUS(3)],
};
// [field, index of the value Figma shows]
type Row = [string, number];
const LAYOUT_ROWS: Record<string, { visual: Row[]; data: Row[] }> = {
  List: { visual: [["Line height", 1]], data: [["Group by", 0], ["Sort by", 0], ["Show columns", 0]] },
  Kanban: { visual: [], data: [["Kanban by", 2], ["Divide by", 0], ["Sort by", 0], ["Show columns", 1]] },
};

function OptionIcon({ option }: { option: Option }) {
  if (!option.icon) return null;
  return <Icon className={option.secondary ? "is-secondary" : ""} name={option.icon} size={16} />;
}

function TailContent({ option }: { option: Option }) {
  return (
    <>
      <OptionIcon option={option} />
      <span className="fu-scen-dp-value">{option.label}</span>
      <Icon className="is-secondary" name="chevron.down" size={16} variant="medium" />
    </>
  );
}

function Dropdown({ field, value }: { field: string; value: number }) {
  const options = FIELDS[field];
  const [current, setCurrent] = useState(value);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const node = menu.current;
    if (!node) return;
    // The menu lives in the top layer (popover="auto": light dismiss + Esc), under the trigger, right-aligned.
    const place = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open" || !trigger.current) return;
      const box = trigger.current.getBoundingClientRect();
      node.style.top = `${box.bottom + 4}px`;
      node.style.left = `${Math.max(8, box.right - node.offsetWidth)}px`;
      node.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus();
    };
    node.addEventListener("toggle", place);
    return () => node.removeEventListener("toggle", place);
  }, []);

  return (
    <>
      <button aria-haspopup="menu" className="fu-scen-dp-tail" popoverTarget={id} ref={trigger} type="button">
        <TailContent option={options[current]} />
      </button>
      <div
        className="fu-scen-menu"
        id={id}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
          const next = items.indexOf(document.activeElement as HTMLButtonElement) + (event.key === "ArrowDown" ? 1 : -1);
          items[(next + items.length) % items.length]?.focus();
        }}
        popover="auto"
        ref={menu}
        role="menu"
      >
        {options.map((option, index) => (
          <button
            aria-checked={index === current}
            className="fu-scen-menu-item"
            key={option.label}
            onClick={() => {
              setCurrent(index);
              menu.current?.hidePopover();
              trigger.current?.focus();
            }}
            role="menuitemradio"
            type="button"
          >
            <OptionIcon option={option} />
            <span className="fu-scen-menu-text">{option.label}</span>
            {index === current && <Icon name="checkmark" size={16} variant="16" />}
          </button>
        ))}
      </div>
    </>
  );
}

function DisplayPanel({ layout: initial, interactive }: { layout: string; interactive: boolean }) {
  const [layout, setLayout] = useState(initial);
  const rows = LAYOUT_ROWS[layout] ?? LAYOUT_ROWS.List;
  const row = ([field, value]: Row) => (
    <div className="fu-scen-dp-row" key={`${layout}-${field}`}>
      <span className="fu-scen-dp-label">{field}</span>
      {interactive ? (
        <Dropdown field={field} value={value} />
      ) : (
        <span className="fu-scen-dp-tail">
          <TailContent option={FIELDS[field][value]} />
        </span>
      )}
    </div>
  );
  return (
    <div className="fu-scen-dp">
      <div className="fu-scen-dp-group">
        <div className="fu-scen-dp-title">Visual style</div>
        <div className="fu-scen-dp-layout">
          <div className="fu-scen-dp-seg" role="group" aria-label="Layout">
            {[
              ["List", "dot.line.3.vertical"],
              ["Kanban", "kanban"],
            ].map(([name, icon]) => (
              <button
                aria-pressed={layout === name}
                className="fu-scen-dp-seg-opt"
                key={name}
                onClick={interactive ? () => setLayout(name) : undefined}
                type="button"
              >
                <Icon name={icon} size={16} />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
        {rows.visual.map(row)}
      </div>
      <span className="fu-scen-divider" />
      <div className="fu-scen-dp-group">
        <div className="fu-scen-dp-title">Data</div>
        {rows.data.map(row)}
      </div>
    </div>
  );
}

/* ---------- Registry ---------- */

const scenary: RendererMap = {
  "8622:41392": ({ props, interactive }) => <DisplayPanel interactive={interactive} key={props.Layout} layout={props.Layout ?? "List"} />,
  "7549:42741": ({ props, interactive }) => {
    const state = (props.State ?? "Normal") as DayState;
    return <DayLive interactive={interactive} key={state} mini={props.Size === "Mini"} passby={on(props["Show Passby"])} state={state} />;
  },
  "7549:42766": ({ props, interactive }) => (
    <MonthLive interactive={interactive} key={props.State} passby={on(props["Show Passby"])} state={(props.State ?? "Normal") as DayState} />
  ),
  "7549:42779": ({ props, interactive }) => (
    <GridPickerDays interactive={interactive} key={props["Line Number"]} lines={props["Line Number"] ?? "5 Lines"} />
  ),
  "7549:42915": ({ props }) => <Passby type={props.Type ?? "Full"} />,
  "7549:45060": ({ props, interactive }) => (
    <Calendar interactive={interactive} key={props.Type} type={props.Type ?? "Day"} />
  ),
  "4728:119233": ({ props }) => <Pic placeholder={props.PlaceHolder === "true"} size={props.Size ?? "24"} />,
  "4745:24704": ({ props }) => <NavigationPanel showCount={on(props["Show Count"])} type={props.Type ?? "Tabs"} />,
  "9268:22821": ({ props, interactive }) => (
    <Segement
      count={Number(props.Count ?? 2)}
      interactive={interactive}
      key={`${props.Count}-${props.Selection}`}
      selection={Number(props.Selection ?? 1)}
      width={props.Width ?? "Fill"}
    />
  ),
};

/** Day playground: a Normal day toggles to Selected on click; other states render as drawn. */
function DayLive({ state, mini, passby, interactive }: { state: DayState; mini: boolean; passby: boolean; interactive: boolean }) {
  const [picked, setPicked] = useState(false);
  const live = interactive && (state === "Normal" || state === "Today");
  return (
    <Day
      mini={mini}
      onPick={live ? () => setPicked(!picked) : undefined}
      passby={passby}
      state={picked ? "Selected" : state}
      text="1"
    />
  );
}

function MonthLive({ state, passby, interactive }: { state: DayState; passby: boolean; interactive: boolean }) {
  const [picked, setPicked] = useState(false);
  const live = interactive && (state === "Normal" || state === "Today");
  return (
    <Month onPick={live ? () => setPicked(!picked) : undefined} passby={passby} state={picked ? "Selected" : state} text="May" />
  );
}

export default scenary;
