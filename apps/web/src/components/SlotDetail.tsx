"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatBytes, formatWhen } from "@/lib/format";
import type { ParsedSnapshot } from "@/lib/parsed";
import { BagPanel } from "./BagPanel";
import { BoxGrid } from "./BoxGrid";
import { DexPanel } from "./DexPanel";
import { DialogBox } from "./DialogBox";
import { GameDirs } from "./GameDirs";
import { PartyPanel } from "./PartyPanel";
import { PixelPanel } from "./PixelPanel";
import { ThemeSync } from "./ThemeSync";
import { TrainerCard, type TrainerCardVersion } from "./TrainerCard";

interface VersionView extends TrainerCardVersion {
  parseStatus?: string | null;
  parseError?: string | null;
}

interface SlotView {
  id: string;
  runLabel: string;
  label: string;
  gameVersion: string;
  generation: number | null;
  createdAt: string;
  recognized: boolean;
  currentVersionId: string | null;
  parseStatus: string | null;
  parseError: string | null;
}

type DashTab =
  | "party"
  | "boxes"
  | "bag"
  | "dex"
  | "paths"
  | "travel"
  | "center";
type ParseStatus = "pending" | "running" | "done" | "failed" | null;

function initialMessage(
  snapshot: ParsedSnapshot | null,
  parseStatus: ParseStatus
): string {
  if (snapshot) {
    return snapshot.isDemo
      ? `Demo trainer ${snapshot.trainer.name} is ready. Walk the party, boxes and dex!`
      : `Welcome back, ${snapshot.trainer.name}!`;
  }
  if (parseStatus === "pending" || parseStatus === "running") {
    return "Parsing save…";
  }
  if (parseStatus === "failed") {
    return "Parse failed. Your save is still vaulted — try PATHS or TRAVEL.";
  }
  return "No parse yet — check PATHS for where this game keeps its save.";
}

