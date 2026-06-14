import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { api, type SetupPayload } from "./api";
import type { Alternative, Exercise, Goal, IntakePreview, Level, MetaOptions, Plan, PlanDay, PlanSlot, ProgressSummary, User } from "./types";
import { clearSession, focusLabel, getSession, goalLabel, minutesForDay, safetyText, saveSession, todayDay, weekBalance } from "./utils";

const defaultEquipment = ["body only", "dumbbell", "machine"];
const goalOptions: Array<{ value: Goal; label: string }> = [
  { value: "fat_loss", label: "Lose fat" },
  { value: "hypertrophy", label: "Build muscle" },
  { value: "strength", label: "Get stronger" },
  { value: "mobility", label: "Move better" },
];

type ProfileDraft = {
  name: string;
  sex: string;
  age: string;
  height_cm: string;
  weight_kg: string;
};

const emptyProfile: ProfileDraft = {
  name: "",
  sex: "",
  age: "",
  height_cm: "",
  weight_kg: "",
};

export default function App() {
  const navigate = useNavigate();
  const [{ userId, planId }, setSessionState] = useState(getSession);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [health, setHealth] = useState("checking");
  const [sessionReady, setSessionReady] = useState(() => !getSession().planId);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan(nextPlanId = getSession().planId) {
    if (!nextPlanId) {
      setSessionReady(true);
      return;
    }
    setLoadingPlan(true);
    setError(null);
    try {
      setPlan(await api.getPlan(nextPlanId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan");
    } finally {
      setLoadingPlan(false);
      setSessionReady(true);
    }
  }

  function remember(nextUserId: number, nextPlanId: number, nextPlan: Plan) {
    saveSession(nextUserId, nextPlanId);
    setSessionState({ userId: nextUserId, planId: nextPlanId });
    setPlan(nextPlan);
  }

  function replacePlan(nextPlan: Plan) {
    if (nextPlan.id !== planId) {
      saveSession(nextPlan.user_id, nextPlan.id);
      setSessionState({ userId: nextPlan.user_id, planId: nextPlan.id });
    }
    setPlan(nextPlan);
  }

  useEffect(() => {
    api.health().then((item) => setHealth(item.embeddings)).catch(() => setHealth("offline"));
    loadPlan();
  }, []);

  return (
    <div className="app">
      <Header plan={plan} health={health} />
      {error && <div className="app-alert">{error}</div>}
      {loadingPlan && <div className="app-alert muted">Loading your plan...</div>}
      <main>
        <Routes>
          <Route path="/" element={!sessionReady ? <EmptyState title="Loading your plan..." /> : plan ? <Navigate to="/today" replace /> : <Navigate to="/setup" replace />} />
          <Route path="/setup" element={<SetupScreen onReady={remember} />} />
          <Route path="/type" element={<TypeScreen onReady={remember} />} />
          <Route path="/today" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <TodayScreen plan={readyPlan} />}</RequirePlan>} />
          <Route path="/plan" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <PlanScreen plan={readyPlan} onPlan={replacePlan} />}</RequirePlan>} />
          <Route path="/progress" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <ProgressScreen userId={userId ?? readyPlan.user_id} />}</RequirePlan>} />
          <Route path="/explore" element={<ExploreScreen />} />
          <Route path="/profile" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <ProfileScreen userId={userId ?? readyPlan.user_id} plan={readyPlan} onPlan={replacePlan} />}</RequirePlan>} />
          <Route path="/swap/:slotId" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <SwapScreen plan={readyPlan} onRefresh={() => loadPlan(readyPlan.id)} />}</RequirePlan>} />
          <Route path="/finish/:dayId" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <FinishScreen plan={readyPlan} onRefresh={() => loadPlan(readyPlan.id)} />}</RequirePlan>} />
          <Route path="/coach" element={<RequirePlan plan={plan} ready={sessionReady}>{(readyPlan) => <CoachScreen plan={readyPlan} userId={userId ?? readyPlan.user_id} onPlan={replacePlan} onRefresh={() => loadPlan(readyPlan.id)} />}</RequirePlan>} />
        </Routes>
      </main>
    </div>
  );

  function Header({ plan, health }: { plan: Plan | null; health: string }) {
    return (
      <header className="topbar">
        <Link to={plan ? "/today" : "/setup"} className="brand">
          <span className="brand-mark">F</span>
          FitEngine
        </Link>
        {plan && (
          <nav className="switcher">
            <NavItem to="/today" label="Today" />
            <NavItem to="/plan" label="Plan" />
            <NavItem to="/progress" label="Progress" />
            <NavItem to="/explore" label="Explore" />
            <NavItem to="/coach" label="Coach" />
            <NavItem to="/profile" label="Profile" />
          </nav>
        )}
        <div className="top-meta">
          <span className="badge neutral">Prototype</span>
          <span className={health === "ok" ? "badge ok" : "badge warn"}>Embeddings {health}</span>
        </div>
      </header>
    );
  }

  function NavItem({ to, label }: { to: string; label: string }) {
    return (
      <NavLink className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")} to={to}>
        {label}
      </NavLink>
    );
  }
}

function RequirePlan({ plan, ready, children }: { plan: Plan | null; ready: boolean; children: (plan: Plan) => JSX.Element }) {
  if (!ready) return <EmptyState title="Loading your plan..." />;
  if (!plan) return <Navigate to="/setup" replace />;
  return children(plan);
}

function useMeta() {
  const [meta, setMeta] = useState<MetaOptions | null>(null);
  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
  }, []);
  return meta;
}

