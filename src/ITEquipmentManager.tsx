import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Monitor,
  Wifi,
  Server,
  Printer,
  User,
  Users,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Clock,
  ShieldCheck,
  Download,
  RefreshCcw,
  LogOut,
  Activity
} from 'lucide-react';

interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
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

type EquipmentType = 'ordinateur' | 'reseau' | 'serveur' | 'imprimante';
type EquipmentStatus = 'actif' | 'inactif' | 'maintenance' | 'defaillant';

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
}

interface EquipmentFormData extends Omit<Equipment, 'id'> {}

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
  interventionDetails: ''
};

const equipmentTypes = [
  { value: 'ordinateur' as EquipmentType, label: 'Ordinateur', icon: Monitor },
  { value: 'reseau' as EquipmentType, label: 'Équipement Réseau', icon: Wifi },
  { value: 'serveur' as EquipmentType, label: 'Serveur', icon: Server },
  { value: 'imprimante' as EquipmentType, label: 'Imprimante', icon: Printer }
];

const roleDisplay: Record<string, { label: string; classes: string }> = {
  admin: { label: 'Administrateur', classes: 'bg-red-100 text-red-700' },
  technicien: { label: 'Technicien', classes: 'bg-blue-100 text-blue-700' },
  user: { label: 'Utilisateur', classes: 'bg-gray-100 text-gray-700' }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

const API_BASE = `${API_BASE_URL}/api/equipments`;
const API_USERS = `${API_BASE_URL}/api/users`;
const EXPORT_URL = `${API_BASE_URL}/api/equipments/export`;

const statusColors: Record<EquipmentStatus, string> = {
  actif: 'bg-green-100 text-green-800',
  inactif: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  defaillant: 'bg-red-100 text-red-800'
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
    interventionDetails: 'Mise à jour système et nettoyage complet'
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
    interventionDetails: ''
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
    interventionDetails: 'Remplacement toner et maintenance préventive'
  }
];

interface UserAccount {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  permissions: string[];
}

