"use client";

import { useMemo, useState } from "react";

import type {
  Discipline,
  Player,
  PlayerGeneratorArchetype,
  PlayerGeneratorAxisIntentValue,
  PlayerGeneratorAxisSource,
  PlayerGeneratorAttributeName,
  PlayerGeneratorDraft,
  PlayerGeneratorInput,
  PlayerGeneratorMatchState,
  PlayerGeneratorRandomness,
  PlayerGeneratorRoleIntent,
  PlayerGeneratorStrengthTier,
} from "@/lib/data/olyDataTypes";
import {
  buildPlayerGeneratorCatalog,
  createDefaultPlayerGeneratorInput,
  generatePlayerDraft,
  recalculatePlayerGeneratorDraft,
  tightenPlayerGeneratorDraft,
} from "@/lib/player-generator/player-generator-service";

const roleOptions: Array<{ value: PlayerGeneratorRoleIntent; label: string }> = [
  { value: "offense", label: "Offense / Damage" },
  { value: "defense", label: "Defense / Frontline" },
  { value: "support", label: "Support / Utility" },
  { value: "allround", label: "Allround" },
  { value: "specialist", label: "Specialist / Extreme" },
  { value: "chaos", label: "Chaos" },
];

const strengthOptions: Array<{ value: PlayerGeneratorStrengthTier; label: string }> = [
  { value: "very_weak", label: "Very Weak" },
  { value: "weak", label: "Weak" },
  { value: "normal", label: "Normal" },
  { value: "strong", label: "Strong" },
  { value: "elite", label: "Elite" },
  { value: "legendary", label: "Legendary" },
];

