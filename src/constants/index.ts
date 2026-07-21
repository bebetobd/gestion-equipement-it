import { Monitor, Wifi, Server, Printer, ClipboardList, Archive, Camera } from 'lucide-react';
import type { EquipmentType, EquipmentStatus, Permission } from '../types';

export const PERMISSION_CONFIG: { value: Permission; label: string; desc: string; color: string }[] = [
  { value: 'lecture',      label: 'Lecture',       desc: 'Consulter la liste des équipements',      color: 'blue'   },
  { value: 'ecriture',     label: 'Écriture',      desc: 'Ajouter de nouveaux équipements',          color: 'green'  },
  { value: 'modification', label: 'Modification',  desc: 'Modifier et supprimer des équipements',    color: 'orange' }
];

export const defaultFormData = {
  name: '',
  type: 'ordinateur' as EquipmentType,
  brand: '',
  model: '',
  serialNumber: '',
  ipAddress: '',
  location: '',
  department: '',
  status: 'actif' as EquipmentStatus,
  purchaseDate: '',
  warranty: '',
  lastMaintenance: '',
  visited: false,
  technicianName: '',
  visitDate: '',
  interventionDetails: '',
  siteId: null as number | null,
  supplierId: null as number | null,
  quantity: 1,
  minQuantity: 0,
};

export const equipmentTypes = [
  { value: 'ordinateur' as EquipmentType, label: 'Ordinateur', icon: Monitor },
  { value: 'reseau' as EquipmentType, label: 'Équipement Réseau', icon: Wifi },
  { value: 'serveur' as EquipmentType, label: 'Serveur', icon: Server },
  { value: 'imprimante' as EquipmentType, label: 'Imprimante', icon: Printer },
  { value: 'camera' as EquipmentType, label: 'Caméra', icon: Camera },
  { value: 'accessoires' as EquipmentType, label: 'Accessoires', icon: ClipboardList },
  { value: 'autre' as EquipmentType, label: 'Autre', icon: Archive }
];

export const roleDisplay: Record<string, { label: string; classes: string }> = {
  admin: { label: 'Administrateur', classes: 'bg-red-100 text-red-700' },
  technicien: { label: 'Technicien', classes: 'bg-blue-100 text-blue-700' },
  user: { label: 'Utilisateur', classes: 'bg-gray-100 text-gray-700' }
};

export const API_BASE_URL = '';

export const API_BASE = `${API_BASE_URL}/api/equipments`;
export const API_USERS = `${API_BASE_URL}/api/users`;
export const EXPORT_URL = `${API_BASE_URL}/api/equipments/export`;

export const statusColors: Record<EquipmentStatus, string> = {
  actif: 'bg-green-100 text-green-800',
  inactif: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  defaillant: 'bg-red-100 text-red-800',
  réformé: 'bg-purple-100 text-purple-800',
};

export const sampleEquipments = [
  {
    id: 1,
    name: 'PC-Bureau-001',
    type: 'ordinateur' as EquipmentType,
    brand: 'Dell',
    model: 'OptiPlex 7090',
    serialNumber: 'DL7090001',
    ipAddress: '192.168.1.101',
    location: 'Bureau 205',
    department: 'Comptabilité',
    status: 'actif' as EquipmentStatus,
    purchaseDate: '2023-03-15',
    warranty: '2026-03-15',
    lastMaintenance: '2024-08-15',
    visited: true,
    technicianName: 'Jean Dupont',
    visitDate: '2024-09-15T14:30',
    interventionDetails: 'Mise à jour système et nettoyage complet',
    quantity: 1,
    minQuantity: 0,
  },
  {
    id: 2,
    name: 'Switch-Etage-2',
    type: 'reseau' as EquipmentType,
    brand: 'Cisco',
    model: 'Catalyst 2960',
    serialNumber: 'CS2960002',
    ipAddress: '192.168.1.10',
    location: 'Local technique Étage 2',
    department: 'Infrastructure',
    status: 'actif' as EquipmentStatus,
    purchaseDate: '2022-11-20',
    warranty: '2027-11-20',
    lastMaintenance: '2024-07-10',
    visited: false,
    technicianName: '',
    visitDate: '',
    interventionDetails: '',
    quantity: 1,
    minQuantity: 0,
  },
  {
    id: 3,
    name: 'Imprimante-RH-001',
    type: 'imprimante' as EquipmentType,
    brand: 'HP',
    model: 'LaserJet Pro 404dn',
    serialNumber: 'HP404001',
    ipAddress: '192.168.1.150',
    location: 'Bureau RH',
    department: 'Ressources Humaines',
    status: 'maintenance' as EquipmentStatus,
    purchaseDate: '2023-07-12',
    warranty: '2026-07-12',
    lastMaintenance: '2024-09-01',
    visited: true,
    technicianName: 'Marie Martin',
    visitDate: '2024-09-18T09:15',
    interventionDetails: 'Remplacement toner et maintenance préventive',
    quantity: 1,
    minQuantity: 0,
  }
];

export const PAGE_SIZE = 50;

export const workLogTypes = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'assistance', label: 'Assistance' },
  { value: 'installation', label: 'Installation' },
  { value: 'visite', label: 'Visite de site' },
  { value: 'formation', label: 'Formation' },
  { value: 'admin', label: 'Administration' },
  { value: 'autre', label: 'Autre' },
];

export const workLogStatuses = [
  { value: 'termine', label: 'Terminé', color: 'bg-green-100 text-green-700' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  { value: 'planifie', label: 'Planifié', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'annule', label: 'Annulé', color: 'bg-red-100 text-red-700' },
];

export const AVAILABLE_MODULES: { value: string; label: string }[] = [
  { value: 'transfers', label: 'Transferts' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'feuille_de_temps', label: 'Feuille de temps' },
  { value: 'visites', label: 'Visites de site' },
  { value: 'garanties', label: 'Garanties' },
  { value: 'renouv_garantie', label: 'Renouv. Garantie' },
  { value: 'rapports', label: 'Rapports' },
  { value: 'calendrier', label: 'Calendrier' },
  { value: 'carte', label: 'Carte' },
  { value: 'licences', label: 'Licences' },
  { value: 'contrats', label: 'Contrats' },
  { value: 'achats', label: "Demandes d'achat" },
  { value: 'anomalies', label: 'Anomalies' },
  { value: 'monitoring_reseau', label: 'Monitoring Réseau' },
];
