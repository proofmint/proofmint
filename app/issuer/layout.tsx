"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { IssuerSidebar } from "@/components/issuer-sidebar"
import { useSession } from "@/contexts/SessionContext"

export default function IssuerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isLoading } = useSession()

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ISSUER") {
      router.push("/auth/login")
    }
  }, [router, user, isLoading])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <SidebarProvider>
      <IssuerSidebar />
      <main className="flex-1">
        <div className="border-b bg-white p-4">
          <SidebarTrigger />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  )
}
