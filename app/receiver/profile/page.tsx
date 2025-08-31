"use client";
import ProfileForm, { ProfileData } from "./profile-form";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfileData = async () => {
      const profileData = await fetch("/api/profile");
      if (!profileData.ok) {
        toast({
          title: "Error",
          description: "Failed to fetch profile data",
          variant: "destructive",
        });
      }
      const data = await profileData.json();
      setProfileData(data);
      setIsLoading(false);
    };
    fetchProfileData();
  }, [toast]);

  return <ProfileForm isLoading={isLoading} profileData={profileData} />;
}
