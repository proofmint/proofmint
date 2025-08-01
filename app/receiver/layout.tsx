"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReceiverSidebar } from "@/components/receiver-sidebar";
import { User } from "@prisma/client";
import { useSession } from "@/contexts/SessionContext";

export default function ReceiverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "receiver") {
      router.push("/auth/login");
    }
  }, [router, user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
      <SidebarProvider>
        <ReceiverSidebar />
        <main className="flex-1">
          <div className="border-b bg-white p-4">
            <SidebarTrigger />
          </div>
          <div className="p-6">{children}</div>
        </main>
      </SidebarProvider>
  );
}
