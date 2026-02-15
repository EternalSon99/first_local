"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Plus, Trash2, Unlock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import type { Topic, TopicStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageWrapper } from "@/components/PageWrapper";

export default function TopicsPage({
  params,
}: {
  params: { courseId: string };
}) {
  const { courseId } = params;
  const queryClient = useQueryClient();
  const [newTopicName, setNewTopicName] = useState("");
  const [newWeekNum, setNewWeekNum] = useState("");

  const { data: topics, isLoading } = useQuery({
    queryKey: ["topics", courseId],
    queryFn: () => api.listTopics(courseId),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; week_number?: number }) =>
      api.createTopic(courseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", courseId] });
      setNewTopicName("");
      setNewWeekNum("");
      toast.success("Topic created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ topicId, status }: { topicId: string; status: TopicStatus }) =>
      api.updateTopic(courseId, topicId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (topicId: string) => api.deleteTopic(courseId, topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", courseId] });
      toast.success("Topic deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatus = (topic: Topic) => {
    const nextStatus: TopicStatus = topic.status === "LOCKED" ? "IN_PROGRESS" : "LOCKED";
    updateMutation.mutate({ topicId: topic.id, status: nextStatus });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    createMutation.mutate({
      name: newTopicName,
      week_number: newWeekNum ? parseInt(newWeekNum) : undefined,
    });
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
        <p className="text-gray-500 mt-1">Manage topics and control which ones are available for study</p>
      </motion.div>

      {/* Create form */}
      <motion.form
        onSubmit={handleCreate}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-white border border-gray-100 p-5 mb-6"
      >
        <div className="flex gap-3">
          <Input
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="New topic name..."
            className="flex-1"
            required
          />
          <Input
            type="number"
            value={newWeekNum}
            onChange={(e) => setNewWeekNum(e.target.value)}
            placeholder="Week"
            className="w-20"
            min={1}
          />
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </motion.form>

      {/* Topics list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !topics?.length ? (
        <div className="text-center py-16 text-gray-400">
          <Lock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          No topics yet. Add your first topic above.
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {topics.map((topic: Topic, i: number) => (
              <motion.div
                key={topic.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-4 group hover:shadow-sm transition-shadow"
              >
                {/* Lock/Unlock toggle */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleStatus(topic)}
                  className={`p-2.5 rounded-xl transition-colors ${
                    topic.status === "LOCKED"
                      ? "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                      : topic.status === "MASTERED"
                        ? "bg-green-50 text-green-600"
                        : "bg-emerald-50 text-emerald-600 hover:bg-gray-100 hover:text-gray-400"
                  }`}
                >
                  {topic.status === "LOCKED" ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </motion.button>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{topic.name}</div>
                  {topic.week_number && (
                    <div className="text-xs text-gray-400">Week {topic.week_number}</div>
                  )}
                </div>

                {/* Mastery */}
                <div className="w-28 hidden sm:block">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Mastery</span>
                    <span className="font-semibold">{topic.mastery_score.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={topic.mastery_score}
                    className="h-1.5"
                    indicatorClassName={
                      topic.mastery_score >= 80 ? "bg-emerald-500" : topic.mastery_score >= 60 ? "bg-amber-500" : "bg-red-400"
                    }
                  />
                </div>

                {/* Status badge */}
                <Badge
                  variant={
                    topic.status === "MASTERED" ? "success" : topic.status === "IN_PROGRESS" ? "warning" : "secondary"
                  }
                >
                  {topic.status === "IN_PROGRESS" ? "Active" : topic.status === "MASTERED" ? "Mastered" : "Locked"}
                </Badge>

                {/* Delete */}
                <button
                  onClick={() => { if (confirm("Delete this topic?")) deleteMutation.mutate(topic.id); }}
                  className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  );
}
