import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Monitor, Wifi, Server, Printer,
  User, Users, Calendar, MapPin, AlertTriangle, CheckCircle,
  XCircle, Info, Clock, Download, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCcw, LogOut, Activity, ArrowRightLeft, FileText, Upload, File,
  Wrench, CircleCheck, Archive, Globe, Building2, ClipboardList,
  MessageCircle, Send, X, Ban, ShieldCheck, QrCode, LayoutGrid, LayoutList, ChevronUp,
  Moon, Sun, Eye, EyeOff, Headset
} from 'lucide-react';
import * as ExportHelpers from './utils/exportHelpers';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import MaintenanceModule from './modules/MaintenanceModule';
import ReportsModule from './modules/ReportsModule';
import MonitoringModule from './modules/MonitoringModule';
import UsersModule from './modules/UsersModule';
import ActivityLogModule from './modules/ActivityLogModule';
import VisitsModule from './modules/VisitsModule';
import {
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  Paragraph as DocxParagraph,
  TextRun,
  Document as DocxDocument,
  Packer,
  Table as DocxTable,
  WidthType,
  HeadingLevel
} from 'docx';
import 'leaflet/dist/leaflet.css';

interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  allowedSiteIds?: number[];
}

type Permission = 'lecture' | 'ecriture' | 'modification';

const PERMISSION_CONFIG: { value: Permission; label: string; desc: string; color: string }[] = [
  { value: 'lecture',      label: 'Lecture',       desc: 'Consulter la liste des équipements',      color: 'blue'   },
  { value: 'ecriture',     label: 'Écriture',      desc: 'Ajouter de nouveaux équipements',          color: 'green'  },
  { value: 'modification', label: 'Modification',  desc: 'Modifier et supprimer des équipements',    color: 'orange' }
];

interface ITEquipmentManagerProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

type EquipmentType = 'ordinateur' | 'reseau' | 'serveur' | 'imprimante' | 'accessoires' | 'autre';
type EquipmentStatus = 'actif' | 'inactif' | 'maintenance' | 'defaillant' | 'réformé';
type VisitStatus = 'planifié' | 'en_cours' | 'terminé' | 'annulé' | 'reporté';

interface SiteVisit {
  id: number;
  siteId: number;
  siteName: string;
  scheduledDate: string;
  scheduledTime: string;
  technician: string;
  purpose: string;
  status: VisitStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  withMaintenance: boolean;
  equipmentIds: number[];
  maintenanceDesc: string;
  validationComment: string;
  validatedAt: string | null;
  validatedBy: string;
  rescheduledDate: string | null;
}

interface Equipment {
  id: number;
  name: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  location: string;
  department: string;
  status: EquipmentStatus;
  purchaseDate: string;
  warranty: string;
  lastMaintenance: string;
  visited: boolean;
  technicianName: string;
  visitDate: string;
  interventionDetails: string;
  replacedById?: number | null;
  siteId?: number | null;
  quantity: number;
  minQuantity: number;
}

interface EquipmentFormData extends Omit<Equipment, 'id'> {}

