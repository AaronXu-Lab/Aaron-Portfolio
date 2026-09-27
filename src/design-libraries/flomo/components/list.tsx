import { useState, type CSSProperties, type ReactNode } from "react";
import type { FamilyModule, Props } from "../showcase";
import { Icon, on } from "./shared";
import "./list.css";

const icon = (name: string) => `/design-libraries/flomo/icons/${name}`;
export const ICONS = {
  placeholder: icon("dash-rectangle-16.svg"),
  chevronRight: icon("chevron-right.svg"),
  xmark: icon("xmark.svg"),
  checkboxChecked: icon("checkbox-checked.svg"),
  ellipsis: icon("ellipsis.svg"),
  pic: icon("list-pic.png"),
};

/* ---------- Atoms shared with the Menu family ---------- */

/** Chip 107:53180. Free / Pro are knock-out glyphs tinted by a text token; MAX / Navi sit on the gold gradient. */
export function Chip({ type = "Pro" }: { type?: string }) {
  if (type === "Free" || type === "Pro")
    return (
      <span className="fm-list-chip" data-type={type} role="img" aria-label={type.toUpperCase()}>
        <Icon src={icon(`chip-${type.toLowerCase()}.svg`)} style={{ width: 24, height: 16 }} />
      </span>
    );
  return (
    <span className="fm-list-chip fm-list-chip-gold" data-type={type} role="img" aria-label={type.toUpperCase()}>
      {type === "MAX" ? (
        <Icon src={icon("chip-max.svg")} style={{ width: 20.061, height: 7 }} />
      ) : (
        <>
          <Icon src={icon("chip-navi-logo.svg")} style={{ width: 12, height: 8 }} />
          <Icon src={icon("chip-navi-text.svg")} style={{ width: 20.144, height: 7 }} />
        </>
      )}
    </span>
  );
}

/** Switch (Figma 918:55714 / 918:55717), 40 × 24. Live when `onChange` is given. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
}) {
  if (!onChange) return <span className="fm-list-switch" data-on={checked} aria-hidden="true" />;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="fm-list-switch"
      data-on={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

function CheckboxGlyph({ checked }: { checked: boolean }) {
  return checked ? (
    <Icon src={ICONS.checkboxChecked} className="fm-list-check" />
  ) : (
    <span className="fm-list-check-off" aria-hidden="true" />
  );
}

/* ---------- List Item 23:56243 ---------- */

type ItemProps = {
  props: Props;
  title?: ReactNode;
  description?: string;
  accessory?: ReactNode;
  pressable?: boolean;
  onPress?: () => void;
  leading?: ReactNode;
  titleStyle?: CSSProperties;
};

export function ListItem({ props, title = "Title", description = "Description", accessory, pressable, onPress, leading, titleStyle }: ItemProps) {
  const type = props.Type ?? "Text";
  const tall = props.Height === "Tall";
  const chip = on(props["+Chip"]);
  const titleNode = (
    <span className="fm-list-title" style={titleStyle}>
      {title}
    </span>
  );
  const body = (
    <>
      {type !== "Text" && (
        <span className="fm-list-lead" data-kind={type === "Pic+Text" ? "pic" : "icon"}>
          {type === "Pic+Text" ? (
            <img className="fm-list-pic" src={ICONS.pic} alt="" width={40} height={40} />
          ) : (
            leading ?? <Icon src={ICONS.placeholder} className="fm-list-lead-icon" />
          )}
        </span>
      )}
      <span className="fm-list-contents">
        <span className="fm-list-texts">
          {chip ? (
            <span className="fm-list-chiprow">
              {titleNode}
              <Chip type="Pro" />
            </span>
          ) : (
            titleNode
          )}
          {tall && <span className="fm-list-desc">{description}</span>}
        </span>
        {accessory && <span className="fm-list-acc-slot">{accessory}</span>}
      </span>
    </>
  );
  const attrs = { "data-type": type, "data-height": tall ? "Tall" : "Regular" };
  return pressable ? (
    <button type="button" className="fm-list-item fm-list-pressable fm-press" {...attrs} onClick={onPress}>
      {body}
    </button>
  ) : (
    <div className="fm-list-item" {...attrs}>
      {body}
    </div>
  );
}

