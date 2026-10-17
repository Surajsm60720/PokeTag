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
import {
  formatMoney,
  formatPlayTime,
  type ParsedSnapshot,
} from "@/lib/parsed";
import { BadgeCase } from "./BadgeCase";
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

type Face = "trainer" | "file";

export function TrainerCard({
  slot,
  current,
  versionCount,
  snapshot,
}: {
  slot: TrainerCardSlot;
  current: TrainerCardVersion | null;
  versionCount: number;
  snapshot: ParsedSnapshot | null;
}) {
  const [face, setFace] = useState<Face>("trainer");
  const platform = platformForGame(slot.gameVersion);
  const title = slot.runLabel || slot.label;
  const gameName = gameDisplayName(slot.gameVersion, slot.label);
  const statusOk = slot.recognized && Boolean(current);
  const integrity = current
    ? "Original bytes vaulted (immutable)"
    : "No version on file";
  const earned = snapshot?.badges.filter((b) => b.earned).length ?? 0;

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
            aria-selected={face === "trainer"}
            data-active={face === "trainer"}
            onClick={() => setFace("trainer")}
          >
            Trainer
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

      <h2 className="trainer-card__title">
        {snapshot?.trainer.name || title}
      </h2>
      <p className="trainer-card__game">{gameName}</p>

      <div className="trainer-card__badges" aria-label="Save status">
        <span className="status-chip" data-tone={statusOk ? "ok" : "warn"}>
          {statusOk ? "RECOGNIZED" : "UNRECOGNIZED"}
        </span>
        <span className="status-chip" data-tone="info">
          GEN {slot.generation ?? "?"}
        </span>
        <span className="status-chip" data-tone="info">
          {platformLabel(platform).toUpperCase()}
        </span>
        {snapshot ? (
          <span className="status-chip" data-tone="ok">
            {snapshot.isDemo ? "DEMO DATA" : "PARSED"}
          </span>
        ) : (
          <span className="status-chip" data-tone="neutral">
            UNPARSED
          </span>
        )}
        <span className="status-chip" data-tone="neutral">
          {versionCount} VER{versionCount === 1 ? "" : "S"}
        </span>
      </div>

      {face === "trainer" ? (
        snapshot ? (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Trainer ID</dt>
                <dd className="mono-wrap">
                  {String(snapshot.trainer.trainerId).padStart(5, "0")}
                </dd>
              </div>
              <div>
                <dt>Secret ID</dt>
                <dd className="mono-wrap">
                  {String(snapshot.trainer.secretId).padStart(5, "0")}
                </dd>
              </div>
              <div>
                <dt>Play time</dt>
                <dd>{formatPlayTime(snapshot.playTimeSeconds)}</dd>
              </div>
              <div>
                <dt>Money</dt>
                <dd>{formatMoney(snapshot.trainer.money)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{snapshot.location}</dd>
              </div>
              <div>
                <dt>Badges</dt>
                <dd>
                  {earned}/{snapshot.badges.length}
                </dd>
              </div>
              <div>
                <dt>Pokédex</dt>
                <dd>
                  {snapshot.dex.owned} owned · {snapshot.dex.seen} seen
                </dd>
              </div>
              <div>
                <dt>Elite Four</dt>
                <dd>
                  {snapshot.progress?.eliteFourDefeated == null
                    ? "—"
                    : snapshot.progress.eliteFourDefeated
                      ? "Defeated"
                      : "Not yet"}
                </dd>
              </div>
              <div>
                <dt>Champion</dt>
                <dd>
                  {snapshot.progress?.championDefeated == null
                    ? "—"
                    : snapshot.progress.championDefeated
                      ? "Defeated"
                      : "Not yet"}
                </dd>
              </div>
              <div>
                <dt>Device</dt>
                <dd>{current?.sourceDevice || "— not labeled —"}</dd>
              </div>
              <div>
                <dt>Emulator</dt>
                <dd>{current?.sourceEmulator || "— not labeled —"}</dd>
              </div>
              {snapshot.progress?.note ? (
                <div className="detail-grid__wide">
                  <dt>Progress note</dt>
                  <dd>{snapshot.progress.note}</dd>
                </div>
              ) : null}
            </dl>
            <div className="trainer-card__badge-case">
              <h3 className="section-head">BADGE CASE</h3>
              <BadgeCase badges={snapshot.badges} />
            </div>
            {snapshot.isDemo ? (
              <p className="muted trainer-card__demo-note">
                Demo dashboard data for visual review. Real PKHeX parsing comes
                next — stored bytes stay untouched.
              </p>
            ) : null}
          </>
        ) : (
          <dl className="detail-grid">
            <div>
              <dt>Run started</dt>
              <dd>{formatWhen(slot.createdAt)}</dd>
            </div>
            <div>
              <dt>Last upload</dt>
              <dd>{formatWhen(current?.uploadedAt)}</dd>
            </div>
            <div className="detail-grid__wide">
              <dt>Parsed dashboard</dt>
              <dd className="muted">
                No snapshot for this version yet. Demo slots show sample trainer
                data; real uploads unlock after the parser lands.
              </dd>
            </div>
            <div className="detail-grid__wide">
              <dt>Integrity</dt>
              <dd>{integrity}</dd>
            </div>
          </dl>
        )
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
