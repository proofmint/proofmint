"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";

export default function AdminOnrampPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">On‑Ramp / Off‑Ramp</h1>
      </div>

      <div className="w-full max-w-[420px] mx-auto">
        <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm h-[650px]">
          <iframe
            src="https://main.d1r3kocso68lqd.amplifyapp.com/"
            title="Fluid On‑Ramp / Off‑Ramp Widget"
            className="w-full h-full border-0"
            allow="encrypted-media *; camera *"
            allowFullScreen
          />
        </div>
      </div>
      <p className="text-center text-sm text-gray-500 mt-4">
        Powered by Carret
      </p>
    </div>
  );
}
