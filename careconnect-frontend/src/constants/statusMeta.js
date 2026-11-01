// Presentation metadata for each backend enum. `tone` maps to a CSS class in styles/index.css
// (success | warning | info | danger | neutral | teal).
const m = (label, tone) => ({ label, tone });

export const STATUS_META = {
  PENDING: m('Pending', 'warning'),
  CONFIRMED: m('Confirmed', 'success'),
  IN_PROGRESS: m('In progress', 'info'),
  COMPLETED: m('Completed', 'teal'),
  CANCELLED: m('Cancelled', 'danger'),
  RESCHEDULED: m('Rescheduled', 'info'),
  NO_SHOW: m('No show', 'neutral'),
  PAID: m('Paid', 'success'),
  FAILED: m('Failed', 'danger'),
  REFUNDED: m('Refunded', 'neutral'),
  REQUESTED: m('Requested', 'warning'),
  UNDER_REVIEW: m('Under review', 'info'),
  APPROVED: m('Approved', 'success'),
  BED_ASSIGNED: m('Bed assigned', 'teal'),
  ADMITTED: m('Admitted', 'info'),
  DISCHARGED: m('Discharged', 'neutral'),
  PLACED: m('Placed', 'warning'),
  PROCESSING: m('Processing', 'info'),
  PACKED: m('Packed', 'info'),
  OUT_FOR_DELIVERY: m('Out for delivery', 'teal'),
  DELIVERED: m('Delivered', 'success'),
  NOT_DISPATCHED: m('Not dispatched', 'neutral'),
  IN_TRANSIT: m('In transit', 'info'),
  AVAILABLE: m('Available', 'success'),
  OCCUPIED: m('Occupied', 'danger'),
  RESERVED: m('Reserved', 'warning'),
  MAINTENANCE: m('Maintenance', 'neutral'),
  DISPATCHED: m('Dispatched', 'info'),
  DEPARTMENT_ASSIGNED: m('Department assigned', 'info'),
  DOCTOR_ASSIGNED: m('Doctor assigned', 'teal'),
  RESOLVED: m('Resolved', 'success'),
  LOW: m('Low', 'success'),
  MEDIUM: m('Medium', 'warning'),
  HIGH: m('High', 'danger'),
  EMERGENCY: m('Emergency', 'danger'),
  ACTIVE: m('Active', 'success'),
  ON_LEAVE: m('On leave', 'warning'),
  INACTIVE: m('Inactive', 'neutral'),
  DISCONTINUED: m('Discontinued', 'neutral'),
  OUT_OF_STOCK: m('Out of stock', 'danger'),
  SUSPENDED: m('Suspended', 'danger'),
  PENDING_VERIFICATION: m('Pending verification', 'warning'),
  VERIFIED: m('Verified', 'success'),
  REJECTED: m('Rejected', 'danger'),
  DELETED: m('Deleted', 'neutral'),
  CREATED: m('Created', 'neutral'),
  ENDED: m('Ended', 'neutral'),
  CLOSED: m('Closed', 'neutral'),
};

export function statusMeta(value) {
  if (!value) return m('—', 'neutral');
  return (
    STATUS_META[value] ||
    m(String(value).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), 'neutral')
  );
}
