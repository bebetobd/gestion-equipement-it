import React, { useMemo, useState } from 'react';
import { ShieldCheck, XCircle, AlertTriangle, Clock, Info, RefreshCcw } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import type { Site } from '../types';

interface Equipment {
  id: number;
  name: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  department: string;
  location: string;
  siteId?: number | null;
  warranty: string;
}

interface WarrantyDetail extends Equipment {
  warrantyStatus: 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';
  warrantyLabel: string;
  warrantyClass: string;
  warrantyDays: number | null;
}

interface WarrantyModuleProps {
  equipments: Equipment[];
  sites: Site[];
  selectedSiteIds: number[];
  onClose: () => void;
}

const getWarrantyStatus = (warranty: string): { status: WarrantyDetail['warrantyStatus']; days: number | null; label: string; color: string } | null => {
  if (!warranty) return null;
  const d = new Date(warranty);
  if (isNaN(d.getTime())) return null;
  const diffDays = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays), label: 'Expirée', color: 'bg-red-100 text-red-700 border-red-200' };
  if (diffDays <= 30) return { status: 'critical', days: diffDays, label: `${diffDays}j`, color: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (diffDays <= 90) return { status: 'warning', days: diffDays, label: `${Math.ceil(diffDays/30)}m`, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { status: 'ok', days: diffDays, label: `${Math.floor(diffDays/30)}m`, color: 'bg-green-100 text-green-700 border-green-200' };
};

const warrantyRiskLabels: Record<string, string> = {
  all: 'Tous statuts', expired: 'Expirées', critical: 'Critiques',
  warning: 'Alerte', ok: 'OK', unknown: 'Non renseignées',
};

const warrantyRiskExplanations: Record<string, string> = {
  expired: 'Garantie expirée : risque de frais hors garantie et délai de réparation prolongé.',
  critical: 'Garantie bientôt expirée (≤ 30 jours) : risque élevé de coût de maintenance non couvert.',
  warning: 'Garantie proche de fin (≤ 90 jours) : planification de renouvellement recommandée.',
  ok: 'Garantie active : couverture encore valide.',
  unknown: 'Aucune date de garantie renseignée : vérifier l\'équipement rapidement.',
};

export default function WarrantyModule({ equipments, sites, selectedSiteIds, onClose }: WarrantyModuleProps) {
  const [riskFilter, setRiskFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'ok' | 'unknown'>('all');

  const warrantyDetails: WarrantyDetail[] = useMemo(() => {
    return equipments.map((equipment) => {
      const wInfo = getWarrantyStatus(equipment.warranty);
      return {
        ...equipment,
        warrantyStatus: wInfo?.status ?? 'unknown',
        warrantyLabel: wInfo?.label ?? 'Non renseignée',
        warrantyClass: wInfo?.color ?? 'bg-gray-100 text-gray-700 border-gray-200',
        warrantyDays: wInfo?.days ?? null,
      };
    });
  }, [equipments]);

  const stats = useMemo(() => ({
    total: warrantyDetails.length,
    expired: warrantyDetails.filter((e) => e.warrantyStatus === 'expired').length,
    critical: warrantyDetails.filter((e) => e.warrantyStatus === 'critical').length,
    warning: warrantyDetails.filter((e) => e.warrantyStatus === 'warning').length,
    ok: warrantyDetails.filter((e) => e.warrantyStatus === 'ok').length,
    unknown: warrantyDetails.filter((e) => e.warrantyStatus === 'unknown').length,
  }), [warrantyDetails]);

  const siteStats = useMemo(() => sites
    .filter((site) => selectedSiteIds.length === 0 || selectedSiteIds.includes(site.id))
    .map((site) => {
      const siteEquipments = warrantyDetails.filter((e) => e.siteId === site.id);
      return {
        ...site,
        total: siteEquipments.length,
        expired: siteEquipments.filter((e) => e.warrantyStatus === 'expired').length,
        critical: siteEquipments.filter((e) => e.warrantyStatus === 'critical').length,
        warning: siteEquipments.filter((e) => e.warrantyStatus === 'warning').length,
        ok: siteEquipments.filter((e) => e.warrantyStatus === 'ok').length,
        unknown: siteEquipments.filter((e) => e.warrantyStatus === 'unknown').length,
      };
    })
    .sort((a, b) => (b.expired + b.critical) - (a.expired + a.critical) || b.warning - a.warning || b.total - a.total),
  [sites, selectedSiteIds, warrantyDetails]);

  const visibleEquipments = useMemo(() => warrantyDetails.filter((e) =>
    riskFilter === 'all' || e.warrantyStatus === riskFilter
  ), [warrantyDetails, riskFilter]);

  return (
    <ModuleShell
      icon={<ShieldCheck className="w-5 h-5 text-white" />}
      title="Garanties"
      subtitle={`${equipments.filter(e => e.warranty).length} équipement(s) sous garantie`}
      onClose={onClose}
    >
      <div className="p-4 lg:p-5 space-y-4">
        {/* Stat cards */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {[
            { label: 'Total suivis', value: stats.total, icon: ShieldCheck, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Expirée', value: stats.expired, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Critique', value: stats.critical, icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Bientôt fin', value: stats.warning, icon: Clock, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Non renseignée', value: stats.unknown, icon: Info, color: 'text-gray-600', bg: 'bg-gray-50' },
          ].map(card => (
            <span key={card.label} className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg ${card.bg} ${card.color}`}>
              <card.icon className="w-3 h-3" /> {card.label}: {card.value}
            </span>
          ))}
        </div>

        {/* Risk filter + explanations */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-800">Filtrer par risque</p>
              <span className="text-xs font-medium text-gray-400">{warrantyRiskLabels[riskFilter]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all','expired','critical','warning','unknown','ok'] as const).map((status) => (
                <button key={status} type="button" onClick={() => setRiskFilter(status)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${riskFilter === status ? 'bg-[#1a6fa6] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {warrantyRiskLabels[status]}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Risques et actions</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(warrantyRiskExplanations).map(([status, text]) => (
                <div key={status} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{warrantyRiskLabels[status]}</div>
                  <div className="text-xs text-gray-600">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Site + Equipment */}
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Synthèse par site</h3>
                <p className="text-xs text-gray-400">Sites triés par exposition au risque.</p>
              </div>
              <button onClick={() => setRiskFilter('all')} className="text-xs text-[#1a6fa6] hover:text-[#154a7d] font-medium">Réinitialiser</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="border-b border-gray-100 text-gray-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">Site</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Total</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Exp.</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Crit.</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">Alerte</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">OK</th>
                    <th className="px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-right">N/A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {siteStats.map((site) => (
                    <tr key={site.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">{site.name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 text-sm">{site.total}</td>
                      <td className="px-3 py-2.5 text-right text-red-600 text-sm font-medium">{site.expired}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700 text-sm font-medium">{site.critical}</td>
                      <td className="px-3 py-2.5 text-right text-orange-600 text-sm font-medium">{site.warning}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-600 text-sm font-medium">{site.ok}</td>
                      <td className="px-3 py-2.5 text-right text-gray-400 text-sm">{site.unknown}</td>
                    </tr>
                  ))}
                  {siteStats.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">Aucun site sélectionné ou aucune donnée disponible.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Équipements</h3>
            <div className="space-y-2">
              {visibleEquipments.slice(0, 12).map((equipment) => (
                <div key={equipment.id} className="group rounded-xl border border-gray-100 p-3 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">{equipment.name.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{equipment.name}</div>
                        <div className="text-xs text-gray-400 truncate">{equipment.department}{equipment.location ? ` · ${equipment.location}` : ''}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${equipment.warrantyClass}`}>{equipment.warrantyLabel}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1 ml-9.5">
                    <span>{equipment.siteId ? sites.find((s) => s.id === equipment.siteId)?.name ?? 'Site inconnu' : 'Sans site'}</span>
                    <span>Type: {equipment.type}</span>
                    {equipment.serialNumber && <span>Réf: {equipment.serialNumber}</span>}
                  </div>
                </div>
              ))}
              {visibleEquipments.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Aucun équipement correspondant à ce filtre.</p>}
              {visibleEquipments.length > 12 && (
                <p className="text-xs text-gray-400 pt-2 text-center">Affichage des 12 premiers résultats sur {visibleEquipments.length}.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
