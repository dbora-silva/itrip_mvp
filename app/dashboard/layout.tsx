import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginRedirectUrl } from "@/lib/auth/redirect";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

/**
 * Second layer of protection for the private area, independent of proxy.ts. Next.js
 * itself warns that Server Functions are not separately gated by the proxy's matcher,
 * so anything actually private must re-check here (or in the Server Action it calls)
 * rather than assume the proxy already handled it.
 *
 * Also the one shared shell (nav + the single <main>) for every /dashboard/** route —
 * individual pages (including not-found.tsx) render their own content only, never
 * another <main> or nav of their own.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(buildLoginRedirectUrl("/dashboard"));
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-foreground">
            iTrip
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