/* ---------- List/Accessories 23:58221 ---------- */

function Accessory({ type, interactive, notify }: { type: string; interactive: boolean; notify: (m: string) => void }) {
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const Area = interactive ? "button" : "span";
  const areaProps = (label: string) =>
    interactive ? { type: "button" as const, onClick: () => notify(`点击了「${label}」`) } : {};
  let content: ReactNode;
  switch (type) {
    case "Detail":
    case "Detail+Icon":
    case "Pic+Detail+Icon":
      content = (
        <Area className={`fm-list-acc-area${interactive ? " fm-list-hover fm-press" : ""}`} {...areaProps("Detail")}>
          {type === "Pic+Detail+Icon" ? (
            <span className="fm-list-acc-pic">
              <img src={ICONS.pic} alt="" width={24} height={24} />
              Detail
            </span>
          ) : (
            "Detail"
          )}
          {type !== "Detail" && <Icon src={ICONS.chevronRight} />}
        </Area>
      );
      break;
    case "Icon":
      content = (
        <span className="fm-list-acc-box">
          <Icon src={ICONS.chevronRight} />
        </span>
      );
      break;
    case "Text Button":
      content = (
        <Area className={`fm-list-textbtn${interactive ? " fm-list-hover fm-press" : ""}`} {...areaProps("Button")}>
          Button
        </Area>
      );
      break;
    case "Fill Button":
      content = (
        <Area className={`fm-list-fillbtn${interactive ? " fm-list-hover fm-press" : ""}`} {...areaProps("Text")}>
          Text
        </Area>
      );
      break;
    case "Switch":
      content = interactive ? (
        <Switch
          checked={switchOn}
          label="开关"
          onChange={(next) => {
            setSwitchOn(next);
            notify(next ? "已开启" : "已关闭");
          }}
        />
      ) : (
        <Switch checked />
      );
      break;
    case "Checkbox":
      content = interactive ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label="选择"
          className="fm-list-acc-box"
          onClick={() => {
            setChecked(!checked);
            notify(checked ? "已取消勾选" : "已勾选");
          }}
        >
          <CheckboxGlyph checked={checked} />
        </button>
      ) : (
        <span className="fm-list-acc-box">
          <CheckboxGlyph checked />
        </span>
      );
      break;
  }
  return (
    <span className="fm-list-acc" data-type={type}>
      {content}
    </span>
  );
}

/* ---------- List-Textarea 6135:525551 ---------- */

function Textarea({ props, interactive, notify }: { props: Props; interactive: boolean; notify: (m: string) => void }) {
  const [value, setValue] = useState("");
  const type = props.Type ?? "Input";
  const trailing = on(props["Show Trailing"]) && type !== "New Line Input";
  const field = (
    <textarea
      className="fm-list-field"
      rows={1}
      placeholder="Placeholder"
      aria-label={type === "Input" ? "输入内容" : "Title"}
      value={value}
      readOnly={!interactive}
      tabIndex={interactive ? undefined : -1}
      onChange={(e) => setValue(e.target.value)}
    />
  );
  return (
    <div className="fm-list-textarea" data-type={type} data-trailing={trailing}>
      <div className="fm-list-textarea-content">
        {type === "Label+Input" && <span className="fm-list-textarea-label">Title</span>}
        {type === "New Line Input" && (
          <span className="fm-list-textarea-tips">
            <span className="fm-list-textarea-label">Title</span>
            {on(props["Show Description"]) && <span className="fm-list-textarea-tip">Description</span>}
          </span>
        )}
        {field}
      </div>
      {trailing && (
        <button
          type="button"
          className="fm-list-iconbtn fm-list-hover fm-press"
          aria-label="清空"
          tabIndex={interactive ? undefined : -1}
          onClick={() => {
            setValue("");
            notify("已清空");
          }}
        >
          <Icon src={ICONS.xmark} />
        </button>
      )}
    </div>
  );
}

