import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { AuthService, type IssuedTokens } from './auth.service.js';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  type AuthUser,
  REFRESH_COOKIE,
  SESSION_HINT_COOKIE,
} from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

// Tight limit on credential endpoints to slow down brute-force attempts.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(dto, req.get('user-agent'));
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto, req.get('user-agent'));
    this.setCookies(res, tokens);
    return { ok: true };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.auth.refresh(
        this.cookie(req, REFRESH_COOKIE),
        req.get('user-agent'),
      );
      this.setCookies(res, tokens);
      return { ok: true };
    } catch (error) {
      this.clearCookies(res);
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.cookie(req, REFRESH_COOKIE));
    this.clearCookies(res);
  }

  @ApiCookieAuth(ACCESS_COOKIE)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiCookieAuth(ACCESS_COOKIE)
  @Get('socket-token')
  async socketToken(@CurrentUser() user: AuthUser) {
    return { token: await this.auth.socketToken(user) };
  }

  private cookie(req: Request, name: string): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[name];
  }

  private baseCookie(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
    };
  }

  private setCookies(res: Response, tokens: IssuedTokens) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.baseCookie(),
      path: '/',
      maxAge: ACCESS_TTL_SECONDS * 1000,
    });
    // Scoped to the auth routes so the long-lived token isn't sent on every request.
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.baseCookie(),
      path: '/api/auth',
      expires: tokens.refreshExpiresAt,
    });
    // Lets the web app route signed-out visitors without seeing any token.
    res.cookie(SESSION_HINT_COOKIE, '1', {
      ...this.baseCookie(),
      httpOnly: false,
      path: '/',
      expires: tokens.refreshExpiresAt,
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.baseCookie(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, {
      ...this.baseCookie(),
      path: '/api/auth',
    });
    res.clearCookie(SESSION_HINT_COOKIE, {
      ...this.baseCookie(),
      httpOnly: false,
      path: '/',
    });
  }
}
