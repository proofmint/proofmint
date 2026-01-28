"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface BulkJob {
  id: string
  status: string
  totalItems: number
  processedItems: number
  failedItems: number
  createdAt: string
  updatedAt: string
  template: {
    templateName: string
  }
}

export default function BulkJobsPage() {
  const [jobs, setJobs] = useState<BulkJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/certificates/bulk/jobs")
      if (!res.ok) throw new Error("Failed to fetch bulk jobs")
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load bulk jobs",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchJobs, 10000)
    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case "PROCESSING":
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case "FAILED":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="ml-4 text-gray-500">Loading bulk jobs...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Issuance Jobs</h1>
          <p className="text-gray-600">
            Track the status of your bulk certificate issuance operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/issuer/certificates/bulk">
            <Button style={{ backgroundColor: "#9681FA" }}>
              New Bulk Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{job.template.templateName}</CardTitle>
                    <CardDescription>Job ID: {job.id}</CardDescription>
                  </div>
                  {getStatusBadge(job.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold">{job.totalItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Processed</p>
                    <p className="text-2xl font-bold text-green-600">{job.processedItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{job.failedItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Progress</p>
                    <p className="text-2xl font-bold">
                      {job.totalItems > 0
                        ? Math.round((job.processedItems / job.totalItems) * 100)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#9681FA] h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${job.totalItems > 0 ? (job.processedItems / job.totalItems) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-between text-sm text-gray-500">
                  <span>Created: {formatDate(job.createdAt)}</span>
                  <span>Updated: {formatDate(job.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">No bulk jobs found.</p>
            <Link href="/issuer/certificates/bulk">
              <Button style={{ backgroundColor: "#9681FA" }}>
                Start Your First Bulk Job
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
