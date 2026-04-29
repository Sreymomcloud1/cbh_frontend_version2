"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

function initialFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0].toUpperCase();
}

export type BusinessMediaPlaceholder = "default" | "dark";

type BusinessMediaProps = {
  src: string | null | undefined;
  alt: string;
  /** Used for the fallback initial when there is no image or loading fails */
  name: string;
  className?: string;
  imgClassName?: string;
  /** cover = hero / gallery main; avatar = square logo */
  fit: "cover" | "avatar";
  /** Letter size in avatar mode (e.g. text-sm for small chips) */
  avatarTextClassName?: string;
  placeholderTone?: BusinessMediaPlaceholder;
};

/**
 * Business logo or cover image with a stable placeholder when the URL is empty
 * or the asset fails to load (404, CORS, expired signed URL, etc.).
 */
export function BusinessMedia({
  src,
  alt,
  name,
  className,
  imgClassName,
  fit,
  avatarTextClassName,
  placeholderTone = "default",
}: BusinessMediaProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = typeof src === "string" ? src.trim() : "";
  const showImg = Boolean(trimmed) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  const onError = useCallback(() => setFailed(true), []);

  const initial = initialFromName(name);
  const dark = placeholderTone === "dark";

  if (fit === "cover") {
    return (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden",
          dark ? "bg-stone-800" : "bg-surface-100",
          className,
        )}
      >
        {showImg ? (
          <img
            src={trimmed}
            alt={alt}
            className={cn("h-full w-full object-cover", imgClassName)}
            onError={onError}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center",
              dark ? "bg-stone-800" : "bg-surface-100",
            )}
            aria-hidden
          >
            <span
              className={cn(
                "font-display select-none font-bold",
                dark ? "text-5xl text-stone-600" : "text-5xl text-brand-200",
              )}
            >
              {initial}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        dark ? "bg-stone-700" : "bg-brand-50",
        className,
      )}
    >
      {showImg ? (
        <img
          src={trimmed}
          alt={alt}
          className={cn("h-full w-full object-cover", imgClassName)}
          onError={onError}
        />
      ) : (
        <span
          className={cn(
            "font-bold",
            dark ? "text-stone-200" : "text-brand-600",
            avatarTextClassName ?? "text-xl",
          )}
          aria-hidden
        >
          {initial}
        </span>
      )}
    </div>
  );
}
