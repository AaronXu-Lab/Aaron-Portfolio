import { useState, type ReactNode } from "react";
import type { FamilyModule } from "../showcase";
import { Icon, on } from "./shared";
import { ICONS } from "./list";
import "./message.css";

/** Playground wrapper: a dismissed message can be brought back. */
function Dismissible({ interactive, children }: { interactive: boolean; children: (close?: () => void) => ReactNode }) {
  const [open, setOpen] = useState(true);
  if (open) return <>{children(interactive ? () => setOpen(false) : undefined)}</>;
  return (
    <button type="button" className="fm-message-restore" onClick={() => setOpen(true)}>
      恢复消息
    </button>
  );
}

function CloseButton({ label, onClose }: { label: string; onClose?: () => void }) {
  return onClose ? (
    <button type="button" className="fm-message-close fm-press" aria-label={label} onClick={onClose}>
      <Icon src={ICONS.xmark} />
    </button>
  ) : (
    <span className="fm-message-close">
      <Icon src={ICONS.xmark} />
    </span>
  );
}

/** Message 65:19287 */
function Message({ type, badge, cancelable, onClose }: { type: string; badge: boolean; cancelable: boolean; onClose?: () => void }) {
  return (
    <div className="fm-message" data-type={type} data-badge={badge} data-cancelable={cancelable}>
      <span className="fm-message-text">Text</span>
      {badge && <Icon src="65:19159" size={12} className="fm-message-badge" />}
      {cancelable && <CloseButton label="关闭消息" onClose={onClose} />}
    </div>
  );
}

/** Message-Focus 2304:77465 */
function MessageFocus({ type, onClose }: { type: string; onClose?: () => void }) {
  const single = type === "Single Line";
  return (
    <div className="fm-message-focus" data-type={type}>
      <span className="fm-message-focus-left">
        <span className="fm-message-focus-emoji" aria-hidden="true">
          🔍
        </span>
        {single ? (
          <span className="fm-message-focus-single">Title</span>
        ) : (
          <span className="fm-message-focus-texts">
            <span className="fm-message-focus-title">Title</span>
            <span className="fm-message-focus-desc">Description</span>
          </span>
        )}
      </span>
      <CloseButton label="关闭提示" onClose={onClose} />
    </div>
  );
}

const module: FamilyModule = {
  description: "消息用于页面内的提醒与提示：普通消息、警示与固定提示，可带图标与关闭按钮；聚焦消息用于更醒目的引导。",
  defaults: {
    "65:19287": { Type: "Message", "Show Badge": "False", Cancelable: "False" },
  },
  axes: {
    "65:19287": [
      { name: "Type", values: ["Message", "Alert", "Fixed Tip"] },
      { name: "Show Badge", values: ["False", "True"] },
      { name: "Cancelable", values: ["False", "True"] },
    ],
  },
  renderers: {
    "65:19287": ({ props, interactive, notify }) => (
      <Dismissible interactive={interactive}>
        {(close) => (
          <Message
            type={props.Type ?? "Message"}
            badge={on(props["Show Badge"])}
            cancelable={on(props.Cancelable)}
            onClose={
              close &&
              (() => {
                close();
                notify("已关闭消息");
              })
            }
          />
        )}
      </Dismissible>
    ),
    "2304:77465": ({ props, interactive, notify }) => (
      <Dismissible interactive={interactive}>
        {(close) => (
          <MessageFocus
            type={props.Type ?? "Title+Description"}
            onClose={
              close &&
              (() => {
                close();
                notify("已关闭提示");
              })
            }
          />
        )}
      </Dismissible>
    ),
  },
};

export default module;
