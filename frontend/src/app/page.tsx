"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, GraduationCap, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { CourseListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/PageWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Brilliant-style gradient palette per card
const CARD_GRADIENTS = [
  "from-emerald-500/10 to-teal-500/10",
  "from-blue-500/10 to-indigo-500/10",
  "from-purple-500/10 to-pink-500/10",
  "from-amber-500/10 to-orange-500/10",
  "from-rose-500/10 to-red-500/10",
  "from-cyan-500/10 to-sky-500/10",
];

const CARD_ACCENTS = [
  "border-emerald-200/60 hover:border-emerald-300",
  "border-blue-200/60 hover:border-blue-300",
  "border-purple-200/60 hover:border-purple-300",
  "border-amber-200/60 hover:border-amber-300",
  "border-rose-200/60 hover:border-rose-300",
  "border-cyan-200/60 hover:border-cyan-300",
];

const ICON_COLORS = [
  "text-emerald-600",
  "text-blue-600",
  "text-purple-600",
  "text-amber-600",
  "text-rose-600",
  "text-cyan-600",
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: api.listCourses,
  });

  const createMutation = useMutation({
    mutationFn: api.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      toast.success("Course created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName, description: newDesc || undefined });
  };

  return (
    <PageWrapper>
      {/* Hero section */}
      <div className="mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold tracking-tight">
            Your <span className="gradient-text">Learning</span> Dashboard
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Pick up where you left off, or start something new.
          </p>
        </motion.div>
      </div>

      {/* Create Course Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>
              Set up a new course to start uploading materials and studying.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Course Name
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Thermodynamics 101"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Description
              </label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of the course..."
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                variant="brilliant"
                disabled={createMutation.isPending}
                className="flex-1"
              >
                {createMutation.isPending ? "Creating..." : "Create Course"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        // Skeleton loader
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse"
            />
          ))}
        </div>
      ) : !courses?.length ? (
        // Empty state
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-10 h-10 text-emerald-500" />
            </div>
          </motion.div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Start your learning journey
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create your first course, upload materials, and let AI help you master the content.
          </p>
          <Button variant="brilliant" size="lg" onClick={() => setShowCreate(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Course
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-min">
            {/* New Course card — always first */}
            <motion.button
              onClick={() => setShowCreate(true)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-2xl border-2 border-dashed border-gray-300 hover:border-emerald-400 bg-white/50 hover:bg-emerald-50/50 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px] transition-colors group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                <Plus className="w-7 h-7 text-gray-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <span className="font-semibold text-gray-500 group-hover:text-emerald-700 transition-colors">
                New Course
              </span>
            </motion.button>

            {/* Course bento cards */}
            <AnimatePresence mode="popLayout">
              {courses.map((course: CourseListItem, i: number) => {
                const colorIdx = i % CARD_GRADIENTS.length;
                const isLarge = i === 0; // First course gets featured size
                return (
                  <motion.div
                    key={course.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: (i + 1) * 0.08, type: "spring", stiffness: 300, damping: 30 }}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className={isLarge ? "md:col-span-2 lg:col-span-2 md:row-span-1" : ""}
                  >
                    <Link
                      href={`/courses/${course.id}`}
                      className={`block rounded-2xl border bg-gradient-to-br ${CARD_GRADIENTS[colorIdx]} ${CARD_ACCENTS[colorIdx]} p-6 h-full min-h-[200px] relative overflow-hidden group bento-glow`}
                    >
                      {/* Decorative circles */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-white/40 to-transparent opacity-60" />
                      <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/20" />

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm("Delete this course and ALL its data?")) {
                            deleteMutation.mutate(course.id);
                          }
                        }}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-white/60 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="relative z-[1]">
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center mb-4 shadow-sm">
                          <BookOpen className={`w-6 h-6 ${ICON_COLORS[colorIdx]}`} />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-gray-800 transition-colors">
                          {course.name}
                        </h3>

                        {course.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                            {course.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-auto">
                          <Badge variant="outline" className="bg-white/60">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {course.topic_count} topics
                          </Badge>
                          <Badge variant="outline" className="bg-white/60">
                            <FileText className="w-3 h-3 mr-1" />
                            {course.document_count} docs
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </PageWrapper>
  );
}