const randomnessOptions: Array<{ value: PlayerGeneratorRandomness; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const archetypeOptions: Array<{ value: PlayerGeneratorArchetype; label: string }> = [
  { value: "mage", label: "Mage" },
  { value: "beast", label: "Beast" },
  { value: "rogue", label: "Rogue" },
  { value: "tank", label: "Tank" },
  { value: "warrior", label: "Warrior" },
  { value: "social_icon", label: "Social Icon" },
  { value: "construct", label: "Construct" },
  { value: "undead", label: "Undead" },
  { value: "nature", label: "Nature" },
  { value: "demon", label: "Demon" },
  { value: "angel", label: "Angel" },
  { value: "pirate", label: "Pirate" },
  { value: "ninja", label: "Ninja" },
  { value: "mercenary", label: "Mercenary" },
];

const axisOptions: Array<{ value: PlayerGeneratorAxisIntentValue; label: string }> = [
  { value: "auto", label: "Auto / vom Generator vorschlagen" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const attributeLabels: Array<{ key: keyof PlayerGeneratorDraft["generated"]["attributes"]; label: string }> = [
  { key: "power", label: "Power" },
  { key: "health", label: "Health" },
  { key: "stamina", label: "Stamina" },
  { key: "intelligence", label: "Intelligence" },
  { key: "awareness", label: "Awareness" },
  { key: "determination", label: "Determination" },
  { key: "speed", label: "Speed" },
  { key: "dexterity", label: "Dexterity" },
  { key: "charisma", label: "Charisma" },
  { key: "will", label: "Will" },
  { key: "spirit", label: "Spirit" },
  { key: "torment", label: "Torment" },
];

const attributeLabelMap = Object.fromEntries(attributeLabels.map((entry) => [entry.key, entry.label])) as Record<PlayerGeneratorAttributeName, string>;

function formatValue(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function buildSeed() {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatValidationStatus(status: PlayerGeneratorDraft["validationStatus"]) {
  if (status === "ready_for_review") {
    return "Review-ready";
  }
  if (status === "blocked_archetype_conflict") {
    return "Archetyp gebrochen";
  }
  if (status === "blocked_missing_engine") {
    return "Engine fehlt";
  }
  return "Needs edit";
}

function formatMatchState(state: PlayerGeneratorMatchState) {
  if (state === "ok") {
    return "ok";
  }
  if (state === "failed") {
    return "failed";
  }
  return "warning";
}

function matchStateClass(state: PlayerGeneratorMatchState) {
  if (state === "ok") {
    return " is-success";
  }
  if (state === "failed") {
    return " is-danger";
  }
  return " is-warning";
}

function formatAxisSource(source: PlayerGeneratorAxisSource) {
  if (source === "user") {
    return "user";
  }
  if (source === "auto-role") {
    return "auto-role";
  }
  if (source === "auto-archetype") {
    return "auto-archetype";
  }
  return "blended";
}

function formatGeneratorValueStatus(status: PlayerGeneratorDraft["generated"]["marketValueStatus"] | PlayerGeneratorDraft["generated"]["salaryStatus"]) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "missing_market_value_input") {
    return "wartet auf marketValueNew";
  }
  if (status === "missing_salary_engine") {
    return "blocked";
  }
  return "blocked";
}

function formatFormulaSourceStatus(status: PlayerGeneratorDraft["generated"]["formulaStatus"]["attributeSalaryModifiersStatus"]) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "incomplete_source") {
    return "unvollstaendig";
  }
  return "missing";
}

function formatFormulaEngineStatus(status: PlayerGeneratorDraft["generated"]["formulaStatus"]["marketValueEngineStatus"]) {
  if (status === "ready") {
    return "ready";
  }
  return "blocked";
}

function formatSalaryEngineStatus(status: PlayerGeneratorDraft["generated"]["formulaStatus"]["salaryEngineStatus"]) {
  if (status === "ready_if_market_value_input_present") {
    return "ready";
  }
  return "blocked";
}

function formatClassEngineStatus(status: PlayerGeneratorDraft["generated"]["formulaStatus"]["classEngineStatus"]) {
  if (status === "ready") {
    return "ready";
  }
  if (status === "heuristic") {
    return "heuristic";
  }
  return "blocked";
}

function formatGeneratorWarning(warning: string) {
  return warning
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGeneratorStatusTone(status: "ready" | "blocked" | "incomplete_source" | "missing_market_value_input" | "heuristic" | "missing_progression_source") {
  if (status === "ready") {
    return "is-success";
  }
  if (status === "heuristic") {
    return "is-info";
  }
  return "is-warning";
}

function formatGeneratorEngineStatusLabel(
  key: keyof PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"],
  status: PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"][keyof PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"]],
) {
  if (key === "marketValueEngine") {
    if (status === "ready") {
      return "MW-Engine bereit";
    }
    if (status === "incomplete_source") {
      return "MW-Engine blockiert: Rank→MW-Tabelle ist noch unvollstaendig.";
    }
    return "MW-Engine blockiert: Quelle fehlt noch.";
  }
  if (key === "salaryEngine") {
    if (status === "ready") {
      return "Gehalt kann berechnet werden.";
    }
    if (status === "missing_market_value_input") {
      return "Gehalt vorbereitet, wartet auf echten Marktwert.";
    }
    return "Gehalt blockiert: Formelquellen fehlen noch.";
  }
  if (key === "classEngine") {
    if (status === "ready") {
      return "Class Engine nutzt echte Faktoren.";
    }
    if (status === "heuristic") {
      return "Class Engine laeuft heuristisch.";
    }
    return "Class Engine blockiert.";
  }
  return "Potential fehlt: Es gibt noch keine belastbare Progressionsquelle.";
}

function formatQualityWarningLabel(warning: PlayerGeneratorDraft["generated"]["diagnostics"]["qualityWarnings"][number]) {
  switch (warning) {
    case "archetype_constraint_failed":
      return "Archetyp trifft die gesetzten Grenzen noch nicht sauber.";
    case "role_profile_weak":
      return "Rollenprofil ist noch zu schwach oder zu weich ausgepraegt.";
    case "too_flat_profile":
      return "Profil ist zu flach und braucht klarere Spitzen und Schwaechen.";
    case "axis_auto_resolved":
      return "Mindestens eine Achse wurde automatisch aus Rolle oder Archetyp abgeleitet.";
    case "archetype_pool_missing":
      return "Fuer den Archetyp fehlt im aktuellen Pool eine saubere Race-/Subclass-Basis.";
    case "unknown_trait":
      return "Trait-Hinweis ist im aktuellen Pool nicht bekannt.";
    case "unknown_class":
      return "Class-Hinweis ist im aktuellen Pool nicht bekannt.";
    case "unknown_race":
      return "Race-Hinweis ist im aktuellen Pool nicht bekannt.";
    default:
      return formatGeneratorWarning(warning);
  }
}

