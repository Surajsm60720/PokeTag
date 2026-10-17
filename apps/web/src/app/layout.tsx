import type { Metadata } from "next";
import { PokeBallMark } from "@/components/PixelMark";
import { StartMenu } from "@/components/StartMenu";
import { fontVariables } from "./fonts";
import "../styles/themes.css";
import "./globals.css";
import "../styles/scenes.css";

export const metadata: Metadata = {
  title: "PokéTag",
  description:
    "Personal Pokémon save vault — fan project, not affiliated with Nintendo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicMode = process.env.PUBLIC_MODE === "true";

  return (
    <html
      lang="en"
      className={fontVariables}
      data-theme="firered"
      data-era="gen3"
      data-platform="gba"
      data-public-mode={publicMode ? "true" : "false"}
    >
      <body>
        <div className="world">
          <div className="world__sky" aria-hidden />
          <div className="world__horizon" aria-hidden />
          <div className="world__motif" aria-hidden />
          <div className="world__ground" aria-hidden />
          <div className="world__flora" aria-hidden />
          <div className="world__weather" aria-hidden />
          <div className="world__ambient" aria-hidden />
          <div className="world__scanlines" aria-hidden />

          <div className="app-shell">
            <header className="brand-bar">
              <div className="brand-lockup">
                <PokeBallMark size={64} />
                <div>
                  <h1 className="site-title">
                    Poké<span>Tag</span>
                  </h1>
                  <p className="brand-tagline brand-tagline--under">
                    Your saves. Your shelf. Resume anywhere.
                  </p>
                </div>
              </div>
            </header>

            <div className="app-main dual-screen">{children}</div>

            <aside className="app-side dual-screen__tools">
              <StartMenu />
            </aside>
          </div>
        </div>
      </body>
    </html>
  );
}
