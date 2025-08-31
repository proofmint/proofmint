"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, TicketPercent, CreditCard, LogOut, User, Settings } from "lucide-react"
import { useSession } from "@/contexts/SessionContext"
import Image from "next/image"
import Logo from "@/public/images/Logo.png"

const menuItems = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Issuers",
    url: "/admin/issuers",
    icon: Users,
  },
  {
    title: "Coupons",
    url: "/admin/coupons",
    icon: TicketPercent,
  },
  {
    title: "Credit Requests",
    url: "/admin/credit-requests",
    icon: CreditCard,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useSession()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-2 py-4">
          <Image src={Logo} alt="Logo" width={44} height={48} />
          <div>
            <h2 className="text-lg font-semibold">PROOFMINT</h2>
            <p className="text-sm text-gray-500">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="p-2 space-y-2">
          <div className="flex items-center space-x-2 px-2 py-1">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{user?.email ?? ""}</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}


