import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Shuffle, Save, Lock, Globe2, ImageIcon, Palette, Trash2 } from "lucide-react";
import { api } from "../api";
import { useStore } from "../store";
import { Wisp } from "../ui";
import {
  OPTIONS,
  HAIR_LABEL,
  avatarSVG,
  svgUrl,
  defaultSpec,
  loadImage,
  cropTo,
  stylize,
  softFocus,
  toJpeg,
  type FaceSpec,
  type Crop,
  type PhotoStyle,
} from "../faces";

const STYLES: { id: PhotoStyle; label: string; hint: string }[] = [
  { id: "natural", label: "Natural", hint: "Your photo as it is" },
  { id: "dreamy", label: "Dreamy", hint: "Duotone glow in your colour" },
  { id: "painted", label: "Painted", hint: "Bold, poster-like" },
];

function Swatch({ color, on, onClick, label }: { color: string; on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={"swatch" + (on ? " on" : "")}
      style={{ background: color }}
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
    />
  );
}

function Illustrated({ spec, setSpec, hue, seed }: { spec: FaceSpec; setSpec: (s: FaceSpec) => void; hue: number; seed: string }) {
  return (
    <div className="face-options">
      {OPTIONS.map((o) => (
        <div key={o.key} className="face-opt">
          <span className="face-opt-label">{o.label}</span>
          <div className="face-choices">
            {o.choices.map((c, i) =>
              c.startsWith("#") ? (
                <Swatch key={c} color={c} on={spec[o.key] === i} onClick={() => setSpec({ ...spec, [o.key]: i })} label={`${o.label} ${i + 1}`} />
              ) : o.key === "hair" ? (
                <button
                  type="button"
                  key={c}
                  className={"hair-pick" + (spec.hair === i ? " on" : "")}
                  onClick={() => setSpec({ ...spec, hair: i })}
                  aria-pressed={spec.hair === i}
                  title={HAIR_LABEL[i]}
                >
                  <img src={svgUrl(avatarSVG({ ...spec, hair: i }, hue, seed))} alt="" />
                  <small>{c}</small>
                </button>
              ) : (
                <button
                  type="button"
                  key={c}
                  className={"chip-pick" + (spec[o.key] === i ? " on" : "")}
                  onClick={() => setSpec({ ...spec, [o.key]: i })}
                  aria-pressed={spec[o.key] === i}
                >
                  {c}
                </button>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhotoEditor({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (v: { photo: string; public: string } | null) => void;
}) {
  const { notify } = useStore();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1.2, x: 0, y: -0.15 });
  const [style, setStyle] = useState<PhotoStyle>("natural");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [over, setOver] = useState(false);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const open = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose an image file (JPEG, PNG or WebP).", "err");
    if (file.size > 15e6) return notify("That photo is over 15 MB. Try a smaller one.", "err");
    const url = URL.createObjectURL(file);
    try {
      setImg(await loadImage(url));
      setCrop({ zoom: 1.2, x: 0, y: -0.15 });
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  useEffect(() => {
    if (!img) return onChange(null);
    const base = cropTo(img, crop);
    const out: Record<string, string> = {};
    for (const s of STYLES) out[s.id] = toJpeg(stylize(base, s.id, hue));
    out.soft = toJpeg(softFocus(base, hue));
    setPreview(out);
    onChange({ photo: out[style], public: out.soft, style } as any);
  }, [img, crop, style, hue]);

  if (!img)
    return (
      <div
        className={"dropzone" + (over ? " over" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          open(e.dataTransfer.files?.[0]);
        }}
      >
        <Upload size={26} />
        <strong>Drop a photo of yourself</strong>
        <span>or</span>
        <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>
          Choose a photo
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => open(e.target.files?.[0])} />
        <small>A clear, front-facing photo works best. It's cropped to a circle and shrunk in your browser before saving.</small>
      </div>
    );

  return (
    <div className="photo-editor">
      <div
        className="cropper"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const k = 2.2 / (220 * Math.max(0.2, crop.zoom - 0.95));
          const clamp = (v: number) => Math.max(-1, Math.min(1, v));
          setCrop({ ...crop, x: clamp(drag.current.cx - (e.clientX - drag.current.x) * k), y: clamp(drag.current.cy - (e.clientY - drag.current.y) * k) });
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => setCrop({ ...crop, zoom: Math.max(1, Math.min(3, crop.zoom - e.deltaY * 0.0015)) })}
      >
        {preview[style] && <img src={preview[style]} alt="Your cropped photo" draggable={false} />}
        <span className="crop-hint">Drag to position</span>
      </div>
      <label className="zoom">
        Zoom
        <input
          id="face-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => setCrop({ ...crop, zoom: +e.target.value })}
        />
      </label>
      <div className="styles" role="radiogroup" aria-label="Photo style">
        {STYLES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={style === s.id ? "on" : ""} onClick={() => setStyle(s.id)}>
            {preview[s.id] && <img src={preview[s.id]} alt="" />}
            <strong>{s.label}</strong>
            <small>{s.hint}</small>
          </button>
        ))}
      </div>
      <button type="button" className="link" onClick={() => setImg(null)}>
        Choose a different photo
      </button>
    </div>
  );
}

export function FaceStudio() {
  const { user, setUser, perform, busy, load } = useStore();
  const u = user!;
  const current = u.face as any;
  const [mode, setMode] = useState<"illustrated" | "photo">(current?.kind === "photo" ? "photo" : "illustrated");
  const [spec, setSpec] = useState<FaceSpec>(() => ({ ...defaultSpec(u.id, u.gender), ...(current?.kind === "illustrated" ? current.spec : {}) }));
  const [photo, setPhoto] = useState<{ photo: string; public: string; style: PhotoStyle } | null>(null);
  const [reveal, setReveal] = useState<"mutual" | "everyone">(current?.reveal ?? "mutual");
  const [mine, setMine] = useState(false);

  const draft = useMemo(() => {
    if (mode === "illustrated") return { kind: "illustrated" as const, spec };
    if (photo) return { kind: "photo" as const, photo: photo.photo, public: photo.public };
    if (current?.kind === "photo") return current;
    return null;
  }, [mode, spec, photo, current]);
  const othersSee =
    draft?.kind === "photo" && reveal === "mutual"
      ? { kind: "photo" as const, image: draft.public, locked: true }
      : draft?.kind === "photo"
        ? { kind: "photo" as const, image: draft.photo }
        : draft;

  const save = () =>
    perform(async () => {
      let body: any;
      if (mode === "illustrated") body = { kind: "illustrated", spec };
      else if (photo) {
        if (!mine) throw new Error("Confirm that the photo is of you.");
        body = { kind: "photo", photo: photo.photo, public: photo.public, style: photo.style, reveal };
      } else if (current?.kind === "photo") body = { kind: "photo", photo: current.photo, public: current.public, style: current.style, reveal };
      else throw new Error("Add a photo first, or switch to an illustrated face.");
      setUser(await api("/face", "PUT", body));
      await load();
    }, "Your agent has a new face. You'll see it on the island and on every date.");

  return (
    <div className="face-studio">
      <div className="face-preview">
        <div className="face-stage" style={{ "--h": u.hue } as React.CSSProperties}>
          <Wisp hue={u.hue} size={150} self face={draft as any} seed={u.id} />
          <span className="face-body" />
        </div>
        <strong>{u.name}'s agent</strong>
        {draft?.kind === "photo" && (
          <div className="others-see">
            <Wisp hue={u.hue} size={46} face={othersSee as any} seed={u.id} />
            <span>
              {reveal === "mutual" ? (
                <>
                  <b>Others see this</b> until you're a mutual match.
                </>
              ) : (
                <>
                  <b>Everyone in discovery</b> sees your photo.
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="face-edit">
        <div className="seg face-mode">
          <button type="button" className={mode === "illustrated" ? "on" : ""} onClick={() => setMode("illustrated")}>
            <Palette size={14} /> Illustrated
          </button>
          <button type="button" className={mode === "photo" ? "on" : ""} onClick={() => setMode("photo")}>
            <ImageIcon size={14} /> My photo
          </button>
        </div>

        {mode === "illustrated" ? (
          <>
            <Illustrated spec={spec} setSpec={setSpec} hue={u.hue} seed={u.id} />
            <button type="button" className="btn ghost sm" onClick={() => setSpec(defaultSpec(u.id + Math.random(), u.gender))}>
              <Shuffle size={14} /> Surprise me
            </button>
          </>
        ) : (
          <>
            <PhotoEditor hue={u.hue} onChange={(v) => setPhoto(v as any)} />
            <fieldset className="reveal">
              <legend>Who sees your real photo?</legend>
              <label className={"reveal-opt" + (reveal === "mutual" ? " on" : "")}>
                <input type="radio" name="reveal" checked={reveal === "mutual"} onChange={() => setReveal("mutual")} />
                <Lock size={16} />
                <span>
                  <b>Only mutual matches</b> (recommended)
                  <small>Everyone else sees a soft-focus version. Your agent's personality does the first introduction.</small>
                </span>
              </label>
              <label className={"reveal-opt" + (reveal === "everyone" ? " on" : "")}>
                <input type="radio" name="reveal" checked={reveal === "everyone"} onChange={() => setReveal("everyone")} />
                <Globe2 size={16} />
                <span>
                  <b>Everyone in discovery</b>
                  <small>Like a classic matrimonial profile photo.</small>
                </span>
              </label>
            </fieldset>
            {photo && (
              <label className="check">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
                <span>This is a recent photo of me. I'm not using anyone else's picture.</span>
              </label>
            )}
          </>
        )}

        <div className="face-actions">
          <button className="btn primary" disabled={busy} onClick={save}>
            <Save size={16} /> Save my agent's face
          </button>
          {current?.kind && (
            <button
              className="btn ghost sm"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  setUser(await api("/face", "PUT", { kind: "none" }));
                  await load();
                }, "Face removed. Your agent uses a generated face for now.")
              }
            >
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
