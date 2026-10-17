/**
 * Original pixel badge art inspired by gym / trial themes.
 * Not ripped game sprites — each mark is drawn for PokéTag.
 */
import { pixelDataUri } from "./pixel";

type Grid = string[];
type Pal = Record<string, string>;

function uri(rows: Grid, palette: Pal, scale = 3): string {
  return pixelDataUri(rows, palette, scale);
}

/* Shared outline helpers — 16×16 frames */
const P = {
  ink: { O: "#1a1a22", K: "#0e0e14" },
};

/** Boulder / Stone / Rock — rough hex rock */
const ROCK: Grid = [
  "................",
  "......OOOO......",
  "....OOKKKKOO....",
  "...OKMMMMMMKO...",
  "..OKMHHHMMHMKO..",
  ".OKMHHHHMMHHMKO.",
  ".OKMHHMMMMHHMKO.",
  "OKMMHHMMKMHHMMKO",
  "OKMMHHMKKMHHMMKO",
  ".OKMHHMMMMHHMKO.",
  ".OKMMHHHHHHMMKO.",
  "..OKMMMMMMMMKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
];

/** Cascade / Water — droplet */
const DROP: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKHHKO.....",
  "....OKHHHHKO....",
  "...OKHHHHHHKO...",
  "..OKHHHHHHHHKO..",
  ".OKHHHHWWHHHHKO.",
  ".OKHHHHWWHHHHKO.",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "....OKHHHHKO....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
];

/** Thunder / Bolt / Dynamo / Electric / Voltage — bolt */
const BOLT: Grid = [
  "................",
  "....OOOOOO......",
  "...OKHHHHKO.....",
  "...OKHHHHHKO....",
  "....OKHHHHHKO...",
  ".....OKKHHHKO...",
  "...OOOOOHHHKO...",
  "..OKHHHHHHKKO...",
  "..OKHHHHKOO.....",
  "..OKHHHKO.......",
  "...OKHHHKO......",
  "....OKHHHKO.....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
  "................",
];

/** Rainbow — arc stripes */
const RAINBOW: Grid = [
  "................",
  "....OOOOOOOO....",
  "...OKRRRROOGO...",
  "..OKRRRROOYGGO..",
  ".OKRRRROOYYGGBO.",
  ".OKRRROOYYYGBBO.",
  "OKRROOYYYYGBBBOK",
  "OKRO......GBBOK.",
  "OKO........BBOK.",
  ".O..........OK..",
  "................",
  "...OOOOOOOOOO...",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
];

/** Soul / Ghost — spirit orb with eyes */
const SOUL: Grid = [
  "................",
  "......OOOO......",
  "....OOKKKKOO....",
  "...OKMMMMMMKO...",
  "..OKMHHHHHHMKO..",
  ".OKMHHOOHHOHMKO.",
  ".OKMHKOOKKOHMKO.",
  ".OKMHHHHHHHHMKO.",
  ".OKMMHHHHHHMMKO.",
  "..OKMMMMMMMMKO..",
  "...OKMKKKKMKO...",
  "....OK....KO....",
  "....OKO..OKO....",
  ".....OO..OO.....",
  "................",
  "................",
];

/** Marsh / Fen — swamp reeds */
const MARSH: Grid = [
  "................",
  "..O..O....O..O..",
  ".OKO.OKO.OKO.OK.",
  ".OKO.OKO.OKO.OK.",
  "..O...O...O..O..",
  "................",
  "...OOOOOOOOOO...",
  "..OKGGGGGGGGKO..",
  ".OKGGMMGGMMGGKO.",
  "OKGGMMMMMMMMGGKO",
  "OKGMMMMMMMMMMGKO",
  ".OKMMMMMMMMMMKO.",
  "..OKKKKKKKKKKO..",
  "...OOOOOOOOOO...",
  "................",
  "................",
];

/** Volcano / Heat / Fire — flame peak */
const FLAME: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKHHKO.....",
  "....OKHHHHKO....",
  "...OKHHYYHHKO...",
  "..OKHHYYYYHHKO..",
  ".OKHHYYWWYYHHKO.",
  ".OKHYYYWWYYYHKO.",
  ".OKHYYYYYYYYHKO.",
  "..OKHYYYYYYHKO..",
  "...OKHYYYYHKO...",
  "....OKHHHHKO....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
];

