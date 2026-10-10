/**
 * Generated request/response types live in ./openapi.ts, produced by
 * `npm run generate --workspace=@nouzl/types` against Nouzl_Backend's
 * OpenAPI document (served at /api/docs-json once B6 — see
 * Nouzl_Backend/src/main.ts's SwaggerModule.setup() — is running locally).
 * Re-exported below as the `OpenAPI` namespace rather than flattened with
 * `export *` — the generated file's `paths`/`components`/`operations`
 * names would otherwise collide with (or silently shadow) the hand-written
 * domain types in this file. Use it as `OpenAPI.paths['/partner/ratings']
 * ['get']['responses'][200]['content']['application/json']`, or narrow via
 * `OpenAPI.components['schemas']['SomeDto']` for a single DTO.
 *
 * Coverage has grown well past the "~20 DTOs" this note originally
 * described as controllers picked up @ApiTags/@ApiOperation decorators —
 * regenerate periodically (see the script above) rather than trusting this
 * comment's history for current coverage. Hand-written domain types below
 * still exist for everything the generator doesn't reach yet, and for
 * response shapes it's simpler to consume flattened than through the
 * generated `paths` indexing.
 */
export * as OpenAPI from './openapi';

export interface Property {
  id: string;
  name: string;
  type: 'Hotel' | 'Apartment' | 'Resort' | 'Guesthouse' | 'BreakNouzl';
  status: 'Active' | 'Pending' | 'Suspended';
  ownerId: string;
}

/** Mirrors PointsService.getLoyaltySummary() — GET /api/points/summary. */
export interface LoyaltySummary {
  balance: number;
  pending: number;
  tier: 'classic' | 'silver' | 'gold' | 'platinum';
  completedStays: number;
  staysToNextTier: number | null;
  nextTier: 'silver' | 'gold' | 'platinum' | null;
  balanceValue: number;
  currency: string;
  pointValue: number;
  earnRate: number;
}

/**
 * Mirrors Nouzl_Backend's src/partner/services/partner-overview.service.ts
 * OverviewStats — kept in sync by hand until B6's OpenAPI generation covers
 * this controller too.
 */
export interface PartnerOverviewStats {
  totalProperties: number;
  confirmedBookings: number;
  revenuePaid: number;
  vatCollected: number;
  currency: string;
  availableUnits: number;
  occupancyPercent: number;
  propertyTypeBreakdown: { type: string; count: number }[];
  bookingsPerProperty: { name: string; count: number }[];
  revenueTrend: { month: string; revenue: number }[];
  recentBookings: {
    id: string;
    guestName: string;
    propertyName: string;
    checkIn: string;
    checkOut: string;
    status: string | null;
    amount: number;
    currency: string;
  }[];
  upcomingCheckIns: { id: string; guestName: string; propertyName: string; checkIn: string }[];
  alerts: { tone: 'warning' | 'danger'; textAr: string; textEn: string }[];
  topProperties: { name: string; revenue: number; bookings: number }[];
}

/**
 * Mirrors Nouzl_Backend's src/partner/utils/listing-analytics.util.ts — the
 * per-listing traffic funnel behind GET /partner/overview/listings (growth
 * roadmap v2, 3.8).
 */
export interface ListingFunnel {
  views: number;
  visitors: number;
  wishlistAdds: number;
  checkoutStarts: number;
  bookings: number;
  /** 0..1, or null below 30 visitors — the backend withholds it on thin
   *  data, so never compute it on the client. */
  conversion: number | null;
}

export const LISTING_ANALYTICS_WINDOWS = [7, 30, 90] as const;
export type ListingAnalyticsWindow = (typeof LISTING_ANALYTICS_WINDOWS)[number];

export interface ListingAnalytics {
  totals: ListingFunnel;
  /** Every listing the partner owns, zero-traffic ones included, most-viewed first. */
  properties: (ListingFunnel & { id: string; name: string })[];
  days: number;
  /** YYYY-MM-DD, the first day of the window. */
  since: string;
  /** YYYY-MM-DD, the first day any traffic was recorded platform-wide
   *  (collection began 2026-09-16); null before any exists. */
  trackingSince: string | null;
}

