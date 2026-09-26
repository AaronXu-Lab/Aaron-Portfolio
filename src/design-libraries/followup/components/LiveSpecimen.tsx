import { useMemo, useState } from "react";
import type {
  ComponentSetRecord,
  FigmaComponent,
} from "../data/catalog";

type LiveSpecimenProps = {
  componentSet?: ComponentSetRecord | null;
  component?: FigmaComponent | null;
  compact?: boolean;
};

function property(
  component: FigmaComponent | null | undefined,
  name: string,
  fallback = "",
): string {
  return component?.variantProperties?.[name] ?? fallback;
}

function contains(value: string, query: string): boolean {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function MiniIcon({ glyph = "＋" }: { glyph?: string }) {
  return (
    <span aria-hidden="true" className="mini-icon">
      {glyph}
    </span>
  );
}

function InputSpecimen({
  component,
}: {
  component?: FigmaComponent | null;
}) {
  const [value, setValue] = useState("");
  const state = property(component, "State", "Normal");
  const type = property(component, "Type", "Text");
  const disabled = contains(state, "disable");
  return (
    <label className={`fu-input ${state.toLowerCase()}`}>
      {contains(type, "icon") && <MiniIcon glyph="⌕" />}
      {contains(type, "label") && <span className="fu-input-label">Label</span>}
      <input
        aria-label="Inputbox specimen"
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Input text"
        value={value}
      />
      {value && (
        <button
          aria-label="Clear input"
          className="icon-button"
          onClick={() => setValue("")}
          type="button"
        >
          ×
        </button>
      )}
    </label>
  );
}

function DropdownSpecimen({
  component,
}: {
  component?: FigmaComponent | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dropdown-specimen">
      <button
        aria-expanded={open}
        className="fu-dropdown-control"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>{property(component, "Type", "Select")}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="fu-menu-popover">
          {["Newest first", "Recently edited", "Alphabetical"].map(
            (option, index) => (
              <button className={index === 0 ? "active" : ""} key={option}>
                {option}
                {index === 0 && <span>✓</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxSpecimen({
  component,
  radio = false,
}: {
  component?: FigmaComponent | null;
  radio?: boolean;
}) {
  const status = property(component, "Status", "Selected");
  const [checked, setChecked] = useState(
    contains(status, "select") || contains(status, "check"),
  );
  const disabled = contains(property(component, "Disable"), "true");
  return (
    <label className="selection-specimen">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => setChecked(event.target.checked)}
        type={radio ? "radio" : "checkbox"}
      />
      <span className={radio ? "custom-radio" : "custom-checkbox"}>
        {checked && !radio && "✓"}
      </span>
      <span>{radio ? "Radio option" : "Checkbox label"}</span>
    </label>
  );
}

function NotificationSpecimen({
  toast = false,
}: {
  toast?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return (
      <button className="fu-button light" onClick={() => setVisible(true)}>
        Show again
      </button>
    );
  }
  return (
    <div className={toast ? "fu-toast" : "fu-notification"}>
      <span className="status-orb">i</span>
      <div>
        <strong>{toast ? "Changes saved" : "A new update is available"}</strong>
        {!toast && <p>Refresh the page when you are ready to continue.</p>}
      </div>
      <button
        aria-label="Dismiss"
        className="icon-button"
        onClick={() => setVisible(false)}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function ButtonSpecimen({
  component,
  huge = false,
}: {
  component?: FigmaComponent | null;
  huge?: boolean;
}) {
  const style = property(component, "Style", "Filled");
  const size = property(component, "Size", huge ? "Huge" : "Regular");
  const state = property(component, "State", "Normal");
  const type = property(component, "Type", "Text");
  const className = [
    "fu-button",
    contains(style, "light") ? "light" : "",
    contains(style, "outline") ? "outline" : "",
    contains(style, "text") ? "plain" : "",
    contains(size, "small") ? "small" : "",
    contains(size, "huge") || huge ? "huge" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const iconOnly = contains(type, "icon") && !contains(type, "text");
  return (
    <button
      className={className}
      disabled={contains(state, "disable")}
      type="button"
    >
      {(contains(type, "icon") || contains(type, "prefix")) && (
        <MiniIcon glyph="＋" />
      )}
      {!iconOnly && <span>Button</span>}
    </button>
  );
}

function MenuSpecimen({ header = false }: { header?: boolean }) {
  const [active, setActive] = useState(0);
  if (header) {
    return (
      <div className="fu-menu-header">
        <span>Workspace</span>
        <button className="icon-button">•••</button>
      </div>
    );
  }
  return (
    <div className="fu-menu">
      {["Overview", "Activity", "Settings"].map((item, index) => (
        <button
          className={active === index ? "active" : ""}
          key={item}
          onClick={() => setActive(index)}
          type="button"
        >
          <MiniIcon glyph={["◇", "◌", "⚙"][index]} />
          <span>{item}</span>
          {index === 1 && <span className="badge">4</span>}
        </button>
      ))}
    </div>
  );
}

function NameCardSpecimen({
  component,
}: {
  component?: FigmaComponent | null;
}) {
  const status = property(component, "Status", "Online");
  return (
    <div className="fu-name-card">
      <span className="avatar">AW</span>
      <div>
        <strong>Avery Wilson</strong>
        <span>{status}</span>
      </div>
      <button className="icon-button">•••</button>
    </div>
  );
}

function DialogSpecimen() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button className="fu-button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
    );
  }
  return (
    <div className="dialog-stage">
      <div className="fu-dialog">
        <span className="dialog-glyph">◇</span>
        <div>
          <h4>Confirm this action?</h4>
          <p>This change will be applied to the selected items.</p>
        </div>
        <div className="dialog-actions">
          <button className="fu-button light" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="fu-button" onClick={() => setOpen(false)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function SwitchSpecimen({
  component,
}: {
  component?: FigmaComponent | null;
}) {
  const initial = !contains(property(component, "isOn", "True"), "false");
  const [on, setOn] = useState(initial);
  return (
    <label className="switch-row">
      <span>Feature setting</span>
      <input
        checked={on}
        onChange={(event) => setOn(event.target.checked)}
        type="checkbox"
      />
      <span className="fu-switch" />
    </label>
  );
}

function ListSpecimen({
  component,
}: {
  component?: FigmaComponent | null;
}) {
  const type = property(component, "Type", "Text");
  return (
    <div className="fu-list-item">
      {contains(type, "avatar") && <span className="avatar small">AW</span>}
      {contains(type, "icon") && <MiniIcon glyph="◇" />}
      <div>
        <strong>List item title</strong>
        <span>Supporting text</span>
      </div>
      {contains(type, "switch") ? (
        <span className="fu-switch static" />
      ) : (
        <span className="list-tail">⌄</span>
      )}
    </div>
  );
}

function SegmentSpecimen() {
  const [active, setActive] = useState(0);
  return (
    <div className="fu-segment">
      {["Overview", "Activity", "Details"].map((label, index) => (
        <button
          className={active === index ? "active" : ""}
          key={label}
          onClick={() => setActive(index)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LeftPanelSpecimen() {
  const [active, setActive] = useState("Library");
  return (
    <div className="left-panel-specimen">
      {["Home", "Library", "Shared"].map((label) => (
        <button
          className={active === label ? "active" : ""}
          key={label}
          onClick={() => setActive(label)}
        >
          <MiniIcon glyph={label === "Home" ? "⌂" : "◇"} />
          <span>{label}</span>
          {label === "Library" && <span className="badge">8</span>}
        </button>
      ))}
    </div>
  );
}

function FileSpecimen({
  simple = false,
}: {
  simple?: boolean;
}) {
  return (
    <div className={`file-specimen ${simple ? "simple" : ""}`}>
      <span className="file-glyph">PDF</span>
      <div>
        <strong>Quarterly report.pdf</strong>
        <span>2.8 MB · Updated just now</span>
      </div>
      <button className="icon-button">•••</button>
    </div>
  );
}

function UploaderSpecimen() {
  const [uploaded, setUploaded] = useState(false);
  return (
    <button
      className={`uploader-specimen ${uploaded ? "done" : ""}`}
      onClick={() => setUploaded((value) => !value)}
      type="button"
    >
      <span>{uploaded ? "✓" : "↑"}</span>
      <strong>{uploaded ? "Uploaded" : "Upload image"}</strong>
      <small>{uploaded ? "image.png · 1.2 MB" : "PNG or JPG up to 10 MB"}</small>
    </button>
  );
}

function HeaderSpecimen({ pageTitle = false }: { pageTitle?: boolean }) {
  return (
    <div className={pageTitle ? "page-title-specimen" : "header-specimen"}>
      <div>
        <small>{pageTitle ? "Workspace / Library" : "PROJECT"}</small>
        <strong>{pageTitle ? "Design Library" : "Recent files"}</strong>
      </div>
      <div className="header-actions">
        <button className="fu-button light">Share</button>
        <button className="fu-button">Create</button>
      </div>
    </div>
  );
}

function TableSpecimen({ header = false }: { header?: boolean }) {
  return (
    <div className={`table-specimen ${header ? "header" : ""}`}>
      <span className="custom-checkbox" />
      <div>
        <strong>{header ? "Name" : "Followup Design Library"}</strong>
        {!header && <span>Edited 3 minutes ago</span>}
      </div>
      <span className="table-meta">{header ? "↕" : "Owner · AW"}</span>
    </div>
  );
}

function ToolTipSpecimen() {
  return (
    <div className="tooltip-stage">
      <button className="icon-button tooltip-anchor">?</button>
      <span className="fu-tooltip">Helpful information appears here.</span>
    </div>
  );
}

function PanelSpecimen() {
  return (
    <div className="panel-specimen">
      <div className="panel-header">
        <strong>Panel title</strong>
        <button className="icon-button">×</button>
      </div>
      <p>Panel content follows the same spacing and surface tokens.</p>
      <div className="panel-actions">
        <button className="fu-button light">Cancel</button>
        <button className="fu-button">Done</button>
      </div>
    </div>
  );
}

function GenericSpecimen({
  name,
  component,
}: {
  name: string;
  component?: FigmaComponent | null;
}) {
  const values = useMemo(
    () => Object.values(component?.variantProperties ?? {}).slice(0, 2),
    [component],
  );
  return (
    <div className="generic-specimen">
      <span className="generic-glyph">◇</span>
      <div>
        <strong>{name}</strong>
        <span>{values.join(" · ") || "Default state"}</span>
      </div>
      <button className="icon-button">•••</button>
    </div>
  );
}

export function LiveSpecimen({
  componentSet,
  component,
  compact = false,
}: LiveSpecimenProps) {
  const name = componentSet?.name ?? component?.componentSet?.name ?? component?.name ?? "Component";
  const normalized = name.toLocaleLowerCase();
  let specimen;

  if (contains(normalized, "input")) {
    specimen = <InputSpecimen component={component} />;
  } else if (contains(normalized, "dropdown")) {
    specimen = <DropdownSpecimen component={component} />;
  } else if (contains(normalized, "checkbox")) {
    specimen = <CheckboxSpecimen component={component} />;
  } else if (contains(normalized, "radio")) {
    specimen = <CheckboxSpecimen component={component} radio />;
  } else if (contains(normalized, "notification")) {
    specimen = <NotificationSpecimen />;
  } else if (contains(normalized, "toast")) {
    specimen = <NotificationSpecimen toast />;
  } else if (contains(normalized, "button")) {
    specimen = (
      <ButtonSpecimen
        component={component}
        huge={contains(normalized, "huge")}
      />
    );
  } else if (contains(normalized, "menu header")) {
    specimen = <MenuSpecimen header />;
  } else if (contains(normalized, "menu")) {
    specimen = <MenuSpecimen />;
  } else if (contains(normalized, "name card")) {
    specimen = <NameCardSpecimen component={component} />;
  } else if (contains(normalized, "dialog")) {
    specimen = <DialogSpecimen />;
  } else if (contains(normalized, "switch")) {
    specimen = <SwitchSpecimen component={component} />;
  } else if (
    contains(normalized, "list item") ||
    normalized === "_list" ||
    contains(normalized, "platte")
  ) {
    specimen = <ListSpecimen component={component} />;
  } else if (contains(normalized, "segment") || contains(normalized, "_tab")) {
    specimen = <SegmentSpecimen />;
  } else if (contains(normalized, "left panel")) {
    specimen = <LeftPanelSpecimen />;
  } else if (contains(normalized, "file item")) {
    specimen = <FileSpecimen simple={contains(normalized, "simple")} />;
  } else if (contains(normalized, "uploader")) {
    specimen = <UploaderSpecimen />;
  } else if (contains(normalized, "page title")) {
    specimen = <HeaderSpecimen pageTitle />;
  } else if (contains(normalized, "header bar")) {
    specimen = <HeaderSpecimen />;
  } else if (contains(normalized, "table header")) {
    specimen = <TableSpecimen header />;
  } else if (
    contains(normalized, "table cell") ||
    contains(normalized, "table main")
  ) {
    specimen = <TableSpecimen />;
  } else if (contains(normalized, "tool tip")) {
    specimen = <ToolTipSpecimen />;
  } else if (contains(normalized, "panel")) {
    specimen = <PanelSpecimen />;
  } else {
    specimen = (
      <GenericSpecimen component={component} name={componentSet?.name ?? name} />
    );
  }

  return (
    <div className={`live-specimen ${compact ? "compact" : ""}`}>
      {specimen}
    </div>
  );
}
