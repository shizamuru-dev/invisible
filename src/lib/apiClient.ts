const MY_SERVER_URL = "http://localhost:5001";
const COLLEAGUE_API_URL = "http://localhost:3001";

export const MyServerApi = {
    async register(publicKey: any): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicKey })
        });
        if (!res.ok) throw new Error("Registration failed");
        return res.json();
    },
    async getPublicKey(deviceId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/keys/${deviceId}`);
        if (!res.ok) throw new Error("Device not found");
        return res.json();
    },
    async sendMessage(recipientDeviceId: string, encrypted: any, metadata: any = null, senderId?: string): Promise<any> {
        const body: any = { recipientDeviceId, encrypted };
        if (metadata) body.metadata = metadata;
        if (metadata) body.type = "file";
        else body.type = "text";
        if (senderId) body.from = senderId;
        const res = await fetch(`${MY_SERVER_URL}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Send failed: ${res.status} ${text}`);
        }
        return res.json();
    },
    async getMessage(messageId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/messages/${messageId}`);
        if (!res.ok) throw new Error("Message not found");
        return res.json();
    },
    async getNickname(deviceId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/nickname/${deviceId}`);
        if (!res.ok) return { nickname: `User ${deviceId.slice(-4)}`, avatar: null };
        return res.json();
    },
    async updateNickname(deviceId: string, nickname: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/update-nickname`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, nickname })
        });
        if (!res.ok) throw new Error("Update failed");
        return res.json();
    },
    async updateAvatar(deviceId: string, avatar: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/update-avatar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, avatar })
        });
        if (!res.ok) throw new Error("Update avatar failed");
        return res.json();
    },
    async block(deviceId: string, blockedId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/block`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, blockedId })
        });
        if (!res.ok) throw new Error("Block failed");
        return res.json();
    },
    async unblock(deviceId: string, blockedId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/unblock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, blockedId })
        });
        if (!res.ok) throw new Error("Unblock failed");
        return res.json();
    },
    async getBlocked(deviceId: string): Promise<any> {
        const res = await fetch(`${MY_SERVER_URL}/blocked/${deviceId}`);
        if (!res.ok) throw new Error("Failed to get blocked list");
        return res.json();
    }
};

export const ColleagueApi = {
    async register(username: string, password: string): Promise<any> {
        const res = await fetch(`${COLLEAGUE_API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error("Registration failed");
        return res.json();
    },
    async login(username: string, password: string, device_info?: any): Promise<any> {
        const res = await fetch(`${COLLEAGUE_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, device_info })
        });
        if (!res.ok) throw new Error("Login failed");
        return res.json();
    }
};