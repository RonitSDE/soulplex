import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X, Sparkles, ShieldCheck, MessageCircle } from "lucide-react";
import { api } from "../api";
import { useStore } from "../store";
import { Wisp } from "../ui";

type Option = { id: string; label: string };
type Field = {
  field_id: string;
  prompt: string;
  kind: string;
  required: boolean;
  maximum: number;
  skip: boolean;
  text_max: number;
  options: Option[];
  trigger?: string;
};
type Schema = {
  fields: Field[];
  calibration: { id: string; title: string; prompt: string; options: Option[] }[];
  calibration_order: string[];
  unseen: { id: string; title: string; prompt: string; options: Option[] }[];
  consents: { id: string; label: string; default: boolean }[];
};
type Answer = { field_id: string; option_ids: string[]; free_text: string; status: string; permission_scope?: string };
type Cal = { scenario_id: string; owner_locked?: boolean; twin_locked?: boolean; twin_option?: string; twin_summary?: string; rating?: string; owner_option?: string };

const STEPS = ["welcome", "privacy", "age", "mode", "Q01_gender", "Q01_seeking", "ages", "Q01_distance", "Q02", "Q03", "Q04", "Q05", "preview", "calibration", "facts", "permissions", "ready"] as const;

const COPY: Record<string, { title: string; hint: string }> = {
  welcome: { title: "Meet your twin", hint: "A short beginning. You can leave and come back." },
  privacy: { title: "Before any questions", hint: "A notice is not blanket consent. Every share stays off until you turn it on." },
  age: { title: "Adults only", hint: "This check is separate from the ages you hope to meet." },
  mode: { title: "How do you want to teach?", hint: "Taps and conversation save the same answers." },
  Q01_gender: { title: "Who could feel right", hint: "First, the basics. I will only explore mutually eligible people." },
  Q01_seeking: { title: "Who you'd like to meet", hint: "Open to all genders stands on its own." },
  ages: { title: "Age and city", hint: "A preference range never replaces your own adult check." },
  Q01_distance: { title: "Where should your twin look?", hint: "Cross-city discovery only happens if you both choose it." },
  Q02: { title: "What kind of connection", hint: "Required. There is no skip on this one." },
  Q03: { title: "A definite no?", hint: "Skip leaves this unknown. None for now is an explicit choice." },
  Q04: { title: "What would make you look twice?", hint: "Up to three. There isn’t a right mix." },
  Q05: { title: "Choose your first scene", hint: "Where would you feel most yourself? Skip is not the same as Surprise me." },
  preview: { title: "Your twin, so far", hint: "A mirror of what you chose. Not a personality reading." },
  calibration: { title: "A tiny challenge", hint: "Your twin answers before it sees what you chose." },
  facts: { title: "Each fact has a permission", hint: "Private, inside your twin, or shareable. Sharing starts off." },
  permissions: { title: "Twin Permission Center", hint: "Every optional switch starts off." },
  ready: { title: "Your twin is in your hands", hint: "Private is a complete choice. Matching waits for your permission." },
};

function fieldOf(schema: Schema | null, id: string) {
  return schema?.fields.find((f) => f.field_id === id);
}

