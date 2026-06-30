/**
 * Validation utilities for server inputs
 * Prevents invalid data from reaching the database
 */

export const validators = {
  /**
   * Validate username format
   * @param {string} username - Username to validate
   * @returns {object} { valid: boolean, error?: string }
   */
  username(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 100) {
      return { valid: false, error: 'Username must not exceed 100 characters' };
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, hyphens, underscores' };
    }
    return { valid: true, value: trimmed };
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {object} { valid: boolean, error?: string }
   */
  password(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }
    if (password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters' };
    }
    if (password.length > 255) {
      return { valid: false, error: 'Password is too long' };
    }
    return { valid: true, value: password };
  },

  /**
   * Validate user name field
   * @param {string} name - User full name
   * @returns {object} { valid: boolean, error?: string }
   */
  name(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' };
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    if (trimmed.length > 200) {
      return { valid: false, error: 'Name must not exceed 200 characters' };
    }
    return { valid: true, value: trimmed };
  },

  /**
   * Validate user role
   * @param {string} role - User role
   * @returns {object} { valid: boolean, error?: string }
   */
  role(role) {
    const validRoles = ['admin', 'technicien', 'user'];
    if (!role || !validRoles.includes(role)) {
      return { valid: false, error: `Role must be one of: ${validRoles.join(', ')}` };
    }
    return { valid: true, value: role };
  },

  /**
   * Validate permissions array
   * @param {array} permissions - Array of permission strings
   * @returns {object} { valid: boolean, error?: string }
   */
  permissions(permissions) {
    const validPerms = ['lecture', 'ecriture', 'modification'];
    if (!Array.isArray(permissions)) {
      return { valid: false, error: 'Permissions must be an array' };
    }
    for (const perm of permissions) {
      if (!validPerms.includes(perm)) {
        return { valid: false, error: `Invalid permission: ${perm}` };
      }
    }
    return { valid: true, value: permissions };
  },

  /**
   * Validate equipment type
   * @param {string} type - Equipment type
   * @returns {object} { valid: boolean, error?: string }
   */
  equipmentType(type) {
    const validTypes = ['ordinateur', 'reseau', 'serveur', 'imprimante', 'accessoires', 'autre'];
    if (!type || !validTypes.includes(type)) {
      return { valid: false, error: `Equipment type must be one of: ${validTypes.join(', ')}` };
    }
    return { valid: true, value: type };
  },

  /**
   * Validate equipment status
   * @param {string} status - Equipment status
   * @returns {object} { valid: boolean, error?: string }
   */
  equipmentStatus(status) {
    const validStatuses = ['actif', 'inactif', 'maintenance', 'defaillant', 'réformé'];
    if (!status || !validStatuses.includes(status)) {
      return { valid: false, error: `Status must be one of: ${validStatuses.join(', ')}` };
    }
    return { valid: true, value: status };
  },

  /**
   * Validate IP address
   * @param {string} ip - IP address
   * @returns {object} { valid: boolean, error?: string }
   */
  ipAddress(ip) {
    if (!ip || typeof ip !== 'string') {
      return { valid: true, value: '' }; // Optional field
    }
    const trimmed = ip.trim();
    if (trimmed === '') return { valid: true, value: '' };
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(trimmed)) {
      return { valid: false, error: 'Invalid IP address format' };
    }
    return { valid: true, value: trimmed };
  },

  /**
   * Validate text string (max length)
   * @param {string} text - Text to validate
   * @param {number} maxLength - Maximum length
   * @returns {object} { valid: boolean, error?: string }
   */
  text(text, maxLength = 200) {
    if (typeof text !== 'string') {
      return { valid: true, value: '' }; // Optional
    }
    const trimmed = text.trim();
    if (trimmed.length > maxLength) {
      return { valid: false, error: `Text must not exceed ${maxLength} characters` };
    }
    return { valid: true, value: trimmed };
  },

  /**
   * Validate date string (YYYY-MM-DD format)
   * @param {string} date - Date string
   * @returns {object} { valid: boolean, error?: string }
   */
  date(date) {
    if (!date || typeof date !== 'string') {
      return { valid: true, value: '' }; // Optional
    }
    const trimmed = date.trim();
    if (trimmed === '') return { valid: true, value: '' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      return { valid: false, error: 'Invalid date' };
    }
    return { valid: true, value: trimmed };
  }
};

