// These codes match the supplied backend's permission catalogue.
export const menuItems = [
  { label: 'Dashboard', path: '/dashboard', permission: 'dashboard.view' },
  { label: 'Cars', path: '/cars', permission: 'cars.view' },
  { label: 'Brands & models', path: '/brands', permission: 'cars.view' },
  { label: 'Rentals', path: '/rentals', permission: 'rentals.view' },
  { label: 'Customers', path: '/customers', permission: 'customers.view' },
  { label: 'Debts', path: '/debts', permission: 'debts.view' },
  { label: 'Fines & Accidents', path: '/fines', permission: 'fines.view' },
  { label: 'Reservations', path: '/reservations', permission: 'reservations.view' },
  { label: 'Delivery', path: '/delivery', permission: 'delivery.view' },
  { label: 'Support', path: '/support', permission: 'support.view' },
  { label: 'Tariffs', path: '/tariffs', permission: 'tariffs.view' },
  { label: 'Promotions', path: '/promotions', permission: 'promotions.view' },
  { label: 'Analytics', path: '/analytics', permission: 'analytics.view' },
  { label: 'Fleet', path: '/fleet', permission: 'fleet.view' },
  // No notifications.* grants exist in the mock catalogue. Use Settings grants
  // as the conservative UI policy until the backend defines dedicated grants.
  { label: 'Notifications', path: '/notifications', permission: 'settings.view' },
  { label: 'Settings', path: '/settings', permission: 'settings.view' },
  // The supplied catalogue has no operations module; use Fleet grants for these screens.
  { label: 'Operations', path: '/operations', permission: 'fleet.view' },
  { label: 'Admin management', path: '/admins', permission: 'admins.view' },
];
