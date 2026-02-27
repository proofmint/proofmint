"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit, Trash2, Copy, Eye, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Type for a single dynamic field object
type DynamicField = {
  id: string;
  name: string;
  placeholder: string;
  // Add other properties if needed from your response
};

// Updated Template type to match your API response
type Template = {
  id: string;
  templateName: string;
  templateDescription: string;
  backgroundImageUrl?: string;
  dynamicFields: DynamicField[];
  updatedAt: string;
  createdAt: string;
};

// Helper to format date strings for better readability
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const router = useRouter()

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/templates")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        // Assuming the API returns an array of templates
        const data = await response.json()
        if (data.error) {
          console.error("API Error:", data.error)
        } else {
          setTemplates(data)
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplates()
  }, [])

  const filteredTemplates = templates.filter(
    (template) =>
      template.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.templateDescription.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Handler for editing a template
  const handleEditTemplate = (templateId: string) => {
    if (!templateId) return
    router.push(`/issuer/templates/${templateId}`)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!templateId || !confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      setTemplates((prev) => prev.filter((template) => template.id !== templateId))
    } catch (error) {
      console.error("Failed to delete template:", error)
    }
  }

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
      <Card>
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
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <p className="ml-4 text-gray-500">Loading Templates...</p>
        </div>
      )}

      {/* Templates Grid */}
      {!isLoading && filteredTemplates.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
                  {template?.backgroundImageUrl ? (
                    <img
                      src={`/api/uploads/certificates/templates/${template.backgroundImageUrl}`}
                      alt={template?.templateName ?? "Certificate template"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg">{template.templateName}</CardTitle>
                <CardDescription className="truncate">{template.templateDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dynamic Fields Display */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Dynamic Fields:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.dynamicFields.map((field) => (
                      <Badge key={field.id} variant="secondary" className="text-xs">
                        {field.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Stats Display */}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Updated: {formatDate(template.updatedAt)}</span>
                  <span>Created: {formatDate(template.createdAt)}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  <Link href={`/issuer/certificates/issue?template=${template.id}`} className="flex-1">
                    <Button className="w-full" style={{ backgroundColor: "#9681FA" }}>
                      Issue Single
                    </Button>
                  </Link>
                  <Link href={`/issuer/certificates/bulk?template=${template.id}`} className="flex-1">
                    <Button className="w-full" variant="outline">
                      Bulk Issue
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">No templates found.</p>
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