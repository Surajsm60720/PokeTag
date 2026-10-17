"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatBytes, formatWhen } from "@/lib/format";
import { DialogBox } from "./DialogBox";
import { PixelPanel } from "./PixelPanel";
import { ThemeSync } from "./ThemeSync";
import { TrainerCard, type TrainerCardVersion } from "./TrainerCard";

interface VersionView extends TrainerCardVersion {}

interface SlotView {
  id: string;
  runLabel: string;
  label: string;
  gameVersion: string;
  generation: number | null;
  createdAt: string;
  recognized: boolean;
  currentVersionId: string | null;
}

export function SlotDetail({
  slot,
  versions,
}: {
  slot: SlotView;
  versions: VersionView[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<"original" | "sav" | "dsv" | "srm">(
    "original"
  );
  const [romName, setRomName] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [message, setMessage] = useState(
    "Your save is packed and ready. Good luck out there!"
  );
  const [busy, setBusy] = useState(false);

  const current = versions.find((v) => v.isCurrent) || versions[0] || null;

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
    router.refresh();
  }

  return (
    <div className="stack">
      <ThemeSync gameVersion={slot.gameVersion} />
      <DialogBox text={message} name="TRAINER" speed="fast" showArrow />

      <TrainerCard
        slot={slot}
        current={current}
        versionCount={versions.length}
      />

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
            New version
          </Link>
          <Link className="btn" href="/">
            Shelf
          </Link>
        </div>
      </PixelPanel>

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
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PixelPanel>
    </div>
  );
}
