import { Request, Response } from "express";
import { supabase } from "../lib/supabase";

/**
 * Toggle save / unsave business
 */
export const toggleSavedBusiness = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const { businessId } = req.body;

    if (!user?.id || !businessId) {
      return res.status(400).json({ error: "Missing user or businessId" });
    }

    // Check if already saved
    const { data: existing, error: fetchError } = await supabase
      .from("saved_businesses")
      .select("*")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    // If exists → UNSAVE
    if (existing) {
      const { error: deleteError } = await supabase
        .from("saved_businesses")
        .delete()
        .eq("user_id", user.id)
        .eq("business_id", businessId);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.json({ saved: false });
    }

    // If not exists → SAVE
    const { error: insertError } = await supabase
      .from("saved_businesses")
      .insert({
        user_id: user.id,
        business_id: businessId,
      } as any);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.json({ saved: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all saved businesses for current user
 */
export const getSavedBusinesses = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    const { data, error } = await supabase
      .from("saved_businesses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
};