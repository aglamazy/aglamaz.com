"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import Link from "next/link";
import { BookOpen, Images, Calendar } from "lucide-react";
import ArrowCTA from "@/components/ArrowCTA";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/utils/apiFetch";
import { ApiRoute } from "@/utils/urls";
import { formatLocalizedDate } from "@/utils/dateFormat";

interface DashboardHomeProps {
  user: any;
  title: string;
  aboutFamily?: string;
}

// --- Types for API responses ---

type AnniversaryEvent = {
  id: string;
  name: string;
  type: "birthday" | "death" | "wedding" | "other";
  day: number;
  month: number;
  year: number;
  date: any;
};


type LocalizedBlogPost = {
  post: {
    id: string;
    authorId: string;
    createdAt: any;
  };
  localized: {
    title: string;
    content: string;
  };
};

type PhotoThumb = {
  src: string;
  width: number;
  height: number;
};

type PhotoOccurrence = {
  id: string;
  imagesResized?: Array<{
    "400x400": string;
    original: string;
    width?: number;
    height?: number;
  }>;
};

// --- Helpers ---

const EVENT_TYPE_ICON: Record<string, string> = {
  birthday: "\uD83C\uDF82", // 🎂
  wedding: "\uD83D\uDC92",  // 💒
  death: "\uD83D\uDD6F\uFE0F", // 🕯️
};

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  // SSR fallback
  return html.replace(/<[^>]*>/g, "");
}

function truncate(text: string, maxLen: number): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trimEnd() + "…";
}

// --- Component ---

