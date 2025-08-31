"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CertificateTemplate } from "@prisma/client";
interface CertificateData {
  templateId: string | null;
  singleRecipient: {
    email: string;
    fieldValues: Record<string, string>;
  };
}

export default function CreateCertificatePage() {
  const [certificateData, setCertificateData] = useState<CertificateData>({
    templateId: null,
    singleRecipient: {
      email: "",
      fieldValues: {},
    },
  });
  const [generatedCertificates, setGeneratedCertificates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const searchParams = useSearchParams();
  const [selectedTemplate, setSelectedTemplate] =
    useState<CertificateTemplate | null>(null);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      const res = await fetch("/api/templates");
      const data = await res.json();
      console.log(data);
      setTemplates(data);
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch("/api/issuer/credits");
        const data = await res.json();
        setCreditBalance(data.creditBalance ?? 0);
      } catch (e) {
        setCreditBalance(0);
      }
    };
    fetchCredits();
  }, []);

  useEffect(() => {
    const templateId = searchParams.get("template");
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setSelectedTemplate(template);
        setCertificateData((prev) => ({
          ...prev,
          templateId: template.id,
        }));
      }
    }
  }, [searchParams, templates]);

  const fields = useMemo(() => {
    return (selectedTemplate?.dynamicFields as any[]) || [];
  }, [selectedTemplate]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setCertificateData((prev) => ({
        ...prev,
        templateId: template.id,
        singleRecipient: { ...prev.singleRecipient, fieldValues: {} },
      }));
    }
  };

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
    }));
  };

  const generateCertificatePreview = async (): Promise<string | null> => {
    if (!selectedTemplate || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Load background image
    const backgroundImage = new Image();
    backgroundImage.crossOrigin = "anonymous";
    backgroundImage.src = selectedTemplate.backgroundImageUrl;

    return new Promise((resolve) => {
      backgroundImage.onload = () => {
        // Draw background image
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // Draw dynamic fields
        fields.forEach((field: any) => {
          const value =
            certificateData.singleRecipient.fieldValues[field.name] ||
            `[${field.name}]`;

          // Set font properties
          ctx.font = `${field.fontWeight} ${field.fontSize}px Arial`;
          ctx.fillStyle = field.color;
          ctx.textAlign = field.textAlign as CanvasTextAlign;

          // Draw text at specified position
          ctx.fillText(value, field.x, field.y);
        });

        // Return the data URL of the canvas
        resolve(canvas.toDataURL("image/png"));
      };
    });
  };

  
  useEffect(() => {
    setTimeout(() => {
      console.log("generateCertificatePreview");
      generateCertificatePreview();
    }, 100);
  }, [certificateData]);

  const handlePreview = () => {
    setShowPreview(true);
    setTimeout(() => {
      generateCertificatePreview();
    }, 100);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a certificate template first.",
        variant: "destructive",
      });
      return;
    }

    // Ensure at least 1 credit available
    if ((creditBalance ?? 0) < 1) {
      toast({ title: "Insufficient credits", description: "You need at least 1 credit to issue a certificate.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    // Generate the certificate preview
    const previewDataUrl = await generateCertificatePreview();
    if (!previewDataUrl) {
      toast({
        title: "Failed to generate preview",
        description: "Could not generate the certificate preview.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Convert data URL to Blob
    const blob = await fetch(previewDataUrl).then((res) => res.blob());
    const file = new File([blob], "certificate.png", { type: "image/png" });

    // Create FormData for the API
    const formData = new FormData();
    formData.append("templateId", selectedTemplate.id);
    formData.append("recipientEmail", certificateData.singleRecipient.email);
    formData.append("certificateImage", file);

    const properties = fields.map((field: any) => ({
      key: field.name,
      value: certificateData.singleRecipient.fieldValues[field.name] || "",
    }));

    formData.append("properties", JSON.stringify(properties));

    try {
      const response = await fetch("/api/certificates/create", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: "Certificate generated!",
        description: "The certificate has been generated successfully.",
      });
      router.push(`/issuer/certificates`);
    } catch (error) {
      toast({
        title: "Failed to generate the certificate.",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Issue Certificates</h1>
        <p className="text-gray-600">
          Generate and issue certificates using your saved templates.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-2 space-y-6">
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
                value={selectedTemplate?.id.toString() || ""}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a certificate template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem
                      key={template.id}
                      value={template.id.toString()}
                    >
                      {template.templateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">
                    {selectedTemplate.templateName}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {selectedTemplate.templateDescription}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fields.map((field: any) => (
                      <Badge
                        key={field.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {field.name}
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
                <CardDescription>
                  Enter the data for certificate generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="recipient@example.com"
                    value={certificateData.singleRecipient.email}
                    onChange={(e) =>
                      setCertificateData((prev) => ({
                        ...prev,
                        singleRecipient: {
                          ...prev.singleRecipient,
                          email: e.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-4">
                  <Label>Dynamic Field Values</Label>
                  {fields.map((field: any) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>{field.name} *</Label>
                      <Input
                        id={field.id}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                        value={
                          certificateData.singleRecipient.fieldValues[
                            field.name
                          ] || ""
                        }
                        onChange={(e) =>
                          updateSingleRecipientField(field.name, e.target.value)
                        }
                        required
                      />
                    </div>
                  ))}
                </div>
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
              <CardDescription>
                Preview how your certificate will look
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTemplate ? (
                <div className="space-y-4">
                  {showPreview ? (
                    <canvas
                      ref={canvasRef}
                      className="w-full border rounded-lg"
                      style={{ maxHeight: "300px" }}
                    />
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">
                        Click preview to see certificate
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={handlePreview}
                    variant="outline"
                    className="w-full bg-transparent"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Certificate
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    className="w-full"
                    style={{ backgroundColor: "#9681FA" }}
                    disabled={!selectedTemplate || isLoading}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {isLoading ? "Generating..." : "Generate Certificates"}
                  </Button>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Select a template to preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
