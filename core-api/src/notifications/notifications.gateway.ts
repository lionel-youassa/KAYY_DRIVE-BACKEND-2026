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
import { getAllowedOrigins } from '../config/cors';

interface JwtPayload {
  sub: string;
  role?: string;
}

interface SocketUserData {
  userId?: string;
  userRole?: string;
}

// Origines autorisées : CORS_ORIGINS="https://app.kayy.com,https://admin.kayy.com"
// Sans variable définie, on autorise tout (dev uniquement).
const allowedOrigins = getAllowedOrigins();

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
  handleConnection(client: Socket): void {
    try {
      const authToken = client.handshake.auth?.token as string | undefined;
      const headerToken = client.handshake.headers?.authorization?.replace(
        'Bearer ',
        '',
      );
      const token = authToken || headerToken;

      if (!token) {
        this.logger.warn(`Client ${client.id} rejeté : pas de token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const userId = payload.sub;
      const role = payload.role;

      // Stocker les infos utilisateur dans client.data
      // (visible aussi via fetchSockets())
      const data = client.data as SocketUserData;
      data.userId = userId;
      data.userRole = role;

      // Rejoindre la room personnelle
      void client.join(`user:${userId}`);

      // Les admins rejoignent aussi la room admin
      if (role === 'admin') {
        void client.join('admins');
      }

      this.logger.log(
        `Client connecté : ${client.id} (user: ${userId}, role: ${role})`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} rejeté : token invalide — ${String(error)}`,
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
    const userIds = sockets
      .map((s) => (s.data as SocketUserData).userId)
      .filter((id): id is string => Boolean(id));
    return new Set(userIds).size;
  }

  // -------------------------------------------------------------------------
  // Envoyer une notification à un utilisateur spécifique
  // -------------------------------------------------------------------------
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // -------------------------------------------------------------------------
  // Envoyer une notification à tous les admins
  // -------------------------------------------------------------------------
  sendToAdmins(event: string, data: unknown) {
    this.server.to('admins').emit(event, data);
  }

  // -------------------------------------------------------------------------
  // Broadcast à tous les utilisateurs connectés
  // -------------------------------------------------------------------------
  broadcastToAll(event: string, data: unknown) {
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
