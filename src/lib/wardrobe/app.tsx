import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Input,
  Combobox,
  Dropdown,
  FieldContainer,
  InputArea,
  Scrollbar,
  Collapsible,
  BulkActionBar,
  EmptyState,
  ErrorState,
  Alert,
  Loading,
  Switch,
  Checkbox,
  Radio,
  DialogBasic,
  SheetBasic,
  UiProvider,
  Tabs,
  useToast,
} from "@aaronxu-lab/aaron-ui";
import "@aaronxu-lab/aaron-ui/styles.css";
import {
  CaretRightIcon,
  CameraIcon,
  ImagesIcon,
  GearSixIcon,
  DownloadSimpleIcon,
  TrashIcon,
  CoatHangerIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import { zip } from "fflate";
import {
  CATEGORIES,
  DEFAULTS,
  DEFAULT_MODE_MODELS,
  cleanSettings,
  canUseApi,
  matches,
  missingSteps,
  exportMetadata,
  exportName,
} from "./core.mjs";
import {
  allClothes,
  getClothes,
  putClothes,
  patchClothes,
  deleteClothes,
  loadSettings,
  saveSettings,
} from "./db.mjs";
import {
  listModels,
  prepareImage,
  generateImage,
  generateTags,
} from "./api.mjs";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { RadioGroup } from "@base-ui/react/radio-group";
import { keepScreenAwake } from "./screen-wake-lock.mjs";
import "./style.css";

function Photo({ blob, alt = "", className = "" }) {
  const [url, setURL] = useState("");
  useEffect(() => {
    if (!blob) {
      setURL("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setURL(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? (
    <img src={url} alt={alt} className={className} />
  ) : (
    <CoatHangerIcon size={48} weight="thin" />
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: React.ReactNode;
  children: React.ReactElement<any>;
  hint?: string;
}) {
  return (
    <FieldContainer
      className="field"
      labelText={label}
      description={hint}
      control={children}
    />
  );
}
function Disclosure({
  title,
  children,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Collapsible
      retainActive={false}
      className={className}
      header={
        <Collapsible.Trigger className="disclosure-trigger">
          <CaretRightIcon className="disclosure-icon" aria-hidden="true" />
          {title}
        </Collapsible.Trigger>
      }
    >
      {children}
    </Collapsible>
  );
}
function ScrollRegion({
  children,
  className = "",
  horizontal = false,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  horizontal?: boolean;
  label: string;
}) {
  return (
    <ScrollArea.Root className={`ui-scroll-root ${className}`}>
      <ScrollArea.Viewport className="ui-scroll-viewport" aria-label={label}>
        <ScrollArea.Content
          className="ui-scroll-content"
          style={{ minWidth: 0, width: "100%" }}
        >
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <Scrollbar
        orientation={horizontal ? "horizontal" : "vertical"}
        layout="reserved"
        visibility="interaction"
      />
    </ScrollArea.Root>
  );
}
const MISSING_KEY_MESSAGE = "请先在设置中填写 API Key。";
function localId() {
  // LAN previews use HTTP, where randomUUID is unavailable.
  return crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function App() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]),
    [config, setConfig] = useState<any>(DEFAULTS),
    [ready, setReady] = useState(false),
    [fatal, setFatal] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false),
    [cameraStatus, setCameraStatus] = useState<"opening" | "ready" | "unavailable">("opening"),
    [takingPhoto, setTakingPhoto] = useState(false);
  const [page, setPage] = useState("capture"),
    [draft, setDraft] = useState<any>(DEFAULTS),
    [models, setModels] = useState<string[]>([]),
    [testing, setTesting] = useState(false),
    [connectionStatus, setConnectionStatus] = useState(""),
    [saveError, setSaveError] = useState("");
  const [category, setCategory] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [selecting, setSelecting] = useState(false),
    [detail, setDetail] = useState<string | null>(null),
    [editCategory, setEditCategory] = useState("其他"),
    [editTags, setEditTags] = useState(""),
    [viewOriginal, setViewOriginal] = useState(false),
    [detailSaveError, setDetailSaveError] = useState(""),
    [detailSaving, setDetailSaving] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, string[]>>({}),
    [queue, setQueue] = useState<string[]>([]),
    [adding, setAdding] = useState(false),
    [exporting, setExporting] = useState(false),
    [confirmRetag, setConfirmRetag] = useState<string | null>(null),
    [confirmDelete, setConfirmDelete] = useState<string[] | null>(null),
    [deleteError, setDeleteError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const fileRef = useRef<HTMLInputElement>(null),
    cameraRef = useRef<HTMLInputElement>(null),
    videoRef = useRef<HTMLVideoElement>(null),
    running = useRef(new Map<string, AbortController>()),
    removing = useRef(new Set<string>()),
    pending = useRef<string[]>([]),
    configRef = useRef(config),
    detailRef = useRef(detail),
    modelRequest = useRef(0),
    batchRef = useRef<any>({}),
    ingesting = useRef(false);
  configRef.current = config;
  detailRef.current = detail;
  const canConnect = canUseApi(config);
  const notify = (title, tone = "default") =>
    toast.add({ title, tone: tone as any });
  const refresh = async () => {
    setItems((await allClothes()).sort((a, b) => b.createdAt - a.createdAt));
  };
  const fail = (e) =>
    notify(
      e.name === "QuotaExceededError"
        ? "本机空间不足，请导出后删除部分衣服。"
        : e.message || "操作失败，请重试。",
      "error",
    );
  useEffect(() => {
    Promise.all([allClothes(), loadSettings()])
      .then(([rows, c]) => {
        setItems(rows.sort((a, b) => b.createdAt - a.createdAt));
        setConfig(cleanSettings(c));
        setReady(true);
      })
      .catch((e) =>
        setFatal(
          "无法打开本地相册。请检查浏览器是否允许本地存储，然后重新打开。",
        ),
      );
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    if (!video) return;
    let closed = false;
    let stream: MediaStream | undefined;
    const stop = () => stream?.getTracks().forEach((track) => track.stop());
    const unavailable = () => {
      stop();
      if (!closed) setCameraStatus("unavailable");
    };
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1920 },
      },
    }).then(async (media) => {
      stream = media;
      if (closed) {
        stop();
        return;
      }
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", unavailable));
      video.srcObject = stream;
      await video.play();
      if (!closed && stream.active) setCameraStatus("ready");
    }).catch(unavailable);
    return () => {
      closed = true;
      stop();
      video.srcObject = null;
    };
  }, [cameraOpen]);
  useEffect(() => {
    if (!settingsOpen) return;
    const current = configRef.current;
    const id = ++modelRequest.current;
    setModels([]);
    setConnectionStatus("");
    setTesting(false);
    if (current.apiMode !== "byok" || !canUseApi(current)) return;
    listModels(current)
      .then((result) => {
        if (id === modelRequest.current) setModels(result);
      })
      .catch((error) => {
        if (id === modelRequest.current)
          setConnectionStatus(`无法获取模型：${error.message} 可重试连接。`);
      });
    return () => {
      modelRequest.current++;
    };
  }, [settingsOpen, config.apiMode]);
  const draftRef = useRef<any>(DEFAULTS);
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  function updateSettings(update) {
    const next = cleanSettings(
      typeof update === "function" ? update(draftRef.current) : update,
    );
    draftRef.current = next;
    setDraft(next);
    setConfig(next);
    configRef.current = next;
    const revision = ++saveRevision.current;
    setSaveError("");
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveSettings(next))
      .catch((error) => {
        if (revision === saveRevision.current) {
          setSaveError("自动保存失败，请重试。");
          fail(error);
        }
      });
  }
  const openSettings = () => {
    draftRef.current = { ...config };
    setDraft(draftRef.current);
    setConnectionStatus("");
    setTesting(false);
    setSettingsOpen(true);
  };
  async function testConnection() {
    const current = draftRef.current;
    if (current.apiMode !== "byok" || !canUseApi(current) || testing) return;
    const id = ++modelRequest.current;
    setTesting(true);
    setConnectionStatus("正在测试连接…");
    try {
      const result = await listModels(current);
      if (id !== modelRequest.current) return;
      setModels(result);
      setConnectionStatus("连接成功");
    } catch (error) {
      if (id === modelRequest.current) {
        setModels([]);
        setConnectionStatus(`连接失败：${error.message}`);
      }
    } finally {
      if (id === modelRequest.current) setTesting(false);
    }
  }
  const defaultMode = draft.apiMode === "default";
  const imageModelField = defaultMode ? "defaultImageModel" : "imageModel";
  const tagModelField = defaultMode ? "defaultTagModel" : "tagModel";
  const modelOptions = (type: "image" | "tags") => {
    if (defaultMode) return DEFAULT_MODE_MODELS[type].map((value) => ({ value, label: value }));
    const selected = type === "image" ? draft.imageModel : draft.tagModel;
    const preset = type === "image" ? DEFAULTS.imageModel : DEFAULTS.tagModel;
    const available = models.filter((m) =>
      type === "image"
        ? m.includes("image")
        : /^(gpt-|o\d)/.test(m) &&
          !/(image|audio|realtime|transcribe|tts)/.test(m),
    );
    return [...new Set([preset, selected, ...available])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
      .map((value) => ({
        value,
        label: value,
        description: models.includes(value) ? undefined : "预设或已保存的模型",
      }));
  };
  const openDetail = (item) => {
    setDetailSaveError("");
    setDetail(item.id);
    setEditCategory(item.coarse);
    setEditTags(item.fine.join("，"));
    setViewOriginal(false);
  };
  const current = items.find((i) => i.id === detail);
  const visible = items.filter((i) => matches(i, category, tags, query));
  const tagOptions = [
    ...new Set(
      items
        .filter((i) => !category || i.coarse === category)
        .flatMap((i) => i.fine),
    ),
  ].sort() as string[];
  async function remove(ids: string[]) {
    const targets = new Set(ids.filter((id) => !removing.current.has(id)));
    if (!targets.size) return;
    for (const id of targets) removing.current.add(id);
    try {
      await deleteClothes(targets);
      pending.current = pending.current.filter((id) => !targets.has(id));
      setQueue([...pending.current]);
      for (const batch of Object.values(batchRef.current) as any[]) {
        batch.done = batch.done.filter((id) => !targets.has(id));
      }
      for (const id of targets) {
        running.current.get(id)?.abort();
        finishBatch(id, false);
      }
      setSelected((s) => s.filter((id) => !targets.has(id)));
      setDetail((id) => id && targets.has(id) ? null : id);
      await refresh();
    } finally {
      for (const id of targets) removing.current.delete(id);
      pump();
    }
  }
  function finishBatch(id, success) {
    const batch = Object.values(batchRef.current).find((b: any) =>
      b.pending.has(id),
    ) as any;
    if (!batch) return;
    batch.pending.delete(id);
    if (success) batch.done.push(id);
    if (!batch.pending.size) {
      delete batchRef.current[batch.id];
      if (batch.done.length)
        toast.add({
          title: `${batch.done.length} 件衣服已存入相册`,
          timeout: 10000,
          action: {
            label: "撤销",
            onClick: () => {
              remove(batch.done).catch(fail);
            },
          },
        });
    }
  }
  async function processItem(id, mode = "missing") {
    if (running.current.has(id) || removing.current.has(id)) return;
    const controller = new AbortController();
    const { signal } = controller;
    running.current.set(id, controller);
    const cfg = configRef.current;
    let didComplete = false;
    try {
      let item = await getClothes(id);
      if (!item || signal.aborted) return;
      if (
        mode === "missing" &&
        !item.transparentBlob &&
        !cfg.generateTransparent
      ) {
        item = await patchClothes(id, { imageSkipped: true, imageError: null });
        if (!item || signal.aborted) return;
      }
      const steps = mode === "missing" ? missingSteps(item) : [mode];
      if (!steps.length) return;
      if (!canUseApi(cfg)) throw new Error(MISSING_KEY_MESSAGE);
      if (!navigator.onLine) throw new Error("当前离线，联网后可重试。");
      setBusy((b) => ({ ...b, [id]: steps }));
      await Promise.all(
        steps.map(async (step) => {
          try {
            if (step === "image") {
              const blob = await generateImage(
                item.preparedBlob ?? item.originalBlob,
                cfg,
                signal,
              );
              if (signal.aborted) return;
              await patchClothes(id, {
                transparentBlob: blob,
                imageSkipped: false,
                imageError: null,
              });
            } else {
              const result = await generateTags(
                item.preparedBlob ?? item.originalBlob,
                cfg,
                signal,
              );
              if (signal.aborted) return;
              await patchClothes(id, {
                ...result,
                tagsDone: true,
                tagError: null,
              });
            }
          } catch (e) {
            if (signal.aborted) return;
            await patchClothes(id, {
              [step === "image" ? "imageError" : "tagError"]: e.message,
            });
          } finally {
            setBusy((b) => ({
              ...b,
              [id]: (b[id] ?? []).filter((s) => s !== step),
            }));
            if (!signal.aborted) await refresh();
          }
        }),
      );
      const updated = await getClothes(id);
      if (updated && !signal.aborted) {
        didComplete = !missingSteps(updated).length;
        if (
          steps.includes("tags") &&
          !updated.tagError &&
          detailRef.current === id
        ) {
          setEditCategory(updated.coarse);
          setEditTags(updated.fine.join("，"));
        }
        if (mode === "missing" && !didComplete)
          notify("部分处理未完成，已保留成功结果，可单独重试。", "error");
        else if (mode !== "missing")
          notify(
            (mode === "image" ? updated.imageError : updated.tagError) ||
              "已更新相册",
            (mode === "image" ? updated.imageError : updated.tagError)
              ? "error"
              : "success",
          );
      }
    } catch (e) {
      if (!signal.aborted) fail(e);
    } finally {
      running.current.delete(id);
      setBusy((b) => {
        const next = { ...b };
        delete next[id];
        return next;
      });
      const belongsToBatch = Object.values(batchRef.current).some(
        (batch: any) => batch.pending.has(id),
      );
      finishBatch(id, didComplete && !signal.aborted);
      if (didComplete && !signal.aborted && mode === "missing" && !belongsToBatch) {
        toast.add({
          title: "衣服已存入相册",
          timeout: 10000,
          action: {
            label: "撤销",
            onClick: () => {
              remove([id]).catch(fail);
            },
          },
        });
      }
      pump();
    }
  }
  function pump() {
    if (running.current.size >= 2) return;
    const next = pending.current.findIndex((id) => !removing.current.has(id));
    if (next < 0) return;
    const [id] = pending.current.splice(next, 1);
    setQueue([...pending.current]);
    if (id) {
      void processItem(id);
      if (running.current.size < 2) pump();
    }
  }
  function handlePhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    // The native file list can be cleared with the input, including while async work runs.
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length) void ingest(files);
  }
  async function ingest(files: File[], openAlbum = true) {
    if (ingesting.current) return;
    if (!canUseApi(configRef.current)) {
      notify(MISSING_KEY_MESSAGE);
      openSettings();
      return;
    }
    if (!navigator.onLine) {
      notify("处理照片需要联网，已有相册仍可浏览。", "error");
      return;
    }
    ingesting.current = true;
    setAdding(true);
    const ids = [];
    try {
      for (const file of files) {
        try {
          const prepared = await prepareImage(file);
          const id = localId(),
            now = Date.now();
          await putClothes({
            id,
            originalBlob: file,
            preparedBlob: prepared,
            transparentBlob: null,
            coarse: "其他",
            fine: [],
            tagsDone: false,
            createdAt: now,
            updatedAt: now,
            sourceName: file.name,
          });
          ids.push(id);
        } catch (e) {
          fail(e);
        }
      }
      if (ids.length) {
        const batch = localId();
        batchRef.current[batch] = {
          id: batch,
          pending: new Set(ids),
          done: [],
        };
        await refresh();
        if (openAlbum) setPage("album");
        pending.current.push(...ids);
        setQueue([...pending.current]);
        pump();
        navigator.storage?.persist?.().catch(() => {});
      }
    } catch (e) {
      fail(e);
    } finally {
      ingesting.current = false;
      setAdding(false);
    }
  }
  function openCamera() {
    if (!canConnect) {
      openSettings();
    } else if (!navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
    } else {
      setCameraStatus("opening");
      setCameraOpen(true);
    }
  }
  async function takePhoto() {
    const video = videoRef.current;
    if (takingPhoto || adding || !video?.videoWidth || !video.videoHeight) return;
    setTakingPhoto(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法拍照，请重试。");
      ctx.drawImage(video, 0, 0);
      const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      if (!photo) throw new Error("无法保存照片，请重试。");
      await ingest([new File([photo], `衣集-${Date.now()}.jpg`, { type: "image/jpeg" })], false);
    } catch (error) {
      fail(error);
    } finally {
      setTakingPhoto(false);
    }
  }
  async function exportItems(ids) {
    setExporting(true);
    try {
      const rows = (await allClothes()).filter((i) => ids.includes(i.id));
      if (rows.some((i) => !i.transparentBlob && !i.imageSkipped))
        throw new Error("部分所选衣服尚无透明图，请完成生成后导出。");
      const files = {};
      for (const i of rows) {
        const name = exportName(i);
        if (!i.transparentBlob && !i.tagsDone)
          throw new Error("请先完成标签识别后导出。");
        if (i.transparentBlob)
          files[`${name}.png`] = new Uint8Array(
            await i.transparentBlob.arrayBuffer(),
          );
        if (i.originalBlob) {
          const format = i.originalBlob.type.match(
            /^image\/(jpeg|png|webp|heic|heif)(?:-sequence)?$/i,
          )?.[1];
          const suffix = i.sourceName?.match(/\.(jpe?g|png|webp|heic|heif)$/i)?.[1];
          const extension = (format ?? suffix ?? "bin").toLowerCase();
          files[`${name}-原图.${extension === "jpeg" ? "jpg" : extension}`] =
            new Uint8Array(await i.originalBlob.arrayBuffer());
        }
        files[`${name}.json`] = new TextEncoder().encode(
          JSON.stringify(exportMetadata(i), null, 2),
        );
      }
      if (!rows.length) throw new Error("请先选择衣服。");
      const bytes = await new Promise<Uint8Array>((resolve, reject) =>
        zip(files, { level: 0 }, (err, data) =>
          err ? reject(err) : resolve(data),
        ),
      );
      const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
      const filename = `衣集-${new Date().toISOString().slice(0, 10)}.zip`;
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
      notify(`已导出 ${rows.length} 件衣服`, "success");
    } catch (e) {
      if (e.name !== "AbortError") fail(e);
    } finally {
      setExporting(false);
    }
  }
  const activeCount = Object.keys(busy).length + queue.length;
  const isProcessing = adding || activeCount > 0;
  useEffect(() => {
    if (isProcessing) return keepScreenAwake(navigator, document);
  }, [isProcessing]);
  return (
    <div className="wardrobe-app">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handlePhotoSelection}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={handlePhotoSelection}
      />
      <Tabs.Root
        value={page}
        onValueChange={(value) => {
          if (value !== "capture") setCameraOpen(false);
          setPage(String(value));
          setSelecting(false);
          setSelected([]);
        }}
        variant="underline"
        contentType="iconText"
      >
        <ScrollRegion className="page-scroll" label="衣服素材页面">
          <main className={page === "capture" ? "capture-main" : undefined}>
            {fatal ? (
              <ErrorState
                className="empty"
                title="本地相册暂不可用"
                description={fatal}
                action={{ label: "重新打开", onClick: () => location.reload() }}
              />
            ) : !ready ? (
              <Loading label="正在打开本地相册" />
            ) : page === "capture" ? (
              <Tabs.Panel value="capture" className="capture-page">
                <div className="album-heading">
                  <h1>拍摄</h1>
                  <Button
                    variant="ghost"
                    aria-label="设置"
                    onClick={openSettings}
                  >
                    <GearSixIcon size={21} />
                  </Button>
                </div>
                <div className="capture-content">
                  <div className="capture-target">
                    {cameraOpen ? (
                      <>
                        <video
                          ref={videoRef}
                          className="capture-video"
                          aria-label="相机预览"
                          hidden={cameraStatus !== "ready"}
                          playsInline
                          muted
                        />
                        {cameraStatus === "opening" && <p role="status">正在打开相机…</p>}
                        {cameraStatus === "unavailable" && <p role="status">无法打开网页相机，可以改用系统相机。</p>}
                      </>
                    ) : (
                      <>
                        <CoatHangerIcon size={88} weight="thin" />
                        <p>拍下完整衣服</p>
                      </>
                    )}
                  </div>
                  {!canConnect && (
                    <Alert
                      className="context-alert"
                      role="status"
                      color="blue"
                      border={false}
                      text={MISSING_KEY_MESSAGE}
                      trailing={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openSettings}
                        >
                          连接
                        </Button>
                      }
                    />
                  )}
                  {offline && (
                    <p className="help" role="status">
                      当前离线，联网后可处理照片。
                    </p>
                  )}
                  <div className="capture-actions">
                    <Button
                      variant="fill"
                      size="lg"
                      disabled={adding || takingPhoto || offline || (cameraOpen && cameraStatus === "opening")}
                      onClick={() => {
                        if (!cameraOpen) openCamera();
                        else if (cameraStatus === "ready") void takePhoto();
                        else {
                          setCameraOpen(false);
                          cameraRef.current?.click();
                        }
                      }}
                    >
                      <CameraIcon size={22} />
                      {cameraOpen && cameraStatus === "unavailable" ? "用系统相机拍照" : "拍照"}
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={adding || takingPhoto || offline}
                      onClick={() => {
                        if (!canConnect) return openSettings();
                        setCameraOpen(false);
                        fileRef.current?.click();
                      }}
                    >
                      <ImagesIcon size={22} />
                      从相册选择
                    </Button>
                    {cameraOpen && (
                      <Button variant="ghost" onClick={() => setCameraOpen(false)}>
                        关闭相机
                      </Button>
                    )}
                  </div>
                  {(activeCount > 0 || adding) && (
                    <p className="help" role="status">
                      {adding
                        ? "正在保存原图…"
                        : `正在整理 ${activeCount} 件，请保持页面打开。`}
                    </p>
                  )}
                </div>
              </Tabs.Panel>
            ) : (
              <Tabs.Panel value="album">
                <section className="album-heading">
                  <h1>
                    相册 <span className="count">{items.length}</span>
                  </h1>
                  <div className="row">
                    {!!items.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelecting(!selecting);
                          setSelected([]);
                        }}
                      >
                        {selecting ? "完成" : "多选"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={openSettings}
                      aria-label="设置"
                    >
                      <GearSixIcon size={21} />
                    </Button>
                  </div>
                </section>
                {offline && (
                  <Alert
                    className="context-alert"
                    role="status"
                    color="warning"
                    border={false}
                    text="当前离线。可以浏览、编辑和导出；联网后再处理照片。"
                  />
                )}
                {!canConnect && items.length > 0 && (
                  <Alert
                    className="context-alert"
                    role="status"
                    color="blue"
                    border={false}
                    text={MISSING_KEY_MESSAGE}
                    trailing={
                      <Button variant="ghost" size="sm" onClick={openSettings}>
                        前往设置
                      </Button>
                    }
                  />
                )}
                {adding && (
                  <div className="processing" role="status">
                    正在保存原图，请稍候…
                  </div>
                )}
                {activeCount > 0 && (
                  <div className="processing" role="status">
                    <Loading size="sm" label="正在整理衣服" />
                    <span>
                      正在整理 {activeCount} 件衣服
                      {queue.length > 0
                        ? `，其中 ${queue.length} 件排队中`
                        : ""}
                      。请保持此页面打开。
                    </span>
                  </div>
                )}
                <section className="album-section">
                  {!!items.length && (
                    <div className="album-toolbar">
                      <Input
                        aria-label="搜索衣服标签"
                        placeholder="搜索衣服或标签"
                        value={query}
                        onValueChange={setQuery}
                      />
                    </div>
                  )}
                  {!!items.length && (
                    <>
                      <Field label="粗分类筛选">
                        <Dropdown
                          width="fill"
                          value={category || "all"}
                          items={[
                            { value: "all", label: "全部" },
                            ...CATEGORIES.map((value) => ({
                              value,
                              label: value,
                            })),
                          ]}
                          onValueChange={(value) => {
                            setCategory(value === "all" ? "" : (value ?? ""));
                            setTags([]);
                          }}
                        />
                      </Field>
                      {tagOptions.length > 0 && (
                        <Disclosure
                          className="fine-filter"
                          title={`标签筛选${tags.length > 0 ? ` · 已选 ${tags.length}` : ""}`}
                        >
                          <ScrollRegion
                            className="tag-scroll"
                            label="细标签筛选"
                          >
                            <div
                              className="tag-filters"
                              aria-label="细标签筛选"
                            >
                              {tagOptions.map((t) => (
                                <label className="tag-choice" key={t}>
                                  <Checkbox
                                    checked={tags.includes(t)}
                                    onCheckedChange={(checked) =>
                                      setTags((v) =>
                                        checked
                                          ? [...v, t]
                                          : v.filter((x) => x !== t),
                                      )
                                    }
                                  />
                                  <span>{t}</span>
                                </label>
                              ))}
                              {tags.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setTags([])}
                                >
                                  清除标签
                                </Button>
                              )}
                            </div>
                          </ScrollRegion>
                        </Disclosure>
                      )}
                    </>
                  )}
                  {selecting && (
                    <>
                      <label className="row select-all">
                        <Checkbox
                          aria-label="全选筛选结果"
                          checked={
                            visible.length > 0 &&
                            visible.every((i) => selected.includes(i.id))
                          }
                          indeterminate={
                            selected.length > 0 &&
                            !visible.every((i) => selected.includes(i.id))
                          }
                          onCheckedChange={(checked) =>
                            setSelected(checked ? visible.map((i) => i.id) : [])
                          }
                        />
                        <span>全选</span>
                      </label>
                      <div className="selection-bar">
                        <BulkActionBar
                          className="wardrobe-bulk-actions"
                          count={selected.length}
                          selectionLabel={(count) => `已选 ${count} 件`}
                          cancelLabel="退出多选"
                          downloadLabel={exporting ? "导出中…" : "导出"}
                          deleteLabel="删除"
                          moreActionsLabel="更多批量操作"
                          onCancel={() => {
                            setSelected([]);
                            setSelecting(false);
                          }}
                          onDownload={
                            selected.length > 0 &&
                            !exporting &&
                            !selected.some(
                              (id) =>
                                running.current.has(id) || queue.includes(id),
                            )
                              ? () => void exportItems(selected)
                              : undefined
                          }
                          deleteDisabled={!selected.length}
                          deleteTitle="请先选择衣服。"
                          onDelete={() => {
                            setDeleteError("");
                            setConfirmDelete([...selected]);
                          }}
                        />
                      </div>
                    </>
                  )}
                  {!items.length ? (
                    <EmptyState
                      className="empty"
                      icon={<CoatHangerIcon />}
                      title="还没有衣服"
                      supporting="description"
                      description={
                        canConnect
                          ? "拍照或选图，开始整理衣服。"
                          : MISSING_KEY_MESSAGE
                      }
                      action={
                        !canConnect ? (
                          <Button variant="outline" onClick={openSettings}>
                            连接 OpenAI
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : !visible.length ? (
                    <EmptyState
                      className="empty"
                      icon={<CoatHangerIcon />}
                      title="还没有匹配的衣服"
                      supporting="description"
                      description="试试减少筛选条件。"
                      action={
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCategory("");
                            setTags([]);
                            setQuery("");
                          }}
                        >
                          清除筛选
                        </Button>
                      }
                    />
                  ) : (
                    <div className="clothes-grid">
                      {visible.map((item) => {
                        const working =
                            running.current.has(item.id) ||
                            queue.includes(item.id),
                          incomplete = missingSteps(item).length > 0;
                        return (
                          <article className="clothes-card" key={item.id}>
                            <button
                              className="photo-button checker"
                              onClick={() =>
                                selecting
                                  ? setSelected((s) =>
                                      s.includes(item.id)
                                        ? s.filter((id) => id !== item.id)
                                        : [...s, item.id],
                                    )
                                  : openDetail(item)
                              }
                              aria-label={`${selecting ? "选择" : "查看"}${item.coarse} ${item.fine.join("、")}`}
                            >
                              <Photo
                                blob={
                                  item.transparentBlob ??
                                  item.preparedBlob ??
                                  item.originalBlob
                                }
                                alt={item.coarse}
                              />
                              {working && (
                                <span className="photo-status">
                                  {queue.includes(item.id)
                                    ? "等待处理"
                                    : "正在整理…"}
                                </span>
                              )}
                            </button>
                            {selecting && (
                              <Checkbox
                                className="selection-check"
                                aria-label={`选择${item.coarse} ${item.fine.join("、")}`}
                                checked={selected.includes(item.id)}
                                onCheckedChange={(checked) =>
                                  setSelected((v) =>
                                    checked
                                      ? [...v, item.id]
                                      : v.filter((id) => id !== item.id),
                                  )
                                }
                              />
                            )}

                            <div className="card-info">
                              <div className="row-between">
                                <h3>
                                  {item.tagsDone ? item.coarse : "待分类"}
                                </h3>
                              </div>
                              <p>
                                {item.fine.slice(0, 3).join(" · ") ||
                                  "等待识别标签"}
                              </p>
                              {incomplete && !working && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => processItem(item.id)}
                                >
                                  继续处理
                                </Button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </Tabs.Panel>
            )}
          </main>
        </ScrollRegion>
        {ready && !fatal && (
          <nav className="bottom-tabs" aria-label="主导航">
            <Tabs.List width="fill" aria-label="页面切换">
              <Tabs.Item
                value="capture"
                aria-label="拍摄"
                icon={<CameraIcon size={22} />}
              >
                拍摄
              </Tabs.Item>
              <Tabs.Item
                value="album"
                aria-label="相册"
                icon={<ImagesIcon size={22} />}
              >
                相册
              </Tabs.Item>
            </Tabs.List>
          </nav>
        )}
      </Tabs.Root>
      <SheetBasic
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="设置"
        closeLabel="关闭设置"
        width="xs"
        heightMode="auto"
        minHeight="none"
        adaptiveHeight
        contentOverflow="scroll"
        contentInset="none"
        contentDivider
        className="settings-sheet"
        hideActions
      >
        <div className="settings-sheet-body">
          {saveError && (
            <Alert
              className="context-alert"
              color="red"
              border={false}
              text={saveError}
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings(draftRef.current)}
                >
                  重试
                </Button>
              }
            />
          )}
          <div className="settings-card">
            <Field label="API Key 模式">
              <RadioGroup
                className="api-mode-options"
                value={draft.apiMode}
                onValueChange={(apiMode) =>
                  updateSettings((d) => ({ ...d, apiMode }))
                }
              >
                <Radio value="default" label="默认" />
                <Radio value="byok" label="BYOK" />
              </RadioGroup>
            </Field>
            {draft.apiMode === "byok" ? (
              <Field
                label="OpenAI API Key"
                hint="照片直传 OpenAI。Key 仅存此浏览器，清空即可移除。"
              >
                <Input
                  id="wardrobe-api-key"
                  trailing="button"
                  trailingButton={
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!draft.apiKey.trim()}
                      state={testing ? "loading" : "normal"}
                      onClick={testConnection}
                    >
                      测试连接
                    </Button>
                  }
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.apiKey}
                  aria-describedby={
                    connectionStatus ? "connection-status" : undefined
                  }
                  onValueChange={(value) => {
                    modelRequest.current++;
                    setTesting(false);
                    setConnectionStatus("");
                    setModels([]);
                    updateSettings((d) => ({ ...d, apiKey: value }));
                  }}
                  placeholder="sk-…"
                />
              </Field>
            ) : (
              <p className="help">
                照片经衣集转发给 OpenAI。每个 IP 每天 100 次请求，北京时间零点重置。
              </p>
            )}
            {draft.apiMode === "byok" && connectionStatus && (
              <p
                id="connection-status"
                role="status"
                className="connection-status"
              >
                {connectionStatus}
              </p>
            )}
            <div className="processing-option">
              <div>
                <label htmlFor="generate-transparent">生成透明图</label>
                <p className="help">关闭后仅识别标签，保留原图。</p>
              </div>
              <Switch
                id="generate-transparent"
                aria-label="生成透明图"
                checked={draft.generateTransparent}
                onCheckedChange={(checked) =>
                  updateSettings((d) => ({
                    ...d,
                    generateTransparent: checked,
                  }))
                }
              />
            </div>
          </div>
          <Disclosure className="settings-card" title="模型选择">
            <Field label="透明图模型">
              <Combobox
                disabled={!draft.generateTransparent}
                aria-label="透明图模型"
                width="fill"
                value={draft[imageModelField]}
                items={modelOptions("image")}
                placeholder="搜索或选择模型"
                emptyText="没有匹配的模型"
                triggerLabel="展开透明图模型"
                onValueChange={(value) =>
                  value &&
                  updateSettings((d) => ({ ...d, [imageModelField]: value }))
                }
              />
            </Field>
            <Field label="标签识别模型">
              <Combobox
                aria-label="标签识别模型"
                width="fill"
                value={draft[tagModelField]}
                items={modelOptions("tags")}
                placeholder="搜索或选择模型"
                emptyText="没有匹配的模型"
                triggerLabel="展开标签识别模型"
                onValueChange={(value) =>
                  value && updateSettings((d) => ({ ...d, [tagModelField]: value }))
                }
              />
            </Field>
            {!defaultMode && (
              <p className="help">
                透明图模型需支持图片编辑和透明输出。标签模型需支持视觉输入和结构化输出。
              </p>
            )}
          </Disclosure>
          <Disclosure
            className="settings-card prompt-settings"
            title="自定义 Prompt"
          >
            <div className="row-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateSettings((d) => ({
                    ...d,
                    imagePrompt: DEFAULTS.imagePrompt,
                    tagPrompt: DEFAULTS.tagPrompt,
                  }))
                }
              >
                恢复默认 Prompt
              </Button>
            </div>
            <Field label="透明图 Prompt">
              <InputArea
                rows={7}
                value={draft.imagePrompt}
                onChange={(e) =>
                  updateSettings((d) => ({ ...d, imagePrompt: e.target.value }))
                }
              />
            </Field>
            <Field
              label="标签 Prompt"
              hint="输出结构固定为 coarse 与 fine；粗分类使用相册内的八个分类。"
            >
              <InputArea
                rows={6}
                value={draft.tagPrompt}
                onChange={(e) =>
                  updateSettings((d) => ({ ...d, tagPrompt: e.target.value }))
                }
              />
            </Field>
          </Disclosure>
          <Disclosure className="privacy-settings" title="数据与隐私">
            <p>相册保存在此浏览器，未加密。清除网站数据会删除相册，请定期导出。</p>
          </Disclosure>
        </div>
      </SheetBasic>
      <SheetBasic
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title="衣服详情"
        width={600}
        heightMode="auto"
        minHeight="none"
        adaptiveHeight
        contentOverflow="scroll"
        contentDivider
        className="detail-sheet"
        closeLabel="关闭详情"
        hideActions
      >
        {current && (
          <div className="detail">
            <div className="detail-photo checker">
              <Photo
                blob={
                  viewOriginal
                    ? (current.preparedBlob ?? current.originalBlob)
                    : (current.transparentBlob ??
                      current.preparedBlob ??
                      current.originalBlob)
                }
                alt={
                  viewOriginal || !current.transparentBlob
                    ? "保留的原图"
                    : `${current.coarse}透明图`
                }
              />
            </div>
            <div className="row-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={!current.transparentBlob}
                onClick={() => setViewOriginal((v) => !v)}
              >
                {!current.transparentBlob
                  ? "原图"
                  : viewOriginal
                    ? "查看透明图"
                    : "查看原图"}
              </Button>
              <small>
                {current.transparentBlob
                  ? "透明 PNG 已保存"
                  : current.imageSkipped
                    ? "仅识别标签"
                    : "透明图待生成"}
              </small>
            </div>
            <Field label="粗分类">
              <Dropdown
                width="fill"
                value={editCategory}
                onValueChange={(value) => value && setEditCategory(value)}
                disabled={!!busy[current.id]?.includes("tags")}
                items={CATEGORIES.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="细标签" hint="使用逗号分隔，可自由增减。">
              <Input
                value={editTags}
                onValueChange={setEditTags}
                disabled={!!busy[current.id]?.includes("tags")}
              />
            </Field>
            <div className="row">
              <Button
                variant="fill"
                disabled={!!busy[current.id]?.includes("tags")}
                state={detailSaving === current.id ? "loading" : "normal"}
                onClick={async () => {
                  if (detailSaving === current.id) return;
                  setDetailSaving(current.id);
                  setDetailSaveError("");
                  try {
                    await patchClothes(current.id, {
                      coarse: editCategory,
                      fine: [
                        ...new Set(
                          editTags
                            .split(/[,，、\n]/)
                            .map((t) => t.trim())
                            .filter(Boolean),
                        ),
                      ],
                      tagsDone: true,
                      tagError: null,
                    });
                    await refresh();
                    notify("标签已保存", "success");
                  } catch (e) {
                    if (detailRef.current === current.id)
                      setDetailSaveError(
                        "标签保存失败，已保留填写内容。请重试。",
                      );
                    fail(e);
                  } finally {
                    setDetailSaving(null);
                  }
                }}
              >
                保存标签
              </Button>
              <Button
                variant="outline"
                disabled={
                  (!current.transparentBlob &&
                    (!current.imageSkipped || !current.tagsDone)) ||
                  !!busy[current.id] ||
                  queue.includes(current.id)
                }
                state={exporting ? "loading" : "normal"}
                onClick={() => exportItems([current.id])}
              >
                <DownloadSimpleIcon />
                导出
              </Button>
            </div>
            {detailSaveError && (
              <Alert
                color="red"
                border={false}
                text={detailSaveError}
                className="context-alert"
              />
            )}
            {(current.imageError || current.tagError) && (
              <Alert
                className="context-alert"
                color="red"
                border={false}
                text="部分处理未完成"
                info="textDescription"
                description={
                  <>
                    {current.imageError && <p>透明图：{current.imageError}</p>}
                    {current.tagError && <p>标签：{current.tagError}</p>}
                  </>
                }
              />
            )}
            <div className="detail-regenerate">
              <h3>重新处理</h3>
              <p>成功后替换旧图；重新识别会覆盖标签。</p>
              <div className="row wrap">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !!busy[current.id] || queue.includes(current.id) || offline
                  }
                  onClick={() => processItem(current.id, "image")}
                >
                  <ArrowClockwiseIcon />
                  {current.transparentBlob ? "重新生成透明图" : "生成透明图"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !!busy[current.id] || queue.includes(current.id) || offline
                  }
                  onClick={() => setConfirmRetag(current.id)}
                >
                  重新识别标签
                </Button>
                {missingSteps(current).length > 0 && (
                  <Button
                    size="sm"
                    variant="light"
                    disabled={
                      !!busy[current.id] ||
                      queue.includes(current.id) ||
                      offline
                    }
                    onClick={() => processItem(current.id)}
                  >
                    重试未完成步骤
                  </Button>
                )}
              </div>
              {busy[current.id] && (
                <p role="status">正在处理，请保持页面打开…</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteError("");
                setConfirmDelete([current.id]);
              }}
            >
              <TrashIcon />
              删除这件衣服
            </Button>
          </div>
        )}
      </SheetBasic>
      <DialogBasic
        open={!!confirmRetag}
        onOpenChange={(open) => {
          if (!open) setConfirmRetag(null);
        }}
        title="重新识别标签？"
        closeLabel="关闭重新识别确认"
        aria-describedby="retag-description"
        primaryAction={{
          label: "重新识别",
          onClick: () => {
            const id = confirmRetag;
            setConfirmRetag(null);
            if (id) void processItem(id, "tags");
          },
        }}
        secondaryAction={{
          label: "取消",
          onClick: () => setConfirmRetag(null),
        }}
      >
        <BaseDialog.Description id="retag-description">
          重新识别将覆盖你编辑的分类和标签。
        </BaseDialog.Description>
      </DialogBasic>
      <DialogBasic
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={`删除 ${confirmDelete?.length ?? 0} 件衣服？`}
        aria-describedby="delete-description"
        closeLabel="关闭"
        primaryAction={{
          label: "删除",
          destructive: true,
          loading: deleting,
          onClick: async () => {
            if (deleting) return;
            setDeleting(true);
            setDeleteError("");
            try {
              await remove(confirmDelete);
              setConfirmDelete(null);
              notify("已删除所选衣服");
            } catch (e) {
              setDeleteError("删除失败，请重试。");
              fail(e);
            } finally {
              setDeleting(false);
            }
          },
        }}
        secondaryAction={{
          label: "取消",
          onClick: () => setConfirmDelete(null),
        }}
      >
        <BaseDialog.Description id="delete-description">
          透明图、原图和标签都会从本机删除，无法恢复。
        </BaseDialog.Description>
        {deleteError && (
          <Alert
            color="red"
            border={false}
            text={deleteError}
            className="context-alert"
          />
        )}
      </DialogBasic>
    </div>
  );
}
createRoot(document.getElementById("app")!).render(
  <UiProvider>
    <App />
  </UiProvider>,
);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch(() => {}),
  );
