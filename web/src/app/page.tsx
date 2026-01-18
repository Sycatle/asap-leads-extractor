"use client";

import {
  Users,
  Phone,
  Calendar,
  TrendingUp,
  Rocket,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  by_status: Record<string, number>;
  by_call_status: Record<string, number>;
  by_priority: Record<string, number>;
  followups_today: number;
  to_call: number;
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

interface FollowupLead {
  id: number;
  name: string;
  phone: string;
  city: string;
  niche: string | null;
  next_followup_at: string;
  urgency: string;
}

interface FollowupCounts {
  overdue: number;
  today: number;
  total: number;
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  qualifie: "Qualifié",
  proposition: "Proposition",
  converti: "Converti",
  perdu: "Perdu",
};

const STATUS_COLORS: Record<string, string> = {
  nouveau: "bg-blue-500",
  contacte: "bg-yellow-500",
  qualifie: "bg-purple-500",
  proposition: "bg-orange-500",
  converti: "bg-green-500",
  perdu: "bg-zinc-400",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [followups, setFollowups] = useState<FollowupLead[]>([]);
  const [followupCounts, setFollowupCounts] = useState<FollowupCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, sessionRes, followupsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/session"),
          fetch("/api/followups"),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }

        if (sessionRes.ok) {
          const data = await sessionRes.json();
          if (data.active) {
            setSession(data.session);
          }
        }

        if (followupsRes.ok) {
          const data = await followupsRes.json();
          // Get first 5 urgent followups
          const urgent = [
            ...(data.grouped?.overdue || []),
            ...(data.grouped?.today || []),
          ].slice(0, 5);
          setFollowups(urgent);
          setFollowupCounts(data.counts);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const conversionRate =
    stats && stats.total > 0
      ? Math.round(((stats.by_status.converti || 0) / stats.total) * 100)
      : 0;

  const contactRate =
    stats && stats.total > 0
      ? Math.round(
          (((stats.by_status.contacte || 0) +
            (stats.by_status.qualifie || 0) +
            (stats.by_status.proposition || 0) +
            (stats.by_status.converti || 0)) /
            stats.total) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Active session banner */}
      {session && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">Session en cours</p>
                <p className="text-sm text-green-100">
                  {session.total_calls} appels • {session.total_reached} conversations
                </p>
              </div>
            </div>
            <Link
              href="/call"
              className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
            >
              Reprendre
            </Link>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total leads"
          value={stats?.total ?? 0}
          color="blue"
        />
        <StatCard
          icon={Phone}
          label="À appeler"
          value={stats?.to_call ?? 0}
          color="orange"
          href="/call"
        />
        <StatCard
          icon={Calendar}
          label="Relances"
          value={followupCounts?.overdue ?? 0}
          subValue={followupCounts?.today ? `+${followupCounts.today} auj.` : undefined}
          color="purple"
          href="/followups"
          alert={followupCounts?.overdue ? followupCounts.overdue > 0 : false}
        />
        <StatCard
          icon={TrendingUp}
          label="Taux contact"
          value={`${contactRate}%`}
          color="green"
        />
      </div>

      {/* CTA */}
      {!session && (
        <Link
          href="/call"
          className="block bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white hover:from-blue-600 hover:to-purple-700 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Rocket className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Lancer une session d&apos;appel</h2>
                <p className="text-blue-100">
                  {stats?.to_call ?? 0} leads à contacter •{" "}
                  {followupCounts?.overdue ?? 0} relances en retard
                </p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            📊 Pipeline
          </h3>
          <div className="space-y-3">
            {["nouveau", "contacte", "qualifie", "proposition", "converti"].map(
              (status) => {
                const count = stats?.by_status[status] ?? 0;
                const percentage =
                  stats && stats.total > 0
                    ? Math.round((count / stats.total) * 100)
                    : 0;

                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${STATUS_COLORS[status]} rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Conversion funnel */}
          <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Taux de conversion</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {conversionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Urgent followups */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              🔥 Relances urgentes
            </h3>
            <Link
              href="/followups"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Voir tout →
            </Link>
          </div>

          {followups.length > 0 ? (
            <div className="space-y-3">
              {followups.map((lead) => (
                <FollowupItem key={lead.id} lead={lead} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-zinc-500">Aucune relance urgente</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance */}
      {stats && stats.total > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            📈 Statistiques
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <MiniStat
              label="Jamais appelés"
              value={stats.by_call_status.non_appele ?? 0}
              total={stats.total}
            />
            <MiniStat
              label="Conversations"
              value={stats.by_call_status.appele ?? 0}
              total={stats.total}
            />
            <MiniStat
              label="Messageries"
              value={stats.by_call_status.messagerie ?? 0}
              total={stats.total}
            />
            <MiniStat
              label="À rappeler"
              value={stats.by_call_status.rappeler ?? 0}
              total={stats.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  href,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subValue?: string;
  color: "blue" | "orange" | "purple" | "green";
  href?: string;
  alert?: boolean;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  };

  const content = (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]} relative`}>
          <Icon className="w-5 h-5" />
          {alert && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" />
          )}
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {value}
            </p>
            {subValue && (
              <span className="text-sm text-zinc-500">{subValue}</span>
            )}
          </div>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function FollowupItem({ lead }: { lead: FollowupLead }) {
  const isOverdue = lead.urgency === "overdue";
  const followupDate = new Date(lead.next_followup_at);

  const formatTime = () => {
    if (isOverdue) {
      const now = new Date();
      const diff = now.getTime() - followupDate.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return "aujourd'hui";
      if (days === 1) return "hier";
      return `il y a ${days}j`;
    }
    return followupDate.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      {isOverdue ? (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      ) : (
        <Calendar className="w-5 h-5 text-orange-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {lead.name}
        </p>
        <p className="text-sm text-zinc-500 truncate">
          {lead.city} {lead.niche && `• ${lead.niche}`}
        </p>
      </div>
      <span
        className={`text-sm font-medium ${
          isOverdue ? "text-red-600 dark:text-red-400" : "text-zinc-500"
        }`}
      >
        {formatTime()}
      </span>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-xs text-zinc-400">{percentage}%</p>
    </div>
  );
}