/* ---------- List-Section Header 317:58288 ---------- */

export function SectionHeader({
  text = "Text",
  buttons = ["Button 2", "Button 1"],
  showIcon = false,
  notify,
}: {
  text?: string;
  buttons?: string[];
  showIcon?: boolean;
  notify?: (m: string) => void;
}) {
  return (
    <div className="fm-list-header">
      <span className="fm-list-header-label">
        {showIcon && <Icon src={ICONS.placeholder} />}
        {text}
      </span>
      {buttons.length > 0 && (
        <span className="fm-list-header-buttons">
          {buttons.map((label) =>
            notify ? (
              <button key={label} type="button" className="fm-list-header-btn fm-list-hover fm-press" onClick={() => notify(`点击了「${label}」`)}>
                {label}
              </button>
            ) : (
              <span key={label} className="fm-list-header-btn">
                {label}
              </span>
            ),
          )}
        </span>
      )}
    </div>
  );
}

export const Footnote = ({ text = "Text", center }: { text?: string; center?: boolean }) => (
  <div className="fm-list-footnote" data-center={center}>
    <span>{text}</span>
  </div>
);

/* ---------- A Fake List 3617:134739 ---------- */

const CARD_TEXT =
  "小车正穿行在落基山脉蜿蜒曲折的盘山公路上。克里斯朵夫·李维静静地望着窗外，发现每当车子即将行驶到无路的关头，路边都会出现一块交通指示牌‘前方转弯’或‘注意！急转弯’。";

function FakeList({ interactive, notify }: { interactive: boolean; notify: (m: string) => void }) {
  const press = (label: string) => (interactive ? { pressable: true, onPress: () => notify(`点击了「${label}」`) } : {});
  const n = interactive ? notify : undefined;
  const regular = { Type: "Text", Height: "Regular", "+Chip": "False" };
  const row = (label: string, extra: Partial<ItemProps> = {}, props: Props = regular) => (
    <ListItem key={label} props={props} title={label} {...press(label)} {...extra} />
  );
  const accessories = ["Detail", "Detail+Icon", "Text Button", "Fill Button", "Icon", "Switch", "Checkbox"];
  return (
    <div className="fm-list-fake">
      <section className="fm-list-section">
        <SectionHeader text="Header" buttons={["Action 2", "Action 1"]} notify={n} />
        <div className="fm-list-rows">
          {row("Height: Regular")}
          {row("Height: Tall", {}, { ...regular, Height: "Tall" })}
          {row("With Chip", {}, { ...regular, "+Chip": "True" })}
          {row("With Icon", {}, { ...regular, Type: "Icon+Text" })}
        </div>
        <Footnote text="Footnote" />
      </section>
      <section className="fm-list-section">
        <div className="fm-list-rows">
          {row("No Header&Footnote List 1")}
          {row("No Header&Footnote List 2")}
        </div>
      </section>
      <section className="fm-list-section">
        <div className="fm-list-rows">
          {row("No Header List 1")}
          {row("No Header List 2")}
        </div>
        <Footnote text="Footnote" />
      </section>
      <section className="fm-list-section">
        <SectionHeader text="Header" buttons={[]} />
        <div className="fm-list-rows">
          {row("No Footnote List 1")}
          {row("No Footnote List 2")}
        </div>
      </section>
      <section className="fm-list-section">
        <SectionHeader text="Cards" buttons={[]} />
        <div className="fm-list-cards">
          {[0, 1].map((i) => (
            <article key={i} className="fm-list-card">
              <header className="fm-list-card-top">
                <span>2038-01-19 03:14:07</span>
                {interactive ? (
                  <button type="button" className="fm-list-iconbtn fm-list-hover fm-press" aria-label="更多" onClick={() => notify("点击了「更多」")}>
                    <Icon src={ICONS.ellipsis} />
                  </button>
                ) : (
                  <span className="fm-list-iconbtn">
                    <Icon src={ICONS.ellipsis} />
                  </span>
                )}
              </header>
              <div className="fm-list-card-text">{CARD_TEXT}</div>
            </article>
          ))}
        </div>
      </section>
      <section className="fm-list-section">
        <SectionHeader text="Accessories" buttons={[]} />
        <div className="fm-list-rows">
          {accessories.map((type) => (
            <ListItem
              key={type}
              props={regular}
              title={type}
              accessory={<Accessory type={type} interactive={interactive} notify={notify} />}
            />
          ))}
        </div>
      </section>
      <section className="fm-list-section">
        <SectionHeader text="List Actions" buttons={[]} />
        <div className="fm-list-rows">
          {row("Regular Action")}
          {row("Primary Action", { titleStyle: { color: "var(--fm-general-blue-primary)" } })}
          {row("Desctructive", { titleStyle: { color: "var(--fm-destructive)" } })}
        </div>
      </section>
      <Footnote text="Whole List‘s Footnote" center />
    </div>
  );
}

