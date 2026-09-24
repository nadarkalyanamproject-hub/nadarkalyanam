import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../../../common/permissions.js';

export const PERMISSION_METADATA_KEY = 'requiredPermission';

export const RequirePermission = (permission: PermissionCode) =>
  SetMetadata(PERMISSION_METADATA_KEY, permission);
