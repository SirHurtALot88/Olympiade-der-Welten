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
  PlayerGeneratorSilhouette,
  PlayerGeneratorStrengthTier,
} from "@/lib/data/olyDataTypes";
import {
  buildPlayerGeneratorCatalog,
  createDefaultPlayerGeneratorInput,
  generatePlayerDraft,
  type PlayerGeneratorCommitHandler,
  type PlayerGeneratorTeamContext,
  recalculatePlayerGeneratorDraft,
  tightenPlayerGeneratorDraft,
} from "@/lib/player-generator/player-generator-service";
import {
  NlAbilityStars,
} from "@/components/foundation/velo-ui/NlAbilityStars";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlEmptyState,
  NlProgressBar,
  NlRadar,
  NlSubTabs,
  StatChip,
  StatChipRow,
  nlToneClass,
  type NlRadarAxis,
  type NlTone,
} from "@/components/foundation/new-look";

/**
 * "Neuer Look" Player Generator — flag-gated, additiv (Phase 3 der
 * Generator-Überarbeitung). Konsumiert exakt dieselben Props wie
 * `PlayerGeneratorPanel` (siehe dortiges Gate). Baut das Formular als
 * Kontroll-/Vorschau-Layout statt eines Formular-Walls: links kompakte
 * Chip-/Segment-Regler + Attribut-Editor, rechts eine lebendige
 * Radar-/Stat-Vorschau, Batch-Vergleich und eine eingeklappte
 * Diagnose-Schublade.
 *
 * Alle Service-Aufrufe (`generatePlayerDraft`, `recalculatePlayerGeneratorDraft`,
 * `tightenPlayerGeneratorDraft`) sind unverändert aus Phase 1 — hier ändert
 * sich nur die Darstellung, keine Generator-Logik.
 */

const roleOptions: Array<{ value: PlayerGeneratorRoleIntent; label: string }> = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "support", label: "Support" },
  { value: "allround", label: "Allround" },
  { value: "specialist", label: "Specialist" },
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
  { value: "value", label: "Value" },
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

const silhouetteOptions: Array<{ value: PlayerGeneratorSilhouette; label: string; hint: string }> = [
  { value: "allrounder", label: "Allrounder", hint: "rund — alle Achsen ähnlich" },
  { value: "duo", label: "Duo", hint: "zwei Achsen hoch, zwei tief" },
  { value: "specialist", label: "Spezialist", hint: "eine Achse dominant" },
  { value: "rohdiamant", label: "Rohdiamant", hint: "eine Elite-Achse, sonst roh" },
];

