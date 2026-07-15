"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";

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
  type PlayerGeneratorTeamContext,
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

const contractModeOptions: Array<{ value: NonNullable<PlayerGeneratorInput["contractMode"]>; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "value", label: "Value Deal" },
  { value: "front_loaded", label: "Front-loaded" },
  { value: "back_loaded", label: "Back-loaded" },
  { value: "prove_it", label: "Prove-it" },
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

function formatMoneyValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatValue(value, 2)} Mio`;
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

function normalizePortraitUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
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
  if (status === "heuristic_estimate") {
    return "heuristische Schätzung";
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
    return "unvollständig";
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
    if (status === "heuristic") {
      return "MW ist eine heuristische Schätzung, keine Engine-verifizierte Ranked-MW.";
    }
    if (status === "incomplete_source") {
      return "MW-Engine blockiert: Rank→MW-Tabelle ist noch unvollständig.";
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
      return "Class Engine läuft heuristisch.";
    }
    return "Class Engine blockiert.";
  }
  if (key === "potentialEngine") {
    if (status === "ready") {
      return "Potential nutzt das echte CA/PO-Sternemodell.";
    }
    return "Potential fehlt: Es gibt noch keine belastbare Progressionsquelle.";
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
      return "Profil ist zu flach und braucht klarere Spitzen und Schwächen.";
    case "axis_auto_resolved":
      return "Mindestens eine Achse wurde automatisch aus Rolle oder Archetyp abgeleitet.";
    case "archetype_pool_missing":
      return "Für den Archetyp fehlt im aktuellen Pool eine saubere Race-/Subclass-Basis.";
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
      return "Gehaltsengine ist noch nicht vollständig freigegeben.";
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
  teamContexts,
  activeTeamId,
  readOnly,
  readSourceLabel,
  onSaveDrafts,
}: {
  players: Player[];
  disciplines: Discipline[];
  drafts: PlayerGeneratorDraft[];
  teamContexts: PlayerGeneratorTeamContext[];
  activeTeamId: string | null;
  readOnly: boolean;
  readSourceLabel: string;
  onSaveDrafts: (nextDrafts: PlayerGeneratorDraft[]) => void;
}) {
  const catalog = useMemo(() => buildPlayerGeneratorCatalog(players), [players]);
  const [form, setForm] = useState<PlayerGeneratorInput>(() => ({
    ...createDefaultPlayerGeneratorInput(),
    targetTeamId: activeTeamId,
    seed: buildSeed(),
  }));
  const [currentDraft, setCurrentDraft] = useState<PlayerGeneratorDraft | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [portraitDraftUrl, setPortraitDraftUrl] = useState("");
  const [portraitDragActive, setPortraitDragActive] = useState(false);

  const savedDrafts = useMemo(
    () =>
      [...drafts].sort((left, right) => {
        const leftStamp = left.updatedAt ?? left.createdAt;
        const rightStamp = right.updatedAt ?? right.createdAt;
        return rightStamp.localeCompare(leftStamp, "de");
      }),
    [drafts],
  );
  const activeTeamContext = useMemo(
    () => form.targetTeamId ? teamContexts.find((entry) => entry.team?.teamId === form.targetTeamId) ?? null : null,
    [form.targetTeamId, teamContexts],
  );
  const teamOptions = useMemo(
    () =>
      teamContexts
        .filter((entry): entry is PlayerGeneratorTeamContext & { team: NonNullable<PlayerGeneratorTeamContext["team"]> } => Boolean(entry.team))
        .sort((left, right) => left.team.name.localeCompare(right.team.name, "de")),
    [teamContexts],
  );
  const teamContextById = useMemo(
    () => new Map(teamOptions.map((entry) => [entry.team.teamId, entry] as const)),
    [teamOptions],
  );

  useEffect(() => {
    if (!activeTeamId) {
      return;
    }
    setForm((current) => current.targetTeamId ? current : { ...current, targetTeamId: activeTeamId });
  }, [activeTeamId]);

  function updateForm<K extends keyof PlayerGeneratorInput>(key: K, value: PlayerGeneratorInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage(null);
  }

  function updateFormAndRecalculate<K extends keyof PlayerGeneratorInput>(key: K, value: PlayerGeneratorInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setCurrentDraft((current) => {
      if (!current) {
        return current;
      }
      const nextInput = {
        ...current.input,
        [key]: value,
      };
      const targetTeamId = key === "targetTeamId" ? value as string | null : nextInput.targetTeamId ?? activeTeamId;
      const nextContext = targetTeamId ? teamContextById.get(targetTeamId) ?? activeTeamContext : activeTeamContext;
      return recalculatePlayerGeneratorDraft({
        draft: {
          ...current,
          input: nextInput,
        },
        players,
        disciplines,
        teamContext: nextContext,
      });
    });
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
      teamContext: activeTeamContext,
    });
    setCurrentDraft(draft);
    setSelectedDraftId(null);
    setPortraitDraftUrl(draft.generated.portraitUrl ?? "");
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
      teamContext: activeTeamContext,
    });
    setCurrentDraft(nextDraft);
    setForm(nextDraft.input);
    setMessage("Profil wurde auf demselben Seed nachgeschaerft.");
  }

  function loadDraft(draft: PlayerGeneratorDraft) {
    setCurrentDraft(draft);
    setSelectedDraftId(draft.draftId);
    setPortraitDraftUrl(draft.generated.portraitUrl ?? "");
    setForm(draft.input);
    setMessage(`Draft ${draft.generated.name} geladen.`);
  }

  function saveDraft() {
    if (!currentDraft) {
      return;
    }
    if (readOnly) {
      setMessage("Prisma / Referenzmodus bleibt read-only. Drafts können nur lokal gespeichert werden.");
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
      setMessage("Prisma / Referenzmodus bleibt read-only. Drafts können hier nicht gelöscht werden.");
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
      return recalc ? recalculatePlayerGeneratorDraft({ draft: nextDraft, players, disciplines, teamContext: activeTeamContext }) : nextDraft;
    });
    setMessage(null);
  }

  function updatePortrait(url: string | null) {
    updateDraft((draft) => ({
      ...draft,
      generated: {
        ...draft.generated,
        portraitUrl: url,
      },
    }));
    setPortraitDraftUrl(url ?? "");
    setMessage(url ? "Portrait wurde im lokalen Draft verknuepft." : "Portrait wurde entfernt.");
  }

  function readPortraitFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage("Bitte nur Bilddateien für das Portrait verwenden.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      updatePortrait(result);
    };
    reader.onerror = () => setMessage("Bild konnte nicht gelesen werden.");
    reader.readAsDataURL(file);
  }

  function handlePortraitFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      readPortraitFile(file);
    }
    event.target.value = "";
  }

  function handlePortraitDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setPortraitDragActive(false);
    if (!currentDraft) {
      setMessage("Erzeuge zuerst einen Draft, dann kann ein Portrait verknuepft werden.");
      return;
    }
    const file = Array.from(event.dataTransfer.files).find((entry) => entry.type.startsWith("image/"));
    if (file) {
      readPortraitFile(file);
      return;
    }
    const droppedUrl =
      normalizePortraitUrl(event.dataTransfer.getData("text/uri-list")) ??
      normalizePortraitUrl(event.dataTransfer.getData("text/plain"));
    if (droppedUrl) {
      updatePortrait(droppedUrl);
      return;
    }
    setMessage("Kein Bild oder gueltiger Bild-Link im Drop gefunden.");
  }

  function applyPortraitUrl() {
    const url = normalizePortraitUrl(portraitDraftUrl);
    if (!url) {
      setMessage("Bitte eine Bild-URL, einen lokalen Pfad oder eine Bilddatei verwenden.");
      return;
    }
    updatePortrait(url);
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
  const topDisciplineOutlook = useMemo(
    () => currentDraft?.generated.disciplineOutlook?.slice(0, 6) ?? [],
    [currentDraft],
  );
  const economyProjection = currentDraft?.generated.economyProjection ?? null;
  const teamFit = currentDraft?.generated.teamFit ?? null;

  return (
    <section className="panel foundation-wide">
      <div className="panel-header">
        <div className="stack">
          <h2>Player Generator</h2>
          <p className="muted">
            Lokale Drafts für neue Spieler mit Teamfit, Slot-Ausblick, Economy-Schätzung und sicherem Review vor jedem echten Commit.
          </p>
        </div>
        <div className="room-meta foundation-admin-meta">
          <span className="pill">Drafts {drafts.length}</span>
          <span className={`pill foundation-source-pill${readOnly ? " is-readonly" : ""}`}>Write source: {readSourceLabel}</span>
        </div>
      </div>

      <div className="foundation-player-generator-studio-bar">
        <article>
          <span>Aktiver Kontext</span>
          <strong>{activeTeamContext?.team?.name ?? "Kein Zielteam"}</strong>
          <small>{activeTeamContext?.generalManager?.title ?? "GM offen"} · Roster {activeTeamContext?.rosterCount ?? "—"}</small>
        </article>
        <article>
          <span>Build-Fokus</span>
          <strong>{roleOptions.find((option) => option.value === form.roleIntent)?.label ?? form.roleIntent}</strong>
          <small>{form.strengthTier} · {form.randomness} Varianz</small>
        </article>
        <article>
          <span>Economy</span>
          <strong>{contractModeOptions.find((option) => option.value === (form.contractMode ?? "balanced"))?.label ?? "Balanced"}</strong>
          <small>Ø Gehalt Team {formatMoneyValue(activeTeamContext?.averageSalary ?? null)}</small>
        </article>
      </div>

      <div className="foundation-player-generator-layout">
        <div className="foundation-player-generator-form foundation-player-generator-builder-panel">
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
              <span>Zielteam / Fit-Kontext</span>
              <select
                className="input"
                value={form.targetTeamId ?? ""}
                onChange={(event) => updateFormAndRecalculate("targetTeamId", event.target.value || null)}
              >
                <option value="">Kein Zielteam</option>
                {teamOptions.map((entry) => (
                  <option key={entry.team.teamId} value={entry.team.teamId}>
                    {entry.team.shortCode} · {entry.team.name}
                  </option>
                ))}
              </select>
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
              <span>Stärke-Level</span>
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
              <span>Vertragsarchitektur</span>
              <select
                className="input"
                value={form.contractMode ?? "balanced"}
                onChange={(event) =>
                  updateFormAndRecalculate("contractMode", event.target.value as NonNullable<PlayerGeneratorInput["contractMode"]>)
                }
              >
                {contractModeOptions.map((option) => (
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
              Als Free Agent übernehmen
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
              <div className="foundation-player-generator-builder-hero">
                <div className="foundation-player-generator-card-hero">
                  <div
                    className={`foundation-player-generator-image-drop${portraitDragActive ? " is-dragging" : ""}${currentDraft.generated.portraitUrl ? " has-image" : ""}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setPortraitDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setPortraitDragActive(true);
                    }}
                    onDragLeave={() => setPortraitDragActive(false)}
                    onDrop={handlePortraitDrop}
                  >
                    {currentDraft.generated.portraitUrl ? (
                      <img src={currentDraft.generated.portraitUrl} alt={currentDraft.generated.name} />
                    ) : (
                      <div className="foundation-player-generator-portrait">{buildInitials(currentDraft.generated.name)}</div>
                    )}
                    <div className="foundation-player-generator-image-drop-copy">
                      <strong>{currentDraft.generated.portraitUrl ? "Portrait verknuepft" : "Bild hier reinziehen"}</strong>
                      <span>Bilddatei, Bild-URL oder lokaler Pfad</span>
                    </div>
                  </div>
                  <div className="foundation-player-generator-card-copy">
                    <div className="foundation-player-generator-card-title">
                      <span className={`pill${currentDraft.validationStatus === "ready_for_review" ? " is-success" : currentDraft.validationStatus === "blocked_archetype_conflict" ? " is-danger" : " is-warning"}`}>
                        {formatValidationStatus(currentDraft.validationStatus)}
                      </span>
                      <strong>{currentDraft.generated.name}</strong>
                      <small>
                        {currentDraft.generated.className} · {currentDraft.generated.race} · {currentDraft.generated.projectedRole ?? "draft"}
                      </small>
                    </div>
                    <div className="foundation-player-generator-portrait-controls">
                      <input
                        className="input"
                        type="text"
                        value={portraitDraftUrl}
                        placeholder="Portrait-URL oder /media/pfad einfügen"
                        onChange={(event) => setPortraitDraftUrl(event.target.value)}
                      />
                      <button className="secondary-button inline-button" type="button" onClick={applyPortraitUrl}>
                        Link setzen
                      </button>
                      <label className="secondary-button inline-button foundation-player-generator-file-button">
                        Datei
                        <input accept="image/*" type="file" onChange={handlePortraitFileChange} />
                      </label>
                      <button className="secondary-button inline-button" type="button" onClick={() => updatePortrait(null)} disabled={!currentDraft.generated.portraitUrl}>
                        Entfernen
                      </button>
                    </div>
                    <div className="foundation-player-generator-card-meta">
                      <span>Ziel {teamFit?.teamName ?? activeTeamContext?.team?.name ?? "Kein Zielteam"}</span>
                      <span>GM {activeTeamContext?.generalManager?.title ?? "—"}</span>
                      <span>Seed {currentDraft.input.seed ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="foundation-player-generator-score-strip">
                  <article>
                    <span>OVR</span>
                    <strong>{formatValue(currentDraft.generated.ovr, 0)}</strong>
                  </article>
                  <article>
                    <span>PPs</span>
                    <strong>{formatValue(currentDraft.generated.pps, 1)}</strong>
                  </article>
                  <article>
                    <span>Teamfit</span>
                    <strong>{formatValue(teamFit?.score, 0)}</strong>
                  </article>
                  <article>
                    <span>Captain</span>
                    <strong>{formatValue(currentDraft.generated.captaincyScore, 0)}</strong>
                  </article>
                  <article>
                    <span>MW</span>
                    <strong>{formatMoneyValue(economyProjection?.marketValueEstimate ?? currentDraft.generated.marketValue)}</strong>
                  </article>
                  <article>
                    <span>Gehalt</span>
                    <strong>{formatMoneyValue(economyProjection?.salaryEstimate ?? currentDraft.generated.salary)}</strong>
                  </article>
                </div>
              </div>

              <div className="foundation-player-generator-decision-grid">
                <div className="foundation-player-generator-callout">
                  <strong>Teamfit</strong>
                  <div className="foundation-player-generator-mini-metrics">
                    <span>Achse {formatValue(teamFit?.axisFit, 0)}</span>
                    <span>GM {formatValue(teamFit?.gmFit, 0)}</span>
                    <span>Traits {formatValue(teamFit?.traitFit, 0)}</span>
                    <span>Kader {teamFit?.rosterNeed ?? "unknown"}</span>
                  </div>
                  <ul className="foundation-inline-list">
                    {(teamFit?.reasons ?? ["Kein Teamkontext aktiv."]).slice(0, 3).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <div className="foundation-player-generator-callout">
                  <strong>Vertrag & Value</strong>
                  <div className="foundation-player-generator-mini-metrics">
                    <span>{economyProjection?.contractMode ?? "balanced"}</span>
                    <span>LZ {economyProjection?.recommendedContractLength ?? "—"}</span>
                    <span>Ratio {formatValue(economyProjection?.valueRatio, 2)}</span>
                    <span>Druck {economyProjection?.salaryPressure ?? "unknown"}</span>
                  </div>
                  {economyProjection?.salarySchedule.length ? (
                    <div className="foundation-player-generator-contract-bars">
                      {economyProjection.salarySchedule.map((entry) => (
                        <span key={entry.yearIndex}>
                          {entry.label}: {formatMoneyValue(entry.salary)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Noch keine Gehaltsstaffel berechenbar.</p>
                  )}
                </div>
                <div className="foundation-player-generator-callout">
                  <strong>Slot-/Diszi-Ausblick</strong>
                  <div className="foundation-player-generator-slot-list">
                    {topDisciplineOutlook.slice(0, 4).map((entry) => (
                      <article key={entry.disciplineId}>
                        <span>{entry.disciplineName}</span>
                        <strong>{formatValue(entry.rating, 0)}</strong>
                        <small>{entry.bestSlotLabel ?? "Slot offen"} · {entry.keyAttributes.map((attribute) => attributeLabelMap[attribute]).join(" / ") || "—"}</small>
                      </article>
                    ))}
                  </div>
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
                    <li>MW und Gehalt sind Generator-Projections für Review und Balancing.</li>
                    <li>Draft speichern legt nur einen lokalen Entwurf ab.</li>
                    <li>Free-Agent-Commit bleibt deaktiviert, bis der sichere Insert-Pfad gebaut ist.</li>
                  </ul>
                </div>

                <div className="foundation-player-generator-callout">
                  <strong>Save-Status</strong>
                  <div className="foundation-player-generator-status-cards">
                    <article className={`foundation-player-generator-status-card ${readOnly ? "is-warning" : "is-success"}`}>
                      <span>Draft speichern</span>
                      <strong>{readOnly ? "Read-only in Prisma" : "Aktiv für lokalen Entwurf"}</strong>
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
                    <p className="muted">Das würde am Ende entstehen, wenn der Draft später über einen separaten sicheren Insert-Pfad uebernommen wird.</p>
                  </div>
                </div>
                <div className="foundation-player-generator-final-grid">
                  <article className="foundation-player-generator-final-item">
                    <span>Name</span>
                    <strong>{currentDraft.generated.name}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Portrait</span>
                    <strong>{currentDraft.generated.portraitUrl ? "verknuepft" : "fehlt"}</strong>
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
                    <span>Projected Role</span>
                    <strong>{currentDraft.generated.projectedRole ?? "—"}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Teamfit</span>
                    <strong>{teamFit?.teamName ?? "—"} · {formatValue(teamFit?.score, 0)}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>Captain Score</span>
                    <strong>{formatValue(currentDraft.generated.captaincyScore, 0)}</strong>
                  </article>
                  <article className="foundation-player-generator-final-item">
                    <span>MW / Gehalt</span>
                    <strong>{formatMoneyValue(economyProjection?.marketValueEstimate)} / {formatMoneyValue(economyProjection?.salaryEstimate)}</strong>
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
                  <span>MW Projection</span>
                  <strong>{formatMoneyValue(economyProjection?.marketValueEstimate ?? currentDraft.generated.marketValue)}</strong>
                  <small className="muted">{currentDraft.generated.marketValueStatus}</small>
                </article>
                <article className="metric-card">
                  <span>Gehalt Projection</span>
                  <strong>{formatMoneyValue(economyProjection?.salaryEstimate ?? currentDraft.generated.salary)}</strong>
                  <small className="muted">{currentDraft.generated.salaryStatus}</small>
                </article>
              </div>

              <div className="foundation-player-generator-section-head">
                <h3>Disziwerte</h3>
                <p className="muted">Draft-Disziwerte aus offizieller Gewichtungsmatrix plus bester Playbook-Slot aus den Slotrollen.</p>
              </div>
              <div className="foundation-player-generator-discipline-grid">
                {(topDisciplineOutlook.length ? topDisciplineOutlook : disciplineRows.map((row) => ({
                  disciplineId: row.id,
                  disciplineName: row.name,
                  rating: row.value ?? 0,
                  bestSlotLabel: null,
                  bestSlotScore: null,
                  keyAttributes: [],
                }))).map((row) => (
                  <article key={row.disciplineId} className={`metric-card${topDisciplineIds.has(row.disciplineId) ? " is-highlighted" : ""}`}>
                    <span>{row.disciplineName}</span>
                    <strong>{formatValue(row.rating, 0)}</strong>
                    <small className="muted">
                      {row.bestSlotLabel ?? "Slot offen"} · Slot {formatValue(row.bestSlotScore, 0)}
                    </small>
                    <small className="muted">
                      {row.keyAttributes.map((attribute) => attributeLabelMap[attribute]).join(" / ") || "—"}
                    </small>
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
                    Löschen
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
