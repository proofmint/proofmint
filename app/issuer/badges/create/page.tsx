"use client";

import type React from "react";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Plus, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/contexts/SessionContext";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

const BADGE_MINT_COST_CREDITS = 1; // Cost per badge in credits
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface CustomProperty {
  key: string;
  value: string;
}

interface CreditDetails {
  creditBalance: number;
}

export default function CreateBadgePage() {
  const { user } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [badgeImage, setBadgeImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [newProperty, setNewProperty] = useState({ key: "", value: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [distributionMethod, setDistributionMethod] = useState("email");
  const [badgeType, setBadgeType] = useState("");
  const [recipients, setRecipients] = useState("");
  const [claimLimit, setClaimLimit] = useState("1");
  const [creditDetails, setCreditDetails] = useState<CreditDetails | null>(
    null
  );
  const [isCreditLoading, setIsCreditLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        setIsCreditLoading(true);
        const res = await fetch("/api/issuer/credits");
        if (!res.ok) throw new Error("Failed to fetch credits");
        const data = await res.json();
        setCreditDetails(data);
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Could not load credits.",
          variant: "destructive",
        });
      } finally {
        setIsCreditLoading(false);
      }
    };
    fetchCredits();
  }, [toast]);

  const validateField = (name: string, value: any) => {
    let error = "";
    if (name === "badgeName" && (value.length === 0 || value.length > 32))
      error = "Badge name must be 1-32 characters.";
    if (name === "unitName" && (value.length === 0 || value.length > 8))
      error = "Unit name must be 1-8 characters.";
    if (name === "description" && (value.length === 0 || value.length > 128))
      error = "Description must be 1-128 characters.";
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setBadgeImage(file);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      complete: (results) => {
        const emails = results.data
          .flat()
          .map((email) => email.trim())
          .filter((email) => email.length > 0);
        const previousEmails = recipients
          .trim()
          .split(",")
          .map((email) => email.trim());
        const emailsToBeAdded = emails
          .filter((email) => !previousEmails.includes(email))
          .join(", ");
        setRecipients((prev) =>
          prev ? `${prev}, ${emailsToBeAdded}` : emailsToBeAdded
        );
      },
      error: (err) => {
        toast({
          title: "CSV Error",
          description: err.message,
          variant: "destructive",
        });
      },
    });
    e.target.value = ""; // Reset file input
  };

  const recipientCount = useMemo(() => {
    if (distributionMethod === "magic") {
      return parseInt(claimLimit, 10) || 0;
    }
    return recipients.split(",").filter((email) => email.trim() !== "").length;
  }, [distributionMethod, recipients, claimLimit]);

  const estimatedCost = useMemo(
    () => recipientCount * BADGE_MINT_COST_CREDITS,
    [recipientCount]
  );

  const hasSufficientCredits =
    (creditDetails?.creditBalance ?? 0) >= estimatedCost;

  const addCustomProperty = () => {
    if (newProperty.key && newProperty.value) {
      setCustomProperties([...customProperties, { ...newProperty }]);
      setNewProperty({ key: "", value: "" });
    }
  };

  const removeCustomProperty = (index: number) => {
    setCustomProperties(customProperties.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    validateField("badgeName", form.badgeName.value);
    validateField("unitName", form.unitName.value);
    validateField("description", form.description.value);

    const hasErrors = Object.values(errors).some((error) => error !== "");
    if (hasErrors || !badgeImage || !user || !hasSufficientCredits) {
      toast({
        title: "Error",
        description:
          "Please fix the errors and ensure you have sufficient balance.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const formData = new FormData(form);
    formData.append("image", badgeImage);
    formData.append("customProperties", JSON.stringify(customProperties));
    formData.append("distributionMethod", distributionMethod);
    formData.append("badgeType", badgeType);
    formData.append("recipients", recipients);
    formData.append("claimLimit", claimLimit);

    try {
      const response = await fetch("/api/badges/create", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?._errors?.join(", ") ||
            result.error ||
            "An error occurred"
        );

      toast({ title: "Success!", description: "Badge creation successful." });
      router.push("/issuer/badges");
    } catch (error: any) {
      toast({
        title: "Error Creating Badge",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold">Create Badge</h1>
        <p className="text-muted-foreground">
          Design, configure, and issue a new digital badge.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Badge Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="badgeName">Badge Name *</Label>
                  <Input
                    id="badgeName"
                    name="badgeName"
                    required
                    maxLength={32}
                    onBlur={(e) => validateField("badgeName", e.target.value)}
                  />
                  {errors.badgeName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.badgeName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitName">Unit Name *</Label>
                  <Input
                    id="unitName"
                    name="unitName"
                    required
                    maxLength={8}
                    onBlur={(e) => validateField("unitName", e.target.value)}
                  />
                  {errors.unitName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.unitName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="badgeType">Badge Type *</Label>
                  <Select
                    required
                    onValueChange={setBadgeType}
                    value={badgeType}
                  >
                    <SelectTrigger id="badgeType">
                      <SelectValue placeholder="Select badge type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skill">Skill</SelectItem>
                      <SelectItem value="achievement">Achievement</SelectItem>
                      <SelectItem value="event">Event Attendance</SelectItem>
                      <SelectItem value="certification">
                        Certification
                      </SelectItem>
                      <SelectItem value="completion">
                        Course Completion
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    required
                    maxLength={128}
                    rows={4}
                    onBlur={(e) => validateField("description", e.target.value)}
                  />
                  {errors.description && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Properties</CardTitle>
                <CardDescription>
                  Add additional metadata to your badge.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {customProperties.map((property, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{property.key}:</span>
                      <span className="ml-2 text-muted-foreground">
                        {property.value}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomProperty(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Property name (e.g., Grade)"
                    value={newProperty.key}
                    onChange={(e) =>
                      setNewProperty({ ...newProperty, key: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Property value (e.g., A+)"
                    value={newProperty.value}
                    onChange={(e) =>
                      setNewProperty({ ...newProperty, value: e.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomProperty}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Badge Image</CardTitle>
              </CardHeader>
              <CardContent>
                <Label
                  htmlFor="image-upload"
                  className="relative block border-2 border-dashed border-muted-foreground rounded-lg p-6 text-center cursor-pointer hover:border-primary"
                >
                  <div className="space-y-2">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt="Badge Preview"
                        width={128}
                        height={128}
                        className="mx-auto rounded-md"
                      />
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                        <p>Click to upload (Under 5MB)</p>
                      </>
                    )}
                  </div>
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="sr-only hidden"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribution & Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={distributionMethod}
                  onValueChange={setDistributionMethod}
                  className="mb-4 grid grid-cols-2 gap-4"
                >
                  <Label className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer">
                    <RadioGroupItem value="email" id="r1" />
                    <span>Email List</span>
                  </Label>
                  <Label className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer">
                    <RadioGroupItem value="magic" id="r2" />
                    <span>Magic Link</span>
                  </Label>
                </RadioGroup>

                {distributionMethod === "email" ? (
                  <div className="space-y-2">
                    <Label htmlFor="recipients">Recipient Emails</Label>
                    <Textarea
                      id="recipients"
                      value={recipients}
                      onChange={(e) => setRecipients(e.target.value)}
                      placeholder="Emails, comma-separated"
                      rows={4}
                    />
                    <Label
                      htmlFor="csv-upload"
                      className="text-sm font-medium pt-2 block"
                    >
                      Or upload a CSV file
                    </Label>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="claimLimit">Number of Claims</Label>
                    <Input
                      id="claimLimit"
                      type="number"
                      value={claimLimit}
                      onChange={(e) => setClaimLimit(e.target.value)}
                      placeholder="e.g., 100"
                      min="1"
                    />
                  </div>
                )}

                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold">Cost Estimation</h4>
                  {isCreditLoading ? (
                    <p>Loading credits...</p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Credits Available:</span>
                        <span>{creditDetails?.creditBalance ?? 0} credits</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Badges to Mint:</span>
                        <span>{recipientCount}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Estimated Cost:</span>
                        <span>{estimatedCost} credits</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Credits After:</span>
                        <span>
                          {(creditDetails?.creditBalance ?? 0) - estimatedCost}
                        </span>
                      </div>
                      {!hasSufficientCredits && (
                        <div className="flex items-center text-red-600 mt-2 text-sm">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Insufficient credits for this issuance.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            style={{ backgroundColor: "#9681FA" }}
            disabled={
              isLoading || !hasSufficientCredits || recipientCount === 0
            }
          >
            {isLoading
              ? "Creating..."
              : `Create & Issue ${recipientCount} Badges`}
          </Button>
        </div>
      </form>
    </div>
  );
}
