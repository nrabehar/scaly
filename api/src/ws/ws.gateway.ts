import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

type ClientMeta = { id: string; symbol: string };

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

  handleConnection(socket: Socket) {
    const id = socket.id;
    this.clients.set(id, { id, symbol: 'BTC/USD' });
    this.logger.log(`Client connected: ${id}`);
    socket.emit('hello', { clientId: id, symbol: 'BTC/USD' });

    socket.on('subscribe', (payload: { symbol: string }) => {
      const meta = this.clients.get(id);
      if (meta) {
        meta.symbol = payload?.symbol || meta.symbol;
        this.clients.set(id, meta);
        socket.emit('subscribed', { symbol: meta.symbol });
      }
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
    this.server.emit('orderbook', { symbol, data });
  }

  broadcastNews(symbol: string, data: any) {
    this.server.emit('news', { symbol, data });
  }
}
