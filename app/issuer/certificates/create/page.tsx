"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Eye, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Mock template data
const templates = [
  {
    id: 1,
    name: "Official Course Completion",
    description: "Standard template for course completion certificates",
    fields: ["Recipient Name", "Course Title", "Date Issued", "Instructor"],
    backgroundImage: "/placeholder.svg?height=400&width=600&text=Certificate+Template",
  },
  {
    id: 2,
    name: "Workshop Attendance",
    description: "Template for workshop and seminar attendance",
    fields: ["Participant Name", "Workshop Title", "Duration", "Date"],
    backgroundImage: "/placeholder.svg?height=400&width=600&text=Workshop+Template",
  },
  {
    id: 3,
    name: "Achievement Award",
    description: "Template for special achievements and recognitions",
    fields: ["Recipient Name", "Achievement", "Category", "Date"],
    backgroundImage: "/placeholder.svg?height=400&width=600&text=Award+Template",
  },
]

interface CertificateData {
  templateId: number | null
  singleRecipient: {
    email: string
    fieldValues: Record<string, string>
  }
  bulkRecipients: {
    csvData: string
    fieldMapping: Record<string, string>
  }
}

export default function CreateCertificatePage() {
  const searchParams = useSearchParams()
  const [selectedTemplate, setSelectedTemplate] = useState<(typeof templates)[0] | null>(null)
  const [issuanceMode, setIssuanceMode] = useState<"single" | "bulk">("single")
  const [certificateData, setCertificateData] = useState<CertificateData>({
    templateId: null,
    singleRecipient: {
      email: "",
      fieldValues: {},
    },
    bulkRecipients: {
      csvData: "",
      fieldMapping: {},
    },
  })
  const [generatedCertificates, setGeneratedCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    const templateId = searchParams.get("template")
    if (templateId) {
      const template = templates.find((t) => t.id === Number.parseInt(templateId))
      if (template) {
        setSelectedTemplate(template)
        setCertificateData((prev) => ({ ...prev, templateId: template.id }))
      }
    }
  }, [searchParams])

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === Number.parseInt(templateId))
    if (template) {
      setSelectedTemplate(template)
      setCertificateData((prev) => ({
        ...prev,
        templateId: template.id,
        singleRecipient: { ...prev.singleRecipient, fieldValues: {} },
      }))
    }
  }

  const updateSingleRecipientField = (fieldName: string, value: string) => {
    setCertificateData((prev) => ({
      ...prev,
      singleRecipient: {
        ...prev.singleRecipient,
        fieldValues: {
          ...prev.singleRecipient.fieldValues,
          [fieldName]: value,
        },
      },
    }))
  }

  const generateCertificatePreview = () => {
    if (!selectedTemplate || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = 800
    canvas.height = 600

    // Create background
    ctx.fillStyle = "#f8f9fa"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Add border
    ctx.strokeStyle = "#9681FA"
    ctx.lineWidth = 8
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

    // Add template name as header
    ctx.fillStyle = "#9681FA"
    ctx.font = "bold 32px Arial"
    ctx.textAlign = "center"
    ctx.fillText("CERTIFICATE", canvas.width / 2, 100)

    // Add dynamic field values
    ctx.fillStyle = "#333"
    ctx.font = "24px Arial"
    let yPosition = 200

    if (issuanceMode === "single") {
      selectedTemplate.fields.forEach((field) => {
        const value = certificateData.singleRecipient.fieldValues[field] || `[${field}]`
        ctx.fillText(`${field}: ${value}`, canvas.width / 2, yPosition)
        yPosition += 50
      })
    }

    // Add signature line
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2 - 100, canvas.height - 100)
    ctx.lineTo(canvas.width / 2 + 100, canvas.height - 100)
    ctx.stroke()

    ctx.fillStyle = "#666"
    ctx.font = "16px Arial"
    ctx.fillText("Authorized Signature", canvas.width / 2, canvas.height - 70)
  }

  const handlePreview = () => {
    setShowPreview(true)
    setTimeout(() => {
      generateCertificatePreview()
    }, 100)
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a certificate template first.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // Simulate certificate generation
    setTimeout(() => {
      const certificates = []

      if (issuanceMode === "single") {
        certificates.push({
          id: Date.now(),
          recipient: certificateData.singleRecipient.email,
          template: selectedTemplate.name,
          fieldValues: certificateData.singleRecipient.fieldValues,
          status: "generated",
        })
      } else {
        // Parse CSV data for bulk generation
        const lines = certificateData.bulkRecipients.csvData.split("\n").filter((line) => line.trim())
        const headers = lines[0]?.split(",") || []

        lines.slice(1).forEach((line, index) => {
          const values = line.split(",")
          const fieldValues: Record<string, string> = {}

          headers.forEach((header, headerIndex) => {
            const mappedField = certificateData.bulkRecipients.fieldMapping[header.trim()]
            if (mappedField && values[headerIndex]) {
              fieldValues[mappedField] = values[headerIndex].trim()
            }
          })

          certificates.push({
            id: Date.now() + index,
            recipient: values[0]?.trim() || `recipient${index + 1}@example.com`,
            template: selectedTemplate.name,
            fieldValues,
            status: "generated",
          })
        })
      }

      setGeneratedCertificates(certificates)
      setIsLoading(false)
      toast({
        title: "Certificates generated!",
        description: `${certificates.length} certificate(s) have been generated successfully.`,
      })
    }, 2000)
  }

  const handleIssueCertificates = async () => {
    setIsLoading(true)

    // Simulate blockchain minting
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Certificates issued successfully!",
        description: `${generatedCertificates.length} certificate(s) have been minted and sent to recipients.`,
      })
      setGeneratedCertificates([])
    }, 3000)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Issue Certificates</h1>
        <p className="text-gray-600">Generate and issue certificates using your saved templates.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Template</CardTitle>
              <CardDescription>Choose a certificate template to use</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplate?.id.toString() || ""} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a certificate template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">{selectedTemplate.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{selectedTemplate.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.fields.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Entry */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Certificate Data</CardTitle>
                <CardDescription>Enter the data for certificate generation</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={issuanceMode} onValueChange={(value: any) => setIssuanceMode(value)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">Single Certificate</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Certificates</TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipientEmail">Recipient Email *</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        placeholder="recipient@example.com"
                        value={certificateData.singleRecipient.email}
                        onChange={(e) =>
                          setCertificateData((prev) => ({
                            ...prev,
                            singleRecipient: { ...prev.singleRecipient, email: e.target.value },
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-4">
                      <Label>Dynamic Field Values</Label>
                      {selectedTemplate.fields.map((field) => (
                        <div key={field} className="space-y-2">
                          <Label htmlFor={field}>{field} *</Label>
                          <Input
                            id={field}
                            placeholder={`Enter ${field.toLowerCase()}`}
                            value={certificateData.singleRecipient.fieldValues[field] || ""}
                            onChange={(e) => updateSingleRecipientField(field, e.target.value)}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="bulk" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="csvData">CSV Data *</Label>
                      <Textarea
                        id="csvData"
                        placeholder="email,name,course,date&#10;john@example.com,John Doe,JavaScript Basics,2024-01-15&#10;jane@example.com,Jane Smith,React Advanced,2024-01-15"
                        rows={8}
                        value={certificateData.bulkRecipients.csvData}
                        onChange={(e) =>
                          setCertificateData((prev) => ({
                            ...prev,
                            bulkRecipients: { ...prev.bulkRecipients, csvData: e.target.value },
                          }))
                        }
                      />
                      <p className="text-xs text-gray-500">
                        First row should contain column headers. First column should be email addresses.
                      </p>
                    </div>

                    {certificateData.bulkRecipients.csvData && (
                      <div className="space-y-4">
                        <Label>Field Mapping</Label>
                        <p className="text-sm text-gray-600">Map your CSV columns to certificate fields:</p>
                        {selectedTemplate.fields.map((field) => (
                          <div key={field} className="grid grid-cols-2 gap-4 items-center">
                            <Label>{field}</Label>
                            <Select
                              value={certificateData.bulkRecipients.fieldMapping[field] || ""}
                              onValueChange={(value) =>
                                setCertificateData((prev) => ({
                                  ...prev,
                                  bulkRecipients: {
                                    ...prev.bulkRecipients,
                                    fieldMapping: { ...prev.bulkRecipients.fieldMapping, [field]: value },
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select CSV column" />
                              </SelectTrigger>
                              <SelectContent>
                                {certificateData.bulkRecipients.csvData
                                  .split("\n")[0]
                                  ?.split(",")
                                  .map((header, index) => (
                                    <SelectItem key={index} value={header.trim()}>
                                      {header.trim()}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Preview & Actions */}
        <div className="space-y-6">
          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Certificate Preview</CardTitle>
              <CardDescription>Preview how your certificate will look</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <div className="space-y-4">
                  {showPreview ? (
                    <canvas ref={canvasRef} className="w-full border rounded-lg" style={{ maxHeight: "300px" }} />
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Click preview to see certificate</p>
                    </div>
                  )}
                  <Button onClick={handlePreview} variant="outline" className="w-full bg-transparent">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Certificate
                  </Button>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Select a template to preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Generate and issue certificates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleGenerate}
                className="w-full"
                style={{ backgroundColor: "#9681FA" }}
                disabled={!selectedTemplate || isLoading}
              >
                <FileText className="h-4 w-4 mr-2" />
                {isLoading ? "Generating..." : "Generate Certificates"}
              </Button>

              {generatedCertificates.length > 0 && (
                <>
                  <Button onClick={handleIssueCertificates} className="w-full" disabled={isLoading}>
                    <Send className="h-4 w-4 mr-2" />
                    {isLoading ? "Issuing..." : `Issue ${generatedCertificates.length} Certificate(s)`}
                  </Button>

                  <div className="text-sm text-gray-600">
                    <p className="font-medium">Generated Certificates:</p>
                    <ul className="mt-2 space-y-1">
                      {generatedCertificates.slice(0, 3).map((cert) => (
                        <li key={cert.id} className="text-xs">
                          • {cert.recipient}
                        </li>
                      ))}
                      {generatedCertificates.length > 3 && (
                        <li className="text-xs text-gray-500">... and {generatedCertificates.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