interface EquipmentDoc {
  id: number;
  equipmentId: number;
  filename: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface TransferForm {
  toLocation: string;
  toDepartment: string;
  toSiteId: number | null;
  reason: string;
  technicianName: string;
  transferRequester: string;
  transferResponsible: string;
  notes: string;
  transferQty: number;
}

type MaintenanceStatus = 'en_attente' | 'ouvert' | 'en_cours' | 'résolu';
type MaintenancePriority = 'faible' | 'normale' | 'haute' | 'critique';

interface MaintenanceRecord {
  id: number;
  equipmentId: number | null;
  equipmentName: string;
  equipmentType: string;
  department: string;
  failureDesc: string;
  diagnosis: string;
  solution: string;
  partsReplaced: string;
  technician: string;
  openedBy: string;
  openedAt: string;
  startedAt: string | null;
  closedAt: string | null;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  notes: string;
  visitId: number | null;
  siteName: string;
  requestType: string;
  assignedTechId: number | null;
  userConfirmed: boolean;
  techConfirmed: boolean;
  rating: number | null;
  reviewComment: string;
}

interface Site {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  email: string;
  phone: string;
  createdAt: string;
  equipmentCount: number;
}

interface SiteForm {
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  email: string;
  phone: string;
}

interface SiteStat {
  site_id: number;
  site_name: string;
  city: string;
  country: string;
  equipment_count: number;
  total_events: number;
  creations: number;
  modifications: number;
  transferts: number;
  interventions: number;
  reformes: number;
  suppressions: number;
  last_activity: string | null;
}

interface ReformForm {
  reason: string;
  replacedById: number | null;
  notes: string;
  reformQty: number;
}

interface MaintenanceForm {
  equipmentId: number | null;
  failureDesc: string;
  diagnosis: string;
  solution: string;
  partsReplaced: string;
  technician: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  requestType: string;
}

const defaultFormData: EquipmentFormData = {
  name: '',
  type: 'ordinateur',
  brand: '',
  model: '',
  serialNumber: '',
  ipAddress: '',
  location: '',
  department: '',
  status: 'actif',
  purchaseDate: '',
  warranty: '',
  lastMaintenance: '',
  visited: false,
  technicianName: '',
  visitDate: '',
  interventionDetails: '',
  siteId: null,
  quantity: 1,
  minQuantity: 0,
};

const equipmentTypes = [
  { value: 'ordinateur' as EquipmentType, label: 'Ordinateur', icon: Monitor },
  { value: 'reseau' as EquipmentType, label: 'Équipement Réseau', icon: Wifi },
  { value: 'serveur' as EquipmentType, label: 'Serveur', icon: Server },
  { value: 'imprimante' as EquipmentType, label: 'Imprimante', icon: Printer },
  { value: 'accessoires' as EquipmentType, label: 'Accessoires', icon: ClipboardList },
  { value: 'autre' as EquipmentType, label: 'Autre', icon: Archive }
];

const roleDisplay: Record<string, { label: string; classes: string }> = {
  admin: { label: 'Administrateur', classes: 'bg-red-100 text-red-700' },
  technicien: { label: 'Technicien', classes: 'bg-blue-100 text-blue-700' },
  user: { label: 'Utilisateur', classes: 'bg-gray-100 text-gray-700' }
};

const API_BASE_URL = '';

const API_BASE = `${API_BASE_URL}/api/equipments`;
const API_USERS = `${API_BASE_URL}/api/users`;
const EXPORT_URL = `${API_BASE_URL}/api/equipments/export`;

const statusColors: Record<EquipmentStatus, string> = {
  actif: 'bg-green-100 text-green-800',
  inactif: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  defaillant: 'bg-red-100 text-red-800',
  réformé: 'bg-purple-100 text-purple-800',
};

const sampleEquipments: Equipment[] = [
  {
    id: 1,
    name: 'PC-Bureau-001',
    type: 'ordinateur',
    brand: 'Dell',
    model: 'OptiPlex 7090',
    serialNumber: 'DL7090001',
    ipAddress: '192.168.1.101',
    location: 'Bureau 205',
    department: 'Comptabilité',
    status: 'actif',
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
    type: 'reseau',
    brand: 'Cisco',
    model: 'Catalyst 2960',
    serialNumber: 'CS2960002',
    ipAddress: '192.168.1.10',
    location: 'Local technique Étage 2',
    department: 'Infrastructure',
    status: 'actif',
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
    type: 'imprimante',
    brand: 'HP',
    model: 'LaserJet Pro 404dn',
    serialNumber: 'HP404001',
    ipAddress: '192.168.1.150',
    location: 'Bureau RH',
    department: 'Ressources Humaines',
    status: 'maintenance',
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

interface UserAccount {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  permissions: string[];
  allowedSiteIds: number[];
  blocked?: boolean;
}

interface UserFormData {
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  password: string;
  permissions: Permission[];
  allowedSiteIds: number[];
}

interface SessionInfo {
  userId: number;
  username: string;
  name: string;
  role: string;
  loginAt: string;
  lastSeen: string;
  ip: string;
}

interface ActivityEntry {
  id: number;
  userId: number;
  username: string;
  name: string;
  action: string;
  details: string;
  timestamp: string;
  ip: string;
}

interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  recipientId: number | null;
  groupId: number | null;
  content: string;
  createdAt: string;
}

interface ChatUser {
  id: number;
  username: string;
  name: string;
}

interface ChatGroup {
  id: number;
  name: string;
  created_by: number;
  member_ids: number[];
}

interface FieldChange {
  field: string;
  from: string | boolean;
  to: string | boolean;
}

interface EquipmentEvent {
  id: number;
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  department: string;
  action: string;
  details: string;
  changes: FieldChange[];
  technician: string;
  userId: number;
  username: string;
  userName: string;
  ip: string;
  createdAt: string;
}

interface DeptStat {
  department: string;
  total_events: string;
  equipment_count: string;
  creations: string;
  modifications: string;
  interventions: string;
  suppressions: string;
  last_activity: string;
}

interface UserStat {
  user_name: string;
  username: string;
  total_actions: string;
  creations: string;
  modifications: string;
  interventions: string;
  transferts: string;
  suppressions: string;
  maintenances: string;
  reformes: string;
  equipment_count: string;
  dept_count: string;
  last_action: string;
}

const Section = ({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: 'red' | 'yellow' | 'green' | 'blue'; children: React.ReactNode }) => {
  const border = { red: 'border-red-200', yellow: 'border-yellow-200', green: 'border-green-200', blue: 'border-blue-200' }[color];
  const bg = { red: 'bg-red-50', yellow: 'bg-yellow-50', green: 'bg-green-50', blue: 'bg-blue-50' }[color];
  return (
    <div className={`rounded-lg border ${border} ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  );
};

const PAGE_SIZE = 50;

function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Build page list with ellipsis
  const raw: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) raw.push(i);
  }
  const items: (number | '…')[] = [];
  let prev = 0;
  for (const p of raw) {
    if (prev && p - prev > 1) items.push('…');
    items.push(p);
    prev = p;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white text-xs select-none">
      <span className="text-gray-400">{from}–{to} sur {total}</span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {items.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button key={p} onClick={() => onChange(p as number)}
              className={`min-w-[1.75rem] h-7 rounded-lg font-medium transition ${p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const ITEquipmentManager = ({ currentUser, onLogout }: ITEquipmentManagerProps) => {
  const isAdmin = currentUser.role === 'admin';
  const roleInfo = roleDisplay[currentUser.role] ?? { label: currentUser.role, classes: 'bg-gray-100 text-gray-700' };
  const canWrite  = isAdmin || (currentUser.permissions ?? []).includes('ecriture');
  const canModify = isAdmin || (currentUser.permissions ?? []).includes('modification');
  const userAllowedSiteIds = currentUser.allowedSiteIds ?? [];

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
  });

  const [equipments, setEquipments] = useState<Equipment[]>(sampleEquipments);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | EquipmentType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EquipmentStatus>('all');
  const [equipPage, setEquipPage] = useState(1);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>(defaultFormData);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [userEditingId, setUserEditingId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessTarget, setAccessTarget] = useState<UserAccount | null>(null);
  const [accessForm, setAccessForm] = useState<{ role: UserAccount['role']; permissions: Permission[]; allowedSiteIds: number[] }>({ role: 'technicien', permissions: ['lecture'], allowedSiteIds: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showModulesMenu, setShowModulesMenu] = useState(false);
  const modulesMenuRef = useRef<HTMLDivElement>(null);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  // Transfer
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Equipment | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>({ toLocation: '', toDepartment: '', toSiteId: null, reason: 'Réorganisation', technicianName: '', transferRequester: '', transferResponsible: '', notes: '', transferQty: 1 });
  const [transferLoading, setTransferLoading] = useState(false);

  // Documents
  const [detailsTab, setDetailsTab] = useState<'info' | 'transfers' | 'documents' | 'history' | 'notes'>('info');
  const [equipmentNotes, setEquipmentNotes] = useState<Record<number, string[]>>({});
  const [noteInput, setNoteInput] = useState('');
  const [tasks, setTasks] = useState<{id:number;title:string;dueDate:string;assignedTo:string;priority:'haute'|'normale'|'basse';done:boolean}[]>(() => {
    try { return JSON.parse(localStorage.getItem('it-tasks') || '[]'); } catch { return []; }
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title:'', dueDate:'', assignedTo:'', priority:'normale' as 'haute'|'normale'|'basse' });
  const saveTasks = (updated: typeof tasks) => { setTasks(updated); localStorage.setItem('it-tasks', JSON.stringify(updated)); };
  const [equipmentDocs, setEquipmentDocs] = useState<EquipmentDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [newEquipDocs, setNewEquipDocs] = useState<{ file: File; description: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Maintenance
  const [showMaintenanceModule, setShowMaintenanceModule] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>('all');
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceEditId, setMaintenanceEditId] = useState<number | null>(null);
  const defaultMaintenanceForm: MaintenanceForm = { equipmentId: null, failureDesc: '', diagnosis: '', solution: '', partsReplaced: '', technician: '', priority: 'normale', status: 'ouvert', requestType: 'maintenance' };
  const [maintenanceForm, setMaintForm] = useState<MaintenanceForm>(defaultMaintenanceForm);
  const [showMaintenanceReport, setShowMaintenanceReport] = useState(false);
  const [maintTechFilter, setMaintTechFilter] = useState<string[]>([]);
  const [visitTechFilter, setVisitTechFilter] = useState<string[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [showAssistanceFilter, setShowAssistanceFilter] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const defaultSiteForm: SiteForm = { name: '', city: '', country: '', address: '', description: '', latitude: '', longitude: '', email: '', phone: '' };
  const [siteForm, setSiteForm] = useState<SiteForm>(defaultSiteForm);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);

  // Transfer module
  const [showTransferModule, setShowTransferModule] = useState(false);
  const [allTransfers, setAllTransfers] = useState<any[]>([]);
  const [transferModuleLoading, setTransferModuleLoading] = useState(false);
  const [transferModuleFilter, setTransferModuleFilter] = useState({ department: '', from: '', to: '' });
  const [showTransferReport, setShowTransferReport] = useState(false);

  // Reform
  const [showReformModal, setShowReformModal] = useState(false);
  const [reformTarget, setReformTarget] = useState<Equipment | null>(null);
  const [reformForm, setReformForm] = useState<ReformForm>({ reason: '', replacedById: null, notes: '', reformQty: 1 });
  const [reformLoading, setReformLoading] = useState(false);

  // Activity log
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityEntries, setActivityEntries] = useState<any[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState({ username: '', dateFrom: '', dateTo: '', action: '' });

  // Site visits
  const [showVisitModule, setShowVisitModule] = useState(false);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitFilter, setVisitFilter] = useState({ siteId: '', status: '', from: '', to: '' });
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const defaultVisitForm = { siteId: null as number | null, scheduledDate: '', scheduledTime: '', technician: '', purpose: '', status: 'planifié' as VisitStatus, notes: '', withMaintenance: false, equipmentIds: [] as number[], maintenanceDesc: '' };
  const [visitForm, setVisitForm] = useState(defaultVisitForm);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitActionDialog, setVisitActionDialog] = useState<{ visit: SiteVisit; action: 'terminé' | 'annulé' | 'reporté'; comment: string; newDate: string; maintenanceAction: 'sur_place' | 'programmer' | 'laisser' } | null>(null);
  const [showVisitReports, setShowVisitReports] = useState(false);
  const [eqSearchQuery, setEqSearchQuery] = useState('');
  const [showEqDropdown, setShowEqDropdown] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [showVisitSiteDropdown, setShowVisitSiteDropdown] = useState(false);

  // Monitoring
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [monitoringTab, setMonitoringTab] = useState<'sessions' | 'activities'>('sessions');
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [showWarrantyModule, setShowWarrantyModule] = useState(false);
  const [warrantyRiskFilter, setWarrantyRiskFilter] = useState<'all' | 'expired' | 'critical' | 'warning' | 'ok' | 'unknown'>('all');
  const [showWarrantyRenewModule, setShowWarrantyRenewModule] = useState(false);
  const [warrantyRenewSearch, setWarrantyRenewSearch] = useState('');
  const [warrantyRenewEquipId, setWarrantyRenewEquipId] = useState<number | null>(null);
  const [warrantyRenewDate, setWarrantyRenewDate] = useState('');
  const [warrantyRenewSaving, setWarrantyRenewSaving] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityUserFilter, setActivityUserFilter] = useState<number | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringLastRefresh, setMonitoringLastRefresh] = useState<Date | null>(null);
  const activityUserFilterRef = useRef<number | null>(null);

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatConversation, setChatConversation] = useState<'global' | number>('global');
  const [chatActiveGroup, setChatActiveGroup] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUnread, setChatUnread] = useState<{ global: number; dms: Record<number, number>; groups: Record<number, number> }>({ global: 0, dms: {}, groups: {} });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<number[]>([]);
  const [groupCreating, setGroupCreating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Global search ──────────────────────────────────────────────────────────
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const globalSearchRef = useRef<HTMLInputElement>(null);

  // ── Import équipements ─────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Partial<Equipment>[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── QR Code ────────────────────────────────────────────────────────────────
  const [qrEquipment, setQrEquipment] = useState<Equipment | null>(null);

  // ── Contrats de maintenance ────────────────────────────────────────────────
  interface MaintenanceContract {
    id: number; title: string; vendor: string; contract_number: string;
    site_id: number | null; equipment_ids: number[]; start_date: string | null;
    end_date: string | null; amount: number | null; currency: string;
    scope: string; contact_name: string; contact_email: string; contact_phone: string;
    status: string; notes: string; created_at: string;
  }
  const [showContractsModule, setShowContractsModule] = useState(false);
  const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const defaultContractForm = { title: '', vendor: '', contractNumber: '', siteId: null as number | null, equipmentIds: [] as number[], startDate: '', endDate: '', amount: '' as string, currency: 'XOF', scope: '', contactName: '', contactEmail: '', contactPhone: '', status: 'actif', notes: '' };
  const [contractForm, setContractForm] = useState(defaultContractForm);

  const fetchContracts = async () => { setContractsLoading(true); try { const r = await fetch(`${API_BASE_URL}/api/contracts`, { headers: authHeaders() }); if (r.ok) setContracts(await r.json()); } finally { setContractsLoading(false); } };
  const saveContract = async () => {
    const url = editingContractId ? `${API_BASE_URL}/api/contracts/${editingContractId}` : `${API_BASE_URL}/api/contracts`;
    const r = await fetch(url, { method: editingContractId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(contractForm) });
    if (r.ok) { const s = await r.json(); if (editingContractId) setContracts(p => p.map(c => c.id === s.id ? s : c)); else setContracts(p => [s, ...p]); setShowContractForm(false); setEditingContractId(null); setContractForm(defaultContractForm); }
  };
  const deleteContract = (id: number) => setConfirmModal({ message: 'Supprimer ce contrat ?', onConfirm: async () => { setConfirmModal(null); await fetch(`${API_BASE_URL}/api/contracts/${id}`, { method: 'DELETE', headers: authHeaders() }); setContracts(p => p.filter(c => c.id !== id)); } });

  // ── Demandes d'achat ───────────────────────────────────────────────────────
  interface PurchaseRequest {
    id: number; title: string; equipment_type: string; quantity: number;
    estimated_cost: number | null; currency: string; priority: string;
    justification: string; requested_by: string; department: string;
    site_id: number | null; status: string; approved_by: string;
    approved_at: string | null; rejection_reason: string; notes: string; created_at: string;
  }
  const [showPurchasesModule, setShowPurchasesModule] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const defaultPurchaseForm = { title: '', equipmentType: 'ordinateur', quantity: 1, estimatedCost: '' as string, currency: 'XOF', priority: 'normale', justification: '', requestedBy: currentUser.name, department: '', siteId: null as number | null, notes: '' };
  const [purchaseForm, setPurchaseForm] = useState(defaultPurchaseForm);

  const fetchPurchases = async () => { setPurchasesLoading(true); try { const r = await fetch(`${API_BASE_URL}/api/purchases`, { headers: authHeaders() }); if (r.ok) setPurchases(await r.json()); } finally { setPurchasesLoading(false); } };
  const savePurchase = async () => { const r = await fetch(`${API_BASE_URL}/api/purchases`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(purchaseForm) }); if (r.ok) { const s = await r.json(); setPurchases(p => [s, ...p]); setShowPurchaseForm(false); setPurchaseForm(defaultPurchaseForm); } };
  const approvePurchase = async (id: number) => { const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/approve`, { method: 'PATCH', headers: authHeaders() }); if (r.ok) { const s = await r.json(); setPurchases(p => p.map(x => x.id === id ? s : x)); } };
  const rejectPurchase = async (id: number, reason: string) => { const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/reject`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ reason }) }); if (r.ok) { const s = await r.json(); setPurchases(p => p.map(x => x.id === id ? s : x)); } };

  // ── RMA ────────────────────────────────────────────────────────────────────
  interface RMARequest {
    id: number; equipment_id: number | null; equipment_name: string;
    serial_number: string; vendor: string; rma_number: string; reason: string;
    shipped_date: string | null; received_date: string | null; resolution: string;
    status: string; technician: string; notes: string; created_at: string;
  }
  const [showRMAModule, setShowRMAModule] = useState(false);
  const [rmaRequests, setRMARequests] = useState<RMARequest[]>([]);
  const [rmaLoading, setRMALoading] = useState(false);
  const [showRMAForm, setShowRMAForm] = useState(false);
  const [editingRMAId, setEditingRMAId] = useState<number | null>(null);
  const defaultRMAForm = { equipmentId: null as number | null, equipmentName: '', serialNumber: '', vendor: '', rmaNumber: '', reason: '', shippedDate: '', receivedDate: '', resolution: '', status: 'ouvert', technician: currentUser.name, notes: '' };
  const [rmaForm, setRMAForm] = useState(defaultRMAForm);

  const fetchRMA = async () => { setRMALoading(true); try { const r = await fetch(`${API_BASE_URL}/api/rma`, { headers: authHeaders() }); if (r.ok) setRMARequests(await r.json()); } finally { setRMALoading(false); } };
  const saveRMA = async () => {
    const url = editingRMAId ? `${API_BASE_URL}/api/rma/${editingRMAId}` : `${API_BASE_URL}/api/rma`;
    const r = await fetch(url, { method: editingRMAId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(rmaForm) });
    if (r.ok) { const s = await r.json(); if (editingRMAId) setRMARequests(p => p.map(x => x.id === s.id ? s : x)); else setRMARequests(p => [s, ...p]); setShowRMAForm(false); setEditingRMAId(null); setRMAForm(defaultRMAForm); }
  };

  // ── Détection anomalies ────────────────────────────────────────────────────
  interface AnomalyItem { id: number; name: string; type: string; department: string; location: string; ticket_count: number; last_ticket: string; }
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const fetchAnomalies = async () => { try { const r = await fetch(`${API_BASE_URL}/api/anomalies`, { headers: authHeaders() }); if (r.ok) setAnomalies(await r.json()); } catch (err) { console.error(err); } };

  // ── Ping réseau ────────────────────────────────────────────────────────────
  const [pingResults, setPingResults] = useState<Record<number, boolean | null>>({});
  const pingEquipment = async (id: number, ip: string) => {
    if (!ip) return;
    setPingResults(p => ({ ...p, [id]: null }));
    try { const r = await fetch(`${API_BASE_URL}/api/ping/${ip}`, { headers: authHeaders() }); const d = await r.json(); setPingResults(p => ({ ...p, [id]: d.reachable })); } catch { setPingResults(p => ({ ...p, [id]: false })); }
  };
  const pingAllEquipments = () => { filteredEquipments.filter(e => e.ipAddress).forEach(e => pingEquipment(e.id, e.ipAddress)); };

  // ── Slack/Teams webhook ────────────────────────────────────────────────────
  const [slackWebhook, setSlackWebhook] = useState(() => localStorage.getItem('it-slack-webhook') || '');
  const sendSlackNotif = async (message: string) => {
    const wh = localStorage.getItem('it-slack-webhook');
    if (!wh) return;
    await fetch(`${API_BASE_URL}/api/notify/webhook`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ webhookUrl: wh, message }) }).catch(() => {});
  };

  // ── Dashboard TV ───────────────────────────────────────────────────────────
  const [showTVDashboard, setShowTVDashboard] = useState(false);

  // ── Amortissement ──────────────────────────────────────────────────────────
  const getDepreciation = (equipment: Equipment) => {
    if (!equipment.purchaseDate) return null;
    const years: Record<EquipmentType, number> = { ordinateur: 4, serveur: 5, reseau: 6, imprimante: 5, accessoires: 3, autre: 5 };
    const lifespan = years[equipment.type] ?? 5;
    const age = (Date.now() - new Date(equipment.purchaseDate).getTime()) / (365.25 * 86400000);
    const pct = Math.max(0, Math.min(100, Math.round((1 - age / lifespan) * 100)));
    return { age: age.toFixed(1), pct, status: pct > 60 ? 'bon' : pct > 30 ? 'moyen' : 'faible' };
  };

  // ── Inventaire physique ────────────────────────────────────────────────────
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryScanned, setInventoryScanned] = useState<Set<number>>(new Set());
  const [inventoryMissing, setInventoryMissing] = useState<Equipment[]>([]);

  // ── Masquage données sensibles ─────────────────────────────────────────────
  const [maskSensitive, setMaskSensitive] = useState(() => localStorage.getItem('it-mask-sensitive') === 'true');
  const maskValue = (val: string) => maskSensitive && val ? '••••••••' : val;

  // ── Settings webhook ───────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);

  // ── Code-barres ────────────────────────────────────────────────────────────
  const [barcodeEquipment, setBarcodeEquipment] = useState<Equipment | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderBarcode = useCallback((equipment: Equipment | null) => {
    if (!equipment || !barcodeCanvasRef.current) return;
    const value = equipment.serialNumber || equipment.name || String(equipment.id);
    try {
      JsBarcode(barcodeCanvasRef.current, value, {
        format: 'CODE128', lineColor: '#000', width: 2, height: 60,
        displayValue: true, fontSize: 12, margin: 10,
      });
    } catch (err) { console.error(err); }
  }, []);

  // ── Carte des sites (Leaflet) ──────────────────────────────────────────────
  const [showMap, setShowMap] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{ remove: () => void } | null>(null);

  // ── Licences logicielles ───────────────────────────────────────────────────
  interface License {
    id: number; name: string; vendor: string; license_key: string;
    seats: number; used_seats: number; equipment_id: number | null;
    purchase_date: string | null; expiry_date: string | null; notes: string; created_at: string;
  }
  const [showLicenseModule, setShowLicenseModule] = useState(false);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);
  const defaultLicenseForm = { name: '', vendor: '', license_key: '', seats: 1, used_seats: 0, equipment_id: null as number | null, purchase_date: '', expiry_date: '', notes: '' };
  const [licenseForm, setLicenseForm] = useState(defaultLicenseForm);
  const [licenseFilter, setLicenseFilter] = useState('');

  const fetchLicenses = async () => {
    setLicensesLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/licenses`, { headers: authHeaders() });
      if (r.ok) setLicenses(await r.json());
    } finally { setLicensesLoading(false); }
  };

  const saveLicense = async () => {
    const method = editingLicenseId ? 'PUT' : 'POST';
    const url = editingLicenseId ? `${API_BASE_URL}/api/licenses/${editingLicenseId}` : `${API_BASE_URL}/api/licenses`;
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(licenseForm) });
    if (r.ok) {
      const saved = await r.json();
      if (editingLicenseId) setLicenses(prev => prev.map(l => l.id === saved.id ? saved : l));
      else setLicenses(prev => [saved, ...prev]);
      setShowLicenseForm(false); setEditingLicenseId(null); setLicenseForm(defaultLicenseForm);
    }
  };

  const deleteLicense = (id: number) => {
    setConfirmModal({ message: 'Supprimer cette licence ?', onConfirm: async () => {
      setConfirmModal(null);
      await fetch(`${API_BASE_URL}/api/licenses/${id}`, { method: 'DELETE', headers: authHeaders() });
      setLicenses(prev => prev.filter(l => l.id !== id));
    }});
  };

  // ── Tendances 12 mois ──────────────────────────────────────────────────────
  interface TrendPoint { label: string; month: number; year: number; pannes: number; tickets: number; mttr: number; }
  const [showTrends, setShowTrends] = useState(false);
  const [trendsData, setTrendsData] = useState<TrendPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const fetchTrends = async () => {
    setTrendsLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/reports/trends`, { headers: authHeaders() });
      if (r.ok) setTrendsData(await r.json());
    } finally { setTrendsLoading(false); }
  };

  // ── Sauvegarde ─────────────────────────────────────────────────────────────
  const downloadBackup = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/backup`, { headers: authHeaders() });
      if (!r.ok) { setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' }); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `backup-gestion-it-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setToast({ message: 'Sauvegarde téléchargée', type: 'success' });
    } catch { setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' }); }
  };

  // ── Fiche technique PDF ────────────────────────────────────────────────────
  const generateEquipmentSheet = async (e: Equipment) => {
    const { jsPDF, autoTable } = await ExportHelpers.createPdfDocument();
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(26, 111, 166);
    doc.text(`Fiche technique — ${e.name}`, 14, 20);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')} par ${currentUser.name}`, 14, 28);
    const deprec = getDepreciation(e);
    if (autoTable) {
      autoTable(doc, {
        startY: 35,
        head: [['Champ', 'Valeur']],
        body: [
          ['Nom', e.name],
          ['Type', e.type],
          ['Marque', e.brand],
          ['Modèle', e.model],
          ['Numéro de série', maskValue(e.serialNumber) || '—'],
          ['Adresse IP', maskValue(e.ipAddress) || '—'],
          ['Statut', e.status],
          ['Localisation', e.location],
          ['Département', e.department],
          ['Date d\'achat', e.purchaseDate || '—'],
          ['Fin de garantie', e.warranty || '—'],
          ['Dernière maintenance', e.lastMaintenance || '—'],
          ['Technicien', e.technicianName || '—'],
          ['Quantité', String(e.quantity)],
          ...(deprec ? [['Amortissement', `${deprec.pct}% (${deprec.age} ans) — état ${deprec.status}`]] : []),
        ],
        theme: 'striped',
        headStyles: { fillColor: [26, 111, 166] },
      });
    }
    if (e.interventionDetails) {
      const y = (doc as any).lastAutoTable?.finalY || 35;
      doc.setFontSize(11); doc.setTextColor(26, 111, 166); doc.text('Détails intervention', 14, y + 10);
      doc.setFontSize(10); doc.setTextColor(60);
      doc.text(doc.splitTextToSize(e.interventionDetails, 180), 14, y + 16);
    }
    doc.save(`fiche-${e.name.replace(/\s+/g, '-')}.pdf`);
  };

  // ── Template CSV ───────────────────────────────────────────────────────────
  const downloadCsvTemplate = () => {
    const a = document.createElement('a');
    a.href = `${API_BASE_URL}/api/equipments/csv-template`;
    a.download = 'template-import-equipements.csv';
    document.body.appendChild(a); a.click(); a.remove();
  };

  // ── Comparaison d'équipements ──────────────────────────────────────────────
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  const toggleCompare = (id: number) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 3) { next.add(id); }
      return next;
    });
  };

  // ── Scan QR caméra ─────────────────────────────────────────────────────────
  const [showQrScan, setShowQrScan] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  const startQrScan = async () => {
    setShowQrScan(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        qrVideoRef.current.play();
      }
    } catch { setToast({ message: 'Caméra non disponible', type: 'error' }); setShowQrScan(false); }
  };

  const stopQrScan = () => {
    qrStreamRef.current?.getTracks().forEach(t => t.stop());
    qrStreamRef.current = null;
    setShowQrScan(false);
  };

  // ── Kanban maintenance ─────────────────────────────────────────────────────
  const [showKanban, setShowKanban] = useState(false);

  // ── Calendrier visites ─────────────────────────────────────────────────────
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  // ── Calendrier unifié ──────────────────────────────────────────────────────
  const [showUnifiedCalendar, setShowUnifiedCalendar] = useState(false);
  const [unifiedCalYear, setUnifiedCalYear] = useState(new Date().getFullYear());
  const [unifiedCalMonth, setUnifiedCalMonth] = useState(new Date().getMonth());

  // ── Rapport mensuel ────────────────────────────────────────────────────────
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [emailReportTo, setEmailReportTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // ── Reports state ──────────────────────────────────────────────────────────
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportsTab, setReportsTab] = useState<'equipment' | 'date' | 'department' | 'user' | 'site' | 'maintenance' | 'visits'>('equipment');
  const [reportMaintenanceAll, setReportMaintenanceAll] = useState<MaintenanceRecord[]>([]);
  const [reportMaintenanceLoading, setReportMaintenanceLoading] = useState(false);
  const [reportVisitsAll, setReportVisitsAll] = useState<SiteVisit[]>([]);
  const [reportVisitsLoading, setReportVisitsLoading] = useState(false);
  const [reportEquipmentId, setReportEquipmentId] = useState<number | ''>('');
  const [reportHistory, setReportHistory] = useState<EquipmentEvent[]>([]);
  const [reportHistoryLoading, setReportHistoryLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportDeptFilter, setReportDeptFilter] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('');
  const [reportDateEvents, setReportDateEvents] = useState<EquipmentEvent[]>([]);
  const [reportDateLoading, setReportDateLoading] = useState(false);
  const [reportDeptStats, setReportDeptStats] = useState<DeptStat[]>([]);
  const [reportDeptLoading, setReportDeptLoading] = useState(false);
  const [reportUserStats, setReportUserStats] = useState<UserStat[]>([]);
  const [reportUserLoading, setReportUserLoading] = useState(false);
  const [reportUserFrom, setReportUserFrom] = useState('');
  const [reportUserTo, setReportUserTo] = useState('');
  const [reportUserDeptFilter, setReportUserDeptFilter] = useState('');
  const [reportUserExpanded, setReportUserExpanded] = useState<string | null>(null);
  const [reportUserDetail, setReportUserDetail] = useState<EquipmentEvent[]>([]);
  const [reportUserDetailLoading, setReportUserDetailLoading] = useState(false);
  const [reportSiteStats, setReportSiteStats] = useState<SiteStat[]>([]);
  const [reportSiteLoading, setReportSiteLoading] = useState(false);
  const [reportSiteFrom, setReportSiteFrom] = useState('');
  const [reportSiteTo, setReportSiteTo] = useState('');
  const [reportSiteTypeFilter, setReportSiteTypeFilter] = useState('');
  const [reportSiteExpanded, setReportSiteExpanded] = useState<number | null>(null);
  const [reportSiteDetail, setReportSiteDetail] = useState<EquipmentEvent[]>([]);
  const [reportSiteDetailLoading, setReportSiteDetailLoading] = useState(false);

  // Toast & Confirm dialog
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // ── Dark mode ──────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('it-dark-mode');
    if (stored) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [darkModeAuto, setDarkModeAuto] = useState(() => !localStorage.getItem('it-dark-mode'));

  const cycleDarkMode = useCallback(() => {
    if (darkModeAuto) {
      setDarkModeAuto(false);
      setDarkMode(true);
    } else if (darkMode) {
      setDarkMode(false);
    } else {
      setDarkModeAuto(true);
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(mq.matches);
    }
  }, [darkModeAuto, darkMode]);

  // ── Session timeout ────────────────────────────────────────────────────────
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(300);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionWarningRef = useRef(false);

  // Init Leaflet map when showMap becomes true
  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    import('leaflet').then(L => {
      const map = L.map(mapContainerRef.current!, { center: [8.0, 1.0], zoom: 5 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      // Fix default icon paths for Leaflet in Vite
      const icon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
      const bounds: [number, number][] = [];
      sites.forEach(s => {
        const lat = s.latitude; const lng = s.longitude;
        if (lat != null && lng != null) {
          const eqCount = equipments.filter(e => e.siteId === s.id).length;
          L.marker([lat, lng], { icon }).addTo(map)
            .bindPopup(`<b>${s.name}</b><br>${s.city}${s.country ? ', ' + s.country : ''}<br>${eqCount} équipement(s)`);
          bounds.push([lat, lng]);
        }
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
      mapInstanceRef.current = map;
    }).catch((err) => console.error('Leaflet load error:', err));
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [showMap]);

  // Render barcode when equipment changes
  useEffect(() => {
    if (barcodeEquipment) setTimeout(() => renderBarcode(barcodeEquipment), 50);
  }, [barcodeEquipment]);

  // Apply dark mode class on html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (!darkModeAuto) {
      localStorage.setItem('it-dark-mode', String(darkMode));
    } else {
      localStorage.removeItem('it-dark-mode');
    }
  }, [darkMode, darkModeAuto]);

  // Listen to system preference changes when in auto mode
  useEffect(() => {
    if (!darkModeAuto) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [darkModeAuto]);

  // Session timeout — 25 min warning, 30 min auto-logout
  useEffect(() => {
    const WARN_MS  = 25 * 60 * 1000;
    const LIMIT_MS = 30 * 60 * 1000;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (sessionWarningRef.current) {
        sessionWarningRef.current = false;
        setShowSessionWarning(false);
        setSessionCountdown(300);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= LIMIT_MS) {
        clearInterval(tick);
        onLogout();
        return;
      }
      if (idle >= WARN_MS && !sessionWarningRef.current) {
        sessionWarningRef.current = true;
        setShowSessionWarning(true);
        setSessionCountdown(Math.round((LIMIT_MS - idle) / 1000));
      }
      if (sessionWarningRef.current) {
        setSessionCountdown(Math.max(0, Math.round((LIMIT_MS - idle) / 1000)));
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      events.forEach(e => window.removeEventListener(e, resetActivity));
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (modulesMenuRef.current && !modulesMenuRef.current.contains(e.target as Node)) {
        setShowModulesMenu(false);
      }
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) {
        setShowSiteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-dismiss toast after 4 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ─── Reports helpers ──────────────────────────────────────────────────────

  const fetchReportHistory = async (equipmentId: number) => {
    setReportHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/equipment/${equipmentId}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportHistory(await res.json());
    } catch (err) { console.error(err); }
    setReportHistoryLoading(false);
  };

  const fetchReportByDate = async () => {
    setReportDateLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.set('from', reportDateFrom);
      if (reportDateTo) params.set('to', reportDateTo);
      if (reportDeptFilter) params.set('department', reportDeptFilter);
      if (reportTypeFilter) params.set('type', reportTypeFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-date?${params}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportDateEvents(await res.json());
    } catch (err) { console.error(err); }
    setReportDateLoading(false);
  };

  // ─── Chat functions ────────────────────────────────────────────────────────

  const chatConvKey = (conv: 'global' | number, groupId?: number) =>
    groupId != null ? `group:${groupId}` :
    conv === 'global' ? 'global' :
    `dm:${Math.min(currentUser.id, conv as number)}:${Math.max(currentUser.id, conv as number)}`;

  const fetchChatUsers = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/chat/users`, { headers: authHeaders() });
      if (r.ok) setChatUsers(await r.json());
    } catch (err) { console.error(err); }
  };

  const fetchChatGroups = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/chat/groups`, { headers: authHeaders() });
      if (r.ok) setChatGroups(await r.json());
    } catch (err) { console.error(err); }
  };

  const fetchChatMessages = async (conv: 'global' | number, sinceId?: number, groupId?: number) => {
    if (!sinceId) setChatLoading(true);
    try {
      const params = new URLSearchParams();
      if (groupId != null) {
        params.set('channel', 'group');
        params.set('groupId', String(groupId));
      } else if (conv === 'global') {
        params.set('channel', 'global');
      } else {
        params.set('channel', 'dm');
        params.set('withUser', String(conv));
      }
      if (sinceId) params.set('sinceId', String(sinceId));
      const r = await fetch(`${API_BASE_URL}/api/chat/messages?${params}`, { headers: authHeaders() });
      if (!r.ok) return;
      const msgs: ChatMessage[] = await r.json();
      if (sinceId) {
        setChatMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...msgs.filter(m => !ids.has(m.id))];
        });
      } else {
        setChatMessages(msgs);
      }
    } catch (err) { console.error(err); }
    if (!sinceId) setChatLoading(false);
  };

  const fetchChatUnread = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/chat/unread`, { headers: authHeaders() });
      if (r.ok) setChatUnread(await r.json());
    } catch (err) { console.error(err); }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatSending) return;
    setChatSending(true);
    try {
      const body: Record<string, unknown> = { content: chatInput.trim() };
      if (chatActiveGroup != null) {
        body.groupId = chatActiveGroup;
      } else if (chatConversation !== 'global') {
        body.recipientId = chatConversation;
      }
      const r = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      if (r.ok) {
        const msg: ChatMessage = await r.json();
        setChatMessages(prev => [...prev, msg]);
        setChatInput('');
        markChatAsRead(chatConversation, msg.id, chatActiveGroup ?? undefined);
      }
    } catch (err) { console.error(err); }
    setChatSending(false);
  };

  const markChatAsRead = async (conv: 'global' | number, lastReadId: number, groupId?: number) => {
    if (!lastReadId) return;
    const convKey = chatConvKey(conv, groupId);
    try {
      await fetch(`${API_BASE_URL}/api/chat/read`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ conversationKey: convKey, lastReadId }),
      });
      setChatUnread(prev => {
        if (groupId != null) {
          const groups = { ...prev.groups }; delete groups[groupId]; return { ...prev, groups };
        }
        if (conv === 'global') return { ...prev, global: 0 };
        const dms = { ...prev.dms }; delete dms[conv as number]; return { ...prev, dms };
      });
    } catch (err) { console.error(err); }
  };

  const openChatConversation = (conv: 'global' | number) => {
    setChatActiveGroup(null);
    setChatConversation(conv);
    setChatMessages([]);
    fetchChatMessages(conv);
  };

  const openGroupConversation = (groupId: number) => {
    setChatActiveGroup(groupId);
    setChatMessages([]);
    fetchChatMessages('global', undefined, groupId);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || newGroupMembers.length === 0 || groupCreating) return;
    setGroupCreating(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/chat/groups`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name: newGroupName.trim(), memberIds: newGroupMembers }),
      });
      if (r.ok) {
        const group: ChatGroup = await r.json();
        setChatGroups(prev => [group, ...prev]);
        setShowCreateGroup(false);
        setNewGroupName('');
        setNewGroupMembers([]);
        openGroupConversation(group.id);
      }
    } catch (err) { console.error(err); }
    setGroupCreating(false);
  };

  // ─── Reports ───────────────────────────────────────────────────────────────

  const fetchReportByDepartment = async () => {
    setReportDeptLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/by-department`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportDeptStats(await res.json());
    } catch (err) { console.error(err); }
    setReportDeptLoading(false);
  };

  const fetchReportByUser = async (opts?: { from?: string; to?: string; department?: string }) => {
    setReportUserLoading(true);
    setReportUserExpanded(null);
    try {
      const params = new URLSearchParams();
      const from = opts?.from ?? reportUserFrom;
      const to   = opts?.to   ?? reportUserTo;
      const dept = opts?.department ?? reportUserDeptFilter;
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      if (dept) params.set('department', dept);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-user?${params}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportUserStats(await res.json());
    } catch (err) { console.error(err); }
    setReportUserLoading(false);
  };

  const fetchUserDetail = async (username: string) => {
    if (reportUserExpanded === username) { setReportUserExpanded(null); return; }
    setReportUserExpanded(username);
    setReportUserDetailLoading(true);
    try {
      const params = new URLSearchParams({ username });
      if (reportUserFrom) params.set('from', reportUserFrom);
      if (reportUserTo)   params.set('to', reportUserTo);
      if (reportUserDeptFilter) params.set('department', reportUserDeptFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/user-detail?${params}`, { headers: authHeaders() });
      if (res.ok) setReportUserDetail(await res.json());
    } catch (err) { console.error(err); }
    setReportUserDetailLoading(false);
  };

  const fetchReportBySite = async (opts?: { from?: string; to?: string; type?: string }) => {
    setReportSiteLoading(true);
    try {
      const params = new URLSearchParams();
      const from = opts?.from ?? reportSiteFrom;
      const to   = opts?.to   ?? reportSiteTo;
      const type = opts?.type ?? reportSiteTypeFilter;
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      if (type) params.set('type', type);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-site?${params}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportSiteStats(await res.json());
    } catch (err) { console.error(err); }
    setReportSiteLoading(false);
  };

  const fetchSiteDetail = async (siteId: number) => {
    if (reportSiteExpanded === siteId) { setReportSiteExpanded(null); return; }
    setReportSiteExpanded(siteId);
    setReportSiteDetailLoading(true);
    try {
      const params = new URLSearchParams({ siteId: String(siteId) });
      if (reportSiteFrom) params.set('from', reportSiteFrom);
      if (reportSiteTo)   params.set('to', reportSiteTo);
      if (reportSiteTypeFilter) params.set('type', reportSiteTypeFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/site-detail?${params}`, { headers: authHeaders() });
      if (res.ok) setReportSiteDetail(await res.json());
    } catch (err) { console.error(err); }
    setReportSiteDetailLoading(false);
  };

  const fetchReportMaintenance = async () => {
    setReportMaintenanceLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/maintenance?limit=500`, { headers: authHeaders() });
      if (r.ok) setReportMaintenanceAll(await r.json());
    } catch (err) { console.error(err); }
    setReportMaintenanceLoading(false);
  };

  const fetchReportVisits = async () => {
    setReportVisitsLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/visits`, { headers: authHeaders() });
      if (r.ok) setReportVisitsAll(await r.json());
    } catch (err) { console.error(err); }
    setReportVisitsLoading(false);
  };

  const getEventActionStyle = (action: string) => {
    if (action === 'Création')    return { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' };
    if (action === 'Intervention')return { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' };
    if (action === 'Modification') return { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' };
    if (action === 'Suppression')  return { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' };
    return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
  };

  const FIELD_LABELS: Record<string, string> = {
    name: 'Nom', type: 'Type', brand: 'Marque', model: 'Modèle',
    serialNumber: 'N° Série', ipAddress: 'Adresse IP', location: 'Emplacement',
    department: 'Département', status: 'Statut', purchaseDate: 'Date achat',
    warranty: 'Garantie', lastMaintenance: 'Dernière maintenance',
    visited: 'Visité', technicianName: 'Technicien',
    visitDate: 'Date visite', interventionDetails: 'Détails intervention',
  };

  const exportReportPdf = async (title: string, events: EquipmentEvent[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Date', 'Équipement', 'Type', 'Département', 'Action', 'Détails', 'Technicien', 'Utilisateur']],
      body: events.map(ev => [
        new Date(ev.createdAt).toLocaleString('fr-FR'),
        ev.equipmentName, ev.equipmentType, ev.department,
        ev.action, ev.details, ev.technician, ev.userName,
      ]),
      filename: `rapport-${Date.now()}.pdf`,
      title,
      orientation: 'landscape',
    });
  };

  const exportReportExcel = async (sheetName: string, events: EquipmentEvent[]) => {
    const rows = events.map(ev => ({
      'Date': new Date(ev.createdAt).toLocaleString('fr-FR'),
      'Équipement': ev.equipmentName,
      'Type': ev.equipmentType,
      'Département': ev.department,
      'Action': ev.action,
      'Détails': ev.details,
      'Technicien': ev.technician,
      'Utilisateur': ev.userName,
      'IP': ev.ip,
    }));
    await ExportHelpers.exportJsonToXlsx(rows, `rapport-${Date.now()}.xlsx`, sheetName);
  };

  const exportDeptPdf = async (stats: DeptStat[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Service', 'Équipements', 'Total événements', 'Créations', 'Modifications', 'Interventions', 'Suppressions', 'Dernière activité']],
      body: stats.map(d => [
        d.department, d.equipment_count, d.total_events, d.creations,
        d.modifications, d.interventions, d.suppressions,
        d.last_activity ? new Date(d.last_activity).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-services-${Date.now()}.pdf`,
      title: 'Rapport par service',
      orientation: 'landscape'
    });
  };

  const exportUserPdf = async (stats: UserStat[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Utilisateur', 'Login', 'Total', 'Créations', 'Modifications', 'Transferts', 'Suppressions', 'Maintenances', 'Réformes', 'Équip.', 'Services', 'Dernière action']],
      body: stats.map(u => [
        u.user_name, u.username, u.total_actions, u.creations, u.modifications,
        u.transferts, u.suppressions, u.maintenances, u.reformes,
        u.equipment_count, u.dept_count,
        u.last_action ? new Date(u.last_action).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-utilisateurs-${Date.now()}.pdf`,
      title: 'Rapport par utilisateur',
      orientation: 'landscape'
    });
  }

  const exportSitePdf = async (stats: any[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Site', 'Ville', 'Pays', 'Équipements', 'Total événements', 'Créations', 'Modifications', 'Transferts', 'Interventions', 'Réformes', 'Suppressions', 'Dernière activité']],
      body: stats.map(s => [
        s.site_name, s.city || '—', s.country || '—',
        s.equipment_count, s.total_events, s.creations, s.modifications,
        s.transferts, s.interventions, s.reformes, s.suppressions,
        s.last_activity ? new Date(s.last_activity).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-sites-${Date.now()}.pdf`,
      title: 'Rapport par site',
      orientation: 'landscape',
      tableOptions: { styles: { fontSize: 6, cellPadding: 2 }, alternateRowStyles: { fillColor: [245, 247, 250] } },
    });
  };

  const downloadUserReport = async (username: string, userName: string) => {
    try {
      const params = new URLSearchParams({ username });
      if (reportUserFrom) params.set('from', reportUserFrom);
      if (reportUserTo) params.set('to', reportUserTo);
      if (reportUserDeptFilter) params.set('department', reportUserDeptFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/user-detail?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const events: EquipmentEvent[] = await res.json();
      const rows = events.map(ev => ({
        'Date': new Date(ev.createdAt).toLocaleString('fr-FR'),
        'Équipement': ev.equipmentName,
        'Type': ev.equipmentType,
        'Département': ev.department,
        'Action': ev.action,
        'Détails': ev.details,
        'Technicien': ev.technician,
        'Utilisateur': ev.userName,
      }));
      await ExportHelpers.exportJsonToXlsx(rows, `rapport-${username}-${Date.now()}.xlsx`, userName);
    } catch (err) { console.error(err); }
  };

  // ─── Monitoring helpers ────────────────────────────────────────────────────

  const formatDuration = (startIso: string) => {
    const diffMs = Date.now() - new Date(startIso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Moins d'1 min";
    if (diffMins < 60) return `${diffMins} min`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}min`;
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

  const isOnline = (lastSeen: string) =>
    Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;

  const getActionStyle = (action: string): string => {
    if (action === 'Connexion') return 'bg-green-100 text-green-700';
    if (action === 'Déconnexion') return 'bg-gray-100 text-gray-600';
    if (action.startsWith('Ajout') || action.startsWith('Création')) return 'bg-blue-100 text-blue-700';
    if (action.startsWith('Modification')) return 'bg-yellow-100 text-yellow-700';
    if (action.startsWith('Suppression')) return 'bg-red-100 text-red-700';
    if (action === 'Export CSV') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/sessions`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setActiveSessions(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchActivities = async (userId?: number | null) => {
    try {
      const qs = userId != null ? `?userId=${userId}&limit=200` : '?limit=200';
      const res = await fetch(`${API_BASE_URL}/api/admin/activities${qs}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setActivityLogs(await res.json());
    } catch (err) { console.error(err); }
  };

  const refreshMonitoring = async () => {
    setMonitoringLoading(true);
    await Promise.all([fetchSessions(), fetchActivities(activityUserFilterRef.current)]);
    setMonitoringLoading(false);
    setMonitoringLastRefresh(new Date());
  };

  const handleUnauthorized = () => {
    setToast({ message: 'Session expirée ou non autorisée. Veuillez vous reconnecter.', type: 'error' });
    onLogout();
  };

  const fetchEquipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Vous n\'êtes pas autorisé à voir ces équipements.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur réseau');
      }
      const data = await response.json();
      setEquipments(data);
    } catch (err) {
      setError('Impossible de charger les équipements depuis le backend. Affichage des données locales.');
      setEquipments(sampleEquipments);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(API_USERS, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Vous n\'êtes pas autorisé à voir les utilisateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur réseau');
      }
      const data = await response.json();
      setUserAccounts(data);
    } catch {
      setError('Impossible de charger les utilisateurs.');
    }
  };

  const openAccessModal = (user: UserAccount) => {
    setAccessTarget(user);
    setAccessForm({ role: user.role, permissions: (user.permissions ?? []) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [] });
    setAccessError(null);
    setShowAccessModal(true);
  };

  const handleSaveAccess = async () => {
    if (!accessTarget) return;
    setAccessLoading(true);
    setAccessError(null);
    try {
      const payload = {
        username: accessTarget.username,
        name: accessTarget.name,
        role: accessForm.role,
        permissions: accessForm.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : accessForm.permissions,
        allowedSiteIds: accessForm.role === 'admin' ? [] : accessForm.allowedSiteIds,
      };
      const r = await fetch(`${API_USERS}/${accessTarget.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
      if (r.status === 401) { handleUnauthorized(); return; }
      if (!r.ok) { const d = await r.json().catch(() => null); setAccessError(d?.message || 'Erreur lors de la sauvegarde.'); return; }
      setShowAccessModal(false);
      await fetchUsers();
    } catch { setAccessError('Impossible de sauvegarder.'); }
    setAccessLoading(false);
  };

  const openUserCreate = () => {
    setUserEditingId(null);
    setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
    setUserFormError(null);
    setShowUserFormModal(true);
  };

  const openUserEdit = (user: UserAccount) => {
    setUserEditingId(user.id);
    setUserFormData({ username: user.username, name: user.name, role: user.role, password: '', permissions: (user.permissions ?? []) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [] });
    setUserFormError(null);
    setShowUserFormModal(true);
  };

  const handleUserSubmit = async () => {
    if (!userFormData.username.trim() || !userFormData.name.trim()) {
      setUserFormError('Le nom d\'utilisateur et le nom complet sont obligatoires.');
      return;
    }

    if (!userEditingId && !userFormData.password.trim()) {
      setUserFormError('Le mot de passe est requis pour un nouvel utilisateur.');
      return;
    }

    const payload = {
      username: userFormData.username.trim(),
      name: userFormData.name.trim(),
      role: userFormData.role,
      password: userFormData.password.trim() || undefined,
      permissions: userFormData.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : userFormData.permissions,
      allowedSiteIds: userFormData.role === 'admin' ? [] : userFormData.allowedSiteIds
    };

    try {
      const url = userEditingId ? `${API_USERS}/${userEditingId}` : API_USERS;
      const method = userEditingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setUserFormError('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setUserFormError(data?.message || 'Impossible de sauvegarder l\'utilisateur.');
        return;
      }

      setShowUserFormModal(false);
      setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
      await fetchUsers();
    } catch {
      setUserFormError('Impossible de sauvegarder l\'utilisateur.');
    }
  };

  const handleDeleteUser = (id: number) => {
    setConfirmModal({
      message: 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const response = await fetch(`${API_USERS}/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (response.status === 401) { handleUnauthorized(); return; }
          if (response.status === 403) { setError('Action réservée aux administrateurs.'); return; }
          if (!response.ok) throw new Error('Erreur de suppression');
          await fetchUsers();
        } catch {
          setError('Impossible de supprimer l\'utilisateur.');
        }
      }
    });
  };

  const handleToggleBlock = async (user: UserAccount) => {
    const newBlocked = !user.blocked;
    const label = newBlocked ? 'bloquer' : 'débloquer';
    setConfirmModal({
      message: `Êtes-vous sûr de vouloir ${label} le compte de "${user.name}" ?`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`${API_USERS}/${user.id}/block`, {
            method: 'PATCH',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocked: newBlocked }),
          });
          if (res.status === 401) { handleUnauthorized(); return; }
          if (!res.ok) throw new Error();
          await fetchUsers();
        } catch {
          setError(`Impossible de ${label} le compte.`);
        }
      }
    });
  };

  useEffect(() => {
    // Chargement initial de toutes les données du dashboard
    fetchEquipments();
    fetchUsers();
    fetchSites();
    fetchMaintenance('all');
    fetchVisits({ siteId: '', status: '', from: '', to: '' });
  }, []);

  // Auto-select user's allowed sites for non-admin
  useEffect(() => {
    if (!isAdmin && userAllowedSiteIds.length > 0 && sites.length > 0) {
      setSelectedSiteIds(userAllowedSiteIds);
    }
  }, [sites, userAllowedSiteIds.length, isAdmin]);

  // Reset pages when filters change
  useEffect(() => { setEquipPage(1); }, [searchTerm, filterType, filterStatus]);
  useEffect(() => { setMaintenancePage(1); }, [maintenanceFilter]);
  useEffect(() => { setActivityPage(1); }, [activityUserFilter]);

  // Load monitoring data when modal opens
  useEffect(() => {
    if (!showMonitoringModal || !isAdmin) return;
    refreshMonitoring();
  }, [showMonitoringModal]);

  // Auto-fetch activity log when filters change (debounced 400ms)
  useEffect(() => {
    if (!showActivityLog) return;
    const timer = setTimeout(() => fetchActivityLog(activityFilter), 400);
    return () => clearTimeout(timer);
  }, [activityFilter, showActivityLog]);

  // Auto-fetch transfers when filters change (debounced 400ms)
  useEffect(() => {
    if (!showTransferModule) return;
    const timer = setTimeout(() => fetchAllTransfers(transferModuleFilter), 400);
    return () => clearTimeout(timer);
  }, [transferModuleFilter, showTransferModule]);

  // Auto-fetch report by date when filters change (debounced 500ms)
  useEffect(() => {
    if (!showReportsModal || reportsTab !== 'date') return;
    const timer = setTimeout(() => fetchReportByDate(), 500);
    return () => clearTimeout(timer);
  }, [reportDateFrom, reportDateTo, reportDeptFilter, reportTypeFilter, showReportsModal, reportsTab]);

  // Auto-fetch report by user when filters change (debounced 500ms)
  useEffect(() => {
    if (!showReportsModal || reportsTab !== 'user') return;
    const timer = setTimeout(() => fetchReportByUser(), 500);
    return () => clearTimeout(timer);
  }, [reportUserFrom, reportUserTo, reportUserDeptFilter, showReportsModal, reportsTab]);

  // Auto-fetch report by site when filters change (debounced 500ms)
  useEffect(() => {
    if (!showReportsModal || reportsTab !== 'site') return;
    const timer = setTimeout(() => fetchReportBySite(), 500);
    return () => clearTimeout(timer);
  }, [reportSiteFrom, reportSiteTo, reportSiteTypeFilter, showReportsModal, reportsTab]);

  // Auto-refresh dashboard data every 30 s — équipements, maintenance, visites
  useEffect(() => {
    const id = setInterval(() => {
      fetchEquipments();
      fetchMaintenance('all');
      fetchVisits({ siteId: '', status: '', from: '', to: '' });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Chat: load users and groups once on mount
  useEffect(() => { fetchChatUsers(); fetchChatGroups(); }, []);

  // Chat: poll unread every 15 seconds
  useEffect(() => {
    fetchChatUnread();
    const id = setInterval(fetchChatUnread, 15000);
    return () => clearInterval(id);
  }, []);

  // Heartbeat: signal presence every 60 seconds
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch(`${API_BASE_URL}/api/heartbeat`, { method: 'POST', headers: authHeaders() }).catch(() => {});
    };
    sendHeartbeat();
    const id = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(id);
  }, []);

  // Browser notifications — request permission once, then alert on critical events
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const sendBrowserNotif = (title: string, body: string, tag: string) => {
    if (Notification.permission !== 'granted') return;
    if (notifiedRef.current.has(tag)) return;
    notifiedRef.current.add(tag);
    try {
      new Notification(title, { body, icon: '/icon-192.svg', tag });
    } catch (err) { console.error(err); }
  };

  // Check and fire notifications every 60 s
  useEffect(() => {
    const check = () => {
      // Critical maintenance tickets
      maintenanceRecords
        .filter(m => m.priority === 'critique' && m.status !== 'résolu')
        .forEach(m => sendBrowserNotif(
          '🔴 Ticket critique',
          `${m.failureDesc || m.equipmentName} — ${m.technician || 'Non assigné'}`,
          `maint-crit-${m.id}`
        ));

      // Expired warranties
      equipments
        .filter(e => getWarrantyInfo(e.warranty)?.status === 'expired')
        .forEach(e => sendBrowserNotif(
          '⚠️ Garantie expirée',
          `${e.name} (${e.brand} ${e.model}) — garantie échue`,
          `warranty-exp-${e.id}`
        ));

      // Visits today
      const today = new Date().toISOString().slice(0, 10);
      visits
        .filter(v => v.scheduledDate === today && v.status === 'planifié')
        .forEach(v => sendBrowserNotif(
          '📅 Visite planifiée aujourd\'hui',
          `${v.siteName} — ${v.scheduledTime || ''} · ${v.technician}`,
          `visit-today-${v.id}`
        ));

      // Low stock accessories
      equipments
        .filter(e => e.type === 'accessoires' && (e.minQuantity ?? 0) > 0 && e.quantity <= (e.minQuantity ?? 0))
        .forEach(e => sendBrowserNotif(
          '📦 Stock bas',
          `${e.name} : ${e.quantity} restant(s) (seuil : ${e.minQuantity})`,
          `stock-low-${e.id}`
        ));
    };
    const id = setInterval(check, 60000);
    check();
    return () => clearInterval(id);
  }, [maintenanceRecords, equipments, visits]);

  // Monitoring: auto-refresh every 30s when module is open
  useEffect(() => {
    if (!showMonitoringModal) return;
    const id = setInterval(() => refreshMonitoring(), 30000);
    return () => clearInterval(id);
  }, [showMonitoringModal]);

  // Chat: scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Chat: poll new messages every 4 seconds when modal open
  useEffect(() => {
    if (!showChatModal) return;
    const poll = () => {
      const lastId = chatMessages[chatMessages.length - 1]?.id;
      if (chatActiveGroup != null) fetchChatMessages('global', lastId, chatActiveGroup);
      else fetchChatMessages(chatConversation, lastId);
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [showChatModal, chatConversation, chatActiveGroup, chatMessages]);

  // Chat: mark as read when messages loaded
  useEffect(() => {
    if (!showChatModal || chatMessages.length === 0) return;
    const lastId = chatMessages[chatMessages.length - 1]?.id;
    if (lastId) markChatAsRead(chatConversation, lastId, chatActiveGroup ?? undefined);
  }, [showChatModal, chatConversation, chatActiveGroup, chatMessages.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'Escape') {
        setShowForm(false);
        setShowDetailsModal(false);
        setShowGlobalSearch(false);
        setShowMaintenanceForm(false);
        setShowVisitForm(false);
        setShowChatModal(false);
        return;
      }

      // Ignore shortcuts when typing in inputs
      if (inInput) return;

      // Ctrl+K or / → Global search
      if ((event.ctrlKey && event.key === 'k') || event.key === '/') {
        event.preventDefault();
        setShowGlobalSearch(true);
        setGlobalSearchQuery('');
        setTimeout(() => globalSearchRef.current?.focus(), 50);
        return;
      }

      // D → cycle dark mode: auto → dark → light → auto
      if (event.key === 'd' || event.key === 'D') {
        cycleDarkMode();
        return;
      }

      // N → New equipment
      if ((event.key === 'n' || event.key === 'N') && canWrite) {
        closeAllModules();
        openNewEquipmentForm();
        return;
      }

      // R → Refresh
      if (event.key === 'r' || event.key === 'R') {
        handleRefresh?.();
        return;
      }

      // M → Maintenance
      if ((event.key === 'm' || event.key === 'M') && canWrite) {
        openMaintenanceModule();
        return;
      }

      // V → Visites
      if ((event.key === 'v' || event.key === 'V') && canWrite) {
        closeAllModules();
        setShowVisitModule(true);
        fetchVisits();
        return;
      }

      // G → Garanties
      if ((event.key === 'g' || event.key === 'G') && canWrite) {
        openWarrantyModule();
        return;
      }

      // E → Équipements (retour accueil)
      if (event.key === 'e' || event.key === 'E') {
        closeAllModules();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canWrite, chatConversation, chatActiveGroup]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  const openNewEquipmentForm = () => {
    resetForm();
    if (selectedSiteIds.length === 1) setFormData(prev => ({ ...prev, siteId: selectedSiteIds[0] }));
    setShowForm(true);
  };

  const handleSaveEquipment = async (equipment: EquipmentFormData) => {
    try {
      if (editingId !== null) {
        const response = await fetch(`${API_BASE}/${editingId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(equipment)
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error('Erreur de mise à jour');
        }
        const updated = await response.json();
        setEquipments((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const response = await fetch(API_BASE, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(equipment)
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error('Erreur de création');
        }
        const created = await response.json();
        setEquipments((prev) => [...prev, created]);
      }
    } catch (err) {
      setToast({ message: 'Impossible de sauvegarder l\'équipement. Vérifiez vos autorisations et que le backend est démarré.', type: 'error' });
    }
  };

  const handleSubmit = async () => {
    const requiredFields = ['name', 'brand', 'location', 'department'];
    const missingField = requiredFields.find((field) => !formData[field as keyof EquipmentFormData]?.toString().trim());

    if (missingField) {
      setToast({ message: 'Veuillez remplir tous les champs obligatoires.', type: 'error' });
      return;
    }

    if (!formData.siteId) {
      setToast({ message: 'Veuillez sélectionner un site.', type: 'error' });
      return;
    }

    await handleSaveEquipment(formData);

    // Upload documents for new equipment
    if (editingId === null && newEquipDocs.length > 0) {
      const latestEquip = equipments[equipments.length - 1];
      if (latestEquip) {
        setUploadingDocs(true);
        for (const { file, description } of newEquipDocs) {
          await handleDocumentUpload(latestEquip.id, file, description);
        }
        setUploadingDocs(false);
      }
      setNewEquipDocs([]);
    }

    setShowForm(false);
    resetForm();
  };

  const handleEdit = (equipment: Equipment) => {
    setFormData({ ...equipment });
    setEditingId(equipment.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setConfirmModal({
      message: 'Êtes-vous sûr de vouloir supprimer cet équipement ?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (response.status === 401) { handleUnauthorized(); return; }
          if (response.status === 403) { setToast({ message: 'Action réservée aux administrateurs.', type: 'error' }); return; }
          if (!response.ok) throw new Error('Erreur de suppression');
          setEquipments((prev) => prev.filter((item) => item.id !== id));
          if (selectedEquipment?.id === id) { setShowDetailsModal(false); setSelectedEquipment(null); }
        } catch {
          setToast({ message: 'Impossible de supprimer l\'équipement. Vérifiez vos autorisations et que le backend est démarré.', type: 'error' });
        }
      }
    });
  };

  const handleRefresh = async () => {
    await fetchEquipments();
  };

  const handleExportCsv = async () => {
    try {
      const response = await fetch(EXPORT_URL, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error('Export impossible');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'equipements.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast({ message: 'Impossible d\'exporter les équipements.', type: 'error' });
    }
    setShowExportMenu(false);
  };

  const EXPORT_COLUMNS = [
    { key: 'id',                  label: 'ID' },
    { key: 'name',                label: 'Nom' },
    { key: 'type',                label: 'Type' },
    { key: 'brand',               label: 'Marque' },
    { key: 'model',               label: 'Modèle' },
    { key: 'serialNumber',        label: 'N° Série' },
    { key: 'ipAddress',           label: 'Adresse IP' },
    { key: 'location',            label: 'Emplacement' },
    { key: 'department',          label: 'Département' },
    { key: 'status',              label: 'Statut' },
    { key: 'purchaseDate',        label: 'Date achat' },
    { key: 'warranty',            label: 'Garantie' },
    { key: 'lastMaintenance',     label: 'Dernière maintenance' },
    { key: 'visited',             label: 'Visité' },
    { key: 'technicianName',      label: 'Technicien' },
    { key: 'visitDate',           label: 'Date visite' },
    { key: 'interventionDetails', label: 'Détails intervention' },
  ] as const;

  const handleExportExcel = async () => {
    const rows = filteredEquipments.map((e) => {
      const row = Object.fromEntries(
        EXPORT_COLUMNS.map(({ key, label }) => [label, key === 'visited' ? (e[key] ? 'Oui' : 'Non') : (e[key as keyof Equipment] ?? '')])
      );
      row['Site'] = e.siteId ? (sites.find(s => s.id === e.siteId)?.name ?? '') : '';
      return row;
    });
    await ExportHelpers.exportJsonToXlsx(rows, 'equipements.xlsx', 'Équipements');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Liste des équipements IT', 14, 14);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${filteredEquipments.length} équipement(s)`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['Nom', 'Type', 'Marque / Modèle', 'N° Série', 'IP', 'Emplacement', 'Site', 'Département', 'Statut', 'Garantie', 'Visité']],
      body: filteredEquipments.map((e) => [
        e.name,
        e.type,
        `${e.brand} ${e.model}`.trim(),
        e.serialNumber,
        e.ipAddress,
        e.location,
        e.siteId ? (sites.find(s => s.id === e.siteId)?.name ?? '') : '',
        e.department,
        e.status,
        e.warranty,
        e.visited ? 'Oui' : 'Non',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save('equipements.pdf');
    setShowExportMenu(false);
  };

  const handleExportWarrantyExcel = async () => {
    const rows = warrantyVisibleEquipments.map((e) => ({
      ID: e.id,
      Nom: e.name,
      Type: e.type,
      Marque: e.brand,
      Modèle: e.model,
      'N° Série': e.serialNumber,
      Site: e.siteId ? (sites.find((s) => s.id === e.siteId)?.name ?? '') : 'Sans site',
      Département: e.department,
      Emplacement: e.location,
      Garantie: e.warranty,
      Statut: warrantyRiskLabels[e.warrantyStatus] ?? e.warrantyStatus,
      'État garantie': e.warrantyLabel,
      'Délai restant': e.warrantyDays != null ? `${e.warrantyDays} j` : 'N/A',
      'Dernière maintenance': e.lastMaintenance,
    }));
    await ExportHelpers.exportJsonToXlsx(rows, 'garanties.xlsx', 'Garanties');
  };

  const handleExportWarrantyPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Rapport Garanties - Équipements', 14, 14);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${warrantyVisibleEquipments.length} équipement(s)`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [[
        'Nom', 'Type', 'Marque / Modèle', 'N° Série', 'Site', 'Département', 'Statut garantie', 'État', 'Délai restant', 'Dernière maintenance'
      ]],
      body: warrantyVisibleEquipments.map((e) => [
        e.name,
        e.type,
        `${e.brand} ${e.model}`.trim(),
        e.serialNumber,
        e.siteId ? (sites.find((s) => s.id === e.siteId)?.name ?? '') : 'Sans site',
        e.department,
        e.warranty,
        e.warrantyLabel,
        e.warrantyDays != null ? `${e.warrantyDays} j` : 'N/A',
        e.lastMaintenance || '—',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 18 }, 2: { cellWidth: 30 }, 3: { cellWidth: 22 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 }, 6: { cellWidth: 30 }, 7: { cellWidth: 22 }, 8: { cellWidth: 20 }, 9: { cellWidth: 24 } },
    });
    doc.save('garanties.pdf');
  };

  // ─── Transfer ───────────────────────────────────────────────────────────────

  const openTransferModal = (equipment: Equipment) => {
    setTransferTarget(equipment);
    setTransferForm({ toLocation: equipment.location, toDepartment: equipment.department, toSiteId: equipment.siteId ?? null, reason: 'Réorganisation', technicianName: '', transferRequester: '', transferResponsible: '', notes: '', transferQty: equipment.quantity ?? 1 });
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    if (!transferForm.toLocation.trim() || !transferForm.toDepartment.trim()) {
      setToast({ message: 'Localisation et département requis.', type: 'error' });
      return;
    }
    if (!transferForm.toSiteId) {
      setToast({ message: 'Veuillez sélectionner un site de destination.', type: 'error' });
      return;
    }
    setTransferLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${transferTarget.id}/transfer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(transferForm),
      });
      if (response.status === 401) { handleUnauthorized(); return; }
      if (!response.ok) throw new Error('Erreur transfert');
      const updated = await response.json();
      // Refresh full list so partial transfer destination equipment appears
      await fetchEquipments();
      if (selectedEquipment?.id === updated.id) setSelectedEquipment(updated);
      setShowTransferModal(false);
    } catch {
      setToast({ message: 'Impossible d\'effectuer le transfert.', type: 'error' });
    } finally {
      setTransferLoading(false);
    }
  };

  // ─── Documents ──────────────────────────────────────────────────────────────

  const fetchDocuments = async (equipmentId: number) => {
    setDocsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${equipmentId}/documents`, { headers: authHeaders() });
      if (r.ok) setEquipmentDocs(await r.json());
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchTransferHistory = async (equipmentId: number) => {
    setTransfersLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/reports/equipment/${equipmentId}`, { headers: authHeaders() });
      if (r.ok) {
        const all = await r.json();
        setTransferHistory(all.filter((ev: any) => ev.action === 'Transfert'));
      }
    } finally {
      setTransfersLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/sites`, { headers: authHeaders() });
      if (r.ok) setSites(await r.json());
    } catch (err) { console.error(err); }
  };

  const handleSaveSite = async () => {
    if (!siteForm.name.trim()) { setToast({ message: 'Le nom du site est requis.', type: 'error' }); return; }
    setSiteLoading(true);
    try {
      const url = editingSiteId ? `${API_BASE_URL}/api/sites/${editingSiteId}` : `${API_BASE_URL}/api/sites`;
      const r = await fetch(url, {
        method: editingSiteId ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm),
      });
      if (!r.ok) { const d = await r.json(); setToast({ message: d.message || 'Erreur', type: 'error' }); return; }
      await fetchSites();
      setEditingSiteId(null);
      setSiteForm(defaultSiteForm);
    } catch { setToast({ message: 'Erreur réseau.', type: 'error' }); }
    setSiteLoading(false);
  };

  const handleDeleteSite = (id: number) => {
    setConfirmModal({
      message: 'Supprimer ce site ?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const r = await fetch(`${API_BASE_URL}/api/sites/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (!r.ok) { const d = await r.json(); setToast({ message: d.message, type: 'error' }); return; }
          setSelectedSiteIds(prev => prev.filter(s => s !== id));
          await fetchSites();
        } catch { setToast({ message: 'Erreur réseau.', type: 'error' }); }
      }
    });
  };

  const getTransferLocations = (ev: any) => {
    const changes = Array.isArray(ev.changes) ? ev.changes : [];
    const loc  = changes.find((c: any) => c.field === 'location');
    const dept = changes.find((c: any) => c.field === 'department');
    const site = changes.find((c: any) => c.field === 'siteId');
    return {
      fromLocation: loc?.from      || '',
      toLocation:   loc?.to        || '',
      fromDept:     dept?.from     || '',
      toDept:       dept?.to       || ev.department || '',
      fromSiteName: site?.fromName || (site?.from ? `Site #${site.from}` : ''),
      toSiteName:   site?.toName   || (site?.to   ? `Site #${site.to}`   : ''),
      siteChanged:  !!site,
    };
  };

  const fetchAllTransfers = async (filter = transferModuleFilter) => {
    setTransferModuleLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.department) params.append('department', filter.department);
      if (filter.from)       params.append('from', filter.from);
      if (filter.to)         params.append('to', filter.to);
      const r = await fetch(`${API_BASE_URL}/api/transfers?${params}`, { headers: authHeaders() });
      if (r.ok) setAllTransfers(await r.json());
    } catch (err) { console.error(err); }
    setTransferModuleLoading(false);
  };

  const fetchActivityLog = async (filter = activityFilter) => {
    setActivityLogLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (filter.username) params.append('username', filter.username);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom);
      if (filter.dateTo)   params.append('dateTo', filter.dateTo);
      if (filter.action)   params.append('action', filter.action);
      const r = await fetch(`${API_BASE_URL}/api/admin/activity-log?${params}`, { headers: authHeaders() });
      if (r.ok) setActivityEntries(await r.json());
    } catch (err) { console.error(err); }
    setActivityLogLoading(false);
  };

  const fetchVisits = async (filter = visitFilter) => {
    setVisitsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.siteId)  params.append('siteId', filter.siteId);
      if (filter.status)  params.append('status', filter.status);
      if (filter.from)    params.append('from', filter.from);
      if (filter.to)      params.append('to', filter.to);
      const r = await fetch(`${API_BASE_URL}/api/visits?${params}`, { headers: authHeaders() });
      if (r.ok) setVisits(await r.json());
    } catch (err) { console.error(err); }
    setVisitsLoading(false);
  };

  const saveVisit = async () => {
    if (!visitForm.siteId) { setToast({ message: 'Veuillez sélectionner un site.', type: 'error' }); return; }
    if (!visitForm.scheduledDate) { setToast({ message: 'Veuillez choisir une date.', type: 'error' }); return; }
    if (!visitForm.technician.trim()) { setToast({ message: 'Veuillez indiquer le technicien.', type: 'error' }); return; }
    if (!visitForm.purpose.trim()) { setToast({ message: "Veuillez indiquer l'objet de la visite.", type: 'error' }); return; }
    setVisitSaving(true);
    try {
      const site = sites.find(s => s.id === visitForm.siteId);
      const siteName = site?.name ?? '';
      const body = { ...visitForm, siteName };
      const url = editingVisitId ? `${API_BASE_URL}/api/visits/${editingVisitId}` : `${API_BASE_URL}/api/visits`;
      const method = editingVisitId ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) {
        const savedVisit = await r.json();
        // Auto-create maintenance tickets en_attente for new visits with maintenance
        if (!editingVisitId && visitForm.withMaintenance) {
          const desc = visitForm.maintenanceDesc.trim() ||
            `Maintenance à prévoir – Visite du ${new Date(visitForm.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR')} — Site : ${siteName}`;
          const eqIds = visitForm.equipmentIds.length > 0 ? visitForm.equipmentIds : [null as null];
          for (const eqId of eqIds) {
            const mBody: Record<string, unknown> = {
              failureDesc: desc, technician: visitForm.technician,
              priority: 'normale', status: 'en_attente',
              visitId: savedVisit.id, siteName
            };
            if (eqId !== null) mBody.equipmentId = eqId;
            await fetch(`${API_BASE_URL}/api/maintenance`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(mBody)
            });
          }
          fetchMaintenance(maintenanceFilter);
        }
        setToast({ message: editingVisitId ? 'Visite mise à jour.' : (visitForm.withMaintenance ? 'Visite programmée · Ticket(s) maintenance créé(s) en attente.' : 'Visite programmée.'), type: 'success' });
        setShowVisitForm(false);
        setEditingVisitId(null);
        setVisitForm(defaultVisitForm);
        fetchVisits();
      } else {
        const d = await r.json();
        setToast({ message: d.message || 'Erreur lors de la sauvegarde.', type: 'error' });
      }
    } catch { setToast({ message: 'Erreur réseau.', type: 'error' }); }
    setVisitSaving(false);
  };

  const deleteVisitRecord = async (id: number) => {
    setConfirmModal({ message: 'Supprimer cette visite programmée ?', onConfirm: async () => {
      setConfirmModal(null);
      const r = await fetch(`${API_BASE_URL}/api/visits/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (r.ok) { setToast({ message: 'Visite supprimée.', type: 'success' }); fetchVisits(); }
    }});
  };

  const handleVisitAction = async () => {
    if (!visitActionDialog) return;
    const { visit: v, action, comment, newDate, maintenanceAction } = visitActionDialog;
    setVisitActionDialog(null);
    const now = new Date().toISOString();

    // 1. Update visit status
    const payload: Record<string, unknown> = {
      ...v,
      status: action,
      validationComment: comment,
      validatedAt: now,
      validatedBy: currentUser.name,
      rescheduledDate: action === 'reporté' ? newDate || null : v.rescheduledDate
    };
    const res = await fetch(`${API_BASE_URL}/api/visits/${v.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { setToast({ message: 'Erreur lors de la mise à jour.', type: 'error' }); return; }

    // 2. Handle linked maintenance tickets
    if (v.withMaintenance && maintenanceAction !== 'laisser') {
      const linkedTickets = maintenanceRecords.filter(m => m.visitId === v.id && m.status !== 'résolu');
      if (linkedTickets.length > 0) {
        const newStatus = maintenanceAction === 'sur_place' ? 'résolu' : 'ouvert';
        const extra = maintenanceAction === 'sur_place'
          ? { closedAt: now, solution: comment || 'Traité sur place lors de la visite' }
          : {};
        for (const ticket of linkedTickets) {
          await fetch(`${API_BASE_URL}/api/maintenance/${ticket.id}`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, ...extra })
          });
        }
        fetchMaintenance(maintenanceFilter);
      } else if (action === 'terminé' && maintenanceAction === 'sur_place') {
        // No linked tickets found — create a resolved one directly
        const desc = v.maintenanceDesc.trim() || `Maintenance effectuée lors de la visite du ${new Date(v.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR')} — Site : ${v.siteName}`;
        await fetch(`${API_BASE_URL}/api/maintenance`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ failureDesc: desc, technician: v.technician, priority: 'normale', status: 'résolu', visitId: v.id, siteName: v.siteName })
        });
        fetchMaintenance(maintenanceFilter);
      }
    }

    fetchVisits();
    const maintMsg = v.withMaintenance && maintenanceAction !== 'laisser'
      ? (maintenanceAction === 'sur_place' ? ' · Maintenance marquée comme résolue.' : ' · Maintenance ouverte pour planification.')
      : '';
    const baseMsg: Record<string, string> = { 'terminé': 'Visite terminée', 'annulé': 'Visite annulée', 'reporté': 'Visite reportée' };
    setToast({ message: (baseMsg[action] ?? 'Visite mise à jour') + maintMsg + '.', type: 'success' });
  };

  const openReformModal = (equipment: Equipment) => {
    setReformTarget(equipment);
    setReformForm({ reason: '', replacedById: null, notes: '', reformQty: equipment.quantity ?? 1 });
    setShowReformModal(true);
  };

  const renewWarranty = async (equipmentId: number, newDate: string) => {
    if (!newDate) return;
    setWarrantyRenewSaving(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/equipments/${equipmentId}/warranty`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ warranty: newDate }),
      });
      if (r.status === 401) { handleUnauthorized(); return; }
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setEquipments(prev => prev.map(e => e.id === updated.id ? updated : e));
      if (selectedEquipment?.id === equipmentId) setSelectedEquipment(updated);
      setWarrantyRenewSaving(false);
      setWarrantyRenewEquipId(null);
      setWarrantyRenewDate('');
      setToast({ message: `Garantie renouvelée jusqu'au ${new Date(newDate).toLocaleDateString('fr-FR')}.`, type: 'success' });
    } catch {
      setWarrantyRenewSaving(false);
      setToast({ message: 'Impossible de renouveler la garantie.', type: 'error' });
    }
  };

  const handleReform = async () => {
    if (!reformTarget) return;
    if (!reformForm.reason.trim()) { setToast({ message: 'Veuillez indiquer la raison de la réforme.', type: 'error' }); return; }
    setReformLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${reformTarget.id}/reform`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(reformForm),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setEquipments(prev => prev.map(e => e.id === updated.id ? updated : e));
      setShowReformModal(false);
    } catch {
      setToast({ message: 'Impossible de réformer cet équipement.', type: 'error' });
    }
    setReformLoading(false);
  };

  const handleDocumentUpload = async (equipmentId: number, file: File, description: string) => {
    return new Promise<EquipmentDoc | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = (reader.result as string).split(',')[1];
        try {
          const r = await fetch(`${API_BASE}/${equipmentId}/documents`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ filename: file.name, fileType: file.type, fileSize: file.size, fileData, description }),
          });
          if (r.ok) resolve(await r.json());
          else resolve(null);
        } catch { resolve(null); }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteDocument = (docId: number) => {
    setConfirmModal({
      message: 'Supprimer ce document ?',
      onConfirm: async () => {
        setConfirmModal(null);
        const r = await fetch(`${API_BASE_URL}/api/documents/${docId}`, { method: 'DELETE', headers: authHeaders() });
        if (r.ok || r.status === 204) {
          setEquipmentDocs((prev) => prev.filter((d) => d.id !== docId));
        }
      }
    });
  };

  const downloadDocument = async (docId: number) => {
    const r = await fetch(`${API_BASE_URL}/api/documents/${docId}/download`, { headers: authHeaders() });
    if (!r.ok) return;
    const { filename, fileType, fileData } = await r.json();
    const link = document.createElement('a');
    link.href = `data:${fileType};base64,${fileData}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleNewEquipDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 3 * 1024 * 1024);
    if (valid.length < files.length) setToast({ message: 'Certains fichiers dépassent 3 Mo et ont été ignorés.', type: 'info' });
    setNewEquipDocs((prev) => [...prev, ...valid.map((f) => ({ file: f, description: '' }))]);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // ─── Maintenance ────────────────────────────────────────────────────────────

  const fetchMaintenance = async (status = 'all') => {
    setMaintenanceLoading(true);
    try {
      const url = status === 'all' ? '/api/maintenance' : `/api/maintenance?status=${status}`;
      const r = await fetch(`${API_BASE_URL}${url}`, { headers: authHeaders() });
      if (r.ok) setMaintenanceRecords(await r.json());
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const closeAllModules = () => {
    setShowTransferModal(false);
    setShowTransferModule(false);
    setShowTransferReport(false);
    setShowMaintenanceModule(false);
    setShowMaintenanceForm(false);
    setShowMaintenanceReport(false);
    setSelectedMaintenance(null);
    setShowWarrantyModule(false);
    setShowReportsModal(false);
    setShowMonitoringModal(false);
    setShowActivityLog(false);
    setShowVisitModule(false);
    setShowLicenseModule(false);
    setShowWarrantyRenewModule(false);
    setShowTrends(false);
    setShowUnifiedCalendar(false);
    setShowMonthlyReport(false);
    setShowContractsModule(false);
    setShowPurchasesModule(false);
    setShowRMAModule(false);
    setShowAnomalies(false);
    setShowInventory(false);
    setShowTVDashboard(false);
    setShowSettings(false);
  };

  const openMaintenanceModule = () => {
    closeAllModules();
    setShowMaintenanceModule(true);
    setShowAssistanceFilter(false);
    setSelectedMaintenance(null);
    fetchMaintenance(maintenanceFilter);
  };

  const openWarrantyModule = () => {
    closeAllModules();
    setShowWarrantyModule(true);
    setWarrantyRiskFilter('all');
  };

  const openSignalerPanne = (equipment: Equipment) => {
    setMaintForm({ ...defaultMaintenanceForm, equipmentId: equipment.id });
    setMaintenanceEditId(null);
    setShowMaintenanceForm(true);
    setShowMaintenanceModule(true);
  };

  const handleSaveMaintenance = async () => {
    if (!maintenanceForm.failureDesc.trim()) { setToast({ message: 'Description de la panne requise.', type: 'error' }); return; }
    try {
      if (maintenanceEditId !== null) {
        const r = await fetch(`${API_BASE_URL}/api/maintenance/${maintenanceEditId}`, {
          method: 'PUT', headers: authHeaders(), body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          const updated = await r.json();
          setMaintenanceRecords((prev) => prev.map((m) => m.id === maintenanceEditId ? updated : m));
          setSelectedMaintenance(updated);
          // Refresh équipements : statut peut changer (résolu → actif, ouvert → maintenance)
          fetchEquipments();
        }
      } else {
        const r = await fetch(`${API_BASE_URL}/api/maintenance`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          const created = await r.json();
          setMaintenanceRecords((prev) => [created, ...prev]);
          // Refresh equipment list so status updates
          fetchEquipments();
        }
      }
      setShowMaintenanceForm(false);
      setMaintForm(defaultMaintenanceForm);
      setMaintenanceEditId(null);
    } catch { setToast({ message: 'Erreur lors de la sauvegarde.', type: 'error' }); }
  };

  const handleDeleteMaintenance = (id: number) => {
    setConfirmModal({
      message: 'Supprimer ce ticket de maintenance ?',
      onConfirm: async () => {
        setConfirmModal(null);
        const r = await fetch(`${API_BASE_URL}/api/maintenance/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (r.ok || r.status === 204) {
          setMaintenanceRecords((prev) => prev.filter((m) => m.id !== id));
          if (selectedMaintenance?.id === id) setSelectedMaintenance(null);
        }
      }
    });
  };

  const maintenanceStatusStyle: Record<string, string> = {
    en_attente: 'bg-blue-100 text-blue-700',
    ouvert:     'bg-red-100 text-red-700',
    en_cours:   'bg-yellow-100 text-yellow-700',
    résolu:     'bg-green-100 text-green-700',
  };
  const getWarrantyInfo = (warranty: string) => {
    if (!warranty) return null;
    const d = new Date(warranty);
    if (isNaN(d.getTime())) return null;
    const diffDays = Math.floor((d.getTime() - Date.now()) / 86400000);
    if (diffDays < 0) return { status: 'expired' as const, days: Math.abs(diffDays), label: `Expirée`, color: 'bg-red-100 text-red-700 border-red-200' };
    if (diffDays <= 30) return { status: 'critical' as const, days: diffDays, label: `${diffDays}j`, color: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (diffDays <= 90) return { status: 'warning' as const, days: diffDays, label: `${Math.ceil(diffDays/30)}m`, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { status: 'ok' as const, days: diffDays, label: `${Math.floor(diffDays/30)}m`, color: 'bg-green-100 text-green-700 border-green-200' };
  };

  const maintenanceStatusLabel: Record<string, string> = {
    en_attente: 'En attente',
    ouvert:     'Ouvert',
    en_cours:   'En cours',
    résolu:     'Résolu',
  };
  const maintenancePriorityStyle: Record<string, string> = {
    faible:   'bg-gray-100 text-gray-600',
    normale:  'bg-blue-100 text-blue-700',
    haute:    'bg-orange-100 text-orange-700',
    critique: 'bg-red-200 text-red-800 font-bold',
  };

  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const openDetailsModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setDetailsTab('info');
    setEquipmentDocs([]);
    setTransferHistory([]);
    setShowDetailsModal(true);
  };

  const filteredEquipments = useMemo(() => equipments.filter((equipment) => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch =
      equipment.name.toLowerCase().includes(lowerSearch) ||
      equipment.location.toLowerCase().includes(lowerSearch) ||
      equipment.department.toLowerCase().includes(lowerSearch) ||
      equipment.brand.toLowerCase().includes(lowerSearch) ||
      equipment.model.toLowerCase().includes(lowerSearch) ||
      equipment.serialNumber.toLowerCase().includes(lowerSearch) ||
      equipment.ipAddress.toLowerCase().includes(lowerSearch);

    const matchesType   = filterType   === 'all' || equipment.type   === filterType;
    const matchesStatus = filterStatus === 'all' || equipment.status === filterStatus;
    const matchesSite   = selectedSiteIds.length === 0 || (equipment.siteId != null && selectedSiteIds.includes(equipment.siteId as number));

    return matchesSearch && matchesType && matchesStatus && matchesSite;
  }), [equipments, searchTerm, filterType, filterStatus, selectedSiteIds]);

  const getTypeIcon = (type: EquipmentType) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    const IconComponent = typeInfo?.icon || Monitor;
    return <IconComponent className="w-4 h-4" />;
  };

  const maintenanceCount = filteredEquipments.filter((equipment) => equipment.status === 'maintenance').length;
  const notVisitedCount = filteredEquipments.filter((equipment) => !equipment.visited).length;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const filteredVisits = visits.filter((visit) => selectedSiteIds.length === 0 || (visit.siteId != null && selectedSiteIds.includes(visit.siteId)));
  const filteredMaintenance = maintenanceRecords.filter((maintenance) => {
    if (selectedSiteIds.length === 0) return true;
    const siteId = (maintenance as MaintenanceRecord & { siteId?: number | null }).siteId;
    if (siteId != null) return selectedSiteIds.includes(siteId);
    if (maintenance.equipmentId != null) {
      const equipment = equipments.find((e) => e.id === maintenance.equipmentId);
      return equipment?.siteId != null && selectedSiteIds.includes(equipment.siteId);
    }
    return false;
  });

  // KPI stats — calculés sur les données actuellement affichées et filtrées par site si nécessaire
  const kpiStats = {
    total: filteredEquipments.length,
    actifs: filteredEquipments.filter(e => e.status === 'actif').length,
    defaillants: filteredEquipments.filter(e => e.status === 'defaillant' || e.status === 'maintenance').length,
    reformes: filteredEquipments.filter(e => e.status === 'réformé').length,
    ticketsOuverts: filteredMaintenance.filter(m => m.status !== 'résolu').length,
    ticketsCritiques: filteredMaintenance.filter(m => m.priority === 'critique' && m.status !== 'résolu').length,
    nonVisites: notVisitedCount,
    visitesPlannifiees: filteredVisits.filter(v => v.status === 'planifié').length,
    visitesToday: filteredVisits.filter(v => v.scheduledDate === todayStr && v.status === 'planifié').length,
    visitesEnCours: filteredVisits.filter(v => v.status === 'en_cours').length,
    garantiesExpirees: filteredEquipments.filter(e => getWarrantyInfo(e.warranty)?.status === 'expired').length,
    garantiesCritiques: filteredEquipments.filter(e => getWarrantyInfo(e.warranty)?.status === 'critical').length,
    stockBas: filteredEquipments.filter(e => e.type === 'accessoires' && (e.minQuantity ?? 0) > 0 && e.quantity <= (e.minQuantity ?? 0)).length,
  };

  const lowStockItems = filteredEquipments.filter(e => e.type === 'accessoires' && (e.minQuantity ?? 0) > 0 && e.quantity <= (e.minQuantity ?? 0));

  const selectedSiteNames = selectedSiteIds.length > 0
    ? sites.filter((site) => selectedSiteIds.includes(site.id)).map((site) => site.name).join(', ')
    : 'Tous sites';

  const filterTypeLabel = filterType === 'all'
    ? 'Tous types'
    : equipmentTypes.find((t) => t.value === filterType)?.label ?? filterType;

  const filterStatusLabel = filterStatus === 'all'
    ? 'Tous statuts'
    : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1);

  const kpiContextLabel = selectedSiteIds.length > 0
    ? `${selectedSiteIds.length} site(s) sélectionné(s) — ${selectedSiteNames}`
    : 'Toutes les données disponibles';

  const pagedEquipments   = filteredEquipments.slice((equipPage - 1) * PAGE_SIZE, equipPage * PAGE_SIZE);
  const assistanceViewRecords = showAssistanceFilter
    ? maintenanceRecords.filter(m => m.requestType === 'assistance')
    : maintenanceRecords;
  const pagedMaintenance  = assistanceViewRecords.slice((maintenancePage - 1) * PAGE_SIZE, maintenancePage * PAGE_SIZE);
  const pagedActivityLogs = activityLogs.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE);

  const warrantyEquipments = equipments.filter((equipment) =>
    selectedSiteIds.length === 0 || (equipment.siteId != null && selectedSiteIds.includes(equipment.siteId))
  );

  const warrantyDetails = warrantyEquipments.map((equipment) => {
    const warrantyInfo = getWarrantyInfo(equipment.warranty);
    return {
      ...equipment,
      warrantyStatus: warrantyInfo?.status ?? 'unknown',
      warrantyLabel: warrantyInfo?.label ?? 'Non renseignée',
      warrantyClass: warrantyInfo?.color ?? 'bg-gray-100 text-gray-700 border-gray-200',
      warrantyDays: warrantyInfo?.days ?? null,
    };
  });

  const warrantyStats = {
    total: warrantyDetails.length,
    expired: warrantyDetails.filter((e) => e.warrantyStatus === 'expired').length,
    critical: warrantyDetails.filter((e) => e.warrantyStatus === 'critical').length,
    warning: warrantyDetails.filter((e) => e.warrantyStatus === 'warning').length,
    ok: warrantyDetails.filter((e) => e.warrantyStatus === 'ok').length,
    unknown: warrantyDetails.filter((e) => e.warrantyStatus === 'unknown').length,
  };

  const warrantySiteStats = sites
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
    .sort((a, b) => (b.expired + b.critical) - (a.expired + a.critical) || b.warning - a.warning || b.total - a.total);

  const warrantyRiskLabels: Record<string, string> = {
    all: 'Tous statuts',
    expired: 'Expirées',
    critical: 'Critiques',
    warning: 'Alerte',
    ok: 'OK',
    unknown: 'Non renseignées',
  };

  const warrantyRiskExplanations: Record<string, string> = {
    expired: 'Garantie expirée : risque de frais hors garantie et délai de réparation prolongé.',
    critical: 'Garantie bientôt expirée (≤ 30 jours) : risque élevé de coût de maintenance non couvert.',
    warning: 'Garantie proche de fin (≤ 90 jours) : planification de renouvellement recommandée.',
    ok: 'Garantie active : couverture encore valide.',
    unknown: 'Aucune date de garantie renseignée : vérifier l’équipement rapidement.',
  };

  const warrantyVisibleEquipments = warrantyDetails.filter((equipment) =>
    warrantyRiskFilter === 'all' || equipment.warrantyStatus === warrantyRiskFilter
  );

  const noSiteWarrantyEquipments = warrantyDetails.filter((equipment) => equipment.siteId == null);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          TOP NAV — style ERP (Odoo)
      ═══════════════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 h-11 bg-[#1a6fa6] flex items-center z-30 shadow-md select-none">
        {/* Grid / apps icon */}
        <button className="w-11 h-11 flex items-center justify-center text-white/80 hover:bg-white/10 border-r border-white/15 shrink-0 transition-colors">
          <LayoutGrid className="w-4 h-4" />
        </button>
        {/* Brand */}
        <div className="px-4 h-11 flex items-center border-r border-white/15 shrink-0">
          <Monitor className="w-4 h-4 text-white mr-2 shrink-0" />
          <span className="text-sm font-bold text-white tracking-wide whitespace-nowrap">Gestion IT</span>
        </div>
        {/* Nav items — scrollable */}
        <div className="flex items-center h-11 overflow-x-auto flex-1" style={{scrollbarWidth:'none'}}>
          {!(showWarrantyModule || showUnifiedCalendar || showCalendar) && (
            <button type="button" onClick={() => closeAllModules()}
              className="h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap font-medium transition-colors">
              <Monitor className="w-3.5 h-3.5 shrink-0" /> Équipements
            </button>
          )}
          {canWrite && canModify && (
            <button type="button" onClick={() => { closeAllModules(); setShowTransferModule(true); fetchAllTransfers(); }}
              className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" /> Transferts
            </button>
          )}
          <button type="button" onClick={() => { closeAllModules(); setMaintForm({ ...defaultMaintenanceForm, requestType: 'assistance' }); setMaintenanceEditId(null); setShowMaintenanceForm(true); setShowMaintenanceModule(true); }}
            className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
            <Headset className="w-3.5 h-3.5 shrink-0" /> Assistance
          </button>
          <button type="button" onClick={() => openMaintenanceModule()}
            className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
            <Wrench className="w-3.5 h-3.5 shrink-0" /> Maintenance
            {maintenanceRecords.filter(m => m.status !== 'résolu').length > 0 && (() => {
              const total = maintenanceRecords.filter(m => m.status !== 'résolu').length;
              const hasCritical = maintenanceRecords.some(m => m.priority === 'critique' && m.status !== 'résolu');
              return <span className={`ml-1 text-white text-[10px] rounded-full px-1.5 py-px leading-none font-bold ${hasCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}>{total}</span>;
            })()}
          </button>
          {canWrite && (
            <button type="button" onClick={() => { closeAllModules(); setShowVisitModule(true); fetchVisits(); }}
              className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
              <Clock className="w-3.5 h-3.5 shrink-0" /> Visites de site
              {(() => {
                const todayStr = new Date().toISOString().slice(0,10);
                const todayCount = visits.filter(v => v.scheduledDate === todayStr && v.status === 'planifié').length;
                const planned = visits.filter(v => v.status === 'planifié').length;
                return planned > 0 ? <span className={`ml-1 text-white text-[10px] rounded-full px-1.5 py-px leading-none font-bold ${todayCount > 0 ? 'bg-blue-400' : 'bg-blue-300'}`}>{planned}</span> : null;
              })()}
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={openWarrantyModule}
              className="h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Garanties
              {(filteredEquipments.filter(e => getWarrantyInfo(e.warranty)?.status === 'expired').length + filteredEquipments.filter(e => getWarrantyInfo(e.warranty)?.status === 'critical').length) > 0 && (
                <span className="ml-1 text-white text-[10px] rounded-full px-1.5 py-px leading-none font-bold bg-yellow-400">Risque</span>
              )}
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={() => { closeAllModules(); setShowWarrantyRenewModule(true); }}
              className="h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors">
              <RefreshCcw className="w-3.5 h-3.5 shrink-0" /> Renouv. Garantie
            </button>
          )}
          <button type="button" onClick={() => { closeAllModules(); setShowReportsModal(true); setReportsTab('equipment'); fetchReportByDepartment(); }}
            className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
            <Calendar className="w-3.5 h-3.5 shrink-0" /> Rapports
          </button>
          <button type="button" onClick={() => { closeAllModules(); setShowUnifiedCalendar(true); }}
            className="h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors">
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" /> Calendrier
          </button>
          <button type="button" onClick={() => setShowMap(true)}
            className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
            <MapPin className="w-3.5 h-3.5 shrink-0" /> Carte
          </button>
          {isAdmin && (
            <>
              <button type="button" onClick={() => { closeAllModules(); setShowActivityLog(true); fetchActivityLog(); }}
                className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
                <ClipboardList className="w-3.5 h-3.5 shrink-0" /> Journal
              </button>
              <button type="button" onClick={() => { closeAllModules(); setShowMonitoringModal(true); }}
                className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
                <Activity className="w-3.5 h-3.5 shrink-0" /> Monitoring
              </button>
              <button type="button" onClick={() => { fetchUsers(); setShowUserModal(true); }}
                className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
                <Users className="w-3.5 h-3.5 shrink-0" /> Utilisateurs
              </button>
              <button type="button" onClick={() => { setSiteForm(defaultSiteForm); setEditingSiteId(null); setShowSiteModal(true); }}
                className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}>
                <Globe className="w-3.5 h-3.5 shrink-0" /> Sites
              </button>
              <button type="button" onClick={downloadBackup}
                className={`h-11 px-4 text-white/85 text-sm hover:bg-white/12 hover:text-white border-r border-white/10 shrink-0 flex items-center gap-2 whitespace-nowrap transition-colors ${(showWarrantyModule || showUnifiedCalendar || showCalendar) ? 'hidden' : ''}`}
                title="Télécharger une sauvegarde complète JSON">
                <Download className="w-3.5 h-3.5 shrink-0" /> Sauvegarde
              </button>
            </>
          )}
        </div>
        {/* Right — actions + user */}
        <div className="flex items-center gap-1 px-2 shrink-0 border-l border-white/15">
          <button onClick={() => { setShowGlobalSearch(true); setGlobalSearchQuery(''); setTimeout(() => globalSearchRef.current?.focus(), 50); }}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/12 rounded transition-colors" title="Recherche (Ctrl+K)">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowChatModal(true); openChatConversation(chatConversation); }}
            className="relative w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/12 rounded transition-colors" title="Messagerie">
            <MessageCircle className="w-4 h-4" />
            {(chatUnread.global + Object.values(chatUnread.dms).reduce((a,b)=>a+b,0) + Object.values(chatUnread.groups).reduce((a,b)=>a+b,0)) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          {/* Ping all */}
          <button onClick={pingAllEquipments}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/12 rounded transition-colors"
            title="Vérifier connectivité réseau de tous les équipements">
            <Wifi className="w-4 h-4" />
          </button>
          {/* Masquage données sensibles (N° série, IP, clés) */}
          <button onClick={() => { const v = !maskSensitive; setMaskSensitive(v); localStorage.setItem('it-mask-sensitive', String(v)); }}
            className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${maskSensitive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/12'}`}
            title={maskSensitive ? 'Afficher données sensibles (N° série, IP)' : 'Masquer données sensibles (N° série, IP)'}>
            {maskSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {/* Scan QR */}
          <button onClick={startQrScan}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/12 rounded transition-colors"
            title="Scanner un QR code">
            <QrCode className="w-4 h-4" />
          </button>
          {/* Dark mode toggle */}
          <button onClick={cycleDarkMode}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:bg-white/12 rounded transition-colors"
            title={darkModeAuto ? 'Auto (D)' : darkMode ? 'Mode clair (D)' : 'Mode sombre (D)'}>
            {darkModeAuto ? <Monitor className="w-4 h-4" /> : darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <div className="w-7 h-7 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="ml-1 mr-2 cursor-default">
            <div className="text-white text-xs font-semibold leading-tight truncate max-w-[100px]">{currentUser.name}</div>
            <div className="text-white/60 text-[10px] leading-tight">{roleInfo.label}</div>
          </div>
          <button type="button" onClick={onLogout} title="Déconnexion"
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:bg-white/12 rounded transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-[#f8f9fa] pt-11">
        <div>

        {/* ── Sélecteur de sites (compact chips) ── */}
        {(sites.length > 0 || isAdmin) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
            {/* Site unique → badge fixe sans dropdown */}
            {!isAdmin && userAllowedSiteIds.length === 1 ? (() => {
              const s = sites.find(s => s.id === userAllowedSiteIds[0]);
              return s ? (
                <div className="flex items-center gap-3 bg-white border border-[#1a6fa6]/30 rounded-xl shadow-sm px-4 py-3 flex-1 max-w-sm">
                  <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-800 block truncate">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.city}{s.country ? `, ${s.country}` : ''} · {equipments.filter(e => e.siteId === s.id).length} équip.</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#cfe2ff] text-[#155a8a] font-medium shrink-0">Votre site</span>
                </div>
              ) : null;
            })() : (
            /* Plusieurs sites ou admin → multi-select avec chips */
            <div className="flex-1" ref={siteDropdownRef}>
              {/* Chips des sites sélectionnés */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {selectedSiteIds.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Tous les sites affichés</span>
                ) : (
                  selectedSiteIds.map(id => {
                    const s = sites.find(s => s.id === id);
                    if (!s) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-[#cfe2ff] text-[#155a8a] text-xs font-medium px-3 py-1 rounded-full">
                        {s.name}
                        <button type="button" onClick={() => setSelectedSiteIds(prev => prev.filter(i => i !== id))}
                          className="ml-1 hover:text-[#0d4a73] transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })
                )}
                {selectedSiteIds.length > 0 && (
                  <button type="button" onClick={() => setSelectedSiteIds(isAdmin ? [] : userAllowedSiteIds)}
                    className="text-xs text-gray-400 hover:text-red-500 underline transition-colors">
                    {isAdmin ? 'Tout désélectionner' : 'Réinitialiser mes sites'}
                  </button>
                )}
              </div>

              {/* Bouton ouverture dropdown */}
              <div className="relative">
                <button type="button" onClick={() => setShowSiteDropdown(v => !v)}
                  className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-2.5 text-sm text-gray-700 hover:border-indigo-400 hover:shadow-md transition-all">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  Filtrer par site
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSiteDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSiteDropdown && (
                  <div className="absolute left-0 top-full mt-1 min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    {/* Tout sélectionner / désélectionner */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites disponibles</span>
                      {isAdmin && (
                        <button type="button"
                          onClick={() => {
                            const available = sites;
                            setSelectedSiteIds(selectedSiteIds.length === available.length ? [] : available.map(s => s.id));
                          }}
                          className="text-xs text-[#1a6fa6] hover:underline font-medium">
                          {selectedSiteIds.length === sites.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      )}
                    </div>

                    {(isAdmin || userAllowedSiteIds.length === 0 ? sites : sites.filter(s => userAllowedSiteIds.includes(s.id))).map(site => {
                      const count = equipments.filter(e => e.siteId === site.id).length;
                      const selected = selectedSiteIds.includes(site.id);
                      return (
                        <button key={site.id} type="button"
                          onClick={() => setSelectedSiteIds(prev => selected ? prev.filter(i => i !== site.id) : [...prev, site.id])}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-[#e8f3fc]' : 'hover:bg-gray-50'}`}>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-[#1a6fa6] border-[#1a6fa6]' : 'border-gray-300'}`}>
                            {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${selected ? 'text-[#155a8a]' : 'text-gray-800'}`}>{site.name}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{site.city}{site.country ? `, ${site.country}` : ''} · {count} équip.
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {sites.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400 text-center">Aucun site configuré.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}

          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Bannière alertes critiques ── */}
        {(kpiStats.ticketsCritiques > 0 || kpiStats.visitesToday > 0 || kpiStats.garantiesExpirees + kpiStats.garantiesCritiques > 0 || kpiStats.stockBas > 0) && (
          <div className="mb-4 flex flex-wrap gap-3">
            {kpiStats.ticketsCritiques > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-700">{kpiStats.ticketsCritiques} ticket{kpiStats.ticketsCritiques > 1 ? 's' : ''} critique{kpiStats.ticketsCritiques > 1 ? 's' : ''} non résolu{kpiStats.ticketsCritiques > 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-500 truncate">{filteredMaintenance.filter(m => m.priority === 'critique' && m.status !== 'résolu').slice(0,2).map(m => m.equipmentName || 'Équipement').join(', ')}{kpiStats.ticketsCritiques > 2 ? ` +${kpiStats.ticketsCritiques-2}` : ''}</p>
                </div>
                <button onClick={() => openMaintenanceModule()} className="text-xs font-semibold text-red-600 hover:text-red-800 shrink-0 underline">Voir →</button>
              </div>
            )}
            {kpiStats.visitesToday > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-700">{kpiStats.visitesToday} visite{kpiStats.visitesToday > 1 ? 's' : ''} planifiée{kpiStats.visitesToday > 1 ? 's' : ''} aujourd'hui</p>
                  <p className="text-xs text-blue-500 truncate">{filteredVisits.filter(v => v.scheduledDate === todayStr && v.status === 'planifié').slice(0,2).map(v => v.siteName).join(', ')}</p>
                </div>
                <button onClick={() => { closeAllModules(); setShowVisitModule(true); fetchVisits(); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0 underline">Voir →</button>
              </div>
            )}
            {kpiStats.garantiesExpirees + kpiStats.garantiesCritiques > 0 && (
              <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-yellow-700">
                    {kpiStats.garantiesExpirees > 0 ? `${kpiStats.garantiesExpirees} garantie${kpiStats.garantiesExpirees>1?'s':''} expirée${kpiStats.garantiesExpirees>1?'s':''}` : ''}
                    {kpiStats.garantiesExpirees > 0 && kpiStats.garantiesCritiques > 0 ? ' · ' : ''}
                    {kpiStats.garantiesCritiques > 0 ? `${kpiStats.garantiesCritiques} expire${kpiStats.garantiesCritiques>1?'nt':''} bientôt` : ''}
                  </p>
                  <p className="text-xs text-yellow-600">Vérifiez les équipements concernés</p>
                </div>
              </div>
            )}
            {kpiStats.stockBas > 0 && (
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-orange-700">{kpiStats.stockBas} accessoire{kpiStats.stockBas > 1 ? 's' : ''} en stock bas</p>
                  <p className="text-xs text-orange-500 truncate">{lowStockItems.slice(0, 3).map(e => `${e.name} (${e.quantity}/${e.minQuantity})`).join(', ')}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3}` : ''}</p>
                </div>
                <button onClick={() => { setFilterType('accessoires'); closeAllModules(); }} className="text-xs font-semibold text-orange-600 hover:text-orange-800 shrink-0 underline">Voir →</button>
              </div>
            )}
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">Statistiques affichées</p>
              <p className="text-xs text-slate-500">{kpiContextLabel} · {filterTypeLabel} · {filterStatusLabel} · {filteredEquipments.length} équipement(s)</p>
            </div>
            <div className="text-xs text-slate-500">Actualisation automatique toutes les 30 s</div>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
            Données en direct et filtrées en fonction du site sélectionné
          </span>
          <button onClick={() => { fetchEquipments(); fetchMaintenance('all'); fetchVisits({ siteId:'', status:'', from:'', to:'' }); }}
            className="text-xs text-[#1a6fa6] hover:text-[#0d4a73] flex items-center gap-1 font-medium">
            <RefreshCcw className="w-3 h-3" /> Actualiser maintenant
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {[
            {
              label: 'Total équipements',
              value: kpiStats.total,
              icon: <Monitor className="w-5 h-5 text-[#1a6fa6]" />,
              bg: 'bg-[#e8f3fc]',
              sub: selectedSiteIds.length > 0 ? `${selectedSiteIds.length} site(s) filtré(s)` : 'Tous sites confondus',
              onClick: () => closeAllModules(),
            },
            {
              label: 'Actifs',
              value: kpiStats.actifs,
              icon: <CheckCircle className="w-5 h-5 text-green-500" />,
              bg: 'bg-green-50',
              sub: `${kpiStats.reformes} réformé(s)`,
              onClick: () => { setFilterStatus('actif'); closeAllModules(); },
            },
            {
              label: 'Défaillants',
              value: kpiStats.defaillants,
              icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
              bg: 'bg-red-50',
              sub: 'Panne ou maintenance',
              onClick: () => { setFilterStatus('defaillant'); closeAllModules(); },
            },
            {
              label: 'Tickets ouverts',
              value: kpiStats.ticketsOuverts,
              icon: <Wrench className="w-5 h-5 text-amber-500" />,
              bg: 'bg-amber-50',
              sub: `${kpiStats.ticketsCritiques} critique(s) urgents`,
              onClick: openMaintenanceModule,
            },
            {
              label: 'Non visités',
              value: kpiStats.nonVisites,
              icon: <XCircle className="w-5 h-5 text-rose-500" />,
              bg: 'bg-rose-50',
              sub: 'Sans passage technicien',
              onClick: () => closeAllModules(),
            },
            {
              label: 'Visites planifiées',
              value: kpiStats.visitesPlannifiees,
              icon: <Calendar className="w-5 h-5 text-blue-500" />,
              bg: 'bg-blue-50',
              sub: kpiStats.visitesToday > 0 ? `⚡ ${kpiStats.visitesToday} aujourd'hui` : kpiStats.visitesEnCours > 0 ? `${kpiStats.visitesEnCours} en cours` : 'Interventions à venir',
              onClick: () => { closeAllModules(); setShowVisitModule(true); fetchVisits(); },
            },
          ].map(({ label, value, icon, bg, sub, onClick }) => (
            <div key={label} onClick={onClick}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md hover:border-[#1a6fa6]/30 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>{icon}</div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{label}</p>
              <p className={`text-xs mt-0.5 truncate ${sub.startsWith('⚡') ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Graphiques Dashboard ── */}
        {filteredEquipments.length > 0 && (() => {
          // Donut chart — statuts
          const statusData = [
            { key: 'actif',        label: 'Actif',        color: '#22c55e', count: filteredEquipments.filter(e => e.status === 'actif').length },
            { key: 'maintenance',  label: 'Maintenance',  color: '#f59e0b', count: filteredEquipments.filter(e => e.status === 'maintenance').length },
            { key: 'defaillant',   label: 'Défaillant',   color: '#ef4444', count: filteredEquipments.filter(e => e.status === 'defaillant').length },
            { key: 'inactif',      label: 'Inactif',      color: '#6b7280', count: filteredEquipments.filter(e => e.status === 'inactif').length },
            { key: 'réformé',      label: 'Réformé',      color: '#a855f7', count: filteredEquipments.filter(e => e.status === 'réformé').length },
          ].filter(d => d.count > 0);
          const total = statusData.reduce((s, d) => s + d.count, 0);
          // Build donut arcs
          const r = 48; const cx = 64; const cy = 64; const sw = 20;
          let cumAngle = -Math.PI / 2;
          const arcs = statusData.map(d => {
            const angle = (d.count / total) * 2 * Math.PI;
            const x1 = cx + r * Math.cos(cumAngle);
            const y1 = cy + r * Math.sin(cumAngle);
            cumAngle += angle;
            const x2 = cx + r * Math.cos(cumAngle);
            const y2 = cy + r * Math.sin(cumAngle);
            const large = angle > Math.PI ? 1 : 0;
            return { ...d, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, angle };
          });

          // Bar chart — types
          const typeData = [
            { key: 'ordinateur', label: 'Ordi.', color: '#1a6fa6', count: filteredEquipments.filter(e => e.type === 'ordinateur').length },
            { key: 'reseau',     label: 'Réseau', color: '#06b6d4', count: filteredEquipments.filter(e => e.type === 'reseau').length },
            { key: 'serveur',    label: 'Serveur', color: '#8b5cf6', count: filteredEquipments.filter(e => e.type === 'serveur').length },
            { key: 'imprimante', label: 'Imprim.', color: '#f59e0b', count: filteredEquipments.filter(e => e.type === 'imprimante').length },
            { key: 'accessoires',label: 'Access.', color: '#10b981', count: filteredEquipments.filter(e => e.type === 'accessoires').length },
            { key: 'autre',      label: 'Autre',  color: '#6b7280', count: filteredEquipments.filter(e => e.type === 'autre').length },
          ].filter(d => d.count > 0);
          const maxCount = Math.max(...typeData.map(d => d.count), 1);
          const barH = 80; const barW = 28; const gap = 8;
          const chartW = typeData.length * (barW + gap);

          return (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Donut — statuts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Répartition par statut</h3>
                <div className="flex items-center gap-6">
                  <svg width="128" height="128" viewBox="0 0 128 128" style={{flexShrink:0}}>
                    {arcs.map((arc, i) => (
                      <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={sw}
                        strokeLinecap="butt" opacity={0.9} />
                    ))}
                    <text x="64" y="60" textAnchor="middle" fill="#374151" fontSize="18" fontWeight="bold">{total}</text>
                    <text x="64" y="76" textAnchor="middle" fill="#9ca3af" fontSize="10">équip.</text>
                  </svg>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {arcs.map(d => (
                      <div key={d.key} className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: d.color}} />
                        <span className="text-xs text-gray-600 flex-1 truncate">{d.label}</span>
                        <span className="text-xs font-bold text-gray-900 tabular-nums">{d.count}</span>
                        <span className="text-xs text-gray-400 tabular-nums w-9 text-right">{Math.round(d.count/total*100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Barres — types */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Équipements par type</h3>
                <div className="flex items-end gap-1 overflow-x-auto" style={{height: barH + 40}}>
                  <svg width={Math.max(chartW + 16, 200)} height={barH + 36} viewBox={`0 0 ${Math.max(chartW + 16, 200)} ${barH + 36}`} style={{overflow:'visible'}}>
                    {typeData.map((d, i) => {
                      const bh = Math.max(4, Math.round((d.count / maxCount) * barH));
                      const x = 8 + i * (barW + gap);
                      const y = barH - bh;
                      return (
                        <g key={d.key}>
                          <rect x={x} y={y} width={barW} height={bh} rx="4" fill={d.color} opacity={0.85} />
                          <text x={x + barW/2} y={y - 4} textAnchor="middle" fill="#374151" fontSize="11" fontWeight="bold">{d.count}</text>
                          <text x={x + barW/2} y={barH + 14} textAnchor="middle" fill="#6b7280" fontSize="9">{d.label}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Widget Tâches/Rappels ── */}
        {canWrite && (() => {
          const overdue = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < new Date());
          const upcoming = tasks.filter(t => !t.done && (!t.dueDate || new Date(t.dueDate) >= new Date()));
          const prioStyle = { haute: 'bg-red-100 text-red-700 border-red-200', normale: 'bg-blue-100 text-blue-700 border-blue-200', basse: 'bg-gray-100 text-gray-600 border-gray-200' };
          return (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-900">Tâches & Rappels</h3>
                  {overdue.length > 0 && <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{overdue.length} en retard</span>}
                  <span className="text-xs text-gray-400">{tasks.filter(t => !t.done).length} actif(s)</span>
                </div>
                <button onClick={() => setShowTaskForm(v => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a6fa6] hover:text-[#0d4a73] px-2.5 py-1.5 rounded-lg hover:bg-[#e8f3fc] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
                </button>
              </div>
              {showTaskForm && (
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-40">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Titre *</label>
                      <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} placeholder="Ex : Vérifier serveur rack 3" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Échéance</label>
                      <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({...f, dueDate: e.target.value}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Assigné à</label>
                      <input type="text" value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({...f, assignedTo: e.target.value}))} placeholder="Nom du technicien" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6] w-40" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Priorité</label>
                      <select value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value as 'haute'|'normale'|'basse'}))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]">
                        <option value="haute">Haute</option>
                        <option value="normale">Normale</option>
                        <option value="basse">Basse</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { if (!taskForm.title.trim()) return; saveTasks([...tasks, { id: Date.now(), ...taskForm, done: false }]); setTaskForm({ title:'', dueDate:'', assignedTo:'', priority:'normale' }); setShowTaskForm(false); }} disabled={!taskForm.title.trim()} className="px-3 py-2 rounded-lg bg-[#1a6fa6] text-white text-sm font-semibold hover:bg-[#155a8a] disabled:opacity-50">Ajouter</button>
                      <button onClick={() => setShowTaskForm(false)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                    </div>
                  </div>
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">Aucune tâche. Cliquez sur "Nouvelle tâche" pour commencer.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {[...overdue, ...upcoming].filter(t => !t.done).concat(tasks.filter(t => t.done)).slice(0, 6).map(task => {
                    const isOverdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date();
                    return (
                      <div key={task.id} className={`flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors ${task.done ? 'opacity-50' : ''}`}>
                        <button onClick={() => saveTasks(tasks.map(t => t.id === task.id ? {...t, done: !t.done} : t))} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-400'}`}>
                          {task.done && <CircleCheck className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                          {task.assignedTo && <span className="text-xs text-gray-400 ml-2">→ {task.assignedTo}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${prioStyle[task.priority]}`}>{task.priority}</span>
                          {task.dueDate && <span className={`text-xs font-mono ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{new Date(task.dueDate+'T00:00:00').toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}</span>}
                          <button onClick={() => saveTasks(tasks.filter(t => t.id !== task.id))} className="text-gray-300 hover:text-red-500 p-0.5 rounded transition-colors"><XCircle className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {tasks.filter(t => !t.done).length > 6 && <p className="text-center text-xs text-gray-400 py-2">+{tasks.filter(t=>!t.done).length - 6} autre(s)…</p>}
                </div>
              )}
            </div>
          );
        })()}

        {!showForm && !(showTransferModal && !showTransferModule) && <>
        {/* ══ PANNEAU DE CONTRÔLE — style Odoo ══════════════════════════════ */}
        <div className="bg-white border-b border-gray-200 sticky top-11 z-20">
          {/* Ligne 1 : titre + boutons action + recherche */}
          <div className="flex items-center gap-2 px-4 py-2">
            <h2 className="text-lg font-light text-gray-800 mr-2 shrink-0">Équipements</h2>
            {canWrite && (
              <button onClick={openNewEquipmentForm}
                className="bg-[#1a6fa6] text-white text-[11px] font-bold uppercase tracking-wide px-4 py-1.5 rounded hover:opacity-90 shrink-0">
                NOUVEAU
              </button>
            )}
            {canWrite && (
              <button onClick={() => { setImportRows([]); setImportError(''); setShowImportModal(true); }}
                className="border border-gray-300 text-gray-600 text-[11px] font-semibold px-3 py-1.5 rounded hover:bg-gray-50 shrink-0 flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Importer
              </button>
            )}
            <button onClick={handleRefresh} title="Actualiser"
              className="border border-gray-300 text-gray-500 p-1.5 rounded hover:bg-gray-50 shrink-0 transition-colors">
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
            {/* Exporter */}
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setShowExportMenu((v) => !v)}
                className="border border-gray-300 text-gray-600 text-[11px] font-semibold px-3 py-1.5 rounded hover:bg-gray-50 flex items-center gap-1 shrink-0">
                <Download className="w-3.5 h-3.5" /> Exporter
                <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1 overflow-hidden">
                  <button onClick={handleExportCsv}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">CSV</span>
                    Fichier CSV
                  </button>
                  <button onClick={handleExportExcel}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">XLS</span>
                    Excel (.xlsx)
                  </button>
                  <button onClick={handleExportPdf}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-red-100 flex items-center justify-center text-xs font-bold text-red-500">PDF</span>
                    PDF
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Recherche..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent bg-[#f8f9fa] w-64 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Ligne 2 : filtres + groupby + pagination */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
            <button onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
              className="flex items-center gap-1 border border-gray-300 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded hover:bg-gray-50">
              ▼ FILTRES
            </button>
            {/* Type */}
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | EquipmentType)}
              className="border border-gray-300 text-xs text-gray-600 py-1.5 pl-2 pr-6 rounded bg-white hover:bg-gray-50 cursor-pointer">
              <option value="all">Tous les types</option>
              {equipmentTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {/* Statut */}
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | EquipmentStatus)}
              className="border border-gray-300 text-xs text-gray-600 py-1.5 pl-2 pr-6 rounded bg-white hover:bg-gray-50 cursor-pointer">
              <option value="all">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="maintenance">Maintenance</option>
              <option value="defaillant">Défaillant</option>
              <option value="réformé">Réformé</option>
            </select>
            {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
              <button onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                className="text-xs text-[#1a6fa6] hover:underline px-1">✕ Réinitialiser</button>
            )}
            {/* Presets */}
            {(() => {
              const key = JSON.stringify({ filterType, filterStatus, searchTerm, siteIds: selectedSiteIds });
              const saved = JSON.parse(localStorage.getItem('it-filter-presets') || '{}');
              const list = Object.entries(saved) as [string, string][];
              return (
                <div className="flex items-center gap-1">
                  {list.map(([name, val]) => (
                    <button key={name} onClick={() => {
                      const p = JSON.parse(val);
                      setFilterType(p.filterType);
                      setFilterStatus(p.filterStatus);
                      setSearchTerm(p.searchTerm);
                      setSelectedSiteIds(p.siteIds || []);
                    }}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${key === val ? 'bg-[#e8f3fc] border-[#1a6fa6]/30 text-[#1a6fa6] font-semibold' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {name}
                    </button>
                  ))}
                  {!list.some(([, v]) => v === key) && filterType !== 'all' && (
                    <button onClick={() => {
                      const name = prompt('Nom du preset :');
                      if (!name) return;
                      const all = JSON.parse(localStorage.getItem('it-filter-presets') || '{}');
                      all[name] = key;
                      localStorage.setItem('it-filter-presets', JSON.stringify(all));
                      window.location.reload();
                    }}
                      className="text-[11px] px-2 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:text-[#1a6fa6] hover:border-[#1a6fa6]/30 transition-colors">
                      + Preset
                    </button>
                  )}
                </div>
              );
            })()}
            {/* Pagination */}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
              <span>{(equipPage-1)*PAGE_SIZE+1}-{Math.min(equipPage*PAGE_SIZE, filteredEquipments.length)} / {filteredEquipments.length}</span>
              <button onClick={() => setEquipPage(p => Math.max(1,p-1))} disabled={equipPage===1}
                className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button onClick={() => setEquipPage(p => p*PAGE_SIZE < filteredEquipments.length ? p+1 : p)} disabled={equipPage*PAGE_SIZE >= filteredEquipments.length}
                className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border-b border-gray-100 p-10 text-center text-gray-400">Chargement des données…</div>
        ) : (
          <div className="bg-white overflow-hidden border-b border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-8 px-3 py-2.5 text-left"><input type="checkbox" className="w-3.5 h-3.5 accent-[#1a6fa6]" /></th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Équipement</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Type d'acte</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Localisation</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Statut</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Technicien</th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEquipments.map((equipment) => (
                    <tr key={equipment.id} className="hover:bg-[#f5f9fc] border-b border-[#f0f0f0] cursor-pointer">
                      <td className="w-8 px-3 py-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 accent-[#1a6fa6]"
                          checked={compareIds.has(equipment.id)}
                          onChange={() => toggleCompare(equipment.id)}
                          title="Sélectionner pour comparer (max 3)"
                        />
                      </td>
                      <td className="px-3 py-2" onClick={() => openDetailsModal(equipment)}>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 shrink-0">{getTypeIcon(equipment.type)}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#212529] flex items-center gap-1 flex-wrap">
                              <span className="truncate">{equipment.name}</span>
                              {(equipment.quantity ?? 1) > 1 && <span className="text-[10px] font-bold px-1 py-px rounded bg-[#e8f3fc] text-[#1a6fa6] shrink-0">×{equipment.quantity}</span>}
                              {(() => { const w = getWarrantyInfo(equipment.warranty); if (!w || w.status === 'ok') return null; return <span className={`text-[10px] font-semibold px-1 py-px rounded border shrink-0 ${w.color}`}>{w.status === 'expired' ? '⚠' : `⏱${w.label}`}</span>; })()}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{equipment.brand} {equipment.model}{equipment.ipAddress ? ` · ${equipment.ipAddress}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[#1a6fa6] font-medium">
                        {equipmentTypes.find((t) => t.value === equipment.type)?.label}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{equipment.location}</span>
                        </div>
                        {equipment.siteId && <div className="text-[11px] text-[#1a6fa6] mt-0.5">{sites.find(s => s.id === equipment.siteId)?.name}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${statusColors[equipment.status]}`}>
                          {equipment.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-xs">
                        {equipment.visited ? (
                          <span className="flex items-center gap-1 text-green-700">
                            <CheckCircle className="w-3 h-3" />{equipment.technicianName || 'Visité'}
                          </span>
                        ) : (
                          <span className="text-gray-400">Non visité</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {canModify && (
                            <button
                              onClick={() => handleEdit(equipment)}
                              className="text-[#1a6fa6] hover:text-[#0d4a73]"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && (
                            <button
                              onClick={() => handleDelete(equipment.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => openSignalerPanne(equipment)}
                              className="text-orange-500 hover:text-orange-700"
                              title="Signaler une panne"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && equipment.status !== 'réformé' && (
                            <button
                              onClick={() => openTransferModal(equipment)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Transférer"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && equipment.status !== 'réformé' && (
                            <button
                              onClick={() => openReformModal(equipment)}
                              className="text-gray-400 hover:text-gray-700"
                              title="Réformer (mettre au rebut)"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openDetailsModal(equipment)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Voir détails / Documents"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setQrEquipment(equipment)}
                            className="text-teal-500 hover:text-teal-700"
                            title="QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setBarcodeEquipment(equipment)}
                            className="text-purple-500 hover:text-purple-700"
                            title="Code-barres"
                          >
                            <LayoutList className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => generateEquipmentSheet(equipment)}
                            className="text-rose-500 hover:text-rose-700"
                            title="Fiche technique PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={filteredEquipments.length} page={equipPage} onChange={setEquipPage} />
            </div>
          </div>
        )}
        </>}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <button onClick={() => { setShowForm(false); resetForm(); setNewEquipDocs([]); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mr-1" title="Retour à la liste">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-[#1a6fa6]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900">{editingId !== null ? 'Modifier l\'équipement' : 'Nouvel équipement'}</h2>
                <p className="text-xs text-gray-400">{editingId !== null ? 'Modifier les informations' : 'Ajouter un équipement au parc'}</p>
              </div>
            </div>
            <div className="p-6">
                <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'équipement *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as EquipmentType })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    >
                      {equipmentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marque *</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modèle</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de série</label>
                    <input
                      type="text"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse IP</label>
                    <input
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
                    <select
                      value={formData.siteId ?? ''}
                      onChange={e => setFormData({ ...formData, siteId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    >
                      <option value="">— Sélectionner un site —</option>
                      {sites.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.city}{s.country ? `, ${s.country}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  {formData.type === 'accessoires' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seuil de stock minimum
                        <span className="ml-1 text-xs text-gray-400 font-normal">(alerte si stock ≤ seuil)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formData.minQuantity}
                        onChange={(e) => setFormData({ ...formData, minQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                        placeholder="0 = désactivé"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localisation *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="defaillant">Défaillant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date d'achat</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin de garantie</label>
                    <input
                      type="date"
                      value={formData.warranty}
                      onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dernière maintenance</label>
                    <input
                      type="date"
                      value={formData.lastMaintenance}
                      onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent"
                    />
                  </div>
                </div>


                {/* Documents à l'achat (nouveau équipement seulement) */}
                {editingId === null && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Documents d'achat (optionnel)</span>
                      <span className="text-xs text-gray-400">PDF, images — max 3 Mo chacun</span>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      <Upload className="w-4 h-4" />
                      Ajouter des fichiers
                      <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleNewEquipDocAdd} />
                    </label>
                    {newEquipDocs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {newEquipDocs.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                            <File className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-700 truncate flex-1">{d.file.name}</span>
                            <span className="text-xs text-gray-400">{formatFileSize(d.file.size)}</span>
                            <input
                              type="text"
                              placeholder="Description…"
                              value={d.description}
                              onChange={(e) => setNewEquipDocs((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                              className="text-xs border border-gray-200 rounded px-2 py-1 w-36"
                            />
                            <button onClick={() => setNewEquipDocs((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); setNewEquipDocs([]); }}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={uploadingDocs}
                    className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] disabled:opacity-60"
                  >
                    {uploadingDocs ? 'Upload…' : editingId !== null ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetailsModal && selectedEquipment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">
                  <Monitor className="w-5 h-5 text-[#1a6fa6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900 truncate">{selectedEquipment.name}</h3>
                  <p className="text-xs text-gray-400">{selectedEquipment.brand} {selectedEquipment.model}{selectedEquipment.serialNumber ? ` · ${selectedEquipment.serialNumber}` : ''}</p>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b px-4 overflow-x-auto">
                {([['info', 'Infos', Info], ['history', 'Historique', Activity], ['notes', 'Notes', MessageCircle], ['transfers', 'Transferts', ArrowRightLeft], ['documents', 'Documents', FileText]] as const).map(([tab, label, Icon]) => (
                  <button key={tab} onClick={() => {
                    setDetailsTab(tab);
                    if (tab === 'documents' && equipmentDocs.length === 0) fetchDocuments(selectedEquipment.id);
                    if (tab === 'transfers' && transferHistory.length === 0) fetchTransferHistory(selectedEquipment.id);
                    if (tab === 'notes') {
                      const saved = localStorage.getItem(`eq-notes-${selectedEquipment.id}`);
                      if (saved) setEquipmentNotes(n => ({ ...n, [selectedEquipment.id]: JSON.parse(saved) }));
                    }
                  }}
                    className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition shrink-0 ${detailsTab === tab ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">

                {/* ── Infos ── */}
                {detailsTab === 'info' && (
                  <div className="space-y-2 text-sm text-gray-700">
                    {([
                      ['Type', equipmentTypes.find((t) => t.value === selectedEquipment.type)?.label],
                      ['Quantité', String(selectedEquipment.quantity ?? 1)],
                      ['Localisation', selectedEquipment.location],
                      ['Département', selectedEquipment.department],
                      ['Statut', selectedEquipment.status],
                      ['Adresse IP', maskValue(selectedEquipment.ipAddress) || 'N/A'],
                      ['N° de série', maskValue(selectedEquipment.serialNumber) || 'N/A'],
                      ['Date d\'achat', selectedEquipment.purchaseDate || 'N/A'],
                      ['Dernière maintenance', selectedEquipment.lastMaintenance || 'N/A'],
                    ] as [string, string | undefined][]).map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <span className="font-semibold w-44 shrink-0 text-gray-600">{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                      <div className="flex gap-2">
                        <span className="font-semibold w-44 shrink-0 text-gray-600">Garantie</span>
                        <span>{selectedEquipment.warranty || 'N/A'}</span>
                      </div>
                    {/* Amortissement */}
                    {(() => {
                      const d = getDepreciation(selectedEquipment);
                      if (!d) return null;
                      const colors = { bon: 'bg-green-100 text-green-700', moyen: 'bg-yellow-100 text-yellow-700', faible: 'bg-red-100 text-red-700' };
                      return (
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-xs font-bold text-gray-600 mb-2">Amortissement ({d.age} ans)</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${d.pct > 60 ? 'bg-green-500' : d.pct > 30 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{width:`${d.pct}%`}} /></div>
                            <span className="text-sm font-bold text-gray-700 w-10 text-right">{d.pct}%</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors[d.status as keyof typeof colors]}`}>{d.status}</span>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Ping réseau */}
                    {selectedEquipment.ipAddress && (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => pingEquipment(selectedEquipment.id, selectedEquipment.ipAddress)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                          <Wifi className="w-3.5 h-3.5" /> Ping {maskValue(selectedEquipment.ipAddress)}
                        </button>
                        {pingResults[selectedEquipment.id] !== undefined && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pingResults[selectedEquipment.id] === null ? 'bg-gray-100 text-gray-500' : pingResults[selectedEquipment.id] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {pingResults[selectedEquipment.id] === null ? '⏳ Test…' : pingResults[selectedEquipment.id] ? '✓ En ligne' : '✗ Hors ligne'}
                          </span>
                        )}
                      </div>
                    )}
                    {selectedEquipment.visited && (
                      <div className="border-t pt-3 mt-3 space-y-1">
                        <div className="flex gap-2"><span className="font-semibold w-44 shrink-0 text-gray-600">Technicien</span><span>{selectedEquipment.technicianName}</span></div>
                        {selectedEquipment.visitDate && <div className="flex gap-2"><span className="font-semibold w-44 shrink-0 text-gray-600">Date visite</span><span>{new Date(selectedEquipment.visitDate).toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span></div>}
                        {selectedEquipment.interventionDetails && <div className="mt-2 p-3 bg-gray-50 rounded-lg"><p className="text-xs font-semibold text-gray-500 mb-1">Intervention</p><p>{selectedEquipment.interventionDetails}</p></div>}
                      </div>
                    )}
                    {/* Replacement info */}
                    {(() => {
                      const replacedBy = selectedEquipment.replacedById
                        ? equipments.find(e => e.id === selectedEquipment.replacedById)
                        : null;
                      const replaces = equipments.find(e => e.replacedById === selectedEquipment.id);
                      return (
                        <>
                          {selectedEquipment.status === 'réformé' && (
                            <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm">
                              <p className="font-semibold text-purple-700 flex items-center gap-1"><Archive className="w-4 h-4" /> Équipement réformé (mis au rebut)</p>
                              {replacedBy && <p className="text-purple-600 mt-1">Remplacé par : <span className="font-medium">{replacedBy.name}</span></p>}
                            </div>
                          )}
                          {replaces && (
                            <div className="mt-3 p-3 rounded-xl bg-[#e8f3fc] border border-indigo-100 text-sm">
                              <p className="text-[#155a8a]">Remplace l'ancien équipement : <span className="font-medium">{replaces.name}</span> <span className="text-indigo-400">(réformé)</span></p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {canModify && selectedEquipment.status !== 'réformé' && (
                      <div className="pt-3 border-t flex gap-2">
                        <button onClick={() => openTransferModal(selectedEquipment)} className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
                          <ArrowRightLeft className="w-4 h-4" /> Transférer
                        </button>
                        <button onClick={() => { setSelectedEquipment(null); openReformModal(selectedEquipment); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Archive className="w-4 h-4" /> Réformer
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Historique ── */}
                {detailsTab === 'history' && (() => {
                  type TimelineEvent = { date: string; label: string; detail: string; dot: string; icon: React.ReactNode };
                  const events: TimelineEvent[] = [];
                  if (selectedEquipment.purchaseDate) events.push({ date: selectedEquipment.purchaseDate, label: 'Acquisition', detail: `Mis en service${selectedEquipment.department ? ` — ${selectedEquipment.department}` : ''}`, dot: 'bg-[#e8f3fc]/20', icon: <Monitor className="w-3 h-3 text-white" /> });
                  transferHistory.forEach(ev => events.push({ date: ev.createdAt, label: 'Transfert', detail: ev.details || '—', dot: 'bg-purple-500', icon: <ArrowRightLeft className="w-3 h-3 text-white" /> }));
                  maintenanceRecords.filter(m => m.equipmentId === selectedEquipment.id).forEach(m => events.push({ date: m.openedAt, label: `Ticket #${m.id} — ${maintenanceStatusLabel[m.status] ?? m.status}`, detail: m.failureDesc || '—', dot: m.status === 'résolu' ? 'bg-green-500' : 'bg-orange-500', icon: <Wrench className="w-3 h-3 text-white" /> }));
                  visits.filter(v => v.equipmentIds?.includes(selectedEquipment.id)).forEach(v => events.push({ date: v.scheduledDate + 'T00:00:00', label: `Visite — ${v.siteName}`, detail: v.purpose || '—', dot: 'bg-blue-500', icon: <Clock className="w-3 h-3 text-white" /> }));
                  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  if (events.length === 0) return (
                    <div className="text-center py-10 text-gray-400">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucun événement enregistré.</p>
                      <p className="text-xs mt-1">Les transferts, tickets et visites apparaîtront ici.</p>
                    </div>
                  );
                  return (
                    <div className="space-y-0">
                      {events.map((ev, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full ${ev.dot} flex items-center justify-center shrink-0 mt-0.5`}>{ev.icon}</div>
                            {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1 min-h-[12px]" />}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-semibold text-gray-800">{ev.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(ev.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── Notes internes ── */}
                {detailsTab === 'notes' && (() => {
                  const notes = equipmentNotes[selectedEquipment.id] ?? (() => { try { return JSON.parse(localStorage.getItem(`eq-notes-${selectedEquipment.id}`) || '[]'); } catch { return []; } })();
                  const addNote = () => {
                    if (!noteInput.trim()) return;
                    const updated = [...notes, `${new Date().toLocaleString('fr-FR')} — ${currentUser.name}\n${noteInput.trim()}`];
                    localStorage.setItem(`eq-notes-${selectedEquipment.id}`, JSON.stringify(updated));
                    setEquipmentNotes(n => ({ ...n, [selectedEquipment.id]: updated }));
                    setNoteInput('');
                  };
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3} placeholder="Ajouter une note interne (observation, remarque technique…)"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] resize-none" />
                        <button onClick={addNote} disabled={!noteInput.trim()} className="self-end px-3 py-2 rounded-xl bg-[#1a6fa6] text-white text-sm font-medium hover:bg-[#155a8a] disabled:opacity-50">Ajouter</button>
                      </div>
                      {notes.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Aucune note pour cet équipement.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {[...notes].reverse().map((note, i) => {
                            const [header, ...body] = note.split('\n');
                            return (
                              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs text-gray-400 mb-1">{header}</p>
                                <p className="text-sm text-gray-800 whitespace-pre-line">{body.join('\n')}</p>
                                <button onClick={() => { const updated = notes.filter((_,idx) => idx !== notes.length - 1 - i); localStorage.setItem(`eq-notes-${selectedEquipment.id}`, JSON.stringify(updated)); setEquipmentNotes(n => ({...n, [selectedEquipment.id]: updated})); }} className="text-xs text-red-400 hover:text-red-600 mt-1">Supprimer</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Transferts ── */}
                {detailsTab === 'transfers' && (
                  <div>
                    {transfersLoading ? <p className="text-center py-10 text-gray-400">Chargement…</p> : transferHistory.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun transfert enregistré.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transferHistory.map((ev) => (
                          <div key={ev.id} className="flex gap-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                            <ArrowRightLeft className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-gray-800">{ev.details}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                                {ev.technician && ` · Technicien : ${ev.technician}`}
                                {ev.transferRequester && ` · Demandeur : ${ev.transferRequester}`}
                                {ev.transferResponsible && ` · Responsable : ${ev.transferResponsible}`}
                                {` · Par ${ev.userName}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Documents ── */}
                {detailsTab === 'documents' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-500">{equipmentDocs.length} document(s)</p>
                      <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-[#1a6fa6] px-3 py-1.5 text-sm text-white hover:bg-[#155a8a]">
                        <Upload className="w-4 h-4" /> Ajouter
                        <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const f of files) {
                            if (f.size > 3 * 1024 * 1024) { setToast({ message: `${f.name} dépasse 3 Mo.`, type: 'error' }); continue; }
                            const doc = await handleDocumentUpload(selectedEquipment.id, f, '');
                            if (doc) setEquipmentDocs((prev) => [...prev, doc]);
                          }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                    {docsLoading ? <p className="text-center py-10 text-gray-400">Chargement…</p> : equipmentDocs.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun document attaché.</p>
                        <p className="text-xs mt-1">Ajoutez des reçus, factures ou bons de livraison.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {equipmentDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <File className="w-5 h-5 text-indigo-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</p>
                              {doc.description && <p className="text-xs text-gray-400 italic">{doc.description}</p>}
                            </div>
                            <button onClick={() => downloadDocument(doc.id)} className="text-[#1a6fa6] hover:text-[#0d4a73] p-1" title="Télécharger">
                              <Download className="w-4 h-4" />
                            </button>
                            {canModify && (
                              <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-400 hover:text-red-600 p-1" title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end px-6 py-4 border-t">
                <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <MaintenanceModule
        onClose={() => setShowMaintenanceModule(false)}
        onUnauthorized={handleUnauthorized}
        onToast={setToast}
        onConfirm={setConfirmModal}
        equipments={equipments}
        sites={sites}
        canWrite={canWrite}
        canModify={canModify}
        currentUserName={currentUser.name}
        userAllowedSiteIds={userAllowedSiteIds}
        maintenanceRecords={maintenanceRecords}
        onRefresh={fetchMaintenance}
        onRefreshEquipment={fetchEquipments}
      />


      {/* ══ Module Licences logicielles ══════════════════════════════════ */}
      {showLicenseModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <File className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Licences logicielles</h2>
                <p className="text-white/70 text-xs">{licenses.length} licence(s) · {licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < new Date()).length} expirée(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canWrite && <button onClick={() => { setLicenseForm(defaultLicenseForm); setEditingLicenseId(null); setShowLicenseForm(true); }}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nouvelle licence
              </button>}
              <button onClick={() => setShowLicenseModule(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {/* Filtre */}
          <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Rechercher…" value={licenseFilter} onChange={e => setLicenseFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-full text-sm w-full focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {licensesLoading ? (
              <div className="text-center py-16 text-gray-400">Chargement…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {licenses.filter(l => !licenseFilter || l.name.toLowerCase().includes(licenseFilter.toLowerCase()) || l.vendor.toLowerCase().includes(licenseFilter.toLowerCase())).map(l => {
                  const expired = l.expiry_date && new Date(l.expiry_date) < new Date();
                  const expiringSoon = l.expiry_date && !expired && (new Date(l.expiry_date).getTime() - Date.now()) < 30 * 86400000;
                  const usagePct = l.seats > 0 ? Math.round(l.used_seats / l.seats * 100) : 0;
                  return (
                    <div key={l.id} className={`bg-white rounded-xl shadow-sm border p-4 ${expired ? 'border-red-200' : expiringSoon ? 'border-orange-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{l.name}</p>
                          <p className="text-xs text-gray-500">{l.vendor}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          {expired && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Expirée</span>}
                          {expiringSoon && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded">Bientôt</span>}
                        </div>
                      </div>
                      {l.license_key && <p className="text-xs text-gray-400 font-mono truncate mb-2">{l.license_key}</p>}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Sièges utilisés</span>
                          <span className="font-semibold">{l.used_seats}/{l.seats}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className={`h-1.5 rounded-full ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-orange-400' : 'bg-green-500'}`} style={{width: `${Math.min(100,usagePct)}%`}} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        {l.expiry_date && <span>Expire: {new Date(l.expiry_date).toLocaleDateString('fr-FR')}</span>}
                        {l.equipment_id && <span>#{l.equipment_id}</span>}
                      </div>
                      {canModify && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                          <button onClick={() => { setLicenseForm({ name: l.name, vendor: l.vendor, license_key: l.license_key, seats: l.seats, used_seats: l.used_seats, equipment_id: l.equipment_id, purchase_date: l.purchase_date || '', expiry_date: l.expiry_date || '', notes: l.notes }); setEditingLicenseId(l.id); setShowLicenseForm(true); }}
                            className="flex-1 text-xs text-[#1a6fa6] hover:text-[#0d4a73] font-medium flex items-center justify-center gap-1 py-1 rounded hover:bg-blue-50 transition-colors">
                            <Edit className="w-3 h-3" /> Modifier
                          </button>
                          <button onClick={() => deleteLicense(l.id)} className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1 py-1 rounded hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {licenses.length === 0 && !licensesLoading && (
                  <div className="col-span-3 text-center py-16 text-gray-400">
                    <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Aucune licence enregistrée</p>
                    {canWrite && <button onClick={() => { setLicenseForm(defaultLicenseForm); setEditingLicenseId(null); setShowLicenseForm(true); }} className="mt-3 text-sm text-[#1a6fa6] hover:underline">+ Ajouter une licence</button>}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Form modal */}
          {showLicenseForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowLicenseForm(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <h3 className="font-bold text-gray-900 mb-4">{editingLicenseId ? 'Modifier' : 'Nouvelle'} licence</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[['Nom *', 'name', 'text'], ['Éditeur', 'vendor', 'text'], ['Clé de licence', 'license_key', 'text'], ['Sièges total', 'seats', 'number'], ['Sièges utilisés', 'used_seats', 'number']].map(([label, key, type]) => (
                    <div key={key} className={key === 'license_key' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input type={type} value={(licenseForm as any)[key]} onChange={e => setLicenseForm(f => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date d'achat</label>
                    <input type="date" value={licenseForm.purchase_date} onChange={e => setLicenseForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date d'expiration</label>
                    <input type="date" value={licenseForm.expiry_date} onChange={e => setLicenseForm(f => ({ ...f, expiry_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                    <textarea rows={2} value={licenseForm.notes} onChange={e => setLicenseForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowLicenseForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
                  <button onClick={saveLicense} disabled={!licenseForm.name.trim()} className="flex-1 py-2.5 bg-[#1a6fa6] text-white rounded-xl text-sm font-semibold hover:bg-[#155a8a] disabled:opacity-50">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Module Tendances 12 mois ══════════════════════════════════════ */}
      {showTrends && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50 overflow-auto">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Tendances — 12 derniers mois</h2>
                <p className="text-white/70 text-xs">Évolution des pannes, tickets et MTTR</p>
              </div>
            </div>
            <button onClick={() => setShowTrends(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6">
            {trendsLoading ? (
              <div className="text-center py-16 text-gray-400">Chargement des tendances…</div>
            ) : trendsData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">Aucune donnée disponible</div>
            ) : (() => {
              const maxTickets = Math.max(...trendsData.map(d => d.tickets), 1);
              const maxMttr = Math.max(...trendsData.map(d => d.mttr), 1);
              const barW = 36; const gap = 8;
              const chartW = trendsData.length * (barW + gap);
              const chartH = 140;
              return (
                <div className="space-y-6">
                  {/* Tickets bar chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Tickets de maintenance ouverts</h3>
                    <p className="text-xs text-gray-400 mb-4">Nombre de tickets créés par mois</p>
                    <div className="overflow-x-auto">
                      <svg width={Math.max(chartW + 20, 400)} height={chartH + 40} style={{display:'block'}}>
                        {trendsData.map((d, i) => {
                          const bh = Math.max(4, Math.round((d.tickets / maxTickets) * chartH));
                          const x = 10 + i * (barW + gap);
                          const y = chartH - bh;
                          return (
                            <g key={i}>
                              <rect x={x} y={y} width={barW} height={bh} rx="4" fill="#1a6fa6" opacity={0.8} />
                              {d.tickets > 0 && <text x={x + barW/2} y={y - 4} textAnchor="middle" fill="#374151" fontSize="11" fontWeight="bold">{d.tickets}</text>}
                              <text x={x + barW/2} y={chartH + 16} textAnchor="middle" fill="#9ca3af" fontSize="9">{d.label}</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                  {/* MTTR chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">MTTR — Temps moyen de résolution</h3>
                    <p className="text-xs text-gray-400 mb-4">Heures moyennes par ticket résolu</p>
                    <div className="overflow-x-auto">
                      <svg width={Math.max(chartW + 20, 400)} height={chartH + 40} style={{display:'block'}}>
                        {trendsData.map((d, i) => {
                          const bh = maxMttr > 0 ? Math.max(4, Math.round((d.mttr / maxMttr) * chartH)) : 4;
                          const x = 10 + i * (barW + gap);
                          const y = chartH - bh;
                          const color = d.mttr === 0 ? '#e5e7eb' : d.mttr > maxMttr * 0.7 ? '#ef4444' : d.mttr > maxMttr * 0.4 ? '#f59e0b' : '#22c55e';
                          return (
                            <g key={i}>
                              <rect x={x} y={y} width={barW} height={bh} rx="4" fill={color} opacity={0.85} />
                              {d.mttr > 0 && <text x={x + barW/2} y={y - 4} textAnchor="middle" fill="#374151" fontSize="10" fontWeight="bold">{d.mttr}h</text>}
                              <text x={x + barW/2} y={chartH + 16} textAnchor="middle" fill="#9ca3af" fontSize="9">{d.label}</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Bon (&lt; 40%)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Moyen</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Élevé (&gt; 70%)</span>
                    </div>
                  </div>
                  {/* Summary table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Résumé mensuel</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 text-xs font-bold text-gray-500 uppercase">Mois</th>
                            <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">Tickets</th>
                            <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase">MTTR (h)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...trendsData].reverse().map((d, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 text-gray-700 font-mono">{d.label}</td>
                              <td className="py-2 text-right font-bold text-gray-900">{d.tickets}</td>
                              <td className="py-2 text-right text-gray-600">{d.mttr > 0 ? `${d.mttr}h` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══ Calendrier unifié ════════════════════════════════════════════ */}
      {showUnifiedCalendar && (() => {
        const firstDay = new Date(unifiedCalYear, unifiedCalMonth, 1).getDay();
        const daysInMonth = new Date(unifiedCalYear, unifiedCalMonth + 1, 0).getDate();
        const monthName = new Date(unifiedCalYear, unifiedCalMonth).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
        const pad = (n: number) => String(n).padStart(2, '0');
        const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m+1)}-${pad(d)}`;

        const cells: { day: number | null; events: { type: 'visit'|'maint'|'task'; label: string; color: string }[] }[] = [];
        const offset = (firstDay + 6) % 7;
        for (let i = 0; i < offset; i++) cells.push({ day: null, events: [] });
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = toDateStr(unifiedCalYear, unifiedCalMonth, d);
          const dayEvents: { type: 'visit'|'maint'|'task'; label: string; color: string }[] = [];
          visits.filter(v => v.scheduledDate === ds && v.status !== 'annulé').forEach(v =>
            dayEvents.push({ type: 'visit', label: v.siteName, color: 'bg-blue-500' }));
          maintenanceRecords.filter(m => m.openedAt && m.openedAt.slice(0,10) === ds && m.status !== 'résolu').forEach(m =>
            dayEvents.push({ type: 'maint', label: m.equipmentName || m.failureDesc || 'Maintenance', color: m.priority === 'critique' ? 'bg-red-500' : 'bg-amber-400' }));
          tasks.filter(t => t.dueDate === ds && !t.done).forEach(t =>
            dayEvents.push({ type: 'task', label: t.title, color: t.priority === 'haute' ? 'bg-red-400' : 'bg-indigo-400' }));
          cells.push({ day: d, events: dayEvents });
        }

        const today = new Date(); const isToday = (d: number) => d === today.getDate() && unifiedCalMonth === today.getMonth() && unifiedCalYear === today.getFullYear();
        return (
          <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
            <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><LayoutGrid className="w-5 h-5 text-white" /></div>
                <h2 className="text-base font-bold text-white capitalize">Calendrier unifié — {monthName}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(unifiedCalYear, unifiedCalMonth - 1); setUnifiedCalYear(d.getFullYear()); setUnifiedCalMonth(d.getMonth()); }} className="text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => { setUnifiedCalYear(today.getFullYear()); setUnifiedCalMonth(today.getMonth()); }} className="text-white/80 hover:text-white text-xs px-3 py-1 rounded hover:bg-white/10 border border-white/20">Aujourd'hui</button>
                <button onClick={() => { const d = new Date(unifiedCalYear, unifiedCalMonth + 1); setUnifiedCalYear(d.getFullYear()); setUnifiedCalMonth(d.getMonth()); }} className="text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => setShowUnifiedCalendar(false)} className="text-white/70 hover:text-white ml-2"><X className="w-5 h-5" /></button>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-gray-200 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Visites</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Maintenance</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" />Critique</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-400 inline-block" />Tâches</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-gray-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => (
                  <div key={i} className={`min-h-[80px] rounded-xl p-1.5 border ${cell.day ? (isToday(cell.day) ? 'border-[#1a6fa6] bg-[#e8f3fc]' : 'border-gray-100 bg-white hover:border-gray-200') : 'border-transparent bg-transparent'}`}>
                    {cell.day && (
                      <>
                        <p className={`text-xs font-bold mb-1 ${isToday(cell.day) ? 'text-[#1a6fa6]' : 'text-gray-700'}`}>{cell.day}</p>
                        <div className="space-y-0.5">
                          {cell.events.slice(0, 3).map((ev, j) => (
                            <div key={j} className={`${ev.color} text-white text-[10px] font-medium px-1 py-0.5 rounded truncate`}>{ev.label}</div>
                          ))}
                          {cell.events.length > 3 && <div className="text-[10px] text-gray-400 pl-1">+{cell.events.length - 3}</div>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Rapport mensuel (retiré) ══════════════════════════════════════ */}
      {false && showMonthlyReport && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMonthlyReport(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><FileText className="w-5 h-5 text-purple-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Rapport mensuel</h2>
                  <p className="text-xs text-gray-400">{new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <button onClick={() => setShowMonthlyReport(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* KPI Summary */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Synthèse du parc</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total équipements', value: kpiStats.total, color: 'text-[#1a6fa6]' },
                    { label: 'Actifs', value: kpiStats.actifs, color: 'text-green-600' },
                    { label: 'Défaillants', value: kpiStats.defaillants, color: 'text-red-600' },
                    { label: 'Tickets ouverts', value: kpiStats.ticketsOuverts, color: 'text-amber-600' },
                    { label: 'Critiques', value: kpiStats.ticketsCritiques, color: 'text-red-700' },
                    { label: 'Garanties exp.', value: kpiStats.garantiesExpirees, color: 'text-orange-600' },
                    { label: 'Visites planif.', value: kpiStats.visitesPlannifiees, color: 'text-blue-600' },
                    { label: 'Non visités', value: kpiStats.nonVisites, color: 'text-gray-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Tickets critiques */}
              {maintenanceRecords.filter(m => m.priority === 'critique' && m.status !== 'résolu').length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Tickets critiques non résolus</h3>
                  <div className="space-y-2">
                    {maintenanceRecords.filter(m => m.priority === 'critique' && m.status !== 'résolu').slice(0,5).map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{m.equipmentName}</p>
                          <p className="text-xs text-gray-500 truncate">{m.failureDesc}</p>
                        </div>
                        <span className="text-xs text-gray-400">{m.technician || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* PDF Download */}
              <div>
                <button onClick={() => {
                  const doc = new jsPDF();
                  const month = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
                  doc.setFontSize(18); doc.setTextColor(26, 111, 166);
                  doc.text(`Rapport mensuel — ${month}`, 14, 20);
                  doc.setFontSize(10); doc.setTextColor(100);
                  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 28);
                  autoTable(doc, {
                    startY: 35,
                    head: [['Indicateur', 'Valeur']],
                    body: [
                      ['Total équipements', String(kpiStats.total)],
                      ['Actifs', String(kpiStats.actifs)],
                      ['Défaillants / Maintenance', String(kpiStats.defaillants)],
                      ['Réformés', String(kpiStats.reformes)],
                      ['Tickets ouverts', String(kpiStats.ticketsOuverts)],
                      ['Tickets critiques', String(kpiStats.ticketsCritiques)],
                      ['Garanties expirées', String(kpiStats.garantiesExpirees)],
                      ['Garanties critiques (<30j)', String(kpiStats.garantiesCritiques)],
                      ['Visites planifiées', String(kpiStats.visitesPlannifiees)],
                      ['Non visités', String(kpiStats.nonVisites)],
                    ],
                    theme: 'striped',
                    headStyles: { fillColor: [26, 111, 166] },
                  });
                  const critiques = maintenanceRecords.filter(m => m.priority === 'critique' && m.status !== 'résolu');
                  if (critiques.length > 0) {
                    autoTable(doc, {
                      startY: (doc as any).lastAutoTable.finalY + 10,
                      head: [['Tickets critiques non résolus', 'Équipement', 'Technicien', 'Ouvert le']],
                      body: critiques.map(m => [m.failureDesc || '—', m.equipmentName, m.technician || '—', new Date(m.openedAt).toLocaleDateString('fr-FR')]),
                      theme: 'striped',
                      headStyles: { fillColor: [220, 38, 38] },
                    });
                  }
                  doc.save(`rapport-mensuel-${new Date().toISOString().slice(0,7)}.pdf`);
                }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a6fa6] text-white rounded-xl font-semibold hover:bg-[#155a8a] transition-colors">
                  <Download className="w-4 h-4" /> Télécharger PDF
                </button>
              </div>
              {/* Email */}
              {isAdmin && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Envoyer par email</h3>
                  <div className="flex gap-2">
                    <input type="email" value={emailReportTo} onChange={e => setEmailReportTo(e.target.value)}
                      placeholder="destinataire@email.com"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
                    <button
                      disabled={!emailReportTo || emailSending}
                      onClick={async () => {
                        setEmailSending(true);
                        try {
                          const r = await fetch(`${API_BASE_URL}/api/email/monthly-report`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ to: emailReportTo }) });
                          const d = await r.json();
                          if (d.sent) setToast({ message: 'Rapport envoyé par email', type: 'success' });
                          else setToast({ message: d.message || 'Erreur envoi email', type: 'error' });
                        } catch { setToast({ message: 'Erreur envoi email', type: 'error' }); }
                        setEmailSending(false);
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
                      {emailSending ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi…</> : <><Send className="w-3.5 h-3.5" />Envoyer</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Module Garanties ════════════════════════════════════════════ */}
      {showWarrantyModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Module Garanties</h2>
                  <p className="text-sm text-white/70">{warrantyStats.total} équipement(s) suivi(s) · {selectedSiteIds.length > 0 ? `${selectedSiteIds.length} site(s) sélectionné(s)` : 'Tous sites'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRefresh}
                  className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
                  <RefreshCcw className="w-4 h-4" /> Rafraîchir
                </button>
                <button onClick={handleExportWarrantyExcel}
                  className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button onClick={handleExportWarrantyPdf}
                  className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button onClick={() => setShowWarrantyModule(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-white/70 hover:text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Total suivis', value: warrantyStats.total, color: 'text-slate-900', bg: 'bg-white' },
                { label: 'Garantie expirée', value: warrantyStats.expired, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Critique', value: warrantyStats.critical, color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Bientôt fin', value: warrantyStats.warning, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Non renseignées', value: warrantyStats.unknown, color: 'text-gray-700', bg: 'bg-gray-50' },
              ].map((card) => (
                <div key={card.label} className={`rounded-2xl border border-gray-200 p-4 ${card.bg}`}>
                  <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">{card.label}</div>
                  <div className={`mt-3 text-3xl font-bold ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 overflow-auto flex-1 space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Filtrer par risque</p>
                      <p className="text-xs text-gray-500">Affiche les équipements selon leur statut de garantie.</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{warrantyRiskLabels[warrantyRiskFilter]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['all','expired','critical','warning','unknown','ok'] as const).map((status) => (
                      <button key={status} type="button" onClick={() => setWarrantyRiskFilter(status)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${warrantyRiskFilter === status ? 'bg-[#1a6fa6] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                        {warrantyRiskLabels[status]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Risques et actions</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(warrantyRiskExplanations).map(([status, text]) => (
                      <div key={status} className="rounded-2xl border border-gray-100 bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">{warrantyRiskLabels[status]}</div>
                        <div className="text-sm text-slate-700">{text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Synthèse par site</h3>
                      <p className="text-xs text-gray-500">Sites triés par exposition au risque.</p>
                    </div>
                    <button onClick={() => setWarrantyRiskFilter('all')} className="text-xs text-[#1a6fa6] hover:text-[#154a7d]">Réinitialiser</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                      <thead className="border-b border-gray-200 text-gray-500">
                        <tr>
                          <th className="px-3 py-3 font-semibold">Site</th>
                          <th className="px-3 py-3 font-semibold text-right">Total</th>
                          <th className="px-3 py-3 font-semibold text-right">Exp.</th>
                          <th className="px-3 py-3 font-semibold text-right">Crit.</th>
                          <th className="px-3 py-3 font-semibold text-right">Alerte</th>
                          <th className="px-3 py-3 font-semibold text-right">OK</th>
                          <th className="px-3 py-3 font-semibold text-right">N/A</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {warrantySiteStats.map((site) => (
                          <tr key={site.id} className="hover:bg-slate-50">
                            <td className="px-3 py-3 font-medium text-slate-800">{site.name}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{site.total}</td>
                            <td className="px-3 py-3 text-right text-red-600">{site.expired}</td>
                            <td className="px-3 py-3 text-right text-amber-700">{site.critical}</td>
                            <td className="px-3 py-3 text-right text-orange-600">{site.warning}</td>
                            <td className="px-3 py-3 text-right text-emerald-600">{site.ok}</td>
                            <td className="px-3 py-3 text-right text-slate-500">{site.unknown}</td>
                          </tr>
                        ))}
                        {warrantySiteStats.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-400">Aucun site sélectionné ou aucune donnée disponible.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Équipements</h3>
                  <div className="space-y-3">
                    {warrantyVisibleEquipments.slice(0, 12).map((equipment) => (
                      <div key={equipment.id} className="rounded-2xl border border-gray-100 p-3 hover:bg-slate-50 transition">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{equipment.name}</div>
                            <div className="text-xs text-gray-500">{equipment.department} · {equipment.location}</div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${equipment.warrantyClass}`}>{equipment.warrantyLabel}</span>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-2">
                          <span>{equipment.siteId ? sites.find((s) => s.id === equipment.siteId)?.name ?? 'Site inconnu' : 'Sans site'}</span>
                          <span>Type: {equipment.type}</span>
                          <span>Réf: {equipment.serialNumber || '—'}</span>
                        </div>
                      </div>
                    ))}
                    {warrantyVisibleEquipments.length === 0 && <p className="text-sm text-gray-400">Aucun équipement correspondant à ce filtre.</p>}
                    {warrantyVisibleEquipments.length > 12 && (
                      <div className="text-xs text-slate-500">Affichage des 12 premiers résultats sur {warrantyVisibleEquipments.length}.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Module Transferts ════════════════════════════════════════════ */}
      {showTransferModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-40 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Module Transferts</h2>
                <p className="text-sm text-white/70">{allTransfers.length} transfert(s) enregistré(s)</p>
              </div>
            </div>
            <button onClick={() => setShowTransferModule(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white/70 hover:text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-3 pb-0 flex gap-1 shrink-0 border-b border-gray-200 bg-white">
            <button onClick={() => setShowTransferReport(false)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!showTransferReport ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Liste des transferts
            </button>
            <button onClick={() => setShowTransferReport(true)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showTransferReport ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Rapport
            </button>
          </div>

          {/* Stats */}
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
            {[
              { label: 'Total transferts', value: allTransfers.length, color: 'purple' },
              { label: 'Ce mois', value: allTransfers.filter(t => new Date(t.createdAt) > new Date(Date.now() - 30*24*3600*1000)).length, color: 'blue' },
              { label: 'Services touchés', value: new Set(allTransfers.map(t => t.department)).size, color: 'green' },
              { label: 'Équipements déplacés', value: new Set(allTransfers.map(t => t.equipmentId)).size, color: 'orange' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {!showTransferReport && (<>
          {/* Filters — masquées pendant le formulaire */}
          {!showTransferModal && <div className="px-6 pb-4 flex flex-wrap gap-3 shrink-0">
            <select
              value={transferModuleFilter.department}
              onChange={e => setTransferModuleFilter(f => ({ ...f, department: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]"
            >
              <option value="">Tous les services</option>
              {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input type="date" value={transferModuleFilter.from}
              onChange={e => setTransferModuleFilter(f => ({ ...f, from: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
            <input type="date" value={transferModuleFilter.to}
              onChange={e => setTransferModuleFilter(f => ({ ...f, to: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
            <button onClick={() => { setTransferModuleFilter({ department: '', from: '', to: '' }); }}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" /> Réinitialiser
            </button>
            {canModify && (
              <button
                onClick={() => {
                  setTransferTarget(null);
                  setTransferForm({ toLocation: '', toDepartment: '', toSiteId: null, reason: 'Réorganisation', technicianName: '', transferRequester: '', transferResponsible: '', notes: '', transferQty: 1 });
                  setShowTransferModal(true);
                }}
                className="ml-auto px-4 py-2 bg-[#1a6fa6] text-white rounded-xl text-sm hover:bg-[#155a8a] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouveau transfert
              </button>
            )}
          </div>}

          {/* Formulaire inline dans le module */}
          {showTransferModal && (
            <div className="flex-1 overflow-auto px-6 pb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-xl">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                  <button onClick={() => { setShowTransferModal(false); setTransferTarget(null); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Retour à la liste">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Nouveau transfert</h3>
                    <p className="text-xs text-gray-400">Déplacer un équipement vers un autre site ou emplacement</p>
                  </div>
                </div>
                {/* Sélecteur d'équipement */}
                {!transferTarget ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Équipement à transférer *</label>
                    <select defaultValue="" onChange={e => {
                      const eq = equipments.find(x => x.id === Number(e.target.value)) ?? null;
                      if (eq) { setTransferTarget(eq); setTransferForm(f => ({ ...f, toLocation: eq.location, toDepartment: eq.department, toSiteId: eq.siteId ?? null })); }
                    }} className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm">
                      <option value="" disabled>— Sélectionner un équipement —</option>
                      {equipments.filter(e => e.status !== 'réformé').map(e => (
                        <option key={e.id} value={e.id}>{e.name} — {e.location} ({e.department})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mb-4 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-sm text-gray-600 space-y-0.5">
                    <p><span className="font-semibold text-gray-800">{transferTarget.name}</span></p>
                    <p>Bureau actuel : <span className="font-medium">{transferTarget.location || '—'}</span> · {transferTarget.department || '—'}</p>
                    {transferTarget.siteId && <p>Site actuel : <span className="font-medium">{sites.find(s => s.id === transferTarget.siteId)?.name ?? `Site #${transferTarget.siteId}`}</span></p>}
                  </div>
                )}
                <div className="space-y-3">
                  <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-3">
                    <label className="block text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1.5"><Globe className="w-4 h-4" />Site de destination *</label>
                    <select value={transferForm.toSiteId ?? ''} onChange={e => setTransferForm({ ...transferForm, toSiteId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm bg-white">
                      <option value="">— Sélectionner un site —</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><Building2 className="inline w-3.5 h-3.5 mr-1 text-purple-500" />Nouveau bureau / localisation *</label>
                    <input type="text" value={transferForm.toLocation} onChange={e => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Ex: Bureau 301…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau département *</label>
                    <input type="text" value={transferForm.toDepartment} onChange={e => setTransferForm({ ...transferForm, toDepartment: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Ex: Comptabilité…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raison du transfert</label>
                    <select value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm">
                      <option>Réorganisation</option><option>Transfert de site</option><option>Maintenance</option>
                      <option>Demande du service</option><option>Remplacement</option><option>Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent responsable</label>
                    <input type="text" value={transferForm.technicianName} onChange={e => setTransferForm({ ...transferForm, technicianName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du technicien" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Demandeur du transfert</label>
                    <input type="text" value={transferForm.transferRequester} onChange={e => setTransferForm({ ...transferForm, transferRequester: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du demandeur" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsable du transfert</label>
                    <input type="text" value={transferForm.transferResponsible} onChange={e => setTransferForm({ ...transferForm, transferResponsible: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du responsable" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                    <textarea value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Informations complémentaires…" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => { setShowTransferModal(false); setTransferTarget(null); }} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
                  <button onClick={handleTransfer} disabled={transferLoading || !transferTarget}
                    className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] text-sm disabled:opacity-60 flex items-center gap-2">
                    {transferLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    <ArrowRightLeft className="w-4 h-4" /> Confirmer le transfert
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {!showTransferModal && <div className="flex-1 overflow-auto px-6 pb-6">
            {transferModuleLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Chargement…</div>
            ) : allTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <ArrowRightLeft className="w-10 h-10 mb-2 opacity-30" />
                <p>Aucun transfert trouvé.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Équipement', 'Type', 'De', 'Vers', 'Technicien', 'Demandeur', 'Responsable'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allTransfers.map(ev => {
                      const { fromLocation, toLocation, fromDept, toDept, fromSiteName, toSiteName, siteChanged } = getTransferLocations(ev);
                      const locationChanged = fromLocation !== toLocation || fromDept !== toDept;
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{ev.equipmentName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {siteChanged && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  <Globe className="w-3 h-3" /> Site
                                </span>
                              )}
                              {locationChanged && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                  <Building2 className="w-3 h-3" /> Bureau
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {siteChanged && fromSiteName && <p className="text-xs text-[#1a6fa6] font-medium">{fromSiteName}</p>}
                            <span className="font-medium">{fromLocation}</span>
                            {fromDept && <span className="text-gray-400"> · {fromDept}</span>}
                          </td>
                          <td className="px-4 py-3">
                            {siteChanged && toSiteName && <p className="text-xs text-[#1a6fa6] font-medium flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{toSiteName}</p>}
                            <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                              <ArrowRightLeft className="w-3 h-3" /> {toLocation}
                            </span>
                            {toDept && <span className="text-gray-400 ml-1">· {toDept}</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{ev.technician || ev.userName}</td>
                          <td className="px-4 py-3 text-gray-600">{ev.transferRequester || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{ev.transferResponsible || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>}
          </>)}

          {/* Rapport transferts */}
          {showTransferReport && (() => {
            const byDestDept: Record<string, number> = {};
            const byType: Record<string, number> = {};
            const byTech: Record<string, number> = {};
            allTransfers.forEach(ev => {
              const { toDept } = getTransferLocations(ev);
              const dept = toDept || 'Non défini';
              byDestDept[dept] = (byDestDept[dept] ?? 0) + 1;
              const t = ev.equipmentType || 'Autre';
              byType[t] = (byType[t] ?? 0) + 1;
              const tech = ev.technician || ev.userName || 'Inconnu';
              byTech[tech] = (byTech[tech] ?? 0) + 1;
            });
            const thisMonth = allTransfers.filter(t => new Date(t.createdAt) > new Date(Date.now() - 30*24*3600*1000)).length;
            const maxDept = Math.max(...Object.values(byDestDept), 1);
            const maxType = Math.max(...Object.values(byType), 1);
            const exportTransferExcel = async () => {
              const sheets = [];
              sheets.push({ name: 'Par service', rows: Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([dept, cnt]) => ({ 'Service destination': dept, Transferts: cnt })) });
              sheets.push({ name: 'Par type', rows: Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, cnt]) => ({ 'Type équipement': type, Transferts: cnt })) });
              sheets.push({ name: 'Par technicien', rows: Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([tech, cnt]) => ({ Technicien: tech, Transferts: cnt })) });
              sheets.push({ name: 'Tous les transferts', rows: allTransfers.map(ev => { const { fromDept, toDept } = getTransferLocations(ev); return { Équipement: ev.equipmentName, Type: ev.equipmentType, 'Service source': fromDept || '—', 'Service destination': toDept || '—', Technicien: ev.technician || ev.userName, Demandeur: ev.transferRequester || '—', Responsable: ev.transferResponsible || '—', Date: new Date(ev.createdAt).toLocaleDateString('fr-FR') }; }) });
              await ExportHelpers.exportMultiSheetXlsx(sheets, `rapport-transferts-${Date.now()}.xlsx`);
            };

            const exportTransferPdf = () => {
              const doc = new jsPDF({ orientation: 'landscape' });
              doc.setFontSize(16); doc.text('Rapport Transferts', 14, 16);
              doc.setFontSize(10); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${allTransfers.length} transferts`, 14, 23);
              doc.setFontSize(12); doc.text('Par service destination', 14, 32);
              autoTable(doc, {
                startY: 35,
                head: [['Service destination', 'Transferts']],
                body: Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([d,c]) => [d,c]),
                theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
              });
              const y1 = (doc as any).lastAutoTable.finalY + 8;
              doc.setFontSize(12); doc.text("Par type d'équipement", 14, y1);
              autoTable(doc, {
                startY: y1 + 3,
                head: [["Type d'équipement", 'Transferts']],
                body: Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,c]) => [t,c]),
                theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
              });
              const y2 = (doc as any).lastAutoTable.finalY + 8;
              if (y2 < 180) {
                doc.setFontSize(12); doc.text('Par technicien', 14, y2);
                autoTable(doc, {
                  startY: y2 + 3,
                  head: [['Technicien', 'Transferts']],
                  body: Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([t,c]) => [t,c]),
                  theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
                });
              }
              doc.save(`rapport-transferts-${Date.now()}.pdf`);
            };

            return (
              <div className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-6">
                {/* Boutons export */}
                <div className="flex justify-end gap-2">
                  <button onClick={exportTransferExcel}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                    <Download className="w-4 h-4 text-green-600" /> Excel
                  </button>
                  <button onClick={exportTransferPdf}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                    <Download className="w-4 h-4 text-red-500" /> PDF
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total transferts', value: allTransfers.length, color: 'text-purple-700' },
                    { label: 'Ce mois', value: thisMonth, color: 'text-blue-600' },
                    { label: 'Services destination', value: Object.keys(byDestDept).length, color: 'text-green-600' },
                    { label: 'Équipements déplacés', value: new Set(allTransfers.map(t => t.equipmentId)).size, color: 'text-orange-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par service destination</h3>
                    <div className="space-y-2">
                      {Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([dept, cnt]) => (
                        <div key={dept} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 truncate w-36 shrink-0">{dept}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-purple-400" style={{width:`${(cnt/maxDept)*100}%`}}/>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-6 text-right">{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par type d'équipement</h3>
                    <div className="space-y-2">
                      {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, cnt]) => (
                        <div key={type} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 capitalize w-28 shrink-0">{type}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full bg-blue-400" style={{width:`${(cnt/maxType)*100}%`}}/>
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-6 text-right">{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-3">Par technicien</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([tech, cnt]) => (
                      <div key={tech} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-700 font-medium">{tech}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-bold">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-3">10 derniers transferts</h3>
                  <div className="space-y-2">
                    {allTransfers.slice(0,10).map(ev => {
                      const { fromDept, toDept } = getTransferLocations(ev);
                      return (
                        <div key={ev.id} className="flex items-center gap-3 text-sm border-b border-gray-50 pb-2">
                          <span className="text-xs text-gray-400 shrink-0 w-20">{new Date(ev.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>
                          <span className="font-medium text-gray-800 truncate flex-1">{ev.equipmentName}</span>
                          <span className="text-xs text-gray-500 shrink-0">{fromDept || '—'} → {toDept || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ Module Gestion des Sites ════════════════════════════════════ */}
      {showSiteModal && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-50 bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Gestion des sites</h2>
                  <p className="text-sm text-white/70">Configurer les sites et localisations</p>
                </div>
              </div>
              <button onClick={() => setShowSiteModal(false)} className="p-2 rounded-lg hover:bg-white/10 shrink-0" title="Fermer">
                <X className="w-5 h-5 text-white/70 hover:text-white" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Liste des sites */}
              <div className="flex-1 overflow-y-auto p-4 border-r border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{sites.length} site(s)</p>
                {sites.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun site créé.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {sites.map(site => (
                    <div key={site.id} className={`rounded-xl border p-3 transition-colors cursor-pointer ${editingSiteId === site.id ? 'border-indigo-400 bg-[#e8f3fc]' : 'border-gray-100 hover:bg-gray-50'}`}
                      onClick={() => { setEditingSiteId(site.id); setSiteForm({ name: site.name, city: site.city, country: site.country, address: site.address, description: site.description, latitude: site.latitude != null ? String(site.latitude) : '', longitude: site.longitude != null ? String(site.longitude) : '', email: site.email || '', phone: site.phone || '' }); }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{site.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{site.city}{site.country ? `, ${site.country}` : ''}
                          </p>
                          {site.address && <p className="text-xs text-gray-400 mt-0.5">{site.address}</p>}
                          {site.email && <p className="text-xs text-gray-400 mt-0.5">{site.email}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[#1a6fa6] font-medium">{site.equipmentCount} équip.</span>
                          <button onClick={e => { e.stopPropagation(); setEditingSiteId(site.id); setSiteForm({ name: site.name, city: site.city, country: site.country, address: site.address, description: site.description, latitude: site.latitude != null ? String(site.latitude) : '', longitude: site.longitude != null ? String(site.longitude) : '', email: site.email || '', phone: site.phone || '' }); }}
                            className="text-gray-400 hover:text-[#1a6fa6]" title="Modifier">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteSite(site.id); }}
                            className="text-red-400 hover:text-red-600" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulaire */}
              <div className="w-full md:w-80 p-4 shrink-0 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {editingSiteId ? 'Modifier le site' : 'Nouveau site'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom du site *</label>
                    <input type="text" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Siège Paris" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                      <input type="text" value={siteForm.city} onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Paris" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Pays</label>
                      <input type="text" value={siteForm.country} onChange={e => setSiteForm(f => ({ ...f, country: e.target.value }))}
                        placeholder="France" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                    <input type="text" value={siteForm.address} onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="12 rue de la Paix" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
                      <input type="text" value={siteForm.latitude} onChange={e => setSiteForm(f => ({ ...f, latitude: e.target.value }))}
                        placeholder="48.8566" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
                      <input type="text" value={siteForm.longitude} onChange={e => setSiteForm(f => ({ ...f, longitude: e.target.value }))}
                        placeholder="2.3522" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={siteForm.email} onChange={e => setSiteForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="contact@exemple.fr" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                      <input type="text" value={siteForm.phone} onChange={e => setSiteForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+33 1 23 45 67 89" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={2} value={siteForm.description} onChange={e => setSiteForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Informations complémentaires…" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {editingSiteId && (
                      <button onClick={() => { setEditingSiteId(null); setSiteForm(defaultSiteForm); }}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        Annuler
                      </button>
                    )}
                    <button onClick={handleSaveSite} disabled={siteLoading || !siteForm.name.trim()}
                      className="flex-1 py-2 rounded-xl bg-[#1a6fa6] text-white text-sm font-medium hover:bg-[#155a8a] disabled:opacity-50 flex items-center justify-center gap-2">
                      {siteLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {editingSiteId ? 'Enregistrer' : 'Créer le site'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* ══ Modale Réforme ═══════════════════════════════════════════════ */}
      {showReformModal && reformTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReformModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5 text-[#1a6fa6]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900">Réformer l'équipement</h2>
                <p className="text-xs text-gray-400 truncate">{reformTarget.name}</p>
              </div>
              <button onClick={() => setShowReformModal(false)} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                {(reformTarget.quantity ?? 1) > 1 && reformForm.reformQty < (reformTarget.quantity ?? 1)
                  ? <><strong>{reformForm.reformQty}</strong> unité(s) seront réformées. Il restera <strong>{(reformTarget.quantity ?? 1) - reformForm.reformQty}</strong> unité(s) en stock.</>
                  : <>Cet équipement sera marqué comme <strong>réformé (mis au rebut)</strong> et ne pourra plus être transféré ni mis en maintenance.</>
                }
              </div>

              {(reformTarget.quantity ?? 1) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à réformer <span className="text-gray-400 font-normal">(stock : {reformTarget.quantity})</span>
                  </label>
                  <input type="number" min={1} max={reformTarget.quantity}
                    value={reformForm.reformQty}
                    onChange={e => setReformForm(f => ({ ...f, reformQty: Math.min(Math.max(1, parseInt(e.target.value) || 1), reformTarget.quantity ?? 1) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison de la réforme *</label>
                <select value={reformForm.reason} onChange={e => setReformForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
                  <option value="">— Sélectionner —</option>
                  <option>Fin de vie / obsolescence</option>
                  <option>Défaillance irréparable</option>
                  <option>Casse / sinistre</option>
                  <option>Vol / perte</option>
                  <option>Remplacement planifié</option>
                  <option>Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remplacé par un équipement existant</label>
                <select value={reformForm.replacedById ?? ''} onChange={e => setReformForm(f => ({ ...f, replacedById: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
                  <option value="">— Aucun remplacement ou non encore enregistré —</option>
                  {equipments.filter(e => e.id !== reformTarget.id && e.status !== 'réformé').map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes complémentaires</label>
                <textarea rows={2} value={reformForm.notes} onChange={e => setReformForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Informations supplémentaires…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowReformModal(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
              <button onClick={handleReform} disabled={reformLoading || !reformForm.reason}
                className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] text-sm disabled:opacity-50 flex items-center gap-2">
                {reformLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Archive className="w-4 h-4" /> Confirmer la réforme
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Warranty renewal module */}
      {showWarrantyRenewModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Renouvellement de garantie</h2>
                <p className="text-sm text-white/70">Prolonger la garantie d'un équipement</p>
              </div>
            </div>
            <button onClick={() => setShowWarrantyRenewModule(false)}
              className="text-white/70 hover:text-white p-2"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Rechercher un équipement par nom, marque ou modèle…"
                  value={warrantyRenewSearch}
                  onChange={e => setWarrantyRenewSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
              </div>
              {/* Equipment list */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {equipments
                    .filter(e => {
                      if (!warrantyRenewSearch.trim()) return true;
                      const q = warrantyRenewSearch.toLowerCase();
                      return e.name.toLowerCase().includes(q) || e.brand?.toLowerCase().includes(q) || e.model?.toLowerCase().includes(q) || e.serialNumber?.toLowerCase().includes(q);
                    })
                    .slice(0, 50)
                    .map(eq => {
                      const wInfo = getWarrantyInfo(eq.warranty);
                      const isRenewing = warrantyRenewEquipId === eq.id;
                      return (
                        <div key={eq.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            {getTypeIcon(eq.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{eq.name}</p>
                            <p className="text-xs text-gray-400 truncate">{eq.brand} {eq.model} · {eq.serialNumber || 'N/A'}</p>
                          </div>
                          <div className="shrink-0 text-right min-w-[130px]">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${wInfo ? wInfo.color : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {wInfo ? wInfo.label : 'Non renseignée'}
                            </span>
                          </div>
                          {isRenewing ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <input type="date" value={warrantyRenewDate}
                                onChange={e => setWarrantyRenewDate(e.target.value)}
                                className="w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                              <button onClick={() => renewWarranty(eq.id, warrantyRenewDate)} disabled={!warrantyRenewDate || warrantyRenewSaving}
                                className="px-3 py-1.5 bg-[#1a6fa6] text-white rounded-lg text-xs font-medium hover:bg-[#155a8a] disabled:opacity-50 transition-colors">
                                {warrantyRenewSaving ? '…' : 'Confirmer'}
                              </button>
                              <button onClick={() => { setWarrantyRenewEquipId(null); setWarrantyRenewDate(''); }}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setWarrantyRenewEquipId(eq.id); setWarrantyRenewDate(eq.warranty || ''); }}
                              className="shrink-0 px-3 py-1.5 bg-[#e8f3fc] text-[#1a6fa6] rounded-lg text-xs font-medium hover:bg-[#d0e6f7] transition-colors">
                              Renouveler
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {equipments.filter(e => {
                    if (!warrantyRenewSearch.trim()) return true;
                    const q = warrantyRenewSearch.toLowerCase();
                    return e.name.toLowerCase().includes(q) || e.brand?.toLowerCase().includes(q) || e.model?.toLowerCase().includes(q) || e.serialNumber?.toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">Aucun équipement trouvé.</div>
                  )}
                </div>
              </div>
              {equipments.filter(e => {
                if (!warrantyRenewSearch.trim()) return true;
                const q = warrantyRenewSearch.toLowerCase();
                return e.name.toLowerCase().includes(q) || e.brand?.toLowerCase().includes(q) || e.model?.toLowerCase().includes(q) || e.serialNumber?.toLowerCase().includes(q);
              }).length > 50 && (
                <p className="text-xs text-gray-400 text-center">Affichage des 50 premiers résultats. Utilisez la recherche pour préciser.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer form inline (depuis la liste équipements) ──────────── */}
      {showTransferModal && !showTransferModule && (
        <div className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <button onClick={() => { setShowTransferModal(false); setTransferTarget(null); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mr-1" title="Retour à la liste">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900">Transfert d'équipement</h2>
              <p className="text-xs text-gray-400">Déplacer vers un autre site ou emplacement</p>
            </div>
          </div>
          <div className="p-6">

            {/* Sélecteur d'équipement (quand ouvert depuis le module) */}
            {!transferTarget ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Équipement à transférer *</label>
                <select
                  defaultValue=""
                  onChange={e => {
                    const eq = equipments.find(x => x.id === Number(e.target.value)) ?? null;
                    if (eq) {
                      setTransferTarget(eq);
                      setTransferForm(f => ({ ...f, toLocation: eq.location, toDepartment: eq.department, toSiteId: eq.siteId ?? null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm"
                >
                  <option value="" disabled>— Sélectionner un équipement —</option>
                  {equipments.filter(e => e.status !== 'réformé').map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.location} ({e.department})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-4 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-sm text-gray-600 space-y-0.5">
                <p><span className="font-semibold text-gray-800">{transferTarget.name}</span></p>
                <p>Bureau actuel : <span className="font-medium">{transferTarget.location || '—'}</span> · {transferTarget.department || '—'}</p>
                {transferTarget.siteId && <p>Site actuel : <span className="font-medium">{sites.find(s => s.id === transferTarget.siteId)?.name ?? `Site #${transferTarget.siteId}`}</span></p>}
              </div>
            )}

            <div className="space-y-3">
              {/* ── Site destination ── */}
              <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-3">
                <label className="block text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />Site de destination *
                </label>
                {sites.length === 0 ? (
                  <p className="text-xs text-purple-500 italic">Aucun site configuré — configurez des sites dans le menu Administration.</p>
                ) : (
                  <select value={transferForm.toSiteId ?? ''}
                    onChange={e => setTransferForm({ ...transferForm, toSiteId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm bg-white">
                    <option value="">— Sélectionner un site —</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}{s.country ? `, ${s.country}` : ''}</option>
                    ))}
                  </select>
                )}
                {transferForm.toSiteId && (() => {
                  const dest = sites.find(s => s.id === transferForm.toSiteId);
                  const src = transferTarget ? sites.find(s => s.id === transferTarget.siteId) : null;
                  return dest ? (
                    <p className="text-xs text-purple-600 mt-1.5 font-medium">
                      {src ? `${src.name}` : 'Sans site'} → {dest.name}
                    </p>
                  ) : null;
                })()}
              </div>
              {/* ── Bureau / localisation ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="inline w-3.5 h-3.5 mr-1 text-purple-500" />Nouveau bureau / localisation *
                </label>
                <input type="text" value={transferForm.toLocation}
                  onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Ex: Bureau 301, Salle serveurs…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau département *</label>
                <input type="text" value={transferForm.toDepartment}
                  onChange={(e) => setTransferForm({ ...transferForm, toDepartment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Ex: Comptabilité, RH…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison du transfert</label>
                <select value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm">
                  <option>Réorganisation</option>
                  <option>Transfert de site</option>
                  <option>Maintenance</option>
                  <option>Demande du service</option>
                  <option>Remplacement</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent responsable</label>
                <input type="text" value={transferForm.technicianName}
                  onChange={(e) => setTransferForm({ ...transferForm, technicianName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Nom du technicien" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Demandeur du transfert</label>
                <input type="text" value={transferForm.transferRequester}
                  onChange={(e) => setTransferForm({ ...transferForm, transferRequester: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Nom du demandeur" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable du transfert</label>
                <input type="text" value={transferForm.transferResponsible}
                  onChange={(e) => setTransferForm({ ...transferForm, transferResponsible: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Nom du responsable" />
              </div>
              {transferTarget && (transferTarget.quantity ?? 1) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à transférer <span className="text-gray-400 font-normal">(stock : {transferTarget.quantity})</span>
                  </label>
                  <input type="number" min={1} max={transferTarget.quantity}
                    value={transferForm.transferQty}
                    onChange={e => setTransferForm({ ...transferForm, transferQty: Math.min(Math.max(1, parseInt(e.target.value) || 1), transferTarget.quantity ?? 1) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm" />
                  {transferForm.transferQty < (transferTarget.quantity ?? 1) && (
                    <p className="text-xs text-purple-600 mt-1">Transfert partiel — {transferTarget.quantity - transferForm.transferQty} unité(s) resteront sur le site actuel.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent text-sm"
                  placeholder="Informations complémentaires…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
              <button onClick={handleTransfer} disabled={transferLoading || !transferTarget}
                className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] text-sm disabled:opacity-60 flex items-center gap-2">
                {transferLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <ArrowRightLeft className="w-4 h-4" /> Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportsModule
        onClose={() => setShowReportsModal(false)}
        equipments={equipments}
        isAdmin={isAdmin}
        onUnauthorized={handleUnauthorized}
        userAllowedSiteIds={userAllowedSiteIds}
      />


      <MonitoringModule
        onClose={() => setShowMonitoringModal(false)}
        onUnauthorized={handleUnauthorized}
      />


      <UsersModule
        userAccounts={userAccounts}
        sites={sites}
        currentUserId={currentUser.id}
        onClose={() => setShowUserModal(false)}
        onRefresh={fetchUsers}
        onToast={setToast}
        onUnauthorized={handleUnauthorized}
      />



      <ActivityLogModule
        onClose={() => setShowActivityLog(false)}
        userAccounts={userAccounts}
      />


      <VisitsModule
        visits={visits}
        sites={sites}
        equipments={equipments}
        maintenanceRecords={maintenanceRecords}
        canWrite={canWrite}
        canModify={canModify}
        userName={currentUser.name}
        userAllowedSiteIds={userAllowedSiteIds}
        onClose={() => setShowVisitModule(false)}
        onUpdateVisits={(data) => setVisits(data)}
        onRefreshMaintenance={() => fetchMaintenance()}
        onToast={setToast}
      />


      {/* ══ Chat ════════════════════════════════════════════════════════════════ */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowChatModal(false)} />

          <div className="relative flex bg-white shadow-2xl w-full max-w-3xl" style={{height:'100vh'}}>

            {/* ── Sidebar ───────────────────────────────────────────────────── */}
            <div className="w-60 shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200">
                <MessageCircle className="w-5 h-5 text-[#1a6fa6]" />
                <h3 className="font-bold text-gray-900 flex-1">Messagerie</h3>
              </div>

              {/* Global */}
              <button
                onClick={() => openChatConversation('global')}
                className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 transition-colors ${chatActiveGroup == null && chatConversation === 'global' ? 'bg-[#e8f3fc] border-r-2 border-[#1a6fa6]' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-[#cfe2ff] flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-[#1a6fa6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Chat global</p>
                  <p className="text-xs text-gray-400 truncate">Tous les utilisateurs</p>
                </div>
                {chatUnread.global > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {Math.min(9, chatUnread.global)}
                  </span>
                )}
              </button>

              {/* Groups section */}
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Groupes</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="text-[#1a6fa6] hover:text-[#0d4a73] text-xs font-semibold"
                    title="Créer un groupe"
                  >+ Nouveau</button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto">
                {chatGroups.length === 0 && (
                  <p className="px-4 py-2 text-xs text-gray-400 italic">Aucun groupe</p>
                )}
                {chatGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => openGroupConversation(g.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-gray-100 transition-colors ${chatActiveGroup === g.id ? 'bg-[#e8f3fc] border-r-2 border-[#1a6fa6]' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-purple-600 font-bold text-sm">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                      <p className="text-xs text-gray-400">{g.member_ids.length} membres</p>
                    </div>
                    {chatUnread.groups[g.id] > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {Math.min(9, chatUnread.groups[g.id])}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* DMs section */}
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Messages privés</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => openChatConversation(u.id)}
                    className={`flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-100 transition-colors ${chatActiveGroup == null && chatConversation === u.id ? 'bg-[#e8f3fc] border-r-2 border-[#1a6fa6]' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 text-white text-sm font-bold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                    </div>
                    {chatUnread.dms[u.id] > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {Math.min(9, chatUnread.dms[u.id])}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Messages area ─────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white shrink-0">
                {chatActiveGroup != null
                  ? <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                      {(chatGroups.find(g => g.id === chatActiveGroup)?.name ?? 'G').charAt(0).toUpperCase()}
                    </div>
                  : chatConversation === 'global'
                    ? <div className="w-9 h-9 rounded-full bg-[#cfe2ff] flex items-center justify-center"><Globe className="w-5 h-5 text-[#1a6fa6]" /></div>
                    : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {(chatUsers.find(u => u.id === chatConversation)?.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {chatActiveGroup != null
                      ? chatGroups.find(g => g.id === chatActiveGroup)?.name ?? '—'
                      : chatConversation === 'global'
                        ? 'Chat global'
                        : chatUsers.find(u => u.id === chatConversation)?.name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {chatActiveGroup != null
                      ? `Groupe · ${chatGroups.find(g => g.id === chatActiveGroup)?.member_ids.length ?? 0} membres`
                      : chatConversation === 'global'
                        ? 'Canal partagé — visible par tous'
                        : 'Conversation privée'}
                  </p>
                </div>
                <button onClick={() => setShowChatModal(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {chatLoading && (
                  <div className="text-center py-10 text-gray-400 text-sm">Chargement…</div>
                )}
                {!chatLoading && chatMessages.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Aucun message pour l'instant.</p>
                    <p className="text-xs mt-1">Soyez le premier à écrire !</p>
                  </div>
                )}
                {chatMessages.map(msg => {
                  const isOwn = msg.senderId === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      {!isOwn && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {msg.senderName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`max-w-xs lg:max-w-sm flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {!isOwn && (
                          <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.senderName}</span>
                        )}
                        <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isOwn ? 'bg-[#1a6fa6] text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 mx-1">
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
                <form onSubmit={handleSendChatMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder={
                      chatActiveGroup != null
                        ? `Message dans ${chatGroups.find(g => g.id === chatActiveGroup)?.name ?? 'le groupe'}…`
                        : chatConversation === 'global'
                          ? 'Message au canal global…'
                          : `Message privé à ${chatUsers.find(u => u.id === chatConversation)?.name ?? ''}…`
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] focus:bg-white transition-colors"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || chatSending}
                    className="w-10 h-10 rounded-full bg-[#1a6fa6] text-white flex items-center justify-center hover:bg-[#155a8a] disabled:opacity-40 transition-colors shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Create Group Modal ══════════════════════════════════════════════════ */}
      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium text-white transition-all ${
            toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-emerald-500' : 'bg-[#e8f3fc]/20'
          }`}
        >
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Confirm dialog ──────────────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-gray-800 font-medium mb-6 leading-snug">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >Annuler</button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 text-sm font-medium"
              >Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRatingModal && selectedMaintenance && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRatingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-gray-800 mb-2">Noter le technicien</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedMaintenance.technician || 'Technicien'}</p>
            <div className="flex justify-center gap-1 mb-4">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRatingValue(n)}
                  className={`w-10 h-10 rounded-full text-xl transition ${n <= ratingValue ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {n <= ratingValue ? '★' : '☆'}
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={2}
              placeholder="Commentaire (optionnel)…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRatingModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium">
                Annuler
              </button>
              <button onClick={async () => {
                const r = await fetch(`${API_BASE_URL}/api/maintenance/${selectedMaintenance.id}/rate`, {
                  method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ rating: ratingValue, reviewComment: reviewComment })
                });
                if (r.ok) {
                  const u = await r.json();
                  setMaintenanceRecords(p => p.map(m => m.id === u.id ? u : m));
                  setSelectedMaintenance(u);
                  setShowRatingModal(false);
                }
              }}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 text-sm font-medium">
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateGroup(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Créer un groupe</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du groupe</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Ex: Équipe technique…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Membres</label>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                  {chatUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newGroupMembers.includes(u.id)}
                        onChange={e => setNewGroupMembers(prev =>
                          e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                        )}
                        className="rounded text-[#1a6fa6]"
                      />
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {newGroupMembers.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{newGroupMembers.length} membre(s) sélectionné(s)</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setNewGroupMembers([]); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >Annuler</button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0 || groupCreating}
                  className="flex-1 px-4 py-2 bg-[#1a6fa6] text-white rounded-lg text-sm font-medium hover:bg-[#155a8a] disabled:opacity-40"
                >{groupCreating ? 'Création…' : 'Créer le groupe'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

      {/* ══ Modal QR Code ══════════════════════════════════════════════════════ */}
      {qrEquipment && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setQrEquipment(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-[#e8f3fc] flex items-center justify-center">
                <QrCode className="w-5 h-5 text-[#1a6fa6]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">{qrEquipment.name}</h3>
                <p className="text-xs text-gray-400">{qrEquipment.brand} {qrEquipment.model}</p>
              </div>
              <button onClick={() => setQrEquipment(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-white rounded-xl border-2 border-gray-100" id="qr-print-area">
              <QRCodeSVG
                value={JSON.stringify({ id: qrEquipment.id, name: qrEquipment.name, sn: qrEquipment.serialNumber, type: qrEquipment.type })}
                size={180}
                level="M"
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-mono">S/N : {qrEquipment.serialNumber || '—'}</p>
              <p className="text-xs text-gray-400">{qrEquipment.location} — {qrEquipment.department}</p>
            </div>
            <button onClick={() => {
              const area = document.getElementById('qr-print-area');
              if (!area) return;
              const w = window.open('', '_blank');
              if (!w) return;
              const doc = w.document;
              const html = doc.createElement('html');
              const head = doc.createElement('head');
              const title = doc.createElement('title');
              title.textContent = 'QR - ' + qrEquipment.name;
              head.appendChild(title);
              const body = doc.createElement('body');
              body.style.cssText = 'display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;';
              body.appendChild(area.cloneNode(true));
              const p = doc.createElement('p');
              p.style.cssText = 'margin-top:12px;font-size:13px;color:#555';
              p.textContent = qrEquipment.name + ' \u00B7 ' + (qrEquipment.serialNumber || '');
              body.appendChild(p);
              html.appendChild(head);
              html.appendChild(body);
              doc.appendChild(html);
              doc.close();
              w.print();
            }}
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Imprimer / Télécharger
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal Import équipements ══════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-[#e8f3fc] flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#1a6fa6]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">Importer des équipements</h3>
                <p className="text-xs text-gray-400">Fichier Excel (.xlsx) ou CSV — colonnes : nom, type, marque, modèle, n° série, IP, localisation, service, statut, date achat</p>
              </div>
              <button onClick={downloadCsvTemplate}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1a6fa6] border border-[#1a6fa6]/30 px-3 py-1.5 rounded-lg hover:bg-[#e8f3fc] transition-colors mr-1" title="Télécharger le modèle CSV">
                <Download className="w-3.5 h-3.5" /> Template CSV
              </button>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            {/* Drop zone */}
            <div className="px-6 pt-5 pb-3">
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                <Upload className="w-7 h-7 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500 font-medium">Cliquer pour choisir un fichier</span>
                <span className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv</span>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportError('');
                  const reader = new FileReader();
                  reader.onload = ev => {
                    try {
                      const wb = XLSX.read(ev.target?.result, { type: 'array' });
                      const ws = wb.Sheets[wb.SheetNames[0]];
                      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
                      const colMap: Record<string, keyof Equipment> = {
                        'nom': 'name', 'name': 'name',
                        'type': 'type',
                        'marque': 'brand', 'brand': 'brand',
                        'modèle': 'model', 'modele': 'model', 'model': 'model',
                        'n° série': 'serialNumber', 'serial': 'serialNumber', 'sn': 'serialNumber', 'serialnumber': 'serialNumber',
                        'ip': 'ipAddress', 'ipaddress': 'ipAddress',
                        'localisation': 'location', 'location': 'location',
                        'service': 'department', 'department': 'department',
                        'statut': 'status', 'status': 'status',
                        'date achat': 'purchaseDate', 'purchasedate': 'purchaseDate',
                      };
                      const rows: Partial<Equipment>[] = raw.map(r => {
                        const eq: Partial<Equipment> = { status: 'actif', quantity: 1 };
                        Object.entries(r).forEach(([k, v]) => {
                          const mapped = colMap[k.toLowerCase().trim()];
                          if (mapped) (eq as any)[mapped] = String(v);
                        });
                        return eq;
                      }).filter(r => r.name);
                      setImportRows(rows);
                      if (rows.length === 0) setImportError('Aucune ligne valide trouvée. Vérifiez que la colonne "nom" existe.');
                    } catch { setImportError('Erreur de lecture du fichier.'); }
                  };
                  reader.readAsArrayBuffer(file);
                  e.target.value = '';
                }} />
              </label>
              {importError && <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">{importError}</p>}
            </div>
            {/* Preview */}
            {importRows.length > 0 && (
              <div className="flex-1 overflow-auto px-6 pb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{importRows.length} équipement(s) détecté(s) — aperçu :</p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50"><tr>
                      {['Nom','Type','Marque','Modèle','N° Série','IP','Localisation','Service','Statut'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {importRows.slice(0,10).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600">{r.type || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.brand || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.model || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{r.serialNumber || '—'}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono">{r.ipAddress || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.location || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{r.department || '—'}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{r.status || 'actif'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importRows.length > 10 && <p className="text-center text-xs text-gray-400 py-2">… et {importRows.length - 10} autre(s)</p>}
                </div>
              </div>
            )}
            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowImportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
              <button
                disabled={importRows.length === 0 || importLoading}
                onClick={async () => {
                  setImportLoading(true);
                  let ok = 0; let fail = 0;
                  for (const row of importRows) {
                    try {
                      const res = await fetch('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ name: row.name || '', type: row.type || 'autre', brand: row.brand || '', model: row.model || '', serialNumber: row.serialNumber || '', ipAddress: row.ipAddress || '', location: row.location || '', department: row.department || '', status: row.status || 'actif', purchaseDate: row.purchaseDate || '', warranty: '', lastMaintenance: '', visited: false, technicianName: '', visitDate: '', interventionDetails: '', quantity: 1 }) });
                      if (res.ok) ok++; else fail++;
                    } catch { fail++; }
                  }
                  setImportLoading(false);
                  setShowImportModal(false);
                  handleRefresh();
                  alert(`Import terminé — ${ok} ajouté(s)${fail > 0 ? `, ${fail} échec(s)` : ''}.`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {importLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Import en cours…</> : <><Upload className="w-4 h-4" />Importer {importRows.length > 0 ? `${importRows.length} ligne(s)` : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Barre flottante comparaison ═══════════════════════════════════════ */}
      {compareIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 bg-[#1a6fa6] text-white rounded-2xl shadow-2xl px-5 py-3">
          <span className="text-sm font-semibold">{compareIds.size} équipement{compareIds.size > 1 ? 's' : ''} sélectionné{compareIds.size > 1 ? 's' : ''}</span>
          {compareIds.size >= 2 && (
            <button onClick={() => setShowCompareModal(true)}
              className="bg-white text-[#1a6fa6] text-sm font-bold px-4 py-1.5 rounded-xl hover:bg-blue-50 transition-colors">
              Comparer
            </button>
          )}
          <button onClick={() => setCompareIds(new Set())} className="text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══ Modal comparaison équipements ═════════════════════════════════════ */}
      {showCompareModal && (() => {
        const items = equipments.filter(e => compareIds.has(e.id));
        const fields: { key: keyof Equipment; label: string }[] = [
          { key: 'type',        label: 'Type' },
          { key: 'brand',       label: 'Marque' },
          { key: 'model',       label: 'Modèle' },
          { key: 'serialNumber',label: 'Numéro de série' },
          { key: 'status',      label: 'Statut' },
          { key: 'location',    label: 'Localisation' },
          { key: 'department',  label: 'Département' },
          { key: 'purchaseDate',label: 'Achat' },
          { key: 'warranty',    label: 'Garantie' },
          { key: 'lastMaintenance', label: 'Dernière maintenance' },
          { key: 'ipAddress',   label: 'Adresse IP' },
          { key: 'quantity',    label: 'Quantité' },
        ];
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCompareModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Comparaison d'équipements</h2>
                <button onClick={() => setShowCompareModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-32">Champ</th>
                      {items.map(e => (
                        <th key={e.id} className="px-4 py-3 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{getTypeIcon(e.type)}</span>
                            <div>
                              <p className="font-bold text-gray-900">{e.name}</p>
                              <p className="text-xs text-gray-400 font-normal">{e.brand} {e.model}</p>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(({ key, label }) => {
                      const vals = items.map(e => String(e[key] ?? '—'));
                      const allSame = vals.every(v => v === vals[0]);
                      return (
                        <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</td>
                          {items.map((e, i) => (
                            <td key={e.id} className={`px-4 py-2.5 font-medium ${!allSame ? 'text-blue-700 bg-blue-50' : 'text-gray-700'}`}>
                              {key === 'status' ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[e.status] ?? 'bg-gray-100 text-gray-700'}`}>{e.status}</span>
                              ) : vals[i] || '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400">
                Les champs en <span className="text-blue-700 font-semibold">bleu</span> diffèrent entre les équipements.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Modal Scan QR caméra ══════════════════════════════════════════════ */}
      {showQrScan && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={stopQrScan} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Scanner un QR code</h2>
              <button onClick={stopQrScan}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="relative bg-black aspect-square">
              <video ref={qrVideoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/70 rounded-xl" />
              </div>
            </div>
            <p className="text-center text-xs text-gray-500 py-3 px-4">Pointez la caméra vers un QR code d'équipement</p>
          </div>
        </div>
      )}

      {/* ══ Recherche globale ══════════════════════════════════════════════════ */}
      {showGlobalSearch && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGlobalSearch(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[70vh]">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input ref={globalSearchRef} type="text" value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)}
                placeholder="Rechercher un équipement, ticket, visite, site…"
                className="flex-1 text-base outline-none text-gray-900 placeholder-gray-400"
                onKeyDown={e => { if (e.key === 'Escape') setShowGlobalSearch(false); }}
              />
              {globalSearchQuery && <button onClick={() => setGlobalSearchQuery('')} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>}
              <kbd className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">Esc</kbd>
            </div>
            {/* Results */}
            <div className="flex-1 overflow-y-auto p-3">
              {globalSearchQuery.trim().length < 2 ? (
                <div className="py-10 text-center">
                  <Search className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Tapez au moins 2 caractères pour rechercher</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['Équipements','Maintenance','Visites','Sites'].map(cat => (
                      <span key={cat} className="text-xs px-3 py-1.5 bg-gray-100 rounded-full text-gray-500">{cat}</span>
                    ))}
                  </div>
                </div>
              ) : (() => {
                const q = globalSearchQuery.toLowerCase();
                const eqResults = equipments.filter(e => [e.name, e.brand, e.model, e.serialNumber, e.location, e.department, e.ipAddress].some(f => f?.toLowerCase().includes(q))).slice(0,8);
                const maintResults = maintenanceRecords.filter(m => [m.failureDesc, m.equipmentName, m.technician, m.diagnosis].some(f => f?.toLowerCase().includes(q))).slice(0,5);
                const visitResults = visits.filter(v => [v.siteName, v.technician, v.purpose, v.notes].some(f => f?.toLowerCase().includes(q))).slice(0,5);
                const siteResults = sites.filter(s => [s.name, s.city, s.country, s.address].some(f => f?.toLowerCase().includes(q))).slice(0,4);
                const total = eqResults.length + maintResults.length + visitResults.length + siteResults.length;
                if (total === 0) return <div className="py-10 text-center text-sm text-gray-400">Aucun résultat pour « {globalSearchQuery} »</div>;
                return (
                  <div className="space-y-3">
                    {eqResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-2">Équipements ({eqResults.length})</p>
                        <div className="space-y-1">
                          {eqResults.map(e => (
                            <button key={e.id} onClick={() => { setShowGlobalSearch(false); closeAllModules(); openDetailsModal(e); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-[#e8f3fc] flex items-center justify-center shrink-0">
                                <Monitor className="w-4 h-4 text-indigo-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{e.name}</p>
                                <p className="text-xs text-gray-400 truncate">{[e.brand, e.model, e.location].filter(Boolean).join(' · ')}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${{ actif:'bg-green-100 text-green-700', inactif:'bg-gray-100 text-gray-500', maintenance:'bg-amber-100 text-amber-700', defaillant:'bg-red-100 text-red-700', réformé:'bg-gray-200 text-gray-500' }[e.status] ?? 'bg-gray-100 text-gray-600'}`}>{e.status}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {maintResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-2">Maintenance ({maintResults.length})</p>
                        <div className="space-y-1">
                          {maintResults.map(m => (
                            <button key={m.id} onClick={() => { setShowGlobalSearch(false); openMaintenanceModule(); setSelectedMaintenance(m); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                <Wrench className="w-4 h-4 text-orange-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{m.failureDesc || '—'}</p>
                                <p className="text-xs text-gray-400 truncate">{m.equipmentName} · {m.technician || 'Non assigné'}</p>
                              </div>
                              <span className="text-xs text-gray-400 font-mono shrink-0">#{m.id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {visitResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-2">Visites ({visitResults.length})</p>
                        <div className="space-y-1">
                          {visitResults.map(v => (
                            <button key={v.id} onClick={() => { setShowGlobalSearch(false); closeAllModules(); setShowVisitModule(true); fetchVisits(); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{v.siteName}</p>
                                <p className="text-xs text-gray-400 truncate">{v.technician} · {new Date(v.scheduledDate+'T00:00:00').toLocaleDateString('fr-FR')}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {siteResults.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-2">Sites ({siteResults.length})</p>
                        <div className="space-y-1">
                          {siteResults.map(s => (
                            <button key={s.id} onClick={() => { setShowGlobalSearch(false); setSiteForm(defaultSiteForm); setEditingSiteId(null); setShowSiteModal(true); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                <Globe className="w-4 h-4 text-teal-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.city}{s.country ? `, ${s.country}` : ''} · {s.equipmentCount} équip.</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══ Module Contrats de maintenance ══════════════════════════════════ */}
      {showContractsModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" /></div>
              <div><h2 className="text-base font-bold text-white">Contrats de maintenance</h2><p className="text-white/70 text-xs">{contracts.length} contrat(s) · {contracts.filter(c => c.end_date && new Date(c.end_date) < new Date()).length} expiré(s)</p></div>
            </div>
            <div className="flex gap-2">
              {canWrite && <button onClick={() => { setContractForm(defaultContractForm); setEditingContractId(null); setShowContractForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau</button>}
              <button onClick={() => setShowContractsModule(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {contractsLoading ? <div className="text-center py-16 text-gray-400">Chargement…</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {contracts.map(c => {
                  const expired = c.end_date && new Date(c.end_date) < new Date();
                  const expiringSoon = c.end_date && !expired && (new Date(c.end_date).getTime() - Date.now()) < 30*86400000;
                  return (
                    <div key={c.id} className={`bg-white rounded-xl shadow-sm border p-4 ${expired ? 'border-red-200' : expiringSoon ? 'border-orange-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-bold text-gray-900">{c.title}</p><p className="text-xs text-gray-500">{c.vendor} {c.contract_number && `· #${c.contract_number}`}</p></div>
                        <div className="flex flex-col gap-1 items-end">
                          {expired && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Expiré</span>}
                          {expiringSoon && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded">Bientôt</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                        </div>
                      </div>
                      {c.scope && <p className="text-xs text-gray-600 mb-2 line-clamp-2">{c.scope}</p>}
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        {c.start_date && <span>Du {new Date(c.start_date).toLocaleDateString('fr-FR')}</span>}
                        {c.end_date && <span className={expired ? 'text-red-600 font-bold' : expiringSoon ? 'text-orange-600 font-bold' : ''}>Au {new Date(c.end_date).toLocaleDateString('fr-FR')}</span>}
                      </div>
                      {c.amount && <p className="text-sm font-bold text-gray-700 mb-2">{Number(c.amount).toLocaleString('fr-FR')} {c.currency}</p>}
                      {c.contact_name && <p className="text-xs text-gray-500">{c.contact_name} {c.contact_email && `· ${c.contact_email}`}</p>}
                      {canModify && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                          <button onClick={() => { setContractForm({ title: c.title, vendor: c.vendor, contractNumber: c.contract_number, siteId: c.site_id, equipmentIds: c.equipment_ids, startDate: c.start_date || '', endDate: c.end_date || '', amount: c.amount ? String(c.amount) : '', currency: c.currency, scope: c.scope, contactName: c.contact_name, contactEmail: c.contact_email, contactPhone: c.contact_phone, status: c.status, notes: c.notes }); setEditingContractId(c.id); setShowContractForm(true); }}
                            className="flex-1 text-xs text-[#1a6fa6] hover:text-[#0d4a73] font-medium flex items-center justify-center gap-1 py-1 rounded hover:bg-blue-50"><Edit className="w-3 h-3" /> Modifier</button>
                          <button onClick={() => deleteContract(c.id)} className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1 py-1 rounded hover:bg-red-50"><Trash2 className="w-3 h-3" /> Supprimer</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {contracts.length === 0 && !contractsLoading && <div className="col-span-3 text-center py-16 text-gray-400"><ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucun contrat</p></div>}
              </div>
            )}
          </div>
          {showContractForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowContractForm(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
                <h3 className="font-bold text-gray-900 mb-4">{editingContractId ? 'Modifier' : 'Nouveau'} contrat</h3>
                <div className="grid grid-cols-2 gap-3">
                  {([['Titre *','title','text',true],['Prestataire','vendor','text',false],['N° contrat','contractNumber','text',false],['Montant','amount','number',false],['Devise','currency','text',false],['Début','startDate','date',false],['Fin','endDate','date',false],['Contact','contactName','text',false],['Email contact','contactEmail','email',false],['Tél. contact','contactPhone','text',false]] as const).map(([label, key, type, full]) => (
                    <div key={key} className={full ? 'col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input type={type} value={(contractForm as any)[key]} onChange={e => setContractForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Périmètre / Description</label>
                    <textarea rows={3} value={contractForm.scope} onChange={e => setContractForm(f => ({ ...f, scope: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] resize-none" />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowContractForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
                  <button onClick={saveContract} disabled={!contractForm.title.trim()} className="flex-1 py-2.5 bg-[#1a6fa6] text-white rounded-xl text-sm font-semibold hover:bg-[#155a8a] disabled:opacity-50">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Module Demandes d'achat ═══════════════════════════════════════════ */}
      {showPurchasesModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Plus className="w-5 h-5 text-white" /></div>
              <div><h2 className="text-base font-bold text-white">Demandes d'achat</h2><p className="text-white/70 text-xs">{purchases.filter(p => p.status === 'en_attente').length} en attente d'approbation</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPurchaseForm(defaultPurchaseForm); setShowPurchaseForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouvelle demande</button>
              <button onClick={() => setShowPurchasesModule(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {purchasesLoading ? <div className="text-center py-16 text-gray-400">Chargement…</div> : (
              <div className="space-y-3">
                {(['en_attente','approuvé','rejeté'] as const).map(st => {
                  const items = purchases.filter(p => p.status === st);
                  if (items.length === 0) return null;
                  const colors: Record<string,string> = { en_attente:'border-blue-200 bg-blue-50', approuvé:'border-green-200 bg-green-50', rejeté:'border-red-200 bg-red-50' };
                  const labels: Record<string,string> = { en_attente:'En attente', approuvé:'Approuvées', rejeté:'Rejetées' };
                  return (
                    <div key={st}>
                      <h3 className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg inline-block mb-3 ${colors[st]}`}>{labels[st]} ({items.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {items.map(p => (
                          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div><p className="font-bold text-gray-900">{p.title}</p><p className="text-xs text-gray-500">{p.requested_by} · {p.department}</p></div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.priority === 'haute' ? 'bg-red-100 text-red-700' : p.priority === 'normale' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{p.priority}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{p.quantity}× {p.equipment_type} {p.estimated_cost ? `· ${Number(p.estimated_cost).toLocaleString('fr-FR')} ${p.currency}` : ''}</p>
                            {p.justification && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{p.justification}</p>}
                            {p.rejection_reason && <p className="text-xs text-red-500 mb-2">Motif : {p.rejection_reason}</p>}
                            {isAdmin && p.status === 'en_attente' && (
                              <div className="flex gap-2 pt-2 border-t border-gray-50">
                                <button onClick={() => approvePurchase(p.id)} className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"><CheckCircle className="w-3 h-3 inline mr-1" />Approuver</button>
                                <button onClick={() => { const r = prompt('Motif du rejet :'); if (r !== null) rejectPurchase(p.id, r); }} className="flex-1 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600"><XCircle className="w-3 h-3 inline mr-1" />Rejeter</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {purchases.length === 0 && <div className="text-center py-16 text-gray-400"><Plus className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucune demande d'achat</p></div>}
              </div>
            )}
          </div>
          {showPurchaseForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowPurchaseForm(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
                <h3 className="font-bold text-gray-900 mb-4">Nouvelle demande d'achat</h3>
                <div className="space-y-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Titre *</label><input value={purchaseForm.title} onChange={e => setPurchaseForm(f => ({...f, title: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Type</label><select value={purchaseForm.equipmentType} onChange={e => setPurchaseForm(f => ({...f, equipmentType: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">{equipmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quantité</label><input type="number" min={1} value={purchaseForm.quantity} onChange={e => setPurchaseForm(f => ({...f, quantity: parseInt(e.target.value)||1}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Coût estimé</label><input type="number" value={purchaseForm.estimatedCost} onChange={e => setPurchaseForm(f => ({...f, estimatedCost: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Priorité</label><select value={purchaseForm.priority} onChange={e => setPurchaseForm(f => ({...f, priority: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]"><option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option></select></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Justification</label><textarea rows={3} value={purchaseForm.justification} onChange={e => setPurchaseForm(f => ({...f, justification: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] resize-none" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Département</label><input value={purchaseForm.department} onChange={e => setPurchaseForm(f => ({...f, department: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" /></div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowPurchaseForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button>
                  <button onClick={savePurchase} disabled={!purchaseForm.title.trim()} className="flex-1 py-2.5 bg-[#1a6fa6] text-white rounded-xl text-sm font-semibold hover:bg-[#155a8a] disabled:opacity-50">Soumettre</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Module RMA (retiré) ══════════════════════════════════════════════ */}
      {false && showRMAModule && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-white" /></div>
              <div><h2 className="text-base font-bold text-white">Retours garantie (RMA)</h2><p className="text-white/70 text-xs">{rmaRequests.filter(r => r.status === 'ouvert').length} ouvert(s)</p></div>
            </div>
            <div className="flex gap-2">
              {canWrite && <button onClick={() => { setRMAForm(defaultRMAForm); setEditingRMAId(null); setShowRMAForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau RMA</button>}
              <button onClick={() => setShowRMAModule(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {rmaLoading ? <div className="text-center py-16 text-gray-400">Chargement…</div> : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Équipement</th><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Prestataire</th><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">N° RMA</th><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Statut</th><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Expédié</th><th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Reçu</th><th className="px-4 py-3" /></tr></thead>
                  <tbody>
                    {rmaRequests.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><p className="font-medium text-gray-900">{r.equipment_name}</p><p className="text-xs text-gray-400">{maskValue(r.serial_number)}</p></td>
                        <td className="px-4 py-3 text-gray-600">{r.vendor}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.rma_number || '—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.status === 'ouvert' ? 'bg-blue-100 text-blue-700' : r.status === 'expédié' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.status}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.shipped_date ? new Date(r.shipped_date).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.received_date ? new Date(r.received_date).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-4 py-3">
                          {canModify && <button onClick={() => { setRMAForm({ equipmentId: r.equipment_id, equipmentName: r.equipment_name, serialNumber: r.serial_number, vendor: r.vendor, rmaNumber: r.rma_number, reason: r.reason, shippedDate: r.shipped_date||'', receivedDate: r.received_date||'', resolution: r.resolution, status: r.status, technician: r.technician, notes: r.notes }); setEditingRMAId(r.id); setShowRMAForm(true); }} className="text-xs text-[#1a6fa6] hover:underline"><Edit className="w-3.5 h-3.5" /></button>}
                        </td>
                      </tr>
                    ))}
                    {rmaRequests.length === 0 && <tr><td colSpan={7} className="text-center py-16 text-gray-400">Aucun RMA enregistré</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {showRMAForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowRMAForm(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
                <h3 className="font-bold text-gray-900 mb-4">{editingRMAId ? 'Modifier' : 'Nouveau'} RMA</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[['Équipement','equipmentName','text'],['N° série','serialNumber','text'],['Prestataire','vendor','text'],['N° RMA','rmaNumber','text'],['Technicien','technician','text'],['Expédié le','shippedDate','date'],['Reçu le','receivedDate','date']].map(([l,k,t]) => (
                    <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label><input type={t} value={(rmaForm as any)[k]} onChange={e => setRMAForm(f => ({...f, [k]: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" /></div>
                  ))}
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Statut</label><select value={rmaForm.status} onChange={e => setRMAForm(f => ({...f, status: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]"><option value="ouvert">Ouvert</option><option value="expédié">Expédié</option><option value="résolu">Résolu</option></select></div>
                  <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Raison</label><textarea rows={2} value={rmaForm.reason} onChange={e => setRMAForm(f => ({...f, reason: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] resize-none" /></div>
                  <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Résolution</label><textarea rows={2} value={rmaForm.resolution} onChange={e => setRMAForm(f => ({...f, resolution: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] resize-none" /></div>
                </div>
                <div className="flex gap-3 mt-4"><button onClick={() => setShowRMAForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Annuler</button><button onClick={saveRMA} className="flex-1 py-2.5 bg-[#1a6fa6] text-white rounded-xl text-sm font-semibold hover:bg-[#155a8a]">Enregistrer</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Module Anomalies ═════════════════════════════════════════════════ */}
      {showAnomalies && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-white" /></div>
              <div><h2 className="text-base font-bold text-white">Détection d'anomalies</h2><p className="text-white/70 text-xs">Équipements avec ≥ 3 pannes sur 6 mois</p></div>
            </div>
            <button onClick={() => setShowAnomalies(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {anomalies.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
                <p className="text-lg font-bold text-gray-700">Aucune anomalie détectée</p>
                <p className="text-sm text-gray-400 mt-1">Tous vos équipements semblent normaux.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-bold text-orange-800">{anomalies.length} équipement{anomalies.length > 1 ? 's' : ''} nécessite{anomalies.length === 1 ? '' : 'nt'} une attention particulière</p>
                  <p className="text-xs text-orange-600 mt-0.5">Ces équipements ont subi ≥ 3 pannes ou maintenances ces 6 derniers mois.</p>
                </div>
                {anomalies.map(a => (
                  <div key={a.id} className="bg-white rounded-xl shadow-sm border border-red-100 p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <span className="text-xl font-black text-red-600">{a.ticket_count}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.type} · {a.department} · {a.location}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Dernière panne : {a.last_ticket ? new Date(a.last_ticket).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-lg">{a.ticket_count} tickets</span>
                      <button onClick={() => { setShowAnomalies(false); openMaintenanceModule(); }} className="block text-xs text-[#1a6fa6] hover:underline mt-1">Voir maintenance →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Module Inventaire physique (retiré) ══════════════════════════════ */}
      {false && showInventory && (
        <div className="fixed top-11 left-0 right-0 bottom-0 z-45 flex flex-col bg-gray-50">
          <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-white" /></div>
              <div><h2 className="text-base font-bold text-white">Inventaire physique guidé</h2><p className="text-white/70 text-xs">{inventoryScanned.size}/{equipments.filter(e => e.status !== 'réformé').length} équipements scannés</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setInventoryMissing(equipments.filter(e => e.status !== 'réformé' && !inventoryScanned.has(e.id))); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Voir manquants</button>
              <button onClick={() => setShowInventory(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="bg-white px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
              <span>Progression</span>
              <span className="font-bold">{Math.round(inventoryScanned.size / Math.max(1, equipments.filter(e => e.status !== 'réformé').length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-green-500 rounded-full transition-all" style={{width: `${Math.round(inventoryScanned.size / Math.max(1, equipments.filter(e => e.status !== 'réformé').length) * 100)}%`}} /></div>
          </div>
          <div className="flex-1 overflow-auto">
            {inventoryMissing.length > 0 && (
              <div className="p-4 bg-red-50 border-b border-red-100">
                <p className="text-sm font-bold text-red-700 mb-2">{inventoryMissing.length} équipement(s) non trouvé(s)</p>
                <div className="flex flex-wrap gap-2">{inventoryMissing.map(e => <span key={e.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">{e.name}</span>)}</div>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {equipments.filter(e => e.status !== 'réformé').map(e => {
                const scanned = inventoryScanned.has(e.id);
                return (
                  <div key={e.id} className={`flex items-center gap-4 px-6 py-3 transition-colors ${scanned ? 'bg-green-50' : 'bg-white hover:bg-gray-50'}`}>
                    <button onClick={() => setInventoryScanned(prev => { const next = new Set(prev); scanned ? next.delete(e.id) : next.add(e.id); return next; })}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${scanned ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                      {scanned && <CircleCheck className="w-4 h-4 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${scanned ? 'text-green-700 line-through' : 'text-gray-900'}`}>{e.name}</p>
                      <p className="text-xs text-gray-400">{e.location} · {e.department} · {maskValue(e.serialNumber)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[e.status]}`}>{e.status}</span>
                    {e.ipAddress && pingResults[e.id] !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${pingResults[e.id] === null ? 'bg-gray-100 text-gray-500' : pingResults[e.id] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {pingResults[e.id] === null ? '⏳' : pingResults[e.id] ? 'En ligne' : 'Hors ligne'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ Dashboard TV (retiré) ════════════════════════════════════════════ */}
      {false && showTVDashboard && (
        <div className="fixed inset-0 z-[100] bg-[#0d1117] text-white flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Monitor className="w-6 h-6 text-[#1a6fa6]" />
              <h1 className="text-xl font-bold">Gestion IT — Supervision</h1>
              <span className="text-xs text-white/40">{new Date().toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Live</span>
              <button onClick={() => setShowTVDashboard(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="flex-1 p-8 grid grid-cols-4 grid-rows-2 gap-6 overflow-hidden">
            {[
              { label: 'Total', value: kpiStats.total, color: '#1a6fa6', icon: <Monitor className="w-8 h-8" /> },
              { label: 'Actifs', value: kpiStats.actifs, color: '#22c55e', icon: <CheckCircle className="w-8 h-8" /> },
              { label: 'Défaillants', value: kpiStats.defaillants, color: '#ef4444', icon: <AlertTriangle className="w-8 h-8" /> },
              { label: 'Tickets ouverts', value: kpiStats.ticketsOuverts, color: '#f59e0b', icon: <Wrench className="w-8 h-8" /> },
              { label: 'Critiques', value: kpiStats.ticketsCritiques, color: '#dc2626', icon: <AlertTriangle className="w-8 h-8" /> },
              { label: 'Garanties exp.', value: kpiStats.garantiesExpirees, color: '#d97706', icon: <ShieldCheck className="w-8 h-8" /> },
              { label: 'Visites planif.', value: kpiStats.visitesPlannifiees, color: '#3b82f6', icon: <Calendar className="w-8 h-8" /> },
              { label: 'Non visités', value: kpiStats.nonVisites, color: '#8b5cf6', icon: <XCircle className="w-8 h-8" /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2 p-6" style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}>
                <div style={{ color }}>{icon}</div>
                <p className="text-5xl font-black" style={{ color }}>{value}</p>
                <p className="text-sm text-white/60 font-medium text-center">{label}</p>
              </div>
            ))}
          </div>
          {kpiStats.ticketsCritiques > 0 && (
            <div className="mx-8 mb-6 bg-red-900/40 border border-red-500/50 rounded-xl px-5 py-3 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm font-bold text-red-300">{kpiStats.ticketsCritiques} ticket(s) critique(s) non résolu(s) — intervention requise</p>
            </div>
          )}
        </div>
      )}

      {/* ══ Paramètres (retiré) ═════════════════════════════════════════════ */}
      {false && showSettings && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Paramètres avancés</h2>
              <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-5">
              {/* Slack/Teams */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Webhook Slack / Teams</label>
                <p className="text-xs text-gray-400 mb-2">Les alertes critiques seront envoyées sur ce canal.</p>
                <input type="url" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { localStorage.setItem('it-slack-webhook', slackWebhook); setToast({ message: 'Webhook sauvegardé', type: 'success' }); }} className="text-xs bg-[#1a6fa6] text-white px-3 py-1.5 rounded-lg hover:bg-[#155a8a]">Sauvegarder</button>
                  <button onClick={() => sendSlackNotif('🔔 Test depuis Gestion IT — connexion opérationnelle')} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Tester</button>
                </div>
              </div>
              {/* Masquage */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-gray-800">Masquer les données sensibles</p>
                  <p className="text-xs text-gray-400">N° série, IP, clés de licence affichés masqués</p>
                </div>
                <button onClick={() => { const v = !maskSensitive; setMaskSensitive(v); localStorage.setItem('it-mask-sensitive', String(v)); }} className={`w-12 h-6 rounded-full transition-colors relative ${maskSensitive ? 'bg-[#1a6fa6]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${maskSensitive ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {/* RGPD */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Rapport RGPD</label>
                <p className="text-xs text-gray-400 mb-2">Exporte la liste des données personnelles stockées.</p>
                <button onClick={() => {
                  const doc = new jsPDF();
                  doc.setFontSize(16); doc.setTextColor(26,111,166); doc.text('Rapport RGPD — Données personnelles', 14, 20);
                  doc.setFontSize(10); doc.setTextColor(100); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par ${currentUser.name}`, 14, 28);
                  autoTable(doc, { startY: 35, head: [['Catégorie','Données collectées','Base légale','Conservation']], body: [
                    ['Comptes utilisateurs','Nom, identifiant, rôle, permissions','Exécution du contrat','Durée du contrat + 1 an'],
                    ['Équipements IT','Nom, localisation, département, IP, n° série','Intérêt légitime','Durée de vie équipement'],
                    ['Activité utilisateur','Actions, timestamps, adresse IP','Intérêt légitime','12 mois glissants'],
                    ['Sessions actives','ID session, IP, dernière activité','Intérêt légitime','Session uniquement'],
                    ['Messagerie interne','Messages, expéditeur, horodatage','Consentement','90 jours'],
                  ], theme: 'striped', headStyles: { fillColor: [26,111,166] } });
                  doc.save('rapport-rgpd.pdf');
                }}
                  className="flex items-center gap-2 text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                  <Download className="w-3.5 h-3.5" /> Télécharger rapport RGPD (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Code-barres ════════════════════════════════════════════════ */}
      {barcodeEquipment && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setBarcodeEquipment(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Code-barres</h2>
              <button onClick={() => setBarcodeEquipment(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">{barcodeEquipment.name}</p>
            <p className="text-xs text-gray-400 mb-4 font-mono">{barcodeEquipment.serialNumber || barcodeEquipment.name}</p>
            <canvas ref={barcodeCanvasRef} className="mx-auto max-w-full" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => {
                const canvas = barcodeCanvasRef.current;
                if (!canvas) return;
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = `barcode-${barcodeEquipment.name}.png`;
                a.click();
              }} className="flex-1 py-2.5 bg-[#1a6fa6] text-white rounded-xl text-sm font-semibold hover:bg-[#155a8a] flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> Télécharger PNG
              </button>
              <button onClick={() => {
                const canvas = barcodeCanvasRef.current;
                if (!canvas) return;
                const w = window.open('');
                if (!w) return;
                const img = w.document.createElement('img');
                img.src = canvas.toDataURL();
                img.style.cssText = 'display:block;margin:auto;max-width:100%;padding:20px';
                w.document.body.appendChild(img);
                w.print();
              }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Carte des sites (Leaflet) ══════════════════════════════════ */}
      {showMap && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMap(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{height:'80vh'}}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#1a6fa6]" />
                <h2 className="text-base font-bold text-gray-900">Carte des sites</h2>
                <span className="text-xs text-gray-400">{sites.filter(s => (s as any).latitude).length}/{sites.length} sites géolocalisés</span>
              </div>
              <button onClick={() => setShowMap(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            {sites.filter(s => (s as any).latitude).length === 0 && (
              <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700">
                Aucun site géolocalisé. Ajoutez les coordonnées GPS via l'API : <code className="font-mono">PATCH /api/sites/:id/coords</code> avec <code className="font-mono">latitude</code> et <code className="font-mono">longitude</code>.
              </div>
            )}
            <div ref={mapContainerRef} className="flex-1 rounded-b-2xl" />
          </div>
        </div>
      )}

      {/* ══ Session timeout warning ══════════════════════════════════════════ */}
      {showSessionWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-yellow-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Session inactive</h2>
            <p className="text-sm text-gray-500 mb-4">
              Vous serez déconnecté automatiquement dans{' '}
              <span className="font-bold text-red-600 text-base tabular-nums">
                {Math.floor(sessionCountdown / 60)}:{String(sessionCountdown % 60).padStart(2, '0')}
              </span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => { lastActivityRef.current = Date.now(); sessionWarningRef.current = false; setShowSessionWarning(false); setSessionCountdown(300); }}
                className="flex-1 py-2.5 rounded-xl bg-[#1a6fa6] text-white text-sm font-semibold hover:bg-[#155a8a] transition-colors">
                Rester connecté
              </button>
              <button onClick={onLogout}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Aide raccourcis clavier ════════════════════════════════════════════ */}
    </>
  );
};

export default ITEquipmentManager;