/** Earth / Ground / Quake — layered earth */
const EARTH: Grid = [
  "................",
  "...OOOOOOOOOO...",
  "..OKHHHHHHHHKO..",
  ".OKHHHHHHHHHHKO.",
  "OKHHHHKKKKHHHHKO",
  "OKHHKKMMMMKKHHKO",
  "OKKKMMMMMMMMKKKO",
  "OKMMMMWWWWMMMMKO",
  "OKMMMMWWWWMMMMKO",
  "OKKKMMMMMMMMKKKO",
  "OKHHKKMMMMKKHHKO",
  "OKHHHHKKKKHHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKKKKKKKKKKO..",
  "...OOOOOOOOOO...",
  "................",
];

/** Knuckle / Fighting — fist */
const FIST: Grid = [
  "................",
  "...OO..OO..OO...",
  "..OKKOOKKOOKKO..",
  "..OKHKKKHKKKHKO.",
  ".OKHHHHHHHHHHKO.",
  "OKHHHHHHHHHHHHKO",
  "OKHHHHOOOOHHHHKO",
  "OKHHHOKKKKOHHHKO",
  "OKHHHHHHHHHHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "....OKHHHHKO....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
];

/** Balance — yin scales */
const BALANCE: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKHHKO.....",
  "OOOOOKHHHHKOOOOO",
  "OKKKOKHHHHKOKKKO",
  "OKHHOKHHHHKOHHKO",
  "OKHHOKKKKKKOHHKO",
  "OKHH........HHKO",
  "OKHH........HHKO",
  "OKHHHH....HHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
];

/** Feather / Flying / Jet / Zephyr — feather */
const FEATHER: Grid = [
  "................",
  "...........OO...",
  "..........OKKO..",
  ".........OKHHKO.",
  "........OKHHHKO.",
  ".......OKHHHHKO.",
  "......OKHHHHKO..",
  ".....OKHHHHKO...",
  "....OKHHHHKO....",
  "...OKHHHHKO.....",
  "..OKHHHHKO......",
  ".OKHHHHKO.......",
  "OKHHHHKO........",
  "OKKKKKO.........",
  ".OOOOO..........",
  "................",
];

/** Mind / Psychic — eye */
const MIND: Grid = [
  "................",
  "....OOOOOOOO....",
  "...OKKKKKKKKO...",
  "..OKWWWWWWWWKO..",
  ".OKWWMMMMMMWWKO.",
  "OKWWMMHHHHMMWWKO",
  "OKWMMHHKKHHMMWKO",
  "OKWMMHHKKHHMMWKO",
  "OKWWMMHHHHMMWWKO",
  ".OKWWMMMMMMWWKO.",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "......OKKO......",
  ".......OO.......",
  "................",
];

/** Rain — cloud + drops */
const RAIN: Grid = [
  "................",
  "....OOOOOO......",
  "...OKKKKKKO.....",
  "..OKWWWWWWKO....",
  ".OKWWWWWWWWKOO..",
  "OKWWWWWWWWWWKKO.",
  "OKWWWWWWWWWWWWKO",
  ".OKKKKKKKKKKKKO.",
  "..OOOOOOOOOOOO..",
  "...O..O..O..O...",
  "..OKO.OKO.OKO...",
  "...O...O...O....",
  "................",
  "................",
  "................",
  "................",
];

/** Coal — chunk of coal */
const COAL: Grid = [
  "................",
  ".....OOOOOO.....",
  "....OKKKKKKO....",
  "...OKMMMMMMKO...",
  "..OKMHHMMMMMKO..",
  ".OKMMHHMMMMMMKO.",
  "OKMMMMMMMMMMMMKO",
  "OKMMMMMKMMMMMMKO",
  "OKMMMMMMMMMMMMKO",
  ".OKMMMMMMMMMMKO.",
  "..OKMMMMMMMMKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
  "................",
];

