"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useTimer } from "@/hooks/useTimer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

// Slide-from-right animation variants
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 400 : -400,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 400 : -400,
    opacity: 0,
    scale: 0.95,
  }),
};

export default function ExamSessionPage({
  params,
}: {
  params: { courseId: string; sessionId: string };
}) {
  const { courseId, sessionId } = params;
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(0);

  const { data: session, isLoading } = useQuery({
    queryKey: ["exam-session", sessionId],
    queryFn: () => api.getExamSession(courseId, sessionId),
    refetchOnWindowFocus: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const answersList = Object.entries(answers).map(([qId, answer]) => ({
        question_id: qId,
        answer,
      }));
      return api.submitExam(courseId, sessionId, { answers: answersList });
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Exam submitted and graded!");
      router.push(`/courses/${courseId}/results/${sessionId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAutoSubmit = useCallback(() => {
    if (!submitted && !submitMutation.isPending) {
      toast("Time's up! Auto-submitting...", { icon: "\u23f0" });
      submitMutation.mutate();
    }
  }, [submitted, submitMutation]);

  const timer = useTimer({
    startedAt: session?.started_at || new Date().toISOString(),
    durationMinutes: session?.duration_minutes || null,
    onExpired: handleAutoSubmit,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <div className="text-center py-12 text-red-500">Exam session not found</div>;
  }

  if (session.status !== "IN_PROGRESS") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-gray-500">This exam has been submitted.</p>
        <Button onClick={() => router.push(`/courses/${courseId}/results/${sessionId}`)}>
          View Results
        </Button>
      </div>
    );
  }

  const questions = session.questions;
  const currentQ = questions[currentIdx];
  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const isLowTime = timer.remainingSeconds < 300 && timer.remainingSeconds > 0;

  const goTo = (idx: number) => {
    setDirection(idx > currentIdx ? 1 : -1);
    setCurrentIdx(idx);
  };

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      if (!confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`)) return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="min-h-screen -mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Top bar — Timer + Progress */}
      <div
        className={`sticky top-16 z-40 border-b px-6 py-3 transition-colors ${
          isLowTime ? "bg-red-50/90 backdrop-blur-xl border-red-200" : "glass border-gray-200/50"
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/courses/${courseId}/study`)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div>
              <div className="text-sm font-semibold">{session.level.replace("_", " ")}</div>
              <div className="text-xs text-gray-400">
                {answeredCount}/{questions.length} answered
              </div>
            </div>
          </div>

          {/* Timer */}
          <motion.div
            animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
            transition={isLowTime ? { repeat: Infinity, duration: 1 } : {}}
            className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-2 rounded-xl ${
              isLowTime ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-700"
            }`}
          >
            <Clock className="w-5 h-5" />
            {timer.formattedTime}
          </motion.div>

          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || submitted}
            variant="brilliant"
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitMutation.isPending ? "Grading..." : "Submit"}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-2">
          <Progress
            value={(answeredCount / questions.length) * 100}
            className="h-1"
            indicatorClassName={isLowTime ? "bg-red-500" : "bg-emerald-500"}
          />
        </div>
      </div>

      {/* Low time warning */}
      <AnimatePresence>
        {isLowTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-4xl mx-auto px-6"
          >
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl mt-4 border border-red-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Less than 5 minutes! Auto-submit at zero.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step-through question interface */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Question dots / stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {questions.map((q, i) => (
            <motion.button
              key={q.id}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => goTo(i)}
              className={`relative w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                i === currentIdx
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : answers[q.id]?.trim()
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              {i + 1}
              {answers[q.id]?.trim() && i !== currentIdx && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
              )}
            </motion.button>
          ))}
        </div>

        {/* Question card with slide animation */}
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIdx}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
              }}
              className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Question header */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-600">
                    Question {currentQ.question_number}
                  </span>
                  <span className="text-sm text-gray-400 font-medium">
                    {currentQ.max_score} points
                  </span>
                </div>
              </div>

              {/* Question body */}
              <div className="p-6">
                <p className="text-lg font-medium text-gray-800 leading-relaxed whitespace-pre-wrap mb-6">
                  {currentQ.question_text}
                </p>

                <Textarea
                  value={answers[currentQ.id] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [currentQ.id]: e.target.value })
                  }
                  placeholder="Type your answer here..."
                  rows={8}
                  disabled={submitted || submitMutation.isPending}
                  className="text-base"
                />

                {answers[currentQ.id] && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-gray-400 mt-2 text-right"
                  >
                    {answers[currentQ.id].length} characters
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => goTo(currentIdx - 1)}
            disabled={currentIdx === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <span className="text-sm text-gray-400">
            {currentIdx + 1} of {questions.length}
          </span>

          {currentIdx < questions.length - 1 ? (
            <Button onClick={() => goTo(currentIdx + 1)}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="brilliant"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || submitted}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? "Grading..." : "Submit Exam"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
