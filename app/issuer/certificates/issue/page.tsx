"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  CreditCard,
  Mail,
  CheckCircle2,
  Upload,
  Database,
  ArrowLeft,
  Info,
  RefreshCw,
  Plus,
  X,
} from "lucide-react"
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

interface CustomProperty {
  key: string
  value: string
}

const STEPS = [
  { num: 1, label: "Select Template" },
  { num: 2, label: "Recipient" },
  { num: 3, label: "Certificate Data" },
]

export default function IssueCertificatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [fieldData, setFieldData] = useState<Record<string, string>>({})
  const [certificateName, setCertificateName] = useState("")
  const [unitName, setUnitName] = useState("")
  const [description, setDescription] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>([])
  const [newProperty, setNewProperty] = useState({ key: "", value: "" })
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [issuedCertificate, setIssuedCertificate] = useState<{ id: string; assetId?: string; imageCid: string | null } | null>(null)
  const prevPreviewUrl = useRef<string | null>(null)

  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    return () => {
      if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current)
    }
  }, [])

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/templates")
        if (!res.ok) throw new Error("Failed to fetch templates")
        const data = await res.json()
        setTemplates(data)
        const templateId = searchParams.get("template")
        if (templateId) {
          const template = data.find((t: Template) => t.id === templateId)
          if (template) setSelectedTemplate(template)
        }
      } catch {
        toast({ title: "Error", description: "Failed to load templates", variant: "destructive" })
      } finally {
        setIsLoadingTemplates(false)
      }
    }
    fetchTemplates()
  }, [searchParams, toast])

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/issuer/credits")
        const data = await res.json()
        setCreditBalance(data.creditBalance ?? 0)
      } catch {
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
      setPreviewUrl(null)
    }
  }

  const updateFieldData = (fieldName: string, value: string) => {
    setFieldData((prev) => ({ ...prev, [fieldName]: value }))
  }

  const addCustomProperty = () => {
    if (!newProperty.key || !newProperty.value) return
    const templateFieldNames = selectedTemplate?.dynamicFields.map((f) => f.name) ?? []
    if (templateFieldNames.includes(newProperty.key)) {
      toast({
        title: "Key conflict",
        description: `"${newProperty.key}" is already a template field name. Choose a different key.`,
        variant: "destructive",
      })
      return
    }
    if (customProperties.some((p) => p.key === newProperty.key)) {
      toast({ title: "Duplicate key", description: "A property with this key already exists.", variant: "destructive" })
      return
    }
    setCustomProperties((prev) => [...prev, { ...newProperty }])
    setNewProperty({ key: "", value: "" })
  }

  const removeCustomProperty = (index: number) => {
    setCustomProperties((prev) => prev.filter((_, i) => i !== index))
  }

  const generatePreview = useCallback(async () => {
    if (!selectedTemplate) return
    setIsGeneratingPreview(true)
    try {
      const res = await fetch("/api/certificates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate.id, fieldData }),
      })
      if (!res.ok) throw new Error("Preview failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (prevPreviewUrl.current) URL.revokeObjectURL(prevPreviewUrl.current)
      prevPreviewUrl.current = url
      setPreviewUrl(url)
    } catch {
      toast({ title: "Preview failed", description: "Could not generate preview image.", variant: "destructive" })
    } finally {
      setIsGeneratingPreview(false)
    }
  }, [selectedTemplate, fieldData, toast])

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTemplate) {
      toast({ title: "No template selected", description: "Please select a certificate template first.", variant: "destructive" })
      return
    }
    if (!recipientEmail) {
      toast({ title: "Missing recipient email", description: "Please enter the recipient's email address.", variant: "destructive" })
      return
    }
    if (!certificateName.trim()) {
      toast({ title: "Missing certificate name", description: "Please enter a certificate name.", variant: "destructive" })
      return
    }
    if (certificateName.trim().length > 32) {
      toast({ title: "Certificate name too long", description: "Please enter a certificate name with less than 32 characters.", variant: "destructive" })
      return
    }
    if (!unitName.trim()) {
      toast({ title: "Missing unit name", description: "Please enter a unit name.", variant: "destructive" })
      return
    }
    if (unitName.trim().length > 8) {
      toast({ title: "Unit name too long", description: "Please enter a unit name with less than 8 characters.", variant: "destructive" })
      return
    }
    if (!description.trim()) {
      toast({ title: "Missing description", description: "Please enter a description.", variant: "destructive" })
      return
    }
    const missingFields = selectedTemplate.dynamicFields.filter((f) => !fieldData[f.name])
    if (missingFields.length > 0) {
      toast({ title: "Missing field data", description: `Please fill in: ${missingFields.map((f) => f.name).join(", ")}`, variant: "destructive" })
      return
    }
    if ((creditBalance ?? 0) < 1) {
      toast({ title: "Insufficient credits", description: "You need at least 1 credit to issue a certificate.", variant: "destructive" })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          recipientEmail,
          fieldData,
          customProperties,
          certificateName: certificateName.trim(),
          unitName: unitName.trim(),
          description: description.trim(),
          sendEmail,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to issue certificate")

      setIssuedCertificate(data.certificate)
      setCreditBalance((prev) => (prev ?? 0) - 1)
      toast({ title: "Certificate issued!", description: `Minted and sent to ${recipientEmail}` })
    } catch (error) {
      toast({ title: "Failed to issue certificate", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const activeStep = !selectedTemplate ? 1 : !recipientEmail ? 2 : 3

  if (isLoadingTemplates) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (issuedCertificate) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-12">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Certificate Issued Successfully</h2>
          <p className="text-gray-500 mt-2">The certificate has been minted on Algorand. The recipient can now claim it.</p>
        </div>
        <Card className="text-left">
          <CardContent className="pt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Certificate ID</span>
              <span className="font-mono text-xs text-gray-700">{issuedCertificate.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Asset ID (Algorand)</span>
              <span className="font-mono font-medium">{issuedCertificate.assetId}</span>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => router.push("/issuer/certificates")}>
            View All Certificates
          </Button>
          <Button
            style={{ backgroundColor: "#9681FA" }}
            onClick={() => {
              setIssuedCertificate(null)
              setRecipientEmail("")
              setFieldData({})
              setCertificateName("")
              setUnitName("")
              setDescription("")
              setCustomProperties([])
              setPreviewUrl(null)
            }}
          >
            Issue Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Issue Certificate</h1>
          <p className="text-gray-500 text-sm mt-1">
            Generate a blockchain-verified certificate and deliver it to a recipient.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Balance</span>
          {creditBalance === null ? (
            <Skeleton className="h-5 w-10" />
          ) : (
            <span className={`font-bold text-sm ${creditBalance < 1 ? "text-red-600" : "text-gray-900"}`}>
              {creditBalance} credit{creditBalance !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {creditBalance !== null && creditBalance < 1 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have no credits remaining. Purchase more credits to issue certificates.
          </AlertDescription>
        </Alert>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  activeStep > step.num
                    ? "bg-green-500 text-white"
                    : activeStep === step.num
                    ? "text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
                style={activeStep === step.num ? { backgroundColor: "#9681FA" } : undefined}
              >
                {activeStep > step.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.num}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  activeStep === step.num ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-gray-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleIssueCertificate}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-5">
            {/* Step 1: Template */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#9681FA" }}>1</div>
                  <CardTitle className="text-base">Select Certificate Template</CardTitle>
                </div>
                <CardDescription className="ml-8">Choose the design and field layout for this certificate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No templates found.{" "}
                    <Link href="/issuer/templates" className="underline text-[#9681FA]">Create a template</Link> first.
                  </div>
                ) : (
                  <Select value={selectedTemplate?.id || ""} onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a certificate template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.templateName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {selectedTemplate && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <div>
                      <p className="font-medium text-sm text-gray-800">{selectedTemplate.templateName}</p>
                      {selectedTemplate.templateDescription && (
                        <p className="text-xs text-gray-500 mt-1">{selectedTemplate.templateDescription}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide font-medium">Dynamic Fields</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.dynamicFields.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{f.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Recipient */}
            {selectedTemplate && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#9681FA" }}>2</div>
                    <CardTitle className="text-base">Recipient Details</CardTitle>
                  </div>
                  <CardDescription className="ml-8">The certificate will be minted for this recipient.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientEmail" className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      Recipient Email <span className="text-red-500">*</span>
                    </Label>
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
            )}

            {/* Step 3: Certificate Details */}
            {selectedTemplate && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: "#9681FA" }}>3</div>
                    <CardTitle className="text-base">Certificate Details</CardTitle>
                  </div>
                  <CardDescription className="ml-8">Name, metadata, and dynamic field values for this certificate.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="certificateName">
                        Certificate Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="certificateName"
                        placeholder="e.g. Certificate of Completion"
                        value={certificateName}
                        onChange={(e) => setCertificateName(e.target.value)}
                        maxLength={32}
                        required
                      />
                      <p className="text-xs text-gray-400">Max 32 characters</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="unitName">
                        Unit Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="unitName"
                        placeholder="e.g. CERT"
                        value={unitName}
                        onChange={(e) => setUnitName(e.target.value)}
                        maxLength={8}
                        required
                      />
                      <p className="text-xs text-gray-400">Max 8 characters (Algorand NFT unit name)</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="description"
                      placeholder="e.g. Awarded for completing the Advanced React course"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  {/* Dynamic fields */}
                  {selectedTemplate.dynamicFields.length > 0 && (
                    <div className="border-t border-gray-100 pt-4 space-y-4">
                      <p className="text-sm font-medium text-gray-700">Template Fields</p>
                      {selectedTemplate.dynamicFields.map((field, index) => (
                        <div key={index} className="space-y-1.5">
                          <Label htmlFor={field.name} className="capitalize">
                            {field.name} <span className="text-red-500">*</span>
                          </Label>
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
                  )}
                </CardContent>
              </Card>
            )}

            {/* Custom Properties */}
            {selectedTemplate && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Additional Properties</CardTitle>
                  <CardDescription>Add custom metadata to this certificate (stored on IPFS). Keys cannot match template field names.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customProperties.map((prop, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{prop.key}:</span>
                        <span className="ml-2 text-sm text-muted-foreground">{prop.value}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomProperty(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Property name (e.g., Grade)"
                      value={newProperty.key}
                      onChange={(e) => setNewProperty({ ...newProperty, key: e.target.value })}
                    />
                    <Input
                      placeholder="Property value (e.g., A+)"
                      value={newProperty.value}
                      onChange={(e) => setNewProperty({ ...newProperty, value: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={addCustomProperty} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Send Email toggle */}
            {selectedTemplate && (
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Send email notification</p>
                      <p className="text-xs text-gray-500 mt-0.5">Notify the recipient by email after minting</p>
                    </div>
                    <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* What happens next */}
            {selectedTemplate && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium text-blue-800">What happens when you issue?</p>
                </div>
                <ol className="space-y-1.5 text-xs text-blue-700 list-none">
                  {[
                    { icon: <Eye className="h-3 w-3" />, text: "Certificate image is generated from your template" },
                    { icon: <Upload className="h-3 w-3" />, text: "Image & metadata uploaded to IPFS (decentralized storage)" },
                    { icon: <Database className="h-3 w-3" />, text: "NFT minted on the Algorand blockchain" },
                    { icon: <Mail className="h-3 w-3" />, text: "Recipient can claim the certificate from their dashboard" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-blue-400">{item.icon}</span>
                      {item.text}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Actions */}
            {selectedTemplate && (
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  style={{ backgroundColor: "#9681FA" }}
                  disabled={isLoading || (creditBalance ?? 0) < 1}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Issuing…</>
                  ) : (
                    <><FileText className="h-4 w-4 mr-2" />Issue Certificate<span className="ml-2 text-xs opacity-80 font-normal">(1 credit)</span></>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Right: Preview Panel */}
          <div className="lg:col-span-2 lg:sticky lg:top-6">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-gray-400" />
                    Certificate Preview
                  </CardTitle>
                  {selectedTemplate && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={generatePreview}
                      disabled={isGeneratingPreview}
                      className="text-xs h-7"
                    >
                      {isGeneratingPreview ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1">{previewUrl ? "Refresh" : "Generate"}</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {!selectedTemplate ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <div className="rounded-full bg-gray-100 p-4">
                      <FileText className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">Select a template to preview your certificate.</p>
                  </div>
                ) : isGeneratingPreview ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="aspect-[1.41/1] w-full rounded-lg" />
                  </div>
                ) : previewUrl ? (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Certificate preview" className="w-full rounded-lg border border-gray-100 shadow-sm" />
                    <p className="text-xs text-center text-gray-400">Preview only — not yet issued or stored on blockchain.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                    <div className="rounded-full bg-purple-50 p-4">
                      <Eye className="h-8 w-8 text-[#9681FA]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Generate a preview</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Fill in the fields above, then click{" "}
                        <span className="font-medium text-[#9681FA]">Generate</span> to see how your certificate will look.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={generatePreview}
                      disabled={isGeneratingPreview}
                      className="text-xs border-[#9681FA] text-[#9681FA] hover:bg-purple-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Generate Preview
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedTemplate && (
              <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issuance Cost</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost</span>
                  <span className="font-medium">1 credit</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current balance</span>
                  <span className={`font-medium ${(creditBalance ?? 0) < 1 ? "text-red-600" : "text-gray-900"}`}>
                    {creditBalance ?? "—"} credits
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                  <span className="text-gray-600">Balance after</span>
                  <span className={`font-bold ${((creditBalance ?? 0) - 1) < 0 ? "text-red-600" : "text-gray-900"}`}>
                    {creditBalance !== null ? creditBalance - 1 : "—"} credits
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
