"use client";

import {
  Calendar,
  Phone,
  Eye,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Lead {
  id: number;
  name: string;
  phone: string;
  city: string;
  niche: string | null;
  priority: "high" | "medium" | "low";
  status: string;
  notes: string | null;
  next_followup_at: string;
  urgency: "overdue" | "today" | "tomorrow" | "week";
}

interface FollowupsData {
  grouped: {
    overdue: Lead[];
    today: Lead[];
    tomorrow: Lead[];
    week: Lead[];
  };
  counts: {
    overdue: number;
    today: number;
    tomorrow: number;
    week: number;
    total: number;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-zinc-500",
};

const URGENCY_CONFIG = {
  overdue: {
    label: "En retard",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
  },
  today: {
    label: "Aujourd'hui",
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-200 dark:border-orange-800",
  },
  tomorrow: {
    label: "Demain",
    icon: Calendar,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
  },
  week: {
    label: "Cette semaine",
    icon: ChevronRight,
    color: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-900",
    border: "border-zinc-200 dark:border-zinc-800",
  },
};

export default function FollowupsPage() {
  const [data, setData] = useState<FollowupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchFollowups = useCallback(async () => {
    try {
      const res = await fetch("/api/followups");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch followups:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchFollowups();
    })();
  }, [fetchFollowups]);

  const markDone = async (leadId: number) => {
    setActionLoading(leadId);
    try {
      // Clear the followup
      await fetch(`/api/leads/${leadId}/followup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: null }),
      });
      await fetchFollowups();
    } catch (error) {
      console.error("Failed to mark done:", error);
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Erreur de chargement
      </div>
    );
  }

  const { grouped, counts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Relances
          </h1>
          <p className="text-zinc-500">
            {counts.total} relances à venir cette semaine
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4">
          {counts.overdue > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {counts.overdue} en retard
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            {counts.today} aujourd&apos;hui
          </span>
        </div>
      </div>

      {/* No followups */}
      {counts.total === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Calendar className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Aucune relance prévue
          </h2>
          <p className="text-zinc-500 mb-6">
            Lancez une session d&apos;appel pour planifier des relances
          </p>
          <Link
            href="/call"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <Phone className="w-5 h-5" />
            Lancer une session
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {grouped.overdue.length > 0 && (
            <FollowupSection
              urgency="overdue"
              leads={grouped.overdue}
              onMarkDone={markDone}
              actionLoading={actionLoading}
            />
          )}

          {/* Today */}
          {grouped.today.length > 0 && (
            <FollowupSection
              urgency="today"
              leads={grouped.today}
              onMarkDone={markDone}
              actionLoading={actionLoading}
            />
          )}

          {/* Tomorrow */}
          {grouped.tomorrow.length > 0 && (
            <FollowupSection
              urgency="tomorrow"
              leads={grouped.tomorrow}
              onMarkDone={markDone}
              actionLoading={actionLoading}
            />
          )}

          {/* Week */}
          {grouped.week.length > 0 && (
            <FollowupSection
              urgency="week"
              leads={grouped.week}
              onMarkDone={markDone}
              actionLoading={actionLoading}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FollowupSection({
  urgency,
  leads,
  onMarkDone,
  actionLoading,
}: {
  urgency: "overdue" | "today" | "tomorrow" | "week";
  leads: Lead[];
  onMarkDone: (id: number) => void;
  actionLoading: number | null;
}) {
  const config = URGENCY_CONFIG[urgency];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} overflow-hidden`}>
      {/* Section header */}
      <div className={`px-4 py-3 ${config.bg} flex items-center gap-2`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
        <span className={`font-medium ${config.color}`}>{config.label}</span>
        <span className="text-sm text-zinc-500">({leads.length})</span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
        {leads.map((lead) => (
          <FollowupItem
            key={lead.id}
            lead={lead}
            urgency={urgency}
            onMarkDone={onMarkDone}
            loading={actionLoading === lead.id}
          />
        ))}
      </div>
    </div>
  );
}

function FollowupItem({
  lead,
  urgency,
  onMarkDone,
  loading,
}: {
  lead: Lead;
  urgency: string;
  onMarkDone: (id: number) => void;
  loading: boolean;
}) {
  const followupDate = new Date(lead.next_followup_at);
  const isOverdue = urgency === "overdue";

  const formatTime = () => {
    if (isOverdue) {
      const now = new Date();
      const diff = now.getTime() - followupDate.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return "aujourd'hui";
      if (days === 1) return "hier";
      return `il y a ${days} jours`;
    }
    return followupDate.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Extract last note
  const lastNote = lead.notes?.split("\n").pop()?.replace(/^\[.*?\]\s*/, "");

  return (
    <div className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {/* Time */}
      <div className={`w-20 text-sm font-medium ${isOverdue ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
        {formatTime()}
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {lead.name}
          </span>
          <span className={`text-xs ${PRIORITY_COLORS[lead.priority]}`}>
            {lead.priority.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span>{lead.city}</span>
          {lead.niche && (
            <>
              <span>•</span>
              <span>{lead.niche}</span>
            </>
          )}
        </div>
        {lastNote && (
          <p className="text-sm text-zinc-400 truncate mt-0.5">{lastNote}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <a
          href={`tel:${lead.phone}`}
          className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          title="Appeler"
        >
          <Phone className="w-5 h-5" />
        </a>
        <Link
          href={`/leads/${lead.id}`}
          className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Voir la fiche"
        >
          <Eye className="w-5 h-5" />
        </Link>
        <button
          onClick={() => onMarkDone(lead.id)}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Marquer fait"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
