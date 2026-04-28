"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateProfile, updateBusiness } from "@/lib/api";
import { notifyBusinessDataChanged } from "@/lib/data-events";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Supplier } from "@/types";
import { Phone, Mail, Lock, CheckCircle, Bell } from "lucide-react";

interface Props {
  biz: Supplier;
  onLogout: () => void;
}

export default function BusinessSettingsTab({ biz, onLogout }: Props) {
  const [email, setEmail] = useState(biz.contactEmail);
  const [phone, setPhone] = useState(biz.contactPhone);
  // Replace your existing state declarations with these:
  const [notifyEmail, setNotifyEmail] = useState(
    (biz as any).notifyByEmail !== false
  );
  const [notifyPhone, setNotifyPhone] = useState(
    Boolean((biz as any).notifyByPhone)
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  const handleSaveProfile = async () => {
    setProfileMsg(""); setProfileError("");
    setProfileSaving(true);
    try {
      await updateBusiness(biz.id, {
        contact_email: email,
        contact_phone: phone,
        notify_by_email: notifyEmail,
        notify_by_phone: notifyPhone,
      } as Parameters<typeof updateBusiness>[1]);
      await updateProfile({ phone: phone || null });
      notifyBusinessDataChanged({ id: biz.id, action: "updated" });
      setProfileMsg("Business settings saved.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(""); setPwError("");
    if (!currentPw) { setPwError("Please enter your current password."); return; }
    if (!newPw) { setPwError("Please enter a new password."); return; }
    if (newPw === currentPw) { setPwError("New password must be different from current password."); return; }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    setPwSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) { setPwError("Session expired. Please sign in again."); return; }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      });
      if (signInErr) { setPwError("Current password is incorrect."); return; }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwMsg("Password changed successfully.");
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

      {/* Contact & Notifications */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Contact & Notifications</h3>

        {profileMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" /> {profileMsg}
          </div>
        )}
        {profileError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{profileError}</div>
        )}

        <Input label="Contact Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />} />
        <Input label="Contact Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          leftIcon={<Phone className="w-4 h-4" />} placeholder="+855 12 000 000" />

        <div className="space-y-2">
          <p className="text-xs font-medium text-ink flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Receive notifications via:</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setNotifyEmail(p => !p)}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${notifyEmail ? "bg-brand-500" : "bg-surface-200"}`}>
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow transition-transform ${notifyEmail ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-ink">Email — when buyers send messages</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setNotifyPhone(p => !p)}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${notifyPhone ? "bg-brand-500" : "bg-surface-200"}`}>
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow transition-transform ${notifyPhone ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-ink">Phone — show phone to buyers (they can call you)</span>
          </label>
        </div>

        <Button variant="primary" size="md" loading={profileSaving} onClick={handleSaveProfile}>
          Save Settings
        </Button>
      </div>

      {/* Password */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm">Change Password</h3>
        {pwMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" /> {pwMsg}
          </div>
        )}
        {pwError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{pwError}</div>
        )}
        <Input label="Current Password" type="password" value={currentPw} onChange={(e) => { setPwMsg(""); setPwError(""); setCurrentPw(e.target.value); }}
          leftIcon={<Lock className="w-4 h-4" />} placeholder="Current password" autoComplete="current-password" />
        <Input label="New Password" type="password" value={newPw} onChange={(e) => { setPwMsg(""); setPwError(""); setNewPw(e.target.value); }}
          leftIcon={<Lock className="w-4 h-4" />} placeholder="Min. 8 characters" autoComplete="new-password" />
        <Input label="Confirm New Password" type="password" value={confirmPw} onChange={(e) => { setPwMsg(""); setPwError(""); setConfirmPw(e.target.value); }}
          leftIcon={<Lock className="w-4 h-4" />} placeholder="Repeat new password" autoComplete="new-password" />
        <Button variant="secondary" size="md" loading={pwSaving} onClick={handleChangePassword}>
          Change Password
        </Button>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-soft p-5">
        <h3 className="font-semibold text-ink text-sm mb-3">Account</h3>
        <Button variant="danger" size="sm" onClick={onLogout}>Log Out</Button>
      </div>
    </div>
  );
}
