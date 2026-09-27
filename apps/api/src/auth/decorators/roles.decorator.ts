import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Owners always pass. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
