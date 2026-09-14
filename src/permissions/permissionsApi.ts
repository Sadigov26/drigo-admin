import { apiRequest } from '../api/client';

export type Permissions = {
  adminId: string;
  isSuperAdmin: boolean;
  permissionCodes: string[];
};

export async function getPermissions(signal: AbortSignal): Promise<Permissions> {
  const result = await apiRequest<Permissions>('/api/admin/permissions/my-permissions', {
    signal, cache: 'no-store',
  });
  if (!result || typeof result.adminId !== 'string' || typeof result.isSuperAdmin !== 'boolean'
    || !Array.isArray(result.permissionCodes) || !result.permissionCodes.every(code => typeof code === 'string')) {
    throw new Error('The server returned invalid permissions. Please try again.');
  }
  return result;
}
