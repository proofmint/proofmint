"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Award, Search, ExternalLink, Eye, Calendar } from "lucide-react"

// Dummy badge data
const badges = [
  {
    id: 1,
    title: "Community Leader",
    issuer: "Acme University",
    description: "Awarded for outstanding leadership in community projects and initiatives.",
    type: "Achievement",
    status: "claimed",
    issuedDate: "2024-01-15",
    claimedDate: "2024-01-16",
    image: "/placeholder.svg?height=120&width=120&text=Leader+Badge",
    properties: {
      "Skill Level": "Expert",
      "Valid Until": "2026-12-31",
      Category: "Leadership",
    },
    blockchainUrl: "https://polygonscan.com/tx/0x123...",
  },
  {
    id: 2,
    title: "Workshop Attendance",
    issuer: "Design Studio",
    description: "Participated in UX/UI Design Workshop 2024 covering modern design principles.",
    type: "Event Attendance",
    status: "claimed",
    issuedDate: "2024-01-10",
    claimedDate: "2024-01-11",
    image: "/placeholder.svg?height=120&width=120&text=Workshop+Badge",
    properties: {
      Duration: "8 hours",
      Location: "Online",
      Instructor: "Jane Smith",
    },
    blockchainUrl: "https://polygonscan.com/tx/0x456...",
  },
  {
    id: 3,
    title: "JavaScript Expert",
    issuer: "Tech Academy",
    description: "Demonstrated advanced proficiency in JavaScript programming and modern frameworks.",
    type: "Skill",
    status: "pending",
    issuedDate: "2024-01-18",
    image: "/placeholder.svg?height=120&width=120&text=JS+Expert",
    properties: {
      "Skill Level": "Advanced",
      Technologies: "React, Node.js, ES6+",
      "Assessment Score": "95%",
    },
  },
  {
    id: 4,
    title: "Team Player",
    issuer: "Corporate Inc",
    description: "Recognized for exceptional collaboration and teamwork in project delivery.",
    type: "Achievement",
    status: "rejected",
    issuedDate: "2024-01-05",
    rejectedDate: "2024-01-06",
    image: "/placeholder.svg?height=120&width=120&text=Team+Badge",
    properties: {
      Project: "Q4 Product Launch",
      "Team Size": "12 members",
      Duration: "3 months",
    },
  },
]

export default function BadgesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const filteredBadges = badges.filter((badge) => {
    const matchesSearch =
      badge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || badge.status === statusFilter
    const matchesType = typeFilter === "all" || badge.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const handleClaimBadge = (id: number) => {
    // Simulate claiming badge
    console.log(`Claiming badge ${id}`)
  }

  const handleRejectBadge = (id: number) => {
    // Simulate rejecting badge
    console.log(`Rejecting badge ${id}`)
  }

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
                <SelectItem value="Skill">Skill</SelectItem>
                <SelectItem value="Achievement">Achievement</SelectItem>
                <SelectItem value="Event Attendance">Event</SelectItem>
                <SelectItem value="Certification">Certification</SelectItem>
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

              {/* Status and Dates */}
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    badge.status === "claimed" ? "default" : badge.status === "pending" ? "secondary" : "destructive"
                  }
                >
                  {badge.status}
                </Badge>
                <div className="text-xs text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {badge.status === "claimed" && badge.claimedDate
                      ? `Claimed ${badge.claimedDate}`
                      : badge.status === "rejected" && badge.rejectedDate
                        ? `Rejected ${badge.rejectedDate}`
                        : `Issued ${badge.issuedDate}`}
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
                    <Button size="sm" variant="outline" onClick={() => handleRejectBadge(badge.id)}>
                      Reject
                    </Button>
                  </>
                )}

                {badge.status === "claimed" && badge.blockchainUrl && (
                  <Button size="sm" variant="outline" className="flex-1 bg-transparent" asChild>
                    <a href={badge.blockchainUrl} target="_blank" rel="noopener noreferrer">
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
