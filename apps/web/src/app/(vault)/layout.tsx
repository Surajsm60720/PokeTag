import { PokeBallMark } from "@/components/PixelMark";
import { StartMenu } from "@/components/StartMenu";

export default function VaultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
  );
}
