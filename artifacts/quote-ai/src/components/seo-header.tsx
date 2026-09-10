import { StrictMode } from "react";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";

function SeoHeaderInner() {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;
  const scrolled = useScrolled(20);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "navbar-glass" : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center">
          <Logo />
        </a>
        <nav className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
              <a
                href="/sign-in/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
              >
                Accedi
              </a>
              <a
                href="/sign-up/"
                className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold"
              >
                Registrati
              </a>
            </>
          ) : (
            <a
              href="/dashboard"
              className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold"
            >
              Dashboard →
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SeoNavShell() {
  return (
    <StrictMode>
      <SeoHeaderInner />
    </StrictMode>
  );
}
