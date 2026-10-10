/**
 * Where a tapped notification opens, in each app. Both a push (its `data`)
 * and a row in the notifications list arrive with the WEBSITE's link
 * (`/user/reservations`, `/partner/bookings`, …), which the apps don't have:
 * pushing it as-is landed on the not-found screen. Nouzl_Backend's push data
 * adds `bookingUuid` / `conversationId` so a tap can open the exact booking or
 * chat; without them the link is mapped to the closest screen, and anything
 * unknown falls back to the notifications list.
 */
export interface NotificationTarget {
  type?: string | null;
  link?: string | null;
  bookingUuid?: string | null;
  conversationId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pathOf(link: string | null | undefined): { path: string; query: string } | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  const [path, query = ''] = link.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query };
}

/** Pulls the routing fields out of a push's untyped `data`. */
export function notificationTargetFromData(data: unknown): NotificationTarget {
  if (!data || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return { type: str(d.type), link: str(d.link), bookingUuid: str(d.bookingUuid), conversationId: str(d.conversationId) };
}

export function customerRouteForNotification(target: NotificationTarget): string {
  if (target.type === 'support') return '/support';
  if (target.type === 'chat' && target.conversationId) return `/chat/${target.conversationId}`;
  if (target.bookingUuid && UUID_RE.test(target.bookingUuid)) return `/reservation/${target.bookingUuid}`;

  const parsed = pathOf(target.link);
  if (!parsed) return '/notifications';
  const { path, query } = parsed;

  const reservation = /^\/reservation\/([^/]+)$/.exec(path);
  if (reservation && UUID_RE.test(reservation[1])) return `/reservation/${reservation[1]}`;
  if (path === '/user/reservations' || path.startsWith('/reservation')) return '/trips';
  if (path === '/user/event-bookings') return '/event-bookings';
  if (path === '/user/profile' || path === '/user') return '/profile';
  if (path === '/user/wishlist' || path === '/wishlist') return '/wishlist';
  if (path === '/user/saved-searches' || path === '/saved-searches') return '/saved-searches';
  if (path === '/user/referrals' || path === '/referrals') return '/referrals';
  if (path === '/search') return query ? `/search-results?${query}` : '/search-results';
  if (path === '/support' || path === '/contact') return path;
  if (path === '/offers' || path === '/') return '/';
  const offer = /^\/offers\/([^/]+)$/.exec(path);
  if (offer) return `/offers/${offer[1]}`;
  const property = /^\/property\/([^/]+)$/.exec(path);
  if (property) {
    // Keep the stay a reminder links back to (e.g. an abandoned checkout):
    // the website's checkIn/checkOut/adults/rooms → the property screen's
    // checkIn/checkOut/guests/rooms params. Anything else is dropped.
    const from = new URLSearchParams(query ?? '');
    const to = new URLSearchParams();
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const checkIn = from.get('checkIn');
    const checkOut = from.get('checkOut');
    if (checkIn && checkOut && day.test(checkIn) && day.test(checkOut)) {
      to.set('checkIn', checkIn);
      to.set('checkOut', checkOut);
    }
    const guests = from.get('adults');
    if (guests && /^\d{1,2}$/.test(guests)) to.set('guests', guests);
    const rooms = from.get('rooms');
    if (rooms && /^\d{1,2}$/.test(rooms)) to.set('rooms', rooms);
    const qs = to.toString();
    return `/property/${property[1]}${qs ? `?${qs}` : ''}`;
  }
  return '/notifications';
}

export function businessRouteForNotification(target: NotificationTarget): string {
  if (target.type === 'support') return '/support';
  if (target.type === 'chat' && target.conversationId) return `/chats/${target.conversationId}`;
  if (target.bookingUuid && UUID_RE.test(target.bookingUuid)) return `/bookings/${target.bookingUuid}`;

  const parsed = pathOf(target.link);
  if (!parsed) return '/notifications';
  const { path } = parsed;

  if (path === '/bookings' || path === '/partner/bookings') return '/bookings';
  const booking = /^\/(?:partner\/)?bookings\/([^/]+)$/.exec(path);
  if (booking && UUID_RE.test(booking[1])) return `/bookings/${booking[1]}`;
  if (path === '/partner/properties' || path === '/properties') return '/properties';
  const property = /^\/partner\/propert(?:y|ies)\/([^/]+)$/.exec(path);
  if (property && UUID_RE.test(property[1])) return `/properties/${property[1]}`;
  if (path === '/partner/financial-affairs' || path === '/financials') return '/financials';
  if (path === '/partner/payouts' || path === '/payouts') return '/payouts';
  if (path === '/partner/chats' || path === '/chats' || path === '/messages') return '/chats';
  if (path === '/support') return '/support';
  return '/notifications';
}
