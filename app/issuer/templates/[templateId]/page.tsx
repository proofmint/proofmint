"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Plus, X, Move, Type, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useParams, useRouter } from "next/navigation"

interface DynamicField {
  id: string
  name: string
  placeholder: string
  x: number
  y: number
  fontSize: number
  color: string
  fontWeight: string
  textAlign: string
}

interface Template {
  name: string
  description: string
  backgroundImage: File | null
  fields: DynamicField[]
}

export default function CreateTemplatePage() {
  const [template, setTemplate] = useState<Template>({
    name: "",
    description: "",
    backgroundImage: null,
    fields: [],
  })
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [newFieldName, setNewFieldName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  const params = useParams()

  const templateId = params.templateId as string

  useEffect(() => {
    if (templateId) {
      // Fetch existing template data if templateId is provided
      const fetchTemplate = async () => {
        try {
          const response = await fetch(`/api/templates/${templateId}`)
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          const data = await response.json()
          const blob = await fetch(data.backgroundImageUrl).then(res => res.blob())
          const file = new File([blob], "background.png", { type: blob.type })
          setTemplate({
            name: data.templateName,
            description: data.templateDescription,
            backgroundImage: file,
            fields: data.dynamicFields || [],
          })
        } catch (error) {
          console.error("Failed to fetch template:", error)
          toast({
            title: "Error",
            description: "Failed to load template data.",
            variant: "destructive",
          })
        }
      }
      fetchTemplate()
    }
  }, [templateId])

  console.log(template)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTemplate((prev) => ({ ...prev, backgroundImage: file }))
    }
  }

  const addDynamicField = () => {
    if (!newFieldName.trim()) return

    const newField: DynamicField = {
      id: `field_${Date.now()}`,
      name: newFieldName,
      placeholder: `[${newFieldName}]`,
      x: 100,
      y: 100,
      fontSize: 24,
      color: "#000000",
      fontWeight: "normal",
      textAlign: "left",
    }

    setTemplate((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }))
    setNewFieldName("")
  }

  const removeField = (fieldId: string) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.filter((field) => field.id !== fieldId),
    }))
    if (selectedField === fieldId) {
      setSelectedField(null)
    }
  }

  const updateField = (fieldId: string, updates: Partial<DynamicField>) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((field) => (field.id === fieldId ? { ...field, ...updates } : field)),
    }))
  }

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault()
    setSelectedField(fieldId)
    setIsDragging(true)

    const field = template.fields.find((f) => f.id === fieldId)
    if (field) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left - field.x,
          y: e.clientY - rect.top - field.y,
        })
      }
    }
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !selectedField || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const newX = Math.max(0, Math.min(rect.width - 100, e.clientX - rect.left - dragOffset.x))
      const newY = Math.max(0, Math.min(rect.height - 30, e.clientY - rect.top - dragOffset.y))

      updateField(selectedField, { x: newX, y: newY })
    },
    [isDragging, selectedField, dragOffset],
  )

  const handleMouseUp = () => {
    setIsDragging(false)
    
  }

  const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })


  const handleSaveTemplate = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!template.name || !template.backgroundImage || template.fields.length === 0) {
    toast({
      title: "Validation Error",
      description: "Please provide template name, background image, and at least one dynamic field.",
      variant: "destructive",
    })
    return
  }

  setIsLoading(true)

  try {
    const base64Image = await toBase64(template.backgroundImage)

    const payload = {
      templateName: template.name,
      templateDescription: template.description,
      backgroundImageUrl: base64Image,
      dynamicFields: template.fields,
    }

    const res = await fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error("Failed to save template")
    }

    toast({
      title: "Template Updated successfully!",
      description: "Your certificate template has been saved and is ready to use.",
    })
    router.push("/issuer/templates")
  } catch (error: any) {
    console.error("Error saving template:", error)
    toast({
      title: "Error",
      description: "Something went wrong while saving the template.",
      variant: "destructive",
    })
  } finally {
    setIsLoading(false)
  }
}


  const selectedFieldData = template.fields.find((f) => f.id === selectedField)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Certificate Template</h1>
        <p className="text-gray-600">Design a reusable template with dynamic fields for certificate generation.</p>
      </div>

      <form onSubmit={handleSaveTemplate} className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Template Info & Fields */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>Basic details about your template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    placeholder="e.g., Course Completion Certificate"
                    value={template.name}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="templateDescription">Description</Label>
                  <Textarea
                    id="templateDescription"
                    placeholder="Describe when this template should be used..."
                    rows={3}
                    value={template.description}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Background Image</CardTitle>
                <CardDescription>Upload the base certificate design</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center relative">
                  {template.backgroundImage ? (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-[#9681FA] mx-auto" />
                      <p className="text-sm font-medium">{template.backgroundImage.name}</p>
                      <p className="text-xs text-gray-500">
                        {(template.backgroundImage.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-600">Click to upload certificate background</p>
                      <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dynamic Fields</CardTitle>
                <CardDescription>Add text fields that can be customized for each certificate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add New Field */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Field name (e.g., Recipient Name)"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDynamicField())}
                  />
                  <Button type="button" onClick={addDynamicField} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Field List */}
                <div className="space-y-2">
                  {template.fields.map((field) => (
                    <div
                      key={field.id}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer ${
                        selectedField === field.id ? "border-[#9681FA] bg-purple-50" : "border-gray-200"
                      }`}
                      onClick={() => setSelectedField(field.id)}
                    >
                      <div className="flex items-center space-x-2">
                        <Type className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">{field.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeField(field.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Canvas */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Template Preview</CardTitle>
                <CardDescription>
                  {template.backgroundImage
                    ? "Drag and position the dynamic fields on your certificate"
                    : "Upload a background image to start designing"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {template.backgroundImage ? (
                  <div
                    ref={canvasRef}
                    className="relative border-2 border-gray-200 rounded-lg overflow-hidden bg-white"
                    style={{ aspectRatio: "4/3", minHeight: "400px" }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {/* Background Image */}
                    <img
                      src={URL.createObjectURL(template.backgroundImage) || "/placeholder.svg"}
                      alt="Certificate background"
                      className="absolute inset-0 w-full h-full object-contain"
                      draggable={false}
                    />

                    {/* Dynamic Fields */}
                    {template.fields.map((field) => (
                      <div
                        key={field.id}
                        className={`absolute cursor-move select-none px-2 py-1 rounded border-2 ${
                          selectedField === field.id
                            ? "border-[#9681FA] bg-purple-100"
                            : "border-transparent hover:border-gray-300 hover:bg-gray-100"
                        }`}
                        style={{
                          left: field.x,
                          top: field.y,
                          fontSize: field.fontSize,
                          color: field.color,
                          fontWeight: field.fontWeight,
                          textAlign: field.textAlign as any,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, field.id)}
                      >
                        {field.placeholder}
                        {selectedField === field.id && (
                          <Move className="absolute -top-2 -right-2 h-4 w-4 text-[#9681FA]" />
                        )}
                      </div>
                    ))}

                    {template.fields.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-500 text-center">
                          Add dynamic fields from the left panel
                          <br />
                          <span className="text-sm">Fields will appear here for positioning</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Upload a background image to start designing your template</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Field Properties Panel */}
            {selectedFieldData && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Field Properties: {selectedFieldData.name}</CardTitle>
                  <CardDescription>Customize the appearance of the selected field</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        min="12"
                        max="72"
                        value={selectedFieldData.fontSize}
                        onChange={(e) =>
                          updateField(selectedFieldData.id, { fontSize: Number.parseInt(e.target.value) || 24 })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Input
                        type="color"
                        value={selectedFieldData.color}
                        onChange={(e) => updateField(selectedFieldData.id, { color: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Font Weight</Label>
                      <select
                        className="w-full p-2 border rounded"
                        value={selectedFieldData.fontWeight}
                        onChange={(e) => updateField(selectedFieldData.id, { fontWeight: e.target.value })}
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="lighter">Light</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Text Align</Label>
                      <select
                        className="w-full p-2 border rounded"
                        value={selectedFieldData.textAlign}
                        onChange={(e) => updateField(selectedFieldData.id, { textAlign: e.target.value })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" style={{ backgroundColor: "#9681FA" }} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving Template..." : "Save Template"}
          </Button>
        </div>
      </form>
    </div>
  )
}
