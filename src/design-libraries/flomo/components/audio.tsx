import { useState, type ReactNode } from "react";
import type { FamilyModule } from "../showcase";
import { Icon } from "./shared";
import "./audio.css";

const icon = (name: string) => `/design-libraries/flomo/icons/${name}.svg`;
const TRANSCRIPT =
  "小车正穿行在落基山脉蜿蜒曲折的盘山公路上。克里斯朵夫·李维静静地望着窗外，发现每当车子即将行驶到无路的关头，路边都会出现一块交通指示牌‘前方转弯’或‘注意！急转弯’。";

/** AudioBox 92:11670 (Expand × Size). No audio file: play toggles the playing state only. */
function AudioBox({ expand, small, notify }: { expand: boolean; small: boolean; notify: (message: string) => void }) {
  const [open, setOpen] = useState(expand && !small);
  const [playing, setPlaying] = useState(false);
  const button = (label: string, onClick: () => void, children: ReactNode, kind?: string) => (
    <button type="button" className="fm-audio-btn fm-press" data-kind={kind} onClick={onClick}>
      {children}
      {label && <span>{label}</span>}
    </button>
  );
  return (
    <div className="fm-audio" data-size={small ? "small" : "default"} data-expand={open}>
      <div className="fm-audio-controls">
        <div className="fm-audio-play-time">
          <button
            type="button"
            className="fm-audio-play fm-press"
            aria-label={playing ? "暂停" : "播放"}
            aria-pressed={playing}
            onClick={() => {
              setPlaying(!playing);
              notify(playing ? "已暂停" : "正在播放（演示，无音频）");
            }}
          >
            <Icon src={icon(playing ? "pause-fill" : "play-fill")} />
          </button>
          <span className="fm-audio-time">10:08</span>
        </div>
        {!small &&
          button(
            "",
            () => setOpen(!open),
            <>
              <span>{open ? "收起" : "原文"}</span>
              <Icon src={icon(open ? "chevron-up" : "chevron-right")} />
            </>,
          )}
      </div>
      {open && (
        <div className="fm-audio-text">
          <div className="fm-audio-content">
            {/* Word joiners glue the curly quotes to their neighbours, as Figma's line breaker does (UAX #14 QU). */}
            <p className="fm-audio-transcript">{TRANSCRIPT.replace(/[‘’]/g, "\u2060$&\u2060")}</p>
          </div>
          <div className="fm-audio-bottom">
            <div className="fm-audio-bottom-buttons">
              {button("重试", () => notify("点击了重试"), <Icon src={icon("arrow-trianglehead-2-cw")} />, "link")}
              {button(
                "复制",
                () => {
                  navigator.clipboard?.writeText(TRANSCRIPT).catch(() => {});
                  notify("已复制原文");
                },
                <Icon src={icon("square-on-square")} />,
                "link",
              )}
            </div>
            {button("反馈", () => notify("点击了反馈"), null)}
          </div>
        </div>
      )}
    </div>
  );
}

const module: FamilyModule = {
  description: "语音条展示录音时长与播放控制，默认尺寸可展开查看转写原文，并提供重试、复制与反馈操作。",
  defaults: { "92:11670": { Expand: "False", Size: "Small" } },
  axes: {
    "92:11670": [
      { name: "Expand", values: ["False", "True"] },
      { name: "Size", values: ["Small", "Default"] },
    ],
  },
  renderers: {
    "92:11670": ({ props, notify }) => (
      <AudioBox
        key={`${props.Expand}-${props.Size}`}
        expand={props.Expand === "True"}
        small={props.Size === "Small"}
        notify={notify}
      />
    ),
  },
};
export default module;
