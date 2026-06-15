/**
 * Frontend configuration and API utilities
 */

const getApiBaseUrl = () => '';

export const API_BASE_URL = getApiBaseUrl();

/**
 * Build API URL
 * @param {string} path - API path (e.g., '/api/equipments')
 * @returns {string} Full API URL
 */
export const apiUrl = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};

/**
 * Get authorization headers with JWT token
 * @returns {object} Headers object with Authorization header
 */
export const getAuthHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token') ?? ''}`
  };
};

/**
 * API error handler
 * @param {Response} response - Fetch response
 * @param {function} onUnauthorized - Callback for 401 errors
 * @returns {Promise<object>} Response JSON
 */
export const handleApiError = async (
  response: Response,
  onUnauthorized?: () => void
): Promise<{ message: string; errors?: string[] }> => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (onUnauthorized) onUnauthorized();
    return { message: 'Session expirée. Veuillez vous reconnecter.' };
  }

  try {
    return await response.json();
  } catch {
    return { message: `Erreur serveur (${response.status})` };
  }
};

/**
 * Type-safe fetch wrapper
 * @param {string} url - API URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Response data
 */
export const fetchApi = async (
  url: string,
  options: RequestInit = {}
): Promise<any> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await handleApiError(response);
    throw new Error(error.message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export default {
  API_BASE_URL,
  apiUrl,
  getAuthHeaders,
  handleApiError,
  fetchApi
};
