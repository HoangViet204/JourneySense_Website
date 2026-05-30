import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout'
import StaffLayout from '../layouts/StaffLayout'
import AccountManagementPage from '../pages/admin/AccountManagementPage'
import AdminAuditDetailPage from '../pages/admin/AdminAuditDetailPage'
import AdminAuditPage from '../pages/admin/AdminAuditPage'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminJourneyDetailPage from '../pages/admin/AdminJourneyDetailPage'
import AdminJourneysPage from '../pages/admin/AdminJourneysPage'
import AdminJourneyTrackingPage from '../pages/admin/AdminJourneyTrackingPage'
import AdminPackagesPage from '../pages/admin/AdminPackagesPage'
import AdminPlaceDetailPage from '../pages/admin/AdminPlaceDetailPage'
import AdminPlacesPage from '../pages/admin/AdminPlacesPage'
import AdminExperienceReportsPage from '../pages/admin/AdminExperienceReportsPage'
import AdminExperienceReportDetailPage from '../pages/admin/AdminExperienceReportDetailPage'
import AdminUserTransactionDetailPage from '../pages/admin/AdminUserTransactionDetailPage'
import AdminUserTransactionsPage from '../pages/admin/AdminUserTransactionsPage'
import UserAccountDetailPage from '../pages/admin/UserAccountDetailPage'
import AdminTransactionsPage from '../pages/admin/AdminTransactionsPage'
import LoginPage from '../pages/LoginPage'
import StaffCreateJourneyPage from '../pages/staff/StaffCreateJourneyPage'
import StaffDashboardPage from '../pages/staff/StaffDashboardPage'
import StaffEditJourneyPage from '../pages/staff/StaffEditJourneyPage'
import StaffPlaceDetailPage from '../pages/staff/StaffPlaceDetailPage'
import StaffPlacesPage from '../pages/staff/StaffPlacesPage'
import StaffJourneyDetailPage from '../pages/staff/StaffJourneyDetailPage'
import StaffFeedbackDetailPage from '../pages/staff/StaffFeedbackDetailPage'
import StaffFeedbackPage from '../pages/staff/StaffFeedbackPage'
import StaffJourneyFeedbackDetailPage from '../pages/staff/StaffJourneyFeedbackDetailPage'
import StaffExperienceReportsPage from '../pages/staff/StaffExperienceReportsPage'
import StaffExperienceReportDetailPage from '../pages/staff/StaffExperienceReportDetailPage'
import StaffJourneysPage from '../pages/staff/StaffJourneysPage'
import StaffJourneyAnomaliesPage from '../pages/staff/StaffJourneyAnomaliesPage'
import PortalProfilePage from '../pages/portal/PortalProfilePage'
import HomeRedirect from './HomeRedirect'
import ProtectedRoute from './ProtectedRoute'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="journeys" element={<AdminJourneysPage />} />
        <Route path="journeys/:journeyId" element={<AdminJourneyDetailPage />} />
        <Route path="journeys/:journeyId/tracking" element={<AdminJourneyTrackingPage />} />
        <Route path="places" element={<AdminPlacesPage />} />
        <Route path="places/:placeId" element={<AdminPlaceDetailPage />} />
        <Route path="experience-reports" element={<AdminExperienceReportsPage />} />
        <Route path="experience-reports/:reportId" element={<AdminExperienceReportDetailPage />} />
        <Route path="accounts" element={<AccountManagementPage />} />
        <Route path="accounts/:userId" element={<UserAccountDetailPage />} />
        <Route path="accounts/:userId/transactions" element={<AdminUserTransactionsPage />} />
        <Route path="accounts/:userId/transactions/:source/:id" element={<AdminUserTransactionDetailPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="audit/:auditId" element={<AdminAuditDetailPage />} />
        <Route path="profile" element={<PortalProfilePage />} />
      </Route>

      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StaffDashboardPage />} />
        <Route path="places" element={<StaffPlacesPage />} />
        <Route path="places/:placeId" element={<StaffPlaceDetailPage />} />
        <Route path="experience-reports" element={<StaffExperienceReportsPage />} />
        <Route path="experience-reports/:reportId" element={<StaffExperienceReportDetailPage />} />
        <Route path="feedback" element={<StaffFeedbackPage />} />
        <Route path="feedback/journey/:journeyId" element={<StaffJourneyFeedbackDetailPage />} />
        <Route path="feedback/:feedbackId" element={<StaffFeedbackDetailPage />} />
        <Route path="journeys" element={<StaffJourneysPage />} />
        <Route path="journeys/anomalies" element={<StaffJourneyAnomaliesPage />} />
        <Route path="journeys/new" element={<StaffCreateJourneyPage />} />
        <Route path="journeys/:journeyId/edit" element={<StaffEditJourneyPage />} />
        <Route path="journeys/:journeyId" element={<StaffJourneyDetailPage />} />
        <Route path="profile" element={<PortalProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