/** Forest / Plant / Grass / Hive — leaf cluster */
const LEAF: Grid = [
  "................",
  "........OO......",
  ".......OKKO.....",
  "......OKHHKO....",
  ".....OKHHHHKO...",
  "....OKHHHHHHKO..",
  "...OKHHHHHHHHKO.",
  "..OKHHHHHHKKHKO.",
  ".OKHHHHHHKO.OKO.",
  "OKHHHHHHKO...O..",
  "OKHHHHHKO.......",
  ".OKHHHKO........",
  "..OKHKO.........",
  "...OKO..........",
  "....O...........",
  "................",
];

/** Cobble — brick */
const COBBLE: Grid = [
  "................",
  "..OOOOOOOOOOOO..",
  ".OKHHHHHHHHHHKO.",
  "OKHHHHHHHHHHHHKO",
  "OKHHKKKKKKKKHHKO",
  "OKHHHHHHHHHHHHKO",
  "OKKKKKHHHHKKKKKO",
  "OKHHHHHHHHHHHHKO",
  "OKHHHHKKKKKKHHKO",
  "OKHHHHHHHHHHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKKKKKKKKKKO..",
  "...OOOOOOOOOO...",
  "................",
  "................",
  "................",
];

/** Relic — ancient tablet */
const RELIC: Grid = [
  "................",
  "...OOOOOOOOOO...",
  "..OKWWWWWWWWKO..",
  ".OKWYYWYYWYYWKO.",
  "OKWYYYYYYYYYYWKO",
  "OKWYYOOOOOYYYWKO",
  "OKWYYOKKKOYYYWKO",
  "OKWYYOKKKOYYYWKO",
  "OKWYYOOOOOYYYWKO",
  "OKWYYYYYYYYYYWKO",
  ".OKWYYWYYWYYWKO.",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
];

/** Mine — pickaxe gem */
const MINE: Grid = [
  "................",
  "OO..........OO..",
  "OKO........OKO..",
  ".OKO......OKO...",
  "..OKOOOOOOKO....",
  "...OKHHHHKO.....",
  "....OKHHKO......",
  ".....OKKO.......",
  "......OKO.......",
  "......OKO.......",
  "......OKO.......",
  "......OKO.......",
  ".....OKKKO......",
  "....OOOOOO......",
  "................",
  "................",
];

/** Icicle / Ice / Iceberg / Glacier / Freeze — crystal */
const ICE: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKWWKO.....",
  "....OKWWWWKO....",
  "...OKWWHHWWKO...",
  "..OKWWHHHHWWKO..",
  ".OKWWHHHHHHWWKO.",
  ".OKWWHHHHHHWWKO.",
  "..OKWWHHHHWWKO..",
  "...OKWWHHWWKO...",
  "....OKWWWWKO....",
  ".....OKWWKO.....",
  "......OKKO......",
  ".......OO.......",
  "................",
];

/** Beacon / Rising — lighthouse beam */
const BEACON: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKYYKO.....",
  "....OKYYYYKO....",
  "...OOOOOOOOOO...",
  "..OKWWWWWWWWKO..",
  ".OKWWYYYYYYWWKO.",
  ".OKWWYYYYYYWWKO.",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OKMMMMKO....",
  "....OKMMMMKO....",
  "...OKMMMMMMKO...",
  "...OOOOOOOOOO...",
  "................",
];

/** Fog — mist rings */
const FOG: Grid = [
  "................",
  "..OOOO....OOOO..",
  ".OKWWKO..OKWWKO.",
  "OKWWWWKOOQWWWWKO",
  "OKWWWWWWWWWWWWKO",
  ".OKWWWWWWWWWWKO.",
  "..OKWWWWWWWWKO..",
  "...OKWWWWWWKO...",
  "..OKWWWWWWWWKO..",
  ".OKWWWWWWWWWWKO.",
  "OKWWWWKOOQWWWWKO",
  ".OKWWKO..OKWWKO.",
  "..OOOO....OOOO..",
  "................",
  "................",
  "................",
];

