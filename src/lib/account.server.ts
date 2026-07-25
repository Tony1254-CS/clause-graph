import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUserOrg(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}