export interface DeviceInfo {
    device_name: string;
    device_model: string;
    platform: string;
    hwid: string;
}

export const HTTP_URL = "https://api.invisible.glitched.network";
export const WS_URL = "wss://relay.invisible.glitched.network/ws";

export class ApiClient {
    static async request(endpoint: string, method: string = "GET", body: any = null, token: string | null = null) {
        const headers: Record<string, string> = {};
        if (body) headers["Content-Type"] = "application/json";
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${HTTP_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!res.ok) {
            throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        }

        if (res.status === 204) return null;
        try {
            return await res.json();
        } catch {
            return null;
        }
    }

    // Auth
    static async register(username: string, password: string) {
        return this.request("/api/auth/register", "POST", { username, password });
    }

    static async login(username: string, password: string, device_info?: DeviceInfo) {
        const data = await this.request("/api/auth/login", "POST", { username, password, device_info });
        return data.token;
    }

    static async logout(token: string) {
        return this.request("/api/auth/logout", "POST", null, token);
    }

    // E2EE Keys
    static async uploadKeys(token: string, keys: any) {
        return this.request("/keys/upload", "POST", keys, token);
    }

    static async claimKeys(token: string, username: string) {
        return this.request(`/keys/claim/${username}`, "GET", null, token);
    }

    // Files
    static async presignFile(token: string, file_name: string, mime_type: string) {
        const query = new URLSearchParams({ file_name, mime_type }).toString();
        const result = await this.request(`/files/presign?${query}`, "GET", null, token);
        return result;
    }

    // Secure Vault
    static async backupVault(token: string, backup: any) {
        return this.request("/keys/backup", "POST", backup, token);
    }

    static async getVault(token: string) {
        return this.request("/keys/backup", "GET", null, token);
    }

    static async deleteVault(token: string) {
        return this.request("/keys/backup", "DELETE", null, token);
    }

    // Devices
    static async getDevices(token: string) {
        return this.request("/keys/devices", "GET", null, token);
    }

    static async deleteDevice(token: string, device_id: string) {
        return this.request(`/keys/devices/${device_id}`, "DELETE", null, token);
    }

    // Dialogs
    static async getDialogs(token: string) {
        return this.request("/api/dialogs", "GET", null, token);
    }

    static async getMessages(token: string, username: string, limit: number = 50, after?: string) {
        let url = `/api/messages/${username}?limit=${limit}`;
        if (after) url += `&after=${after}`;
        return this.request(url, "GET", null, token);
    }

    static async getReadState(token: string, peer: string) {
        return this.request(`/api/dialogs/${peer}/read-state`, "GET", null, token);
    }

    static async markRead(token: string, peer: string, message_id?: string) {
        let url = `/api/dialogs/${peer}/read`;
        if (message_id) url += `?message_id=${message_id}`;
        return this.request(url, "POST", null, token);
    }
}
