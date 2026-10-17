"use client";

import { useEffect, useState } from "react";

interface Hint {
  id: string;
  platform: string;
  emulator: string;
  path: string;
  note?: string;
}

export function PathHints() {
  const [hints, setHints] = useState<Hint[]>([]);

  useEffect(() => {
    fetch("/api/path-hints")
      .then((r) => r.json())
      .then((data) => setHints(data.hints || []))
      .catch(() => setHints([]));
  }, []);

  return (
    <aside className="poketch-dock" aria-label="Path hints">
      <div className="poketch-dock__title">PATH DOCK</div>
      <div className="poketch-dock__screen">
        <p className="muted" style={{ marginBottom: 10 }}>
          Where to put the file. Paths change by version.
        </p>
        <div className="path-hints">
          {hints.map((h) => (
            <div key={h.id} className="path-hint">
              <strong>
                {h.emulator} / {h.platform}
              </strong>
              <code>{h.path}</code>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
