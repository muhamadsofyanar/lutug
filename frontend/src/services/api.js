// API Utility for React

// Runtime Configuration Support
// Check if a global config object exists (set via config.js in public folder)
const CONFIG_API_URL = typeof window !== 'undefined' && window.INSYARAH_API_URL ? window.INSYARAH_API_URL : null;

// Fallback to relative path if no config provided
// Note: If running on a subdirectory (e.g. domain.com/app), ensure this points to domain.com/backend/api/index.php
// or domain.com/app/backend/api/index.php depending on deployment.
// Using 'backend/api/index.php' assumes backend is a sibling folder to the frontend assets in the URL structure.
export const API_BASE = CONFIG_API_URL || "/backend/api/index.php";

export async function apiGet(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    const json = await res.json();
    return handleResponse(res, json);
  } catch (e) {
    return {
      ok: false,
      data: { error: "Network error or invalid JSON response" },
    };
  }
}

export async function apiPost(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return handleResponse(res, json);
  } catch (e) {
    return {
      ok: false,
      data: { error: "Network error or invalid JSON response" },
    };
  }
}

export async function apiUpload(url, formData) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        // Content-Type header should not be set manually for FormData
      },
      body: formData,
    });
    const json = await res.json();
    return handleResponse(res, json);
  } catch (e) {
    return {
      ok: false,
      data: { error: "Network error or invalid JSON response" },
    };
  }
}

function handleResponse(res, json) {
  if (json && typeof json === 'object') {
    if ('success' in json && 'data' in json) {
      return { ok: res.ok && json.success, data: json.data, message: json.message };
    }
    if ('success' in json && 'error' in json && !json.success) {
      return { ok: false, data: { error: json.error.message, code: json.error.code } };
    }
    if ('error' in json && !('success' in json)) {
      return { ok: false, data: json };
    }
  }
  return { ok: res.ok, data: json };
}
