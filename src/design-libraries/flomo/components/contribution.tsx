import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FamilyModule, Props } from "../showcase";
import "./contribution.css";

/* Levels of the 12-week matrix drawn in Contribution Count=12 (6135:496329); Count=N shows its last N weeks. */
const WEEKS = [
  [2, 3, 0, 3, 2, 3, 1, 1, 2, 2, 1, 1],
  [0, 0, 0, 1, 1, 2, 2, 2, 3, 2, 2, 3],
  [1, 2, 3, 2, 3, 3, 0, 1, 1, 2, 3, 3],
  [2, 3, 2, 1, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 3, 0, 1, 2, 1, 0, 0, 0],
  [3, 0, 1, 1, 0, 3, 2, 2, 3, 0, 0, 0],
  [3, 2, 1, 0, 2, 2, 2, 0, 2, 3, 2, 0],
];
const TODAY = { row: 3, col: 11 };
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** Contribution/Cell 196:21728 */
function Cell({ size = "Regular", state = "Normal", level = 0 }: { size?: string; state?: string; level?: number }) {
  return <span className="fm-contribution-cell" data-size={size} data-state={state} style={{ "--level": `var(--fm-contribution-level-${level})` } as CSSProperties} />;
}

/** Contribution 6135:502483: 7 rows × Count columns, cells selectable when live. */
function Contribution({ count, interactive, notify }: { count: number; interactive: boolean; notify: (m: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const first = 12 - count;
  const move = (e: KeyboardEvent, row: number, col: number) => {
    const next = { ArrowUp: [row - 1, col], ArrowDown: [row + 1, col], ArrowLeft: [row, col - 1], ArrowRight: [row, col + 1] }[e.key];
    if (!next) return;
    e.preventDefault();
    const [r, c] = next;
    if (r < 0 || r > 6 || c < first || c > 11) return;
    grid.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus();
  };
  return (
    <div className="fm-contribution" ref={grid} role={interactive ? "grid" : undefined} aria-label={interactive ? `最近 ${count} 周记录` : undefined} style={{ width: count * 16 + (count - 1) * 8 }}>
      {WEEKS.map((levels, row) => (
        <div className="fm-contribution-row" key={row} role={interactive ? "row" : undefined}>
          {levels.slice(first).map((level, i) => {
            const col = first + i;
            const key = `${row}-${col}`;
            const state = selected === key ? "Selected" : row === TODAY.row && col === TODAY.col ? "Today" : "Normal";
            if (!interactive) return <Cell key={key} state={state} level={level} />;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-cell={key}
                className="fm-contribution-hit"
                tabIndex={key === (selected ?? `${TODAY.row}-${TODAY.col}`) ? 0 : -1}
                aria-selected={selected === key}
                aria-label={`第 ${col - first + 1} 周${DAYS[row]}，等级 ${level}${state === "Today" ? "，今天" : ""}`}
                onKeyDown={(e) => move(e, row, col)}
                onClick={() => {
                  setSelected(selected === key ? null : key);
                  notify(selected === key ? "已取消选择" : `已选择第 ${col - first + 1} 周${DAYS[row]}`);
                }}
              >
                <Cell state={state} level={level} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Contribution/Cell playground: click to toggle the Selected state. */
function CellSpecimen({ props, interactive, notify }: { props: Props; interactive: boolean; notify: (m: string) => void }) {
  const [picked, setPicked] = useState(false);
  const state = picked ? "Selected" : (props.State ?? "Normal");
  if (!interactive) return <Cell size={props.Size} state={state} />;
  return (
    <button
      type="button"
      className="fm-contribution-hit"
      aria-pressed={picked}
      aria-label="记录格子"
      onClick={() => {
        setPicked(!picked);
        notify(picked ? "已取消选择" : "已选择");
      }}
    >
      <Cell size={props.Size} state={state} />
    </button>
  );
}

/** Contribution/Statistics 304:45162 */
function Statistics() {
  return (
    <div className="fm-contribution-stats">
      {[
        ["888", "笔记"],
        ["144", "标签"],
        ["31", "天"],
      ].map(([n, label]) => (
        <div key={label} className="fm-contribution-count">
          <span className="fm-contribution-num">{n}</span>
          <span className="fm-contribution-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

const module: FamilyModule = {
  description: "记录热力图以格子深浅表示每天的记录量，配合统计数字展示笔记、标签与记录天数。",
  renderers: {
    "196:21728": (specimen) => <CellSpecimen {...specimen} />,
    "6135:502483": ({ props, interactive, notify }) => (
      <Contribution count={Number(props.Count ?? 8)} interactive={interactive} notify={notify} />
    ),
    "304:45162": () => <Statistics />,
  },
};

export default module;
