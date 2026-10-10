import { describe, expect, it } from 'vitest';
import { businessRouteForNotification, customerRouteForNotification, notificationTargetFromData } from './notificationRoutes';

const UUID = '0b6c3c8e-1f2a-4c5d-9e8f-1a2b3c4d5e6f';

describe('customerRouteForNotification', () => {
  it('opens the exact booking or chat when the push names one', () => {
    expect(customerRouteForNotification({ type: 'booking', link: '/user/reservations', bookingUuid: UUID })).toBe(`/reservation/${UUID}`);
    expect(customerRouteForNotification({ type: 'chat', conversationId: 'c1' })).toBe('/chat/c1');
    expect(customerRouteForNotification({ type: 'support', link: '/support' })).toBe('/support');
  });

  it('maps the website links stored on live rows', () => {
    expect(customerRouteForNotification({ link: '/user/reservations' })).toBe('/trips');
    expect(customerRouteForNotification({ link: '/reservation/N101' })).toBe('/trips');
    expect(customerRouteForNotification({ link: `/reservation/${UUID}` })).toBe(`/reservation/${UUID}`);
    expect(customerRouteForNotification({ link: '/user/profile' })).toBe('/profile');
    expect(customerRouteForNotification({ link: '/user/event-bookings' })).toBe('/event-bookings');
    expect(customerRouteForNotification({ link: '/search?adults=1' })).toBe('/search-results?adults=1');
  });

  it('falls back to the list for anything unknown or unsafe', () => {
    expect(customerRouteForNotification({ link: '/host/experiences' })).toBe('/notifications');
    expect(customerRouteForNotification({ link: 'https://evil.example' })).toBe('/notifications');
    expect(customerRouteForNotification({ link: '//evil.example' })).toBe('/notifications');
    expect(customerRouteForNotification({ bookingUuid: 'N101' })).toBe('/notifications');
    expect(customerRouteForNotification({})).toBe('/notifications');
  });
});

describe('businessRouteForNotification', () => {
  it('opens the exact booking or chat when the push names one', () => {
    expect(businessRouteForNotification({ type: 'booking', link: '/bookings', bookingUuid: UUID })).toBe(`/bookings/${UUID}`);
    expect(businessRouteForNotification({ type: 'chat', conversationId: 'c1' })).toBe('/chats/c1');
  });

  it('maps the website links stored on live rows', () => {
    expect(businessRouteForNotification({ link: '/bookings' })).toBe('/bookings');
    expect(businessRouteForNotification({ link: '/partner/bookings' })).toBe('/bookings');
    expect(businessRouteForNotification({ link: '/partner/properties' })).toBe('/properties');
    expect(businessRouteForNotification({ link: `/partner/property/${UUID}` })).toBe(`/properties/${UUID}`);
    expect(businessRouteForNotification({ link: '/partner/financial-affairs' })).toBe('/financials');
  });

  it('falls back to the list for anything unknown', () => {
    expect(businessRouteForNotification({ link: '/user/reservations' })).toBe('/notifications');
    expect(businessRouteForNotification({ link: null })).toBe('/notifications');
  });
});

describe('notificationTargetFromData', () => {
  it('reads only string fields', () => {
    expect(notificationTargetFromData({ type: 'chat', conversationId: 'c1', link: 5, bookingUuid: '' })).toEqual({
      type: 'chat',
      link: null,
      bookingUuid: null,
      conversationId: 'c1',
    });
    expect(notificationTargetFromData(null)).toEqual({});
  });
});

describe('customerRouteForNotification — property links keep the stay', () => {
  it('maps the website stay params onto the property screen', () => {
    expect(
      customerRouteForNotification({
        link: `/property/${UUID}?checkIn=2026-10-10&checkOut=2026-10-12&adults=2&rooms=1&utm_source=reminder`,
      }),
    ).toBe(`/property/${UUID}?checkIn=2026-10-10&checkOut=2026-10-12&guests=2&rooms=1`);
  });

  it('drops malformed values and plain links stay plain', () => {
    expect(customerRouteForNotification({ link: `/property/${UUID}?checkIn=x&checkOut=y&adults=lots` })).toBe(`/property/${UUID}`);
    expect(customerRouteForNotification({ link: `/property/${UUID}` })).toBe(`/property/${UUID}`);
  });
});
