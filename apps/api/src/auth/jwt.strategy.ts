import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.js';
import {
  ACCESS_COOKIE,
  type AccessTokenPayload,
  type AuthUser,
} from './auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      // The web app uses the httpOnly cookie; the bearer header keeps the API
      // usable from Swagger, curl and tests.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.[
            ACCESS_COOKIE
          ] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      ignoreExpiration: false,
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    return { id: payload.sub, organizationId: payload.org, role: payload.role };
  }
}
