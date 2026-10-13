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

// Origines autorisées : CORS_ORIGINS="https://app.kayy.com,https://admin.kayy.com"
// Sans variable définie, on autorise tout (dev uniquement).
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : '*';

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
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

      // Stocker les infos utilisateur dans client.data
      // (visible aussi via fetchSockets())
      client.data.userId = userId;
      client.data.userRole = role;

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
  // Nombre d'utilisateurs uniques connectés (plusieurs onglets = 1 utilisateur)
  // Note : ne voit que les sockets de l'instance courante. En multi-instances,
  // il faudra l'adaptateur Redis (@socket.io/redis-adapter).
  // -------------------------------------------------------------------------
  async getConnectedUsersCount(): Promise<number> {
    const sockets = await this.server.fetchSockets();
    return new Set(sockets.map((s) => s.data.userId).filter(Boolean)).size;
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