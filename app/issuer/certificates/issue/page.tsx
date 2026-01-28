"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { FileText, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

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

export default function IssueCertificatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [fieldData, setFieldData] = useState<Record<string, string>>({})
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  
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
      setFieldData({})
    }
  }

  const updateFieldData = (fieldName: string, value: string) => {
    setFieldData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
  }

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a certificate template first.",
        variant: "destructive",
      })
      return
    }

    if (!recipientEmail) {
      toast({
        title: "Missing recipient email",
        description: "Please enter the recipient's email address.",
        variant: "destructive",
      })
      return
    }

    // Check if all required fields are filled
    const missingFields = selectedTemplate.dynamicFields.filter(
      (field) => !fieldData[field.name]
    )
    if (missingFields.length > 0) {
      toast({
        title: "Missing field data",
        description: `Please fill in: ${missingFields.map(f => f.name).join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Check credit balance
    if ((creditBalance ?? 0) < 1) {
      toast({
        title: "Insufficient credits",
        description: "You need at least 1 credit to issue a certificate.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/certificates/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          recipientEmail,
          fieldData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to issue certificate")
      }

      toast({
        title: "Certificate issued successfully!",
        description: `Certificate has been minted and sent to ${recipientEmail}`,
      })
      
      // Update credit balance
      setCreditBalance((prev) => (prev ?? 0) - 1)
      
      router.push("/issuer/certificates")
    } catch (error) {
      toast({
        title: "Failed to issue certificate",
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
        <h1 className="text-3xl font-bold text-gray-900">Issue Single Certificate</h1>
        <p className="text-gray-600">
          Generate and mint a certificate for one recipient
        </p>
      </div>

      {/* Credit Balance Alert */}
      {creditBalance !== null && creditBalance < 1 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Insufficient credits. You need at least 1 credit to issue a certificate.
            Current balance: {creditBalance} credits.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleIssueCertificate} className="space-y-6">
        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Template</CardTitle>
            <CardDescription>
              Choose a certificate template to use
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
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.dynamicFields.map((field, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {field.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipient Information */}
        {selectedTemplate && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Recipient Information</CardTitle>
                <CardDescription>
                  Enter the recipient's email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="recipient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* Certificate Data */}
            <Card>
              <CardHeader>
                <CardTitle>Certificate Data</CardTitle>
                <CardDescription>
                  Fill in the dynamic field values for this certificate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedTemplate.dynamicFields.map((field, index) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={field.name}>{field.name} *</Label>
                      <Input
                        id={field.name}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                        value={fieldData[field.name] || ""}
                        onChange={(e) => updateFieldData(field.name, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                disabled={isLoading || (creditBalance ?? 0) < 1}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Issuing Certificate...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Issue Certificate (1 credit)
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
