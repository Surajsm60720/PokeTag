"use client";

import { useState } from "react";
import {
  formatBytes,
  formatShortHash,
  formatWhen,
  gameDisplayName,
  platformForGame,
  platformLabel,
} from "@/lib/format";
import { PixelPanel } from "./PixelPanel";

export interface TrainerCardVersion {
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
  detectionLabel: string;
  detectionNotes: string[];
  hasDesmumeFooter: boolean;
  rawPayloadSize: number | null;
}

export interface TrainerCardSlot {
  id: string;
  runLabel: string;
  label: string;
  gameVersion: string;
  generation: number | null;
  createdAt: string;
  recognized: boolean;
}

type Face = "status" | "file";

export function TrainerCard({
  slot,
  current,
  versionCount,
}: {
  slot: TrainerCardSlot;
  current: TrainerCardVersion | null;
  versionCount: number;
}) {
  const [face, setFace] = useState<Face>("status");
  const platform = platformForGame(slot.gameVersion);
  const title = slot.runLabel || slot.label;
  const gameName = gameDisplayName(slot.gameVersion, slot.label);
  const statusOk = slot.recognized && Boolean(current);
  const integrity = current
    ? "Original bytes vaulted (immutable)"
    : "No version on file";

  async function copyHash() {
    if (!current?.sha256) return;
    try {
      await navigator.clipboard.writeText(current.sha256);
    } catch {
      /* ignore */
    }
  }

  return (
    <PixelPanel className="trainer-card">
      <div className="trainer-card__ribbon">
        <span>TRAINER CARD</span>
        <span className="trainer-card__face-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={face === "status"}
            data-active={face === "status"}
            onClick={() => setFace("status")}
          >
            Status
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={face === "file"}
            data-active={face === "file"}
            onClick={() => setFace("file")}
          >
            File
          </button>
        </span>
      </div>

      <h2 className="trainer-card__title">{title}</h2>
      <p className="trainer-card__game">{gameName}</p>

      <div className="trainer-card__badges" aria-label="Save status">
        <span
          className="status-chip"
          data-tone={statusOk ? "ok" : "warn"}
        >
          {statusOk ? "RECOGNIZED" : "UNRECOGNIZED"}
        </span>
        <span className="status-chip" data-tone="info">
          GEN {slot.generation ?? "?"}
        </span>
        <span className="status-chip" data-tone="info">
          {platformLabel(platform).toUpperCase()}
        </span>
        <span className="status-chip" data-tone="neutral">
          {versionCount} VER{versionCount === 1 ? "" : "S"}
        </span>
        {current?.isCurrent ? (
          <span className="status-chip" data-tone="ok">
            CURRENT
          </span>
        ) : null}
      </div>

      {face === "status" ? (
        <dl className="detail-grid">
          <div>
            <dt>Run started</dt>
            <dd>{formatWhen(slot.createdAt)}</dd>
          </div>
          <div>
            <dt>Last upload</dt>
            <dd>{formatWhen(current?.uploadedAt)}</dd>
          </div>
          <div>
            <dt>Hardware</dt>
            <dd>{platformLabel(platform)}</dd>
          </div>
          <div>
            <dt>Detected as</dt>
            <dd>{current?.detectionLabel || gameName}</dd>
          </div>
          <div>
            <dt>Device</dt>
            <dd>{current?.sourceDevice || "— not labeled —"}</dd>
          </div>
          <div>
            <dt>Emulator</dt>
            <dd>{current?.sourceEmulator || "— not labeled —"}</dd>
          </div>
          <div className="detail-grid__wide">
            <dt>Integrity</dt>
            <dd>{integrity}</dd>
          </div>
          <div className="detail-grid__wide">
            <dt>Parsed dashboard</dt>
            <dd className="muted">
              Party, badges, play time and location unlock in Phase 2 (read-only
              save parsing). File vault details are live now.
            </dd>
          </div>
          {current?.detectionNotes?.length ? (
            <div className="detail-grid__wide">
              <dt>Detection notes</dt>
              <dd>
                <ul className="note-list">
                  {current.detectionNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {current?.note ? (
            <div className="detail-grid__wide">
              <dt>Version note</dt>
              <dd>{current.note}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <dl className="detail-grid">
          <div className="detail-grid__wide">
            <dt>Original filename</dt>
            <dd className="mono-wrap">{current?.originalFilename || "—"}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{(current?.sourceFormat || "?").toUpperCase()}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{formatBytes(current?.sizeBytes)}</dd>
          </div>
          <div>
            <dt>Payload</dt>
            <dd>
              {current?.rawPayloadSize != null
                ? formatBytes(current.rawPayloadSize)
                : "—"}
              {current?.hasDesmumeFooter ? " + DeSmuME footer" : ""}
            </dd>
          </div>
          <div>
            <dt>Game key</dt>
            <dd>{slot.gameVersion}</dd>
          </div>
          <div className="detail-grid__wide">
            <dt>SHA-256</dt>
            <dd className="hash-row">
              <code className="mono-wrap" title={current?.sha256}>
                {formatShortHash(current?.sha256)}
              </code>
              <button
                type="button"
                className="btn btn-tiny"
                disabled={!current?.sha256}
                onClick={() => void copyHash()}
              >
                Copy
              </button>
            </dd>
          </div>
          <div className="detail-grid__wide">
            <dt>Full hash</dt>
            <dd className="sha mono-wrap">{current?.sha256 || "—"}</dd>
          </div>
        </dl>
      )}
    </PixelPanel>
  );
}