/**
 * Mirrors GET /api/properties/search's per-property result — the spread of
 * the base `properties` row plus the computed stay quote. Field names match
 * Nouzl_Backend/src/properties/repositories/properties-search.repository.ts's
 * explicit column list exactly (verified against information_schema there —
 * do not add fields on a guess, an unlisted column 400s the whole query).
 */
export interface PropertySearchResult {
  id: string;
  name: string;
  type: string;
  status: string | null;
  // No `base_price`. The column is NULL on all 62 production properties and the
  // backend no longer selects it (see properties-search.repository.ts). A
  // result's price is `stayTotal` / `stayPerNight` / `stayCurrency` below,
  // computed from the property's rooms — never from a property-level column.
  currency: string | null;
  photos: string[] | null;
  logo: string | null;
  description: string | null;
  address: { city: string | null; country: string | null; latitude: number | null; longitude: number | null; street: string | null } | null;
  stayTotal: number | null;
  stayPerNight: number | null;
  stayCurrency: string | null;
  nights: number;
  hasAvailability: boolean;
  averageRating: number | null;
  reviewCount: number;
  distanceKm: number | null;
  /**
   * "Popular this week" (growth roadmap v2, 2.3). Set by the backend ONLY
   * when true — absent, never `false` — so read it as a plain truthiness
   * check and never as a tri-state.
   *
   * The badge's whole meaning comes from the server-side rule in
   * `Nouzl_Backend`'s `popular-properties.ts`: >= 10 unique viewers over 7
   * days AND inside the top 6 overall. The cap is what keeps it scarce, so
   * a client must NEVER derive this from a view count of its own — a card
   * that decided for itself would hand the badge to every listing on a busy
   * week and mean nothing.
   */
  isPopularThisWeek?: boolean;
  /** `properties.specail` — yes, that's the actual (misspelled) column name;
   *  matches Nouzl_Platform's own `property?.specail` verbatim. */
  specail: boolean | null;
  /** Which BNPL gateways this property accepts, e.g. `['tamara-instalments',
   *  'pay-at-property']` — drives the payment-method logo row on the card. */
  payment_methods: string[] | null;
  /**
   * How to read stayTotal/stayPerNight (2026-09-26): 'stay' = a dated search,
   * stayTotal is the total for `nights` (discounts and long-stay offer
   * included); 'from' = undated, the cheapest bookable night in the next 30
   * days. Absent on an older backend — treat as today's behaviour.
   */
  priceBasis?: 'stay' | 'from';
  /** Dated: the same stay before any discount, for a struck-through price. */
  stayOriginalTotal?: number | null;
  /** Undated: the date the "from" price applies to. */
  fromDate?: string;
  /** Undated: tonight's cheapest bookable price, when tonight is bookable. */
  tonightPerNight?: number | null;
  tonightCurrency?: string | null;
  /** VAT display facts for this property (see apps/customer lib/guestVat.ts). */
  guestVat?: GuestVatInfo;
}

/** Per-property VAT display facts from Nouzl_Backend (PropertyVatRepository.getGuestVatInfo). */
export interface GuestVatInfo {
  vatMode: 'exclusive' | 'inclusive' | 'exempt';
  /** Rate to add for display; null = the property's country is unknown. */
  guestVatRate: number | null;
  /** The displayed figure contains VAT, so it may be labelled "incl. VAT". */
  vatIncluded: boolean;
}

