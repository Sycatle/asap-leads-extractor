"use client";

import { 
  ArrowLeft, 
  Phone, 
  Globe, 
  MapPin, 
  Star, 
  Building2, 
  User,
  Calendar,
  Clock,
  MessageSquare,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  siret: string | null;
  legal_name: string | null;
  dirigeant: string | null;
  priority: 'high' | 'medium' | 'low';
  status: string;
  call_status: string;
  email_status: string;
  notes: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: number;
  lead_id: number;
  type: 'call' | 'email' | 'note' | 'status_change' | 'followup_set';
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  duration_seconds: number | null;
  created_at: string;
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
  nouveau: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  contacte: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  qualifie: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  proposition: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  converti: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  perdu: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const CALL_STATUS_LABELS: Record<string, string> = {
  non_appele: "Non appelé",
  appele: "Appelé",
  messagerie: "Messagerie",
  rappeler: "À rappeler",
  injoignable: "Injoignable",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-zinc-500",
};

const HISTORY_ICONS: Record<string, React.ReactNode> = {
  call: <PhoneCall className="w-4 h-4" />,
  email: <Send className="w-4 h-4" />,
  note: <MessageSquare className="w-4 h-4" />,
  status_change: <CheckCircle2 className="w-4 h-4" />,
  followup_set: <Calendar className="w-4 h-4" />,
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("10:00");

  // Fetch lead data
  const fetchLead = useCallback(async () => {
    try {
      const [leadRes, historyRes] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        fetch(`/api/leads/${leadId}/history`),
      ]);
      
      if (leadRes.ok) {
        const leadData = await leadRes.json();
        setLead(leadData);
      }
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch lead:", error);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [leadRes, historyRes] = await Promise.all([
          fetch(`/api/leads/${leadId}`),
          fetch(`/api/leads/${leadId}/history`),
        ]);
        
        if (!mounted) return;
        
        if (leadRes.ok) {
          const leadData = await leadRes.json();
          setLead(leadData);
        }
        
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData.history || []);
        }
      } catch (error) {
        console.error("Failed to fetch lead:", error);
      }
      if (mounted) setLoading(false);
    }
    loadData();
    return () => { mounted = false; };
  }, [leadId]);

  // Actions
  const logCall = async (callStatus: string) => {
    setActionLoading(callStatus);
    try {
      await fetch(`/api/leads/${leadId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_status: callStatus }),
      });
      await fetchLead();
    } catch (error) {
      console.error("Failed to log call:", error);
    }
    setActionLoading(null);
  };

  const updateStatus = async (status: string) => {
    setActionLoading(status);
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchLead();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
    setActionLoading(null);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setActionLoading("note");
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote }),
      });
      setNewNote("");
      await fetchLead();
    } catch (error) {
      console.error("Failed to add note:", error);
    }
    setActionLoading(null);
  };

  const scheduleFollowup = async () => {
    if (!followupDate) return;
    setActionLoading("followup");
    try {
      const datetime = `${followupDate} ${followupTime}:00`;
      await fetch(`/api/leads/${leadId}/followup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: datetime }),
      });
      setShowFollowupModal(false);
      setFollowupDate("");
      await fetchLead();
    } catch (error) {
      console.error("Failed to schedule followup:", error);
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

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Lead non trouvé</p>
        <Link href="/leads" className="text-blue-600 hover:underline mt-2 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {lead.name}
          </h1>
          <p className="text-zinc-500">{lead.niche} • {lead.city}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[lead.status]}`}>
          {STATUS_LABELS[lead.status] || lead.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Info Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Contact</h3>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <a 
                      href={`tel:${lead.phone}`}
                      className="font-mono text-lg text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {lead.phone}
                    </a>
                    <p className="text-xs text-zinc-500">{CALL_STATUS_LABELS[lead.call_status]}</p>
                  </div>
                </div>

                {lead.website && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <a 
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {new URL(lead.website).hostname}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <MapPin className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p>{lead.address}</p>
                    <p>{lead.postal_code} {lead.city}</p>
                  </div>
                </div>

                {lead.rating && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                      <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {lead.rating} ({lead.reviews_count} avis)
                    </span>
                  </div>
                )}
              </div>

              {/* Business Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Entreprise</h3>
                
                {lead.legal_name && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{lead.legal_name}</p>
                      {lead.siren && (
                        <p className="text-xs text-zinc-500">SIREN: {lead.siren}</p>
                      )}
                    </div>
                  </div>
                )}

                {lead.dirigeant && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                      <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{lead.dirigeant}</p>
                      <p className="text-xs text-zinc-500">Dirigeant</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className="text-sm">
                    <p className={PRIORITY_COLORS[lead.priority]}>
                      Priorité {lead.priority.toUpperCase()}
                    </p>
                    {lead.last_contact_at && (
                      <p className="text-xs text-zinc-500">
                        Dernier contact: {new Date(lead.last_contact_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>

                {lead.next_followup_at && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="text-sm">
                      <p className="text-orange-600 dark:text-orange-400 font-medium">
                        Relance prévue
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(lead.next_followup_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Actions rapides</h3>
            
            {/* Call actions */}
            <div className="mb-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Résultat d&apos;appel</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  icon={<PhoneCall className="w-4 h-4" />}
                  label="Conversation"
                  onClick={() => logCall('appele')}
                  loading={actionLoading === 'appele'}
                  color="green"
                />
                <ActionButton
                  icon={<PhoneMissed className="w-4 h-4" />}
                  label="Messagerie"
                  onClick={() => logCall('messagerie')}
                  loading={actionLoading === 'messagerie'}
                  color="yellow"
                />
                <ActionButton
                  icon={<Calendar className="w-4 h-4" />}
                  label="Rappeler"
                  onClick={() => logCall('rappeler')}
                  loading={actionLoading === 'rappeler'}
                  color="blue"
                />
                <ActionButton
                  icon={<PhoneOff className="w-4 h-4" />}
                  label="Injoignable"
                  onClick={() => logCall('injoignable')}
                  loading={actionLoading === 'injoignable'}
                  color="red"
                />
              </div>
            </div>

            {/* Status actions */}
            <div className="mb-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Changer le statut</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Qualifié"
                  onClick={() => updateStatus('qualifie')}
                  loading={actionLoading === 'qualifie'}
                  color="purple"
                  small
                />
                <ActionButton
                  label="Proposition"
                  onClick={() => updateStatus('proposition')}
                  loading={actionLoading === 'proposition'}
                  color="orange"
                  small
                />
                <ActionButton
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="Converti"
                  onClick={() => updateStatus('converti')}
                  loading={actionLoading === 'converti'}
                  color="green"
                  small
                />
                <ActionButton
                  icon={<XCircle className="w-4 h-4" />}
                  label="Perdu"
                  onClick={() => updateStatus('perdu')}
                  loading={actionLoading === 'perdu'}
                  color="zinc"
                  small
                />
              </div>
            </div>

            {/* Other actions */}
            <div className="flex gap-2">
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Appeler
              </a>
              <button
                onClick={() => setShowFollowupModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Planifier relance
              </button>
              {lead.maps_url && (
                <a
                  href={lead.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Maps
                </a>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Notes</h3>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Ajouter une note..."
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm"
              />
              <button
                onClick={addNote}
                disabled={!newNote.trim() || actionLoading === 'note'}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading === 'note' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Ajouter"
                )}
              </button>
            </div>

            {lead.notes ? (
              <pre className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                {lead.notes}
              </pre>
            ) : (
              <p className="text-sm text-zinc-400 italic">Aucune note</p>
            )}
          </div>
        </div>

        {/* Right column - History */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Historique</h3>
            
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((entry) => (
                  <HistoryItem key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">Aucun historique</p>
            )}
          </div>
        </div>
      </div>

      {/* Followup Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Planifier une relance
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-500 mb-1">Date</label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
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
                onClick={() => setShowFollowupModal(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                onClick={scheduleFollowup}
                disabled={!followupDate || actionLoading === 'followup'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === 'followup' && <Loader2 className="w-4 h-4 animate-spin" />}
                Planifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  loading,
  color,
  small,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  loading: boolean;
  color: 'green' | 'yellow' | 'blue' | 'red' | 'purple' | 'orange' | 'zinc';
  small?: boolean;
}) {
  const colors = {
    green: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300',
    blue: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300',
    red: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300',
    purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300',
    orange: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300',
    zinc: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 ${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const typeLabels: Record<string, string> = {
    call: 'Appel',
    email: 'Email',
    note: 'Note',
    status_change: 'Statut',
    followup_set: 'Relance',
  };

  const typeColors: Record<string, string> = {
    call: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400',
    email: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
    note: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    status_change: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400',
    followup_set: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
  };

  return (
    <div className="flex gap-3">
      <div className={`p-2 rounded-lg ${typeColors[entry.type]}`}>
        {HISTORY_ICONS[entry.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {typeLabels[entry.type]}
          </span>
          {entry.old_value && entry.new_value && (
            <span className="text-xs text-zinc-500">
              {entry.old_value} → {entry.new_value}
            </span>
          )}
        </div>
        {entry.note && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
            {entry.note}
          </p>
        )}
        <p className="text-xs text-zinc-400">
          {new Date(entry.created_at).toLocaleString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
