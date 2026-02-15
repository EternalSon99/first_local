"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  LayoutList,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/PageWrapper";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function CourseOverviewPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.getCourse(courseId),
  });

  const { data: topics } = useQuery({
    queryKey: ["topics", courseId],
    queryFn: () => api.listTopics(courseId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-12 text-red-500">Course not found</div>;
  }

  const summary = course.topic_summary;
  const avgMastery =
    topics && topics.length > 0
      ? topics.reduce((sum, t) => sum + t.mastery_score, 0) / topics.length
      : 0;

  const navCards = [
    {
      href: `/courses/${courseId}/topics`,
      icon: BookOpen,
      label: "Topics",
      desc: "Manage & unlock",
      color: "from-emerald-500 to-teal-500",
      shadow: "shadow-emerald-500/20",
    },
    {
      href: `/courses/${courseId}/documents`,
      icon: FileText,
      label: "Documents",
      desc: "Upload materials",
      color: "from-blue-500 to-indigo-500",
      shadow: "shadow-blue-500/20",
    },
    {
      href: `/courses/${courseId}/study`,
      icon: GraduationCap,
      label: "Study",
      desc: "Start a session",
      color: "from-purple-500 to-pink-500",
      shadow: "shadow-purple-500/20",
    },
    {
      href: `/courses/${courseId}/results`,
      icon: Trophy,
      label: "Results",
      desc: "View history",
      color: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-500/20",
    },
  ];

  return (
    <PageWrapper>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Courses
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
        {course.description && (
          <p className="text-gray-500 mt-1">{course.description}</p>
        )}
      </motion.div>

      {/* Stats row */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {[
          { icon: BookOpen, value: summary?.total || 0, label: "Topics", color: "text-emerald-500" },
          { icon: Trophy, value: summary?.mastered || 0, label: "Mastered", color: "text-green-500" },
          { icon: LayoutList, value: summary?.in_progress || 0, label: "In Progress", color: "text-amber-500" },
          { icon: GraduationCap, value: `${avgMastery.toFixed(0)}%`, label: "Avg Mastery", color: "text-blue-500" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            variants={item}
            className="rounded-2xl bg-white border border-gray-100 p-5 text-center"
          >
            <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Topic mastery grid */}
      {topics && topics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-white border border-gray-100 p-6 mb-8"
        >
          <h2 className="font-bold text-lg mb-4">Topic Mastery</h2>
          <div className="space-y-3">
            {topics.map((topic, i) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.04 }}
                className="flex items-center gap-4"
              >
                <div className="w-40 min-w-[10rem] truncate text-sm font-medium">
                  {topic.name}
                </div>
                <div className="flex-1">
                  <Progress
                    value={topic.mastery_score}
                    className="h-2.5"
                    indicatorClassName={
                      topic.mastery_score >= 80
                        ? "bg-emerald-500"
                        : topic.mastery_score >= 60
                          ? "bg-amber-500"
                          : topic.mastery_score > 0
                            ? "bg-red-400"
                            : "bg-gray-200"
                    }
                  />
                </div>
                <span className="text-sm font-semibold w-12 text-right">
                  {topic.mastery_score.toFixed(0)}%
                </span>
                <Badge
                  variant={
                    topic.status === "MASTERED"
                      ? "success"
                      : topic.status === "IN_PROGRESS"
                        ? "warning"
                        : "secondary"
                  }
                  className="w-24 justify-center"
                >
                  {topic.status === "IN_PROGRESS" ? "Active" : topic.status === "MASTERED" ? "Mastered" : "Locked"}
                </Badge>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Navigation cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {navCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.href} variants={item}>
              <Link href={card.href}>
                <motion.div
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-2xl bg-white border border-gray-100 p-5 group cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-lg ${card.shadow}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="font-semibold group-hover:text-gray-800">{card.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{card.desc}</div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </PageWrapper>
  );
}
