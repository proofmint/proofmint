"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, FileText, Users, TrendingUp, Plus, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function IssuerDashboard() {
  const [stats, setStats] = useState([
    {
      title: "Total Badges Issued",
      value: 0,
      icon: <Award className="h-4 w-4 text-blue-600" />,
    },
    {
      title: "Total Certificates Issued",
      value: 0,
      icon: <FileText className="h-4 w-4 text-green-600" />,
    },
    {
      title: "Total Recipients",
      value: 0,
      icon: <Users className="h-4 w-4 text-purple-600" />,
    },
    {
      title: "Claim Rate",
      value: 0,
      icon: <TrendingUp className="h-4 w-4 text-orange-600" />,
    },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/issuer/dashboard");
        const data = await response.json();
        setStats([
          {
            title: "Total Badges Issued",
            value: data.totalBadgesIssued,
            icon: <Award className="h-4 w-4 text-blue-600" />,
          },
          {
            title: "Total Certificates Issued",
            value: data.totalCertificatesIssued,
            icon: <FileText className="h-4 w-4 text-green-600" />,
          },
          {
            title: "Total Recipients",
            value: data.totalRecipients,
            icon: <Users className="h-4 w-4 text-purple-600" />,
          },
          {
            title: "Claim Rate",
            value: `${data.claimRate.toFixed(2)}%`,
            icon: <TrendingUp className="h-4 w-4 text-orange-600" />,
          },
        ]);
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here's what's happening with your credentials.
          </p>
        </div>
        <div className="flex space-x-3">
          <Link href="/issuer/badges/create">
            <Button style={{ backgroundColor: "#9681FA" }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Badge
            </Button>
          </Link>
          <Link href="/issuer/certificates/create">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Issue Certificate
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              {stat.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