/** Storm — cloud bolt */
const STORM: Grid = [
  "................",
  "...OOOOOOOO.....",
  "..OKKKKKKKKO....",
  ".OKWWWWWWWWKO...",
  "OKWWWWWWWWWWKOO.",
  "OKWWWWWWWWWWWKKO",
  ".OKKKKKKYKKKKKKO",
  "..OOOOOKYYKOOOO.",
  "......OKYYKO....",
  ".....OKYYYYKO...",
  "....OKYYYYYKO...",
  ".....OKYYKOO....",
  "......OKKO......",
  ".......OO.......",
  "................",
  "................",
];

/** Mineral — crystal cluster */
const MINERAL: Grid = [
  "................",
  "....OO....OO....",
  "...OKKO..OKKO...",
  "..OKHHKOOKHHKO..",
  ".OKHHHHKKHHHHKO.",
  "OKHHHHHHHHHHHHKO",
  "OKHHHHOOOOHHHHKO",
  "OKHHHOKKKKOHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "....OKHHHHKO....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
  "................",
];

/** Plain — open field sun */
const PLAIN: Grid = [
  "................",
  ".......OO.......",
  "...O..OKKO..O...",
  "..OKOOKHHKOOKO..",
  "...OOKHHHHKOO...",
  "...OKHHHHHHKO...",
  "..OKHHHHHHHHKO..",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "...OOKHHHHKOO...",
  "..OKOOKHHKOOKO..",
  "...O..OKKO..O...",
  ".......OO.......",
  "................",
  "................",
];

/** Insect / Bug — beetle */
const BUG: Grid = [
  "................",
  "..O..........O..",
  ".OKO...OO...OKO.",
  "..O...OKKO...O..",
  ".....OKHHKO.....",
  "....OKHHHHKO....",
  "...OKHHHHHHKO...",
  "..OKHHKKKKHHKO..",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "....OKHHHHKO....",
  ".....OKKKKO.....",
  "....OKO..OKO....",
  "...OKO....OKO...",
  "................",
  "................",
];

/** Cliff / Rumble — mountain */
const CLIFF: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKHHKO.....",
  "....OKHHHHKO....",
  "...OKHHHHHHKO...",
  "..OKHHKKKKHHKO..",
  ".OKHHHHHHHHHHKO.",
  "OKHHHHHHHHHHHHKO",
  "OKHHKKKKKKKKHHKO",
  "OKHHHHHHHHHHHHKO",
  ".OKKKKKKKKKKKKO.",
  "..OOOOOOOOOOOO..",
  "................",
  "................",
  "................",
];

/** Fairy — star flower */
const FAIRY: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  "..OO..OKKO..OO..",
  ".OKKOOKHHKOOKKO.",
  "..OOKHHHHHHKOO..",
  "...OKHHHHHHKO...",
  "OOOKHHHHHHHHKOOO",
  "OKKHHHHWWHHHHKKO",
  "OOOKHHHHHHHHKOOO",
  "...OKHHHHHHKO...",
  "..OOKHHHHHHKOO..",
  ".OKKOOKHHKOOKKO.",
  "..OO..OKKO..OO..",
  "......OKKO......",
  ".......OO.......",
];

/** Dark — crescent */
const DARK: Grid = [
  "................",
  ".....OOOOOO.....",
  "....OKKKKKKO....",
  "...OKMMMMMMKO...",
  "..OKMM....MMKO..",
  ".OKMM......MKO..",
  "OKMM.......MKO..",
  "OKM........MKO..",
  "OKM........MKO..",
  "OKMM.......MKO..",
  ".OKMM......MKO..",
  "..OKMM....MMKO..",
  "...OKMMMMMMKO...",
  "....OKKKKKKO....",
  ".....OOOOOO.....",
  "................",
];

/** Dragon — fang diamond */
const DRAGON: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  ".....OKHHKO.....",
  "....OKHHHHKO....",
  "...OKHHYYHHKO...",
  "..OKHHYYYYHHKO..",
  ".OKHHYYKKYYHHKO.",
  ".OKHHYYKKYYHHKO.",
  "..OKHHYYYYHHKO..",
  "...OKHHYYHHKO...",
  "....OKHHHHKO....",
  ".....OKHHKO.....",
  "......OKKO......",
  ".......OO.......",
  "................",
];

