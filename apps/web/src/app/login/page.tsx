import { PokeBallMark } from "@/components/PixelMark";
import { LoginForm } from "@/components/LoginForm";
import { isAuthConfigured } from "@/lib/auth/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";
  const configured = isAuthConfigured();

  return (
    <main className="login-gate">
      <div className="login-gate__panel pixel-panel">
        <div className="login-gate__brand">
          <PokeBallMark size={56} />
          <div>
            <h1 className="site-title">
              Poké<span>Tag</span>
            </h1>
            <p className="brand-tagline">Private save vault</p>
          </div>
        </div>

        <div className="dialog-box login-gate__dialog">
          <div className="dialog-name">GATE</div>
          <p className="dialog-text">
            {configured
              ? "Only the trainer who owns this shelf may enter."
              : "Auth env vars are missing. Set AUTH_USERNAME, AUTH_PASSWORD_HASH, and AUTH_SESSION_SECRET."}
          </p>
        </div>

        {configured ? (
          <LoginForm nextPath={nextPath} />
        ) : (
          <p className="login-gate__error">Vault lock is not armed.</p>
        )}

        <p className="login-gate__foot">
          Fan project. Not affiliated with Nintendo, Game Freak, or The Pokémon
          Company.
        </p>
      </div>
    </main>
  );
}
