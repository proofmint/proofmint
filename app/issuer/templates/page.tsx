"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2, Copy, Eye } from "lucide-react"
import Link from "next/link"

// Dummy template data
const templates = [
  {
    id: 1,
    name: "Official Course Completion",
    description: "Standard template for course completion certificates",
    fields: ["Recipient Name", "Course Title", "Date Issued", "Instructor"],
    createdAt: "2024-01-10",
    usageCount: 45,
    thumbnail: "/placeholder.svg?height=200&width=300&text=Certificate+Template",
  },
  {
    id: 2,
    name: "Workshop Attendance",
    description: "Template for workshop and seminar attendance",
    fields: ["Participant Name", "Workshop Title", "Duration", "Date"],
    createdAt: "2024-01-08",
    usageCount: 23,
    thumbnail: "/placeholder.svg?height=200&width=300&text=Workshop+Template",
  },
  {
    id: 3,
    name: "Achievement Award",
    description: "Template for special achievements and recognitions",
    fields: ["Recipient Name", "Achievement", "Category", "Date"],
    createdAt: "2024-01-05",
    usageCount: 12,
    thumbnail: "/placeholder.svg?height=200&width=300&text=Award+Template",
  },
]

export default function TemplatesPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Certificate Templates</h1>
          <p className="text-gray-600">Create and manage reusable certificate templates.</p>
        </div>
        <Link href="/issuer/templates/create">
          <Button style={{ backgroundColor: "#9681FA" }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Link>
      </div>

      {/* Search */}
      {/* <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card> */}

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="group hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img
                  src={template.thumbnail || "/placeholder.svg"}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Fields */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Dynamic Fields:</p>
                <div className="flex flex-wrap gap-1">
                  {template.fields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Used {template.usageCount} times</span>
                <span>Created {template.createdAt}</span>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 bg-transparent">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Link href={`/issuer/certificates/create?template=${template.id}`}>
                <Button className="w-full" style={{ backgroundColor: "#9681FA" }}>
                  Use Template
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">No templates found matching your search.</p>
            <Link href="/issuer/templates/create">
              <Button style={{ backgroundColor: "#9681FA" }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
