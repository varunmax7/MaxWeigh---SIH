'use client';

import { Bell, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { markNotificationsReadAction } from '@/server/actions/comments';
import {
  getMyNotificationsAction,
  getNotificationDownloadUrlAction,
} from '@/server/actions/notifications';

type NotificationRow = Awaited<ReturnType<typeof getMyNotificationsAction>>['rows'][number];

const POLL_MS = 30_000;

function relativeTime(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function messageOf(row: NotificationRow): string {
  const payload = row.payload as { message?: string } | null;
  return payload?.message ?? row.type;
}

/** in-app notifications, 30 s polling (implementation.md §7.4, §9). */
export function NotificationBell() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const result = await getMyNotificationsAction();
      if (!cancelled) {
        setRows(result.rows);
        setUnread(result.unread);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function markAllRead() {
    await markNotificationsReadAction({ ids: [] });
    setRows([]);
    setUnread(0);
  }

  async function download(zipKey: string) {
    const url = await getNotificationDownloadUrlAction(zipKey);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('That download link has expired.');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          className="relative"
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] tabular"
            >
              {unread > 99 ? '99+' : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notifications</span>
          {rows.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          rows.map((row) => {
            const payload = row.payload as { zipKey?: string; reportCount?: number } | null;
            return (
              <DropdownMenuItem
                key={row.id}
                className="flex flex-col items-start gap-1 whitespace-normal"
                onSelect={(e) => {
                  if (row.type === 'reports.export_ready') e.preventDefault();
                }}
              >
                <p className="text-sm">{messageOf(row)}</p>
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(row.createdAt)}
                  </span>
                  {row.type === 'reports.export_ready' && payload?.zipKey ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => void download(payload.zipKey as string)}
                    >
                      <Download aria-hidden="true" className="size-3" />
                      Download
                    </Button>
                  ) : null}
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
