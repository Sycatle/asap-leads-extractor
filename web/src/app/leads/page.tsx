import { Users, Phone, Calendar, TrendingUp } from "lucide-react";

// Placeholder - sera remplacé par les vraies données
const stats = {
  total: 0,
  toCall: 0,
  followups: 0,
  conversionRate: 0,
};

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          label="Total leads" 
          value={stats.total} 
          color="blue" 
        />
        <StatCard 
          icon={Phone} 
          label="À appeler" 
          value={stats.toCall} 
          color="orange" 
        />
        <StatCard 
          icon={Calendar} 
          label="Relances" 
          value={stats.followups} 
          color="purple" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Conversion" 
          value={`${stats.conversionRate}%`} 
          color="green" 
        />
      </div>

      {/* Filters placeholder */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-zinc-500">Filtres:</span>
          <select className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
            <option>Tous les status</option>
            <option>Nouveau</option>
            <option>Contacté</option>
            <option>Qualifié</option>
          </select>
          <select className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
            <option>Toutes les villes</option>
          </select>
          <select className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm">
            <option>Toutes les priorités</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
      </div>

      {/* Table placeholder */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Ville
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Téléphone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Priorité
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                <div className="flex flex-col items-center gap-2">
                  <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                  <p>Aucun lead pour le moment</p>
                  <p className="text-sm">Lancez un scrape depuis l&apos;onglet Config</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: "blue" | "orange" | "purple" | "green";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
