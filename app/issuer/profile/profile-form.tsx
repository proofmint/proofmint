"use client";

import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  websiteUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// This type definition needs to be available in both server and client components.
// We can define it here and export it for the server component to use.
export type ProfileData = {
  fullName: string;
  email: string;
  organizationName: string;
  websiteUrl: string | null;
  walletAddress: string;
  balance: number;
  memberSince: Date;
};


export default function ProfileForm({ profileData }: { profileData: ProfileData }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profileData.fullName,
      organizationName: profileData.organizationName,
      websiteUrl: profileData.websiteUrl || "",
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/issuer/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Failed to update profile");
        }
        
        toast({
          title: "Success",
          description: "Your profile has been updated successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-gray-600">View and manage your profile details.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Controller
                name="fullName"
                control={control}
                render={({ field }: { field: any }) => <Input id="fullName" {...field} />}
              />
              {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Controller
                name="organizationName"
                control={control}
                render={({ field }: { field: any }) => <Input id="organizationName" {...field} />}
              />
              {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Controller
                name="websiteUrl"
                control={control}
                render={({ field }: { field: any }) => <Input id="websiteUrl" {...field} />}
              />
              {errors.websiteUrl && <p className="text-sm text-red-500">{errors.websiteUrl.message}</p>}
            </div>
            
            <div className="space-y-1 pt-4">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Email</p>
                <p className="text-sm text-foreground">{profileData.email}</p>
            </div>

            <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Wallet Address</p>
                <p className="text-sm text-foreground break-all">{profileData.walletAddress}</p>
            </div>
            
            <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Algo Balance</p>
                <p className="text-sm text-foreground">{profileData.balance.toFixed(4)} ALGO</p>
            </div>

            <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Member Since</p>
                <p className="text-sm text-foreground">
                {new Date(profileData.memberSince).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}
                </p>
            </div>

          </CardContent>
        </Card>
        <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={!isDirty || isPending}>
                {isPending ? "Saving..." : "Save Changes"}
            </Button>
        </div>
      </form>
    </div>
  );
}
