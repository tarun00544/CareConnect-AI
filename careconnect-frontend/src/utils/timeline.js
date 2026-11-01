import { CalendarDays, ClipboardList, FlaskConical, HeartPulse, ShoppingBag, CreditCard } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { createElement } from 'react';
import { appointmentStart, formatDate, formatDay, formatTimeRange, shortId, formatCurrency, paiseToRupees } from './format';

/**
 * Builds a chronological care timeline ONLY from records the backend returned.
 * No events are invented; AI assessments are not persisted by the backend so they cannot appear here.
 */
export function buildTimeline({ appointments = [], prescriptions = [], orders = [], admissions = [], records = [], payments = [], doctorName = () => 'Doctor' }) {
  const ev = [];
  const badge = (s) => createElement(StatusBadge, { status: s, size: 'sm' });

  appointments.forEach((a) => {
    const start = appointmentStart(a);
    ev.push({
      id: `a-${a._id}`, at: start || new Date(a.createdAt), icon: CalendarDays, tone: 'teal',
      title: `Appointment with ${doctorName(a.doctorId)}`,
      description: `${formatDate(a.date)} · ${formatTimeRange(a.startTime, a.endTime)}`,
      dateLabel: formatDate(a.date), to: `/patient/appointments/${a._id}`, badge: badge(a.status),
    });
  });
  prescriptions.forEach((p) => ev.push({
    id: `p-${p._id}`, at: new Date(p.createdAt), icon: ClipboardList, tone: 'blue',
    title: `Prescription from ${doctorName(p.doctorId)}`, description: `${(p.medicines || []).length} medicine(s)`,
    dateLabel: formatDay(p.createdAt), to: `/patient/prescriptions/${p._id}`,
  }));
  orders.forEach((o) => ev.push({
    id: `o-${o._id}`, at: new Date(o.createdAt), icon: ShoppingBag, tone: 'teal',
    title: `Medicine order #${shortId(o._id)}`, description: formatCurrency(o.total),
    dateLabel: formatDay(o.createdAt), to: `/patient/orders/${o._id}`, badge: badge(o.orderStatus),
  }));
  admissions.forEach((a) => {
    ev.push({
      id: `ad-${a._id}`, at: new Date(a.createdAt), icon: HeartPulse, tone: 'red',
      title: 'Admission requested', description: a.reason, dateLabel: formatDay(a.createdAt), to: `/patient/admission/${a._id}`, badge: badge(a.status),
    });
    if (a.admissionDate) ev.push({ id: `adm-${a._id}`, at: new Date(a.admissionDate), icon: HeartPulse, tone: 'red', title: 'Admitted', dateLabel: formatDay(a.admissionDate), to: `/patient/admission/${a._id}` });
    if (a.dischargeDate) ev.push({ id: `dis-${a._id}`, at: new Date(a.dischargeDate), icon: HeartPulse, tone: 'teal', title: 'Discharged', dateLabel: formatDay(a.dischargeDate), to: `/patient/admission/${a._id}` });
  });
  records.forEach((r) => ev.push({
    id: `r-${r._id}`, at: new Date(r.createdAt), icon: FlaskConical, tone: 'blue',
    title: r.title, description: String(r.type).replace(/_/g, ' ').toLowerCase(), dateLabel: formatDay(r.createdAt), to: '/patient/report-comparison',
  }));
  payments.filter((p) => p.status === 'PAID').forEach((p) => ev.push({
    id: `pay-${p._id}`, at: new Date(p.verifiedAt || p.createdAt), icon: CreditCard, tone: 'teal',
    title: `Payment for ${p.type === 'ORDER' ? 'medicine order' : 'consultation'}`, description: formatCurrency(paiseToRupees(p.amount)),
    dateLabel: formatDay(p.verifiedAt || p.createdAt), to: `/patient/payments/${p._id}`,
  }));

  return ev.sort((a, b) => b.at - a.at).map(({ dateLabel, ...rest }) => ({ ...rest, date: dateLabel }));
}