const module: FamilyModule = {
  description: "列表由分组标题、列表项、附属控件与脚注组成，用于设置页和信息分组。",
  // Show Accessories / Show Description / Show Icon / Show Buttons are Figma boolean properties, not variant names.
  axes: {
    "23:56243": [
      { name: "Type", values: ["Text", "Icon+Text", "Pic+Text"] },
      { name: "Height", values: ["Regular", "Tall"] },
      { name: "+Chip", values: ["False", "True"] },
      { name: "Show Accessories", values: ["False", "True"] },
    ],
    "6135:525551": [
      { name: "Type", values: ["Input", "Label+Input", "New Line Input"] },
      { name: "Show Trailing", values: ["False", "True"] },
      { name: "Show Description", values: ["False", "True"] },
    ],
    "317:58288": [
      { name: "Show Icon", values: ["False", "True"] },
      { name: "Show Buttons", values: ["False", "True"] },
    ],
  },
  defaults: {
    "23:56243": { Type: "Text", Height: "Regular", "+Chip": "False", "Show Accessories": "False" },
    "6135:525551": { Type: "Input", "Show Trailing": "False", "Show Description": "False" },
    "317:58288": { "Show Icon": "False", "Show Buttons": "True" },
  },
  requires: {
    "6135:525551": {
      "Show Trailing": { when: (p) => p.Type !== "New Line Input", hint: "Type=New Line Input 时不生效。" },
      "Show Description": { when: (p) => p.Type === "New Line Input", hint: "仅在 Type=New Line Input 时生效。" },
    },
  },
  renderers: {
    "23:56243": ({ props, interactive, notify }) => (
      <ListItem
        props={props}
        pressable={interactive}
        onPress={() => notify("点击了列表项")}
        accessory={on(props["Show Accessories"]) ? <Accessory type="Icon" interactive={false} notify={notify} /> : undefined}
      />
    ),
    "23:58221": ({ props, interactive, notify }) => (
      <Accessory type={props.Type ?? "Detail"} interactive={interactive} notify={notify} />
    ),
    "6135:525551": (specimen) => <Textarea {...specimen} />,
    "317:58288": ({ props, interactive, notify }) => (
      <SectionHeader showIcon={on(props["Show Icon"])} buttons={props["Show Buttons"] === "False" ? [] : undefined} notify={interactive ? notify : undefined} />
    ),
    "2302:71907": () => <Footnote />,
    "3617:123400": () => (
      <span className="fm-list-scrollbar" aria-hidden="true">
        <span />
      </span>
    ),
    "1554:43477": ({ interactive, notify }) => {
      const inner = (
        <>
          <Icon src={ICONS.placeholder} size={24} />
          <span>Text</span>
        </>
      );
      return interactive ? (
        <button type="button" className="fm-list-topaction fm-list-hover fm-press" onClick={() => notify("点击了「Text」")}>
          {inner}
        </button>
      ) : (
        <span className="fm-list-topaction">{inner}</span>
      );
    },
    "107:53180": ({ props }) => <Chip type={props.Type} />,
    "3617:134739": (specimen) => <FakeList {...specimen} />,
  },
};

export default module;
