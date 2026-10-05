export const APP_NAME = 'ThisOne';

// The big buttons of the first page.
export const SIDES = [
  { to: '/user', label: 'User Side', icon: 'user', text: 'Bus seats, freight orders, searches and guard feedback' },
  { to: '/guard', label: 'Guard Side', icon: 'shield', text: 'Route operation, daily report and seat status' },
  { to: '/driver', label: 'Truck Driver Side', icon: 'truck', text: 'Operating status, daily report and transport commands' },
  { to: '/warehouse', label: 'Warehouse Manager Side', icon: 'warehouse', text: 'Ordered freight, sent and arrived status, daily report' },
  { to: '/park', label: 'Park Side', icon: 'park', text: 'In preparation' },
];

export const INFO = [
  { to: '/offices', label: 'Transport Office Information', icon: 'office', text: 'Offices and their warehouses by province' },
  { to: '/parks', label: 'Park Information', icon: 'pin', text: 'Parks and the buses that use them' },
];

export const ADMIN = { to: '/admin', label: 'Admin', icon: 'chart', text: 'Users, news, orders, payments and statistics' };

const ROLE_LINK = {
  guard: { to: '/guard', label: 'Guard', icon: 'shield' },
  driver: { to: '/driver', label: 'Driver', icon: 'truck' },
  warehouse: { to: '/warehouse', label: 'Warehouse', icon: 'warehouse' },
  admin: { to: '/admin', label: 'Admin', icon: 'chart' },
};

const HOME = { to: '/', label: 'Home', icon: 'home', end: true };
const USER = { to: '/user', label: 'User', icon: 'user' };
const PARKS = { to: '/parks', label: 'Parks', icon: 'pin' };
const OFFICES = { to: '/offices', label: 'Offices', icon: 'office' };

// Links of the desktop top bar; a guard, driver, warehouse manager or admin also gets their own side.
export function topLinks(user) {
  const own = ROLE_LINK[user?.role];
  return own ? [HOME, USER, own, PARKS, OFFICES] : [HOME, USER, PARKS, OFFICES];
}

// The phone's bottom bar has room for five, so the user's own side takes the place of Parks.
export function tabLinks(user) {
  return [
    HOME,
    USER,
    ROLE_LINK[user?.role] ?? PARKS,
    OFFICES,
    user ? { to: '/account', label: 'Account', icon: 'card' } : { to: '/login', label: 'Log in', icon: 'lock' },
  ];
}

export const ROLE_NAMES = {
  user: 'User',
  guard: 'Guard',
  driver: 'Truck Driver',
  warehouse: 'Warehouse Manager',
  admin: 'Admin',
};
