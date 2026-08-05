"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    api
      .getDashboard()
      .then((data) => setStats(data as DashboardStats))
      .catch((err: any) => setError(err.message || "Failed to load dashboard"));
  }, [router]);

  function statusVariant(status: string) {
    if (status === "completed") return "success";
    if (status === "failed") return "destructive";
    if (status === "processing") return "warning";
    return "muted";
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <Link href="/admin/knowledge-base">
          <Button variant="outline">Manage Knowledge Base</Button>
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Uploaded PDFs</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats?.totalUploadedPdfs ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Chat Sessions</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats?.totalChatSessions ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Questions Asked</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats?.totalQuestionsAsked ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats?.recentUploadedDocuments.length ?? "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Recently Uploaded Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.recentUploadedDocuments.map((doc) => (
                <TableRow key={doc._id}>
                  <TableCell>{doc.fileName}</TableCell>
                  <TableCell>{new Date(doc.uploadDate).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(doc.processingStatus) as any}>
                      {doc.processingStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {stats && stats.recentUploadedDocuments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
