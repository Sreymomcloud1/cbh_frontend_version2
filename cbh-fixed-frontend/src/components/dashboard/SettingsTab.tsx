"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { updateProfile } from "@/lib/api";
import Button from "@/components/ui/Button";
import type { User } from "@/types";
import { Phone, Mail, User as UserIcon, Lock, CheckCircle, Camera, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

interface Props {
  user: User;
  onUpdate?: (updates: { name?: string; avatarUrl?: string }) => void;
  onLogout: () => void;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsTab({ user, onUpdate, onLogout }: Props) {
  const [name,     setName]     = useState(user.name);
  const [email,    setEmail]    = useState(user.email);
  const [phone, setPhone] = useState((user as any).phone ?? "");
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileMsg,     setProfileMsg]     = useState("");
  const [profileError,   setProfileError]   = useState("");
  
  const [avatarPreview, setAvatarPreview] = useState<string>(
    (user as any).avatar_url ?? user.avatar ?? ""
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurr,  setShowCurr]  = useState(false);
  const [showNew,   setShowNew]   = useState(false);
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState("");
  const [pwError,   setPwError]   = useState("");

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { setProfileError("Only JPEG, PNG, WEBP or GIF images allowed."); return; }
    if (file.size > 5 * 1024 * 1024)  { setProfileError("Image must be under 5 MB."); return; }

    // Show local preview immediately so UI feels instant
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarUploading(true);
    setProfileError("");
    setProfileMsg("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${session.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      // Add cache-busting so browser shows new image immediately
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      await updateProfile({ avatar_url: freshUrl });
      setAvatarPreview(freshUrl);
      setProfileMsg("Profile photo updated.");

      // Tell navbar to update immediately — no refresh needed
      onUpdate?.({ avatarUrl: freshUrl });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Photo upload failed.");
      setAvatarPreview(user.avatar ?? "");
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileMsg(""); setProfileError("");
    if (!name.trim()) { setProfileError("Name cannot be empty."); return; }
    setProfileSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null });

      if (email.trim() !== user.email) {
        const { error } = await supabase.auth.updateUser({ email: email.trim() });
        if (error) throw error;
        setProfileMsg("Profile saved. Check your new email for a confirmation link.");
      } else {
        setProfileMsg("Profile saved successfully.");
      }
      // Update navbar name immediately
      onUpdate?.({ name: name.trim() });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwMsg(""); setPwError("");
    if (!currentPw) { setPwError("Enter your current password."); return; }
    if (!newPw)     { setPwError("Enter a new password."); return; }

    // Strong password check
    const errs: string[] = [];
    if (newPw.length < 8)             errs.push("at least 8 characters");
    if (!/[A-Z]/.test(newPw))         errs.push("one uppercase letter");
    if (!/[0-9]/.test(newPw))         errs.push("one number");
    if (!/[^A-Za-z0-9]/.test(newPw))  errs.push("one special character");
    if (errs.length > 0) { setPwError(`Password needs: ${errs.join(", ")}.`); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }

    setPwSaving(true);
    try {
      // Step 1: verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email, password: currentPw,
      });
      if (signInErr) { setPwError("Current password is incorrect."); return; }

      // Step 2: update
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;

      setPwMsg("Password changed successfully. Use the new password next time you log in.");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="font-display text-2xl text-ink">Settings</h2>

      {/* ── Profile card ── */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Profile Information</h3>

        {profileMsg && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{profileMsg}</span>
          </div>
        )}
        {profileError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{profileError}</span>
          </div>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-600 flex items-center justify-center text-white font-bold text-xl border-2 border-surface-200">
              {avatarPreview
                ? <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                : <span>{user.name[0]?.toUpperCase()}</span>
              }
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shadow transition-colors disabled:opacity-50"
              title="Change photo">
              {avatarUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Profile Photo</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
              className="text-xs text-brand-600 hover:underline mt-0.5 disabled:opacity-50">
              {avatarUploading ? "Uploading…" : "Change photo"}
            </button>
            <p className="text-xs text-ink-faint mt-0.5">JPG, PNG up to 5 MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Fields */}
        <FieldRow label="Full Name">
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </FieldRow>

        <FieldRow label="Email Address">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <p className="text-xs text-ink-faint mt-1">Changing email sends a confirmation to the new address.</p>
        </FieldRow>

        <FieldRow label="Phone Number (optional)">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+855 12 000 000"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <p className="text-xs text-ink-faint mt-1">Visible to businesses you contact.</p>
        </FieldRow>

        <div className="pt-1">
          <p className="text-xs text-ink-faint mb-3">
            Role: <span className="font-medium text-ink capitalize">{user.role}</span>
            {" · "}Reward points: <span className="font-medium text-ink">{user.rewardPoints}</span>
          </p>
          <button onClick={handleSaveProfile} disabled={profileSaving}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {profileSaving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* ── Password card ── */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Change Password</h3>

        {pwMsg && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{pwMsg}</span>
          </div>
        )}
        {pwError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{pwError}</span>
          </div>
        )}

        {[
          { label: "Current Password", val: currentPw, set: setCurrentPw, show: showCurr, toggle: () => setShowCurr(p => !p), ph: "Enter current password" },
          { label: "New Password",     val: newPw,     set: setNewPw,     show: showNew,  toggle: () => setShowNew(p => !p),  ph: "Min. 8 chars, uppercase, number, symbol" },
          { label: "Confirm New Password", val: confirmPw, set: setConfirmPw, show: showNew, toggle: () => setShowNew(p => !p), ph: "Repeat new password" },
        ].map(field => (
          <FieldRow key={field.label} label={field.label}>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input type={field.show ? "text" : "password"} value={field.val}
                onChange={e => field.set(e.target.value)} placeholder={field.ph}
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button type="button" onClick={field.toggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FieldRow>
        ))}

        {/* Password strength hints */}
        {newPw.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: "8+ characters",    ok: newPw.length >= 8 },
              { label: "Uppercase letter", ok: /[A-Z]/.test(newPw) },
              { label: "Number",           ok: /[0-9]/.test(newPw) },
              { label: "Special char",     ok: /[^A-Za-z0-9]/.test(newPw) },
            ].map(r => (
              <p key={r.label} className={`text-xs flex items-center gap-1 ${r.ok ? "text-brand-600" : "text-ink-faint"}`}>
                {r.ok ? "✓" : "○"} {r.label}
              </p>
            ))}
          </div>
        )}

        <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw || !confirmPw}
          className="flex items-center gap-2 bg-surface-100 hover:bg-surface-200 disabled:opacity-50 text-ink font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors border border-surface-200">
          {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {pwSaving ? "Changing password…" : "Change Password"}
        </button>
      </div>

      {/* ── Account ── */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
        <h3 className="font-semibold text-ink text-sm mb-3">Account</h3>
        <Button variant="danger" size="sm" onClick={onLogout}>Log Out</Button>
      </div>
    </div>
  );
}
