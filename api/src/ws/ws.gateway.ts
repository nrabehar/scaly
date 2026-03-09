import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

type ClientMeta = { id: string; symbol: string };
type SignalRequestHandler = (symbol: string, clientId: string) => void;

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/',
    transports: ['websocket', 'polling'],
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WsGateway.name);
    private clients = new Map<string, ClientMeta>();
    private signalRequestHandler?: SignalRequestHandler;

    /** List of tradeable instruments — set by StreamsService at startup */
    private instruments: string[] = [];

    /** Let the streams layer register the full instruments list */
    setInstruments(list: string[]) {
        this.instruments = list;
    }

    /** Called once by StreamsService to wire on-demand signal requests. */
    registerSignalRequestHandler(handler: SignalRequestHandler) {
        this.signalRequestHandler = handler;
    }

    handleConnection(socket: Socket) {
        const id = socket.id;
        this.clients.set(id, { id, symbol: 'BTC/USD' });
        this.logger.log(`Client connected: ${id}`);

        // `connected` carries the full instruments list so the frontend can
        // populate the instrument selector without a separate HTTP call.
        socket.emit('connected', {
            clientId: id,
            symbol: 'BTC/USD',
            instruments: this.instruments,
        });

        socket.on('subscribe', (payload: { symbol: string }) => {
            const meta = this.clients.get(id);
            if (meta) {
                meta.symbol = payload?.symbol || meta.symbol;
                this.clients.set(id, meta);
                socket.emit('subscribed', { symbol: meta.symbol });
            }
        });

        // On-demand analysis: client requests immediate signal for current symbol
        socket.on('request-signal', (payload?: { symbol?: string }) => {
            const meta = this.clients.get(id);
            if (!meta) return;
            const symbol = payload?.symbol || meta.symbol;
            if (symbol !== meta.symbol) {
                meta.symbol = symbol;
                this.clients.set(id, meta);
            }
            if (this.signalRequestHandler) {
                this.signalRequestHandler(symbol, id);
            }
        });

        // Heartbeat: client sends ping, we respond with pong + server timestamp
        socket.on('ping', (payload?: { t?: number }) => {
            socket.emit('pong', { t: payload?.t, serverTime: Date.now() });
        });
    }

    handleDisconnect(socket: Socket) {
        this.clients.delete(socket.id);
        this.logger.log(`Client disconnected: ${socket.id}`);
    }

    broadcastPrice(symbol: string, data: any) {
        for (const [id, meta] of this.clients.entries()) {
            if (meta.symbol === symbol) {
                this.server.to(id).emit('price', { symbol, data });
            }
        }
    }

    broadcastOrderbook(symbol: string, data: any) {
        for (const [id, meta] of this.clients.entries()) {
            if (meta.symbol === symbol) {
                this.server.to(id).emit('orderbook', { symbol, data });
            }
        }
    }

    broadcastSignal(symbol: string, data: any) {
        for (const [id, meta] of this.clients.entries()) {
            if (meta.symbol === symbol) {
                this.server.to(id).emit('signal', { symbol, data });
            }
        }
    }

    broadcastNews(symbol: string, data: any) {
        this.server.emit('news', { symbol, data });
    }

    broadcastSignalResolved(id: number, symbol: string, outcome: string) {
        this.server.emit('signal-resolved', { id, symbol, outcome });
    }

    /** Push a signal directly to one specific client (on-demand requests). */
    broadcastSignalToClient(clientId: string, symbol: string, data: any) {
        this.server.to(clientId).emit('signal', { symbol, data });
    }

    /** Tell a client analysis is running so the UI can show a loading state. */
    broadcastAnalyzing(clientId: string, symbol: string) {
        this.server.to(clientId).emit('signal-analyzing', { symbol });
    }

    /** Broadcast the engine HOLD state with the reason to all subscribers. */
    broadcastHold(symbol: string, reason: string) {
        for (const [id, meta] of this.clients.entries()) {
            if (meta.symbol === symbol) {
                this.server
                    .to(id)
                    .emit('signal-hold', { symbol, reason, ts: Date.now() });
            }
        }
    }

    /** Number of currently connected clients (for monitoring). */
    get connectedClientCount(): number {
        return this.clients.size;
    }
}
