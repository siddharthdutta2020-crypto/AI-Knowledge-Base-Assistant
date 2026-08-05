"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { DocumentItem } from "@/types";

export default function KnowledgeBasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("admin_token");
    if (!token) {
      router.push("/admin/login");
      return;
    }
    loadDocuments();
  }, [router]);

  async function loadDocuments(searchTerm = "") {
    try {
      const res = (await api.listDocuments(searchTerm)) as { documents: DocumentItem[] };
      setDocuments(res.documents);
    } catch (err: any) {
      setError(err.message || "Failed to load documents");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      await api.uploadDocument(file);
      await loadDocuments(search);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadDocuments(search);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteDocument(deleteTarget._id);
      setDeleteTarget(null);
      await loadDocuments(search);
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  }

  async function handleReprocess(id: string) {
    try {
      await api.reprocessDocument(id);
      await loadDocuments(search);
    } catch (err: any) {
      setError(err.message || "Reprocess failed");
    }
  }

  function statusVariant(status: string) {
    if (status === "completed") return "success";
    if (status === "failed") return "destructive";
    if (status === "processing") return "warning";
    return "muted";
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Knowledge Base Management</h1>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search PDFs by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Uploaded PDFs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc._id}>
                  <TableCell>{doc.fileName}</TableCell>
                  <TableCell>{new Date(doc.uploadDate).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(doc.processingStatus) as any}>
                      {doc.processingStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{doc.chunkCount ?? 0}</TableCell>
                  <TableCell className="flex gap-2">

  <Button
    size="sm"
    variant="outline"
    onClick={() =>
      window.open(
        `http://localhost:5001/uploads/${encodeURIComponent(doc.filePath)}`,
        "_blank"
      )
    }
  >
    View PDF
  </Button>

  <Button
    size="sm"
    variant="outline"
    onClick={() => handleReprocess(doc._id)}
  >
    Reprocess
  </Button>

  <Button
    size="sm"
    variant="destructive"
    onClick={() => setDeleteTarget(doc)}
  >
    Delete
  </Button>

</TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No PDFs uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.fileName}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the file and its indexed data. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
