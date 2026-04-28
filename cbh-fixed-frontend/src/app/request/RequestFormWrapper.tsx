"use client";
import { useSearchParams } from "next/navigation";
import RequestForm from "@/components/request/RequestForm";
import type { RequestPurpose } from "@/types";

export default function RequestFormWrapper() {
  const params = useSearchParams();
  return (
    <RequestForm
      defaultSupplierId={params.get("supplier") ?? undefined}
      defaultSupplierName={params.get("name") ?? undefined}
      defaultPurpose={(params.get("purpose") ?? undefined) as RequestPurpose | undefined}
    />
  );
}
