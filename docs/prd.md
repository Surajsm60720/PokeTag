# PokéTag: Product Requirements (PRD)

Working title. Draft v0.1, 16 Oct 2026. Owner: Suraj. Companion document: Design Document.

## 1. Summary

A personal web app that works as a save vault and a trainer dashboard for Pokémon main-series games. You upload save files from any emulator or console dump (GBA, DS, 3DS, Switch). The app stores the untouched original, parses it into a nostalgic pixel-styled dashboard, and lets you download the save on any other device to resume where you left off.

## 2. Problem

- Older Pokémon titles have no cloud saves, so progress lives on one device and is easy to lose.
- Saves are binary, sometimes encrypted, and differ by game and emulator. A plain cloud drive cannot show what is inside them.
- The owner has replayed these games many times and has no record of what each run looked like.

## 3. Goals and non-goals

**Goals**

1. Never lose a save. Every upload is kept byte for byte and versioned.
2. Resume anywhere. Download in the right format and filename for the target emulator in under two minutes.
3. See where I am. Parse saves into a trainer card, party, boxes, Pokédex, badges, play time and location (Phase 2+).
4. Feel like the games (see Design Document).

**Non-goals (v1)**

- Not a save editor. Parsing is read only.
- No ROM hosting, ROM links or emulator distribution.
- No battle simulator, trading or multiplayer.
- Not official, not affiliated with Nintendo, Game Freak or The Pokémon Company. No monetization.

## 4. Users and scenarios

Primary user: Suraj, single operator across several devices. Phase 1 ships **without auth** (local personal vault).

| ID | Scenario |
| --- | --- |
| S1 | Finishes a session on the phone, uploads the DraStic `.dsv`, sees the updated party. |
| S2 | Sets up a new laptop, downloads save named for the ROM into the emulator. |
| S3 | Overwrites a save by mistake, restores an earlier version. |
| S4 | Sees every run at a glance: team, badges and play time per game. |
| S5 | Opens legality view for cheated Pokémon (Phase 3). |

## 5. Scope and phasing

| Phase | Contents |
| --- | --- |
| 1. Vault MVP | Upload, raw storage (MinIO), SQLite metadata, versioning, download, GBA/DS detection, `.dsv`/`.sav` conversion, filename helper, emulator path hints. No auth. |
| 2. Dashboard | Parsing and dashboard for Gen 3 to 5; shelf polish. |
| 3. Depth | Hall of Fame, legality, conflict detection, version compare, share links. |
| 4. Newer games | Gen 6+ as saves become available. |

## 6. Functional requirements (Phase 1 focus)

**Vault:** V1–V3, V5–V8 (upload, immutable store, versioning, device/emulator labels, download original + converted, version history/restore). V4 duplicate-by-hash (P1). V9 conflict warning schema ready.

**Detection:** P1 detect format/generation/game in review step; P2 unknown/corrupt still vaulted; P11 read-only (no rewrite of stored file).

**Dashboard (Phase 1 thin):** D1 shelf of slots; D7 path hints; D8 settings stub later.

## 7. Non-functional requirements

- Integrity: upload then download returns identical bytes; fixture tests in CI.
- Privacy: local personal use; no analytics on file contents.
- Security: size limits, type sniffing; no auth layer in Phase 1 (trusted local network / operator).
- Performance: first paint under 2 seconds on a mid-range phone.
- Accessibility: keyboard navigation, reduced motion, no audio autoplay.

## 8. Supported games matrix (Phase 1)

| Gen | Games | Format | Parsing |
| --- | --- | --- | --- |
| 3 | RSE, FRLG | `.sav` | Detect only in Phase 1 |
| 4–5 | DPPt, HGSS, BW, B2W2 | `.dsv` or `.sav` | Detect only in Phase 1 |

## 9. Architecture (Phase 1)

- Frontend: Next.js + TypeScript + custom pixel design system.
- Metadata: SQLite.
- Object storage: MinIO.
- Format package: `@poketag/save-format` for detect/convert.
- Parser service (PKHeX): Phase 2.

## 10. Data model

- `save_slots(id, game_version, generation, run_label, created_at)`
- `save_versions(id, slot_id, parent_version_id, storage_key, sha256, size_bytes, original_filename, source_format, source_emulator, source_device, uploaded_at, note, recognized)`
- `device_state(device_label, slot_id, last_downloaded_version_id)`

## 11. Risks

Parser licensing (Phase 2), copyright/trademark for sprites if public, emulator footer variance, path hints aging, mobile file friction.

## 12. Success criteria (Phase 1)

- Every fixture file round trips byte for byte for original download.
- `.dsv`↔`.sav` conversion works on fixtures.
- Fresh device can upload and download in under two minutes.
- Design review: feels like the games, not a generic web app.
