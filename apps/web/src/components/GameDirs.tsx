import { getGameDir, type GameDirInfo } from "@/lib/game-dirs";
import { gameDisplayName } from "@/lib/format";

type OsGroup = "macOS" | "Windows" | "Linux" | "Android" | "Hardware" | "Other";

const OS_ORDER: OsGroup[] = [
  "macOS",
  "Windows",
  "Linux",
  "Android",
  "Hardware",
  "Other",
];

function classifyOs(label: string, path: string): OsGroup {
  const s = `${label} ${path}`.toLowerCase();
  if (
    s.includes("checkpoint") ||
    s.includes("jksm") ||
    s.includes("jksv") ||
    s.includes("sdmc:") ||
    s.includes("atmosphere")
  ) {
    return "Hardware";
  }
  if (
    s.includes("android") ||
    s.includes("my boy") ||
    s.includes("pizza boy") ||
    s.includes("drastic")
  ) {
    return "Android";
  }
  if (s.includes("macos") || s.includes("openemu") || s.includes("~/library")) {
    return "macOS";
  }
  if (s.includes("windows") || s.includes("%appdata%") || s.includes("\\")) {
    return "Windows";
  }
  if (
    s.includes("linux") ||
    s.includes("~/.local") ||
    s.includes("~/.config") ||
    s.includes("lime3ds")
  ) {
    return "Linux";
  }
  if (
    s.includes("retroarch") ||
    s.includes("cross-platform") ||
    s.includes("vba")
  ) {
    return "Other";
  }
  return "Other";
}

function groupPaths(paths: GameDirInfo["paths"]) {
  const groups = new Map<OsGroup, GameDirInfo["paths"]>();
  for (const p of paths) {
    const os = classifyOs(p.label, p.path);
    const list = groups.get(os) ?? [];
    list.push(p);
    groups.set(os, list);
  }
  return OS_ORDER.filter((os) => groups.has(os)).map((os) => ({
    os,
    paths: groups.get(os)!,
  }));
}

export function GameDirs({ gameVersion }: { gameVersion: string }) {
  const info = getGameDir(gameVersion);
  if (!info) {
    return <p className="muted">No directory hints for this game yet.</p>;
  }

  const platformLabel =
    info.platform === "gba"
      ? "Game Boy Advance"
      : info.platform === "ds"
        ? "Nintendo DS"
        : info.platform === "3ds"
          ? "Nintendo 3DS"
          : "Nintendo Switch";

  const groups = groupPaths(info.paths);

  return (
    <div className="game-dirs">
      <p className="muted" style={{ marginBottom: 10 }}>
        Save spots for {gameDisplayName(gameVersion)} on {platformLabel}. Paths
        differ by emulator, OS, and whether you dumped from hardware.
      </p>
      {info.titleId ? (
        <div className="game-dirs__title-id">
          Title ID: {info.titleId}
          {info.titleIdLow ? ` · folder ${info.titleIdLow}` : ""}
        </div>
      ) : null}
      {info.productCode ? (
        <div className="game-dirs__title-id">Cart code: {info.productCode}</div>
      ) : null}
      {groups.map((g) => (
        <div key={g.os} className="game-dirs__group">
          <h4 className="game-dirs__os">{g.os}</h4>
          <ul className="game-dirs__list">
            {g.paths.map((p) => (
              <li key={`${p.label}-${p.path}`} className="game-dirs__item">
                <strong>{p.label}</strong>
                <code>{p.path}</code>
                {p.note ? <span className="muted">{p.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
