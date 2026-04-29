import { supabaseAdmin } from "@/lib/supabase";

interface SystemNotificationInput {
  user_id: string;
  title: string;
  body: string;
  type?: string;
  reference_id?: string | null;
}

// Best-effort writer: notification delivery must not break core workflows.
export async function createSystemNotification(input: SystemNotificationInput): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: input.user_id,
      title: input.title,
      body: input.body,
      type: input.type ?? "system",
      reference_id: input.reference_id ?? null,
      is_read: false,
    });

  if (error) {
    console.warn("Failed to create in-app notification:", error.message);
  }
}