function formatSaveCommitReason(reason: PlayerGeneratorDraft["generated"]["diagnostics"]["saveStatus"]["commitReasons"][number]) {
  switch (reason) {
    case "market_value_engine_blocked":
      return "Marktwert ist noch nicht final freigegeben.";
    case "salary_engine_blocked":
      return "Gehaltsengine ist noch nicht vollstaendig freigegeben.";
    case "salary_engine_waits_for_market_value":
      return "Gehalt wartet noch auf einen echten Marktwert.";
    case "commit_path_not_ready":
      return "Der sichere Free-Agent-Commit-Pfad ist in diesem Block bewusst deaktiviert.";
    default:
      return reason;
  }
}

export default function PlayerGeneratorPanel({
  players,
  disciplines,
  drafts,
  readOnly,
  readSourceLabel,
  onSaveDrafts,
}: {
  players: Player[];
  disciplines: Discipline[];
  drafts: PlayerGeneratorDraft[];
  readOnly: boolean;
  readSourceLabel: string;
  onSaveDrafts: (nextDrafts: PlayerGeneratorDraft[]) => void;
}) {
  const catalog = useMemo(() => buildPlayerGeneratorCatalog(players), [players]);
  const [form, setForm] = useState<PlayerGeneratorInput>(() => ({
    ...createDefaultPlayerGeneratorInput(),
    seed: buildSeed(),
  }));
  const [currentDraft, setCurrentDraft] = useState<PlayerGeneratorDraft | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const savedDrafts = useMemo(
    () =>
      [...drafts].sort((left, right) => {
        const leftStamp = left.updatedAt ?? left.createdAt;
        const rightStamp = right.updatedAt ?? right.createdAt;
        return rightStamp.localeCompare(leftStamp, "de");
      }),
    [drafts],
  );

  function updateForm<K extends keyof PlayerGeneratorInput>(key: K, value: PlayerGeneratorInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage(null);
  }

  function updateAxis(axis: "pow" | "spe" | "men" | "soc", value: PlayerGeneratorAxisIntentValue) {
    setForm((current) => ({
      ...current,
      axisIntent: {
        ...current.axisIntent,
        [axis]: value,
      },
    }));
    setMessage(null);
  }

  function runGenerate(nextSeed?: string) {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...form,
        seed: nextSeed ?? form.seed ?? buildSeed(),
      },
      players,
      disciplines,
    });
    setCurrentDraft(draft);
    setSelectedDraftId(null);
    setForm(draft.input);
    setMessage("Neuer Player-Draft wurde lokal erzeugt.");
  }

  function rerollDraft() {
    const nextSeed = buildSeed();
    runGenerate(nextSeed);
  }

  function sharpenDraft() {
    if (!currentDraft) {
      return;
    }
    const nextDraft = tightenPlayerGeneratorDraft({
      draft: currentDraft,
      players,
      disciplines,
    });
    setCurrentDraft(nextDraft);
    setForm(nextDraft.input);
    setMessage("Profil wurde auf demselben Seed nachgeschaerft.");
  }

  function loadDraft(draft: PlayerGeneratorDraft) {
    setCurrentDraft(draft);
    setSelectedDraftId(draft.draftId);
    setForm(draft.input);
    setMessage(`Draft ${draft.generated.name} geladen.`);
  }

  function saveDraft() {
    if (!currentDraft) {
      return;
    }
    if (readOnly) {
      setMessage("Prisma / Referenzmodus bleibt read-only. Drafts koennen nur lokal gespeichert werden.");
      return;
    }

    const nextDraft = {
      ...currentDraft,
      updatedAt: new Date().toISOString(),
    };
    const existingIndex = drafts.findIndex((entry) => entry.draftId === nextDraft.draftId);
    const nextDrafts = existingIndex >= 0 ? [...drafts] : [...drafts, nextDraft];

    if (existingIndex >= 0) {
      nextDrafts[existingIndex] = nextDraft;
    }

    onSaveDrafts(nextDrafts);
    setCurrentDraft(nextDraft);
    setSelectedDraftId(nextDraft.draftId);
    setMessage(`Draft lokal gespeichert. Noch kein Free Agent: ${nextDraft.generated.name}.`);
  }

  function deleteDraft(draftId: string) {
    if (readOnly) {
      setMessage("Prisma / Referenzmodus bleibt read-only. Drafts koennen hier nicht geloescht werden.");
      return;
    }

    const nextDrafts = drafts.filter((entry) => entry.draftId !== draftId);
    onSaveDrafts(nextDrafts);
    if (currentDraft?.draftId === draftId) {
      setCurrentDraft(null);
      setSelectedDraftId(null);
    }
    setMessage("Draft wurde lokal entfernt.");
  }

  function updateDraft(
    updater: (draft: PlayerGeneratorDraft) => PlayerGeneratorDraft,
    recalc = false,
  ) {
    setCurrentDraft((current) => {
      if (!current) {
        return current;
      }
      const nextDraft = updater(current);
      return recalc ? recalculatePlayerGeneratorDraft({ draft: nextDraft, players, disciplines }) : nextDraft;
    });
    setMessage(null);
  }

  async function copySeed() {
    if (!currentDraft?.input.seed) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentDraft.input.seed);
      setMessage("Seed wurde kopiert.");
    } catch {
      setMessage("Seed konnte im Browser nicht kopiert werden.");
    }
  }

  const disciplineRows = useMemo(
    () =>
      currentDraft
        ? disciplines
            .map((discipline) => ({
              id: discipline.id,
              name: discipline.name,
              value: currentDraft.generated.disciplineRatings[discipline.id] ?? null,
            }))
            .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY))
        : [],
    [currentDraft, disciplines],
  );

  const topDisciplineIds = useMemo(() => new Set(disciplineRows.slice(0, 5).map((entry) => entry.id)), [disciplineRows]);

  return (
    <section className="panel foundation-wide">
      <div className="panel-header">
        <div className="stack">
          <h2>Player Generator</h2>
          <p className="muted">
            Lokale Drafts fuer neue Spieler. Disziwerte kommen nur aus offizieller Gewichtung, Marktwert und Gehalt bleiben bewusst offen.
          </p>
        </div>
        <div className="room-meta foundation-admin-meta">
          <span className="pill">Drafts {drafts.length}</span>
          <span className={`pill foundation-source-pill${readOnly ? " is-readonly" : ""}`}>Write source: {readSourceLabel}</span>
        </div>
      </div>

      <div className="foundation-player-generator-layout">
        <div className="foundation-player-generator-form">
          <div className="foundation-player-generator-grid">
            <label className="filter-field">
              <span>Name optional</span>
              <input
                className="input"
                type="text"
                value={form.name ?? ""}
                placeholder="Wird sonst automatisch erzeugt"
                onChange={(event) => updateForm("name", event.target.value || null)}
              />
            </label>

            <label className="filter-field">
              <span>Rolle / Stat-Profil</span>
              <select
                className="input"
                value={form.roleIntent}
                onChange={(event) => updateForm("roleIntent", event.target.value as PlayerGeneratorRoleIntent)}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Staerke-Level</span>
              <select
                className="input"
                value={form.strengthTier}
                onChange={(event) => updateForm("strengthTier", event.target.value as PlayerGeneratorStrengthTier)}
              >
                {strengthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Varianz</span>
              <select
                className="input"
                value={form.randomness}
                onChange={(event) => updateForm("randomness", event.target.value as PlayerGeneratorRandomness)}
              >
                {randomnessOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Fantasy-Archetyp / Wesen</span>
              <select
                className="input"
                value={form.preferredArchetype ?? ""}
                onChange={(event) =>
                  updateForm(
                    "preferredArchetype",
                    event.target.value ? (event.target.value as PlayerGeneratorArchetype) : null,
                  )
                }
              >
                <option value="">Kein harter Bias</option>
                {archetypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>Seed</span>
              <input
                className="input"
                type="text"
                value={form.seed ?? ""}
                onChange={(event) => updateForm("seed", event.target.value || buildSeed())}
              />
            </label>

            <label className="filter-field">
              <span>Race Hint</span>
              <input
                className="input"
                type="text"
                value={form.raceHint ?? ""}
                list="player-generator-races"
                onChange={(event) => updateForm("raceHint", event.target.value || null)}
              />
            </label>

            <label className="filter-field">
              <span>Class Hint</span>
              <input
                className="input"
                type="text"
                value={form.classHint ?? ""}
                list="player-generator-classes"
                onChange={(event) => updateForm("classHint", event.target.value || null)}
              />
            </label>

            <label className="filter-field">
              <span>Trait Hint</span>
              <input
                className="input"
                type="text"
                value={form.traitHint ?? ""}
                list="player-generator-positive-traits"
                onChange={(event) => updateForm("traitHint", event.target.value || null)}
              />
            </label>
          </div>

          <div className="foundation-player-axis-grid">
            {(["pow", "spe", "men", "soc"] as const).map((axis) => (
              <label key={axis} className="filter-field foundation-player-axis-field">
                <span>{axis.toUpperCase()} optional: Achsen-Bias</span>
                <select
                  className="input"
                  value={String(form.axisIntent[axis] ?? "auto")}
                  onChange={(event) =>
                    updateAxis(
                      axis,
                      event.target.value === "auto" ? "auto" : (Number(event.target.value) as PlayerGeneratorAxisIntentValue),
                    )
                  }
                >
                  {axisOptions.map((option) => (
                    <option key={`${axis}-${String(option.value)}`} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="foundation-save-actions" style={{ marginTop: 12 }}>
            <button className="primary-button" type="button" onClick={() => runGenerate()}>
              Draft generieren
            </button>
            <button className="secondary-button" type="button" onClick={rerollDraft}>
              Neu wuerfeln
            </button>
            <button className="secondary-button" type="button" onClick={sharpenDraft} disabled={!currentDraft}>
              Profil nachschaerfen
            </button>
            <button className="secondary-button" type="button" onClick={copySeed} disabled={!currentDraft?.input.seed}>
              Seed kopieren
            </button>
            <button className="primary-button" type="button" onClick={saveDraft} disabled={!currentDraft || readOnly}>
              Draft speichern
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled
              title="Noch deaktiviert: Erst sicheren Free-Agent-Insert-Pfad bauen."
            >
              Als Free Agent uebernehmen
            </button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Free-Agent-Insert bleibt in diesem Block absichtlich deaktiviert, bis ein separater sicherer Insert-Pfad gebaut ist.
          </p>
          {message ? <p className="text-positive">{message}</p> : null}
        </div>

        <div className="foundation-player-generator-preview">
          {currentDraft ? (
            <>
              <div className="foundation-player-generator-callout">
                <div className="panel-header">
                  <div className="stack">
                    <h3>Player Draft Preview</h3>
                    <p className="muted">
                      Diese Werte sind ein lokaler Draft. Draft speichern speichert nur den Entwurf im lokalen Save.
                    </p>
                  </div>
                </div>
                <div className="room-meta foundation-admin-meta">
                  <span className="pill">Draft: lokal</span>
                  <span className="pill">DB: nicht gespeichert</span>
                  <span className="pill">Free Agent: nein</span>
                  <span className="pill">Prisma: read-only</span>
                </div>
                <p className="muted" style={{ marginTop: 10 }}>
                  Als Free Agent uebernehmen bleibt deaktiviert, bis ein sicherer Insert-Pfad gebaut ist.
                </p>
                <p className="muted" style={{ marginTop: 8 }}>
                  Bestehende Spieler nutzen bis zur fertigen MW-/Gehalts-Umstellung weiter die importierten Marktwerte und Gehaelter.
                </p>
              </div>

              <div className="foundation-player-generator-hero foundation-player-generator-hero-compact">
                <div className="foundation-player-generator-portrait">{buildInitials(currentDraft.generated.name)}</div>
                <div className="stack">
                  <span className={`pill${currentDraft.validationStatus === "ready_for_review" ? " is-success" : currentDraft.validationStatus === "blocked_archetype_conflict" ? " is-danger" : " is-warning"}`}>
                    {formatValidationStatus(currentDraft.validationStatus)}
                  </span>
                  <strong>{currentDraft.generated.name}</strong>
                  <span className="muted">
                    {currentDraft.generated.className} · {currentDraft.generated.race}
                  </span>
                </div>
              </div>

              <div className="foundation-player-generator-warning-grid foundation-player-generator-status-grid">
                <div className="foundation-player-generator-callout">
                  <strong>Engine-Status</strong>
                  <div className="foundation-player-generator-status-cards">
                    {([
                      ["marketValueEngine", "Marktwert"],
                      ["salaryEngine", "Gehalt"],
                      ["classEngine", "Class Engine"],
                      ["potentialEngine", "Potential"],
                    ] as const).map(([key, label]) => {
                      const status = currentDraft.generated.diagnostics.engineStatus[key];
                      return (
                        <article key={key} className={`foundation-player-generator-status-card ${getGeneratorStatusTone(status)}`}>
                          <span>{label}</span>
                          <strong>{formatGeneratorEngineStatusLabel(key, status)}</strong>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="foundation-player-generator-callout">
                  <strong>Draft-Status</strong>
                  <ul className="foundation-inline-list">
                    <li>OVR ist eine Draft-Vorschau, kein finaler Pool-Wert.</li>
                    <li>PPs sind Draft-Vorschauwerte und keine Season-PPs.</li>
                    <li>Draft speichern legt nur einen lokalen Entwurf ab.</li>
                    <li>Bestehende Spieler nutzen weiter importierte MW-/Gehaltswerte.</li>
                  </ul>
                </div>

                <div className="foundation-player-generator-callout">
                  <strong>Save-Status</strong>
                  <div className="foundation-player-generator-status-cards">
                    <article className={`foundation-player-generator-status-card ${readOnly ? "is-warning" : "is-success"}`}>
                      <span>Draft speichern</span>
                      <strong>{readOnly ? "Read-only in Prisma" : "Aktiv fuer lokalen Entwurf"}</strong>
                    </article>
                    <article className="foundation-player-generator-status-card is-warning">
                      <span>Free-Agent-Commit</span>
                      <strong>Deaktiviert</strong>
                    </article>
                  </div>
                  <ul className="foundation-inline-list">
                    {currentDraft.generated.diagnostics.saveStatus.commitReasons.map((reason) => (
                      <li key={reason}>{formatSaveCommitReason(reason)}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="foundation-player-generator-callout">
                <strong>Qualitaetswarnungen</strong>
                {currentDraft.generated.diagnostics.qualityWarnings.length > 0 ? (
                  <ul className="foundation-inline-list">
                    {currentDraft.generated.diagnostics.qualityWarnings.map((warning) => (
                      <li key={warning}>{formatQualityWarningLabel(warning)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Keine aktiven Profilwarnungen. Draft ist inhaltlich konsistent und wartet nur auf offene Engine-Quellen.
                  </p>
                )}
              </div>

              <div className="foundation-player-generator-callout">
                <div className="panel-header">
                  <div className="stack">
                    <h3>Finaler Spieler-Entwurf</h3>
                    <p className="muted">Das wuerde am Ende entstehen, wenn der Draft spaeter ueber einen separaten sicheren Insert-Pfad uebernommen wird.</p>
                  </div>
                </div>
                <div className="foundation-player-generator-final-grid">
                  <article className="foundation-player-generator-final-item">
                    <span>Name</span>
                    <strong>{currentDraft.generated.name}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Race</span>
                    <strong>{currentDraft.generated.race}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Class</span>
                    <strong>{currentDraft.generated.className}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Subclasses</span>
                    <strong>{currentDraft.generated.subclasses.join(", ") || "—"}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Traits +</span>
                    <strong>{currentDraft.generated.traitsPositive.join(", ") || "—"}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Traits -</span>
                    <strong>{currentDraft.generated.traitsNegative.join(", ") || "—"}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Alignment</span>
                    <strong>—</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Gender</span>
                    <strong>—</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Height</span>
                    <strong>—</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Status</span>
                    <strong>Draft</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Source</span>
                    <strong>{readSourceLabel}</strong>
                  </article>
                </div>
              </div>

              <div className="foundation-player-generator-diagnostics foundation-player-generator-diagnostics-compact">
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Archetype Match</span>
                  <strong className={`foundation-player-generator-state${matchStateClass(currentDraft.generated.diagnostics.archetypeMatch)}`}>
                    {formatMatchState(currentDraft.generated.diagnostics.archetypeMatch)}
                  </strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Role Match</span>
                  <strong className={`foundation-player-generator-state${matchStateClass(currentDraft.generated.diagnostics.roleMatch)}`}>
                    {formatMatchState(currentDraft.generated.diagnostics.roleMatch)}
                  </strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Stat Silhouette</span>
                  <strong className={`foundation-player-generator-state${matchStateClass(currentDraft.generated.diagnostics.statSilhouette)}`}>
                    {formatMatchState(currentDraft.generated.diagnostics.statSilhouette)}
                  </strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Stat Spread</span>
                  <strong>{formatValue(currentDraft.generated.diagnostics.statSpread, 0)}</strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Peak Attributes</span>
                  <strong>
                    {currentDraft.generated.diagnostics.peakAttributes.map((entry) => attributeLabelMap[entry]).join(", ") || "—"}
                  </strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Weak Attributes</span>
                  <strong>
                    {currentDraft.generated.diagnostics.weakAttributes.map((entry) => attributeLabelMap[entry]).join(", ") || "—"}
                  </strong>
                </article>
                <article className="foundation-player-generator-diagnostic-card">
                  <span>Flat Cluster</span>
                  <strong>{formatValue(currentDraft.generated.diagnostics.flatAttributeCount, 0)}</strong>
                </article>
              </div>

              <div className="metric-grid foundation-player-generator-axis-cards" style={{ marginTop: 12 }}>
                {(["pow", "spe", "men", "soc"] as const).map((axis) => (
                  <article key={`resolved-${axis}`} className="metric-card">
                    <span>{axis.toUpperCase()} Auto-Intent</span>
                    <strong>{formatValue(currentDraft.generated.diagnostics.resolvedAxisIntent[axis], 0)}</strong>
                    <small className="muted">{formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources[axis])}</small>
                  </article>
                ))}
              </div>

              <div className="foundation-player-generator-preview-grid">
                <label className="filter-field">
                  <span>Name</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.name}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          name: event.target.value || "Unnamed Draft",
                        },
                      }))
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Klasse</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.className}
                    list="player-generator-classes"
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          className: event.target.value || draft.generated.classSuggestion.className,
                        },
                      }))
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Rasse</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.race}
                    list="player-generator-races"
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          race: event.target.value || "Human",
                        },
                      }))
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Subclasses</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.subclasses.join(", ")}
                    list="player-generator-subclasses"
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          subclasses: splitCsv(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Traits positiv</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.traitsPositive.join(", ")}
                    list="player-generator-positive-traits"
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          traitsPositive: splitCsv(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Traits negativ</span>
                  <input
                    className="input"
                    type="text"
                    value={currentDraft.generated.traitsNegative.join(", ")}
                    list="player-generator-negative-traits"
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        generated: {
                          ...draft.generated,
                          traitsNegative: splitCsv(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="foundation-player-generator-section-head">
                <h3>Attribute</h3>
                <p className="muted">12 Attribute als kompakter Draft-Block. Ohne Nachkommastellen.</p>
              </div>
              <div className="table-shell foundation-player-generator-attribute-shell" style={{ marginTop: 10 }}>
                <table className="data-table compact-table foundation-player-generator-attribute-table">
                  <thead>
                    <tr>
                      {attributeLabels.map((attribute) => (
                        <th key={attribute.key}>{attribute.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {attributeLabels.map((attribute) => (
                        <td key={attribute.key}>
                          <input
                            className="input foundation-player-generator-attribute-input"
                            type="number"
                            min={1}
                            max={99}
                            value={currentDraft.generated.attributes[attribute.key] ?? ""}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              updateDraft(
                                (draft) => ({
                                  ...draft,
                                  generated: {
                                    ...draft.generated,
                                    attributes: {
                                      ...draft.generated.attributes,
                                      [attribute.key]: Math.min(Math.max(Number.isFinite(nextValue) ? nextValue : 1, 1), 99),
                                    },
                                  },
                                }),
                                true,
                              );
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="foundation-player-generator-section-head">
                <h3>Achsen</h3>
                <p className="muted">POW, SPE, MEN und SOC als Draft-Achsen. Ohne Nachkommastellen.</p>
              </div>
              <div className="metric-grid foundation-player-generator-axis-cards" style={{ marginTop: 10 }}>
                <article className="metric-card">
                  <span>POW</span>
                  <strong>{formatValue(currentDraft.generated.axes.pow, 0)}</strong>
                  <small className="muted">{formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources.pow)}</small>
                </article>
                <article className="metric-card">
                  <span>SPE</span>
                  <strong>{formatValue(currentDraft.generated.axes.spe, 0)}</strong>
                  <small className="muted">{formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources.spe)}</small>
                </article>
                <article className="metric-card">
                  <span>MEN</span>
                  <strong>{formatValue(currentDraft.generated.axes.men, 0)}</strong>
                  <small className="muted">{formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources.men)}</small>
                </article>
                <article className="metric-card">
                  <span>SOC</span>
                  <strong>{formatValue(currentDraft.generated.axes.soc, 0)}</strong>
                  <small className="muted">{formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources.soc)}</small>
                </article>
                <article className="metric-card">
                  <span>OVR: Draftwert</span>
                  <strong>{formatValue(currentDraft.generated.ovr, 0)}</strong>
                </article>
                <article className="metric-card">
                  <span>PPs: Draftwert</span>
                  <strong>{formatValue(currentDraft.generated.pps, 0)}</strong>
                </article>
                <article className="metric-card">
                  <span>MW</span>
                  <strong>{formatValue(currentDraft.generated.marketValue, 2)}</strong>
                  <small className="muted">{currentDraft.generated.marketValueStatus}</small>
                </article>
                <article className="metric-card">
                  <span>Gehalt</span>
                  <strong>{formatValue(currentDraft.generated.salary, 2)}</strong>
                  <small className="muted">{currentDraft.generated.salaryStatus}</small>
                </article>
              </div>

              <div className="foundation-player-generator-section-head">
                <h3>Disziwerte</h3>
                <p className="muted">Draft-Disziwerte aus offizieller Gewichtungsmatrix. Top 5 sind hervorgehoben, ohne Season-Punkte zu behaupten.</p>
              </div>
              <div className="foundation-player-generator-discipline-grid">
                {disciplineRows.map((row) => (
                  <article key={row.id} className={`metric-card${topDisciplineIds.has(row.id) ? " is-highlighted" : ""}`}>
                    <span>{row.name}</span>
                    <strong>{formatValue(row.value, 0)}</strong>
                  </article>
                ))}
              </div>

              <div className="foundation-player-generator-callout">
                <strong>Klassenvorschlag</strong>
                <p>
                  {currentDraft.generated.classSuggestion.className} · Fit {formatValue(currentDraft.generated.classSuggestion.fitScore, 0)}
                </p>
                {currentDraft.generated.formulaStatus.classEngineStatus === "heuristic" ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Class Suggestion: heuristic
                  </p>
                ) : null}
                {currentDraft.generated.classSuggestion.reasons.length ? (
                  <ul className="foundation-inline-list">
                    {currentDraft.generated.classSuggestion.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="foundation-player-generator-callout">
                <strong>Archetyp / Rollencheck</strong>
                <div className="foundation-player-generator-summary-grid">
                  <div>
                    <span className="muted">Archetyp</span>
                    <ul className="foundation-inline-list">
                      {currentDraft.generated.diagnostics.archetypeSummary.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="muted">Rolle</span>
                    <ul className="foundation-inline-list">
                      {currentDraft.generated.diagnostics.roleSummary.map((entry) => (
                        <li key={entry}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

            </>
          ) : (
            <div className="foundation-player-generator-empty">
              <strong>Noch kein Draft aktiv.</strong>
              <p className="muted">Erzeuge zuerst einen Spielerentwurf oder lade einen gespeicherten Draft.</p>
            </div>
          )}
        </div>
      </div>

      <div className="panel inset-panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <h3>Gespeicherte lokale Drafts</h3>
        </div>
        {savedDrafts.length === 0 ? (
          <p className="muted">Noch keine Drafts im aktuellen lokalen Save gespeichert.</p>
        ) : (
          <div className="save-summary-list">
            {savedDrafts.map((draft) => (
              <article
                key={draft.draftId}
                className={`save-summary-card${selectedDraftId === draft.draftId ? " is-active" : ""}`}
              >
                <strong>{draft.generated.name}</strong>
                <span className="muted">
                  {draft.generated.className} · {draft.generated.race}
                </span>
                <span className="muted">
                  Seed {draft.input.seed ?? "—"} · Update {new Date(draft.updatedAt ?? draft.createdAt).toLocaleString("de-DE")}
                </span>
                <div className="foundation-save-actions">
                  <button className="secondary-button" type="button" onClick={() => loadDraft(draft)}>
                    Laden
                  </button>
                  <button className="secondary-button" type="button" disabled={readOnly} onClick={() => deleteDraft(draft.draftId)}>
                    Loeschen
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <datalist id="player-generator-races">
        {catalog.races.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="player-generator-classes">
        {catalog.classes.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="player-generator-subclasses">
        {catalog.subclasses.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="player-generator-positive-traits">
        {catalog.positiveTraits.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="player-generator-negative-traits">
        {catalog.negativeTraits.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
    </section>
  );
}
