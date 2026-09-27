import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_TTL_SECONDS,
  type AccessTokenPayload,
  REFRESH_TTL_DAYS,
} from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Verifying against a throwaway hash when the email is unknown keeps the
// response time the same, so login can't be used to probe for accounts.
const DUMMY_HASH = await hash('crewline-timing-guard');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hash(dto.password);
    const slug = await this.uniqueSlug(dto.businessName);

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.businessName.trim(),
          slug,
          locations: {
            create: {
              name: dto.locationName.trim(),
              timezone: dto.timezone ?? 'America/Toronto',
            },
          },
        },
        include: { locations: true },
      });

      return tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          role: Role.OWNER,
          lastLoginAt: new Date(),
          employee: {
            create: {
              organizationId: org.id,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              email,
              employmentType: 'FULL_TIME',
              locations: { create: { locationId: org.locations[0].id } },
            },
          },
        },
      });
    });

    return this.issueTokens(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await verify(user?.passwordHash ?? DUMMY_HASH, dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user, userAgent);
  }

  /**
   * Rotates a refresh token. If a token that was already rotated is presented
   * again, someone is replaying a stolen token, so the whole family is revoked.
   */
  async refresh(rawToken: string | undefined, userAgent?: string) {
    if (!rawToken) throw new UnauthorizedException();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException();

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Session expired, please sign in again');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException();

    const tokens = await this.issueTokens(
      stored.user,
      userAgent,
      stored.familyId,
    );
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: sha256(tokens.refreshToken) },
    });
    return tokens;
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: { id: string; organizationId: string; role: Role },
    userAgent?: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      org: user.organizationId,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: ACCESS_TTL_SECONDS,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt: refreshExpiresAt,
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async uniqueSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'team';

    let slug = base;
    for (let i = 2; ; i++) {
      const taken = await this.prisma.organization.findUnique({
        where: { slug },
      });
      if (!taken) return slug;
      slug = `${base}-${i}`;
    }
  }
}
