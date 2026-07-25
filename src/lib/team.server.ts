type RoleCheckClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Admin check scoped to a specific workspace. Uses the security-definer
 * `has_role(user, org, role)` function so a stale admin row in *another* org
 * can never authorise a mutation here.
 */
export async function assertAdmin(
  supabase: RoleCheckClient,
  userId: string,
  orgId: string,
) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Admins only");
}
