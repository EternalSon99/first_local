"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle, ChevronRight, FileText, Trophy, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ExamQuestion, GradingFeedback } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageWrapper } from "@/components/PageWrapper";

export default function ExamResultsPage({
  params,
}: {
  params: { courseId: string; sessionId: string };
}) {
  const { courseId, sessionId } = params;

  const { data: results, isLoading } = useQuery({
    queryKey: ["exam-results", sessionId],
    queryFn: () => api.getExamResults(courseId, sessionId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!results) {
    return (
      <PageWrapper>
        <div className="text-center py-12 text-red-500">Results not found</div>
      </PageWrapper>
    );
  }

  const { session, total_score, max_total_score, percentage } = results;

  return (
    <PageWrapper>
      <Link
        href={`/courses/${courseId}/results`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to history
      </Link>

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl bg-white border border-gray-100 shadow-sm overflow-hidden mb-8"
      >
        <div className={`h-2 ${
          percentage >= 80
            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
            : percentage >= 60
              ? "bg-gradient-to-r from-amber-400 to-orange-500"
              : "bg-gradient-to-r from-red-400 to-rose-500"
        }`} />

        <div className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={
                  session.level === "EXAM" ? "destructive" :
                  session.level === "LEVEL2" ? "warning" :
                  session.level === "LEVEL1" ? "blue" : "purple"
                }>
                  {session.level.replace("_", " ")}
                </Badge>
                <Badge variant="success">Graded</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-1">Exam Results</h1>
              <p className="text-sm text-gray-400">
                {new Date(session.started_at).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-center"
            >
              <div className={`text-5xl font-bold ${
                percentage >= 80 ? "text-emerald-600" : percentage >= 60 ? "text-amber-600" : "text-red-500"
              }`}>
                {percentage.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400 font-medium mt-1">
                {total_score.toFixed(1)} / {max_total_score}
              </div>
            </motion.div>
          </div>

          <div className="mt-6">
            <Progress
              value={percentage}
              className="h-2"
              indicatorClassName={
                percentage >= 80 ? "bg-emerald-500" : percentage >= 60 ? "bg-amber-500" : "bg-red-400"
              }
            />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: "Questions", value: session.questions.length },
              { label: "Avg Score", value: `${(percentage).toFixed(0)}%` },
              {
                label: "Verdict",
                value: percentage >= 80 ? "Excellent" : percentage >= 60 ? "Passing" : "Needs Work",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center p-3 rounded-xl bg-gray-50"
              >
                <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                <div className="font-bold text-gray-700">{stat.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Question results */}
      <div className="space-y-4">
        {session.questions.map((q, i) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          >
            <QuestionResult question={q} />
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-3 justify-center mt-10 mb-4"
      >
        <Button variant="brilliant" asChild>
          <Link href={`/courses/${courseId}/study`}>
            <Trophy className="w-4 h-4 mr-2" />
            Study Again
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/courses/${courseId}`}>Back to Course</Link>
        </Button>
      </motion.div>
    </PageWrapper>
  );
}

function QuestionResult({ question }: { question: ExamQuestion }) {
  const [citationsExpanded, setCitationsExpanded] = useState(false);
  const feedback = question.feedback as GradingFeedback | null;
  const pct = question.max_score
    ? ((question.awarded_score || 0) / question.max_score) * 100
    : 0;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Question header */}
      <div className={`px-6 py-3 border-b border-gray-100 flex items-center justify-between ${
        pct >= 80
          ? "bg-gradient-to-r from-emerald-50 to-teal-50"
          : pct >= 60
            ? "bg-gradient-to-r from-amber-50 to-orange-50"
            : "bg-gradient-to-r from-red-50 to-rose-50"
      }`}>
        <div className="flex items-center gap-2">
          {pct >= 80 ? (
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          ) : pct >= 60 ? (
            <CheckCircle className="w-5 h-5 text-amber-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="font-bold text-sm">Question {question.question_number}</span>
        </div>
        <span className={`font-bold text-sm ${
          pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-500"
        }`}>
          {(question.awarded_score || 0).toFixed(1)} / {question.max_score}
        </span>
      </div>

      <div className="p-6">
        {/* Question text */}
        <p className="text-gray-800 font-medium leading-relaxed whitespace-pre-wrap mb-4">
          {question.question_text}
        </p>

        {/* Student answer */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Your Answer
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {question.student_answer || "(no answer provided)"}
          </p>
        </div>

        {feedback && (
          <div className="space-y-4">
            {/* Rubric breakdown */}
            {feedback.rubric_breakdown &&
              Object.keys(feedback.rubric_breakdown).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Rubric Breakdown
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(feedback.rubric_breakdown).map(
                      ([key, val]) => (
                        <div
                          key={key}
                          className="rounded-xl bg-indigo-50/50 border border-indigo-100 px-3 py-2"
                        >
                          <div className="text-xs text-indigo-600 font-medium capitalize">
                            {key.replace(/_/g, " ")}
                          </div>
                          <div className="text-lg font-bold text-indigo-700">{val}</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Missing elements */}
            {feedback.missing_elements && feedback.missing_elements.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
                  Missing Elements
                </div>
                <div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
                  <ul className="space-y-1.5">
                    {feedback.missing_elements.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Citations — expandable */}
            {feedback.citations && feedback.citations.length > 0 && (
              <div>
                <button
                  onClick={() => setCitationsExpanded(!citationsExpanded)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <motion.div
                    animate={{ rotate: citationsExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </motion.div>
                  <FileText className="w-3.5 h-3.5" />
                  {feedback.citations.length} Citation{feedback.citations.length > 1 ? "s" : ""}
                </button>

                <AnimatePresence>
                  {citationsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-xl bg-emerald-50/50 border border-emerald-100 p-3 space-y-2">
                        {feedback.citations.map((c, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-2 text-sm text-emerald-700"
                          >
                            <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="font-medium">{c.source}</span>
                            {c.page > 0 && (
                              <Badge variant="success" className="text-[10px]">
                                p. {c.page}
                              </Badge>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
