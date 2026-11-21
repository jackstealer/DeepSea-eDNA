import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber, getErrorBannerMessage } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { User, UserRole, UserUpdateRequest } from '@/types/api';
import { PageHeader } from '@/components/ui/PageHeader';

const ROLES: UserRole[] = ['viewer', 'scientist', 'api_user', 'admin'];

function roleTone(role: string): BadgeTone {
  if (role === 'admin') return 'cyan';
  if (role === 'scientist') return 'teal';
  if (role === 'viewer') return 'blue';
  return 'neutral';
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const updateUser = useMutation({
    mutationFn: ({ id, update }: { id: number; update: UserUpdateRequest }) => api.updateUser(id, update),
    onSuccess: (user) => {
      toast.success('User updated', `${user.username}: ${user.role}, ${user.is_active ? 'active' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-stats'] });
    },
    onError: (err) => toast.error('Update failed', getErrorBannerMessage(err)),
  });

  const usersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.listUsers(),
  });

  const permissionsQ = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.getPermissions(),
  });

  const statsQ = useQuery({
    queryKey: ['admin-security-stats'],
    queryFn: () => api.getSecurityStats(),
  });

  const userColumns: ColumnDef<User>[] = [
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      sortValue: (u) => u.username,
      render: (u) => (
        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
          {u.username}
        </span>
      ),
    },
    {
      key: 'full_name',
      header: 'Full Name',
      sortable: true,
      sortValue: (u) => u.full_name,
      render: (u) => u.full_name || '—',
    },
    {
      key: 'email',
      header: 'Email',
      render: (u) => <span className="font-mono text-[11px]">{u.email}</span>,
    },
    {
      key: 'signin',
      header: 'Sign-in',
      render: (u) => (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
          {[...u.providers, ...(u.has_password ? ['password'] : [])].join(', ')}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) =>
        u.id === currentUserId ? (
          <Badge tone={roleTone(u.role)}>{u.role} (you)</Badge>
        ) : (
          <select
            value={u.role}
            disabled={updateUser.isPending}
            aria-label={`Role for ${u.username}`}
            onChange={(e) => updateUser.mutate({ id: u.id, update: { role: e.target.value as UserRole } })}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-black/25 px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex items-center gap-2">
          <Badge tone={u.disabled ? 'rose' : 'emerald'}>
            {u.disabled ? 'Disabled' : 'Active'}
          </Badge>
          {u.id !== currentUserId && (
            <button
              type="button"
              disabled={updateUser.isPending}
              onClick={() => updateUser.mutate({ id: u.id, update: { is_active: u.disabled } })}
              className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50"
            >
              {u.disabled ? 'Enable' : 'Disable'}
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'last_login',
      header: 'Last Login',
      sortable: true,
      sortValue: (u) => u.last_login ?? '',
      render: (u) => (
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {formatDateTime(u.last_login)}
        </span>
      ),
    },
  ];

  const allPermissions = permissionsQ.data?.all_permissions ?? [];
  const roles = permissionsQ.data?.roles ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" accent="control" />
      {/* Security Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={formatNumber(statsQ.data?.total_users)}
          icon={<Users className="h-4 w-4" />}
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Active Accounts"
          value={formatNumber(statsQ.data?.active_users)}
          icon={<UserCheck className="h-4 w-4" />}
          tone="emerald"
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Disabled Accounts"
          value={formatNumber(statsQ.data?.disabled_users)}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone={(statsQ.data?.disabled_users ?? 0) > 0 ? 'amber' : 'default'}
          loading={statsQ.isLoading}
        />
        <StatCard
          label="Revoked Tokens"
          value={formatNumber(statsQ.data?.revoked_tokens)}
          icon={<KeyRound className="h-4 w-4" />}
          tone="cyan"
          loading={statsQ.isLoading}
        />
      </div>

      {statsQ.isError && (
        <ErrorState
          title="Security statistics unavailable"
          error={statsQ.error}
          onRetry={() => statsQ.refetch()}
        />
      )}

      {/* Users Table */}
      <Card>
        <CardHeader
          title="Registered Users"
          subtitle="Change roles or disable accounts; disabling signs the user out immediately"
        />
        {usersQ.isError ? (
          <ErrorState
            title="Failed to load users"
            error={usersQ.error}
            onRetry={() => usersQ.refetch()}
          />
        ) : (
          <DataTable
            data={usersQ.data?.users ?? []}
            columns={userColumns}
            rowKey={(u) => String(u.id)}
            loading={usersQ.isLoading}
            searchPlaceholder="Search by username, name, email, or role..."
          />
        )}
      </Card>

      {/* Role -> Permission Matrix */}
      <Card>
        <CardHeader
          title="Role & Permission Matrix"
          subtitle="RBAC authorization policies from GET /auth/permissions"
        />

        {permissionsQ.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : permissionsQ.isError ? (
          <ErrorState
            title="Failed to load permissions matrix"
            error={permissionsQ.error}
            onRetry={() => permissionsQ.refetch()}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                  <th className="px-4 py-2.5 font-semibold text-slate-500">Permission</th>
                  {roles.map((r) => (
                    <th key={r.role} className="px-4 py-2.5 font-semibold text-center">
                      <Badge tone={roleTone(r.role)}>{r.role}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {allPermissions.map((perm) => (
                  <tr key={perm} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-900 dark:text-slate-100">
                      {perm}
                    </td>
                    {roles.map((r) => {
                      const prefix = perm.split(':')[0];
                      const granted =
                        r.permissions === 'all' ||
                        (Array.isArray(r.permissions) &&
                          (r.permissions.includes(perm) || r.permissions.includes(`${prefix}:*`)));
                      return (
                        <td key={r.role} className="px-4 py-2 text-center font-mono">
                          {granted ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
