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
import { CERTIFICATE_FONTS } from "@/lib/certificateFonts"

interface DynamicField {
  id: string
  name: string
  placeholder: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string
  textAlign: string
}

interface Template {
  name: string
  description: string
  backgroundImage: File | null
  fields: DynamicField[]
  imageWidth: number
  imageHeight: number
}

export default function CreateTemplatePage() {
  const [template, setTemplate] = useState<Template>({
    name: "",
    description: "",
    backgroundImage: null,
    fields: [],
    imageWidth: 0,
    imageHeight: 0,
  })
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [newFieldName, setNewFieldName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  const params = useParams()
  const templateId = params.templateId as string

  // Load all custom Google Fonts for browser preview
  useEffect(() => {
    const googleFamilies = CERTIFICATE_FONTS
      .filter(f => f.googleFamily)
      .map(f => `family=${f.googleFamily}`)
      .join('&')
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${googleFamilies}&display=swap`
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  // Helper function to calculate rendered image dimensions and offset (accounting for object-contain)
  const getRenderedImageMetrics = useCallback(() => {
    if (!imageRef.current) return null
    
    const imageRect = imageRef.current.getBoundingClientRect()
    const imageAspect = template.imageWidth / template.imageHeight
    const containerAspect = imageRect.width / imageRect.height
    
    let renderedWidth, renderedHeight, offsetX, offsetY
    
    if (imageAspect > containerAspect) {
      // Image is wider - will have top/bottom whitespace
      renderedWidth = imageRect.width
      renderedHeight = imageRect.width / imageAspect
      offsetX = 0
      offsetY = (imageRect.height - renderedHeight) / 2
    } else {
      // Image is taller - will have left/right whitespace
      renderedHeight = imageRect.height
      renderedWidth = imageRect.height * imageAspect
      offsetX = (imageRect.width - renderedWidth) / 2
      offsetY = 0
    }
    
    return {
      imageRect,
      renderedWidth,
      renderedHeight,
      offsetX,
      offsetY,
      scaleX: renderedWidth / template.imageWidth,
      scaleY: renderedHeight / template.imageHeight,
    }
  }, [template.imageWidth, template.imageHeight])

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
          
          // Load background image
          const imageUrl = `/api/uploads/templates/${data.backgroundImageUrl}`
          const blob = await fetch(imageUrl).then(res => res.blob())
          const file = new File([blob], data.backgroundImageUrl, { type: blob.type })
          
          // Load image to get dimensions
          const img = new Image()
          img.onload = () => {
            // Add unique IDs to fields if they don't have them
            const fieldsWithIds = (data.dynamicFields || []).map((field: any, index: number) => ({
              ...field,
              id: field.id || `field_${Date.now()}_${index}`,
              placeholder: field.placeholder || `[${field.name}]`,
              fontFamily: field.fontFamily || 'Arial',
              fontWeight: field.fontWeight || 'normal',
              textAlign: field.align || field.textAlign || 'left',
            }))
            
            setTemplate({
              name: data.templateName,
              description: data.templateDescription,
              backgroundImage: file,
              fields: fieldsWithIds,
              imageWidth: img.width,
              imageHeight: img.height,
            })
            setImageLoaded(true)
          }
          img.src = imageUrl
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
  }, [templateId, toast])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Load image to get dimensions
      const img = new Image()
      img.onload = () => {
        setTemplate((prev) => ({ 
          ...prev, 
          backgroundImage: file,
          imageWidth: img.width,
          imageHeight: img.height,
          fields: [] // Reset fields when image changes
        }))
        setImageLoaded(true)
      }
      img.src = URL.createObjectURL(file)
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
      fontFamily: "Arial",
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
    e.stopPropagation()
    setSelectedField(fieldId)
    setIsDragging(true)

    const field = template.fields.find((f) => f.id === fieldId)
    if (!field) return
    
    const metrics = getRenderedImageMetrics()
    if (!metrics) return
    
    const { imageRect, scaleX, scaleY, offsetX, offsetY } = metrics
    
    // Get field element to calculate its dimensions
    const fieldElement = e.currentTarget as HTMLElement
    const fieldWidth = fieldElement.offsetWidth
    const fieldHeight = fieldElement.offsetHeight
    
    // Convert original center coordinates to display coordinates
    const displayCenterX = field.x * scaleX + offsetX
    const displayCenterY = field.y * scaleY + offsetY
    
    // Calculate top-left position for rendering
    const displayX = displayCenterX - fieldWidth / 2
    const displayY = displayCenterY - fieldHeight / 4
    
    setDragOffset({
      x: e.clientX - imageRect.left - displayX,
      y: e.clientY - imageRect.top - displayY,
    })
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !selectedField) return

      const metrics = getRenderedImageMetrics()
      if (!metrics) return
      
      const { imageRect, offsetX, offsetY, scaleX, scaleY, renderedWidth, renderedHeight } = metrics
      
      // Calculate position relative to the actual rendered image (excluding whitespace)
      const displayX = e.clientX - imageRect.left - offsetX - dragOffset.x
      const displayY = e.clientY - imageRect.top - offsetY - dragOffset.y
      
      // Get field element dimensions to calculate center offset
      const field = template.fields.find((f) => f.id === selectedField)
      if (!field) return
      
      // Estimate field dimensions in display space
      const estimatedFieldWidth = 100 * scaleX // Approximate width
      const estimatedFieldHeight = field.fontSize * scaleY + 8 // Font size + padding
      
      // Calculate center position in display space
      const displayCenterX = displayX + estimatedFieldWidth / 2
      const displayCenterY = displayY + estimatedFieldHeight / 2
      
      // Convert to original image coordinates (center point)
      const originalCenterX = displayCenterX / scaleX
      const originalCenterY = displayCenterY / scaleY
      
      // Constrain to image bounds (keeping center point within image)
      const margin = 50 // Minimum margin from edges
      const constrainedX = Math.max(margin, Math.min(template.imageWidth - margin, originalCenterX))
      const constrainedY = Math.max(margin, Math.min(template.imageHeight - margin, originalCenterY))

      updateField(selectedField, { x: constrainedX, y: constrainedY })
    },
    [isDragging, selectedField, dragOffset, getRenderedImageMetrics, template.imageWidth, template.imageHeight],
  )

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Deselect field when clicking on canvas background
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
      setSelectedField(null)
    }
  }

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
      // Create FormData for file upload
      const formData = new FormData()
      formData.append("templateName", template.name)
      formData.append("templateDescription", template.description)
      formData.append("backgroundImage", template.backgroundImage)
      
      // Convert fields to match backend format
      const dynamicFields = template.fields.map(field => ({
        name: field.name,
        x: Math.round(field.x),
        y: Math.round(field.y),
        fontSize: field.fontSize,
        fontFamily: field.fontFamily,
        fontWeight: field.fontWeight,
        color: field.color,
        maxWidth: undefined,
        maxHeight: undefined,
        align: field.textAlign as 'left' | 'center' | 'right'
      }))
      
      formData.append("dynamicFields", JSON.stringify(dynamicFields))

      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save template")
      }

      toast({
        title: "Template updated successfully!",
        description: "Your certificate template has been saved and is ready to use.",
      })
      router.push("/issuer/templates")
    } catch (error: any) {
      console.error("Error saving template:", error)
      toast({
        title: "Error",
        description: error.message || "Something went wrong while saving the template.",
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
        <h1 className="text-3xl font-bold text-gray-900">Edit Certificate Template</h1>
        <p className="text-gray-600">Update your certificate template with dynamic fields for certificate generation.</p>
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
                    onClick={handleCanvasClick}
                  >
                    {/* Background Image */}
                    <img
                      ref={imageRef}
                      src={URL.createObjectURL(template.backgroundImage) || "/placeholder.svg"}
                      alt="Certificate background"
                      className="absolute inset-0 w-full h-full object-contain"
                      draggable={false}
                    />

                    {/* Dynamic Fields */}
                    {imageLoaded && template.fields.map((field) => {
                      const metrics = getRenderedImageMetrics()
                      if (!metrics) return null
                      
                      const { scaleX, scaleY, offsetX, offsetY } = metrics
                      
                      // field.x and field.y represent the CENTER point in original image coordinates
                      const displayCenterX = field.x * scaleX + offsetX
                      const displayCenterY = field.y * scaleY + offsetY
                      const displayFontSize = field.fontSize * scaleY
                      
                      return (
                        <div
                          key={field.id}
                          className={`absolute select-none ${
                            selectedField === field.id
                              ? "border-2 border-[#9681FA] bg-purple-50/50"
                              : "border-2 border-transparent hover:border-gray-300 hover:bg-gray-100/50"
                          }`}
                          style={{
                            left: displayCenterX,
                            top: displayCenterY,
                            transform: 'translate(-50%, -75%)', // Center the element at the coordinates
                            fontSize: displayFontSize,
                            color: field.color,
                            fontFamily: field.fontFamily,
                            fontWeight: field.fontWeight,
                            textAlign: field.textAlign as any,
                            padding: '4px 8px',
                            cursor: isDragging && selectedField === field.id ? 'grabbing' : 'grab',
                            pointerEvents: 'auto',
                            zIndex: selectedField === field.id ? 10 : 1,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, field.id)}
                        >
                          {field.name}
                          {selectedField === field.id && (
                            <Move className="absolute -top-3 -right-3 h-5 w-5 text-[#9681FA] bg-white rounded-full p-0.5 shadow-sm" />
                          )}
                        </div>
                      )
                    })}

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
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={selectedFieldData.fontFamily}
                      style={{ fontFamily: selectedFieldData.fontFamily }}
                      onChange={(e) => updateField(selectedFieldData.id, { fontFamily: e.target.value })}
                    >
                      {CERTIFICATE_FONTS.map(font => (
                        <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Font Size</Label>
                      <Input
                        type="number"
                        min="12"
                        max="200"
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
                  <p className="text-xs text-gray-500">
                    Coordinates: X={Math.round(selectedFieldData.x)}, Y={Math.round(selectedFieldData.y)} (in original image pixels: {template.imageWidth}x{template.imageHeight})
                  </p>
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
