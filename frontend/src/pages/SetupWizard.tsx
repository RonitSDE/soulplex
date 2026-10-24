import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X, Sparkles, Send, ShieldCheck } from "lucide-react";
import { api, type User } from "../api";
import { useStore } from "../store";
import { Wisp } from "../ui";
import { FIELDS, PROMPTS, DEALBREAKERS, SCENES, heightLabel, type About } from "../about";
import { aboutFacts } from "../aboutLogic";
import { FaceStudio } from "./FaceStudio";

const STEPS = [
  { id: "you", title: "About you", hint: "The basics people look for first." },
  { id: "looking", title: "What you want", hint: "Your agent only meets people who want the same thing." },
  { id: "scene", title: "First scene", hint: "Where would you feel most yourself? We can always explore somewhere else later." },
  { id: "life", title: "Everyday life", hint: "Small habits make big differences." },
  { id: "heart", title: "Faith & love", hint: "Optional, but powerful for finding the right match." },
  { id: "prompts", title: "Your voice", hint: "Answer up to three prompts. Your agent quotes them on dates." },
  { id: "face", title: "Your face", hint: "How your agent looks on the island and on dates." },
  { id: "musts", title: "Must-haves", hint: "Hard filters. Your agent won't meet anyone who doesn't fit them." },
];

