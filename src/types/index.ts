export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  allowedSiteIds?: number[];
}

export type Permission = 'lecture' | 'ecriture' | 'modification';

export interface ITEquipmentManagerProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

export type EquipmentType = 'ordinateur' | 'reseau' | 'serveur' | 'imprimante' | 'accessoires' | 'autre';
export type EquipmentStatus = 'actif' | 'inactif' | 'maintenance' | 'defaillant' | 'réformé';
export type VisitStatus = 'planifié' | 'en_cours' | 'terminé' | 'annulé' | 'reporté';

export interface SiteVisit {
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

export interface Equipment {
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
  supplierId?: number | null;
  quantity: number;
  minQuantity: number;
  deletedAt?: string | null;
}

export interface EquipmentFormData extends Omit<Equipment, 'id'> {}

export interface EquipmentDoc {
  id: number;
  equipmentId: number;
  filename: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TransferForm {
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

export type MaintenanceStatus = 'en_attente' | 'ouvert' | 'en_cours' | 'résolu';
export type MaintenancePriority = 'faible' | 'normale' | 'haute' | 'critique';

export interface MaintenanceRecord {
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

export interface Site {
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

export interface SiteForm {
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

export interface SiteStat {
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

export interface ReformForm {
  reason: string;
  replacedById: number | null;
  notes: string;
  reformQty: number;
}

export interface MaintenanceForm {
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

export interface UserAccount {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  permissions: string[];
  allowedSiteIds: number[];
  blocked?: boolean;
}

export interface UserFormData {
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  password: string;
  permissions: Permission[];
  allowedSiteIds: number[];
}

export interface SessionInfo {
  userId: number;
  username: string;
  name: string;
  role: string;
  loginAt: string;
  lastSeen: string;
  ip: string;
}

export interface ActivityEntry {
  id: number;
  userId: number;
  username: string;
  name: string;
  action: string;
  details: string;
  timestamp: string;
  ip: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderUsername: string;
  recipientId: number | null;
  groupId: number | null;
  content: string;
  createdAt: string;
}

export interface ChatUser {
  id: number;
  username: string;
  name: string;
}

export interface ChatGroup {
  id: number;
  name: string;
  created_by: number;
  member_ids: number[];
}

export interface FieldChange {
  field: string;
  from: string | boolean;
  to: string | boolean;
}

export interface EquipmentEvent {
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

export interface DeptStat {
  department: string;
  total_events: string;
  equipment_count: string;
  creations: string;
  modifications: string;
  interventions: string;
  suppressions: string;
  last_activity: string;
}

export interface UserStat {
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

export interface MaintenanceContract {
  id: number; title: string; vendor: string; contract_number: string;
  site_id: number | null; equipment_ids: number[]; start_date: string | null;
  end_date: string | null; amount: number | null; currency: string;
  scope: string; contact_name: string; contact_email: string; contact_phone: string;
  status: string; notes: string; created_at: string;
}

export interface PurchaseRequest {
  id: number; title: string; equipment_type: string; quantity: number;
  estimated_cost: number | null; currency: string; priority: string;
  justification: string; requested_by: string; department: string;
  site_id: number | null; status: string; approved_by: string;
  approved_at: string | null; rejection_reason: string; notes: string; created_at: string;
}

export interface RMARequest {
  id: number; equipment_id: number | null; equipment_name: string;
  serial_number: string; vendor: string; rma_number: string; reason: string;
  shipped_date: string | null; received_date: string | null; resolution: string;
  status: string; technician: string; notes: string; created_at: string;
}

export interface AnomalyItem {
  id: number; name: string; type: string; department: string; location: string;
  ticket_count: number; last_ticket: string;
}

export interface License {
  id: number; name: string; vendor: string; license_key: string;
  seats: number; used_seats: number; equipment_id: number | null;
  purchase_date: string | null; expiry_date: string | null; notes: string; created_at: string;
}

export interface TrendPoint {
  label: string; month: number; year: number; pannes: number; tickets: number; mttr: number;
}
