"use client";

import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, GraduationCap, Layers, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { ExamLevel } from "@/lib/types";
import { PageWrapper } from "@/components/PageWrapper";

const STUDY_MODES = [
  {
    level: "FLASHCARD" as ExamLevel,
    name: "Flashcards",
    desc: "Quick recall questions with instant feedback",
    duration: "Untimed",
    questions: "5-10",
    score: "Pass/Fail",
    icon: Zap,
    gradient: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/20",
    bg: "from-purple-500/10 to-pink-500/10",
    border: "hover:border-purple-300",
  },
  {
    level: "LEVEL1" as ExamLevel,
    name: "Level 1",
    desc: "Basic recall and short explanation",
    duration: "20 min",
    questions: "2",
    score: "/20",
    icon: BookOpen,
    gradient: "from-blue-500 to-indigo-500",
    shadow: "shadow-blue-500/20",
    bg: "from-blue-500/10 to-indigo-500/10",
    border: "hover:border-blue-300",
  },
  {
    level: "LEVEL2" as ExamLevel,
    name: "Level 2",
    desc: "Application-based analysis",
    duration: "60 min",
    questions: "3-4",
    score: "/40",
    icon: Layers,
    gradient: "from-amber-500 to-orange-500",
    shadow: "shadow-amber-500/20",
    bg: "from-amber-500/10 to-orange-500/10",
    border: "hover:border-amber-300",
  },
  {
    level: "EXAM" as ExamLevel,
    name: "Full Exam",
    desc: "Cross-topic synthesis, strict grading",
    duration: "120 min",
    questions: "5",
    score: "/100",
    icon: GraduationCap,
    gradient: "from-red-500 to-rose-500",
    shadow: "shadow-red-500/20",
    bg: "from-red-500/10 to-rose-500/10",
    border: "hover:border-red-300",
  },
];

export default function StudySelectionPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;
  const router = useRouter();

  const startMutation = useMutation({
    mutationFn: (level: ExamLevel) => api.startExam(courseId, { level }),
    onSuccess: (session) => {
      router.push(`/courses/${courseId}/study/exam/${session.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStart = (level: ExamLevel) => {
    if (level === "FLASHCARD") {
      router.push(`/courses/${courseId}/study/flashcard`);
      return;
    }
    if (!localStorage.getItem("studyengine_api_key")) {
      toast.error("Set your API key in Settings first");
      return;
    }
    startMutation.mutate(level);
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
        <h1 className="text-3xl font-bold tracking-tight">Choose Your Mode</h1>
        <p className="text-gray-500 mt-1">Select a study mode to begin</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {STUDY_MODES.map((mode, i) => {
          const Icon = mode.icon;
          return (
            <motion.button
              key={mode.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleStart(mode.level)}
              disabled={startMutation.isPending}
              className={`rounded-2xl border border-gray-100 ${mode.border} bg-gradient-to-br ${mode.bg} p-6 text-left group bento-glow relative overflow-hidden`}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/20" />
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center mb-4 shadow-lg ${mode.shadow}`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-1">{mode.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{mode.desc}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mode.duration}</span>
                <span>{mode.questions} Q</span>
                <span>Score: {mode.score}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {startMutation.isPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-6 py-4 shadow-lg">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium text-gray-700">Generating questions with AI...</span>
          </div>
        </motion.div>
      )}
    </PageWrapper>
  );
}