function Choice({
  field,
  value,
  onChange,
}: {
  field: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const f = FIELDS[field];
  const multi = f.multi;
  const sel: string[] = multi ? value ?? [] : value ? [value] : [];
  return (
    <div className="w-field">
      <span className="w-label">
        <i>{f.icon}</i> {f.label}
      </span>
      <div className="w-chips">
        {f.options.map(([v, l, ic]) => {
          const on = sel.includes(v);
          return (
            <button
              type="button"
              key={v}
              className={on ? "on" : ""}
              aria-pressed={on}
              onClick={() => {
                if (!multi) return onChange(on ? undefined : v);
                const next = on ? sel.filter((x) => x !== v) : [...sel, v].slice(-multi);
                onChange(next);
              }}
            >
              {ic && <span>{ic}</span>} {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SetupWizard({ start = 0, onClose }: { start?: number; onClose: () => void }) {
  const { user, setUser, perform, busy, load, notify, go, loadScenes } = useStore();
  const u = user!;
  const [step, setStep] = useState(start);
  const [a, setA] = useState<About>(() => ({ ...(u.about ?? {}) }));
  const [p, setP] = useState(() => ({
    name: u.name, age: u.age, city: u.city, gender: u.gender, seeking: u.seeking, age_min: u.age_min,
    age_max: u.age_max, intent: u.intent, contact: u.contact, discovery: u.discovery,
  }));
  const set = (k: keyof About, v: any) => setA((x) => ({ ...x, [k]: v }));
  const known = useMemo(() => aboutFacts(a), [a]);
  const before = useMemo(() => aboutFacts(u.about ?? {}).length, [u.about]);

  const save = async () => {
    const prof: User = await api("/profile", "PUT", p);
    const clean: any = { ...a, prompts: (a.prompts ?? []).filter((x) => x.answer?.trim().length >= 2) };
    const updated: User = await api("/about", "PUT", clean);
    setUser({ ...prof, ...updated });
    await load();
  };

  const next = () =>
    perform(async () => {
      if (STEPS[step].id !== "face") await save();
      if (step < STEPS.length - 1) setStep(step + 1);
    });

  const finish = (send: boolean) =>
    perform(async () => {
      await save();
      onClose();
      if (send) {
        const r = await api("/agent/explore", "POST", { count: 3 });
        notify(r.message);
        await loadScenes();
        go("home");
      } else notify(`Your agent now knows ${known.length} things from your profile.`);
    });

  const prompts = a.prompts ?? [];
  const S = STEPS[step];
  return (
    <div className="wizard-backdrop">
      <div className="wizard glass" role="dialog" aria-modal="true" aria-label="Set up your agent">
        <header className="w-head">
          <div className="w-steps" aria-hidden="true">
            {STEPS.map((s, i) => (
              <button key={s.id} className={(i === step ? "on " : "") + (i < step ? "done" : "")} onClick={() => setStep(i)} title={s.title}>
                <i>{i < step ? <Check size={11} /> : i + 1}</i>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
          <button className="icon-btn" aria-label="Close setup" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="w-body">
          <section className="w-main">
            <span className="eyebrow">
              Step {step + 1} of {STEPS.length}
            </span>
            <h2>{S.title}</h2>
            <p className="fine">{S.hint}</p>

            {S.id === "you" && (
              <>
                <div className="row2">
                  <label>
                    First name
                    <input id="w-name" value={p.name} maxLength={40} onChange={(e) => setP({ ...p, name: e.target.value })} />
                  </label>
                  <label>
                    Age
                    <input id="w-age" type="number" min={18} max={100} value={p.age} onChange={(e) => setP({ ...p, age: +e.target.value })} />
                  </label>
                </div>
                <Choice field="pronouns" value={a.pronouns} onChange={(v) => set("pronouns", v)} />
                <div className="w-field">
                  <span className="w-label">
                    <i>📏</i> Height <b>{a.height_cm ? heightLabel(a.height_cm) : "not set"}</b>
                  </span>
                  <input
                    id="w-height"
                    type="range"
                    min={140}
                    max={210}
                    value={a.height_cm ?? 168}
                    onChange={(e) => set("height_cm", +e.target.value)}
                    className="range"
                  />
                </div>
                <div className="row2">
                  <label>
                    Job title
                    <input id="w-job" placeholder="e.g. a product designer" maxLength={60} value={a.job ?? ""} onChange={(e) => set("job", e.target.value)} />
                  </label>
                  <label>
                    Hometown
                    <input id="w-home" placeholder="e.g. Pune" maxLength={40} value={a.hometown ?? ""} onChange={(e) => set("hometown", e.target.value)} />
                  </label>
                </div>
                <Choice field="education" value={a.education} onChange={(v) => set("education", v)} />
                <Choice field="languages" value={a.languages} onChange={(v) => set("languages", v)} />
              </>
            )}

            {S.id === "looking" && (
              <>
                <div className="w-field">
                  <span className="w-label">
                    <i>💗</i> I'm looking for
                  </span>
                  <div className="w-chips big">
                    {[
                      ["marriage", "Marriage", "💍"],
                      ["relationship", "A serious relationship", "❤️"],
                      ["dating", "Dating, see where it goes", "☕"],
                    ].map(([v, l, i]) => (
                      <button key={v} type="button" className={p.intent === v ? "on" : ""} onClick={() => setP({ ...p, intent: v })}>
                        <span>{i}</span> {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-field">
                  <span className="w-label">
                    <i>👥</i> Interested in
                  </span>
                  <div className="w-chips">
                    {[
                      ["woman", "Women"],
                      ["man", "Men"],
                      ["nonbinary", "Non-binary people"],
                    ].map(([v, l]) => {
                      const on = p.seeking.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          className={on ? "on" : ""}
                          onClick={() => {
                            const s = on ? p.seeking.filter((x) => x !== v) : [...p.seeking, v];
                            if (s.length) setP({ ...p, seeking: s });
                          }}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="w-field">
                  <span className="w-label">
                    <i>🎂</i> Age range <b>
                      {p.age_min}–{p.age_max}
                    </b>
                  </span>
                  <div className="dual">
                    <input id="w-amin" type="range" min={18} max={70} value={p.age_min} onChange={(e) => setP({ ...p, age_min: Math.min(+e.target.value, p.age_max) })} className="range" />
                    <input id="w-amax" type="range" min={18} max={70} value={p.age_max} onChange={(e) => setP({ ...p, age_max: Math.max(+e.target.value, p.age_min) })} className="range" />
                  </div>
                </div>
                <Choice field="timeline" value={a.timeline} onChange={(v) => set("timeline", v)} />
                <Choice field="family_plans" value={a.family_plans} onChange={(v) => set("family_plans", v)} />
                <Choice field="marital" value={a.marital} onChange={(v) => set("marital", v)} />
                <Choice field="children" value={a.children} onChange={(v) => set("children", v)} />
                <Choice field="relocate" value={a.relocate} onChange={(v) => set("relocate", v)} />
              </>
            )}

            {S.id === "scene" && (
              <div className="w-field">
                <span className="w-label">
                  <i>🗺️</i> Choose your first scene
                </span>
                <div className="w-chips big">
                  {SCENES.map(([id, label, icon]) => (
                    <button
                      key={id}
                      type="button"
                      className={a.date_comfort === id ? "on" : ""}
                      aria-pressed={a.date_comfort === id}
                      onClick={() => set("date_comfort", a.date_comfort === id ? undefined : id)}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                </div>
                <p className="fine">You can skip this. Leaving it blank is not the same as choosing Surprise me.</p>
              </div>
            )}

            {S.id === "life" && (
              <>
                <Choice field="diet" value={a.diet} onChange={(v) => set("diet", v)} />
                <Choice field="drinking" value={a.drinking} onChange={(v) => set("drinking", v)} />
                <Choice field="smoking" value={a.smoking} onChange={(v) => set("smoking", v)} />
                <Choice field="exercise" value={a.exercise} onChange={(v) => set("exercise", v)} />
                <Choice field="sleep" value={a.sleep} onChange={(v) => set("sleep", v)} />
                <Choice field="pets" value={a.pets} onChange={(v) => set("pets", v)} />
              </>
            )}

            {S.id === "heart" && (
              <>
                <Choice field="religion" value={a.religion} onChange={(v) => set("religion", v)} />
                {a.religion && a.religion !== "prefer_not" && (
                  <Choice field="religion_importance" value={a.religion_importance} onChange={(v) => set("religion_importance", v)} />
                )}
                <Choice field="love_languages" value={a.love_languages} onChange={(v) => set("love_languages", v)} />
                <p className="fine">
                  Soulplex never asks for caste or income, and never scores anyone on them.
                </p>
              </>
            )}

            {S.id === "prompts" && (
              <div className="w-prompts">
                {prompts.map((pr, i) => (
                  <div key={pr.id} className="w-prompt">
                    <div className="w-prompt-q">
                      <strong>{PROMPTS[pr.id]}</strong>
                      <button className="icon-btn" aria-label="Remove prompt" onClick={() => set("prompts", prompts.filter((_, j) => j !== i))}>
                        <X size={14} />
                      </button>
                    </div>
                    <textarea
                      aria-label={PROMPTS[pr.id]}
                      placeholder="Write it like you'd say it…"
                      maxLength={300}
                      value={pr.answer}
                      onChange={(e) => set("prompts", prompts.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                    />
                  </div>
                ))}
                {prompts.length < 3 && (
                  <div className="w-field">
                    <span className="w-label">
                      <i>✍️</i> Pick a prompt ({3 - prompts.length} left)
                    </span>
                    <div className="w-chips">
                      {Object.entries(PROMPTS)
                        .filter(([id]) => !prompts.some((x) => x.id === id))
                        .map(([id, q]) => (
                          <button key={id} type="button" onClick={() => set("prompts", [...prompts, { id, answer: "" }])}>
                            {q}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {S.id === "face" && <FaceStudio />}

            {S.id === "musts" && (
              <>
                <div className="w-field">
                  <span className="w-label">
                    <i>🛡️</i> Only introduce me to someone who…
                  </span>
                  <div className="w-musts">
                    {DEALBREAKERS.map(([k, l]) => {
                      const on = (a.dealbreakers ?? []).includes(k);
                      return (
                        <label key={k} className={"switch big" + (on ? " on" : "")}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => set("dealbreakers", on ? (a.dealbreakers ?? []).filter((x) => x !== k) : [...(a.dealbreakers ?? []), k])}
                          />
                          <i />
                          <span>{l}</span>
                        </label>
                      );
                    })}
                  </div>
                  <small className="fine">
                    Keep these few. Every must-have shrinks your pool. People who haven't answered a question aren't excluded.
                  </small>
                </div>
                <label>
                  Private contact for mutual matches
                  <input id="w-contact" placeholder="Phone, email or Instagram" maxLength={160} value={p.contact} onChange={(e) => setP({ ...p, contact: e.target.value })} />
                  <small>
                    <ShieldCheck size={12} /> Never shown to agents. Revealed only when you both say yes.
                  </small>
                </label>
                <label className="switch big">
                  <input type="checkbox" checked={p.discovery} onChange={(e) => setP({ ...p, discovery: e.target.checked })} />
                  <i />
                  <span>
                    <b>Discovery on</b>: let my agent meet others
                  </span>
                </label>
              </>
            )}
          </section>

          <aside className="w-side">
            <div className="w-agent">
              <Wisp hue={u.hue} size={72} self face={u.face} seed={u.id} />
              <div>
                <strong>{p.name}'s agent</strong>
                <span>
                  knows <b>{known.length}</b> things from your profile
                  {known.length > before && <em> · +{known.length - before} new</em>}
                </span>
              </div>
            </div>
            <ul className="w-knows">
              {known.slice(-7).reverse().map(([k, , s]) => (
                <li key={k}>
                  <Sparkles size={12} /> {s}
                </li>
              ))}
              {!known.length && <li className="fine">Answer a question and watch your agent learn it here.</li>}
            </ul>
            <p className="fine">These become traits your agent can share on dates. You can edit or hide any of them in My agent → Traits.</p>
          </aside>
        </div>

        <footer className="w-foot">
          <button className="btn ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <span className="w-skip">
            {step < STEPS.length - 1 && (
              <button className="link" onClick={() => setStep(step + 1)}>
                Skip for now
              </button>
            )}
          </span>
          {step < STEPS.length - 1 ? (
            <button className="btn primary" disabled={busy} onClick={next}>
              Save &amp; continue <ArrowRight size={16} />
            </button>
          ) : (
            <div className="w-finish">
              <button className="btn ghost" disabled={busy} onClick={() => finish(false)}>
                Save
              </button>
              <button className="btn primary glow" disabled={busy} onClick={() => finish(true)}>
                <Send size={16} /> Save &amp; send my agent out
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