const axisChipOptions: Array<{ value: string; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

const attributeLabels: Array<{ key: PlayerGeneratorAttributeName; label: string }> = [
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

const attributeLabelMap = Object.fromEntries(attributeLabels.map((entry) => [entry.key, entry.label])) as Record<
  PlayerGeneratorAttributeName,
  string
>;

const AXES = ["pow", "spe", "men", "soc"] as const;
type AxisKey = (typeof AXES)[number];

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
  if (status === "ready_for_review") return "Review-ready";
  if (status === "blocked_archetype_conflict") return "Archetyp gebrochen";
  if (status === "blocked_missing_engine") return "Engine fehlt";
  return "Needs edit";
}

function validationTone(status: PlayerGeneratorDraft["validationStatus"]): NlTone {
  if (status === "ready_for_review") return "good";
  if (status === "blocked_archetype_conflict") return "risk";
  return "warn";
}

function formatMatchState(state: PlayerGeneratorMatchState) {
  if (state === "ok") return "ok";
  if (state === "failed") return "failed";
  return "warning";
}

function matchStateTone(state: PlayerGeneratorMatchState): NlTone {
  if (state === "ok") return "good";
  if (state === "failed") return "risk";
  return "warn";
}

function formatAxisSource(source: PlayerGeneratorAxisSource) {
  if (source === "user") return "user";
  if (source === "auto-role") return "auto-role";
  if (source === "auto-archetype") return "auto-archetype";
  return "blended";
}

function formatGeneratorValueStatus(
  status: PlayerGeneratorDraft["generated"]["marketValueStatus"] | PlayerGeneratorDraft["generated"]["salaryStatus"],
) {
  if (status === "ready") return "ready";
  if (status === "heuristic_estimate") return "heuristische Schätzung";
  if (status === "missing_market_value_input") return "wartet auf marketValueNew";
  if (status === "missing_salary_engine") return "blocked";
  return "blocked";
}

function formatGeneratorWarning(warning: string) {
  return warning.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function engineStatusTone(status: string): NlTone {
  if (status === "ready") return "good";
  if (status === "heuristic") return "accent";
  return "warn";
}

function formatGeneratorEngineStatusLabel(
  key: keyof PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"],
  status: PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"][keyof PlayerGeneratorDraft["generated"]["diagnostics"]["engineStatus"]],
) {
  if (key === "marketValueEngine") {
    if (status === "ready") return "MW-Engine bereit";
    if (status === "heuristic") return "MW ist eine heuristische Schätzung, keine Engine-verifizierte Ranked-MW.";
    if (status === "incomplete_source") return "MW-Engine blockiert: Rank→MW-Tabelle ist noch unvollständig.";
    return "MW-Engine blockiert: Quelle fehlt noch.";
  }
  if (key === "salaryEngine") {
    if (status === "ready") return "Gehalt kann berechnet werden.";
    if (status === "missing_market_value_input") return "Gehalt vorbereitet, wartet auf echten Marktwert.";
    return "Gehalt blockiert: Formelquellen fehlen noch.";
  }
  if (key === "classEngine") {
    if (status === "ready") return "Class Engine nutzt echte Faktoren.";
    if (status === "heuristic") return "Class Engine läuft heuristisch.";
    return "Class Engine blockiert.";
  }
  if (status === "ready") return "Potential nutzt das echte CA/PO-Sternemodell.";
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
    case "draft_validation_blocked":
      return "Draft hat einen harten Validierungs-Block (Archetyp-Konflikt oder fehlende Engine).";
    case "commit_path_not_ready":
      return "Der sichere Free-Agent-Commit-Pfad ist in diesem Block bewusst deaktiviert.";
    default:
      return reason;
  }
}

/**
 * Presentational-only Kohärenz-Schätzung fürs Badge. `PlayerGeneratorDraft`
 * trägt den internen `qualityScore` aus `selectBestCandidate` NICHT nach
 * außen (siehe player-generator-service.ts) — dieses Badge rekonstruiert
 * daher eine Näherung aus den öffentlichen Diagnose-Feldern, die der Draft
 * tatsächlich mitbringt. Kein Ersatz für den echten Service-Score, nur ein
 * schneller visueller Anhaltspunkt.
 */
function estimateDraftCoherence(draft: PlayerGeneratorDraft): number {
  const { generated, warnings, validationStatus } = draft;
  let score = 100;
  score -= warnings.length * 4;
  score -= generated.diagnostics.qualityWarnings.length * 2;
  if (validationStatus === "blocked_archetype_conflict") score -= 40;
  else if (validationStatus === "needs_edit") score -= 18;
  if (generated.diagnostics.archetypeMatch === "failed") score -= 15;
  else if (generated.diagnostics.archetypeMatch === "warning") score -= 6;
  if (generated.diagnostics.roleMatch === "failed") score -= 15;
  else if (generated.diagnostics.roleMatch === "warning") score -= 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function coherenceTone(score: number): NlTone {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "risk";
}

function ChipGroup({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="nl-gen-chip-group" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`nl-gen-chip${option.value === value ? " is-active" : ""}`}
          aria-pressed={option.value === value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function PlayerGeneratorPanelNewLook({
  players,
  disciplines,
  drafts,
  teamContexts,
  activeTeamId,
  readOnly,
  readSourceLabel,
  onSaveDrafts,
  onCommitDraft,
}: {
  players: Player[];
  disciplines: Discipline[];
  drafts: PlayerGeneratorDraft[];
  teamContexts: PlayerGeneratorTeamContext[];
  activeTeamId: string | null;
  readOnly: boolean;
  readSourceLabel: string;
  onSaveDrafts: (nextDrafts: PlayerGeneratorDraft[]) => void;
  onCommitDraft?: PlayerGeneratorCommitHandler;
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
  const [committingDraftId, setCommittingDraftId] = useState<string | null>(null);
  const [seedLocked, setSeedLocked] = useState(false);
  const [previewTab, setPreviewTab] = useState<"overview" | "edit" | "batch">("overview");
  const [batchCandidates, setBatchCandidates] = useState<PlayerGeneratorDraft[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

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
    () => (form.targetTeamId ? teamContexts.find((entry) => entry.team?.teamId === form.targetTeamId) ?? null : null),
    [form.targetTeamId, teamContexts],
  );
  const teamOptions = useMemo(
    () =>
      teamContexts
        .filter((entry): entry is PlayerGeneratorTeamContext & { team: NonNullable<PlayerGeneratorTeamContext["team"]> } => Boolean(entry.team))
        .sort((left, right) => left.team.name.localeCompare(right.team.name, "de")),
    [teamContexts],
  );
  const teamContextById = useMemo(() => new Map(teamOptions.map((entry) => [entry.team.teamId, entry] as const)), [teamOptions]);

  useEffect(() => {
    if (!activeTeamId) {
      return;
    }
    setForm((current) => (current.targetTeamId ? current : { ...current, targetTeamId: activeTeamId }));
  }, [activeTeamId]);

  function updateForm<K extends keyof PlayerGeneratorInput>(key: K, value: PlayerGeneratorInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  /**
   * "Live"-Regler: Rolle/Stärke/Varianz/Archetyp/Vertragsmodus/Zielteam/Achsen
   * sind diskrete Klicks (Chips, kein Freitext), also regeneriert jeder Klick
   * sofort den AKTIVEN Draft mit demselben Seed (deterministisch reproduzierbar,
   * siehe `generatePlayerDraft`/`selectBestCandidate`) — die Vorschau bewegt
   * sich live mit, ohne einen komplett neuen Seed/Draft zu ziehen. Freitext-Felder
   * (Name/Hints/Seed) bleiben bewusst reines `updateForm` ohne Live-Regenerierung,
   * sonst würde jeder Tastendruck einen vollen Kandidaten-Rebuild auslösen.
   */
  function updateFormLive<K extends keyof PlayerGeneratorInput>(key: K, value: PlayerGeneratorInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCurrentDraft((current) => {
      if (!current) {
        return current;
      }
      const nextInput = { ...current.input, [key]: value };
      const targetTeamId = key === "targetTeamId" ? (value as string | null) : nextInput.targetTeamId ?? activeTeamId;
      const nextContext = targetTeamId ? teamContextById.get(targetTeamId) ?? activeTeamContext : activeTeamContext;
      const nextDraft = generatePlayerDraft({
        generatorInput: nextInput,
        players,
        disciplines,
        teamContext: nextContext,
        draftId: current.draftId,
        createdAt: current.createdAt,
      });
      setPortraitDraftUrl(nextDraft.generated.portraitUrl ?? "");
      return nextDraft;
    });
    setMessage(null);
  }

  function updateAxisLive(axis: AxisKey, value: PlayerGeneratorAxisIntentValue) {
    setForm((current) => ({ ...current, axisIntent: { ...current.axisIntent, [axis]: value } }));
    setCurrentDraft((current) => {
      if (!current) {
        return current;
      }
      const nextInput = { ...current.input, axisIntent: { ...current.input.axisIntent, [axis]: value } };
      const targetTeamId = nextInput.targetTeamId ?? activeTeamId;
      const nextContext = targetTeamId ? teamContextById.get(targetTeamId) ?? activeTeamContext : activeTeamContext;
      const nextDraft = generatePlayerDraft({
        generatorInput: nextInput,
        players,
        disciplines,
        teamContext: nextContext,
        draftId: current.draftId,
        createdAt: current.createdAt,
      });
      setPortraitDraftUrl(nextDraft.generated.portraitUrl ?? "");
      return nextDraft;
    });
    setMessage(null);
  }

  function activateDraft(draft: PlayerGeneratorDraft, opts: { savedId?: string | null; message?: string | null } = {}) {
    setCurrentDraft(draft);
    setSelectedDraftId(opts.savedId ?? null);
    setPortraitDraftUrl(draft.generated.portraitUrl ?? "");
    setForm(draft.input);
    setMessage(opts.message ?? null);
  }

  function runGenerate(nextSeed?: string) {
    const draft = generatePlayerDraft({
      generatorInput: { ...form, seed: nextSeed ?? form.seed ?? buildSeed() },
      players,
      disciplines,
      teamContext: activeTeamContext,
    });
    activateDraft(draft, { message: "Neuer Player-Draft wurde lokal erzeugt." });
    setBatchCandidates([]);
  }

  function rerollDraft() {
    const nextSeed = seedLocked ? form.seed?.trim() || buildSeed() : buildSeed();
    runGenerate(nextSeed);
  }

  function sharpenDraft() {
    if (!currentDraft) {
      return;
    }
    const nextDraft = tightenPlayerGeneratorDraft({ draft: currentDraft, players, disciplines, teamContext: activeTeamContext });
    setCurrentDraft(nextDraft);
    setForm(nextDraft.input);
    setMessage("Profil wurde auf demselben Seed nachgeschaerft.");
  }

  function loadDraft(draft: PlayerGeneratorDraft) {
    activateDraft(draft, { savedId: draft.draftId, message: `Draft ${draft.generated.name} geladen.` });
  }

  function loadBatchCandidate(candidate: PlayerGeneratorDraft) {
    activateDraft(candidate, { message: `Batch-Kandidat ${candidate.generated.name} in den Editor geladen.` });
    setPreviewTab("overview");
  }

  function runBatch(count: number) {
    setBatchBusy(true);
    try {
      const baseSeed = form.seed?.trim() || buildSeed();
      const results: PlayerGeneratorDraft[] = [];
      for (let index = 0; index < count; index += 1) {
        results.push(
          generatePlayerDraft({
            generatorInput: { ...form, seed: `${baseSeed}::batch-${index}` },
            players,
            disciplines,
            teamContext: activeTeamContext,
          }),
        );
      }
      setBatchCandidates(results);
      setMessage(`${count} Batch-Kandidaten erzeugt.`);
    } finally {
      setBatchBusy(false);
    }
  }

  function saveDraft() {
    if (!currentDraft) {
      return;
    }
    if (readOnly) {
      setMessage("Prisma / Referenzmodus bleibt read-only. Drafts können nur lokal gespeichert werden.");
      return;
    }

    const nextDraft = { ...currentDraft, updatedAt: new Date().toISOString() };
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
    // T-040: Draft-Löschen war zuvor ohne Bestätigung sofort wirksam —
    // inkonsistent zur Save-Löschung (siehe FoundationTeamSettingsNewLook.tsx
    // `deleteSaves`). Gleiches window.confirm-Pattern für Konsistenz.
    if (!window.confirm("Draft wirklich löschen? Das kann nicht rückgängig gemacht werden.")) {
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

  /**
   * "Als Free Agent übernehmen" — Phase 2. Delegates the actual write to
   * `onCommitDraft` (POST /api/player-generator/commit → `commitDraftAsFreeAgent`,
   * see `use-foundation-shell-router-body-scope.tsx`'s `commitPlayerGeneratorDraft`),
   * which reloads the save on success so the new free agent shows up
   * everywhere (Transfermarkt, player directory, ...) without a page reload.
   * The draft itself is left in the saved-drafts list on success (see the
   * doc comment on `commitPlayerGeneratorDraft`).
   */
  async function commitCurrentDraft() {
    if (!currentDraft || !onCommitDraft) {
      return;
    }
    if (readOnly) {
      setMessage("Prisma / Referenzmodus bleibt read-only. Free-Agent-Commit ist hier nicht möglich.");
      return;
    }
    if (currentDraft.generated.diagnostics.saveStatus.commitReasons.length > 0) {
      setMessage("Draft hat noch offene Blocker — siehe Diagnose-Schublade.");
      return;
    }

    setCommittingDraftId(currentDraft.draftId);
    setMessage(null);
    try {
      const result = await onCommitDraft(currentDraft);
      if (result.success) {
        setMessage(`${result.playerName ?? currentDraft.generated.name} wurde als Free Agent übernommen (ID ${result.playerId ?? "?"}).`);
      } else {
        setMessage(`Free-Agent-Commit fehlgeschlagen: ${result.error ?? "unbekannter Fehler"}.`);
      }
    } finally {
      setCommittingDraftId(null);
    }
  }

  function updateDraft(updater: (draft: PlayerGeneratorDraft) => PlayerGeneratorDraft, recalc = false) {
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
    updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, portraitUrl: url } }));
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
      normalizePortraitUrl(event.dataTransfer.getData("text/uri-list")) ?? normalizePortraitUrl(event.dataTransfer.getData("text/plain"));
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

  const topDisciplineOutlook = useMemo(() => currentDraft?.generated.disciplineOutlook?.slice(0, 6) ?? [], [currentDraft]);
  const economyProjection = currentDraft?.generated.economyProjection ?? null;
  const teamFit = currentDraft?.generated.teamFit ?? null;
  const coherence = currentDraft ? estimateDraftCoherence(currentDraft) : null;

  const commitBlockers = currentDraft?.generated.diagnostics.saveStatus.commitReasons ?? [];
  const isCommitting = Boolean(currentDraft) && committingDraftId === currentDraft?.draftId;
  const commitDisabled = !currentDraft || readOnly || !onCommitDraft || commitBlockers.length > 0 || isCommitting;
  const commitDisabledTitle = !currentDraft
    ? "Erst einen Draft erzeugen."
    : readOnly
      ? "Prisma / Referenzmodus bleibt read-only."
      : commitBlockers.length > 0
        ? commitBlockers.map(formatSaveCommitReason).join(" ")
        : isCommitting
          ? "Commit läuft…"
          : "Draft als neuen Free Agent in den Spielstand übernehmen.";

  const radarAxes: NlRadarAxis[] = currentDraft
    ? AXES.map((key) => ({ key, value: currentDraft.generated.axes[key] }))
    : [];
  const radarGhostAxes: NlRadarAxis[] | undefined = currentDraft?.generated.diagnostics.axisTargets
    ? AXES.map((key) => ({ key, value: currentDraft.generated.diagnostics.axisTargets![key] }))
    : undefined;

  return (
    <div className="nl-gen" data-testid="foundation-generator-v2" data-new-look="true">
      <NlCard
        className="nl-gen-header-card"
        eyebrow="Player Generator"
        title={currentDraft ? currentDraft.generated.name : "Neuer Spieler-Draft"}
        actions={
          <div className="nl-gen-header-actions">
            {coherence != null ? (
              <span
                className={`nl-gen-quality-badge ${nlToneClass(coherenceTone(coherence))}`}
                title="Grobe Kohärenz-Schätzung aus Warnungen, Archetyp-/Rollen-Match und Validierungsstatus (UI-Näherung, kein Service-Wert)."
              >
                Kohärenz {coherence}
              </span>
            ) : null}
            <span className="nl-gen-pill">Drafts {drafts.length}</span>
            <span className={`nl-gen-pill${readOnly ? " is-warn" : ""}`}>{readSourceLabel}</span>
          </div>
        }
      >
        <p className="nl-gen-header-meta">
          {activeTeamContext?.team?.name ?? "Kein Zielteam"} ·{" "}
          {roleOptions.find((option) => option.value === form.roleIntent)?.label ?? form.roleIntent} · {form.strengthTier} ·{" "}
          {form.randomness} Varianz
        </p>
      </NlCard>

      <div className="nl-gen-actions-bar">
        <button type="button" className="nl-gen-primary-action" onClick={() => runGenerate()}>
          Draft generieren
        </button>
        <button type="button" className="nl-gen-secondary-action" onClick={rerollDraft}>
          {seedLocked ? "Neu würfeln (fix)" : "Neu würfeln"}
        </button>
        <button type="button" className="nl-gen-secondary-action" onClick={sharpenDraft} disabled={!currentDraft}>
          Profil nachschärfen
        </button>
        <button type="button" className="nl-gen-primary-action" onClick={saveDraft} disabled={!currentDraft || readOnly}>
          Draft speichern
        </button>
        <button
          type="button"
          className="nl-gen-primary-action"
          onClick={commitCurrentDraft}
          disabled={commitDisabled}
          title={commitDisabledTitle}
        >
          {isCommitting ? "Übernahme läuft…" : "Als Free Agent übernehmen"}
        </button>
        {message ? <span className="nl-gen-message">{message}</span> : null}
      </div>

      <div className="nl-gen-layout">
        <div className="nl-gen-controls">
          <NlCard className="nl-gen-card" eyebrow="Build" title="Rolle & Stärke">
            <div className="nl-gen-field">
              <span>Rolle / Stat-Profil</span>
              <ChipGroup
                options={roleOptions.map((option) => ({ value: option.value, label: option.label }))}
                value={form.roleIntent}
                onSelect={(value) => updateFormLive("roleIntent", value as PlayerGeneratorRoleIntent)}
                ariaLabel="Rolle / Stat-Profil"
              />
            </div>
            <div className="nl-gen-field">
              <span>Stärke-Level</span>
              <ChipGroup
                options={strengthOptions.map((option) => ({ value: option.value, label: option.label }))}
                value={form.strengthTier}
                onSelect={(value) => updateFormLive("strengthTier", value as PlayerGeneratorStrengthTier)}
                ariaLabel="Stärke-Level"
              />
            </div>
            <div className="nl-gen-field">
              <span>Varianz</span>
              <ChipGroup
                options={randomnessOptions.map((option) => ({ value: option.value, label: option.label }))}
                value={form.randomness}
                onSelect={(value) => updateFormLive("randomness", value as PlayerGeneratorRandomness)}
                ariaLabel="Varianz"
              />
            </div>
            <div className="nl-gen-field">
              <span>Vertragsarchitektur</span>
              <ChipGroup
                options={contractModeOptions.map((option) => ({ value: option.value, label: option.label }))}
                value={form.contractMode ?? "balanced"}
                onSelect={(value) => updateFormLive("contractMode", value as NonNullable<PlayerGeneratorInput["contractMode"]>)}
                ariaLabel="Vertragsarchitektur"
              />
            </div>
          </NlCard>

          <NlCard className="nl-gen-card" eyebrow="Build" title="Fantasy-Archetyp">
            <div className="nl-gen-chip-group" role="group" aria-label="Fantasy-Archetyp / Wesen">
              <button
                type="button"
                className={`nl-gen-chip${!form.preferredArchetype ? " is-active" : ""}`}
                aria-pressed={!form.preferredArchetype}
                onClick={() => updateFormLive("preferredArchetype", null)}
              >
                Kein Bias
              </button>
              {archetypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`nl-gen-chip${form.preferredArchetype === option.value ? " is-active" : ""}`}
                  aria-pressed={form.preferredArchetype === option.value}
                  onClick={() => updateFormLive("preferredArchetype", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </NlCard>

          <NlCard className="nl-gen-card" eyebrow="Build" title="Silhouette">
            <div className="nl-gen-chip-group" role="group" aria-label="Achsen-Silhouette (Verteilungsform)">
              <button
                type="button"
                className={`nl-gen-chip${!form.silhouette ? " is-active" : ""}`}
                aria-pressed={!form.silhouette}
                onClick={() => updateFormLive("silhouette", null)}
                title="Keine Form-Vorgabe — Achsen wie bisher"
              >
                Frei
              </button>
              {silhouetteOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`nl-gen-chip${form.silhouette === option.value ? " is-active" : ""}`}
                  aria-pressed={form.silhouette === option.value}
                  onClick={() => updateFormLive("silhouette", option.value)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="nl-gen-muted">
              {form.silhouette
                ? silhouetteOptions.find((option) => option.value === form.silhouette)?.hint
                : "Formt die Achsen-Verteilung bei gleicher Current Ability — welche Achse dominiert, bestimmt Rolle/Archetyp."}
            </p>
          </NlCard>

          <NlCard className="nl-gen-card" eyebrow="Build" title="Achsen-Bias">
            {AXES.map((axis) => (
              <div key={axis} className="nl-gen-axis-chip-row">
                <span className={`nl-gen-axis-chip-label ${nlToneClass(axis)}`}>{axis.toUpperCase()}</span>
                <ChipGroup
                  options={axisChipOptions}
                  value={String(form.axisIntent[axis] ?? "auto")}
                  onSelect={(value) => updateAxisLive(axis, value === "auto" ? "auto" : (Number(value) as PlayerGeneratorAxisIntentValue))}
                  ariaLabel={`${axis.toUpperCase()} Achsen-Bias`}
                />
              </div>
            ))}
          </NlCard>

          <NlCard className="nl-gen-card" eyebrow="Kontext" title="Zielteam & Identität">
            <label className="nl-gen-field">
              <span>Zielteam / Fit-Kontext</span>
              <select
                className="nl-gen-select"
                value={form.targetTeamId ?? ""}
                onChange={(event) => updateFormLive("targetTeamId", event.target.value || null)}
              >
                <option value="">Kein Zielteam</option>
                {teamOptions.map((entry) => (
                  <option key={entry.team.teamId} value={entry.team.teamId}>
                    {entry.team.shortCode} · {entry.team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="nl-gen-field">
              <span>Name optional</span>
              <input
                className="nl-gen-input"
                type="text"
                value={form.name ?? ""}
                placeholder="Wird sonst automatisch erzeugt"
                onChange={(event) => updateForm("name", event.target.value || null)}
              />
            </label>
            <label className="nl-gen-field">
              <span>Race Hint</span>
              <input
                className="nl-gen-input"
                type="text"
                value={form.raceHint ?? ""}
                list="pg2-races"
                onChange={(event) => updateForm("raceHint", event.target.value || null)}
              />
            </label>
            <label className="nl-gen-field">
              <span>Class Hint</span>
              <input
                className="nl-gen-input"
                type="text"
                value={form.classHint ?? ""}
                list="pg2-classes"
                onChange={(event) => updateForm("classHint", event.target.value || null)}
              />
            </label>
            <label className="nl-gen-field">
              <span>Trait Hint</span>
              <input
                className="nl-gen-input"
                type="text"
                value={form.traitHint ?? ""}
                list="pg2-positive-traits"
                onChange={(event) => updateForm("traitHint", event.target.value || null)}
              />
            </label>
            <small className="nl-gen-muted">
              Hints wirken beim nächsten „Draft generieren“/„Neu würfeln“ — keine Live-Regenerierung bei jedem Tastendruck.
            </small>
          </NlCard>

          <NlCard className="nl-gen-card" eyebrow="Reproduzierbarkeit" title="Seed">
            <div className="nl-gen-seed-row">
              <input
                className="nl-gen-input"
                type="text"
                value={form.seed ?? ""}
                onChange={(event) => updateForm("seed", event.target.value || buildSeed())}
              />
              <button
                type="button"
                className={`nl-gen-icon-btn${seedLocked ? " is-active" : ""}`}
                aria-pressed={seedLocked}
                title={seedLocked ? "Seed entsperren — Neu würfeln zieht wieder einen frischen Zufalls-Seed." : "Seed fixieren — Neu würfeln bleibt dann deterministisch."}
                onClick={() => setSeedLocked((value) => !value)}
              >
                {seedLocked ? "🔒" : "🔓"}
              </button>
              <button
                type="button"
                className="nl-gen-icon-btn"
                title="Neuen Zufalls-Seed einsetzen"
                disabled={seedLocked}
                onClick={() => updateForm("seed", buildSeed())}
              >
                🎲
              </button>
              <button type="button" className="nl-gen-icon-btn" title="Seed kopieren" disabled={!currentDraft?.input.seed} onClick={() => void copySeed()}>
                ⧉
              </button>
            </div>
            <small className="nl-gen-muted">
              {seedLocked
                ? "Fixiert — „Neu würfeln“ nutzt denselben Seed (reproduzierbar)."
                : "Frei — „Neu würfeln“ zieht bei jedem Klick einen neuen Zufalls-Seed."}
            </small>
          </NlCard>
        </div>

        <div className="nl-gen-preview">
          {currentDraft ? (
            <>
              <NlCard className="nl-gen-hero-card">
                <div className="nl-gen-hero">
                  <div
                    className={`nl-gen-portrait-drop${portraitDragActive ? " is-dragging" : ""}${currentDraft.generated.portraitUrl ? " has-image" : ""}`}
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
                      <div className="nl-gen-portrait-fallback">{buildInitials(currentDraft.generated.name)}</div>
                    )}
                    <div className="nl-gen-portrait-copy">
                      <strong>{currentDraft.generated.portraitUrl ? "Portrait verknuepft" : "Bild hier reinziehen"}</strong>
                      <span>Bilddatei, Bild-URL oder lokaler Pfad</span>
                    </div>
                  </div>
                  <div className="nl-gen-hero-copy">
                    <span className={`nl-gen-status-pill ${nlToneClass(validationTone(currentDraft.validationStatus))}`}>
                      {formatValidationStatus(currentDraft.validationStatus)}
                    </span>
                    <h3>{currentDraft.generated.name}</h3>
                    <p className="nl-gen-muted">
                      {currentDraft.generated.className} · {currentDraft.generated.race} · {currentDraft.generated.projectedRole ?? "draft"}
                    </p>
                    <div className="nl-gen-portrait-controls">
                      <input
                        className="nl-gen-input"
                        type="text"
                        value={portraitDraftUrl}
                        placeholder="Portrait-URL oder /media/pfad einfügen"
                        onChange={(event) => setPortraitDraftUrl(event.target.value)}
                      />
                      <button type="button" className="nl-gen-inline-action" onClick={applyPortraitUrl}>
                        Link setzen
                      </button>
                      <label className="nl-gen-inline-action nl-gen-file-btn">
                        Datei
                        <input accept="image/*" type="file" onChange={handlePortraitFileChange} />
                      </label>
                      <button
                        type="button"
                        className="nl-gen-inline-action"
                        onClick={() => updatePortrait(null)}
                        disabled={!currentDraft.generated.portraitUrl}
                      >
                        Entfernen
                      </button>
                    </div>
                    <div className="nl-gen-hero-meta">
                      <span>Ziel {teamFit?.teamName ?? activeTeamContext?.team?.name ?? "Kein Zielteam"}</span>
                      <span>GM {activeTeamContext?.generalManager?.title ?? "—"}</span>
                      <span>Seed {currentDraft.input.seed ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </NlCard>

              <StatChipRow className="nl-gen-stats" aria-label="Draft-Kennzahlen">
                <StatChip label="CA" value={formatValue(currentDraft.generated.ovr, 0)} tone="accent" sub="Draft-Vorschau" />
                <StatChip label="PPs" value={formatValue(currentDraft.generated.pps, 1)} tone="spe" sub="Draft-Vorschau" />
                <StatChip
                  label="MW"
                  value={formatMoneyValue(economyProjection?.marketValueEstimate ?? currentDraft.generated.marketValue)}
                  tone="soc"
                  sub={formatGeneratorValueStatus(currentDraft.generated.marketValueStatus)}
                />
                <StatChip
                  label="Gehalt"
                  value={formatMoneyValue(economyProjection?.salaryEstimate ?? currentDraft.generated.salary)}
                  tone="warn"
                  sub={formatGeneratorValueStatus(currentDraft.generated.salaryStatus)}
                />
                <StatChip
                  label="Teamfit"
                  value={formatValue(teamFit?.score, 0)}
                  tone="good"
                  sub={teamFit?.teamName ?? "Kein Zielteam"}
                />
                <StatChip label="Captain" value={formatValue(currentDraft.generated.captaincyScore, 0)} tone="men" />
              </StatChipRow>

              <NlSubTabs
                className="nl-gen-subtabs"
                aria-label="Generator-Bereiche"
                activeId={previewTab}
                onSelect={(id) => setPreviewTab(id as "overview" | "edit" | "batch")}
                items={[
                  { id: "overview", label: "Vorschau" },
                  { id: "edit", label: "Bearbeiten" },
                  { id: "batch", label: "Batch", count: batchCandidates.length || undefined },
                ]}
              />

              {previewTab === "overview" ? (
                <>
                  <NlCard className="nl-gen-card" eyebrow="Achsen" title="POW / SPE / MEN / SOC">
                    <div className="nl-gen-radar-row">
                      <NlRadar
                        axes={radarAxes}
                        ghostAxes={radarGhostAxes}
                        ghostLabel="Ziel-Achsen"
                        max={100}
                        showValues
                        aria-label="Draft-Achsen POW/SPE/MEN/SOC gegen Ziel-Achsen"
                      />
                      <NlAbilityStars
                        caScore={currentDraft.generated.ovr}
                        poScore={currentDraft.generated.potential}
                        known
                        label="Draft"
                      />
                    </div>
                    <div className="nl-gen-axis-source-row">
                      {AXES.map((axis) => (
                        <span key={axis} className={`nl-gen-axis-source-pill ${nlToneClass(axis)}`}>
                          {axis.toUpperCase()} {formatValue(currentDraft.generated.diagnostics.resolvedAxisIntent[axis], 0)} ·{" "}
                          {formatAxisSource(currentDraft.generated.diagnostics.axisIntentSources[axis])}
                        </span>
                      ))}
                    </div>
                  </NlCard>

                  <NlCard className="nl-gen-card" eyebrow="Disziplinen" title="Diszi-Ausblick (Top 6)">
                    {topDisciplineOutlook.length > 0 ? (
                      <NlBarChart
                        bars={topDisciplineOutlook.map((entry) => ({ label: entry.disciplineName, value: entry.rating, tone: "accent" }))}
                        max={100}
                        format={(value) => formatValue(value, 0)}
                        aria-label="Diszi-Ausblick Top 6"
                      />
                    ) : (
                      <NlEmptyState title="Noch kein Diszi-Ausblick" message="Erzeuge einen Draft, um den Slot-/Diszi-Ausblick zu sehen." tone="neutral" />
                    )}
                  </NlCard>

                  <NlCard className="nl-gen-card" eyebrow="Kontext" title="Teamfit & Vertrag">
                    <div className="nl-gen-mini-metrics">
                      <span>Achse {formatValue(teamFit?.axisFit, 0)}</span>
                      <span>GM {formatValue(teamFit?.gmFit, 0)}</span>
                      <span>Traits {formatValue(teamFit?.traitFit, 0)}</span>
                      <span>Kader {teamFit?.rosterNeed ?? "unknown"}</span>
                    </div>
                    <ul className="nl-gen-list">
                      {(teamFit?.reasons ?? ["Kein Teamkontext aktiv."]).slice(0, 3).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <div className="nl-gen-mini-metrics">
                      <span>{economyProjection?.contractMode ?? "balanced"}</span>
                      <span>LZ {economyProjection?.recommendedContractLength ?? "—"}</span>
                      <span>Ratio {formatValue(economyProjection?.valueRatio, 2)}</span>
                      <span>Druck {economyProjection?.salaryPressure ?? "unknown"}</span>
                    </div>
                    {economyProjection?.salarySchedule.length ? (
                      <div className="nl-gen-schedule-row">
                        {economyProjection.salarySchedule.map((entry) => (
                          <span key={entry.yearIndex}>
                            {entry.label}: {formatMoneyValue(entry.salary)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="nl-gen-muted">Noch keine Gehaltsstaffel berechenbar.</p>
                    )}
                  </NlCard>

                  <details className="nl-gen-diagnostics">
                    <summary>
                      Diagnose &amp; Engine-Status
                      {currentDraft.generated.diagnostics.qualityWarnings.length > 0
                        ? ` · ${currentDraft.generated.diagnostics.qualityWarnings.length} Warnungen`
                        : ""}
                    </summary>
                    <div className="nl-gen-diagnostics-body">
                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Engine-Status</span>
                        <div className="nl-gen-status-cards">
                          {(
                            [
                              ["marketValueEngine", "Marktwert"],
                              ["salaryEngine", "Gehalt"],
                              ["classEngine", "Class Engine"],
                              ["potentialEngine", "Potential"],
                            ] as const
                          ).map(([key, label]) => {
                            const status = currentDraft.generated.diagnostics.engineStatus[key];
                            return (
                              <article key={key} className={`nl-gen-status-card ${nlToneClass(engineStatusTone(status))}`}>
                                <span>{label}</span>
                                <strong>{formatGeneratorEngineStatusLabel(key, status)}</strong>
                              </article>
                            );
                          })}
                        </div>
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Match-Diagnose</span>
                        <div className="nl-gen-status-cards">
                          <article className={`nl-gen-status-card ${nlToneClass(matchStateTone(currentDraft.generated.diagnostics.archetypeMatch))}`}>
                            <span>Archetype Match</span>
                            <strong>{formatMatchState(currentDraft.generated.diagnostics.archetypeMatch)}</strong>
                          </article>
                          <article className={`nl-gen-status-card ${nlToneClass(matchStateTone(currentDraft.generated.diagnostics.roleMatch))}`}>
                            <span>Role Match</span>
                            <strong>{formatMatchState(currentDraft.generated.diagnostics.roleMatch)}</strong>
                          </article>
                          <article className={`nl-gen-status-card ${nlToneClass(matchStateTone(currentDraft.generated.diagnostics.statSilhouette))}`}>
                            <span>Stat Silhouette</span>
                            <strong>{formatMatchState(currentDraft.generated.diagnostics.statSilhouette)}</strong>
                          </article>
                        </div>
                        <div className="nl-gen-mini-metrics">
                          <span>Spread {formatValue(currentDraft.generated.diagnostics.statSpread, 0)}</span>
                          <span>Flat-Cluster {formatValue(currentDraft.generated.diagnostics.flatAttributeCount, 0)}</span>
                          <span>
                            Peak {currentDraft.generated.diagnostics.peakAttributes.map((entry) => attributeLabelMap[entry]).join(", ") || "—"}
                          </span>
                          <span>
                            Weak {currentDraft.generated.diagnostics.weakAttributes.map((entry) => attributeLabelMap[entry]).join(", ") || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Achsen-Ziel vs. erreicht</span>
                        <div className="nl-gen-axis-target-rows">
                          {AXES.map((axis) => {
                            const target = currentDraft.generated.diagnostics.axisTargets?.[axis] ?? null;
                            const achieved = currentDraft.generated.axes[axis];
                            const delta = target != null ? achieved - target : null;
                            return (
                              <div key={axis} className="nl-gen-axis-target-row">
                                <span className={nlToneClass(axis)}>{axis.toUpperCase()}</span>
                                <span>Ziel {target != null ? formatValue(target, 1) : "—"}</span>
                                <span>Erreicht {formatValue(achieved, 1)}</span>
                                {delta != null ? <NlDeltaChip value={delta} format={(n) => formatValue(n, 1)} /> : <span className="nl-gen-muted">—</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Qualitätswarnungen</span>
                        {currentDraft.generated.diagnostics.qualityWarnings.length > 0 ? (
                          <ul className="nl-gen-list">
                            {currentDraft.generated.diagnostics.qualityWarnings.map((warning) => (
                              <li key={warning}>{formatQualityWarningLabel(warning)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="nl-gen-muted">Keine aktiven Profilwarnungen.</p>
                        )}
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Save-Status</span>
                        <div className="nl-gen-status-cards">
                          <article className={`nl-gen-status-card ${nlToneClass(readOnly ? "warn" : "good")}`}>
                            <span>Draft speichern</span>
                            <strong>{readOnly ? "Read-only in Prisma" : "Aktiv für lokalen Entwurf"}</strong>
                          </article>
                          <article className={`nl-gen-status-card ${nlToneClass(commitDisabled ? "warn" : "good")}`}>
                            <span>Free-Agent-Commit</span>
                            <strong>
                              {readOnly
                                ? "Deaktiviert (Read-only)"
                                : commitBlockers.length > 0
                                  ? "Blockiert"
                                  : "Aktiv"}
                            </strong>
                          </article>
                        </div>
                        <ul className="nl-gen-list">
                          {currentDraft.generated.diagnostics.saveStatus.commitReasons.map((reason) => (
                            <li key={reason}>{formatSaveCommitReason(reason)}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Klassenvorschlag</span>
                        <p>
                          {currentDraft.generated.classSuggestion.className} · Fit {formatValue(currentDraft.generated.classSuggestion.fitScore, 0)}
                          {currentDraft.generated.formulaStatus.classEngineStatus === "heuristic" ? " · heuristic" : ""}
                        </p>
                        {currentDraft.generated.classSuggestion.reasons.length ? (
                          <ul className="nl-gen-list">
                            {currentDraft.generated.classSuggestion.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="nl-gen-diag-block">
                        <span className="nl-gen-diag-title">Archetyp / Rolle</span>
                        <div className="nl-gen-summary-grid">
                          <div>
                            <span className="nl-gen-muted">Archetyp</span>
                            <ul className="nl-gen-list">
                              {currentDraft.generated.diagnostics.archetypeSummary.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="nl-gen-muted">Rolle</span>
                            <ul className="nl-gen-list">
                              {currentDraft.generated.diagnostics.roleSummary.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </>
              ) : null}

              {previewTab === "edit" ? (
                <>
                  <NlCard className="nl-gen-card" eyebrow="Identität" title="Bearbeiten">
                    <div className="nl-gen-identity-grid">
                      <label className="nl-gen-field">
                        <span>Name</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.name}
                          onChange={(event) =>
                            updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, name: event.target.value || "Unnamed Draft" } }))
                          }
                        />
                      </label>
                      <label className="nl-gen-field">
                        <span>Klasse</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.className}
                          list="pg2-classes"
                          onChange={(event) =>
                            updateDraft((draft) => ({
                              ...draft,
                              generated: { ...draft.generated, className: event.target.value || draft.generated.classSuggestion.className },
                            }))
                          }
                        />
                      </label>
                      <label className="nl-gen-field">
                        <span>Rasse</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.race}
                          list="pg2-races"
                          onChange={(event) =>
                            updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, race: event.target.value || "Human" } }))
                          }
                        />
                      </label>
                      <label className="nl-gen-field">
                        <span>Subclasses</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.subclasses.join(", ")}
                          list="pg2-subclasses"
                          onChange={(event) =>
                            updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, subclasses: splitCsv(event.target.value) } }))
                          }
                        />
                      </label>
                      <label className="nl-gen-field">
                        <span>Traits positiv</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.traitsPositive.join(", ")}
                          list="pg2-positive-traits"
                          onChange={(event) =>
                            updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, traitsPositive: splitCsv(event.target.value) } }))
                          }
                        />
                      </label>
                      <label className="nl-gen-field">
                        <span>Traits negativ</span>
                        <input
                          className="nl-gen-input"
                          type="text"
                          value={currentDraft.generated.traitsNegative.join(", ")}
                          list="pg2-negative-traits"
                          onChange={(event) =>
                            updateDraft((draft) => ({ ...draft, generated: { ...draft.generated, traitsNegative: splitCsv(event.target.value) } }))
                          }
                        />
                      </label>
                    </div>
                  </NlCard>

                  <NlCard className="nl-gen-card" eyebrow="Attribute" title="12 Werte (1–99)">
                    <p className="nl-gen-muted">Manuelle Attribut-Edits rechnen die abgeleiteten Werte (Diszis, CA, PPs, Potential, Economy, Teamfit) sofort neu.</p>
                    <div className="nl-gen-attr-grid">
                      {attributeLabels.map((attribute) => (
                        <label key={attribute.key} className="nl-gen-attr-field">
                          <span>{attribute.label}</span>
                          <input
                            className="nl-gen-input"
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
                        </label>
                      ))}
                    </div>
                  </NlCard>
                </>
              ) : null}

              {previewTab === "batch" ? (
                <NlCard
                  className="nl-gen-card"
                  eyebrow="Batch"
                  title="Mehrere Kandidaten vergleichen"
                  actions={
                    <div className="nl-gen-batch-actions">
                      <button type="button" className="nl-gen-secondary-action" disabled={batchBusy} onClick={() => runBatch(4)}>
                        4 Drafts
                      </button>
                      <button type="button" className="nl-gen-secondary-action" disabled={batchBusy} onClick={() => runBatch(6)}>
                        6 Drafts
                      </button>
                      <button type="button" className="nl-gen-secondary-action" disabled={batchBusy} onClick={() => runBatch(8)}>
                        8 Drafts
                      </button>
                    </div>
                  }
                >
                  <p className="nl-gen-muted">
                    Erzeugt mehrere unabhängige Kandidaten aus denselben Reglern (unterschiedliche Seed-Varianten des aktuellen Seeds) nebeneinander —
                    der aktive Editor-Draft bleibt unverändert, bis du einen davon lädst.
                  </p>
                  {batchBusy ? <p className="nl-gen-muted">Erzeuge Kandidaten…</p> : null}
                  {batchCandidates.length > 0 ? (
                    <div className="nl-gen-batch-grid">
                      {batchCandidates.map((candidate) => {
                        const score = estimateDraftCoherence(candidate);
                        return (
                          <article
                            key={candidate.draftId}
                            className={`nl-gen-batch-item${currentDraft.draftId === candidate.draftId ? " is-active" : ""}`}
                          >
                            <header>
                              <strong>{candidate.generated.name}</strong>
                              <span className={`nl-gen-quality-badge is-compact ${nlToneClass(coherenceTone(score))}`}>{score}</span>
                            </header>
                            <small className="nl-gen-muted">
                              {candidate.generated.className} · {candidate.generated.race}
                            </small>
                            <div className="nl-gen-batch-stats">
                              <span>CA {formatValue(candidate.generated.ovr, 0)}</span>
                              <span>PO {formatValue(candidate.generated.potential, 0)}</span>
                              <span>PPs {formatValue(candidate.generated.pps, 1)}</span>
                              <span>{formatGeneratorValueStatus(candidate.generated.marketValueStatus)}</span>
                            </div>
                            <button type="button" className="nl-gen-inline-action" onClick={() => loadBatchCandidate(candidate)}>
                              In Editor laden
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : !batchBusy ? (
                    <NlEmptyState
                      title="Noch keine Batch-Kandidaten"
                      message="Erzeuge mehrere Kandidaten, um Varianten desselben Profils zu vergleichen."
                      tone="neutral"
                    />
                  ) : null}
                </NlCard>
              ) : null}
            </>
          ) : (
            <NlEmptyState
              title="Noch kein Draft aktiv"
              message="Erzeuge zuerst einen Spielerentwurf oder lade einen gespeicherten Draft."
              tone="neutral"
              action={{ label: "Draft generieren", onClick: () => runGenerate() }}
            />
          )}
        </div>
      </div>

      <NlCard className="nl-gen-card nl-gen-saved-card" eyebrow="Lokal" title="Gespeicherte Drafts">
        {savedDrafts.length === 0 ? (
          <p className="nl-gen-muted">Noch keine Drafts im aktuellen lokalen Save gespeichert.</p>
        ) : (
          <div className="nl-gen-saved-grid">
            {savedDrafts.map((draft) => (
              <article key={draft.draftId} className={`nl-gen-saved-item${selectedDraftId === draft.draftId ? " is-active" : ""}`}>
                <strong>{draft.generated.name}</strong>
                <span className="nl-gen-muted">
                  {draft.generated.className} · {draft.generated.race}
                </span>
                <span className="nl-gen-muted">
                  Seed {draft.input.seed ?? "—"} · Update {new Date(draft.updatedAt ?? draft.createdAt).toLocaleString("de-DE")}
                </span>
                <div className="nl-gen-batch-actions">
                  <button type="button" className="nl-gen-inline-action" onClick={() => loadDraft(draft)}>
                    Laden
                  </button>
                  <button type="button" className="nl-gen-inline-action" disabled={readOnly} onClick={() => deleteDraft(draft.draftId)}>
                    Löschen
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </NlCard>

      <datalist id="pg2-races">
        {catalog.races.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="pg2-classes">
        {catalog.classes.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="pg2-subclasses">
        {catalog.subclasses.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="pg2-positive-traits">
        {catalog.positiveTraits.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
      <datalist id="pg2-negative-traits">
        {catalog.negativeTraits.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
    </div>
  );
}
