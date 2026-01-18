"use client";

import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Calendar,
  Clock,
  Pause,
  Play,
  SkipForward,
  Eye,
  Star,
  MapPin,
  Globe,
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface Lead {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  website: string | null;
  maps_url: string;
  rating: number | null;
  reviews_count: number | null;
  niche: string | null;
  siren: string | null;
  dirigeant: string | null;
  priority: "high" | "medium" | "low";
  status: string;
  call_status: string;
  notes: string | null;
  next_followup_at: string | null;
}

interface Session {
  id: number;
  started_at: string;
  ended_at: string | null;
  total_calls: number;
  total_reached: number;
  total_voicemail: number;
  total_scheduled: number;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const CALL_OUTCOMES = [
  { id: "injoignable", label: "Injoignable", icon: PhoneOff, color: "red", key: "1" },
  { id: "messagerie", label: "Messagerie", icon: PhoneMissed, color: "yellow", key: "2" },
  { id: "rappeler", label: "Rappeler", icon: Calendar, color: "blue", key: "3" },
  { id: "appele", label: "Intéressé", icon: CheckCircle2, color: "green", key: "4" },
  { id: "pas_interesse", label: "Pas intéressé", icon: XCircle, color: "zinc", key: "5" },
] as const;

export default function CallSessionPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [note, setNote] = useState("");
  const [skippedIds, setSkippedIds] = useState<number[]>([]);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("10:00");
  const [pendingOutcome, setPendingOutcome] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Start or resume session
  const initSession = useCallback(async () => {
    try {
      // Check for active session
      const activeRes = await fetch("/api/session");
      const activeData = await activeRes.json();

      if (activeData.active && activeData.session) {
        setSession(activeData.session);
      } else {
        // Start new session
        const newRes = await fetch("/api/session", { method: "POST" });
        const newSession = await newRes.json();
        setSession(newSession);
      }
    } catch (error) {
      console.error("Failed to init session:", error);
    }
  }, []);

  // Fetch next lead
  const fetchNextLead = useCallback(async () => {
    setLoading(true);
    try {
      const excludeParam = skippedIds.length > 0 ? `?exclude=${skippedIds.join(",")}` : "";
      const res = await fetch(`/api/leads/next${excludeParam}`);
      const data = await res.json();
      setCurrentLead(data.lead);
    } catch (error) {
      console.error("Failed to fetch next lead:", error);
    }
    setLoading(false);
  }, [skippedIds]);

  // Process call outcome
  const processOutcome = useCallback(async (outcome: string, followupDatetime?: string) => {
    if (!currentLead || !session) return;
    
    setActionLoading(true);

    try {
      // Log the call
      const callStatus = outcome === "pas_interesse" ? "appele" : outcome;
      await fetch(`/api/leads/${currentLead.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_status: callStatus,
          note: note || undefined,
          auto_schedule: outcome === "messagerie",
        }),
      });

      // If "pas_interesse", mark as lost
      if (outcome === "pas_interesse") {
        await fetch(`/api/leads/${currentLead.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "perdu", note: "Pas intéressé" }),
        });
      }

