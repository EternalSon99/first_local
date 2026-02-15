"use client";

import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { FileType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/PageWrapper";

const FILE_TYPES: { value: FileType; label: string }[] = [
  { value: "TEXTBOOK", label: "Textbook" },
  { value: "TRANSCRIPT", label: "Transcript" },
  { value: "NOTES", label: "Notes" },
  { value: "SYLLABUS", label: "Syllabus" },
  { value: "SLIDES", label: "Slides" },
];

export default function DocumentsPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<FileType>("TEXTBOOK");
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", courseId],
    queryFn: () => api.listDocuments(courseId),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.deleteDocument(courseId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", courseId] });
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadDocument(courseId, file, selectedType);
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["documents", courseId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <PageWrapper>
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to course
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-gray-500 mt-1">Upload course materials for AI-powered study sessions</p>
      </motion.div>

      {/* Upload area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-300 bg-white p-8 mb-6 text-center transition-colors"
      >
        <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-700 mb-1">Drop files here or click to upload</p>
        <p className="text-xs text-gray-400 mb-4">PDF, TXT, DOCX, PPTX supported</p>

        <div className="flex items-center justify-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as FileType)}
            className="h-11 rounded-xl border-2 border-gray-200 px-4 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          >
            {FILE_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>{ft.label}</option>
            ))}
          </select>
          <label>
            <Button disabled={uploading} asChild>
              <span className="cursor-pointer">
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Choose File</>
                )}
              </span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.pptx"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </motion.div>

      {/* Documents */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !documents?.length ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No documents uploaded yet
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-4 group hover:shadow-sm transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{doc.file_name}</div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Badge variant="blue" className="text-[10px]">{doc.file_type}</Badge>
                  <span>{doc.chunk_count} chunks</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(doc.id); }}
                className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
