import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  // -------------------------------------------------------------------------
  // Connexion : authentifier via JWT et rejoindre la room utilisateur
  // -------------------------------------------------------------------------
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejeté : pas de token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      const role = payload.role;

      // Stocker les infos utilisateur sur le socket
      (client as any).userId = userId;
      (client as any).userRole = role;

      // Rejoindre la room personnelle
      client.join(`user:${userId}`);

      // Les admins rejoignent aussi la room admin
      if (role === 'admin') {
        client.join('admins');
      }

      this.logger.log(
        `Client connecté : ${client.id} (user: ${userId}, role: ${role})`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} rejeté : token invalide — ${error}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté : ${client.id}`);
  }

  // -------------------------------------------------------------------------
  // Envoyer une notification à un utilisateur spécifique
  // -------------------------------------------------------------------------
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // -------------------------------------------------------------------------
  // Envoyer une notification à tous les admins
  // -------------------------------------------------------------------------
  sendToAdmins(event: string, data: any) {
    this.server.to('admins').emit(event, data);
  }

  // -------------------------------------------------------------------------
  // Broadcast à tous les utilisateurs connectés
  // -------------------------------------------------------------------------
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // -------------------------------------------------------------------------
  // Ping/Pong pour garder la connexion active
  // -------------------------------------------------------------------------
  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }
}
