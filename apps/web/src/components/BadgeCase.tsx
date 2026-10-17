import { badgeArtUri } from "@/lib/badge-art";
import type { ParsedBadge } from "@/lib/parsed";

export function BadgeCase({ badges }: { badges: ParsedBadge[] }) {
  if (!badges.length) {
    return <p className="muted">No badges recorded for this run.</p>;
  }

  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="badge-case">
      <div className="badge-case__count">
        {earned} / {badges.length} earned
      </div>
      <ul className="badge-case__grid">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className="badge-case__slot"
            data-earned={badge.earned}
            title={badge.earned ? badge.name : `${badge.name} (not earned)`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="badge-case__art"
              src={badgeArtUri(badge.name)}
              alt=""
              width={48}
              height={48}
              draggable={false}
            />
            <span className="badge-case__name">{badge.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
