"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Award, FileText, Users, TrendingUp, Plus, Eye } from "lucide-react"
import Link from "next/link"

// Dummy data
const stats = [
  {
    title: "Total Badges Issued",
    value: "1,234",
    change: "+12%",
    icon: Award,
    color: "text-blue-600",
  },
  {
    title: "Certificates Created",
    value: "567",
    change: "+8%",
    icon: FileText,
    color: "text-green-600",
  },
  {
    title: "Active Recipients",
    value: "2,891",
    change: "+15%",
    icon: Users,
    color: "text-purple-600",
  },
  {
    title: "Claim Rate",
    value: "94.2%",
    change: "+2.1%",
    icon: TrendingUp,
    color: "text-orange-600",
  },
]

const recentActivity = [
  {
    id: 1,
    type: "badge",
    title: "Community Leader Badge",
    recipient: "john@example.com",
    status: "claimed",
    date: "2024-01-15",
  },
  {
    id: 2,
    type: "certificate",
    title: "Course Completion Certificate",
    recipient: "sarah@example.com",
    status: "pending",
    date: "2024-01-14",
  },
  {
    id: 3,
    type: "badge",
    title: "Expert Developer Badge",
    recipient: "mike@example.com",
    status: "claimed",
    date: "2024-01-13",
  },
  {
    id: 4,
    type: "certificate",
    title: "Workshop Attendance",
    recipient: "lisa@example.com",
    status: "rejected",
    date: "2024-01-12",
  },
]

export default function IssuerDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your credentials.</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/issuer/badges/create">
            <Button style={{ backgroundColor: "#9681FA" }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Badge
            </Button>
          </Link>
          <Link href="/issuer/certificates/create">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Issue Certificate
            </Button>
          </Link>
        </div>
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
              <p className="text-xs text-green-600 font-medium">{stat.change} from last month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest credential issuances and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {activity.type === "badge" ? (
                      <Award className="h-8 w-8 text-[#9681FA]" />
                    ) : (
                      <FileText className="h-8 w-8 text-[#9681FA]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium">{activity.title}</h4>
                    <p className="text-sm text-gray-600">Sent to {activity.recipient}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={
                      activity.status === "claimed"
                        ? "default"
                        : activity.status === "pending"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {activity.status}
                  </Badge>
                  <span className="text-sm text-gray-500">{activity.date}</span>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
