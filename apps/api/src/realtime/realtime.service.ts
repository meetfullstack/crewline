import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Pushes events to connected browsers. Clients don't trust the payloads for
 * data — events only say "this changed", and the client refetches through the
 * normal, authorized API.
 */
export type RealtimeEvent =
  | 'schedule.changed'
  | 'attendance.changed'
  | 'timeoff.changed'
  | 'swaps.changed'
  | 'notification';

export const rooms = {
  org: (id: string) => `org:${id}`,
  managers: (orgId: string) => `managers:${orgId}`,
  user: (id: string) => `user:${id}`,
};

@Injectable()
export class RealtimeService {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  toOrg(organizationId: string, event: RealtimeEvent, payload: object = {}) {
    this.server?.to(rooms.org(organizationId)).emit(event, payload);
  }

  toManagers(organizationId: string, event: RealtimeEvent, payload: object = {}) {
    this.server?.to(rooms.managers(organizationId)).emit(event, payload);
  }

  toUsers(userIds: string[], event: RealtimeEvent, payload: object = {}) {
    if (!this.server || userIds.length === 0) return;
    this.server.to(userIds.map(rooms.user)).emit(event, payload);
  }
}
