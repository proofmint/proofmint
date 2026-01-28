"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Upload, Loader2, AlertCircle, Download, FileText, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface DynamicField {
  name: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
}

interface Template {
  id: string
  templateName: string
  templateDescription: string
  backgroundImageUrl: string
  dynamicFields: DynamicField[]
}

interface BulkJob {
  id: string
  totalItems: number
  status: string
}

export default function BulkIssueCertificatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [bulkJob, setBulkJob] = useState<BulkJob | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/templates")
        if (!res.ok) throw new Error("Failed to fetch templates")
        const data = await res.json()
        setTemplates(data)
        
        // Auto-select template from URL if provided
        const templateId = searchParams.get("template")
        if (templateId) {
          const template = data.find((t: Template) => t.id === templateId)
          if (template) {
            setSelectedTemplate(template)
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load templates",
          variant: "destructive",
        })
      } finally {
        setIsLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [searchParams, toast])

  // Fetch credit balance
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/issuer/credits")
        const data = await res.json()
        setCreditBalance(data.creditBalance ?? 0)
      } catch (e) {
        setCreditBalance(0)
      }
    }
    fetchCredits()
  }, [])

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        })
        return
      }
      setCsvFile(file)
    }
  }

  const downloadSampleCSV = () => {
    if (!selectedTemplate) return

    // Create sample CSV content
    const headers = ["email", ...selectedTemplate.dynamicFields.map(f => f.name)]
    const sampleRow = [
      "recipient@example.com",
      ...selectedTemplate.dynamicFields.map(f => `Sample ${f.name}`)
    ]
    
    const csvContent = [
      headers.join(","),
      sampleRow.join(",")
    ].join("\n")

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedTemplate.templateName.replace(/\s+/g, "_")}_sample.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleBulkIssue = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a certificate template first.",
        variant: "destructive",
      })
      return
    }

    if (!csvFile) {
      toast({
        title: "No CSV file",
        description: "Please upload a CSV file with recipient data.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("templateId", selectedTemplate.id)
      formData.append("csvFile", csvFile)

      const response = await fetch("/api/certificates/bulk", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start bulk issuance")
      }

      setBulkJob(data.job)
      
      toast({
        title: "Bulk issuance started!",
        description: `Processing ${data.job.totalItems} certificates. This may take a few minutes.`,
      })
      
      // Update credit balance
      setCreditBalance((prev) => (prev ?? 0) - data.job.totalItems)
      
    } catch (error) {
      toast({
        title: "Failed to start bulk issuance",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingTemplates) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="ml-4 text-gray-500">Loading templates...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Certificate Issuance</h1>
        <p className="text-gray-600">
          Issue certificates to multiple recipients via CSV upload
        </p>
      </div>

      {/* Success Message */}
      {bulkJob && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Bulk job created successfully!</strong>
            <br />
            Job ID: {bulkJob.id}
            <br />
            Total certificates: {bulkJob.totalItems}
            <br />
            Status: {bulkJob.status}
            <br />
            <br />
            Certificates are being processed in the background. You can view the progress in the{" "}
            <Link href="/issuer/certificates" className="underline font-medium">
              certificates page
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {/* Credit Balance Alert */}
      {creditBalance !== null && creditBalance < 1 && !bulkJob && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Insufficient credits. Current balance: {creditBalance} credits.
          </AlertDescription>
        </Alert>
      )}

      {!bulkJob && (
        <form onSubmit={handleBulkIssue} className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Template</CardTitle>
              <CardDescription>
                Choose a certificate template to use for bulk issuance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedTemplate?.id || ""}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a certificate template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.templateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">{selectedTemplate.templateName}</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {selectedTemplate.templateDescription}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {selectedTemplate.dynamicFields.map((field, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {field.name}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadSampleCSV}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Sample CSV
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CSV Upload */}
          {selectedTemplate && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV File</CardTitle>
                  <CardDescription>
                    Upload a CSV file with recipient data. The file must include an "email" column
                    and columns for each dynamic field.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* File Upload Area */}
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#9681FA] transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {csvFile ? (
                        <div className="space-y-2">
                          <FileText className="h-12 w-12 text-[#9681FA] mx-auto" />
                          <p className="text-sm font-medium">{csvFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(csvFile.size / 1024).toFixed(2)} KB
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCsvFile(null)
                              if (fileInputRef.current) {
                                fileInputRef.current.value = ""
                              }
                            }}
                          >
                            Remove File
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                          <p className="text-sm text-gray-600">
                            Click to upload CSV file or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">CSV files only</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {/* CSV Format Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h4>
                      <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>First row must contain column headers</li>
                        <li>Must include an "email" column with recipient email addresses</li>
                        <li>
                          Must include columns for each dynamic field:{" "}
                          {selectedTemplate.dynamicFields.map(f => f.name).join(", ")}
                        </li>
                        <li>Each row represents one certificate to be issued</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Cost Preview */}
              {csvFile && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Preview</CardTitle>
                    <CardDescription>
                      Estimated credit cost for this bulk issuance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Current Balance</p>
                        <p className="text-2xl font-bold">{creditBalance ?? 0} credits</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Cost per Certificate</p>
                        <p className="text-2xl font-bold">1 credit</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  style={{ backgroundColor: "#9681FA" }}
                  disabled={isLoading || !csvFile || (creditBalance ?? 0) < 1}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting Bulk Issuance...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Start Bulk Issuance
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Return to Certificates Button */}
      {bulkJob && (
        <div className="flex justify-center">
          <Link href="/issuer/certificates">
            <Button style={{ backgroundColor: "#9681FA" }}>
              View Certificates
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