/** Normal — oval seal */
const NORMAL: Grid = [
  "................",
  "....OOOOOOOO....",
  "...OKKKKKKKKO...",
  "..OKWWWWWWWWKO..",
  ".OKWWMMMMMMWWKO.",
  "OKWWMMMMMMMMWWKO",
  "OKWMMMMMMMMMMWKO",
  "OKWMMMMMMMMMMWKO",
  "OKWWMMMMMMMMWWKO",
  ".OKWWMMMMMMWWKO.",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
  "................",
];

/** Trio — three marks */
const TRIO: Grid = [
  "................",
  "..OO....OO..OO..",
  ".OKKO..OKKOOKKO.",
  "OKHHKOOKHHKKHHKO",
  "OKHHKOOKHHKKHHKO",
  ".OKKO..OKKOOKKO.",
  "..OO....OO..OO..",
  "................",
  "....OOOOOOOO....",
  "...OKKKKKKKKO...",
  "..OKWWWWWWWWKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
  "................",
];

/** Basic — simple shield */
const BASIC: Grid = [
  "................",
  "...OOOOOOOOOO...",
  "..OKKKKKKKKKKO..",
  ".OKWWWWWWWWWWKO.",
  "OKWWHHHHHHHHWWKO",
  "OKWHHHHHHHHHHWKO",
  "OKWHHHHHHHHHHWKO",
  "OKWHHHHHHHHHHWKO",
  "OKWWHHHHHHHHWWKO",
  ".OKWWHHHHHHWWKO.",
  "..OKWWWWWWWWKO..",
  "...OKWWWWWWKO...",
  "....OKWWWWKO....",
  ".....OKKKKO.....",
  "......OOOO......",
  "................",
];

/** Legend — crowned mark */
const LEGEND: Grid = [
  "................",
  ".O...O....O...O.",
  "OKO.OKO..OKO.OKO",
  "OKKOOKKOOQKKOOKO",
  ".OKKKKKKKKKKKKO.",
  "..OKHHHHHHHHKO..",
  ".OKHHHHHHHHHHKO.",
  "OKHHHHWWWWHHHHKO",
  "OKHHHHWWWWHHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKKKKKKKKO...",
  "....OOOOOOOO....",
  "................",
  "................",
  "................",
];

/** Toxic — skull drip */
const TOXIC: Grid = [
  "................",
  "....OOOOOOOO....",
  "...OKKKKKKKKO...",
  "..OKWWWWWWWWKO..",
  ".OKWWOOWWOOWWKO.",
  "OKWWKKWWKKWWWWKO",
  "OKWWWWWWWWWWWWKO",
  ".OKWWWOOOOWWWKO.",
  "..OKWWOKKOWWKO..",
  "...OKWWWWWWKO...",
  "....OKWWWWKO....",
  ".....OKKKKO.....",
  "....OKO..OKO....",
  "...OKO....OKO...",
  "................",
  "................",
];

/** Wave — water wave */
const WAVE: Grid = [
  "................",
  "................",
  "..OOOO....OOOO..",
  ".OKHHKO..OKHHKO.",
  "OKHHHHKOOQHHHHKO",
  "OKHHHHHHHHHHHHKO",
  ".OKHHHHHHHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OOOOOOOOOO...",
  "..OKWWWWWWWWKO..",
  ".OKWWWWWWWWWWKO.",
  "OKWWWWWWWWWWWWKO",
  ".OKKKKKKKKKKKKO.",
  "..OOOOOOOOOOOO..",
  "................",
  "................",
];

/** Hisui star rank */
const STAR: Grid = [
  "................",
  ".......OO.......",
  "......OKKO......",
  "......OKKO......",
  "..OOOOOKKOOOOO..",
  ".OKHHHHKKHHHHKO.",
  "..OKHHHHHHHHKO..",
  "...OKHHHHHHKO...",
  "....OKHHHHKO....",
  "...OKHHKKHHKO...",
  "..OKHHKOOQHHKO..",
  ".OKHHKO....OKHKO",
  "OKHHKO......OKHK",
  ".OKKO........OKO",
  "..OO..........OO",
  "................",
];

