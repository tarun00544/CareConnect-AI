import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { ROLES } from '../constants';
import PublicLayout from '../components/layout/PublicLayout';
import DashboardLayout from '../components/layout/DashboardLayout';

// public
import Landing from '../pages/public/Landing';
import About from '../pages/public/About';
import Services from '../pages/public/Services';
import DoctorsPage from '../pages/public/DoctorsPage';
import DepartmentsPage from '../pages/public/DepartmentsPage';
import PharmacyPage from '../pages/public/PharmacyPage';
import Login from '../pages/public/Login';
import AcceptInvite from '../pages/public/AcceptInvite';
import Register from '../pages/public/Register';
import Unauthorized from '../pages/public/Unauthorized';
import NotFound from '../pages/public/NotFound';

// shared
import ChatPage from '../pages/common/ChatPage';
import VideoList from '../pages/common/VideoList';
import VideoRoom from '../pages/common/VideoRoom';
import PrescriptionDetail from '../pages/common/PrescriptionDetail';
import Notifications from '../pages/common/Notifications';
import Profile from '../pages/common/Profile';
import Settings from '../pages/common/Settings';

// patient
import PatientDashboard from '../pages/patient/Dashboard';
import AIAssistant from '../pages/patient/AIAssistant';
import ReportAnalysis from '../pages/patient/ReportAnalysis';
import ReportComparisonPage from '../pages/patient/ReportComparisonPage';
import PatientNavigationPage from '../pages/patient/PatientNavigationPage';
import FollowUpsPage from '../pages/patient/FollowUpsPage';
import ReferralsPage from '../pages/patient/ReferralsPage';
import DoctorsList from '../pages/patient/DoctorsList';
import DoctorProfile from '../pages/patient/DoctorProfile';
import DepartmentsList from '../pages/patient/DepartmentsList';
import Appointments from '../pages/patient/Appointments';
import BookAppointment from '../pages/patient/BookAppointment';
import AppointmentDetail from '../pages/patient/AppointmentDetail';
import Prescriptions from '../pages/patient/Prescriptions';
import MedicineRemindersPage from '../pages/patient/MedicineRemindersPage';
import Pharmacy from '../pages/patient/Pharmacy';
import MedicineDetail from '../pages/patient/MedicineDetail';
import Cart from '../pages/patient/Cart';
import Checkout from '../pages/patient/Checkout';
import Orders from '../pages/patient/Orders';
import OrderDetail from '../pages/patient/OrderDetail';
import Admissions from '../pages/patient/Admissions';
import AdmissionForm from '../pages/patient/AdmissionForm';
import AdmissionDetail from '../pages/patient/AdmissionDetail';
import CareTimeline from '../pages/patient/Timeline';
import Payments from '../pages/patient/Payments';
import PaymentDetail from '../pages/patient/PaymentDetail';
import { PaymentSuccess, PaymentFailed } from '../pages/patient/PaymentResult';
import Emergency from '../pages/patient/Emergency';

// doctor
import DoctorDashboard from '../pages/doctor/Dashboard';
import DoctorAppointments from '../pages/doctor/Appointments';
import DoctorAppointmentDetail from '../pages/doctor/AppointmentDetail';
import DoctorPatients from '../pages/doctor/Patients';
import DoctorPatientDetail from '../pages/doctor/PatientDetail';
import DoctorPatientNavigationPage from '../pages/doctor/DoctorPatientNavigationPage';
import DoctorReportComparisonPage from '../pages/doctor/DoctorReportComparisonPage';
import DoctorAICopilotPage from '../pages/doctor/DoctorAICopilotPage';
import DoctorFollowUpsPage from '../pages/doctor/DoctorFollowUpsPage';
import DoctorReferralsPage from '../pages/doctor/DoctorReferralsPage';
import Availability from '../pages/doctor/Availability';
import DoctorConsultations from '../pages/doctor/Consultations';
import DoctorPrescriptions from '../pages/doctor/Prescriptions';
import PrescriptionNew from '../pages/doctor/PrescriptionNew';

// admin
import {
  AdminDashboard, AdminAnalytics, AdminUsers, AdminDoctors, AdminPatients,
  AdminAppointments, AdminAdmissions, AdminBeds, AdminEmergency,
} from '../pages/admin/AdminPages';
import { PharmacyDashboard, PharmacyMedicines, PharmacyInventory, PharmacyOrders } from '../pages/pharmacyAdmin/PharmacyAdminPages';

const common = (
  <>
    <Route path="notifications" element={<Notifications />} />
    <Route path="profile" element={<Profile />} />
    <Route path="settings" element={<Settings />} />
  </>
);

