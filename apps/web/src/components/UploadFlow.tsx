"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
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
}

export function UploadFlow({ slotId }: { slotId?: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    "Drop a save file onto the slot. .sav, .dsv, .srm, or .zip."
  );
  const [runLabel, setRunLabel] = useState("");
  const [sourceDevice, setSourceDevice] = useState("");
  const [sourceEmulator, setSourceEmulator] = useState("");
  const [error, setError] = useState("");

  const runPreview = useCallback(async (f: File) => {
    setFile(f);
    setError("");
    setMessage("A new save was caught! Who is it from?");
    const body = new FormData();
    body.append("file", f);
    const res = await fetch("/api/upload/preview", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not read that file.");
      setPreview(null);
      return;
    }
    setPreview(data);
    if (data.duplicate) {
      setMessage("This save is already in the vault. Same data, same trainer.");
    } else if (!data.detection.recognized) {
      setMessage(
        `${data.detection.label}. It can still be vaulted as unrecognized.`
      );
    } else {
      setMessage(`${data.detection.label} detected. Confirm to save?`);
      setRunLabel((prev) => prev || data.detection.label);
    }
  }, []);

  async function confirmSave() {
    if (!file || !preview || preview.duplicate) return;
    setSaving(true);
    setMessage("SAVING... Don't turn off your device.");
    const body = new FormData();
    body.append("file", file);
    body.append("runLabel", runLabel);
    body.append("sourceDevice", sourceDevice);
    body.append("sourceEmulator", sourceEmulator);
    if (slotId) body.append("slotId", slotId);

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
    setMessage("A new save was caught!");
    router.push(`/slots/${data.slotId}`);
    router.refresh();
  }

  return (
    <div className="stack">
      <ThemeSync gameVersion={preview?.detection.gameVersion} />
      <DialogBox
        text={error || message}
        name="SAVE"
        showArrow={!saving}
        speed="fast"
      />
      {saving ? <p className="saving-flash">SAVING...</p> : null}

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
              <p className="dropzone__title">INSERT CARTRIDGE</p>
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

          {!preview.duplicate ? (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="runLabel">RUN LABEL</label>
                <input
                  id="runLabel"
                  value={runLabel}
                  onChange={(e) => setRunLabel(e.target.value)}
                />
              </div>
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
                  { id: "confirm", label: "YES" },
                  { id: "cancel", label: "NO" },
                ]}
                onSelect={(id) => {
                  if (id === "confirm") void confirmSave();
                  if (id === "cancel") {
                    setFile(null);
                    setPreview(null);
                    setMessage(
                      "Drop a save file onto the slot. .sav, .dsv, .srm, or .zip."
                    );
                  }
                }}
              />
            </>
          ) : (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  router.push(`/slots/${preview.duplicateSlotId}`)
                }
              >
                Open existing
              </button>
            </div>
          )}
        </PixelPanel>
      ) : null}
    </div>
  );
}
