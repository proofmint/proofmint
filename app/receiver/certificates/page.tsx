"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Search, ExternalLink, Eye, Calendar, Download, CheckCircle, XCircle } from "lucide-react"

// Dummy certificate data
const certificates = [
  {
    id: 1,
    title: "Advanced JavaScript Course",
    issuer: "Tech Academy",
    description:
      "Completion certificate for Advanced JavaScript programming course covering ES6+, async programming, and modern frameworks.",
    status: "claimed",
    issuedDate: "2024-01-12",
    claimedDate: "2024-01-13",
    image: "/placeholder.svg?height=200&width=300&text=JS+Certificate",
    fieldValues: {
      "Recipient Name": "John Doe",
      "Course Title": "Advanced JavaScript Programming",
      "Date Issued": "January 12, 2024",
      Instructor: "Dr. Sarah Wilson",
    },
    blockchainUrl: "https://polygonscan.com/tx/0x123...",
  },
  {
    id: 2,
    title: "UX/UI Design Workshop",
    issuer: "Design Studio",
    description:
      "Certificate of attendance for comprehensive UX/UI Design Workshop covering user research, wireframing, and prototyping.",
    status: "claimed",
    issuedDate: "2024-01-08",
    claimedDate: "2024-01-09",
    image: "/placeholder.svg?height=200&width=300&text=Design+Certificate",
    fieldValues: {
      "Participant Name": "John Doe",
      "Workshop Title": "UX/UI Design Fundamentals",
      Duration: "16 hours",
      Date: "January 8-9, 2024",
    },
    blockchainUrl: "https://polygonscan.com/tx/0x456...",
  },
  {
    id: 3,
    title: "Digital Marketing Certification",
    issuer: "Marketing Institute",
    description:
      "Professional certification in digital marketing strategies, SEO, social media marketing, and analytics.",
    status: "pending",
    issuedDate: "2024-01-20",
    image: "/placeholder.svg?height=200&width=300&text=Marketing+Cert",
    fieldValues: {
      "Recipient Name": "John Doe",
      "Course Title": "Digital Marketing Professional",
      "Date Issued": "January 20, 2024",
      Instructor: "Prof. Michael Chen",
    },
  },
  {
    id: 4,
    title: "Project Management Fundamentals",
    issuer: "Business School",
    description:
      "Certificate of completion for Project Management Fundamentals course covering Agile, Scrum, and traditional methodologies.",
    status: "rejected",
    issuedDate: "2024-01-05",
    rejectedDate: "2024-01-06",
    image: "/placeholder.svg?height=200&width=300&text=PM+Certificate",
    fieldValues: {
      "Recipient Name": "John Doe",
      "Course Title": "Project Management Fundamentals",
      "Date Issued": "January 5, 2024",
      Instructor: "Lisa Anderson",
    },
  },
]

export default function CertificatesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedCertificate, setSelectedCertificate] = useState<(typeof certificates)[0] | null>(null)

  const filteredCertificates = certificates.filter((certificate) => {
    const matchesSearch =
      certificate.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      certificate.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      certificate.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || certificate.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleClaimCertificate = (id: number) => {
    console.log(`Claiming certificate ${id}`)
  }

  const handleRejectCertificate = (id: number) => {
    console.log(`Rejecting certificate ${id}`)
  }

  const handleDownloadCertificate = (certificate: (typeof certificates)[0]) => {
    // Simulate certificate download
    console.log(`Downloading certificate: ${certificate.title}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-gray-600">View and manage all your digital certificates.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredCertificates.map((certificate) => (
          <Card key={certificate.id} className="group hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img
                  src={certificate.image || "/placeholder.svg"}
                  alt={certificate.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{certificate.title}</CardTitle>
                  <CardDescription>Issued by {certificate.issuer}</CardDescription>
                </div>
                <Badge
                  variant={
                    certificate.status === "claimed"
                      ? "default"
                      : certificate.status === "pending"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {certificate.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{certificate.description}</p>

              {/* Certificate Details */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Certificate Details:</p>
                <div className="space-y-1">
                  {Object.entries(certificate.fieldValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Information */}
              <div className="text-xs text-gray-500">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {certificate.status === "claimed" && certificate.claimedDate
                    ? `Claimed on ${certificate.claimedDate}`
                    : certificate.status === "rejected" && certificate.rejectedDate
                      ? `Rejected on ${certificate.rejectedDate}`
                      : `Issued on ${certificate.issuedDate}`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                {certificate.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      style={{ backgroundColor: "#9681FA" }}
                      onClick={() => handleClaimCertificate(certificate.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Claim
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectCertificate(certificate.id)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}

                {certificate.status === "claimed" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 bg-transparent"
                      onClick={() => handleDownloadCertificate(certificate)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    {certificate.blockchainUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={certificate.blockchainUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Verify
                        </a>
                      </Button>
                    )}
                  </>
                )}

                <Button size="sm" variant="ghost" onClick={() => setSelectedCertificate(certificate)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCertificates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No certificates found matching your criteria.</p>
            <p className="text-sm text-gray-400">Try adjusting your search or filters.</p>
          </CardContent>
        </Card>
      )}

      {/* Certificate Detail Modal/Preview would go here */}
      {selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedCertificate.title}</CardTitle>
                  <CardDescription>Issued by {selectedCertificate.issuer}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCertificate(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <img
                src={selectedCertificate.image || "/placeholder.svg"}
                alt={selectedCertificate.title}
                className="w-full rounded-lg"
              />
              <p className="text-sm text-gray-600">{selectedCertificate.description}</p>

              <div>
                <h4 className="font-medium mb-2">Certificate Information:</h4>
                <div className="space-y-2">
                  {Object.entries(selectedCertificate.fieldValues).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCertificate.status === "claimed" && selectedCertificate.blockchainUrl && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => handleDownloadCertificate(selectedCertificate)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={selectedCertificate.blockchainUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Verify on Blockchain
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