interface UserFormData {
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  password: string;
  permissions: Permission[];
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

const ITEquipmentManager = ({ currentUser, onLogout }: ITEquipmentManagerProps) => {
  const isAdmin = currentUser.role === 'admin';
  const roleInfo = roleDisplay[currentUser.role] ?? { label: currentUser.role, classes: 'bg-gray-100 text-gray-700' };
  const canRead   = isAdmin || (currentUser.permissions ?? []).includes('lecture');
  const canWrite  = isAdmin || (currentUser.permissions ?? []).includes('ecriture');
  const canModify = isAdmin || (currentUser.permissions ?? []).includes('modification');

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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>(defaultFormData);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [userEditingId, setUserEditingId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'] });
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Monitoring
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [monitoringTab, setMonitoringTab] = useState<'sessions' | 'activities'>('sessions');
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityUserFilter, setActivityUserFilter] = useState<number | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringCountdown, setMonitoringCountdown] = useState(10);
  const activityUserFilterRef = useRef<number | null>(null);

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
    } catch {}
  };

  const fetchActivities = async (userId?: number | null) => {
    try {
      const qs = userId != null ? `?userId=${userId}&limit=200` : '?limit=200';
      const res = await fetch(`${API_BASE_URL}/api/admin/activities${qs}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setActivityLogs(await res.json());
    } catch {}
  };

  const refreshMonitoring = async () => {
    setMonitoringLoading(true);
    setMonitoringCountdown(10);
    await Promise.all([fetchSessions(), fetchActivities(activityUserFilterRef.current)]);
    setMonitoringLoading(false);
  };

  const handleUnauthorized = () => {
    alert('Session expirée ou non autorisée. Veuillez vous reconnecter.');
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

  const openUserCreate = () => {
    setUserEditingId(null);
    setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'] });
    setUserFormError(null);
    setShowUserFormModal(true);
  };

  const openUserEdit = (user: UserAccount) => {
    setUserEditingId(user.id);
    setUserFormData({ username: user.username, name: user.name, role: user.role, password: '', permissions: (user.permissions ?? []) as Permission[] });
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
      permissions: userFormData.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : userFormData.permissions
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
      setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'] });
      await fetchUsers();
    } catch {
      setUserFormError('Impossible de sauvegarder l\'utilisateur.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }
    try {
      const response = await fetch(`${API_USERS}/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur de suppression');
      }
      await fetchUsers();
    } catch {
      setError('Impossible de supprimer l\'utilisateur.');
    }
  };

  useEffect(() => {
    fetchEquipments();
    fetchUsers();
  }, []);

  // Real-time monitoring polling
  useEffect(() => {
    if (!showMonitoringModal || !isAdmin) return;
    refreshMonitoring();
    const dataTimer = setInterval(refreshMonitoring, 10000);
    const countTimer = setInterval(() => setMonitoringCountdown((v) => (v <= 1 ? 10 : v - 1)), 1000);
    return () => { clearInterval(dataTimer); clearInterval(countTimer); };
  }, [showMonitoringModal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowForm(false);
        setShowDetailsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  const openNewEquipmentForm = () => {
    resetForm();
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
      alert('Impossible de sauvegarder l\'équipement. Vérifiez vos autorisations et que le backend est démarré.');
    }
  };

  const handleSubmit = async () => {
    const requiredFields = ['name', 'brand', 'model', 'serialNumber', 'location', 'department'];
    const missingField = requiredFields.find((field) => !formData[field as keyof EquipmentFormData]?.toString().trim());

    if (missingField) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.visited && !formData.technicianName.trim()) {
      alert('Le nom du technicien est obligatoire si l\'équipement a été visité.');
      return;
    }

    await handleSaveEquipment(formData);
    setShowForm(false);
    resetForm();
  };

  const handleEdit = (equipment: Equipment) => {
    setFormData({ ...equipment });
    setEditingId(equipment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet équipement ?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        alert('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur de suppression');
      }
      setEquipments((prev) => prev.filter((item) => item.id !== id));
      if (selectedEquipment?.id === id) {
        setShowDetailsModal(false);
        setSelectedEquipment(null);
      }
    } catch (err) {
      alert('Impossible de supprimer l\'équipement. Vérifiez vos autorisations et que le backend est démarré.');
    }
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
      if (!response.ok) {
        throw new Error('Export impossible');
      }
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
      alert('Impossible d\'exporter les équipements.');
    }
  };

  const openDetailsModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowDetailsModal(true);
  };

  const filteredEquipments = equipments.filter((equipment) => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch =
      equipment.name.toLowerCase().includes(lowerSearch) ||
      equipment.location.toLowerCase().includes(lowerSearch) ||
      equipment.department.toLowerCase().includes(lowerSearch) ||
      equipment.brand.toLowerCase().includes(lowerSearch) ||
      equipment.model.toLowerCase().includes(lowerSearch) ||
      equipment.serialNumber.toLowerCase().includes(lowerSearch) ||
      equipment.ipAddress.toLowerCase().includes(lowerSearch);

    const matchesType = filterType === 'all' || equipment.type === filterType;
    const matchesStatus = filterStatus === 'all' || equipment.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeIcon = (type: EquipmentType) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    const IconComponent = typeInfo?.icon || Monitor;
    return <IconComponent className="w-4 h-4" />;
  };

  const dueSoonCount = equipments.filter((equipment) => {
    if (!equipment.warranty) {
      return false;
    }
    const warrantyDate = new Date(equipment.warranty);
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 90);
    return warrantyDate >= now && warrantyDate <= soon;
  }).length;

  const maintenanceCount = equipments.filter((equipment) => equipment.status === 'maintenance').length;
  const notVisitedCount = equipments.filter((equipment) => !equipment.visited).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestion des équipements informatiques</h1>
              <p className="text-gray-600 mt-2">Suivi des équipements et accès protégé par rôle.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                <User className="w-4 h-4 text-gray-500" />
                <span>{currentUser.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleInfo.classes}`}>{roleInfo.label}</span>
              </div>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowMonitoringModal(true); }}
                    className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-700 hover:bg-green-100"
                  >
                    <Activity className="w-4 h-4" />
                    Monitoring
                  </button>
                  <button
                    type="button"
                    onClick={() => { fetchUsers(); setShowUserModal(true); }}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100"
                  >
                    <Users className="w-4 h-4" />
                    Gérer les utilisateurs
                  </button>
                </>
              )}
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-3 text-blue-600">
              <Info className="w-5 h-5" />
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Total équipements</div>
                <div className="text-2xl font-bold text-gray-900">{equipments.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-3 text-yellow-600">
              <Clock className="w-5 h-5" />
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Sous garantie 90j</div>
                <div className="text-2xl font-bold text-gray-900">{dueSoonCount}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-3 text-orange-600">
              <ShieldCheck className="w-5 h-5" />
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Maintenance</div>
                <div className="text-2xl font-bold text-gray-900">{maintenanceCount}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-3 text-red-600">
              <XCircle className="w-5 h-5" />
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Non visités</div>
                <div className="text-2xl font-bold text-gray-900">{notVisitedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | EquipmentType)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les types</option>
              {equipmentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | EquipmentStatus)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="maintenance">Maintenance</option>
              <option value="defaillant">Défaillant</option>
            </select>

            <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <RefreshCcw className="w-4 h-4" />
                Actualiser
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              {canWrite && (
                <button
                  onClick={openNewEquipmentForm}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Nouvel équipement
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">Chargement des données...</div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Équipement</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localisation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passage technicien</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEquipments.map((equipment) => (
                    <tr key={equipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getTypeIcon(equipment.type)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{equipment.name}</div>
                            <div className="text-sm text-gray-500">{equipment.brand} {equipment.model}</div>
                            <div className="text-sm text-gray-400">IP: {equipment.ipAddress || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {equipmentTypes.find((t) => t.value === equipment.type)?.label}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                          {equipment.location}
                        </div>
                        <div className="text-sm text-gray-500">{equipment.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[equipment.status]}`}>
                          {equipment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {equipment.visited ? (
                          <button
                            onClick={() => openDetailsModal(equipment)}
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 hover:bg-green-200"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {equipment.technicianName}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Non visité
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {canModify && (
                            <button
                              onClick={() => handleEdit(equipment)}
                              className="text-blue-600 hover:text-blue-900"
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
                          <button
                            onClick={() => openDetailsModal(equipment)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Voir détails"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showForm && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">
                {editingId !== null ? 'Modifier l\'équipement' : 'Nouvel équipement'}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'équipement *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as EquipmentType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modèle *</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de série *</label>
                    <input
                      type="text"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse IP</label>
                    <input
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localisation *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin de garantie</label>
                    <input
                      type="date"
                      value={formData.warranty}
                      onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dernière maintenance</label>
                    <input
                      type="date"
                      value={formData.lastMaintenance}
                      onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Passage technicien</h3>

                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="visited"
                      checked={formData.visited}
                      onChange={(e) => setFormData({ ...formData, visited: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="visited" className="ml-2 block text-sm text-gray-900">
                      Un technicien a visité cet équipement
                    </label>
                  </div>

                  {formData.visited && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du technicien *</label>
                        <input
                          type="text"
                          value={formData.technicianName}
                          onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de visite</label>
                        <input
                          type="datetime-local"
                          value={formData.visitDate}
                          onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Détails de l'intervention</label>
                        <textarea
                          value={formData.interventionDetails}
                          onChange={(e) => setFormData({ ...formData, interventionDetails: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Décrivez les actions effectuées..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingId !== null ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetailsModal && selectedEquipment && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowDetailsModal(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Détails de l'équipement</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-900"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Nom :</span>
                  <span>{selectedEquipment.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Type :</span>
                  <span>{equipmentTypes.find((t) => t.value === selectedEquipment.type)?.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Marque :</span>
                  <span>{selectedEquipment.brand}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Modèle :</span>
                  <span>{selectedEquipment.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">N° de série :</span>
                  <span>{selectedEquipment.serialNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">IP :</span>
                  <span>{selectedEquipment.ipAddress || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Localisation :</span>
                  <span>{selectedEquipment.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Département :</span>
                  <span>{selectedEquipment.department}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Statut :</span>
                  <span className={statusColors[selectedEquipment.status]}>{selectedEquipment.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Achat :</span>
                  <span>{selectedEquipment.purchaseDate || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Garantie :</span>
                  <span>{selectedEquipment.warranty || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Dernière maintenance :</span>
                  <span>{selectedEquipment.lastMaintenance || 'N/A'}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">Technicien :</span>
                    <span>{selectedEquipment.technicianName || 'Non renseigné'}</span>
                  </div>
                  {selectedEquipment.visitDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold">Date de visite :</span>
                      <span>
                        {new Date(selectedEquipment.visitDate).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {selectedEquipment.interventionDetails && (
                    <div className="mt-3 p-3 rounded-lg bg-gray-50 text-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">Intervention :</span>
                      </div>
                      <p>{selectedEquipment.interventionDetails}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Monitoring modal ─────────────────────────────────────────────── */}
      {showMonitoringModal && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50"
          onClick={() => setShowMonitoringModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Monitoring en temps réel</h2>
                  <p className="text-xs text-gray-500">Actualisation automatique toutes les 10 secondes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {monitoringLoading
                    ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                  <span>{monitoringLoading ? 'Actualisation…' : `Prochaine dans ${monitoringCountdown}s`}</span>
                </div>
                <button
                  onClick={refreshMonitoring}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Actualiser
                </button>
                <button onClick={() => setShowMonitoringModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Fermer">✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
              <button
                onClick={() => setMonitoringTab('sessions')}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'sessions' ? 'border-green-500 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  Sessions actives
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeSessions.length > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {activeSessions.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setMonitoringTab('activities')}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'activities' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Journal d'activité
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-gray-200 text-gray-600">
                    {activityLogs.length}
                  </span>
                </span>
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* ── Sessions tab ── */}
              {monitoringTab === 'sessions' && (
                <div className="p-6">
                  {activeSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Wifi className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Aucune session active pour le moment.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {activeSessions.map((session) => {
                        const online = isOnline(session.lastSeen);
                        const info = roleDisplay[session.role] ?? { label: session.role, classes: 'bg-gray-100 text-gray-700' };
                        return (
                          <div key={session.userId} className={`rounded-xl border-2 p-4 ${online ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              {/* Identity */}
                              <div className="flex items-center gap-3">
                                <div className={`relative flex items-center justify-center w-11 h-11 rounded-full font-bold text-lg ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                  {session.name.charAt(0).toUpperCase()}
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{session.name}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.classes}`}>{info.label}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">@{session.username}</div>
                                </div>
                              </div>
                              {/* Status badge */}
                              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-600' : 'bg-gray-500'}`} />
                                {online ? 'En ligne' : 'Inactif'}
                              </div>
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Connexion</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDateTime(session.loginAt)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Dernière activité</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDateTime(session.lastSeen)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Durée de session</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDuration(session.loginAt)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Adresse IP</div>
                                <div className="text-xs font-semibold text-gray-800 font-mono">{session.ip}</div>
                              </div>
                            </div>

                            {/* Quick activity link */}
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => {
                                  setActivityUserFilter(session.userId);
                                  activityUserFilterRef.current = session.userId;
                                  fetchActivities(session.userId);
                                  setMonitoringTab('activities');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Voir l'activité de {session.name} →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Activities tab ── */}
              {monitoringTab === 'activities' && (
                <div className="p-6">
                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm text-gray-600 font-medium">Filtrer par utilisateur :</span>
                    <button
                      onClick={() => {
                        setActivityUserFilter(null);
                        activityUserFilterRef.current = null;
                        fetchActivities(null);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === null ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                    >
                      Tous
                    </button>
                    {Array.from(new Map(activityLogs.map((a) => [a.userId, { id: a.userId, name: a.name, username: a.username }])).values()).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setActivityUserFilter(u.id);
                          activityUserFilterRef.current = u.id;
                          fetchActivities(u.id);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === u.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>

                  {activityLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Clock className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Aucune activité enregistrée.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date / Heure</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {activityLogs.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                                {formatDateTime(entry.timestamp)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 text-xs">{entry.name}</div>
                                <div className="text-gray-400 text-xs">@{entry.username}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionStyle(entry.action)}`}>
                                  {entry.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{entry.details || '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{entry.ip}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Gestion des utilisateurs</h2>
              <button onClick={() => setShowUserModal(false)} className="text-gray-500 hover:text-gray-900" aria-label="Fermer">✕</button>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={openUserCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter un utilisateur
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom d'utilisateur</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom complet</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {userAccounts.map((user) => {
                    const info = roleDisplay[user.role] ?? { label: user.role, classes: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{user.username}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.classes}`}>{info.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          {user.role === 'admin' ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Toutes</span>
                          ) : (user.permissions ?? []).length === 0 ? (
                            <span className="text-xs text-gray-400 italic">Aucune</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {PERMISSION_CONFIG.filter((p) => (user.permissions ?? []).includes(p.value)).map((p) => {
                                const cls: Record<string, string> = {
                                  blue: 'bg-blue-100 text-blue-700',
                                  green: 'bg-green-100 text-green-700',
                                  orange: 'bg-orange-100 text-orange-700'
                                };
                                return (
                                  <span key={p.value} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls[p.color]}`}>{p.label}</span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openUserEdit(user)} className="text-blue-600 hover:text-blue-900" title="Modifier">
                              <Edit className="w-4 h-4" />
                            </button>
                            {user.id !== currentUser.id && (
                              <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900" title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {userAccounts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Aucun utilisateur trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showUserFormModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowUserFormModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{userEditingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
              <button onClick={() => setShowUserFormModal(false)} className="text-gray-500 hover:text-gray-900" aria-label="Fermer">✕</button>
            </div>
            {userFormError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{userFormError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur *</label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserFormData['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="admin">Administrateur</option>
                  <option value="technicien">Technicien</option>
                  <option value="user">Utilisateur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe {!userEditingId && '*'}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={userEditingId ? 'Laisser vide pour ne pas changer' : ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions *</label>
                {userFormData.role === 'admin' ? (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Les administrateurs ont automatiquement toutes les permissions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {PERMISSION_CONFIG.map((perm) => {
                      const checked = userFormData.permissions.includes(perm.value);
                      const colorMap: Record<string, string> = {
                        blue:   checked ? 'border-blue-400 bg-blue-50'   : 'border-gray-200 hover:border-blue-300',
                        green:  checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300',
                        orange: checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                      };
                      const badgeMap: Record<string, string> = {
                        blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', orange: 'bg-orange-100 text-orange-700'
                      };
                      return (
                        <label
                          key={perm.value}
                          className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${colorMap[perm.color]}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...userFormData.permissions, perm.value]
                                : userFormData.permissions.filter((p) => p !== perm.value);
                              setUserFormData({ ...userFormData, permissions: next });
                            }}
                            className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{perm.label}</span>
                              {checked && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeMap[perm.color]}`}>Actif</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{perm.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                    {userFormData.permissions.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Aucune permission sélectionnée — l'utilisateur ne pourra rien faire.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserFormModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleUserSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {userEditingId ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ITEquipmentManager;
