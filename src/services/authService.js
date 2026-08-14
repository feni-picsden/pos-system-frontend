import apiClient from './apiClient';
import clearLocalSession from './clearLocalSession';

export const authService = {
  // Login user
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials, {
      showGlobalLoader: true,
    });
    const { user, token } = response.data;

    // A session can also end without a logout (tab close, 401 expiry), leaving the
    // previous user's outlet/register selection and cached catalog behind. Wipe on
    // every login — the one funnel every session start routes through.
    await clearLocalSession();

    // Store token and user data
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  // Logout user
  async logout() {
    try {
      // Call server logout endpoint to clear session
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Even if server logout fails, clear local storage
      console.error('Server logout failed:', error);
    } finally {
      // Always clear this device's session state (token, user, outlet + register
      // selection, IndexedDB catalog) — see clearLocalSession.
      await clearLocalSession();
    }
  },

  // Get current user profile
  async getProfile() {
    const response = await apiClient.get('/auth/profile', { silent: true });
    if (response.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Switch active outlet for current user
  async switchOutlet(outletId) {
    const response = await apiClient.post('/auth/switch-outlet', { outletId });
    const { user, token } = response.data;

    // Update token and user data
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));

    return response.data;
  },

  // Update the currently logged-in user's own profile.
  // profileData may contain: name, email, phone, password, avatarFile (File object).
  // Sends multipart/form-data when an avatar file is present, JSON otherwise.
  async updateProfile(profileData) {
    let response;

    if (profileData.avatarFile instanceof File) {
      // Build FormData for multipart upload
      const form = new FormData();
      form.append('avatar', profileData.avatarFile);
      if (profileData.name  !== undefined) form.append('name',  profileData.name);
      if (profileData.email !== undefined) form.append('email', profileData.email ?? '');
      if (profileData.phone !== undefined) form.append('phone', profileData.phone ?? '');
      if (profileData.password)            form.append('password', profileData.password);

      response = await apiClient.patch('/auth/profile', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else {
      // Plain JSON – no file
      const { avatarFile: _avatarFile, removeAvatar, ...rest } = profileData;
      if (removeAvatar) rest.removeAvatar = true;
      response = await apiClient.patch('/auth/profile', rest);
    }

    if (response.data?.user) {
      const current = this.getCurrentUser() || {};
      const merged = { ...current, ...response.data.user };
      localStorage.setItem('user', JSON.stringify(merged));
    }
    apiClient.bustCache('/auth/profile');
    return response.data;
  },

  async updateProfilePreferences(preferences) {
    const response = await apiClient.put('/auth/profile/preferences', preferences);
    const current = this.getCurrentUser() || {};
    const merged = {
      ...current,
      quickMenuItems: response.data?.quickMenuItems ?? current.quickMenuItems,
      reportingAccess: response.data?.reportingAccess ?? current.reportingAccess,
    };
    localStorage.setItem('user', JSON.stringify(merged));
    return response.data;
  },

  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isSuperAdmin() {
    const user = this.getCurrentUser();
    return user?.hasAllPermission || false;
  },
};
