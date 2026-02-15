"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, GraduationCap, Trophy } from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageWrapper } from "@/components/PageWrapper";

const levelConfig: Record<string, { label: string; variant: "purple" | "blue" | "warning" | "destructive"; gradient: string }> = {
  FLASHCARD: { label: "Flashcard", variant: "purple", gradient: "from-purple-500 to-pink-500" },
  LEVEL1: { label: "Level 1", variant: "blue", gradient: "from-blue-500 to-indigo-500" },
  LEVEL2: { label: "Level 2", variant: "warning", gradient: "from-amber-500 to-orange-500" },
  EXAM: { label: "Full Exam", variant: "destructive", gradient: "from-red-500 to-rose-500" },
};

export default function ResultsListPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["exam-sessions", courseId],
    queryFn: () => api.listExamSessions(courseId),
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <PageWrapper>
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to course
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Exam History</h1>
        <p className="text-gray-500 mt-1">Review your past exam sessions and track progress</p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !sessions?.length ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center min-h-[40vh]"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
            <Trophy className="w-10 h-10 text-emerald-500" />
          </div>
          <p className="text-gray-500 mb-4">No exam sessions yet</p>
          <Button variant="brilliant" asChild>
            <Link href={`/courses/${courseId}/study`}>Start Studying</Link>
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, i) => {
            const pct = s.max_score
              ? (s.score || 0) / s.max_score * 100
              : null;
            const config = levelConfig[s.level] || { label: s.level, variant: "secondary" as const, gradient: "from-gray-500 to-gray-600" };

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  href={`/courses/${courseId}/results/${s.id}`}
                  className="block rounded-2xl bg-white border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Level icon */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm`}>
                        <GraduationCap className="w-6 h-6 text-white" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          <Badge
                            variant={
                              s.status === "GRADED"
                                ? "success"
                                : s.status === "SUBMITTED"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {s.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(s.started_at)}
                          </span>
                          {s.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {s.duration_minutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    {s.score !== null && s.max_score ? (
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          pct !== null && pct >= 80
                            ? "text-emerald-600"
                            : pct !== null && pct >= 60
                              ? "text-amber-600"
                              : "text-red-500"
                        }`}>
                          {pct !== null ? `${pct.toFixed(0)}%` : "—"}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                          {s.score.toFixed(1)} / {s.max_score}
                        </div>
                        {pct !== null && (
                          <Progress
                            value={pct}
                            className="h-1 w-20 mt-1"
                            indicatorClassName={
                              pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-400"
                            }
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 font-medium">Pending</div>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageWrapper>
  );
}