function palRock(): Pal {
  return { ...P.ink, M: "#8a7a58", H: "#c8b890", W: "#e8dcc0" };
}
function palWater(): Pal {
  return { ...P.ink, H: "#58a8f0", W: "#c8e8ff", Y: "#88c8f8", G: "#3890d0", B: "#2060a8", M: "#3070b0", Q: "#58a8f0" };
}
function palBolt(): Pal {
  return { ...P.ink, H: "#f0d040", Y: "#fff060", W: "#fff8c0" };
}
function palFire(): Pal {
  return { ...P.ink, H: "#f07030", Y: "#f8b040", W: "#ffe080" };
}
function palGrass(): Pal {
  return { ...P.ink, H: "#58c050", G: "#78d868", M: "#389030", W: "#b0f090", K: "#0e0e14", O: "#1a1a22" };
}
function palGhost(): Pal {
  return { ...P.ink, M: "#7868a8", H: "#b098d8", W: "#e8d8ff" };
}
function palFight(): Pal {
  return { ...P.ink, H: "#e07058", M: "#a04030", W: "#f0b0a0" };
}
function palPsychic(): Pal {
  return { ...P.ink, M: "#e06898", H: "#f0a0c0", W: "#ffe0f0", K: "#0e0e14", O: "#1a1a22" };
}
function palIce(): Pal {
  return { ...P.ink, W: "#e0f8ff", H: "#80d0f0", M: "#40a0c8" };
}
function palFairy(): Pal {
  return { ...P.ink, H: "#f0a0c8", W: "#ffe0f0", M: "#d070a0" };
}
function palDark(): Pal {
  return { ...P.ink, M: "#484058", H: "#706888", W: "#a098b0" };
}
function palDragon(): Pal {
  return { ...P.ink, H: "#8070e0", Y: "#b0a0ff", W: "#e0d8ff", K: "#0e0e14", O: "#1a1a22" };
}
function palSteel(): Pal {
  return { ...P.ink, M: "#8890a0", H: "#c0c8d8", W: "#e8eef8", Y: "#d0d8e8" };
}
function palNormal(): Pal {
  return { ...P.ink, M: "#a8a090", H: "#d0c8b8", W: "#f0ebe0" };
}
function palBug(): Pal {
  return { ...P.ink, H: "#a0c838", M: "#689020", W: "#d0f060", K: "#0e0e14", O: "#1a1a22" };
}
function palPoison(): Pal {
  return { ...P.ink, W: "#d8a0e8", K: "#0e0e14", O: "#1a1a22", M: "#8840a0", H: "#c070d8" };
}
function palStar(): Pal {
  return { ...P.ink, H: "#e8c050", K: "#0e0e14", O: "#1a1a22", W: "#fff0c0", Q: "#e8c050", M: "#c09030" };
}

