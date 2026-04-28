import { Suspense } from "react";
import RequestPageContent from "./RequestPageContent";

export const metadata = {
  title: "Request a Quote — CBH",
  description: "Find a supplier and send a buy, collaborate, or invest request.",
};

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-20"><div className="h-96 shimmer rounded-2xl" /></div>}>
      <RequestPageContent />
    </Suspense>
  );
}
