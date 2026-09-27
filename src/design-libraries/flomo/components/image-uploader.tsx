import { useEffect, useRef, useState } from "react";
import type { FamilyModule } from "../showcase";
import "./image-uploader.css";

/** Source image fill of the Figma component (cover-cropped at render time, like Figma). */
const PHOTO = "/design-libraries/flomo/icons/uploader-photo.jpg";

/** Image Uploader 21:54058 (State; Number / Percent / Tip text props). */
function Uploader({
  state,
  src = PHOTO,
  percent = 50,
  number = "+8",
  tip = "待上传",
  alt = "",
}: {
  state: string;
  src?: string;
  percent?: number;
  number?: string;
  tip?: string;
  alt?: string;
}) {
  return (
    <div className="fm-image-uploader" data-state={state}>
      <img className="fm-image-uploader-img" src={src} alt={alt} draggable={false} />
      {state === "Todo" && (
        <>
          <span className="fm-image-uploader-mask" />
          <span className="fm-image-uploader-tip">{tip}</span>
        </>
      )}
      {state === "Uploading" && (
        <>
          <span className="fm-image-uploader-mask" style={{ right: `${percent}%` }} />
          <span className="fm-image-uploader-percent" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="上传进度">
            {percent}%
          </span>
        </>
      )}
      {state === "BlurNumber" && (
        <>
          <span className="fm-image-uploader-blur" />
          <span className="fm-image-uploader-number">{number}</span>
        </>
      )}
    </div>
  );
}

/** Playground: pick a local image (object URL, never uploaded) and watch a simulated upload. */
function UploaderDemo({ notify }: { notify: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [percent, setPercent] = useState(0);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => {
    if (!url || percent >= 100) return;
    const timer = window.setTimeout(() => setPercent((p) => Math.min(100, p + 10)), 180);
    return () => window.clearTimeout(timer);
  }, [url, percent]);
  useEffect(() => {
    if (url && percent === 100) notify("本地预览完成（图片没有离开你的设备）");
  }, [url, percent, notify]);
  const state = !url ? "Todo" : percent < 100 ? "Uploading" : "Done";
  return (
    <div className="fm-image-uploader-demo">
      <Uploader state={state} src={url || PHOTO} percent={percent} alt={url ? "所选图片预览" : ""} />
      <div className="fm-image-uploader-demo-actions">
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file?.type.startsWith("image/")) return notify("请选择图片文件");
            setUrl(URL.createObjectURL(file));
            setPercent(0);
            notify(`已选择「${file.name}」，正在模拟上传`);
          }}
        />
        <button type="button" className="fm-image-uploader-demo-button fm-press" onClick={() => input.current?.click()}>
          {url ? "更换图片" : "选择图片"}
        </button>
        {url && (
          <button
            type="button"
            className="fm-image-uploader-demo-button fm-press"
            data-kind="secondary"
            onClick={() => {
              setUrl("");
              setPercent(0);
              notify("已移除图片");
            }}
          >
            移除
          </button>
        )}
      </div>
    </div>
  );
}

const module: FamilyModule = {
  description: "图片上传缩略图展示已上传、待上传、上传中与更多数量四种状态，统一为 100 × 100 的圆角方图。",
  renderers: {
    "21:54058": ({ props }) => <Uploader state={props.State ?? "Done"} />,
  },
  demo: (notify) => <UploaderDemo notify={notify} />,
};
export default module;