      // If followup date provided
      if (followupDatetime) {
        await fetch(`/api/leads/${currentLead.id}/followup`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: followupDatetime }),
        });
      }

      // Update session stats
      const stats: Record<string, number> = { total_calls: 1 };
      if (outcome === "appele") stats.total_reached = 1;
      if (outcome === "messagerie") stats.total_voicemail = 1;
      if (outcome === "rappeler" || followupDatetime) stats.total_scheduled = 1;

      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, stats }),
      });

      // Refresh session and get next lead
      const sessionRes = await fetch(`/api/session?id=${session.id}`);
      const updatedSession = await sessionRes.json();
      setSession(updatedSession);

      setNote("");
      setSkippedIds([]);
    } catch (error) {
      console.error("Failed to process outcome:", error);
    }

    setActionLoading(false);
  }, [currentLead, session, note]);

  // Handle call outcome
  const handleOutcome = useCallback(async (outcome: string) => {
    if (!currentLead || actionLoading) return;

    // For "rappeler", show the modal first
    if (outcome === "rappeler") {
      setPendingOutcome(outcome);
      setShowFollowupModal(true);
      return;
    }

    await processOutcome(outcome);
    await fetchNextLead();
  }, [currentLead, actionLoading, processOutcome, fetchNextLead]);

  const skipLead = useCallback(() => {
    if (!currentLead) return;
    setSkippedIds((prev) => [...prev, currentLead.id]);
    setNote("");
  }, [currentLead]);

  const handleFollowupConfirm = useCallback(async () => {
    if (!followupDate) return;
    const datetime = `${followupDate} ${followupTime}:00`;
    setShowFollowupModal(false);
    await processOutcome(pendingOutcome || "rappeler", datetime);
    await fetchNextLead();
    setPendingOutcome(null);
    setFollowupDate("");
  }, [followupDate, followupTime, pendingOutcome, processOutcome, fetchNextLead]);

  const endSession = useCallback(async () => {
    if (!session) return;
    await fetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session.id, action: "end" }),
    });
  }, [session]);

  // Timer
  useEffect(() => {
    if (session && !isPaused) {
      timerRef.current = setInterval(() => {
        const start = new Date(session.started_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isPaused]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      const outcome = CALL_OUTCOMES.find((o) => o.key === e.key);
      if (outcome && currentLead) {
        handleOutcome(outcome.id);
      } else if (e.key === "n" || e.key === "N") {
        noteInputRef.current?.focus();
      } else if (e.key === " " && !actionLoading) {
        e.preventDefault();
        skipLead();
      } else if (e.key === "Escape") {
        setIsPaused((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentLead, actionLoading, handleOutcome, skipLead]);

  // Initialize session
  useEffect(() => {
    void (async () => {
      await initSession();
    })();
  }, [initSession]);

  // Fetch lead when session ready
  useEffect(() => {
    if (session) {
      void (async () => {
        await fetchNextLead();
      })();
    }
  }, [session, fetchNextLead]);

  // Skip lead effect
  useEffect(() => {
    if (skippedIds.length > 0 && session) {
      void (async () => {
        await fetchNextLead();
      })();
    }
  }, [skippedIds, session, fetchNextLead]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/leads"
            onClick={endSession}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Session d&apos;appel
            </h1>
            <p className="text-sm text-zinc-500">
              Raccourcis: 1-5 = résultat, N = note, Espace = passer, Échap = pause
            </p>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              📞 {session.total_calls}
            </span>
            <span className="text-green-600 dark:text-green-400">
              ✓ {session.total_reached}
            </span>
            <span className="text-yellow-600 dark:text-yellow-400">
              📧 {session.total_voicemail}
            </span>
          </div>
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={`p-2 rounded-lg ${
              isPaused
                ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      ) : !currentLead ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Tous les leads ont été traités !
          </h2>
          <p className="text-zinc-500 mb-6">
            {session.total_calls} appels • {session.total_reached} conversations •{" "}
            {session.total_voicemail} messageries
          </p>
          <Link
            href="/leads"
            onClick={endSession}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium"
          >
            Terminer la session
          </Link>
        </div>
      ) : (
        <>
          {/* Current lead card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {currentLead.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      PRIORITY_COLORS[currentLead.priority]
                    }`}
                  >
                    {currentLead.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  {currentLead.niche && <span>{currentLead.niche}</span>}
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {currentLead.city}
                  </span>
                  {currentLead.rating && (
                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                      <Star className="w-4 h-4" />
                      {currentLead.rating} ({currentLead.reviews_count})
                    </span>
                  )}
                </div>
              </div>

              {/* Quick links */}
              <div className="flex items-center gap-2">
                {currentLead.website && (
                  <a
                    href={currentLead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                    title="Site web"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                <Link
                  href={`/leads/${currentLead.id}`}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                  title="Voir la fiche"
                >
                  <Eye className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* Phone number */}
            <div className="flex items-center justify-center gap-4 py-8 border-y border-zinc-200 dark:border-zinc-800">
              <a
                href={`tel:${currentLead.phone}`}
                className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xl font-bold transition-colors"
              >
                <Phone className="w-6 h-6" />
                {currentLead.phone}
              </a>
            </div>

            {/* Dirigeant info */}
            {currentLead.dirigeant && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  👤 Demander <strong>{currentLead.dirigeant}</strong>
                </p>
              </div>
            )}

            {/* Previous notes */}
            {currentLead.notes && (
              <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Notes précédentes
                </p>
                <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {currentLead.notes}
                </pre>
              </div>
            )}
          </div>

          {/* Call outcomes */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
              Résultat de l&apos;appel
            </p>
            <div className="grid grid-cols-5 gap-3">
              {CALL_OUTCOMES.map((outcome) => {
                const Icon = outcome.icon;
                const colors = {
                  red: "bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-300",
                  yellow: "bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900 dark:hover:bg-yellow-800 dark:text-yellow-300",
                  blue: "bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-300",
                  green: "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-300",
                  zinc: "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300",
                };

                return (
                  <button
                    key={outcome.id}
                    onClick={() => handleOutcome(outcome.id)}
                    disabled={actionLoading}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                      colors[outcome.color as keyof typeof colors]
                    }`}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                    <span className="text-sm">{outcome.label}</span>
                    <kbd className="text-xs opacity-50 bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded">
                      {outcome.key}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick note */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-zinc-400" />
              <input
                ref={noteInputRef}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note rapide (optionnelle)..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
              />
              <kbd className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                N
              </kbd>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={skipLead}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              Passer
              <kbd className="text-xs opacity-50 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded ml-1">
                Espace
              </kbd>
            </button>

            <Link
              href="/leads"
              onClick={endSession}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Terminer la session
            </Link>
          </div>
        </>
      )}

      {/* Followup Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Planifier un rappel
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Date</label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-500 mb-1">Heure</label>
                <input
                  type="time"
                  value={followupTime}
                  onChange={(e) => setFollowupTime(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowFollowupModal(false);
                  setPendingOutcome(null);
                }}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                onClick={handleFollowupConfirm}
                disabled={!followupDate || actionLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Planifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
