"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
} from "lucide-react";

export default function ReceiverDashboard() {
  const [stats, setStats] = useState([
    {
      title: "Total Credentials",
      value: 0,
      icon: <Eye className="h-4 w-4 text-gray-600" />,
    },
    {
      title: "Total Pending Credentials",
      value: 0,
      icon: <Clock className="h-4 w-4 text-yellow-500" />,
    },
    {
      title: "Total Claimed Credentials",
      value: 0,
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    },
    {
      title: "Total Rejected Credentials",
      value: 0,
      icon: <XCircle className="h-4 w-4 text-red-500" />,
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/receiver/dashboard");
        const data = await response.json();
        setStats([
          {
            title: "Total Credentials",
            value: data.totalCredentials,
            icon: <Eye className="h-4 w-4 text-gray-600" />,
          },
          {
            title: "Total Pending Credentials",
            value: data.totalPendingCredentials,
            icon: <Clock className="h-4 w-4 text-yellow-500" />,
          },
          {
            title: "Total Claimed Credentials",
            value: data.totalClaimedCredentials,
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          },
          {
            title: "Total Rejected Credentials",
            value: data.totalRejectedCredentials,
            icon: <XCircle className="h-4 w-4 text-red-500" />,
          },
        ]);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching stats:", error);
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Credentials</h1>
        <p className="text-gray-600">
          Manage and view all your digital badges and certificates.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats &&
          stats.map((stat: any, index: number) => (
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
