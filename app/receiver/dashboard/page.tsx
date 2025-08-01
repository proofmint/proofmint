"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Award, Clock, CheckCircle, XCircle, ExternalLink, Eye } from "lucide-react"

// Dummy data
const stats = [
  {
    title: "Total Credentials",
    value: "24",
    icon: Award,
    color: "text-blue-600",
  },
  {
    title: "Claimed",
    value: "18",
    icon: CheckCircle,
    color: "text-green-600",
  },
  {
    title: "Pending",
    value: "4",
    icon: Clock,
    color: "text-yellow-600",
  },
  {
    title: "Rejected",
    value: "2",
    icon: XCircle,
    color: "text-red-600",
  },
]

const recentCredentials = [
  {
    id: 1,
    type: "badge",
    title: "Community Leader Badge",
    issuer: "Acme University",
    description: "Awarded for outstanding leadership in community projects",
    status: "pending",
    issuedDate: "2024-01-15",
    image: "/placeholder.svg?height=80&width=80&text=Badge",
  },
  {
    id: 2,
    type: "certificate",
    title: "Advanced JavaScript Course",
    issuer: "Tech Academy",
    description: "Completion certificate for Advanced JavaScript programming course",
    status: "claimed",
    issuedDate: "2024-01-12",
    image: "/placeholder.svg?height=80&width=80&text=Cert",
    blockchainUrl: "https://polygonscan.com/tx/0x123...",
  },
  {
    id: 3,
    type: "badge",
    title: "Workshop Attendance",
    issuer: "Design Studio",
    description: "Attended UX/UI Design Workshop 2024",
    status: "claimed",
    issuedDate: "2024-01-10",
    image: "/placeholder.svg?height=80&width=80&text=Badge",
    blockchainUrl: "https://polygonscan.com/tx/0x456...",
  },
  {
    id: 4,
    type: "certificate",
    title: "Marketing Fundamentals",
    issuer: "Business School",
    description: "Certificate of completion for Marketing Fundamentals course",
    status: "rejected",
    issuedDate: "2024-01-08",
    image: "/placeholder.svg?height=80&width=80&text=Cert",
  },
]

export default function ReceiverDashboard() {
  const [credentials, setCredentials] = useState(recentCredentials)

  const handleClaimCredential = (id: number) => {
    setCredentials((prev) =>
      prev.map((cred) =>
        cred.id === id
          ? {
              ...cred,
              status: "claimed",
              blockchainUrl: `https://polygonscan.com/tx/0x${Math.random().toString(16).substr(2, 8)}...`,
            }
          : cred,
      ),
    )
  }

  const handleRejectCredential = (id: number) => {
    setCredentials((prev) => prev.map((cred) => (cred.id === id ? { ...cred, status: "rejected" } : cred)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Credentials</h1>
        <p className="text-gray-600">Manage and view all your digital badges and certificates.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Credentials List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Credentials</CardTitle>
          <CardDescription>Your latest badges and certificates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {credentials.map((credential) => (
              <div key={credential.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0">
                  <img
                    src={credential.image || "/placeholder.svg"}
                    alt={credential.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{credential.title}</h4>
                      <p className="text-sm text-gray-600">Issued by {credential.issuer}</p>
                      <p className="text-sm text-gray-500 mt-1">{credential.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Issued on {credential.issuedDate}</p>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      <Badge
                        variant={
                          credential.status === "claimed"
                            ? "default"
                            : credential.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {credential.status}
                      </Badge>

                      {credential.status === "pending" && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            style={{ backgroundColor: "#9681FA" }}
                            onClick={() => handleClaimCredential(credential.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Claim
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectCredential(credential.id)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {credential.status === "claimed" && credential.blockchainUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={credential.blockchainUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Verify
                          </a>
                        </Button>
                      )}

                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