/**
 * Validate equipment data
 * @param {object} data - Equipment data to validate
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateEquipment(data) {
  const errors = [];

  // Validate required fields
  if (!data.name?.trim()) errors.push('name: Le nom est requis.');
  const nameVal = validators.text(data.name || '', 200);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);

  const typeVal = validators.equipmentType(data.type);
  if (!typeVal.valid) errors.push('type: ' + typeVal.error);

  const statusVal = validators.equipmentStatus(data.status);
  if (!statusVal.valid) errors.push('status: ' + statusVal.error);

  // Validate optional fields
  const brandVal = validators.text(data.brand || '', 100);
  if (!brandVal.valid) errors.push('brand: ' + brandVal.error);

  const modelVal = validators.text(data.model || '', 100);
  if (!modelVal.valid) errors.push('model: ' + modelVal.error);

  const snVal = validators.text(data.serialNumber || '', 100);
  if (!snVal.valid) errors.push('serialNumber: ' + snVal.error);

  const ipVal = validators.ipAddress(data.ipAddress || '');
  if (!ipVal.valid) errors.push('ipAddress: ' + ipVal.error);

  const locVal = validators.text(data.location || '', 200);
  if (!locVal.valid) errors.push('location: ' + locVal.error);

  const deptVal = validators.text(data.department || '', 200);
  if (!deptVal.valid) errors.push('department: ' + deptVal.error);

  const purchaseVal = validators.date(data.purchaseDate || '');
  if (!purchaseVal.valid) errors.push('purchaseDate: ' + purchaseVal.error);

  const warrantyVal = validators.text(data.warranty || '', 100);
  if (!warrantyVal.valid) errors.push('warranty: ' + warrantyVal.error);

  const maintenanceVal = validators.date(data.lastMaintenance || '');
  if (!maintenanceVal.valid) errors.push('lastMaintenance: ' + maintenanceVal.error);

  const techVal = validators.text(data.technicianName || '', 200);
  if (!techVal.valid) errors.push('technicianName: ' + techVal.error);

  const visitVal = validators.date(data.visitDate || '');
  if (!visitVal.valid) errors.push('visitDate: ' + visitVal.error);

  const detailsVal = validators.text(data.interventionDetails || '', 1000);
  if (!detailsVal.valid) errors.push('interventionDetails: ' + detailsVal.error);

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateSupplier(data) {
  const errors = [];
  if (!data.name?.trim()) errors.push('name: Le nom du fournisseur est requis.');
  const nameVal = validators.text(data.name, 200);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);
  if (data.email && data.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('email: Format d\'email invalide.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate user data for creation/update
 * @param {object} data - User data
 * @param {boolean} isNew - Is this a new user (password required)
 * @returns {object} { valid: boolean, errors: array }
 */
/**
 * Validate site data
 * @param {object} data
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateSite(data) {
  const errors = [];
  if (!data.name?.trim()) errors.push('name: Le nom du site est requis.');
  const nameVal = validators.text(data.name, 200);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);
  if (data.city && !validators.text(data.city, 100).valid) errors.push('city: ' + validators.text(data.city, 100).error);
  if (data.country && !validators.text(data.country, 100).valid) errors.push('country: ' + validators.text(data.country, 100).error);
  if (data.latitude != null && data.latitude !== '') {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) errors.push('latitude: Doit être une valeur entre -90 et 90.');
  }
  if (data.longitude != null && data.longitude !== '') {
    const lng = parseFloat(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) errors.push('longitude: Doit être une valeur entre -180 et 180.');
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email: Format email invalide.');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate license data
 * @param {object} data
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateLicense(data) {
  const errors = [];
  if (!data.name?.trim()) errors.push('name: Le nom de la licence est requis.');
  if (!data.productKey?.trim()) errors.push('productKey: La clé produit est requise.');
  const nameVal = validators.text(data.name, 200);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);
  if (data.edition && !validators.text(data.edition, 100).valid) errors.push('edition: ' + validators.text(data.edition, 100).error);
  if (data.quantity && (isNaN(Number(data.quantity)) || Number(data.quantity) < 1))
    errors.push('quantity: Doit être un nombre positif.');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate contract data
 * @param {object} data
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateContract(data) {
  const errors = [];
  if (!data.name?.trim()) errors.push('name: Le nom du contrat est requis.');
  if (!data.provider?.trim()) errors.push('provider: Le fournisseur est requis.');
  const nameVal = validators.text(data.name, 200);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);
  if (data.type && !validators.text(data.type, 100).valid) errors.push('type: ' + validators.text(data.type, 100).error);
  return { valid: errors.length === 0, errors };
}

/**
 * Validate purchase data
 * @param {object} data
 * @returns {object} { valid: boolean, errors: array }
 */
export function validatePurchase(data) {
  const errors = [];
  if (!data.title?.trim()) errors.push('title: Le titre est requis.');
  const titleVal = validators.text(data.title, 200);
  if (!titleVal.valid) errors.push('title: ' + titleVal.error);
  if (data.amount && (isNaN(Number(data.amount)) || Number(data.amount) < 0))
    errors.push('amount: Montant invalide.');
  return { valid: errors.length === 0, errors };
}

/**
 * Validate RMA data
 * @param {object} data
 * @returns {object} { valid: boolean, errors: array }
 */
export function validateRma(data) {
  const errors = [];
  if (!data.equipmentName?.trim()) errors.push('equipmentName: Le nom de l\'équipement est requis.');
  if (!data.reason?.trim()) errors.push('reason: La raison du retour est requise.');
  const nameVal = validators.text(data.equipmentName, 200);
  if (!nameVal.valid) errors.push('equipmentName: ' + nameVal.error);
  return { valid: errors.length === 0, errors };
}

export function validateUser(data, isNew = true) {
  const errors = [];

  const usernameVal = validators.username(data.username);
  if (!usernameVal.valid) errors.push('username: ' + usernameVal.error);

  const nameVal = validators.name(data.name);
  if (!nameVal.valid) errors.push('name: ' + nameVal.error);

  const roleVal = validators.role(data.role);
  if (!roleVal.valid) errors.push('role: ' + roleVal.error);

  if (isNew) {
    const passwordVal = validators.password(data.password);
    if (!passwordVal.valid) errors.push('password: ' + passwordVal.error);
  } else if (data.password) {
    const passwordVal = validators.password(data.password);
    if (!passwordVal.valid) errors.push('password: ' + passwordVal.error);
  }

  if (data.permissions) {
    const permsVal = validators.permissions(data.permissions);
    if (!permsVal.valid) errors.push('permissions: ' + permsVal.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
