"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Upload,
  Loader2,
  AlertCircle,
  Download,
  FileText,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  Eye,
  X,
  Users,
  Info,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import Papa from "papaparse"

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

interface CSVRow {
  email: string
  fieldData: Record<string, string>
  _rowIndex: number
  _errors: string[]
}

interface PreviewState {
  rowIndex: number
  imageUrl: string | null
  isLoading: boolean
}

export default function BulkIssueCertificatePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
  const [bulkJob, setBulkJob] = useState<{ id: string; totalItems: number; status: string } | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [generatingRowIndex, setGeneratingRowIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewBlobUrls = useRef<Map<number, string>>(new Map())

  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Cleanup preview blob URLs on unmount
  useEffect(() => {
    return () => {
      previewBlobUrls.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch("/api/templates")
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setTemplates(data)
        const templateId = searchParams.get("template")
        if (templateId) {
          const t = data.find((t: Template) => t.id === templateId)
          if (t) setSelectedTemplate(t)
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
    const t = templates.find((t) => t.id === templateId)
    if (t) {
      setSelectedTemplate(t)
      setCsvFile(null)
      setParsedRows([])
      setParseErrors([])
    }
  }

  const parseCSVFile = (file: File, template: Template) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = []
        const rows: CSVRow[] = []
        const headers = results.meta.fields ?? []

        if (!headers.includes("email")) {
          errors.push('CSV is missing a required "email" column.')
        }

        const requiredFields = template.dynamicFields.map((f) => f.name)
        const missingCols = requiredFields.filter((f) => !headers.includes(f))
        if (missingCols.length > 0) {
          errors.push(`CSV is missing columns for: ${missingCols.join(", ")}`)
        }

        if (errors.length > 0) {
          setParseErrors(errors)
          setParsedRows([])
          return
        }

        let hasErrors = false
          ; (results.data as Record<string, string>[]).forEach((row, i) => {
            const rowErrors: string[] = []
            const email = row["email"]?.trim() ?? ""
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              rowErrors.push("Invalid email")
              hasErrors = true
            }
            const fieldData: Record<string, string> = {}
            for (const f of requiredFields) {
              const val = row[f]?.trim() ?? ""
              if (!val) {
                rowErrors.push(`"${f}" is empty`)
                hasErrors = true
              }
              fieldData[f] = val
            }
            rows.push({ email, fieldData, _rowIndex: i, _errors: rowErrors })
          })

        if (rows.length === 0) {
          errors.push("No data rows found in CSV.")
          setParseErrors(errors)
          setParsedRows([])
          return
        }

        setParseErrors(hasErrors ? [] : [])
        setParsedRows(rows)
        if (hasErrors) {
          toast({
            title: "CSV has validation issues",
            description: "Some rows have errors. Fix them before issuing.",
            variant: "destructive",
          })
        }
      },
      error: (err) => {
        setParseErrors([`Failed to parse CSV: ${err.message}`])
        setParsedRows([])
      },
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Invalid file type", description: "Please upload a CSV file.", variant: "destructive" })
      return
    }
    if (!selectedTemplate) {
      toast({ title: "Select a template first", description: "Choose a template before uploading.", variant: "destructive" })
      return
    }
    setCsvFile(file)
    setParsedRows([])
    setParseErrors([])
    // Revoke old blob urls
    previewBlobUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewBlobUrls.current.clear()
    parseCSVFile(file, selectedTemplate)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Invalid file type", description: "Please drop a CSV file.", variant: "destructive" })
      return
    }
    if (!selectedTemplate) {
      toast({ title: "Select a template first", description: "Choose a template before uploading.", variant: "destructive" })
      return
    }
    setCsvFile(file)
    setParsedRows([])
    setParseErrors([])
    previewBlobUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewBlobUrls.current.clear()
    parseCSVFile(file, selectedTemplate)
  }

  const downloadSampleCSV = () => {
    if (!selectedTemplate) return
    const headers = ["email", ...selectedTemplate.dynamicFields.map((f) => f.name)]
    const sampleRow = ["recipient@example.com", ...selectedTemplate.dynamicFields.map((f) => `Sample ${f.name}`)]
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedTemplate.templateName.replace(/\s+/g, "_")}_template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generateRowPreview = async (row: CSVRow) => {
    if (!selectedTemplate) return
    setGeneratingRowIndex(row._rowIndex)

    // Check cache
    if (previewBlobUrls.current.has(row._rowIndex)) {
      setPreviewState({ rowIndex: row._rowIndex, imageUrl: previewBlobUrls.current.get(row._rowIndex)!, isLoading: false })
      setGeneratingRowIndex(null)
      return
    }

    setPreviewState({ rowIndex: row._rowIndex, imageUrl: null, isLoading: true })

    try {
      const res = await fetch("/api/certificates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate.id, fieldData: row.fieldData }),
      })
      if (!res.ok) throw new Error("Preview failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      previewBlobUrls.current.set(row._rowIndex, url)
      setPreviewState({ rowIndex: row._rowIndex, imageUrl: url, isLoading: false })
    } catch {
      toast({ title: "Preview failed", description: "Could not generate preview for this row.", variant: "destructive" })
      setPreviewState(null)
    } finally {
      setGeneratingRowIndex(null)
    }
  }

  const handleBulkIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate || !csvFile) return

    const validRows = parsedRows.filter((r) => r._errors.length === 0)
    if (validRows.length === 0) {
      toast({ title: "No valid rows", description: "Fix CSV errors before issuing.", variant: "destructive" })
      return
    }
    if ((creditBalance ?? 0) < validRows.length) {
      toast({ title: "Insufficient credits", description: `You need ${validRows.length} credits but have ${creditBalance}.`, variant: "destructive" })
      return
    }

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append("templateId", selectedTemplate.id)
      formData.append("csvFile", csvFile)

      const response = await fetch("/api/certificates/bulk", { method: "POST", body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to start bulk issuance")

      setBulkJob(data.job)
      setCreditBalance((prev) => (prev ?? 0) - data.job.totalItems)
      toast({ title: "Bulk job started!", description: `Processing ${data.job.totalItems} certificates in the background.` })
    } catch (error) {
      toast({ title: "Failed to start bulk issuance", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const validRowCount = parsedRows.filter((r) => r._errors.length === 0).length
  const errorRowCount = parsedRows.filter((r) => r._errors.length > 0).length
  const hasInsufficientCredits = creditBalance !== null && validRowCount > 0 && creditBalance < validRowCount

  if (isLoadingTemplates) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (bulkJob) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-12">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Job Created</h2>
          <p className="text-gray-500 mt-2">
            {bulkJob.totalItems} certificate{bulkJob.totalItems !== 1 ? "s" : ""} are being processed in the background. Each recipient will receive an email when their certificate is ready.
          </p>
        </div>
        <Card className="text-left">
          <CardContent className="pt-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Job ID</span>
              <span className="font-mono text-xs text-gray-700">{bulkJob.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Certificates</span>
              <span className="font-medium">{bulkJob.totalItems}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <Badge variant="secondary">{bulkJob.status}</Badge>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3 justify-center">
          <Link href="/issuer/certificates/bulk/jobs">
            <Button variant="outline">Track Job Progress</Button>
          </Link>
          <Link href="/issuer/certificates">
            <Button style={{ backgroundColor: "#9681FA" }}>View Certificates</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Certificate Issuance</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload a CSV to issue certificates to multiple recipients at once.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Balance</span>
          {creditBalance === null ? (
            <Skeleton className="h-5 w-10" />
          ) : (
            <span className={`font-bold text-sm ${hasInsufficientCredits ? "text-red-600" : "text-gray-900"}`}>
              {creditBalance} credit{creditBalance !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {hasInsufficientCredits && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need <strong>{validRowCount}</strong> credits but only have <strong>{creditBalance}</strong>. Purchase more credits to proceed.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleBulkIssue} className="space-y-5">
        {/* Template Selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "#9681FA" }}>
                1
              </div>
              <CardTitle className="text-base">Select Certificate Template</CardTitle>
            </div>
            <CardDescription className="ml-8">Choose the design and field layout for all certificates in this batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                No templates found.{" "}
                <a href="/issuer/templates" className="underline text-[#9681FA]">
                  Create a template
                </a>{" "}
                first.
              </div>
            ) : (
              <Select value={selectedTemplate?.id || ""} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a certificate template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.templateName}
                    </SelectItem>
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
                  <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide font-medium">Required CSV Columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs font-mono">email</Badge>
                    {selectedTemplate.dynamicFields.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-mono">{f.name}</Badge>
                    ))}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={downloadSampleCSV} className="text-xs h-7">
                  <Download className="h-3 w-3 mr-1.5" />
                  Download Sample CSV
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CSV Upload */}
        {selectedTemplate && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "#9681FA" }}>
                  2
                </div>
                <CardTitle className="text-base">Upload Recipient CSV</CardTitle>
              </div>
              <CardDescription className="ml-8">
                Each row is one certificate. The file must include{" "}
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">email</span> and all required field columns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${csvFile ? "border-[#9681FA] bg-purple-50" : "border-gray-200 hover:border-[#9681FA] hover:bg-gray-50"
                  }`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {csvFile ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 text-[#9681FA] mx-auto" />
                    <p className="text-sm font-medium text-gray-800">{csvFile.name}</p>
                    <p className="text-xs text-gray-400">{(csvFile.size / 1024).toFixed(1)} KB</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCsvFile(null)
                        setParsedRows([])
                        setParseErrors([])
                        previewBlobUrls.current.forEach((url) => URL.revokeObjectURL(url))
                        previewBlobUrls.current.clear()
                        if (fileInputRef.current) fileInputRef.current.value = ""
                      }}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 text-gray-300 mx-auto" />
                    <p className="text-sm font-medium text-gray-600">Drop CSV here or click to browse</p>
                    <p className="text-xs text-gray-400">CSV files only</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-0.5">
                      {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Data Review Table */}
        {parsedRows.length > 0 && selectedTemplate && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "#9681FA" }}>
                    3
                  </div>
                  <CardTitle className="text-base">Review Recipients</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""}</span>
                  </div>
                  {errorRowCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {errorRowCount} error{errorRowCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {validRowCount > 0 && (
                    <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                      {validRowCount} valid
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="ml-8">
                Click <Eye className="inline h-3 w-3" /> on any row to preview how that certificate will look.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-10">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Email</th>
                      {selectedTemplate.dynamicFields.map((f) => (
                        <th key={f.name} className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 capitalize">
                          {f.name}
                        </th>
                      ))}
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-24">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => (
                      <tr
                        key={row._rowIndex}
                        className={`border-b border-gray-50 last:border-0 ${row._errors.length > 0 ? "bg-red-50" : "hover:bg-gray-50"
                          }`}
                      >
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{row._rowIndex + 1}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {row._errors.length > 0 && (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                <p className="text-xs text-red-400 mt-0.5">{row._errors.join(" · ")}</p>
                              </>
                            )}
                            <span className={`font-mono text-xs truncate max-w-[180px] md:max-w-[240px] ${row._errors.length > 0 ? "text-red-600" : "text-gray-700"}`}>
                              {row.email || <span className="text-red-400 italic">missing</span>}
                            </span>
                          </div>
                          {row._errors.length > 0 && (
                            <p className="text-xs text-red-400 mt-0.5">{row._errors.join(" · ")}</p>
                          )}
                        </td>
                        {selectedTemplate.dynamicFields.map((f) => (
                          <td key={f.name} className="px-3 py-2.5 text-gray-600 text-xs max-w-[140px] truncate">
                            {row.fieldData[f.name] || <span className="text-red-400 italic">empty</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#9681FA] hover:text-[#7c68d4] hover:bg-purple-50"
                            onClick={() => generateRowPreview(row)}
                            disabled={generatingRowIndex === row._rowIndex}
                          >
                            {generatingRowIndex === row._rowIndex ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : previewBlobUrls.current.has(row._rowIndex) ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                View
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Summary & Submit */}
        {parsedRows.length > 0 && selectedTemplate && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">Issuance Summary</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>
                      <strong className="text-gray-900">{validRowCount}</strong> certificate{validRowCount !== 1 ? "s" : ""} to issue
                    </span>
                    <span>
                      Cost: <strong className="text-gray-900">{validRowCount}</strong> credit{validRowCount !== 1 ? "s" : ""}
                    </span>
                    <span className={hasInsufficientCredits ? "text-red-600" : "text-gray-600"}>
                      Balance after: <strong>{creditBalance !== null ? creditBalance - validRowCount : "—"}</strong>
                    </span>
                  </div>
                  {errorRowCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <Info className="h-3.5 w-3.5" />
                      {errorRowCount} row{errorRowCount !== 1 ? "s" : ""} with errors will be skipped.
                    </div>
                  )}
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    style={{ backgroundColor: "#9681FA" }}
                    disabled={isLoading || validRowCount === 0 || hasInsufficientCredits}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Issue {validRowCount} Certificate{validRowCount !== 1 ? "s" : ""}
                        <span className="ml-2 text-xs opacity-80 font-normal">({validRowCount} credits)</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>

      {/* Preview Dialog */}
      <Dialog open={!!previewState} onOpenChange={(open) => { if (!open) setPreviewState(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-[#9681FA]" />
              Certificate Preview
              {previewState && (
                <span className="text-sm font-normal text-gray-400">
                  — Row {previewState.rowIndex + 1}: {parsedRows[previewState.rowIndex]?.email}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {previewState?.isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#9681FA]" />
                <p className="text-sm text-gray-400">Generating preview…</p>
              </div>
            ) : previewState?.imageUrl ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewState.imageUrl}
                  alt="Certificate preview"
                  className="w-full rounded-lg border border-gray-100 shadow-sm"
                />
                <p className="text-xs text-center text-gray-400">
                  Preview only — not yet issued or stored on blockchain.
                </p>
                {previewState && parsedRows[previewState.rowIndex] && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Field values</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-400 flex-shrink-0">email</span>
                        <span className="font-mono text-gray-700 truncate">{parsedRows[previewState.rowIndex].email}</span>
                      </div>
                      {Object.entries(parsedRows[previewState.rowIndex].fieldData).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-gray-400 flex-shrink-0">{k}</span>
                          <span className="font-mono text-gray-700 truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
