/**
 * One key factory, imported by every domain hook module. Prevents the
 * "magic string" key drift that makes cache invalidation unreliable — every
 * key that touches a given resource is generated from the same function, so
 * invalidating `queryKeys.property(id)` can never accidentally miss a
 * differently-spelled key for the same data.
 */
export const queryKeys = {
  // Customer app
  properties: {
    all: ['properties'] as const,
    search: (params: Record<string, unknown>) => ['properties', 'search', params] as const,
    detail: (id: string) => ['properties', 'detail', id] as const,
    rooms: (id: string) => ['properties', 'detail', id, 'rooms'] as const,
    reviews: (id: string) => ['properties', 'detail', id, 'reviews'] as const,
  },
  // City landing-page data — fetched only to resolve a property's city to a
  // destination slug/name for "Other stays in {city}" (growth roadmap v2,
  // 2.2). No per-id variant: `GET /api/destinations` always returns the
  // full list, same as Nouzl_Platform's own `fetchDestinations()`.
  destinations: {
    all: ['destinations'] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    mine: ['bookings', 'mine'] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  loyalty: {
    summary: ['loyalty', 'summary'] as const,
    rewards: ['loyalty', 'rewards'] as const,
    vouchers: ['loyalty', 'vouchers'] as const,
  },
  notifications: {
    list: ['notifications'] as const,
    unreadCount: (userId: string) => ['notifications', 'unread-count', userId] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
  },
  wishlist: {
    // Bare property ids, for the heart-icon toggle state on Discover/Search
    // cards and property detail — cheap, and doesn't need currency-converted
    // card data. Scoped by userId, like `bookings.mine`/`profile.me`'s
    // siblings, so signing out and a different account signing in never
    // shows a stale wishlist. The dedicated Wishlist SCREEN's full
    // PropertyCard-shaped rows deliberately reuse `properties.search`'s own
    // key (via its `ids` param) rather than a separate key here — same
    // currency-converted, availability-checked shape, no reason to duplicate
    // the cache entry.
    ids: (userId: string) => ['wishlist', 'ids', userId] as const,
    // Per-item price-alert state, separate from `ids` because only the
    // Wishlist screen needs it — a heart icon on a Discover card does not,
    // and folding it into `ids` would make every card re-render carry it.
    alerts: (userId: string) => ['wishlist', 'alerts', userId] as const,
  },

  // Business app
  partner: {
    dashboard: ['partner', 'dashboard'] as const,
    // `partnerId` is the delegated-employee context from usePartnerContext()
    // — `undefined` (acting as self) and a real id must cache separately so
    // switching context never shows a stale list from the previous one.
    properties: (partnerId?: string) => ['partner', 'properties', partnerId ?? 'self'] as const,
    property: (id: string) => ['partner', 'properties', 'detail', id] as const,
    bookings: (filters?: Record<string, unknown>) => ['partner', 'bookings', filters ?? {}] as const,
    employeePartners: ['partner', 'employee-partners'] as const,
    pendingInvitations: ['partner', 'pending-invitations'] as const,
    permits: (partnerId?: string) => ['partner', 'properties', 'permits', partnerId ?? 'self'] as const,
    booking: (id: string) => ['partner', 'bookings', 'detail', id] as const,
    // The inventory behind the "new booking" form. Keyed on the delegated
    // context for the same reason `properties` is — an employee switching
    // employers must not see the previous one's units.
    bookableProperties: (partnerId?: string) => ['partner', 'bookings', 'bookable', partnerId ?? 'self'] as const,
    roomsForProperty: (propertyId: string) => ['partner', 'pricing', 'rooms', propertyId] as const,
    pricing: (roomId: number, year: number, month: number) => ['partner', 'pricing', 'calendar', roomId, year, month] as const,
    payouts: ['partner', 'payouts'] as const,
    bankAccounts: ['partner', 'bank-accounts'] as const,
    availableBalance: ['partner', 'available-balance'] as const,
    withdrawals: ['partner', 'withdrawals'] as const,
    earnings: (filters?: Record<string, unknown>) => ['partner', 'earnings', filters ?? {}] as const,
    employees: ['partner', 'employees'] as const,
    loyaltyPerks: ['partner', 'loyalty', 'perks'] as const,
    loyaltySettings: ['partner', 'loyalty', 'settings'] as const,
    loyaltyFulfilments: ['partner', 'loyalty', 'fulfilments'] as const,
    ratings: ['partner', 'ratings'] as const,
    listingAnalytics: (days: number, partnerId?: string) => ['partner', 'listing-analytics', days, partnerId ?? 'self'] as const,
    conversations: ['partner', 'chat', 'conversations'] as const,
    messages: (conversationId: string) => ['partner', 'chat', 'messages', conversationId] as const,
  },
} as const;
