"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { FlashcardAnswer, FlashcardGradeResponse, FlashcardQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/PageWrapper";

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 300 : -300, opacity: 0 }),
};

export default function FlashcardPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;
  const [questions, setQuestions] = useState<FlashcardQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<FlashcardGradeResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(0);

  const generateMutation = useMutation({
    mutationFn: () => api.generateFlashcards(courseId),
    onSuccess: (data) => {
      setQuestions(data.questions);
      setAnswers({});
      setResults(null);
      setCurrentIdx(0);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const gradeMutation = useMutation({
    mutationFn: (answersList: FlashcardAnswer[]) =>
      api.gradeFlashcards(courseId, { answers: answersList }),
    onSuccess: (data) => {
      setResults(data);
      toast.success(`${data.total_correct}/${data.total_questions} correct!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const goTo = (idx: number) => {
    setDirection(idx > currentIdx ? 1 : -1);
    setCurrentIdx(idx);
  };

  const handleSubmit = () => {
    const answersList: FlashcardAnswer[] = questions.map((q) => ({
      question_id: q.id,
      question: q.question,
      answer: answers[q.id] || "",
      topic_id: q.topic_id,
    }));
    gradeMutation.mutate(answersList);
  };

  // Generate state
  if (questions.length === 0) {
    return (
      <PageWrapper>
        <Link href={`/courses/${courseId}/study`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />Back to study modes
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[50vh]">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6"
          >
            <Sparkles className="w-10 h-10 text-purple-500" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Flashcards</h1>
          <p className="text-gray-500 mb-6">Test your recall with AI-generated questions</p>
          <Button variant="brilliant" size="lg" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</> : "Generate Flashcards"}
          </Button>
        </motion.div>
      </PageWrapper>
    );
  }

  // Results state
  if (results) {
    const pct = results.total_questions > 0 ? (results.total_correct / results.total_questions) * 100 : 0;
    return (
      <PageWrapper>
        <Link href={`/courses/${courseId}/study`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />Back to study modes
        </Link>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-8">
          <div className={`text-6xl font-bold ${pct >= 70 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-red-500"}`}>
            {results.total_correct}/{results.total_questions}
          </div>
          <p className="text-gray-500 mt-2">Questions answered correctly</p>
        </motion.div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {results.results.map((r, i) => (
            <motion.div
              key={r.question_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl bg-white border p-5 ${r.correct ? "border-emerald-200" : "border-red-200"}`}
            >
              <div className="flex items-start gap-3">
                {r.correct ? <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{r.question}</p>
                  <p className="text-sm text-gray-500 mt-1"><span className="font-medium">You:</span> {answers[r.question_id] || "(no answer)"}</p>
                  {!r.correct && <p className="text-sm text-emerald-700 mt-1"><span className="font-medium">Expected:</span> {r.expected_answer}</p>}
                  <p className="text-xs text-gray-400 mt-1">{r.feedback}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-3 justify-center mt-8">
          <Button variant="brilliant" onClick={() => { setQuestions([]); setResults(null); }}>Try Again</Button>
          <Button variant="outline" asChild><Link href={`/courses/${courseId}`}>Back to Course</Link></Button>
        </div>
      </PageWrapper>
    );
  }

  // Active flashcard — step-through
  const currentQ = questions[currentIdx];

  return (
    <PageWrapper>
      <Link href={`/courses/${courseId}/study`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />Back to study modes
      </Link>

      <div className="max-w-2xl mx-auto">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {questions.map((q, i) => (
            <motion.button
              key={q.id}
              whileHover={{ scale: 1.2 }}
              onClick={() => goTo(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentIdx ? "bg-purple-500 scale-125" : answers[q.id] ? "bg-purple-300" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIdx}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <Badge variant="purple">{currentQ.topic_name}</Badge>
              <span className="text-xs text-gray-400">{currentIdx + 1} / {questions.length}</span>
            </div>
            <div className="p-6">
              <p className="text-lg font-medium mb-4">{currentQ.question}</p>
              <Textarea
                value={answers[currentQ.id] || ""}
                onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                placeholder="Your answer..."
                rows={3}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>
            <ArrowLeft className="w-4 h-4 mr-1" />Prev
          </Button>
          {currentIdx < questions.length - 1 ? (
            <Button onClick={() => goTo(currentIdx + 1)}>
              Next<ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="brilliant" onClick={handleSubmit} disabled={gradeMutation.isPending}>
              {gradeMutation.isPending ? "Grading..." : "Submit All"}
            </Button>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
