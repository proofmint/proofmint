"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge as UiBadge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Award,
  Search,
  ExternalLink,
  Eye,
  Calendar,
} from "lucide-react"

type Badge = {
  id: string
  title: string
  issuer: string
  description: string
  image?: string
  status: "claimed" | "pending" | "rejected"
  type: string
  properties: Record<string, string>
  claimedDate?: string
  rejectedDate?: string
  issuedDate?: string
  blockchainUrl?: string
}

export default function BadgesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [badges, setBadges] = useState<Badge[]>([])

  const filteredBadges = badges.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    const matchesType = typeFilter === "all" || item.type.toLowerCase() === typeFilter.toLowerCase()

    return matchesSearch && matchesStatus && matchesType
  })

  const handleClaimBadge = (id: string) => {
    console.log(`Claiming badge ${id}`)
  }

  const handleRejectBadge = (id: string) => {
    console.log(`Rejecting badge ${id}`)
  }

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await fetch("/api/receiver/badges")
        if (!response.ok) throw new Error("Failed to fetch badges")
        const rawData = await response.json()

        const transformed: Badge[] = rawData.map((item: any) => ({
          id: item.id,
          title: item.badge.name,
          issuer: item.issuer.organizationName,
          description: item.badge.description,
          image: item.badge.imageUrl,
          status: item.status,
          type: item.badge.badgeType,
          properties: item.badge.customProperties?.reduce(
            (acc: Record<string, string>, prop: any) => {
              acc[prop.key] = prop.value
              return acc
            },
            {}
          ) ?? {},
          claimedDate: item.claimedAt,
          rejectedDate: null,
          issuedDate: item.issuedAt,
          blockchainUrl: item.transactionHash
            ? `https://polygonscan.com/tx/${item.transactionHash}`
            : undefined,
        }))

        setBadges(transformed)
      } catch (error) {
        console.error("Error fetching badges:", error)
      }
    }

    fetchBadges()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Badges</h1>
        <p className="text-gray-600">View and manage all your digital badges.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search badges..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="skill">Skill</SelectItem>
                <SelectItem value="achievement">Achievement</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="certification">Certification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Badges Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBadges.map((badge) => (
          <Card key={badge.id} className="group hover:shadow-lg transition-shadow">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-4">
                <img
                  src={badge.image || "/placeholder.svg"}
                  alt={badge.title}
                  className="w-24 h-24 mx-auto rounded-full object-cover"
                />
              </div>
              <CardTitle className="text-lg">{badge.title}</CardTitle>
              <CardDescription>Issued by {badge.issuer}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{badge.description}</p>

              {/* Badge Properties */}
              {Object.keys(badge.properties).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Properties:</p>
                  <div className="space-y-1">
                    {Object.entries(badge.properties).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status and Dates */}
              <div className="flex items-center justify-between">
                <UiBadge
                  variant={
                    badge.status === "claimed"
                      ? "default"
                      : badge.status === "pending"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {badge.status}
                </UiBadge>
                <div className="text-xs text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {badge.status === "claimed" && badge.claimedDate
                      ? `Claimed ${new Date(badge.claimedDate).toLocaleDateString()}`
                      : badge.status === "rejected" && badge.rejectedDate
                      ? `Rejected ${new Date(badge.rejectedDate).toLocaleDateString()}`
                      : badge.issuedDate
                      ? `Issued ${new Date(badge.issuedDate).toLocaleDateString()}`
                      : null}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                {badge.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      style={{ backgroundColor: "#9681FA" }}
                      onClick={() => handleClaimBadge(badge.id)}
                    >
                      Claim
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectBadge(badge.id)}
                    >
                      Reject
                    </Button>
                  </>
                )}

                {badge.status === "claimed" && badge.blockchainUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    asChild
                  >
                    <a
                      href={badge.blockchainUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Verify on Blockchain
                    </a>
                  </Button>
                )}

                <Button size="sm" variant="ghost">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredBadges.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No badges found matching your criteria.</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
