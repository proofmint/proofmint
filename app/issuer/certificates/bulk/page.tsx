"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

interface Template { id: string; templateName: string; dynamicFields: any }
interface JobRow { id: string; status: string; totalItems: number; processedItems: number; failedItems: number; createdAt: string }

export default function BulkCertificatesPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState<string>("")
  const [csvText, setCsvText] = useState("")
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/templates")
      const data = await res.json()
      setTemplates(data)
    }
    load()
  }, [])

  const parseRecipients = () => {
    // Expected CSV columns: email, fieldName1, fieldName2, ... matching template dynamic fields
    const lines = csvText.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return [] as Array<{ email: string; fieldData: Record<string, string> }>
    const headers = lines[0].split(",").map((h) => h.trim())
    const rows = lines.slice(1)
    const recipients: Array<{ email: string; fieldData: Record<string, string> }> = []
    for (const line of rows) {
      const cols = line.split(",")
      const email = cols[0]?.trim()
      if (!email) continue
      const fieldData: Record<string, string> = {}
      headers.slice(1).forEach((h, idx) => {
        fieldData[h] = (cols[idx + 1] || "").trim()
      })
      recipients.push({ email, fieldData })
    }
    return recipients
  }

  const submitJob = async () => {
    const recipients = parseRecipients()
    if (!templateId) return toast({ title: "Select a template", variant: "destructive" })
    if (recipients.length === 0) return toast({ title: "Provide recipients CSV", variant: "destructive" })
    setSubmitting(true)
    try {
      const res = await fetch("/api/certificates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, recipients }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: "Job created" })
        // optional: trigger processing for demo env
        await fetch("/api/certificates/bulk/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: data.jobId }) })
        loadJobs()
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Failed", description: data.message ?? "", variant: "destructive" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const loadJobs = async () => {
    const res = await fetch("/api/certificates/bulk/jobs")
    if (res.ok) {
      const data = await res.json()
      setJobs(data.jobs ?? [])
    }
  }

  useEffect(() => { loadJobs() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bulk Certificate Issuance</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={(v) => setTemplateId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.templateName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recipients CSV</Label>
            <Input type="file" accept=".csv" onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const text = await f.text()
              setCsvText(text)
            }} />
          </div>
          <Button style={{ backgroundColor: "#9681FA" }} disabled={submitting} onClick={submitJob}>{submitting ? "Submitting..." : "Create Job"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.id}</TableCell>
                  <TableCell>{j.status}</TableCell>
                  <TableCell>{j.processedItems}/{j.totalItems} {j.failedItems ? `(failed: ${j.failedItems})` : ""}</TableCell>
                  <TableCell>{new Date(j.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}


