// ============================================================
//  googleDriveService.js — Complete Google Drive Backup Integration
// ============================================================

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_FOLDER_NAME = 'Raath_POS_Backups';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Default OAuth Client ID (can be overridden by user in settings)
export const DEFAULT_CLIENT_ID = '382109489201-8b3q2t3h1b3q1j5t1p5j1.apps.googleusercontent.com';

let tokenClient = null;
let scriptLoadingPromise = null;

/**
 * Dynamically load Google Identity Services (GIS) client
 */
export function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is not defined'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')));
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Request Google Drive Access Token via OAuth2 Popup
 */
export async function requestGoogleDriveToken(clientId = DEFAULT_CLIENT_ID) {
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK not available.');
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          try {
            // Fetch User Profile
            const profile = await getUserProfile(tokenResponse.access_token);
            const tokenData = {
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in,
              expiryTimestamp: Date.now() + (Number(tokenResponse.expires_in) || 3600) * 1000,
              user: profile,
              clientId
            };

            // Save in localStorage
            saveGoogleAuth(tokenData);
            resolve(tokenData);
          } catch (profileErr) {
            console.warn('Failed to load Google profile:', profileErr);
            const fallbackData = {
              accessToken: tokenResponse.access_token,
              expiresIn: tokenResponse.expires_in,
              expiryTimestamp: Date.now() + (Number(tokenResponse.expires_in) || 3600) * 1000,
              user: { name: 'Google User', email: '' },
              clientId
            };
            saveGoogleAuth(fallbackData);
            resolve(fallbackData);
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Save Google Auth in localStorage
 */
export function saveGoogleAuth(authData) {
  try {
    localStorage.setItem('raath_gdrive_auth', JSON.stringify(authData));
  } catch (e) {
    console.error('Failed to save Google Auth:', e);
  }
}

/**
 * Get Saved Google Auth from localStorage
 */
export function getSavedGoogleAuth() {
  try {
    const raw = localStorage.getItem('raath_gdrive_auth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

/**
 * Remove Google Auth / Disconnect
 */
export function clearGoogleAuth() {
  try {
    localStorage.removeItem('raath_gdrive_auth');
    localStorage.removeItem('raath_gdrive_folder_id');
  } catch (e) {
    console.error('Failed to clear Google Auth:', e);
  }
}

/**
 * Check if current Google Token is valid
 */
export function isGoogleTokenValid(authData) {
  if (!authData || !authData.accessToken) return false;
  if (!authData.expiryTimestamp) return true;
  // Give 2 minutes grace period
  return Date.now() < (authData.expiryTimestamp - 120000);
}

/**
 * Fetch Google User Profile
 */
export async function getUserProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch Google profile');
  return res.json();
}

/**
 * Find or Create the 'Raath_POS_Backups' folder on Google Drive
 */
export async function getOrCreateBackupFolder(accessToken) {
  // Check cached folder ID first
  const cachedFolderId = localStorage.getItem('raath_gdrive_folder_id');
  if (cachedFolderId) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        const folder = await checkRes.json();
        if (!folder.trashed) return cachedFolderId;
      }
    } catch (e) {
      // Ignored, search or recreate
    }
  }

  // Search for existing folder
  const query = encodeURIComponent(`name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      const folderId = data.files[0].id;
      localStorage.setItem('raath_gdrive_folder_id', folderId);
      return folderId;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official backup folder for Raath POS'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error('Failed to create backup folder on Google Drive: ' + errText);
  }

  const newFolder = await createRes.json();
  localStorage.setItem('raath_gdrive_folder_id', newFolder.id);
  return newFolder.id;
}

/**
 * Upload a JSON Backup to Google Drive using Multipart Upload
 */
export async function uploadBackupToDrive(accessToken, backupData, fileName) {
  const folderId = await getOrCreateBackupFolder(accessToken);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName || `RAATH-POS-Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Raath POS Backup created on ${new Date().toLocaleString()}`
  };

  const fileContent = typeof backupData === 'string' ? backupData : JSON.stringify(backupData, null, 2);

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Failed to upload backup to Google Drive: ' + errText);
  }

  return await res.json();
}

/**
 * List all backups stored in the Raath POS folder on Google Drive
 */
export async function listDriveBackups(accessToken) {
  const folderId = await getOrCreateBackupFolder(accessToken);
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,modifiedTime,webViewLink)&orderBy=createdTime desc&pageSize=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Failed to list backups from Google Drive: ' + errText);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Download and parse backup JSON from Google Drive
 */
export async function downloadBackupFromDrive(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('Failed to download backup from Google Drive');
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Downloaded file is not a valid JSON backup');
  }
}

/**
 * Delete a backup from Google Drive
 */
export async function deleteDriveBackup(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 204) {
    throw new Error('Failed to delete backup from Google Drive');
  }

  return true;
}

/**
 * Fetch Google Drive storage quota (used / total)
 */
export async function getDriveStorageQuota(accessToken) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.storageQuota || null;
}