export function SlotDetail({
  slot,
  versions: initialVersions,
  snapshot: initialSnapshot,
}: {
  slot: SlotView;
  versions: VersionView[];
  snapshot: ParsedSnapshot | null;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<"original" | "sav" | "dsv" | "srm">(
    "original"
  );
  const [romName, setRomName] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [parseStatus, setParseStatus] = useState<ParseStatus>(
    (slot.parseStatus as ParseStatus) ?? null
  );
  const [parseError, setParseError] = useState(slot.parseError);
  const [versions, setVersions] = useState(initialVersions);
  const [tab, setTab] = useState<DashTab>(
    initialSnapshot ? "party" : "paths"
  );
  const [message, setMessage] = useState(
    initialMessage(initialSnapshot, slot.parseStatus as ParseStatus)
  );
  const [busy, setBusy] = useState(false);

  const current = versions.find((v) => v.isCurrent) || versions[0] || null;

  const refreshSlot = useCallback(async () => {
    const res = await fetch(`/api/slots/${slot.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setParseStatus(data.parseStatus ?? null);
    setParseError(data.parseError ?? null);
    if (data.snapshot) {
      setSnapshot(data.snapshot);
      setTab((t) => (t === "paths" ? "party" : t));
      setMessage(`Welcome back, ${data.snapshot.trainer.name}!`);
    } else if (data.parseStatus === "failed") {
      setMessage(
        `Parse failed: ${data.parseError || "unknown error"}. Bytes kept.`
      );
    } else if (
      data.parseStatus === "pending" ||
      data.parseStatus === "running"
    ) {
      setMessage("Parsing save…");
    }
    if (Array.isArray(data.versions)) {
      setVersions(
        data.versions.map(
          (v: {
            id: string;
            uploadedAt: string;
            originalFilename: string;
            sourceFormat: string;
            sourceDevice: string;
            sourceEmulator: string;
            sha256: string;
            sizeBytes: number;
            note: string;
            isCurrent: boolean;
            recognized: boolean;
            detection?: { label?: string; notes?: string[] };
            parseStatus?: string;
            parseError?: string;
          }) => ({
            id: v.id,
            uploadedAt: v.uploadedAt,
            originalFilename: v.originalFilename,
            sourceFormat: v.sourceFormat,
            sourceDevice: v.sourceDevice,
            sourceEmulator: v.sourceEmulator,
            sha256: v.sha256,
            sizeBytes: v.sizeBytes,
            note: v.note,
            isCurrent: v.isCurrent,
            recognized: v.recognized,
            detectionLabel: v.detection?.label || slot.label,
            detectionNotes: v.detection?.notes || [],
            hasDesmumeFooter: false,
            rawPayloadSize: null,
            parseStatus: v.parseStatus,
            parseError: v.parseError,
          })
        )
      );
    }
  }, [slot.id, slot.label]);

  useEffect(() => {
    if (parseStatus !== "pending" && parseStatus !== "running") return;
    const id = window.setInterval(() => {
      void refreshSlot();
    }, 1500);
    return () => window.clearInterval(id);
  }, [parseStatus, refreshSlot]);

  async function download(versionId: string) {
    const params = new URLSearchParams({
      versionId,
      format,
    });
    if (romName) params.set("romName", romName);
    if (deviceLabel) params.set("deviceLabel", deviceLabel);
    setMessage("Your save is packed and ready. Good luck out there!");
    window.location.href = `/api/download?${params.toString()}`;
  }

  async function restore(versionId: string) {
    setBusy(true);
    const res = await fetch(`/api/slots/${slot.id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Restore failed.");
      return;
    }
    setMessage(data.message);
    await refreshSlot();
    router.refresh();
  }

  async function forceDeleteVersion(versionId: string) {
    if (
      !window.confirm(
        "Delete this version permanently? Other versions in this run stay."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(
      `/api/slots/${slot.id}/versions/${versionId}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Delete failed.");
      return;
    }
    setMessage(data.message || "Version deleted.");
    await refreshSlot();
    router.refresh();
  }

  async function forceDeleteRun() {
    if (
      !window.confirm(
        "Delete this entire run and all its versions? This cannot be undone."
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/slots/${slot.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Delete failed.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const tabs: Array<{ id: DashTab; label: string; locked?: boolean }> = [
    { id: "party", label: "PARTY", locked: !snapshot },
    { id: "boxes", label: "PC", locked: !snapshot },
    { id: "bag", label: "BAG", locked: !snapshot },
    { id: "dex", label: "DEX", locked: !snapshot },
    { id: "paths", label: "PATHS" },
    { id: "travel", label: "TRAVEL" },
    { id: "center", label: "CENTER" },
  ];

  return (
    <div className="stack">
      <ThemeSync gameVersion={slot.gameVersion} />
      <DialogBox text={message} name="TRAINER" speed="fast" showArrow />

      {parseStatus === "pending" || parseStatus === "running" ? (
        <p className="muted">Parsing save…</p>
      ) : null}
      {parseStatus === "failed" && parseError ? (
        <p className="muted">Parse failed: {parseError}</p>
      ) : null}

      <TrainerCard
        slot={slot}
        current={current}
        versionCount={versions.length}
        snapshot={snapshot}
      />

      <nav className="dash-tabs" aria-label="Dashboard sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="dash-tabs__btn"
            data-active={tab === t.id}
            disabled={t.locked}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "party" && snapshot ? (
        <PixelPanel>
          <h3 className="section-head">PARTY</h3>
          <PartyPanel party={snapshot.party} />
        </PixelPanel>
      ) : null}

      {tab === "boxes" && snapshot ? (
        <PixelPanel>
          <h3 className="section-head">PC BOXES</h3>
          <BoxGrid boxes={snapshot.boxes} />
        </PixelPanel>
      ) : null}

      {tab === "bag" && snapshot ? (
        <PixelPanel>
          <BagPanel inventory={snapshot.inventory} />
        </PixelPanel>
      ) : null}

      {tab === "dex" && snapshot ? (
        <PixelPanel>
          <h3 className="section-head">POKÉDEX</h3>
          <DexPanel dex={snapshot.dex} />
        </PixelPanel>
      ) : null}

      {tab === "paths" ? (
        <PixelPanel>
          <h3 className="section-head">SAVE DIRECTORY</h3>
          <GameDirs gameVersion={slot.gameVersion} />
        </PixelPanel>
      ) : null}

      {tab === "travel" ? (
        <PixelPanel>
          <h3 className="section-head">PACK FOR TRAVEL</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Download the current version in the format your emulator wants.
          </p>

          <div className="field">
            <label htmlFor="format">DOWNLOAD FORMAT</label>
            <select
              id="format"
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as "original" | "sav" | "dsv" | "srm")
              }
            >
              <option value="original">Original (byte-identical)</option>
              <option value="sav">.sav</option>
              <option value="dsv">.dsv</option>
              <option value="srm">.srm</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="romName">ROM BASENAME</label>
            <input
              id="romName"
              placeholder="Pokemon - Emerald Version"
              value={romName}
              onChange={(e) => setRomName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="deviceLabel">THIS DEVICE</label>
            <input
              id="deviceLabel"
              placeholder="laptop"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
            />
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!current}
              onClick={() => current && void download(current.id)}
            >
              Download
            </button>
            <Link className="btn" href={`/upload?slotId=${slot.id}`}>
              Add version
            </Link>
            <Link
              className="btn"
              href={`/upload?mode=new&game=${encodeURIComponent(slot.gameVersion)}`}
            >
              Another run
            </Link>
            <Link className="btn" href="/">
              Shelf
            </Link>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void forceDeleteRun()}
            >
              Delete run
            </button>
          </div>
        </PixelPanel>
      ) : null}

      {tab === "center" ? (
        <PixelPanel>
          <h3 className="section-head">POKÉMON CENTER</h3>
          <p className="muted" style={{ marginBottom: 14 }}>
            Each ball is a version. Restoring plays the heal.
          </p>
          <ul className="version-list heal-machine">
            {versions.map((v) => (
              <li
                key={v.id}
                className="version-item"
                data-current={v.isCurrent}
              >
                <div className="heal-slot">
                  <span
                    className="pokeball-slot"
                    data-dim={!v.isCurrent}
                    aria-hidden
                  />
                  <div className="version-item__body">
                    <div className="version-item__top">
                      <strong>{formatWhen(v.uploadedAt)}</strong>
                      <span
                        className="status-chip"
                        data-tone={v.recognized ? "ok" : "warn"}
                      >
                        {v.recognized ? "OK" : "???"}
                      </span>
                      {v.parseStatus === "pending" ||
                      v.parseStatus === "running" ? (
                        <span className="status-chip" data-tone="warn">
                          PARSE…
                        </span>
                      ) : null}
                      {v.parseStatus === "failed" ? (
                        <span className="status-chip" data-tone="warn">
                          PARSE FAIL
                        </span>
                      ) : null}
                    </div>
                    <div className="version-item__file mono-wrap">
                      {v.originalFilename}
                    </div>
                    <div className="stat-row stat-row--compact">
                      <span>{v.sourceFormat.toUpperCase()}</span>
                      <span>{formatBytes(v.sizeBytes)}</span>
                      {(v.sourceDevice || v.sourceEmulator) && (
                        <span>
                          {[v.sourceDevice, v.sourceEmulator]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    {v.note ? <div className="muted">{v.note}</div> : null}
                    <div className="sha mono-wrap">{v.sha256}</div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void download(v.id)}
                      >
                        Download
                      </button>
                      {!v.isCurrent ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => void restore(v.id)}
                        >
                          Restore
                        </button>
                      ) : (
                        <span className="muted">Active save</span>
                      )}
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void forceDeleteVersion(v.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PixelPanel>
      ) : null}
    </div>
  );
}
