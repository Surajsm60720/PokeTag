# PokéTag: Design Document

Working title. Draft v0.1, 16 Oct 2026. Owner: Suraj. Companion document: PRD.

## 1. Design north star

Opening the site should feel like pressing the power button on a handheld and hearing the boot jingle. Not a web app dressed in pixel art: a place where the save menu, the PC, the Pokécenter and the trainer card from the games you grew up with are the actual interface.

The tone: warm, playful, a little proud. Every system message talks like the games do.

## 2. Design principles

1. **Game moments, not game skins.** Every feature maps to a real moment from the games (saving, healing, boxing, the Hall of Fame). If a screen has no game memory attached, redesign it until it does.
2. **Honest pixels.** One pixel grid, integer scaling only, crisp edges, limited palettes per theme. No blurry upscaled sprites, no soft drop shadows.
3. **Glass over pixel, never instead of pixel.** Frosted glass is the material. Pixel bevels, dither and stepped corners are the shape language. Glass is chrome and atmosphere. Text always sits on a mostly solid plate.
4. **Choppy motion on purpose.** Animation runs at 8 to 12 frames per second using stepped timing, like sprite frames, not smooth easing.
5. **Each generation has its own look.** Game pages wear the theme of the game the save came from.
6. **Nostalgia without noise.** Interactions are rich but skippable, sound is off by default, motion respects the reduced motion setting.

## 3. Generation themes

Each game page loads one theme as CSS variables: palette, window frame, cursor, box wallpaper, sprite set and ambient motif. Hex values are starting points chosen to evoke each game, not sampled from game assets.

| Era | Games | Mood | Palette starting points | Signature UI motif | Ambient motif |
| --- | --- | --- | --- | --- | --- |
| Gen 3 | FireRed, LeafGreen | Crisp, adventurous, Kanto remake | Red #D8402A, leaf #4CA83B, cream #F4EFD8, ink #2B2B3A | Thick dark bordered text window, start menu stacked on the right | Pallet Town grass tiles, cartridge label strips |
| Gen 3 | Ruby, Sapphire, Emerald | Tropical, bright, Hoenn | Ruby #B21E35, sapphire #1F4FA3, emerald #1E8F52, sky #8FD3F4, sand #E8D9A8 | Rounded window frames, selectable frame types | Waves, ocean tiles, rain and sun |
| Gen 4 | Diamond, Pearl, Platinum | Cool, spacious, Sinnoh | Steel blue #7AA0D8, pearl pink #E8B4C8, platinum grey #8C93A0, snow #F2F6FA | Dual screen layout, the Pokétch wrist device on the lower screen | Snowfall, mountain silhouettes |
| Gen 4 | HeartGold, SoulSilver | Golden, nostalgic, Johto and Kanto | Gold #D9A441, silver #B8C2CC, deep teal #1F5F6B, cream #F6EBC9 | The Pokégear with tabs for map, radio, phone and clock, time of day tinting | Day, dusk and night tint by local time |
| Gen 5 | Black, White | Urban, sharp, Unova | Black #1C1C22, white #F2F4F8, one accent #E5483B | Clean bold panels, C-Gear style side widget | City skyline, seasonal tint |
| Gen 5 | Black 2, White 2 | Refined, lively | Black2 #2B2F45, white2 #E9ECF5, gold #E0B24A | Same as Gen 5 with more layered panels | Seasons by calendar month |
| Gen 6 and 7 | X, Y, ORAS, Sun, Moon, USUM | Rounder, softer, 3D era | Pastel versions of the Gen 3 hues | Smooth cards with pixel borders, lightly 3D tilt on hover | Mega stone sparkle, island breeze |
| Gen 8 and 9 | Sword, Shield, Scarlet, Violet and others | Bold, modern | High contrast duotone per game | Large panel layouts, minimal pixel borders | Subtle |

Gen 6 and later are a lower priority. The Gen 3 to 5 themes get the full treatment first.

## 4. Visual language

### 4.1 The pixel grid

- One design pixel equals 1 CSS pixel scaled by an integer factor (3x on desktop, 2x on small phones). Everything snaps to an 8 pixel base grid.
- All images use `image-rendering: pixelated`. Sprites are only ever scaled by whole numbers.
- Borders are 2 pixel stepped bevels: a light edge top and left, a dark edge bottom and right, like the old menu windows.
- Corners are notched, not rounded: cut with `clip-path` steps of 4 pixels.

### 4.2 The glass material

The glass is meant to feel like a backlit handheld screen under a plastic cover, not modern frosted UI.

- Panel fill: translucent white or theme tint at 12 to 20 percent, with `backdrop-filter: blur(6px) saturate(1.2)`.
- A 2x2 dither overlay on glass at about 8 percent opacity.
- A faint LCD grid overlay and a very light scanline layer on the main screen area.
- A hard 1 pixel highlight on the top edge.
- Rule: body text, numbers and labels sit on an inner plate that is at least 85 percent opaque. Glass is for frames, backgrounds and decoration.

### 4.3 Typography

