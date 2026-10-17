import {
  Barlow_Condensed,
  DotGothic16,
  Nunito,
  Pixelify_Sans,
  Press_Start_2P,
  Silkscreen,
  VT323,
  Zen_Maru_Gothic,
} from "next/font/google";

/** Open-licence lookalikes — never ship proprietary game fonts. */
export const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

export const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixelify",
  display: "swap",
});

export const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

export const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
  display: "swap",
});

export const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
});

/** 3DS-era rounded gothic */
export const zenMaru = Zen_Maru_Gothic({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-zenmaru",
  display: "swap",
});

/** Switch / SwSh sporty condensed headings */
export const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

/** Switch body / modern UI */
export const nunito = Nunito({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const fontVariables = [
  pressStart.variable,
  pixelify.variable,
  vt323.variable,
  silkscreen.variable,
  dotGothic.variable,
  zenMaru.variable,
  barlowCondensed.variable,
  nunito.variable,
].join(" ");
