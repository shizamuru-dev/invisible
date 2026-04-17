export class WsClient {
    private ws: WebSocket | null = null;
    constructor(private url: string, private token: string) {}

    connect(onMessage: (msg: any) => void) {
        this.ws = new WebSocket(`${this.url}?token=${this.token}`);
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        this.ws.onclose = () => console.log("WS closed");
        this.ws.onerror = (err) => console.error("WS error", err);
    }

    send(msg: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
