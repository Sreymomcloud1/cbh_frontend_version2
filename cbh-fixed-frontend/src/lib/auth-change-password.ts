import { supabase } from "@/lib/supabase";

/**
 * Verifies current password via sign-in, then updates password.
 * Requires a populated session with email (same flow as dashboards).
 */
export async function verifyCurrentPasswordAndSetNew(currentRaw: string, newRaw: string): Promise<void> {
  const current = currentRaw.trim();
  const next = newRaw.trim();

  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;

  const email = session?.user?.email?.trim();
  if (!email) throw new Error("Session expired. Please sign in again.");

  const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });

  if (signErr) {
    const m = signErr.message.toLowerCase();
    if (m.includes("invalid") || m.includes("incorrect") || m.includes("credential")) {
      throw new Error("Current password is incorrect.");
    }
    throw new Error(signErr.message);
  }
  if (!signData.session) {
    throw new Error("Could not verify your password. Please try again.");
  }

  /** Let auth client settle after credential check (reduces flaky updateUser hangs). */
  await supabase.auth.getSession();

  const { error: updErr } = await supabase.auth.updateUser({ password: next });
  if (updErr) throw new Error(updErr.message ?? "Could not save the new password.");
}
