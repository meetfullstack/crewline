import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import { Role } from '../generated/prisma/enums.js';
import { RealtimeService, rooms } from './realtime.service.js';

export interface SocketTokenPayload extends AccessTokenPayload {
  typ: 'socket';
}

/**
 * Socket connections authenticate with a short-lived token from
 * GET /api/auth/socket-token (fetched through the same-origin API, so it
 * works when the API lives on another domain), then join their rooms.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth as { token?: unknown })?.token;
    try {
      if (typeof token !== 'string') throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<SocketTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      if (payload.typ !== 'socket') throw new Error('wrong token type');

      await client.join([rooms.org(payload.org), rooms.user(payload.sub)]);
      if (payload.role === Role.OWNER || payload.role === Role.MANAGER) {
        await client.join(rooms.managers(payload.org));
      }
    } catch (error) {
      this.logger.debug(`Rejected socket: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }
}
