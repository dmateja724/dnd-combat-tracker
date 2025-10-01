const API_BASE = '/api';
const parseAuthPayload = async (response) => {
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
    }
    return (await response.json());
};
export const signUp = async (credentials) => {
    const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
    });
    return parseAuthPayload(response);
};
export const signIn = async (credentials) => {
    const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
    });
    return parseAuthPayload(response);
};
export const signOut = async () => {
    await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
    });
};
export const fetchSession = async () => {
    const response = await fetch(`${API_BASE}/session`, {
        method: 'GET',
        credentials: 'include'
    });
    if (response.status === 204 || response.status === 401) {
        return null;
    }
    if (!response.ok) {
        throw new Error(`Session request failed with status ${response.status}`);
    }
    return (await response.json());
};