export default function DashboardHome({
  user,
  title,
  aboutFamily,
}: DashboardHomeProps) {
  const { t, i18n } = useTranslation();
  const isRTL =
    i18n.language?.startsWith("he") || i18n.language?.startsWith("ar");

  // Calendar state
  const [events, setEvents] = useState<AnniversaryEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Blog state
  const [posts, setPosts] = useState<LocalizedBlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Photos state
  const [photos, setPhotos] = useState<PhotoThumb[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  // Fetch calendar events — scan up to 6 months ahead to find upcoming events
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    const today = now.getDate();

    async function fetchEvents() {
      try {
        const upcoming: AnniversaryEvent[] = [];

        for (let offset = 0; offset < 6 && upcoming.length < 3; offset++) {
          const m = (currentMonth + offset) % 12;
          const y = currentYear + Math.floor((currentMonth + offset) / 12);

          const data = await apiFetch<{ events: AnniversaryEvent[] }>(
            ApiRoute.SITE_ANNIVERSARIES,
            {
              queryParams: { month: String(m), year: String(y) },
            }
          );
          if (cancelled) return;

          let monthEvents = data.events || [];

          // For current month, only keep events from today onward
          if (offset === 0) {
            monthEvents = monthEvents.filter((e) => e.day >= today);
          }

          // Sort within month by day
          monthEvents.sort((a, b) => a.day - b.day);
          upcoming.push(...monthEvents);
        }

        setEvents(upcoming.slice(0, 3));
      } catch (err) {
        console.error("[dashboard] calendar fetch failed", err);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch blog posts
  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      try {
        const data = await apiFetch<{ posts: LocalizedBlogPost[] }>(
          ApiRoute.SITE_BLOG,
          {
            queryParams: { lang: i18n.language },
          }
        );
        if (cancelled) return;
        setPosts((data.posts || []).slice(0, 2));
      } catch (err) {
        console.error("[dashboard] blog fetch failed", err);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  // Fetch photos
  useEffect(() => {
    let cancelled = false;

    async function fetchPhotos() {
      try {
        const data = await apiFetch<{
          items: PhotoOccurrence[];
        }>(ApiRoute.SITE_PICTURES, {
          queryParams: { limit: "6", locale: i18n.language },
        });
        if (cancelled) return;

        // Extract thumbnails with dimensions
        const thumbs: PhotoThumb[] = [];
        for (const item of data.items || []) {
          for (const img of item.imagesResized || []) {
            if (thumbs.length >= 6) break;
            thumbs.push({
              src: img["400x400"] || img.original,
              width: img.width || 400,
              height: img.height || 400,
            });
          }
          if (thumbs.length >= 6) break;
        }
        setPhotos(thumbs);
      } catch (err) {
        console.error("[dashboard] photos fetch failed", err);
      } finally {
        if (!cancelled) setPhotosLoading(false);
      }
    }

    fetchPhotos();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  // Format event date: "day monthName"
  function formatEventDate(event: AnniversaryEvent): string {
    const d = new Date(event.year, event.month, event.day);
    return d.toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
    });
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.15 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const shimmer = (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-sage-100 rounded w-3/4" />
      <div className="h-4 bg-sage-100 rounded w-1/2" />
      <div className="h-4 bg-sage-100 rounded w-2/3" />
    </div>
  );

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Title + aboutFamily */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <h1 className="text-5xl font-bold text-charcoal mb-4">{title}</h1>
          {aboutFamily && (
            <div
              className={`text-xl text-sage-600 max-w-2xl mx-auto leading-relaxed prose prose-sage ${isRTL ? "text-right" : "text-left"}`}
              dangerouslySetInnerHTML={{ __html: aboutFamily }}
            />
          )}
        </motion.div>

        {/* 3-column dashboard grid */}
        <motion.div
          className="grid md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Calendar card */}
          <motion.div variants={cardVariants}>
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <CardTitle className="text-lg">
                    {t("upcomingEvents")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {eventsLoading ? (
                  shimmer
                ) : events.length === 0 ? (
                  <p className="text-sage-500 text-sm">
                    {t("noUpcomingEvents")}
                  </p>
                ) : (
                  <ul className="space-y-3 flex-1">
                    {events.map((event) => (
                      <li key={event.id}>
                        <Link
                          href="/app/calendar"
                          className="flex items-start gap-2 rounded-md p-1.5 -m-1.5 hover:bg-sage-50 transition-colors"
                        >
                          <span className="text-lg leading-none mt-0.5">
                            {EVENT_TYPE_ICON[event.type] || "📅"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-charcoal truncate">
                              {event.name}
                            </p>
                            <p className="text-sm text-sage-500">
                              {formatEventDate(event)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/app/calendar"
                  className="mt-4 inline-flex items-center text-sm font-medium text-sage-600 hover:text-sage-800 group"
                >
                  {t("viewAll")}
                  <ArrowCTA isRTL={isRTL} />
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Blog card */}
          <motion.div variants={cardVariants}>
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">
                    {t("recentPosts")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {postsLoading ? (
                  shimmer
                ) : posts.length === 0 ? (
                  <p className="text-sage-500 text-sm">
                    {t("noPostsYet")}
                  </p>
                ) : (
                  <div className="space-y-4 flex-1">
                    {posts.map((item) => {
                      const excerpt = truncate(
                        stripHtml(item.localized.content),
                        80
                      );
                      return (
                        <div key={item.post.id}>
                          <p className="font-medium text-charcoal line-clamp-1">
                            {item.localized.title}
                          </p>
                          <p className="text-sm text-sage-500 line-clamp-2">
                            {excerpt}
                          </p>
                          <p className="text-xs text-sage-400 mt-1">
                            {formatLocalizedDate(
                              item.post.createdAt,
                              i18n.language
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Link
                  href={`/${i18n.language}/blog`}
                  className="mt-4 inline-flex items-center text-sm font-medium text-sage-600 hover:text-sage-800 group"
                >
                  {t("viewAll")}
                  <ArrowCTA isRTL={isRTL} />
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Photos card */}
          <motion.div variants={cardVariants}>
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Images className="w-5 h-5 text-purple-500" />
                  <CardTitle className="text-lg">
                    {t("photoHighlights")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {photosLoading ? (
                  <div className="animate-pulse columns-3 gap-2">
                    {[100, 75, 90, 80, 110, 70].map((h, i) => (
                      <div
                        key={i}
                        className="mb-2 bg-sage-100 rounded break-inside-avoid"
                        style={{ height: h }}
                      />
                    ))}
                  </div>
                ) : photos.length === 0 ? (
                  <p className="text-sage-500 text-sm">
                    {t("noPicturesYet")}
                  </p>
                ) : (
                  <div className="columns-3 gap-2 flex-1">
                    {photos.map((photo, i) => (
                      <div
                        key={i}
                        className="mb-2 rounded overflow-hidden break-inside-avoid"
                      >
                        <img
                          src={photo.src}
                          alt=""
                          width={photo.width}
                          height={photo.height}
                          className="w-full h-auto block rounded"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href="/app/photos"
                  className="mt-4 inline-flex items-center text-sm font-medium text-sage-600 hover:text-sage-800 group"
                >
                  {t("viewAll")}
                  <ArrowCTA isRTL={isRTL} />
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
