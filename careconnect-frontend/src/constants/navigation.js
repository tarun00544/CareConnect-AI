import { ROLES } from './index';

// One nav configuration per role. `icon` is a key into components/layout/navIcons.js.
// Only routes that are actually implemented in routes/AppRoutes.jsx are listed.
const item = (to, label, icon, extra = {}) => ({ to, label, icon, ...extra });

const p = '/patient';
const d = '/doctor';
const h = '/hospital-admin';
const ph = '/pharmacy-admin';
const s = '/super-admin';

export const NAV_BY_ROLE = {
  [ROLES.PATIENT]: [
    item(`${p}/dashboard`, 'Overview', 'dashboard'),
    item(`${p}/doctors`, 'Find Doctors', 'doctor'),
    item(`${p}/appointments`, 'Appointments', 'calendar'),
    item(`${p}/ai`, 'AI Assistant', 'ai', { end: true }),
    item(`${p}/report-comparison`, 'Report Comparison', 'compare'),
    item(`${p}/timeline`, 'My Health Journey', 'timeline'),
    item(`${p}/navigation`, 'Patient Navigation', 'navigation'),
    item(`${p}/follow-ups`, 'Follow-ups', 'followup'),
    item(`${p}/prescriptions`, 'Prescriptions', 'prescription'),
    item(`${p}/reminders`, 'Medicine Reminders', 'reminders'),
    item(`${p}/pharmacy`, 'Pharmacy', 'pharmacy', { cart: true }),
    item(`${p}/orders`, 'Orders', 'orders'),
    item(`${p}/admission`, 'Admissions', 'admission'),
    item(`${p}/chat`, 'Chat', 'chat', { badge: 'messages' }),
    item(`${p}/video`, 'Video Consultation', 'video'),
    item(`${p}/payments`, 'Payments', 'payments'),
    item(`${p}/notifications`, 'Notifications', 'bell', { badge: 'notifications' }),
    item(`${p}/emergency`, 'Emergency', 'emergency', { danger: true }),
    item(`${p}/profile`, 'Profile', 'profile'),
    item(`${p}/settings`, 'Settings', 'settings'),
  ],
  [ROLES.DOCTOR]: [
    item(`${d}/dashboard`, 'Overview', 'dashboard'),
    item(`${d}/appointments`, 'My Appointments', 'calendar'),
    item(`${d}/patients`, 'My Patients', 'patients'),
    item(`${d}/patient-navigation`, 'Patient Navigation', 'navigation'),
    item(`${d}/report-comparison`, 'Medical Report Comparison', 'compare'),
    item(`${d}/ai-copilot`, 'AI Copilot', 'copilot'),
    item(`${d}/consultations`, 'Consultation', 'consult'),
    item(`${d}/follow-ups`, 'Follow-up Manager', 'followup'),
    item(`${d}/referrals`, 'Referrals', 'referral'),
    item(`${d}/prescriptions`, 'Prescriptions', 'prescription'),
    item(`${d}/availability`, 'Availability', 'clock'),
    item(`${d}/chat`, 'Chat', 'chat', { badge: 'messages' }),
    item(`${d}/video`, 'Video Consultation', 'video'),
    item(`${d}/notifications`, 'Notifications', 'bell', { badge: 'notifications' }),
    item(`${d}/profile`, 'Profile', 'profile'),
    item(`${d}/settings`, 'Settings', 'settings'),
  ],
  [ROLES.HOSPITAL_ADMIN]: [
    item(`${h}/dashboard`, 'Dashboard', 'dashboard'),
    item(`${h}/patients`, 'Patients', 'patients', { locked: true }),
    item(`${h}/doctors`, 'Doctors', 'doctor'),
    item(`${h}/appointments`, 'Appointments', 'calendar'),
    item(`${h}/admissions`, 'Admissions', 'admission'),
    item(`${h}/beds`, 'Beds', 'bed'),
    item(`${h}/emergency`, 'Emergency', 'emergency', { danger: true }),
    item(`${h}/analytics`, 'Analytics', 'analytics'),
    item(`${h}/profile`, 'Profile', 'profile'),
    item(`${h}/settings`, 'Settings', 'settings'),
  ],
  [ROLES.PHARMACY_ADMIN]: [
    item(`${ph}/dashboard`, 'Dashboard', 'dashboard'),
    item(`${ph}/medicines`, 'Medicines', 'pharmacy'),
    item(`${ph}/inventory`, 'Inventory', 'inventory'),
    item(`${ph}/orders`, 'Orders', 'orders'),
    item(`${ph}/profile`, 'Profile', 'profile'),
    item(`${ph}/settings`, 'Settings', 'settings'),
  ],
  [ROLES.SUPER_ADMIN]: [
    item(`${s}/dashboard`, 'Dashboard', 'dashboard'),
    item(`${s}/users`, 'Users', 'users'),
    item(`${s}/doctors`, 'Doctors', 'doctor'),
    item(`${s}/patients`, 'Patients', 'patients'),
    item(`${s}/appointments`, 'Appointments', 'calendar'),
    item(`${s}/admissions`, 'Admissions', 'admission'),
    item(`${s}/beds`, 'Beds', 'bed'),
    item(`${s}/emergency`, 'Emergency', 'emergency', { danger: true }),
    item(`${s}/analytics`, 'Analytics', 'analytics'),
    item(`${s}/profile`, 'Profile', 'profile'),
    item(`${s}/settings`, 'Settings', 'settings'),
  ],
};

// The five items shown in the mobile bottom bar (the rest live in the drawer under "More").
export const MOBILE_PRIMARY = {
  [ROLES.PATIENT]: ['dashboard', 'ai', 'calendar', 'pharmacy', 'chat'],
  [ROLES.DOCTOR]: ['dashboard', 'calendar', 'patients', 'chat', 'consult'],
  [ROLES.HOSPITAL_ADMIN]: ['dashboard', 'calendar', 'admission', 'bed', 'emergency'],
  [ROLES.PHARMACY_ADMIN]: ['dashboard', 'pharmacy', 'inventory', 'orders'],
  [ROLES.SUPER_ADMIN]: ['dashboard', 'users', 'calendar', 'bed', 'analytics'],
};

export const PUBLIC_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/departments', label: 'Departments' },
  { to: '/pharmacy', label: 'Pharmacy' },
];

export const BREADCRUMB_LABELS = {
  patient: 'Patient', doctor: 'Doctor', 'hospital-admin': 'Hospital Admin', 'pharmacy-admin': 'Pharmacy Admin', 'super-admin': 'Super Admin',
  dashboard: 'Dashboard', ai: 'AI Assistant', 'report-analysis': 'Report Analysis', doctors: 'Doctors', departments: 'Departments',
  appointments: 'Appointments', book: 'Book', chat: 'Chat', video: 'Video Consultation', prescriptions: 'Prescriptions',
  reminders: 'Medicine Reminders',
  pharmacy: 'Pharmacy', cart: 'Cart', checkout: 'Checkout', orders: 'Orders', admission: 'Admission', records: 'Medical Records',
  timeline: 'Care Timeline', payments: 'Payments', notifications: 'Notifications', emergency: 'Emergency', profile: 'Profile',
  settings: 'Settings', patients: 'Patients', availability: 'Availability', consultations: 'Consultations', admissions: 'Admissions',
  beds: 'Beds', analytics: 'Analytics', users: 'Users', medicines: 'Medicines', inventory: 'Inventory', new: 'New',
};