function SetupScreen({ onReady }: { onReady: (userId: number, planId: number, plan: Plan) => void }) {
  const navigate = useNavigate();
  const meta = useMeta();
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [goal, setGoal] = useState<Goal>("fat_loss");
  const [level, setLevel] = useState<Level>("beginner");
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(35);
  const [equipment, setEquipment] = useState(defaultEquipment);
  const [injuries, setInjuries] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload: SetupPayload = {
        ...profilePayload(profile),
        goal,
        level,
        days_per_week: days,
        minutes_per_session: minutes,
        equipment,
        injuries: injuries.map((injury_code) => ({ injury_code, severity: "moderate" })),
      };
      const user = await api.createUser(payload);
      const plan = await api.generatePlan(user.id);
      onReady(user.id, plan.id, plan);
      navigate("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setBusy(false);
    }
  }

  const equipmentOptions = meta?.equipment ?? defaultEquipment;
  const injuryOptions = meta?.injuries ?? [];

  return (
    <section className="setup-shell">
      <div className="screen-heading">
        <span className="step">1 of 2</span>
        <h1>Quick setup</h1>
        <p>Pick the basics. FitEngine handles the plan.</p>
      </div>
      <div className="setup-grid">
        <div className="panel main-panel">
          <Field title="Profile">
            <ProfileFields profile={profile} onChange={setProfile} />
          </Field>
          <Field title="Goal">
            <div className="seg-grid">
              {goalOptions.map((item) => (
                <button className={goal === item.value ? "choice selected" : "choice"} onClick={() => setGoal(item.value)} key={item.value}>
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field title="Fitness level">
            <div className="inline">
              {(["beginner", "intermediate", "expert"] as Level[]).map((item) => (
                <button className={level === item ? "chip selected" : "chip"} onClick={() => setLevel(item)} key={item}>
                  {focusLabel(item)}
                </button>
              ))}
            </div>
          </Field>
          <Field title="Schedule">
            <div className="stepper-row">
              <Stepper label="Days per week" value={days} min={2} max={6} onChange={setDays} suffix="days" />
              <Stepper label="Time per workout" value={minutes} min={20} max={75} step={5} onChange={setMinutes} suffix="min" />
            </div>
          </Field>
          <Field title="Equipment">
            <div className="inline wrap">
              {equipmentOptions.map((item) => (
                <button className={equipment.includes(item) ? "chip selected" : "chip"} onClick={() => setEquipment(toggle(equipment, item))} key={item}>
                  {labelEquipment(item)}
                </button>
              ))}
            </div>
          </Field>
          <Field title="Pain or injury">
            <div className="inline wrap">
              <button className={injuries.length === 0 ? "chip selected" : "chip"} onClick={() => setInjuries([])}>
                None
              </button>
              {injuryOptions.map((item) => (
                <button className={injuries.includes(item.code) ? "chip selected warn-chip" : "chip"} onClick={() => setInjuries(toggle(injuries, item.code))} key={item.code}>
                  {item.display_name}
                </button>
              ))}
            </div>
          </Field>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="text-button" onClick={() => navigate("/type")}>Prefer typing?</button>
            <button className="primary" onClick={submit} disabled={busy}>{busy ? "Generating..." : "Continue"}</button>
          </div>
        </div>
        <aside className="panel summary-panel">
          <h2>Plan rules</h2>
          <SummaryRow label="Goal" value={goalLabel(goal)} />
          <SummaryRow label="User" value={profile.name.trim() || "Guest User"} />
          <SummaryRow label="Gender" value={profile.sex ? focusLabel(profile.sex) : "Not set"} />
          <SummaryRow label="Level" value={focusLabel(level)} />
          <SummaryRow label="Schedule" value={`${days} days, ${minutes} min`} />
          <SummaryRow label="Equipment" value={equipment.map(labelEquipment).join(", ")} />
          <div className="safety-note"><ShieldCheck size={18} /> {injuries.length === 0 ? "No injury filter selected" : "Safety filters will run before scoring"}</div>
        </aside>
      </div>
    </section>
  );
}

function TypeScreen({ onReady }: { onReady: (userId: number, planId: number, plan: Plan) => void }) {
  const navigate = useNavigate();
  const meta = useMeta();
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [text, setText] = useState("I want to lose fat. I can train 4 days a week for about 35 minutes. I have dumbbells and machines. My knees hurt with lunges.");
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inferred = useMemo(() => inferSetup(text, meta), [text, meta]);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.previewIntake(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse details");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const user = await api.createUser({
        ...inferred,
        ...profilePayload(profile),
        injuries: preview?.injuries.map((item) => ({ injury_code: item.injury_code, severity: item.severity })) ?? [],
        exclusions: preview?.exclusions.map((item) => ({ exercise_id: item.exercise_id, reason: item.reason })) ?? [],
      });
      const plan = await api.generatePlan(user.id);
      onReady(user.id, plan.id, plan);
      navigate("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="setup-shell">
      <div className="screen-heading">
        <span className="step">2 of 2</span>
        <h1>Type it instead</h1>
        <p>Write normally. You’ll review before we save anything.</p>
      </div>
      <div className="type-grid">
        <div className="panel main-panel">
          <Field title="Profile">
            <ProfileFields profile={profile} onChange={setProfile} />
          </Field>
          <textarea value={text} onChange={(event) => setText(event.target.value)} />
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="text-button" onClick={() => navigate("/setup")}>Use guided setup</button>
            <button className="primary" onClick={parse} disabled={busy}>{busy ? "Parsing..." : "Parse details"}</button>
          </div>
        </div>
        <aside className="panel summary-panel">
          <h2>Understood</h2>
          <SummaryRow label="User" value={profile.name.trim() || "Guest User"} />
          <SummaryRow label="Gender" value={profile.sex ? focusLabel(profile.sex) : "Not set"} />
          <SummaryRow label="Goal" value={goalLabel(inferred.goal)} />
          <SummaryRow label="Schedule" value={`${inferred.days_per_week} days, ${inferred.minutes_per_session} min`} />
          <SummaryRow label="Equipment" value={inferred.equipment.map(labelEquipment).join(", ")} />
          {!preview && inferred.equipment.length === 1 && inferred.equipment[0] === "body only" && (
            <p className="tiny-note">No equipment detected - defaulting to bodyweight. Switch to Guided setup to add your gear.</p>
          )}
          <SummaryRow label="Safety" value={preview?.injuries.map((item) => focusLabel(item.injury_code.replace("_pain", ""))).join(", ") || "Not parsed yet"} />
          <SummaryRow label="Avoid" value={preview?.exclusions.map((item) => item.name).join(", ") || "None"} />
          {preview?.medical_warning && <div className="error">{preview.medical_warning}</div>}
          {preview?.unresolved_exclusions_by_name.length ? <div className="safety-note">Could not match: {preview.unresolved_exclusions_by_name.join(", ")}</div> : null}
          <div className="safety-note">Unsupported injuries are not guessed.</div>
          <div className="actions right">
            <button className="secondary" onClick={parse} disabled={busy}>Refresh</button>
            <button className="primary" onClick={confirm} disabled={busy || !preview}>{preview?.medical_warning ? "Continue anyway" : "Confirm and generate"}</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProfileScreen({ userId, plan, onPlan }: { userId: number; plan: Plan; onPlan: (plan: Plan) => void }) {
  const navigate = useNavigate();
  const meta = useMeta();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [goal, setGoal] = useState<Goal>("fat_loss");
  const [level, setLevel] = useState<Level>("beginner");
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(35);
  const [equipment, setEquipment] = useState(defaultEquipment);
  const [intakeText, setIntakeText] = useState("My shoulder hurts now. Avoid overhead press.");
  const [preview, setPreview] = useState<IntakePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getUser(userId)
      .then((item) => {
        setUser(item);
        setProfile(profileDraftFromUser(item));
        setGoal(item.goal);
        setLevel(item.level);
        setDays(item.days_per_week);
        setMinutes(item.minutes_per_session);
        setEquipment(item.equipment);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load profile"));
  }, [userId]);

  async function saveRules() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.updateUser(userId, {
        ...profilePayload(profile),
        goal,
        level,
        days_per_week: days,
        minutes_per_session: minutes,
        equipment,
      });
      setUser(updated);
      setProfile(profileDraftFromUser(updated));
      setGoal(updated.goal);
      setLevel(updated.level);
      setDays(updated.days_per_week);
      setMinutes(updated.minutes_per_session);
      setEquipment(updated.equipment);
      const nextPlan = await api.regeneratePlan(plan.id);
      onPlan(nextPlan);
      setNotice(`Profile saved. Week ${nextPlan.week_index} v${nextPlan.version} is now active.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  async function previewIntake() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setPreview(await api.previewIntake(intakeText));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview intake");
    } finally {
      setBusy(false);
    }
  }

  async function saveIntake() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.applyIntake(userId, intakeText);
      setPreview(result);
      if (result.medical_warning) {
        setError(result.medical_warning);
        return;
      }
      const nextPlan = await api.regeneratePlan(plan.id);
      onPlan(nextPlan);
      setNotice(`Intake saved. Week ${nextPlan.week_index} v${nextPlan.version} is now active.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save intake");
    } finally {
      setBusy(false);
    }
  }

  if (error && !user) return <EmptyState title={error} />;
  if (!user) return <EmptyState title="Loading profile..." />;
  const equipmentOptions = meta?.equipment ?? defaultEquipment;

  return (
    <section className="profile-layout">
      <div className="page-title">
        <div>
          <h1>{user.name || "Guest User"}</h1>
          <p>User #{user.id} - {goalLabel(user.goal)} - {focusLabel(user.level)}</p>
        </div>
        <div className="title-actions">
          <button
            className="secondary"
            onClick={() => {
              clearSession();
              navigate("/setup");
            }}
          >
            New profile
          </button>
          <Link className="secondary" to="/today">Back to today</Link>
        </div>
      </div>
      <div className="profile-grid">
        <div className="panel main-panel">
          <h2>Edit profile</h2>
          <Field title="Profile">
            <ProfileFields profile={profile} onChange={setProfile} />
          </Field>
          <Field title="Goal">
            <div className="seg-grid">
              {goalOptions.map((item) => (
                <button className={goal === item.value ? "choice selected" : "choice"} onClick={() => setGoal(item.value)} key={item.value}>
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field title="Fitness level">
            <div className="inline">
              {(["beginner", "intermediate", "expert"] as Level[]).map((item) => (
                <button className={level === item ? "chip selected" : "chip"} onClick={() => setLevel(item)} key={item}>
                  {focusLabel(item)}
                </button>
              ))}
            </div>
          </Field>
          <Field title="Schedule">
            <div className="stepper-row">
              <Stepper label="Days per week" value={days} min={2} max={6} onChange={setDays} suffix="days" />
              <Stepper label="Time per workout" value={minutes} min={20} max={75} step={5} onChange={setMinutes} suffix="min" />
            </div>
          </Field>
          <Field title="Equipment">
            <div className="inline wrap">
              {equipmentOptions.map((item) => (
                <button className={equipment.includes(item) ? "chip selected" : "chip"} onClick={() => setEquipment(toggle(equipment, item))} key={item}>
                  {labelEquipment(item)}
                </button>
              ))}
            </div>
          </Field>
          <div className="actions right">
            <button className="primary" onClick={saveRules} disabled={busy}>{busy ? "Saving..." : "Save and update week"}</button>
          </div>
          <div className="intake-editor">
            <h2>Update by text</h2>
            <p>Use this when pain, equipment, or exercise dislikes change.</p>
            <textarea className="small-textarea" value={intakeText} onChange={(event) => setIntakeText(event.target.value)} />
            <div className="actions">
              <button className="secondary" onClick={previewIntake} disabled={busy}>Preview</button>
              <button className="primary" onClick={saveIntake} disabled={busy}>Save intake and update week</button>
            </div>
            {preview && (
              <div className="preview-box">
                {preview.medical_warning && <div className="error">{preview.medical_warning}</div>}
                <SummaryRow label="Safety" value={preview.injuries.map((item) => focusLabel(item.injury_code)).join(", ") || "No injuries parsed"} />
                <SummaryRow label="Avoid" value={preview.exclusions.map((item) => item.name).join(", ") || "None"} />
                <SummaryRow label="Parser" value={preview.source} />
              </div>
            )}
          </div>
          {notice && <p className="success">{notice}</p>}
          {error && <p className="error">{error}</p>}
        </div>
        <aside className="panel summary-panel">
          <h2>Recommendation rules</h2>
          <SummaryRow label="Goal" value={goalLabel(goal)} />
          <SummaryRow label="Level" value={focusLabel(level)} />
          <SummaryRow label="Schedule" value={`${days} days, ${minutes} min`} />
          <SummaryRow label="Equipment" value={equipment.map(labelEquipment).join(", ")} />
          <SummaryRow label="Current plan" value={`Week ${plan.week_index} v${plan.version}`} />
          <div className="safety-note"><ShieldCheck size={18} /> This profile is saved in PostgreSQL as user #{user.id}.</div>
        </aside>
      </div>
    </section>
  );
}

function ExploreScreen() {
  const meta = useMeta();
  const [query, setQuery] = useState("dumbbell chest beginner");
  const [level, setLevel] = useState<Level | "">("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [results, setResults] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    try {
      const items = await api.searchExercises({ q: query, level: level || undefined, equipment });
      setResults(items);
      setSelected(items[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search exercises");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      search();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, level, equipment.join("|")]);

  const equipmentOptions = meta?.equipment ?? defaultEquipment;

  return (
    <section className="explore-layout">
      <div className="page-title">
        <div>
          <h1>Explore exercises</h1>
          <p>Search by normal words. This uses the backend semantic exercise search.</p>
        </div>
      </div>
      <div className="explore-grid">
        <div className="panel main-panel">
          <div className="search-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="easy back exercise with dumbbells" onKeyDown={(event) => event.key === "Enter" && search()} />
            <button className="primary" onClick={search} disabled={busy}><Search size={16} /> {busy ? "Searching..." : "Search"}</button>
          </div>
          <Field title="Filters">
            <div className="inline wrap">
              <button className={level === "" ? "chip selected" : "chip"} onClick={() => setLevel("")}>Any level</button>
              {(["beginner", "intermediate", "expert"] as Level[]).map((item) => (
                <button className={level === item ? "chip selected" : "chip"} onClick={() => setLevel(item)} key={item}>{focusLabel(item)}</button>
              ))}
            </div>
            <div className="inline wrap filter-gap">
              {equipmentOptions.map((item) => (
                <button className={equipment.includes(item) ? "chip selected" : "chip"} onClick={() => setEquipment(toggle(equipment, item))} key={item}>{labelEquipment(item)}</button>
              ))}
            </div>
          </Field>
          {error && <p className="error">{error}</p>}
          <div className="exercise-results">
            {results.map((exercise) => (
              <button className={selected?.id === exercise.id ? "result-row selected" : "result-row"} onClick={() => setSelected(exercise)} key={exercise.id}>
                <img src={exercise.image_urls[0]} alt={exercise.name} />
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{focusLabel(exercise.level)} - {labelEquipment(exercise.equipment)} - {exercise.muscle_groups.join(", ")}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside className="panel detail-panel">
          <ExerciseMedia exercise={selected} />
          <h2>{selected?.name ?? "Choose an exercise"}</h2>
          <SummaryRow label="Level" value={selected ? focusLabel(selected.level) : "-"} />
          <SummaryRow label="Equipment" value={selected ? labelEquipment(selected.equipment) : "-"} />
          <SummaryRow label="Category" value={selected ? focusLabel(selected.category) : "-"} />
          <SummaryRow label="Muscles" value={selected?.muscle_groups.join(", ") ?? "-"} />
          <div className="instruction-list">
            {(selected?.instructions ?? []).slice(0, 5).map((item, index) => <p key={`${selected?.id}-${index}`}>{index + 1}. {item}</p>)}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ProgressScreen({ userId }: { userId: number }) {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.progress(userId).then(setSummary).catch((err) => setError(err instanceof Error ? err.message : "Could not load progress"));
  }, [userId]);

  if (error) return <EmptyState title={error} />;
  if (!summary) return <EmptyState title="Loading progress..." />;

  return (
    <section className="progress-layout">
      <div className="page-title">
        <div>
          <h1>Progress</h1>
          <p>What FitEngine has learned from logged workouts.</p>
        </div>
      </div>
      <div className="stat-grid">
        <div className="panel stat-card"><span>Logged sessions</span><strong>{summary.logged_sessions}</strong></div>
        <div className="panel stat-card"><span>Adherence</span><strong>{Math.round(summary.adherence * 100)}%</strong></div>
        <div className="panel stat-card"><span>Average effort</span><strong>{summary.average_rpe ? `RPE ${summary.average_rpe.toFixed(1)} / 10` : "-"}</strong></div>
        <div className="panel stat-card"><span>Skipped exercises</span><strong>{summary.skipped_slots}</strong></div>
      </div>
      <div className="progress-grid">
        <div className="panel main-panel">
          <h2>Recent workouts</h2>
          {summary.recent_sessions.length === 0 && <div className="empty-state compact">No workouts logged yet.</div>}
          {summary.recent_sessions.map((session) => (
            <div className="session-row" key={session.id}>
              <div>
                <strong>Week {session.week_index} v{session.version}, Day {session.day_index}</strong>
                <small>{focusLabel(session.focus)} - {formatDate(session.completed_at)}</small>
              </div>
              <span>{session.completed_count} done</span>
              <span>{session.skipped_count} skipped</span>
              <span>{session.rpe ? `RPE ${session.rpe}` : "-"}</span>
              {session.notes && <p>{session.notes}</p>}
            </div>
          ))}
        </div>
        <aside className="panel summary-panel">
          <h2>What changed</h2>
          <SummaryRow label="Completed slots" value={String(summary.completed_slots)} />
          <SummaryRow label="Skipped slots" value={String(summary.skipped_slots)} />
          <div className="safety-note">RPE means effort: 1 is very easy, 10 is maximum effort. FitEngine uses it to avoid making plans too hard.</div>
          <div className="safety-note">Lower adherence or very high RPE can make the next generated week easier.</div>
          <h2>Often skipped</h2>
          {summary.most_skipped.length === 0 && <p className="tiny-note">Nothing skipped often yet.</p>}
          {summary.most_skipped.map((item) => <SummaryRow label={item.exercise_name} value={`${item.count}x`} key={item.exercise_name} />)}
        </aside>
      </div>
    </section>
  );
}

function TodayScreen({ plan }: { plan: Plan }) {
  const [day, setDay] = useState(todayDay(plan)!);
  const [selected, setSelected] = useState<PlanSlot | null>(day.slots[0] ?? null);
  const upcoming = plan.days.filter((item) => item.id !== day.id).slice(0, 3);

  useEffect(() => {
    setDay(todayDay(plan)!);
  }, [plan]);

  useEffect(() => {
    setSelected(day.slots[0] ?? null);
  }, [day.id]);

  return (
    <section className="content-grid">
      <div className="main-column">
        <div className="page-title">
          <div>
            <h1>{day.day_index === 1 ? "Today" : `Day ${day.day_index}`}</h1>
            <p>{focusLabel(day.focus)} - {minutesForDay(day)} min - safety filtered</p>
          </div>
          <div className="title-actions">
            <Link className="secondary" to="/coach"><TimerReset size={16} /> Need less time?</Link>
            <Link className="primary" to={`/finish/${day.id}`}><Check size={16} /> Start</Link>
          </div>
        </div>
        <WorkoutList day={day} selected={selected} onSelect={setSelected} />
        <div className="panel note-strip"><ShieldCheck size={18} /> {safetyText(plan)}</div>
        {(plan.params.feasibility_notes ?? []).slice(1, 4).map((note) => <p className="tiny-note" key={note}>{note}</p>)}
      </div>
      <aside className="panel detail-panel">
        <ExerciseMedia exercise={selected?.exercise ?? null} />
        <h2>{selected?.exercise?.name ?? "Select an exercise"}</h2>
        <p>{selected?.rationale}</p>
        <div className="detail-metrics">
          <SummaryRow label="Target" value={selected?.exercise?.muscle_groups.join(", ") ?? "-"} />
          <SummaryRow label="Dose" value={selected ? `${selected.sets} sets, ${selected.reps} reps` : "-"} />
          <SummaryRow label="Rest" value={selected ? `${selected.rest_sec} sec between sets` : "-"} />
          <SummaryRow label="Effort" value={selected ? `RPE ${selected.rpe_target} / 10` : "-"} />
        </div>
        <div className="actions stretch">
          {selected && <Link className="secondary" to={`/swap/${selected.id}`}>Swap exercise</Link>}
          {selected && <Link className="primary" to={`/finish/${day.id}`}>Mark as done</Link>}
        </div>
        {upcoming.length > 0 && (
          <>
            <h2>Upcoming</h2>
            {upcoming.map((item) => (
              <SummaryRow label={`Day ${item.day_index}`} value={`${focusLabel(item.focus)} - ${item.slots.length} exercises`} key={item.id} />
            ))}
          </>
        )}
      </aside>
    </section>
  );
}

function PlanScreen({ plan, onPlan }: { plan: Plan; onPlan: (plan: Plan) => void }) {
  const [viewPlan, setViewPlan] = useState(plan);
  const [history, setHistory] = useState<Plan[]>([plan]);
  const [day, setDay] = useState(plan.days[0]);
  const [selected, setSelected] = useState<PlanSlot | null>(day.slots[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setViewPlan(plan);
    setDay(plan.days[0]);
    setSelected(plan.days[0]?.slots[0] ?? null);
    api.listPlans(plan.user_id).then(setHistory).catch(() => setHistory([plan]));
  }, [plan.id]);

  useEffect(() => {
    setSelected(day.slots[0] ?? null);
  }, [day.id]);

  async function adapt() {
    setBusy(true);
    try {
      const next = await api.adaptPlan(plan.id);
      onPlan(next);
      setViewPlan(next);
      setDay(next.days[0]);
      setSelected(next.days[0]?.slots[0] ?? null);
      setHistory(await api.listPlans(next.user_id));
      setNotice(`Generated Week ${next.week_index} v${next.version} from your logged feedback.`);
    } finally {
      setBusy(false);
    }
  }

  async function activateViewedPlan() {
    setBusy(true);
    try {
      const active = await api.activatePlan(viewPlan.id);
      onPlan(active);
      setViewPlan(active);
      setDay(active.days[0]);
      setHistory(await api.listPlans(active.user_id));
      setNotice(`Activated Week ${active.week_index} v${active.version}.`);
    } finally {
      setBusy(false);
    }
  }

  function choosePlan(planId: number) {
    const next = history.find((item) => item.id === planId);
    if (!next) return;
    setViewPlan(next);
    setDay(next.days[0]);
    setSelected(next.days[0]?.slots[0] ?? null);
  }

  const balance = weekBalance(viewPlan);
  const viewingActive = viewPlan.id === plan.id;
  return (
    <section className="content-grid">
      <div className="main-column">
        <div className="page-title">
          <div>
            <h1>Week {viewPlan.week_index} v{viewPlan.version}</h1>
            <p>{viewPlan.days.length} days - {focusLabel(viewPlan.split)} - {viewingActive ? "active plan" : "history version"}</p>
          </div>
          <div className="title-actions">
            {!viewingActive && <button className="secondary" onClick={activateViewedPlan} disabled={busy}>Use this version</button>}
            <button className="secondary" onClick={adapt} disabled={busy || !viewingActive}><RefreshCw size={16} /> {busy ? "Generating..." : "Generate next week"}</button>
          </div>
        </div>
        {notice && <p className="success">{notice}</p>}
        <div className="panel note-strip">
          <span>Viewing</span>
          <select value={viewPlan.id} onChange={(event) => choosePlan(Number(event.target.value))}>
            {history.map((item) => (
              <option value={item.id} key={item.id}>
                Week {item.week_index} v{item.version}{item.status === "active" ? " - active" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="day-tabs">
          {viewPlan.days.map((item) => (
            <button className={day.id === item.id ? "day-tab selected" : "day-tab"} onClick={() => setDay(item)} key={item.id}>
              Day {item.day_index}<span>{focusLabel(item.focus)}</span>
            </button>
          ))}
        </div>
        <WorkoutList day={day} selected={selected} onSelect={setSelected} />
      </div>
      <aside className="panel detail-panel">
        <ExerciseMedia exercise={selected?.exercise ?? null} />
        <h2>{selected?.exercise?.name ?? "Select an exercise"}</h2>
        <p>{selected?.rationale ?? "Choose any planned exercise to preview images and details."}</p>
        <SummaryRow label="Target" value={selected?.exercise?.muscle_groups.join(", ") ?? "-"} />
        <SummaryRow label="Dose" value={selected ? `${selected.sets} sets, ${selected.reps} reps` : "-"} />
        <SummaryRow label="Rest" value={selected ? `${selected.rest_sec} sec between sets` : "-"} />
        <SummaryRow label="Effort" value={selected ? `RPE ${selected.rpe_target} / 10` : "-"} />
        <h2>Week balance</h2>
        {balance.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar"><span style={{ width: `${item.percent}%` }} /></div>
          </div>
        ))}
        <div className="safety-note"><ShieldCheck size={18} /> Generate next week uses completed/skipped workouts and RPE. Without logs, it may look similar.</div>
        {(viewPlan.params.feasibility_notes ?? []).slice(0, 3).map((note) => <p className="tiny-note" key={note}>{note}</p>)}
      </aside>
    </section>
  );
}

function SwapScreen({ plan, onRefresh }: { plan: Plan; onRefresh: () => Promise<void> }) {
  const navigate = useNavigate();
  const { slotId } = useParams();
  const slot = findSlot(plan, Number(slotId));
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selected, setSelected] = useState<Alternative | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) return;
    api.alternatives(slot.id, 5).then((items) => {
      setAlternatives(items);
      setSelected(items[0] ?? null);
    }).catch((err) => setError(err instanceof Error ? err.message : "Could not load alternatives"));
  }, [slot?.id]);

  async function replace() {
    if (!slot || !selected) return;
    setBusy(true);
    try {
      await api.swap(slot.id, selected.exercise.id);
      await onRefresh();
      navigate("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  if (!slot) return <EmptyState title="Slot not found" />;
  return (
    <section className="swap-layout">
      <Link className="back-link" to="/today"><ArrowLeft size={16} /> Back to today</Link>
      <h1>Swap {slot.exercise?.name}</h1>
      {error && <p className="error">{error}</p>}
      <div className="three-col">
        <aside className="panel">
          <h2>Current exercise</h2>
          <p className="big-name">{slot.exercise?.name}</p>
          <SummaryRow label="Target" value={slot.exercise?.muscle_groups.join(", ") ?? "-"} />
          <SummaryRow label="Dose" value={`${slot.sets} sets · ${slot.reps}`} />
          <div className="safety-note">Safe alternatives only. FitEngine keeps your injury and equipment rules.</div>
        </aside>
        <div className="panel">
          <h2>Recommended replacements</h2>
          <div className="alt-list">
            {alternatives.slice(0, 5).map((item) => (
              <button className={selected?.exercise.id === item.exercise.id ? "alt-row selected" : "alt-row"} onClick={() => setSelected(item)} key={item.exercise.id}>
                <span>
                  <strong>{item.exercise.name}</strong>
                  <small>{Math.round(item.similarity * 100)}% match · {labelEquipment(item.exercise.equipment)}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
        <aside className="panel detail-panel">
          <ExerciseMedia exercise={selected?.exercise ?? null} />
          <h2>Why this is safe</h2>
          <p>{selected ? `${selected.exercise.name} targets ${selected.primary_group ?? "similar muscles"} and matches your available equipment.` : "Choose an option to see details."}</p>
          <SummaryRow label="Semantic match" value={selected ? `${Math.round(selected.similarity * 100)}%` : "-"} />
          <SummaryRow label="Utility" value={selected ? String(selected.utility) : "-"} />
          <SummaryRow label="Time fit" value={selected ? swapTimeFit(slot, selected) : "-"} />
          <div className="actions stretch">
            <button className="secondary" onClick={() => navigate("/today")}>Cancel</button>
            <button className="primary" onClick={replace} disabled={!selected || busy}>{busy ? "Replacing..." : "Replace exercise"}</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FinishScreen({ plan, onRefresh }: { plan: Plan; onRefresh: () => Promise<void> }) {
  const navigate = useNavigate();
  const { dayId } = useParams();
  const day = plan.days.find((item) => item.id === Number(dayId)) ?? plan.days[0];
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompleted(new Set(day.slots.map((slot) => slot.id)));
    setSaved(false);
    setError(null);
  }, [day.id, day.slots.length]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.logSession({
        plan_day_id: day.id,
        rpe,
        completed_slot_ids: [...completed],
        skipped_slot_ids: day.slots.map((slot) => slot.id).filter((id) => !completed.has(id)),
        duration_min: minutesForDay(day),
        notes: notes || undefined,
      });
      await onRefresh();
      navigate("/today");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save workout";
      const alreadySaved = message.includes("already has a logged session") || message.includes("already been saved");
      setSaved(alreadySaved);
      setError(alreadySaved ? "This workout has already been saved." : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="finish-shell">
      <div className="screen-heading left">
        <h1>Finish workout</h1>
        <p>Confirm what happened. FitEngine adjusts next time.</p>
      </div>
      <div className="type-grid">
        <div className="panel main-panel">
          <div className="summary-line">{focusLabel(day.focus)} · {minutesForDay(day)} min planned · {day.slots.length} exercises</div>
          {day.slots.map((slot) => (
            <label className="finish-row" key={slot.id}>
              <input type="checkbox" checked={completed.has(slot.id)} onChange={() => setCompleted(toggleSet(completed, slot.id))} />
              <span>{slot.exercise?.name}</span>
              <small>{slot.sets} sets · {completed.has(slot.id) ? "Completed" : "Skipped"}</small>
            </label>
          ))}
          <Field title="How hard was it?">
            <div className="rpe-row">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <button className={rpe === value ? "rpe selected" : "rpe"} onClick={() => setRpe(value)} key={value}>{value}</button>
              ))}
            </div>
            <p className="helper">7 = challenging but controlled</p>
          </Field>
          <textarea className="small-textarea" placeholder="Anything to remember?" value={notes} onChange={(event) => setNotes(event.target.value)} />
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="secondary" onClick={() => navigate("/today")}>Back</button>
            <button className="primary" onClick={save} disabled={busy || saved}>{saved ? "Already saved" : busy ? "Saving..." : "Save workout"}</button>
          </div>
        </div>
        <aside className="panel summary-panel">
          <h2>After saving</h2>
          <SummaryRow label="Learns" value="What you tolerate" />
          <SummaryRow label="Updates" value="Adherence" />
          <SummaryRow label="Prepares" value="Next week" />
          <div className="safety-note">Next plan likely unchanged.</div>
        </aside>
      </div>
    </section>
  );
}

function CoachScreen({ plan, userId, onPlan, onRefresh }: { plan: Plan; userId: number; onPlan: (plan: Plan) => void; onRefresh: () => Promise<void> }) {
  const [message, setMessage] = useState("I only have 20 minutes today.");
  const [thread, setThread] = useState<Array<{ role: "user" | "coach"; text: string; tool?: string; source?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const day = todayDay(plan)!;

  async function send(nextMessage?: string) {
    const outgoing = (nextMessage ?? message).trim();
    if (!outgoing || busy) return;
    const priorThread = thread;
    setThread((items) => [...items, { role: "user", text: outgoing }]);
    setMessage("");
    setBusy(true);
    try {
      const response = await api.coach({
        user_id: userId,
        message: outgoing,
        history: priorThread.map((item) => ({
          role: item.role === "coach" ? "assistant" : "user",
          content: item.text,
        })),
      });
      setThread((items) => [...items, { role: "coach", text: response.message, tool: response.tool_results[0]?.tool, source: response.source }]);
      const returnedPlan = response.tool_results
        .map((item) => (item.result as { plan?: Plan | null }).plan)
        .find((item): item is Plan => Boolean(item?.id));
      if (returnedPlan) {
        onPlan(returnedPlan);
      } else {
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="coach-grid">
      <aside className="panel">
        <h2>Quick actions</h2>
        {["I only have 20 minutes today", "I have a knee injury", "Show my current plan", "How hard is RPE 7?", "I have a head injury", "How do I swap an exercise?"].map((item) => (
          <button className="quick-action" onClick={() => send(item)} disabled={busy} key={item}>{item}</button>
        ))}
      </aside>
      <div className="panel chat-panel">
        <h1>Coach</h1>
        <p>Ask for small changes. FitEngine keeps the rules.</p>
        <div className="thread">
          {thread.length === 0 && <div className="coach-empty">Try: “I only have 20 minutes today.”</div>}
          {thread.map((item, index) => (
            <div className={item.role === "user" ? "bubble user" : "bubble coach"} key={`${item.role}-${index}`}>
              <p>{item.text}</p>
              {item.tool && <CoachAction tool={item.tool} />}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about your plan..." onKeyDown={(event) => event.key === "Enter" && send()} />
          <button className="primary" onClick={() => send()} disabled={busy}><MessageSquare size={16} /> Send</button>
        </div>
      </div>
      <aside className="panel summary-panel">
        <h2>Current rules</h2>
        <SummaryRow label="Split" value={focusLabel(plan.split)} />
        <SummaryRow label="Today" value={`${focusLabel(day.focus)} · ${day.slots.length} exercises`} />
        <SummaryRow label="Safety" value="No blocked movement patterns added" />
        <div className="safety-note">Coach actions call backend tools, then the plan refreshes here.</div>
      </aside>
    </section>
  );
}

function CoachAction({ tool }: { tool: string }) {
  const actions: Record<string, { label: string; to: string }> = {
    get_current_plan: { label: "Open plan", to: "/plan" },
    replan_session: { label: "Open today", to: "/today" },
    get_alternatives: { label: "Use Swap beside the exercise", to: "/today" },
    swap_exercise: { label: "Open today", to: "/today" },
    log_feedback: { label: "Open progress", to: "/progress" },
    explain_slot: { label: "Open today", to: "/today" },
    update_safety_profile: { label: "Open updated plan", to: "/today" },
  };
  const action = actions[tool];
  if (!action) return null;
  return <Link className="tool-card" to={action.to}>{action.label}</Link>;
}

function WorkoutList({ day, selected, onSelect }: { day: PlanDay; selected?: PlanSlot | null; onSelect?: (slot: PlanSlot) => void }) {
  return (
    <div className="panel workout-list">
      <div className="metric-guide">
        <span><strong>Sets x reps</strong> means rounds and repeats.</span>
        <span><strong>Rest</strong> is break time between sets.</span>
        <span><strong>RPE</strong> is effort from 1 easy to 10 max.</span>
      </div>
      {day.slots.map((slot) => (
        <div
          className={selected?.id === slot.id ? "exercise-row selected" : "exercise-row"}
          onClick={() => onSelect?.(slot)}
          onKeyDown={(event) => event.key === "Enter" && onSelect?.(slot)}
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          key={slot.id}
        >
          <span className="check-dot"><Dumbbell size={15} /></span>
          <span className="exercise-main">
            <strong>{slot.exercise?.name}</strong>
            <small>{slot.exercise?.muscle_groups.join(", ")}</small>
          </span>
          <span>{slot.sets} sets x {slot.reps} reps</span>
          <span>Rest {slot.rest_sec}s</span>
          <span>RPE {slot.rpe_target}</span>
          <span className="row-actions">
            <Link to={`/swap/${slot.id}`} onClick={(event) => event.stopPropagation()}>Swap</Link>
          </span>
        </div>
      ))}
    </div>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="field">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ProfileFields({ profile, onChange }: { profile: ProfileDraft; onChange: (profile: ProfileDraft) => void }) {
  function update(key: keyof ProfileDraft, value: string) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <div className="profile-form">
      <label className="form-control wide">
        <span>Name</span>
        <input value={profile.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label className="form-control">
        <span>Gender</span>
        <select value={profile.sex} onChange={(event) => update("sex", event.target.value)}>
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="non_binary">Non-binary</option>
        </select>
      </label>
      <label className="form-control">
        <span>Age</span>
        <input value={profile.age} onChange={(event) => update("age", event.target.value)} inputMode="numeric" />
      </label>
      <label className="form-control">
        <span>Height (cm)</span>
        <input value={profile.height_cm} onChange={(event) => update("height_cm", event.target.value)} inputMode="numeric" />
      </label>
      <label className="form-control">
        <span>Weight (kg)</span>
        <input value={profile.weight_kg} onChange={(event) => update("weight_kg", event.target.value)} inputMode="numeric" />
      </label>
    </div>
  );
}

function ExerciseMedia({ exercise }: { exercise: Exercise | null }) {
  const [index, setIndex] = useState(0);
  const images = exercise?.image_urls ?? [];

  useEffect(() => {
    setIndex(0);
  }, [exercise?.id]);

  if (!exercise || images.length === 0) {
    return <div className="image-placeholder">No image available</div>;
  }

  return (
    <div className="media-viewer">
      <img className="exercise-image" src={images[index]} alt={`${exercise.name} ${index + 1}`} />
      {images.length > 1 && (
        <div className="image-strip">
          {images.map((url, itemIndex) => (
            <button className={itemIndex === index ? "thumb selected" : "thumb"} onClick={() => setIndex(itemIndex)} key={url}>
              <img src={url} alt={`${exercise.name} thumbnail ${itemIndex + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button onClick={() => onChange(Math.max(min, value - step))}>-</button>
        <strong>{value} {suffix}</strong>
        <button onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="empty-state">{title}</div>;
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toggleSet(values: Set<number>, value: number) {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function labelEquipment(value: string) {
  const labels: Record<string, string> = {
    "body only": "Bodyweight",
    dumbbell: "Dumbbells",
    machine: "Machines",
    cable: "Cables",
    bands: "Bands",
    "pull-up bar": "Pull-up bar",
  };
  return labels[value] ?? focusLabel(value);
}

function profilePayload(profile: ProfileDraft) {
  return {
    name: profile.name.trim() || "Guest User",
    sex: profile.sex || null,
    age: optionalInteger(profile.age),
    height_cm: optionalInteger(profile.height_cm),
    weight_kg: optionalInteger(profile.weight_kg),
  };
}

function profileDraftFromUser(user: User): ProfileDraft {
  return {
    name: user.name ?? "",
    sex: user.sex ?? "",
    age: user.age ? String(user.age) : "",
    height_cm: user.height_cm ? String(user.height_cm) : "",
    weight_kg: user.weight_kg ? String(user.weight_kg) : "",
  };
}

function optionalInteger(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function swapTimeFit(slot: PlanSlot, selected: Alternative) {
  const currentPerSet = slot.exercise?.mechanic === "compound" ? 4 : 3;
  const nextPerSet = selected.exercise.mechanic === "compound" ? 4 : 3;
  const current = slot.sets * currentPerSet;
  const next = slot.sets * nextPerSet;
  if (next === current) return `About ${next} min for this slot`;
  const delta = Math.abs(next - current);
  return next > current ? `About ${next} min, +${delta} min vs current` : `About ${next} min, ${delta} min quicker`;
}

function inferSetup(text: string, meta: MetaOptions | null): SetupPayload {
  const lower = text.toLowerCase();
  const goal: Goal = lower.includes("muscle") ? "hypertrophy" : lower.includes("strong") ? "strength" : lower.includes("move") ? "mobility" : "fat_loss";
  const days = Number(lower.match(/(\d+)\s*days?/)?.[1]) || 4;
  const minutes = Number(lower.match(/(\d+)\s*(min|minutes)/)?.[1]) || 35;
  const equipment = (meta?.equipment ?? defaultEquipment).filter((item) => {
    if (item === "body only") return lower.includes("bodyweight") || lower.includes("body weight") || lower.includes("no equipment");
    if (item === "dumbbell") return lower.includes("dumbbell");
    if (item === "barbell") return lower.includes("barbell");
    if (item === "machine") return lower.includes("machine");
    if (item === "cable") return lower.includes("cable");
    if (item === "kettlebells") return lower.includes("kettlebell");
    if (item === "bands") return lower.includes("band");
    if (item === "medicine ball") return lower.includes("medicine ball");
    if (item === "exercise ball") return lower.includes("exercise ball") || lower.includes("stability ball");
    if (item === "foam roll") return lower.includes("foam roll") || lower.includes("foam roller");
    if (item === "e-z curl bar") return lower.includes("ez curl") || lower.includes("e-z curl");
    if (item === "pull-up bar") return lower.includes("pull-up") || lower.includes("pullup");
    if (item === "other") return lower.includes("other equipment");
    return false;
  });
  return {
    name: "Prototype User",
    level: "beginner",
    goal,
    days_per_week: Math.min(6, Math.max(2, days)),
    minutes_per_session: Math.min(75, Math.max(20, minutes)),
    equipment: equipment.length ? equipment : ["body only"],
    injuries: [],
  };
}

function findSlot(plan: Plan, slotId: number) {
  return plan.days.flatMap((day) => day.slots).find((slot) => slot.id === slotId) ?? null;
}
