"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Users, Link as LinkIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge as BadgeModel } from "@prisma/client"

type BadgeWithCounts = BadgeModel & {
  _count: {
    issuedInstances: number;
    claimLinks: number;
  }
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<BadgeWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const res = await fetch("/api/issuer/badges")
        if (!res.ok) throw new Error("Failed to fetch badges")
        const data = await res.json()
        setBadges(data)
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }
    fetchBadges()
  }, [toast])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Badges</h1>
          <p className="text-muted-foreground">Manage and view all your created badges.</p>
        </div>
        <Link href="/issuer/badges/create">
          <Button style={{ backgroundColor: "#9681FA" }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Badge
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader>
              <CardContent><div className="h-32 bg-muted rounded-md"></div></CardContent>
              <CardFooter><div className="h-4 bg-muted rounded w-1/2"></div></CardFooter>
            </Card>
          ))}
        </div>
      ) : badges.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {badges.map((badge) => (
            <Link key={badge.id} href={`/issuer/badges/${badge.id}`}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="truncate">{badge.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-square w-full">
                    <Image src={badge.imageUrl} alt={badge.name} layout="fill" objectFit="cover" className="rounded-md" />
                  </div>
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                  {badge._count.claimLinks > 0 ? (
                    <div className="flex items-center"><LinkIcon className="mr-2 h-4 w-4" /> Magic Link</div>
                  ) : (
                    <div className="flex items-center"><Users className="mr-2 h-4 w-4" /> {badge._count.issuedInstances} Recipients</div>
                  )}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold">No Badges Yet</h2>
          <p className="text-muted-foreground mt-2">Get started by creating your first badge.</p>
        </div>
      )}
    </div>
  )
}
