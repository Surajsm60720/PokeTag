"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { shortGameName } from "@/lib/game-dirs";
import { DialogBox } from "./DialogBox";
import { MenuList } from "./MenuList";
import { PixelPanel } from "./PixelPanel";
import { ThemeSync } from "./ThemeSync";

interface Preview {
  detection: {
    format: string;
    generation: number | null;
    gameVersion: string;
    recognized: boolean;
    label: string;
    notes: string[];
    sizeBytes: number;
  };
  sha256: string;
  sizeBytes: number;
  duplicate: boolean;
  duplicateSlotId?: string;
  matchingRuns?: Array<{ id: string; runLabel: string }>;
}

type TargetMode = "new" | "existing";

function suggestRunLabel(
  gameVersion: string,
  existing: Array<{ runLabel: string }>
): string {
  const game = shortGameName(gameVersion);
  const n = existing.length + 1;
  const candidate = `${game} · Run ${n}`;
  const taken = new Set(existing.map((r) => r.runLabel.trim().toLowerCase()));
  if (!taken.has(candidate.toLowerCase())) return candidate;
  let i = n;
  while (taken.has(`${game} · Run ${i}`.toLowerCase())) i += 1;
  return `${game} · Run ${i}`;
}

export function UploadFlow({
  slotId,
  forceNewRun = false,
  preferredGame,
}: {
  slotId?: string;
  /** Prefer creating an isolated run; never attach unless the user picks one. */
  forceNewRun?: boolean;
  preferredGame?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    forceNewRun
      ? "Start a new run. Drop a save — existing runs stay untouched."
      : slotId
        ? "Drop a newer save for this run. Other runs are not changed."
        : "Drop a save file. You can start a new run or add a version to one you already track."
  );
  const [runLabel, setRunLabel] = useState("");
  const [sourceDevice, setSourceDevice] = useState("");
  const [sourceEmulator, setSourceEmulator] = useState("");
  const [error, setError] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>(
    forceNewRun || !slotId ? "new" : "existing"
  );
  const [selectedRunId, setSelectedRunId] = useState("");

  const runPreview = useCallback(
    async (f: File) => {
      setFile(f);
      setError("");
      setMessage("A new save was caught! Who is it from?");
      const body = new FormData();
      body.append("file", f);
      // Only scope duplicate checks to a run when adding a version to one.
      if (slotId && !forceNewRun) body.append("slotId", slotId);
      const res = await fetch("/api/upload/preview", { method: "POST", body });
      const data = (await res.json()) as Preview & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not read that file.");
        setPreview(null);
        return;
      }
      setPreview(data);

      const matches = data.matchingRuns || [];
      const defaultLabel = suggestRunLabel(
        data.detection.gameVersion,
        matches
      );

      if (data.duplicate && slotId && !forceNewRun) {
        setMessage("This exact save is already a version of this run.");
      } else if (!data.detection.recognized) {
        setMessage(
          `${data.detection.label}. It can still be vaulted as a new run.`
        );
        setRunLabel((prev) => prev || defaultLabel);
      } else {
        setMessage(
          `${data.detection.label} detected. Pick a run destination, then confirm.`
        );
        setRunLabel((prev) => prev || defaultLabel);
      }

      if (forceNewRun || !slotId) {
        setTargetMode("new");
        setSelectedRunId(matches[0]?.id || "");
      }
    },
    [slotId, forceNewRun]
  );

  async function confirmSave() {
    if (!file || !preview) return;

    // Same bytes under a different run are always allowed.
    const attachingTo =
      !forceNewRun && slotId
        ? slotId
        : targetMode === "existing" && selectedRunId
          ? selectedRunId
          : undefined;

    if (preview.duplicate && attachingTo) {
      setMessage("This exact save is already a version of this run.");
      return;
    }

    if (!attachingTo && !runLabel.trim()) {
      setError("Give this run a label before saving.");
      return;
    }

    setSaving(true);
    setMessage("SAVING... Don't turn off your device.");
    const body = new FormData();
    body.append("file", file);
    body.append("runLabel", runLabel);
    body.append("sourceDevice", sourceDevice);
    body.append("sourceEmulator", sourceEmulator);
    if (attachingTo) body.append("slotId", attachingTo);

    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    setSaving(false);

    if (res.status === 409) {
      setMessage(data.message);
      return;
    }
    if (!res.ok) {
      setError(data.error || "Upload failed.");
      return;
    }
    setMessage(
      attachingTo
        ? "Version added to this run!"
        : "New run started — other runs are unchanged."
    );
    router.push(`/slots/${data.slotId}`);
    router.refresh();
  }

  const matchingRuns = preview?.matchingRuns ?? [];
  const addingVersion = Boolean(slotId && !forceNewRun);
  const showDestination = Boolean(preview && !addingVersion && !preview.duplicate);

  const heading = useMemo(() => {
    if (addingVersion) return "ADD VERSION TO THIS RUN";
    if (forceNewRun) return "START A NEW RUN";
    return "SAVE DESTINATION";
  }, [addingVersion, forceNewRun]);

  return (
    <div className="stack">
      <ThemeSync
        gameVersion={preview?.detection.gameVersion || preferredGame}
      />
      <DialogBox
        text={error || message}
        name="RUN"
        showArrow={!saving}
        speed="fast"
      />
      {saving ? <p className="saving-flash">SAVING...</p> : null}

      <PixelPanel>
        <h3 className="section-head">{heading}</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          {addingVersion
            ? "This updates only the current run. Starting another run keeps this one."
            : "Each run is isolated. Saving as Run 2 never deletes or replaces Run 1 — even if the file bytes match."}
        </p>
      </PixelPanel>

      <div className="lcd-screen">
        <div className="lcd-screen__glass">
          <div className="lcd-inner">
            <div
              className="dropzone"
              data-active={active}
              onDragEnter={(e) => {
                e.preventDefault();
                setActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setActive(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void runPreview(f);
              }}
              onClick={() => document.getElementById("save-file")?.click()}
            >
              <div className="dropzone__icon" aria-hidden />
              <p className="dropzone__title">
                {forceNewRun ? "NEW RUN SAVE" : "INSERT CARTRIDGE"}
              </p>
              <p className="muted">Drop a save here, or click to browse</p>
              <input
                id="save-file"
                type="file"
                accept=".sav,.dsv,.srm,.zip"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void runPreview(f);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {preview ? (
        <PixelPanel>
          <div className="stat-row">
            <span>{preview.detection.label}</span>
            <span>{preview.detection.format.toUpperCase()}</span>
            <span>{preview.sizeBytes} B</span>
          </div>
          <p className="muted">SHA · {preview.sha256.slice(0, 20)}…</p>
          {preview.detection.notes?.map((n) => (
            <p key={n} className="muted">
              {n}
            </p>
          ))}

          {preview.duplicate && addingVersion ? (
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  router.push(`/slots/${preview.duplicateSlotId}`)
                }
              >
                Open this run
              </button>
            </div>
          ) : (
            <>
              {showDestination ? (
                <div className="run-dest" style={{ marginTop: 14 }}>
                  <label className="run-dest__label">WHERE TO SAVE</label>
                  <div className="run-dest__choices" role="group">
                    <button
                      type="button"
                      className="btn"
                      data-active={targetMode === "new"}
                      onClick={() => setTargetMode("new")}
                    >
                      New run
                    </button>
                    <button
                      type="button"
                      className="btn"
                      data-active={targetMode === "existing"}
                      disabled={matchingRuns.length === 0}
                      onClick={() => setTargetMode("existing")}
                    >
                      Add to existing run
                    </button>
                  </div>
                  {matchingRuns.length === 0 ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      No other runs for this game yet — this will create the
                      first one.
                    </p>
                  ) : targetMode === "new" ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      Creates a separate path. Your{" "}
                      {matchingRuns.length} existing run
                      {matchingRuns.length === 1 ? "" : "s"} stay vaulted.
                    </p>
                  ) : (
                    <div className="field" style={{ marginTop: 10 }}>
                      <label htmlFor="existingRun">EXISTING RUN</label>
                      <select
                        id="existingRun"
                        value={selectedRunId}
                        onChange={(e) => setSelectedRunId(e.target.value)}
                      >
                        {matchingRuns.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.runLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : null}

              {(targetMode === "new" || addingVersion) && (
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="runLabel">
                    {addingVersion ? "RUN LABEL (optional)" : "RUN LABEL"}
                  </label>
                  <input
                    id="runLabel"
                    value={runLabel}
                    onChange={(e) => setRunLabel(e.target.value)}
                    placeholder="e.g. Nuzlocke · Run 2"
                    required={!addingVersion && targetMode === "new"}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="sourceDevice">DEVICE</label>
                <input
                  id="sourceDevice"
                  placeholder="phone, laptop…"
                  value={sourceDevice}
                  onChange={(e) => setSourceDevice(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sourceEmulator">EMULATOR</label>
                <input
                  id="sourceEmulator"
                  placeholder="DraStic, melonDS…"
                  value={sourceEmulator}
                  onChange={(e) => setSourceEmulator(e.target.value)}
                />
              </div>
              <MenuList
                items={[
                  {
                    id: "confirm",
                    label:
                      targetMode === "existing" && !addingVersion
                        ? "ADD VERSION"
                        : "START RUN",
                  },
                  { id: "cancel", label: "NO" },
                ]}
                onSelect={(id) => {
                  if (id === "confirm") void confirmSave();
                  if (id === "cancel") {
                    setFile(null);
                    setPreview(null);
                    setMessage(
                      forceNewRun
                        ? "Start a new run. Drop a save — existing runs stay untouched."
                        : "Drop a save file onto the slot."
                    );
                  }
                }}
              />
            </>
          )}
        </PixelPanel>
      ) : null}
    </div>
  );
}