const ART: Record<string, () => string> = {
  // Kanto
  boulder: () => uri(ROCK, palRock()),
  cascade: () => uri(DROP, palWater()),
  thunder: () => uri(BOLT, palBolt()),
  rainbow: () =>
    uri(RAINBOW, {
      ...P.ink,
      R: "#e05050",
      O: "#1a1a22",
      Y: "#e8c040",
      G: "#50b050",
      B: "#4080e0",
      W: "#f4efd8",
      K: "#0e0e14",
    }),
  soul: () => uri(SOUL, palGhost()),
  marsh: () => uri(MARSH, palGrass()),
  volcano: () => uri(FLAME, palFire()),
  earth: () => uri(EARTH, palRock()),
  // Hoenn
  stone: () => uri(ROCK, palRock()),
  knuckle: () => uri(FIST, palFight()),
  dynamo: () => uri(BOLT, palBolt()),
  heat: () => uri(FLAME, palFire()),
  balance: () =>
    uri(BALANCE, { ...P.ink, H: "#e8d070", M: "#a08030", W: "#fff0c0" }),
  feather: () => uri(FEATHER, { ...P.ink, H: "#70c8e0", W: "#e0f4ff", M: "#3890b0" }),
  mind: () => uri(MIND, palPsychic()),
  rain: () => uri(RAIN, palWater()),
  // Sinnoh
  coal: () => uri(COAL, { ...P.ink, M: "#3a3a42", H: "#686878", W: "#9898a8" }),
  forest: () => uri(LEAF, palGrass()),
  cobble: () => uri(COBBLE, palRock()),
  fen: () => uri(MARSH, { ...P.ink, G: "#58a878", M: "#307050", W: "#90d0b0" }),
  relic: () => uri(RELIC, { ...P.ink, Y: "#d0b060", W: "#f0e0b0" }),
  mine: () => uri(MINE, palSteel()),
  icicle: () => uri(ICE, palIce()),
  beacon: () =>
    uri(BEACON, { ...P.ink, Y: "#f0d050", W: "#fff8d0", M: "#8890a0", H: "#c0c8d8" }),
  // Johto
  zephyr: () => uri(FEATHER, { ...P.ink, H: "#90c0e8", W: "#e0f0ff", M: "#5080b0" }),
  hive: () => uri(BUG, palBug()),
  plain: () => uri(PLAIN, { ...P.ink, H: "#e8c868", W: "#fff0b0" }),
  fog: () =>
    uri(FOG, { ...P.ink, W: "#d0d8e0", Q: "#b0b8c8", K: "#0e0e14", O: "#1a1a22" }),
  storm: () =>
    uri(STORM, { ...P.ink, W: "#c0c8d8", Y: "#f0d040", K: "#0e0e14", O: "#1a1a22" }),
  mineral: () => uri(MINERAL, palSteel()),
  glacier: () => uri(ICE, palIce()),
  rising: () => uri(BEACON, { ...P.ink, Y: "#f0a040", W: "#ffe0b0", M: "#887060", H: "#c0a080" }),
  // Unova
  trio: () =>
    uri(TRIO, { ...P.ink, H: "#e04848", W: "#f4efd8", Q: "#e04848", K: "#0e0e14", O: "#1a1a22" }),
  basic: () => uri(BASIC, palNormal()),
  insect: () => uri(BUG, palBug()),
  bolt: () => uri(BOLT, palBolt()),
  quake: () => uri(EARTH, palRock()),
  jet: () => uri(FEATHER, { ...P.ink, H: "#70a8e0", W: "#d0e8ff", M: "#3060a0" }),
  freeze: () => uri(ICE, palIce()),
  legend: () =>
    uri(LEGEND, { ...P.ink, H: "#e0b040", W: "#fff0c0", Q: "#e0b040", K: "#0e0e14", O: "#1a1a22" }),
  toxic: () => uri(TOXIC, palPoison()),
  wave: () => uri(WAVE, palWater()),
  // Kalos / Paldea / Galar / Alola type stamps
  bug: () => uri(BUG, palBug()),
  cliff: () => uri(CLIFF, palRock()),
  rumble: () => uri(FIST, palFight()),
  plant: () => uri(LEAF, palGrass()),
  voltage: () => uri(BOLT, palBolt()),
  fairy: () => uri(FAIRY, palFairy()),
  psychic: () => uri(MIND, palPsychic()),
  iceberg: () => uri(ICE, palIce()),
  grass: () => uri(LEAF, palGrass()),
  water: () => uri(DROP, palWater()),
  fire: () => uri(FLAME, palFire()),
  fighting: () => uri(FIST, palFight()),
  rock: () => uri(ROCK, palRock()),
  ice: () => uri(ICE, palIce()),
  dark: () => uri(DARK, palDark()),
  electric: () => uri(BOLT, palBolt()),
  normal: () => uri(NORMAL, palNormal()),
  ghost: () => uri(SOUL, palGhost()),
  dragon: () => uri(DRAGON, palDragon()),
  // Hisui
  "first star": () => uri(STAR, palStar()),
  "second star": () => uri(STAR, palStar()),
  "third star": () => uri(STAR, palStar()),
  "fourth star": () => uri(STAR, palStar()),
  "fifth star": () => uri(STAR, palStar()),
  "sixth star": () => uri(STAR, palStar()),
  "seventh star": () => uri(STAR, palStar()),
  "eighth star": () => uri(STAR, palStar()),
};

const FALLBACK = () => uri(NORMAL, palSteel());

export function badgeArtUri(name: string): string {
  const key = name.trim().toLowerCase();
  const maker = ART[key] ?? FALLBACK;
  return maker();
}
