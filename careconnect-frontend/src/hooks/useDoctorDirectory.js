import { useAsync } from './useAsync';
import { getDoctorDirectory } from '../services/doctorService';
import { refId } from '../utils/format';

/** doctorId → doctor (with userId.name). Failures degrade gracefully to "Doctor". */
export function useDoctorDirectory() {
  const { data, loading, error } = useAsync(() => getDoctorDirectory(), []);
  const map = data || {};
  const getDoctor = (doctorRef) => {
    if (!doctorRef) return null;
    const id = refId(doctorRef);
    const fromMap = map[id];
    if (fromMap) {
      return typeof doctorRef === 'object' ? { ...doctorRef, ...fromMap } : fromMap;
    }
    return typeof doctorRef === 'object' ? doctorRef : null;
  };
  const doctorName = (doctorRef) => {
    if (!doctorRef) return 'Doctor';
    const d = getDoctor(doctorRef);
    const name = d?.userId?.name || (typeof doctorRef === 'object' ? doctorRef.name : null);
    return name ? `Dr. ${String(name).replace(/^dr\.?\s+/i, '')}` : 'Doctor';
  };
  return { map, loading, error, getDoctor, doctorName };
}
