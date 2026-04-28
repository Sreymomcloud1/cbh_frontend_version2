"use client";
import { useState, useRef } from "react";
import { Camera, Loader2, CheckCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  currentUrl: string | null;
  name: string;
  onUploaded: (newUrl: string) => void; // called after successful upload
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function AvatarUpload({ currentUrl, name, onUploaded }: Props) {
  const [preview,  setPreview]  = useState<string | null>(currentUrl);
  const [status,   setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size client-side first
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Only JPEG, PNG, WEBP or GIF images allowed.");
      setStatus("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image must be under 5 MB.");
      setStatus("error");
      return;
    }

    // Show local preview immediately
    setPreview(URL.createObjectURL(file));
    setStatus("uploading");
    setErrorMsg("");

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not logged in");

      // Upload via backend (which pushes to Supabase Storage)
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_URL}/upload/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed");

      const newUrl: string = json.data.url;
      setPreview(newUrl);
      setStatus("done");
      onUploaded(newUrl);

      // Reset status after 2s
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div className="relative group">
        <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden border-4 border-white shadow-soft">
          {preview
            ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
            : initials
          }
        </div>

        {/* Camera overlay */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
        >
          {status === "uploading"
            ? <Loader2 className="w-6 h-6 text-white animate-spin" />
            : <Camera className="w-6 h-6 text-white" />
          }
        </button>

        {/* Done tick */}
        {status === "done" && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center border-2 border-white">
            <CheckCircle className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Click to upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="text-xs text-brand-600 hover:text-brand-700 hover:underline disabled:opacity-50 disabled:no-underline"
      >
        {status === "uploading" ? "Uploading..." : "Change photo"}
      </button>

      {/* Error message */}
      {status === "error" && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          <X className="w-3 h-3 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}