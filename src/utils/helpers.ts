import type { Equipment, EquipmentType } from '../types';

export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
});

export const formatDuration = (startIso: string) => {
  const diffMs = Date.now() - new Date(startIso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Moins d'1 min";
  if (diffMins < 60) return `${diffMins} min`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return `${h}h ${m}min`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

export const isOnline = (lastSeen: string) =>
  Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;

export const getActionStyle = (action: string): string => {
  if (action === 'Connexion') return 'bg-green-100 text-green-700';
  if (action === 'Déconnexion') return 'bg-gray-100 text-gray-600';
  if (action.startsWith('Ajout') || action.startsWith('Création')) return 'bg-blue-100 text-blue-700';
  if (action.startsWith('Modification')) return 'bg-yellow-100 text-yellow-700';
  if (action.startsWith('Suppression')) return 'bg-red-100 text-red-700';
  if (action === 'Export CSV') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
};

export const getDepreciation = (equipment: Equipment) => {
  if (!equipment.purchaseDate) return null;
  const years: Record<EquipmentType, number> = { ordinateur: 4, serveur: 5, reseau: 6, imprimante: 5, scanner: 5, camera: 5, accessoires: 3, autre: 5 };
  const lifespan = years[equipment.type] ?? 5;
  const age = (Date.now() - new Date(equipment.purchaseDate).getTime()) / (365.25 * 86400000);
  const pct = Math.max(0, Math.min(100, Math.round((1 - age / lifespan) * 100)));
  return { age: age.toFixed(1), pct, status: pct > 60 ? 'bon' : pct > 30 ? 'moyen' : 'faible' };
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
