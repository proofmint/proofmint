"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "../../components/admin-sidebar"
import { useSession } from "@/contexts/SessionContext"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isLoading } = useSession()

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "ADMIN") {
      router.push("/auth/login")
    }
  }, [router, user, isLoading])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <main className="flex-1">
        <div className="border-b bg-white p-4">
          <SidebarTrigger />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  )
}