export interface PropertySearchResponse {
  data: PropertySearchResult[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stay: { checkIn: string | null; checkOut: string | null; nights: number };
  dateFiltered: boolean;
}

/** Mirrors PartnerBookingsService.VerifiedBooking. */
export interface PartnerVerifiedBooking {
  id: string;
  bookingRef: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guests: number | null;
  propertyName: string;
  roomLabel: string | null;
  checkIn: string;
  checkOut: string;
  status: string | null;
  totalPrice: number;
  currency: string;
}

/** Mirrors PayoutsService.maskBankAccount()'s output — `partner_bank_accounts`
 * with iban/account_number/stc_pay_mobile_number masked server-side. Never
 * request or render the unmasked value; the backend never sends it back. */
export interface PartnerBankAccount {
  id: string;
  partner_id: string;
  payout_method: 'bank' | 'stc_pay';
  bank_name: string | null;
  account_holder_name: string;
  iban: string | null;
  account_number: string | null;
  stc_pay_mobile_number: string | null;
  currency: string;
  is_default: boolean;
  status: 'active' | 'archived';
  created_at: string;
}

/** Mirrors PayoutsService.getAvailableBalance()'s per-currency breakdown. */
export interface PartnerCurrencyBalance {
  currency: string;
  grossAvailable: number;
  feeRate: number;
  feeAmount: number;
  netAvailable: number;
  bookingCount: number;
  vatAvailable: number;
  partnerEarningsAvailable: number;
}

/** Mirrors the `partner_withdrawals` row returned by listWithdrawals/createWithdrawal. */
export interface PartnerWithdrawal {
  id: string;
  partner_id: string;
  bank_account_id: string;
  amount_gross: number;
  fee_rate: number;
  fee_amount: number;
  amount_net: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  booking_ids: string[];
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  bank_account: PartnerBankAccount | null;
}

/** Mirrors one row of PayoutsService.getPartnerEarnings()'s `rows` array. */
export interface PartnerEarningRow {
  bookingId: string | null;
  bookingUuid: string;
  createdAt: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  status: string | null;
  guestName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  propertyType: string | null;
  currency: string;
  estimated: boolean;
  guestTotal: number;
  partnerEarnings: number;
  vat: number;
  nouzlCommission: number;
  nouzlCommissionVat: number;
  payoutStatus: string;
  paymentMethod: string | null;
}

/** Mirrors one row of PayoutsService.getPartnerEarnings()'s `totals` array —
 * one bucket per currency, deliberately never blended (see the mobile plan's
 * "Financials rule to carry verbatim"). */
export interface PartnerEarningsTotal {
  currency: string;
  bookingCount: number;
  guestTotal: number;
  partnerEarnings: number;
  vat: number;
  nouzlCommission: number;
  nouzlCommissionVat: number;
  availableEarnings: number;
  requestedEarnings: number;
  paidEarnings: number;
}

export interface PartnerEarningsResponse {
  rows: PartnerEarningRow[];
  totals: PartnerEarningsTotal[];
  meta: { bookingCount: number; estimatedCount: number; scope: 'settled' | 'all' };
}

/** Mirrors EmployeeWithProfile from Nouzl_Backend's partner-employees module. */
export interface PartnerEmployee {
  id: string;
  partner_id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'active' | 'declined';
  agreement: boolean;
  invitation_token: string | null;
  created_at: string;
  updated_at: string;
  employee_profile?: { full_name: string; email: string };
}

/** The domain:action roles a dashboard can actually issue — the legacy
 * whole-area roles (manage_properties/finance/bookings) still validate
 * server-side but are never offered as a choice for a NEW employee. */
export const PARTNER_EMPLOYEE_ROLES = [
  'bookings:read',
  'bookings:write',
  'properties:read',
  'properties:write',
  'pricing:read',
  'pricing:write',
  'licenses:read',
  'licenses:write',
  'finance:read',
  'finance:write',
] as const;
export type PartnerEmployeeRole = (typeof PARTNER_EMPLOYEE_ROLES)[number];

/** Mirrors PartnerLoyaltyService.listAvailablePerks()'s `loyalty_rewards` rows. */
export interface LoyaltyPerk {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
  points_cost: number;
  value_amount: number | null;
  currency: string | null;
}

/** Mirrors PartnerLoyaltyService.getSettingsForPartner()'s per-property row. */
export interface PartnerLoyaltySetting {
  property_id: string;
  property_name: string;
  perks_enabled: string[];
  bonus_multiplier: number;
  bonus_starts_at: string | null;
  bonus_ends_at: string | null;
  member_rate_percent: number;
  member_rate_min_tier: 'silver' | 'gold' | 'platinum' | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  review_note: string | null;
}

/** Mirrors PartnerLoyaltyService's PerkFulfilment. */
export interface PerkFulfilment {
  voucherId: string;
  code: string;
  rewardId: string;
  rewardTitleAr: string;
  rewardTitleEn: string;
  bookingRef: string | null;
  bookingId: string | null;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  propertyName: string | null;
  fulfilledAt: string | null;
}

/** Mirrors Nouzl_Backend's new PartnerRatingsService.RatingRow (B3 addition
 * for the mobile plan — the web app read this directly off Supabase with a
 * self-signed JWT the mobile app must never hold). */
export interface PartnerRating {
  id: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  rate: number;
  feedback: string;
  createdAt: string;
  reply: string | null;
  /** Optional per-category scores (1–5) the guest gave; absent from older backends. */
  scores?: Partial<Record<'cleanliness' | 'location' | 'value' | 'communication', number>>;
}

export interface PartnerRatingSummary {
  propertyId: string;
  propertyName: string;
  average: number;
  count: number;
}

/** Shared guest<->partner chat shape — `public.conversations` / `public.messages`.
 * Text-only for this pass; see Nouzl_Platform's src/types/chat.ts for the
 * full attachment-bearing shape a later pass can add without a schema change. */
export type MessageSenderRole = 'guest' | 'partner';

export interface ChatConversation {
  id: string;
  property_id: string;
  guest_id: string;
  partner_id: string;
  booking_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  guest_unread_count: number;
  partner_unread_count: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: MessageSenderRole;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface GuestConversationSummary extends ChatConversation {
  property: {
    id: string;
    name: string | null;
    owner: { full_name: string | null; avatar_url?: string | null } | null;
  } | null;
}

export interface PartnerConversationSummary extends ChatConversation {
  property: { id: string; name: string | null } | null;
  guest: { full_name: string | null; avatar_url?: string | null } | null;
}

/** Mirrors PartnerBookingsService.BookingRow — GET /partner/bookings. */
export interface PartnerBookingRow {
  id: string;
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  status: string | null;
  totalPrice: number;
  currency: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  createdAt: string | null;
  fromHour: string | null;
  toHour: string | null;
  propertyType: string | null;
  userId: string | null;
  phoneNumber: string | null;
  /** The booked unit — its partner-given name and type (identifies an hourly
   * unit inside an ordinary Hotel/Resort). */
  roomLabel?: string | null;
  roomType?: string | null;
  /** For a pending Break Nouzl pay-at-property request, the partner's
   * 30-minute acceptance deadline. */
  expiresAt?: string | null;
  guests?: number | null;
  /** Why it was cancelled (backend migration 20261005100000) — show it with
   * @nouzl/breaknouzl cancellationReasonText(reason, 'partner', isArabic). */
  cancellationReason?: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Partner-direct bookings — the partner records a booking for their OWN
 * customer, at a reduced commission (Nouzl did not acquire that customer).
 * Backend: Nouzl_Backend/src/bookings/{controllers,services}/partner-direct-*.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One bookable unit — GET /partner-bookings/bookable-properties. */
export interface PartnerBookableUnit {
  id: number;
  label: string;
  /** Per NIGHT, except an hourly unit where it is per HOUR. */
  price: number;
  currency: string;
  quantity: number;
  /**
   * Hourly by EITHER route — a `break_nuzul*` room type, or a listing in the
   * legacy `BreakNouzl` property category. Resolved server-side per UNIT,
   * because Break Nouzl is a room a partner adds to any property and that is
   * how they actually exist (the one in production sits inside a Resort).
   */
  isHourly: boolean;
  baseDuration: number | null;
  allowedDurations: number[] | null;
  availableFrom: string | null;
  availableTo: string | null;
  hourlyRates: Record<number, number> | null;
  /** The unit's own refundable deposit, taken at the property — never part of the charged total. */
  deposit: { amount: number; currency: string } | null;
  /**
   * Exactly the methods THIS unit can be booked with, resolved server-side by
   * the same function the create endpoint enforces. Pick from this, never from
   * `PartnerBookableProperty.paymentMethods` — the rule is per unit (a room's
   * own list overrides its property's, and an hourly room is prepaid-only).
   */
  paymentMethods: string[];
}

export interface PartnerBookableProperty {
  id: string;
  name: string;
  type: string;
  currency: string;
  /** The union across its units — for display only. A form must pick from `PartnerBookableUnit.paymentMethods`. */
  paymentMethods: string[];
  units: PartnerBookableUnit[];
}

/** The engine breakdown a quote carries. Every figure is server-computed; the app formats and never recalculates. */
export interface PartnerDirectFinancials {
  accommodationSubtotal: number;
  accommodationDiscount: number;
  taxableAccommodationAmount: number;
  accommodationVatRate: number;
  accommodationVatAmount: number;
  guestTotal: number;
  platformCommissionRate: number;
  platformCommissionAmount: number;
  platformVatAmount: number;
  platformCommissionTotal: number;
  paymentGatewayFeeAmount: number;
  paymentGatewayFixedFee: number;
  grandTotal: number;
  amountPaidByGuest: number;
  amountDueAtProperty: number;
  partnerNetSettlement: number;
  currency: string;
}

/** POST /partner-bookings/quote. */
export interface PartnerDirectQuote {
  accommodationSubtotal: number;
  nights: number;
  /** Break Nouzl only — whole hours booked. 0 for a nightly stay. */
  hours: number;
  hourly: boolean;
  currency: string;
  couponApplied: boolean;
  financials: PartnerDirectFinancials;
  standardChannelCommissionTotal: number;
  standardChannelCommissionRate: number;
  commissionSaving: number;
}

/** POST /partner-bookings/create. */
export interface PartnerDirectCreateResult {
  bookingId: string;
  bookingNumber: string;
  status: string;
  /** Present for an online payment method — the gateway link to send the customer. */
  paymentUrl?: string;
}

/** Mirrors PartnerBookingsService.BookingDetail — GET /partner/bookings/:id. */
export interface PartnerBookingDetail {
  id: string;
  bookingId: string | null;
  guestName: string;
  phone: string | null;
  guests: number;
  rooms: number | null;
  fromHour?: string | null;
  toHour?: string | null;
  status: string | null;
  /** See PartnerBookingRow.expiresAt. */
  expiresAt?: string | null;
  /** See PartnerBookingRow.cancellationReason. */
  cancellationReason?: string | null;
  checkIn: string;
  checkOut: string;
  createdAt: string | null;
  totalPrice: number;
  paymentMethod: string | null;
  paymentCurrency: string;
  paymentAmount: number | null;
  room: { type: string | null; label: string | null } | null;
  property: {
    id: string;
    name: string;
    type: string;
    currency: string;
    cancellationPolicy: string | null;
    photo: string | null;
    city: string | null;
    country: string | null;
    amenities: string[];
    ownerId: string;
  };
}

/**
 * The partner-initiated status transitions PATCH /partner/bookings/:id/status
 * accepts. `accepted` answers a Break Nouzl pay-at-property request (409 once
 * its 30-minute window has passed or it was cancelled).
 */
export const PARTNER_BOOKING_STATUS_ACTIONS = ['accepted', 'confirmed', 'deposit', 'noattend', 'cancelled'] as const;
export type PartnerBookingStatusAction = (typeof PARTNER_BOOKING_STATUS_ACTIONS)[number];

/** Mirrors PartnerPropertiesService.PartnerPropertySummary — GET /partner/properties. */
export interface PartnerPropertySummary {
  id: string;
  name: string;
  type: string;
  status: string | null;
  city: string | null;
  logo: string | null;
  photo: string | null;
  roomCount: number;
  /**
   * Facts the listing-quality score is computed from (`@nouzl/partner-setup`'s
   * `scoreListingQuality`). Optional because a backend deployed before
   * 2026-09-22 omits it — the app then shows no score rather than a wrong one.
   */
  qualityInputs?: {
    photoCount: number;
    descriptionLength: number;
    amenityCount: number;
    hasCancellationPolicy: boolean;
    pricedDaysInNext60: number;
    hasCurrentPermit: boolean;
    hasCoordinates: boolean;
  };
}

export interface PartnerRoomTypeRow {
  id: number | null;
  label: string | null;
  type: string | null;
  price: number | null;
  currency: string | null;
  quantity: number | null;
  beds: number | null;
  bathrooms: number | null;
  maxOccupancy: number | null;
  size: number | null;
  duration: number | null;
  allowedDurations: number[] | null;
  availableFrom: string | null;
  availableTo: string | null;
  hourlyRates: Record<string, unknown> | null;
  photos: string[];
}

/** Mirrors PartnerPropertiesService.PropertyDetail — GET /partner/properties/:id. */
export interface PartnerPropertyDetail {
  id: string;
  name: string;
  type: string;
  status: string | null;
  currency: string | null;
  createdAt: string | null;
  description: string | null;
  photos: string[];
  video: string | null;
  amenities: string[];
  checkInTimeFrom: string | null;
  checkInTimeTo: string | null;
  checkOutTimeFrom: string | null;
  checkOutTimeTo: string | null;
  cancellationPolicy: string | null;
  hasInsurance: boolean | null;
  insuranceAmount: number | null;
  paymentMethods: string[];
  address: { street: string; city: string; country: string | null; latitude: number | null; longitude: number | null } | null;
  contact: {
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    bookingPhone: string | null;
    receptionPhone: string | null;
  } | null;
  permits: {
    commerce_number: number | null;
    commerceExpiry: string | null;
    tourism_number: number | null;
    tourismExpiry: string | null;
    covered_by_property_id: string | null;
  }[];
  rooms: PartnerRoomTypeRow[];
  stats: { totalBookings: number; upcomingBookings: number };
  ownerId: string;
}

/** Mirrors PartnerPricingService.RoomOption — GET /partner/pricing/properties/:propertyId/rooms. */
export interface PartnerRoomOption {
  id: number;
  label: string | null;
  /** Per NIGHT for every category except BreakNouzl, where it is per HOUR. */
  price: number;
  currency: string;
  quantity: number;
  isHourly: boolean;
  baseDuration: number | null;
  allowedDurations: number[] | null;
  availableFrom: string | null;
  availableTo: string | null;
  propertyId: string;
  ownerId: string;
}

export interface PartnerDayPricing {
  price: number;
  quantity: number;
  available: boolean;
}

/** Mirrors PartnerPricingService.CalendarData — GET /partner/pricing/rooms/:roomId/calendar. */
export interface PartnerCalendarData {
  daysInMonth: Record<string, PartnerDayPricing>;
  bookedDates: string[];
}

/** A partner account the current user works for as a delegated employee.
 *  Mirrors PartnerEmployeesRepository.getEmployeePartners()'s row — GET
 *  /partner-employees/employee-partners. Only rows with `agreement: true`
 *  and `status: 'active'` are returned by that endpoint, so every row here
 *  is a live delegation, never a pending invite. */
export interface EmployeePartner {
  id: string;
  role: string | null;
  roles: string[] | null;
  partner_id: string;
  status: string;
  agreement: boolean;
  created_at: string;
  partner: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
}

/** Mirrors PartnerPropertiesService.PartnerPropertyPermitSummary — GET
 *  /partner/properties/permits. */
export interface PartnerPropertyPermitSummary {
  propertyId: string;
  propertyName: string;
  commerceNumber: number | null;
  commerceExpiry: string | null;
  tourismNumber: number | null;
  tourismExpiry: string | null;
  coveredByPropertyId: string | null;
  coveredByPropertyName: string | null;
}