| Use | Font (open licence, Google Fonts) | Notes |
| --- | --- | --- |
| Titles, menu headers | Press Start 2P | Short strings only, never paragraphs |
| UI text, dialogue | Pixelify Sans or Silkscreen | 16 pixels or larger on screen |
| Numbers, stats, paths | VT323 | Good for stat blocks and file paths |

### 4.4 Iconography

Original 16x16 pixel icons, or an open licence pixel icon pack. No emoji, no default line icon sets. The selection cursor is a pixel hand or the classic right facing triangle, and it doubles as the keyboard focus indicator.

### 4.5 Motion rules

- Frame by frame animation with `steps()` timing, 8 to 12 frames per second.
- Text appears with a typewriter effect and a blinking down arrow when more text follows.
- Page changes use a battle style transition under 600 milliseconds; skipped when reduced motion is on.
- Sprites idle with a 2 frame bob. Shiny Pokémon get a sparkle burst when first shown.

### 4.6 Sound

Off by default and never autoplays. When enabled: synthesized square and triangle wave blips. No ripped game audio and no Pokémon cries.

## 5. Screens

| Screen | Game moment | Behaviour |
| --- | --- | --- |
| Title screen | Pressing Start | Pixel logo, blinking PRESS START, rotating sprite showcase |
| Cartridge shelf | Games you owned | Cartridges by platform; click inserts and opens game page |
| Upload | Save dialog | Drop file, dialogue detection, confirm, flashing SAVING |
| Upload success | Successful catch | Poke Ball shake, star burst, catch line |
| Name and label entry | Naming screen | Letter grid + keyboard |
| Trainer card | Trainer Card | Per game frame, flip for upload history |
| Party | Party menu | Six slots, HP bars, summary |
| Summary screen | Pokémon summary | Tabs Info / Skills / Moves / Ribbons |
| PC boxes | Using the PC | Wallpaper, box arrows, grid |
| Pokédex | Pokédex list | SEEN / OWN, silhouettes |
| Hall of Fame | Induction | Final team, run summary |
| Version history | Pokémon Center | Versions as balls on healing machine |
| Legality view | Lab check | Playful gauge, teasing tone |
| Path hints | Pokétch / Pokégear | Sticky dock with OS/emulator paths |
| Options | Options menu | TEXT SPEED, SOUND, MOTION, FRAME |
| Error / corrupt | Corrupted save message | Glitch effect, offer last good version |

## 6. Copy and microcopy

System messages are written as game dialogue: short lines, typewriter effect, one idea per box.

| Event | Copy idea |
| --- | --- |
| Upload received | A new save was caught! Who is it from? |
| Saving | SAVING... Don't turn off your device. |
| Duplicate file | This save is already in the vault. Same data, same trainer. |
| Download ready | Your save is packed and ready. Good luck out there! |
| Restore done | Your save is fully restored. We hope to see you again! |
| Conflict warning | Another device saved more recently. Overwrite anyway? |
| Disabled action | There is a time and place for everything, but not now. |
| Empty shelf | No games yet. Insert a cartridge to begin. |

## 7–9. Interactions, responsive, accessibility

See full design notes in the original draft: keyboard (arrows/WASD, Z/Enter, X/Esc), optional on-screen D-pad, time-of-day tint, seasons, easter eggs, dual-screen desktop layout, phone start menu bar, keyboard focus via pixel cursor, contrast 4.5:1 on plates, reduced motion, no audio autoplay, flash under 3 Hz.

## 10. Asset and legal strategy

UI frames, icons, cartridge art, cursor, trainer sprite, Poke Ball art: original. Fonts: open licence. Sprites: community sets for private builds; `PUBLIC_MODE` swaps to silhouettes for public. Audio: synthesized only. Fan project disclaimer; rename before public release.

## 11. Component library

PixelPanel, GlassFrame, DialogBox, MenuList, OptionRow, HPBar, PartySlot, SummaryTabs, BoxGrid, DexTile, BadgeCase, TrainerCard, CartridgeCard, PokeballProgress, NameEntryGrid, TransitionWipe, PoketchDock, TimeTint, SpriteImage, TooltipBubble.

## 12. Implementation notes

Themes via `data-theme` CSS variables. Window frames as 9-slice `border-image`. Stepped animations with CSS `steps()`. Web Audio API with master mute. Tailwind or plain CSS with custom tokens — no default-styled component library.

## 13. Anti generic checklist

Fails review if: Inter/system fonts for UI; purple-to-blue gradients / soft cards / soft shadows; emoji or line icons; flat white dashboard with pixel font pasted on; smooth easing on sprite/menu motion; panels without bevel/notch/dither; any screen with no game moment.

## 14. Build order for design

1. Tokens: grid, palettes, fonts, frame images, cursor.
2. Core components: PixelPanel, GlassFrame, DialogBox, MenuList, OptionRow.
3. Gen 3 theme end to end.
4. Gen 4 and 5 themes, shell mode, time and season tints.
5. Interactions, sound, easter eggs, mobile controls.
6. Accessibility pass and reduced motion review.

## 15. Open design questions (defaults for v1)

- Per-game window frames with a shared fallback.
- Handheld shell mode: Options toggle, off by default.
- Sound off by default.
- Working title PokéTag until rename.
- Sprite set follows detected game generation for the save.