// Hospital admin and super admin share pages; the backend's own role checks (e.g. /admin/users, /admin/patients
// are SUPER_ADMIN-only) are mirrored by only registering those routes for SUPER_ADMIN below.
const adminRoutes = (superAdmin) => (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<AdminDashboard />} />
    {superAdmin && <Route path="users" element={<AdminUsers />} />}
    <Route path="doctors" element={<AdminDoctors />} />
    <Route path="patients" element={<AdminPatients />} />
    <Route path="appointments" element={<AdminAppointments />} />
    <Route path="admissions" element={<AdminAdmissions />} />
    <Route path="beds" element={<AdminBeds />} />
    <Route path="emergency" element={<AdminEmergency />} />
    <Route path="analytics" element={<AdminAnalytics />} />
    {common}
    <Route path="*" element={<NotFound />} />
  </>
);

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="pharmacy" element={<PharmacyPage />} />
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="accept-invite" element={<AcceptInvite />} />
      <Route path="unauthorized" element={<Unauthorized />} />

      {/* Authenticated */}
      <Route element={<ProtectedRoute />}>
        {/* Payment outcome screens (patient only, no dashboard chrome) */}
        <Route element={<RoleRoute allow={ROLES.PATIENT} />}>
          <Route path="payment/success" element={<PaymentSuccess />} />
          <Route path="payment/failed" element={<PaymentFailed />} />
        </Route>

        <Route element={<DashboardLayout />}>
          {/* PATIENT */}
          <Route path="patient" element={<RoleRoute allow={ROLES.PATIENT} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PatientDashboard />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="ai/report-analysis" element={<ReportAnalysis />} />
            <Route path="report-comparison" element={<ReportComparisonPage />} />
            <Route path="navigation" element={<PatientNavigationPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="doctors" element={<DoctorsList />} />
            <Route path="doctors/:id" element={<DoctorProfile />} />
            <Route path="departments" element={<DepartmentsList />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="appointments/book" element={<BookAppointment />} />
            <Route path="appointments/:id" element={<AppointmentDetail />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="video" element={<VideoList />} />
            <Route path="video/:id" element={<VideoRoom />} />
            <Route path="prescriptions" element={<Prescriptions />} />
            <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
            <Route path="reminders" element={<MedicineRemindersPage />} />
            <Route path="pharmacy" element={<Pharmacy />} />
            <Route path="pharmacy/:id" element={<MedicineDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="admission" element={<Admissions />} />
            <Route path="admission/new" element={<AdmissionForm />} />
            <Route path="admission/:id" element={<AdmissionDetail />} />
            <Route path="timeline" element={<CareTimeline />} />
            <Route path="payments" element={<Payments />} />
            <Route path="payments/:id" element={<PaymentDetail />} />
            <Route path="emergency" element={<Emergency />} />
            {common}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* DOCTOR */}
          <Route path="doctor" element={<RoleRoute allow={ROLES.DOCTOR} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DoctorDashboard />} />
            <Route path="appointments" element={<DoctorAppointments />} />
            <Route path="appointments/:id" element={<DoctorAppointmentDetail />} />
            <Route path="patients" element={<DoctorPatients />} />
            <Route path="patients/:id" element={<DoctorPatientDetail />} />
            <Route path="patient-navigation" element={<DoctorPatientNavigationPage />} />
            <Route path="report-comparison" element={<DoctorReportComparisonPage />} />
            <Route path="ai-copilot" element={<DoctorAICopilotPage />} />
            <Route path="follow-ups" element={<DoctorFollowUpsPage />} />
            <Route path="referrals" element={<DoctorReferralsPage />} />
            <Route path="availability" element={<Availability />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="video" element={<VideoList />} />
            <Route path="video/:id" element={<VideoRoom />} />
            <Route path="consultations" element={<DoctorConsultations />} />
            <Route path="consultations/:id" element={<DoctorAppointmentDetail />} />
            <Route path="prescriptions" element={<DoctorPrescriptions />} />
            <Route path="prescriptions/new" element={<PrescriptionNew />} />
            <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
            {common}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* HOSPITAL_ADMIN */}
          <Route path="hospital-admin" element={<RoleRoute allow={ROLES.HOSPITAL_ADMIN} />}>{adminRoutes(false)}</Route>

          {/* SUPER_ADMIN */}
          <Route path="super-admin" element={<RoleRoute allow={ROLES.SUPER_ADMIN} />}>{adminRoutes(true)}</Route>

          {/* PHARMACY_ADMIN */}
          <Route path="pharmacy-admin" element={<RoleRoute allow={ROLES.PHARMACY_ADMIN} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PharmacyDashboard />} />
            <Route path="medicines" element={<PharmacyMedicines />} />
            <Route path="inventory" element={<PharmacyInventory />} />
            <Route path="orders" element={<PharmacyOrders />} />
            {common}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