export function Studio({ onClose }: { start?: number; onClose: () => void }) {
  const { user, perform, busy, setUser, load } = useStore();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [mode, setMode] = useState<"taps" | "talk">("taps");
  const [talk, setTalk] = useState("");
  const [guess, setGuess] = useState<Option | null>(null);
  const [note, setNote] = useState("");
  const [ageMin, setAgeMin] = useState(user?.age_min ?? 25);
  const [ageMax, setAgeMax] = useState(user?.age_max ?? 40);
  const [city, setCity] = useState(user?.city || "Dubai");
  const [preview, setPreview] = useState<string[]>([]);
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  const [calI, setCalI] = useState(0);
  const [phase, setPhase] = useState<"owner" | "twin" | "review">("owner");
  const [cals, setCals] = useState<Record<string, Cal>>({});
  const [grants, setGrants] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState("");
  const [fidelity, setFidelity] = useState("");

  useEffect(() => {
    perform(async () => {
      const [s, state] = await Promise.all([api<Schema>("/onboarding/schema"), api<any>("/onboarding")]);
      setSchema(s);
      const map: Record<string, Answer> = {};
      for (const a of state.answers as Answer[]) map[a.field_id] = a;
      setAnswers(map);
      setGrants(state.consents || {});
      const saved: Record<string, Cal> = {};
      for (const c of state.calibration as Cal[]) saved[c.scenario_id] = c;
      setCals(saved);
      if (state.fidelity?.label) setFidelity(state.fidelity.label);
      const resume = STEPS.indexOf(state.studio?.step);
      if (resume > 0) setStep(resume);
      if (state.studio?.mode === "talk") setMode("talk");
    });
  }, []);

  const id = STEPS[step];
  const field = fieldOf(schema, id);
  const selected = answers[id]?.option_ids ?? [];
  const cal = schema?.calibration[calI];

  const saveAnswer = (fieldId: string, optionIds: string[], status = "answered", free = note) =>
    perform(async () => {
      const row = await api<Answer>("/onboarding/answers/" + fieldId, "PUT", {
        option_ids: optionIds,
        free_text: free,
        status,
        mode,
      });
      setAnswers((prev) => ({ ...prev, [fieldId]: row }));
      setNote("");
      setGuess(null);
      setTalk("");
    });

  const exit = () =>
    perform(async () => {
      await api("/onboarding/state", "PUT", { step: id, mode });
      onClose();
    }, "Saved. You can resume this step.");

  const next = () => setStep((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setStep((n) => Math.max(0, n - 1));

  const toggle = (option: Option) => {
    if (!field) return;
    if (field.kind === "single" || option.id === "any" || option.id === "none") {
      saveAnswer(field.field_id, selected.length === 1 && selected[0] === option.id ? [] : [option.id]).then?.(() => {});
      setAnswers((prev) => ({
        ...prev,
        [field.field_id]: { field_id: field.field_id, option_ids: [option.id], free_text: "", status: "answered" },
      }));
      return;
    }
    const has = selected.includes(option.id);
    let ids = has ? selected.filter((x) => x !== option.id) : [...selected.filter((x) => x !== "any" && x !== "none"), option.id];
    ids = ids.slice(0, field.maximum);
    setAnswers((prev) => ({
      ...prev,
      [field.field_id]: { field_id: field.field_id, option_ids: ids, free_text: note, status: "answered" },
    }));
  };

  const commitMulti = () => {
    if (!field || !selected.length) return;
    saveAnswer(field.field_id, selected).then((ok) => ok && next());
  };

  const hear = () => {
    if (!field) return;
    const text = talk.toLowerCase();
    const hit = field.options.find((o) => text.includes(o.label.toLowerCase()) || text.includes(o.id.replaceAll("_", " ")));
    setGuess(hit ?? null);
  };

  const loadPreview = () =>
    perform(async () => {
      const body = await api<{ lines: string[] }>("/onboarding/preview", "POST");
      setPreview(body.lines);
      setKeep(Object.fromEntries(body.lines.map((line) => [line, true])));
      await api("/onboarding/state", "PUT", { step: "preview", mode });
    });

  useEffect(() => {
    if (id === "preview" && !preview.length) loadPreview();
  }, [id]);

  const scene = cal;
  const savedCal = scene ? cals[scene.id] : undefined;

  const lockOwner = (optionId: string) =>
    perform(async () => {
      if (!scene) return;
      const row = await api<Cal>("/calibration/" + scene.id + "/owner", "POST", {
        option_ids: [optionId],
        status: "answered",
        free_text: note,
      });
      setCals((prev) => ({ ...prev, [scene.id]: row }));
      setPhase("twin");
      setNote("");
    });

  const runTwin = () =>
    perform(async () => {
      if (!scene) return;
      try {
        const row = await api<Cal>("/calibration/" + scene.id + "/run", "POST");
        setCals((prev) => ({ ...prev, [scene.id]: row }));
        setPhase("review");
      } catch (err) {
        setPhase("review");
        setCals((prev) => ({ ...prev, [scene!.id]: { ...(prev[scene!.id] || { scenario_id: scene!.id }), twin_summary: err instanceof Error ? err.message : "Not completed." } }));
      }
    });

  const rate = (rating: string) =>
    perform(async () => {
      if (!scene || !savedCal?.twin_option) return;
      const row = await api<Cal>("/calibration/" + scene.id + "/review", "POST", { rating, correction: note });
      setCals((prev) => ({ ...prev, [scene.id]: row }));
      setNote("");
      if (calI < (schema?.calibration.length ?? 1) - 1) {
        setCalI(calI + 1);
        setPhase("owner");
      } else next();
    });

  const finishPermissions = () =>
    perform(async () => {
      await api("/privacy/permissions", "PUT", { grants });
      const auth = await api<{ readiness: string; fidelity: { label: string } }>("/twin/authorize", "POST");
      setReady(auth.readiness);
      setFidelity(auth.fidelity.label);
      await load();
      next();
    });

  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const copy = COPY[id] ?? COPY.welcome;

  return (
    <div className="wizard-backdrop">
      <div className="wizard studio-flow glass" role="dialog" aria-modal="true" aria-label="Teach your twin">
        <header className="studio-top">
          <button className="icon-btn" aria-label="Back" onClick={back} disabled={step === 0}>
            <ArrowLeft size={18} />
          </button>
          <div className="studio-meter" aria-hidden="true"><i style={{ width: progress + "%" }} /></div>
          <button className="link" onClick={exit}>Save and exit</button>
          <button className="icon-btn" aria-label="Close setup" onClick={exit}><X size={18} /></button>
        </header>
        <div className="w-body studio-body">
          <Wisp hue={user?.hue ?? 330} size={54} self face={user?.face} seed={user?.id} />
          <p className="eyebrow">Teach your twin</p>
          <h2>{copy.title}</h2>
          <p className="hint">{copy.hint}</p>

          {id === "welcome" && (
            <button className="btn primary" onClick={next}>Begin <ArrowRight size={16} /></button>
          )}
          {id === "privacy" && (
            <div className="studio-note">
              <ShieldCheck size={18} />
              <p>Soulplex stores the choices you confirm. Skipped questions stay unknown. Your twin cannot share a fact, join a virtual date, or send data to an outside provider until you allow that specific use.</p>
              <button className="btn primary" onClick={next}>I’ve read this</button>
            </div>
          )}
          {id === "age" && (
            <button className="btn primary" disabled={busy} onClick={() => perform(async () => { await api("/onboarding/age", "POST", { adult: true }); next(); })}>
              I am 18 or older
            </button>
          )}
          {id === "mode" && (
            <div className="w-chips big">
              <button className={mode === "taps" ? "on" : ""} onClick={() => { setMode("taps"); next(); }}>Quick taps</button>
              <button className={mode === "talk" ? "on" : ""} onClick={() => { setMode("talk"); next(); }}><MessageCircle size={14} /> Talk to my twin</button>
            </div>
          )}
          {id === "ages" && (
            <div className="studio-ages">
              <label>From {ageMin}<input type="range" min={18} max={100} value={ageMin} onChange={(e) => setAgeMin(Math.min(+e.target.value, ageMax))} /></label>
              <label>To {ageMax}<input type="range" min={18} max={100} value={ageMax} onChange={(e) => setAgeMax(Math.max(+e.target.value, ageMin))} /></label>
              <label>City
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option>Dubai</option>
                  <option>Delhi NCR</option>
                </select>
              </label>
              <button className="btn primary" disabled={busy} onClick={() => perform(async () => {
                await api("/onboarding/range", "PUT", { age_min: ageMin, age_max: ageMax, city });
                await load();
                next();
              })}>Continue</button>
            </div>
          )}
          {field && id !== "ages" && (
            <>
              {mode === "talk" && (
                <div className="studio-talk">
                  <textarea value={talk} maxLength={400} placeholder="Say it in your own words. I'll match it to a choice for you to confirm." onChange={(e) => setTalk(e.target.value)} />
                  <button className="btn ghost sm" type="button" onClick={hear}>Match a choice</button>
                  {guess && <p className="fine">I heard “{guess.label}”. That is a choice, not a personality claim.</p>}
                  {talk && !guess && <p className="fine">I couldn’t match that to a listed choice. Pick one below, or skip if this question allows it.</p>}
                </div>
              )}
              <div className="w-chips big">
                {field.options.map((o) => (
                  <button key={o.id} type="button" className={selected.includes(o.id) || guess?.id === o.id ? "on" : ""} aria-pressed={selected.includes(o.id)} onClick={() => {
                    if (field.kind === "single") {
                      saveAnswer(field.field_id, [o.id]).then((ok) => ok && next());
                    } else toggle(o);
                  }}>{o.label}</button>
                ))}
              </div>
              {(selected.includes("other") || selected.includes("depends")) && field.text_max > 0 && (
                <textarea value={note} maxLength={field.text_max} placeholder="Optional note. It stays private until you approve it." onChange={(e) => setNote(e.target.value)} />
              )}
              <div className="btn-row">
                {field.kind === "multi" && <button className="btn primary" disabled={!selected.length || busy} onClick={commitMulti}>Continue</button>}
                {field.skip && <button className="btn ghost" disabled={busy} onClick={() => { saveAnswer(field.field_id, [], "skipped", "").then((ok) => ok && next()); }}>Skip for now</button>}
              </div>
            </>
          )}
          {id === "preview" && (
            <div className="studio-preview">
              {preview.map((line) => (
                <label key={line} className="studio-line">
                  <input type="checkbox" checked={keep[line] !== false} onChange={(e) => setKeep({ ...keep, [line]: e.target.checked })} />
                  <span>{line}</span>
                </label>
              ))}
              {!preview.length && <p className="fine">Answer a few choices and your twin will mirror them here.</p>}
              <p className="fine">Nothing here is a score. Uncheck a line to leave it out. Saved lines stay private until you change that.</p>
              <button className="btn primary" disabled={busy} onClick={() => perform(async () => {
                const lines = preview.filter((line) => keep[line] !== false);
                if (lines.length) await api("/onboarding/preview/approve", "POST", { lines });
                next();
              })}><Sparkles size={15} /> This sounds like me</button>
            </div>
          )}
          {id === "calibration" && scene && (
            <div className="studio-cal">
              <p className="eyebrow">Challenge {calI + 1} of {schema?.calibration.length} · {scene.id}</p>
              <h3>{scene.title}</h3>
              <p>{scene.prompt}</p>
              {phase === "owner" && (
                <div className="w-chips big">
                  {scene.options.map((o) => (
                    <button key={o.id} type="button" disabled={busy} onClick={() => lockOwner(o.id)}>{o.label}</button>
                  ))}
                </div>
              )}
              {phase === "twin" && (
                <div className="studio-note">
                  <p>Your answer is locked away. Your twin only sees facts you have already approved.</p>
                  <button className="btn primary" disabled={busy} onClick={runTwin}>Ask my twin</button>
                </div>
              )}
              {phase === "review" && (
                <div className="studio-review">
                  <p><b>You:</b> {scene.options.find((o) => o.id === savedCal?.owner_option)?.label}</p>
                  <p><b>Your twin:</b> {savedCal?.twin_option ? scene.options.find((o) => o.id === savedCal.twin_option)?.label : "Not completed"}</p>
                  {savedCal?.twin_summary && <p className="fine">{savedCal.twin_summary}</p>}
                  {savedCal?.twin_option && (
                    <div className="w-chips">
                      <button type="button" onClick={() => rate("yes")}>Yes, that feels like me</button>
                      <button type="button" onClick={() => rate("somewhat")}>Somewhat - I would do it differently</button>
                      <button type="button" onClick={() => rate("no")}>No - not like me</button>
                    </div>
                  )}
                  <textarea value={note} maxLength={600} placeholder="Optional correction. It stays a proposal until you approve it." onChange={(e) => setNote(e.target.value)} />
                  {!savedCal?.twin_option && <button className="btn ghost" onClick={() => { setCalI(0); next(); }}>Finish this later</button>}
                </div>
              )}
            </div>
          )}
          {id === "facts" && (
            <div className="studio-facts">
              {Object.values(answers).filter((a) => a.status === "answered").map((a) => (
                <article key={a.field_id}>
                  <b>{COPY[a.field_id]?.title || a.field_id}</b>
                  <div className="w-chips">
                    {(["private", "twin", "shareable"] as const).map((scope) => (
                      <button key={scope} type="button" className={(a.permission_scope || "private") === scope ? "on" : ""} onClick={() => perform(async () => {
                        const grantsNow = grants.allow_shareable_facts ? grants : { ...grants, allow_shareable_facts: scope === "shareable" };
                        if (scope === "shareable" && !grants.allow_shareable_facts) {
                          await api("/privacy/permissions", "PUT", { grants: { ...grantsNow, allow_shareable_facts: true } });
                          setGrants({ ...grantsNow, allow_shareable_facts: true });
                        }
                        const row = await api<Answer>("/onboarding/facts/" + a.field_id, "PUT", { field_id: a.field_id, permission_scope: scope });
                        setAnswers((prev) => ({ ...prev, [a.field_id]: row }));
                      })}>{scope === "twin" ? "Twin only" : scope === "shareable" ? "Shareable" : "Private"}</button>
                    ))}
                  </div>
                </article>
              ))}
              <button className="btn primary" onClick={next}>Continue</button>
            </div>
          )}
          {id === "permissions" && schema && (
            <div className="studio-perms">
              {schema.consents.map((c) => (
                <label key={c.id} className="switch big">
                  <input type="checkbox" checked={!!grants[c.id]} onChange={(e) => setGrants({ ...grants, [c.id]: e.target.checked })} />
                  <i />
                  <span>{c.label}</span>
                </label>
              ))}
              <button className="btn primary" disabled={busy} onClick={finishPermissions}>Save permissions</button>
            </div>
          )}
          {id === "ready" && (
            <div className="studio-note">
              <p>{ready === "ready" ? "Matching and virtual dates are on, inside the permissions you set." : ready === "local_only" ? "Your twin stays on this device’s rules. Outside processing is off." : "Your twin stays private. You can turn matching on later in Settings."}</p>
              {fidelity && <p className="fine">{fidelity}</p>}
              <button className="btn primary" onClick={onClose}><Check size={16} /> Done for now</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CoachCard({ trigger }: { trigger: string }) {
  const { perform } = useStore();
  const [field, setField] = useState<Field | null>(null);
  const [hidden, setHidden] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api<Schema>("/onboarding/schema").then(async (s) => {
      const state = await api<{ answers: Answer[] }>("/onboarding");
      const answered = new Set(state.answers.map((a) => a.field_id));
      const nextField = s.fields.find((f) => {
        if (answered.has(f.field_id)) return false;
        if (trigger === "agent") return f.field_id.startsWith("S0");
        return f.trigger === trigger;
      });
      setField(nextField ?? null);
    }).catch(() => setField(null));
  }, [trigger, tick]);
  if (!field || hidden) return null;
  return (
    <section className="glass card coach-card">
      <p className="eyebrow">Optional · {field.field_id}</p>
      <h3>{field.prompt}</h3>
      <div className="w-chips">
        {field.options.map((o) => (
          <button key={o.id} type="button" onClick={() => perform(async () => {
            await api("/onboarding/answers/" + field.field_id, "PUT", { option_ids: [o.id], status: "answered" });
            setHidden(false);
            setTick((n) => n + 1);
          })}>{o.label}</button>
        ))}
      </div>
      <button className="link" onClick={() => perform(async () => {
        await api("/onboarding/answers/" + field.field_id, "PUT", { option_ids: [], status: "skipped" });
        setHidden(true);
      })}>Skip for now</button>
    </section>
  );
}
