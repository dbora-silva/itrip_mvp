import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

function getDisplayName(userMetadata: unknown): string | undefined {
  if (
    typeof userMetadata === "object" &&
    userMetadata !== null &&
    "name" in userMetadata &&
    typeof (userMetadata as { name: unknown }).name === "string"
  ) {
    return (userMetadata as { name: string }).name;
  }
  return undefined;
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const displayName = getDisplayName(claims?.user_metadata) ?? claims?.email ?? "";

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-foreground">Olá, {displayName}</h1>
      <p className="text-muted-foreground">
        Esta é uma página privada mínima — ela existe para comprovar que a proteção de rota
        funciona. O dashboard completo chega na Fase 6.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sair
        </Button>
      </form>
    </main>
  );
}
