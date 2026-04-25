/**
 * Portal & staff/admin API types — mirror backend:
 * `JourneySense_BackEnd/JSEA_Application/DTOs/Portal/*.cs`
 * `JSEA_Application/DTOs/Respone/MicroExperience/*.cs`
 * `JSEA_Application/DTOs/Respone/Category/CategoryResponseDto.cs`
 *
 * Micro-experience: **`docs/MICRO_EXPERIENCE_FE.md`**. Portal API: **`docs/WEB_ADMIN_STAFF_PORTAL.md`**.
 *
 * Wire JSON (ASP.NET Core defaults):
 * - Property names: camelCase
 * - Guid → string
 * - DateTime → ISO-8601 string (Vietnam +07:00 từ VietnamDateTimeJsonConverter)
 * - Decimal → number
 * - ActionType & other enums → string (tên thành viên PascalCase, vd. `Create`, `AdminUserStatusChanged`)
 */

/** Backend: `JSEA_Application.Enums.ActionType` — audit log & hệ thống. */
export type PortalAuditActionType =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Verify'
  | 'Feature'
  | 'Reject'
  | 'Login'
  | 'Logout'
  | 'AdminUserStatusChanged'
  | 'AdminStaffCreated'
  | 'StaffFeedbackModerated'
  | 'StaffUserReported'
  | 'AdminEmbeddingBatchRun'

// ——— PortalPagedResult.cs ———

export interface PortalPagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

// ——— TransactionHistoryDtos.cs ———

/** Item lịch sử giao dịch của user (PayOS hoặc đổi bằng điểm). */
export interface TransactionHistoryItemDto {
  id: string
  userId?: string | null
  /** "payos" | "points" */
  source: string
  occurredAt: string
  packageId?: string | null
  packageTitle?: string | null
  /** PayOS: purchase|renewal|upgrade. Points: redeem. */
  action: string
  /** PayOS: pending|completed|failed|refunded. Points: completed. */
  status: string
  amountMoney?: number | null
  points?: number | null
  orderCode?: string | null
}

export interface PayosTransactionHistoryDetailDto {
  id: string
  userId: string
  packageId: string
  packageTitle?: string | null
  amount: number
  type: string
  status: string
  orderCode?: string | null
  paymentMethod?: string | null
  /** Snapshot json (packages tại thời điểm mua). */
  itemSnapshot: string
  createdAt?: string | null
}

export interface PointsTransactionHistoryDetailDto {
  id: string
  userId: string
  type: string
  points: number
  description?: string | null
  refId?: string | null
  refType?: string | null
  packageId?: string | null
  packageTitle?: string | null
  createdAt?: string | null
}

// ——— AdminUserDtos.cs ———

export interface AdminUserListItemDto {
  id: string
  email: string
  phone?: string | null
  role: string
  status: string
  createdAt?: string | null
  lastLoginAt?: string | null
}

export interface AdminUserDetailDto {
  id: string
  email: string
  phone?: string | null
  role: string
  status: string
  emailVerified?: boolean | null
  phoneVerified?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
  lastLoginAt?: string | null
  /** Từ user_profiles — có thể thiếu nếu backend chưa cập nhật hoặc chưa có hồ sơ */
  fullName?: string | null
  avatarUrl?: string | null
  bio?: string | null
}

/** AdminUsersController POST `/api/admin/staff-accounts` */
export interface CreateStaffAccountRequest {
  email: string
  password: string
}

/** AdminUsersController PATCH `/api/admin/users/{id}/status` */
export interface UpdatePortalUserStatusRequest {
  /** `active` | `suspended` */
  status: string
  reason?: string | null
}

// ——— AdminAnalyticsSummaryResponse.cs ———

export interface AdminPackageByTypeItem {
  type: string
  count?: number | null
}

export interface AdminAnalyticsSummaryResponse {
  usersTotal: number
  usersActive: number
  usersTraveler: number
  usersStaff: number
  usersAdmin: number
  experiencesActive: number
  journeysTotal: number
  feedbacksPendingModeration: number
  revenueTotalVnd?: number | null
  revenue30dVnd?: number | null
  completedTransactions?: number | null
  packagesByType?: AdminPackageByTypeItem[] | null
}

// ——— AdminJourneyDtos.cs ———

export interface AdminJourneyListItemDto {
  id: string
  travelerId?: string | null
  originAddress?: string | null
  destinationAddress?: string | null
  vehicleType?: string | null
  status?: string | null
  createdAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  // Anomaly fields (added by backend)
  isAnomalous?: boolean | null
  anomalyReason?: string | null
  anomalyDetectedAt?: string | null
}

/** GET /api/admin/journeys/anomalous */
export interface AdminAnomalousJourneyDto {
  id: string
  travelerId?: string | null
  originAddress?: string | null
  destinationAddress?: string | null
  vehicleType?: string | null
  status?: string | null
  startedAt?: string | null
  createdAt?: string | null
  completedAt?: string | null
  isAnomalous: boolean
  anomalyReason?: string | null
  anomalyDetectedAt?: string | null
}

// ——— AdminJourneyProgressDtos.cs ———

export interface AdminJourneyWaypointProgressItemResponse {
  waypointId: string
  stopOrder: number
  visitedCount: number
  skippedCount: number
}

export interface AdminJourneyWaypointProgressSummaryResponse {
  journeyId: string
  memberCount: number
  waypoints: AdminJourneyWaypointProgressItemResponse[]
}

// ——— JourneyPolylineResponse.cs ———

export interface JourneyPolylineResponse {
  journeyId: string
  targetWaypointId?: string | null
  targetExperienceId?: string | null
  polyline?: string | null
  points: GeoPointResponse[]
  distanceMeters?: number | null
  estimatedDurationMinutes?: number | null
}

// ——— JourneyMemberRosterItemResponse.cs ———

export interface JourneyMemberRosterItemResponse {
  memberId: string
  displayName: string
  role: string
  isGuest: boolean
  joinedAt: string
  latitude?: number | null
  longitude?: number | null
}

// ——— JourneyMemberLocationNotification.cs (SignalR + snapshot) ———

export interface JourneyMemberLocationNotification {
  journeyId: string
  memberId: string
  travelerId?: string | null
  guestKey?: string | null
  displayName?: string | null
  role?: string | null
  latitude: number
  longitude: number
  accuracyMeters?: number | null
  headingDegrees?: number | null
  atUtc?: string | null
}

/** AdminController POST `/api/admin/embeddings/generate` — anonymous object trong code. */
export interface AdminEmbeddingGenerateResponse {
  success: number
  failed: number
  errors: string[]
}

// ——— ProfileController GET/PUT `/api/profile` ———

/** GET `/api/profile` — `travelStyle` / `point` chỉ có với traveler. */
export interface PortalProfileResponse {
  userId: string
  role: string
  email: string
  phone?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  bio?: string | null
  accessibilityNeeds?: string | null
  travelStyle?: string[] | null
  point?: number | null
}

/** PUT `/api/profile` — mọi field optional; admin/staff không dùng `travelStyle`. */
export interface PortalProfileUpdateRequest {
  fullName?: string | null
  phone?: string | null
  avatarUrl?: string | null
  bio?: string | null
  accessibilityNeeds?: string | null
  travelStyle?: string[] | null
}

// ——— StaffFeedbackDtos.cs ———

export interface StaffFeedbackListItemDto {
  id: string
  feedbackText: string
  moderationStatus: string
  isFlagged?: boolean | null
  flaggedReason?: string | null
  createdAt?: string | null
  visitId: string
  experienceId: string
  experienceName?: string | null
  travelerId: string
  travelerEmail?: string | null
}

/** GET `/api/staff/feedbacks/journeys` — feedback cả chuyến (`journeys.journey_feedback`). */
export interface StaffJourneyFeedbackListItemDto {
  journeyId: string
  travelerId: string
  travelerEmail?: string | null
  journeyFeedback: string
  moderationStatus: string
  updatedAt?: string | null
}

/** `StaffFeedbackDetailDto.cs` — GET `/api/staff/feedbacks/{id}`. */
export interface StaffFeedbackDetailDto extends StaffFeedbackListItemDto {
  journeyId?: string | null
  journeyFeedback?: string | null
  journeyFeedbackModerationStatus?: string | null
  waypointStopOrder?: number | null
}

/** GeoPointResponse — dùng cho routePoints (overview map). */
export interface GeoPointResponse {
  latitude: number
  longitude: number
}

export interface RouteSegmentResponse {
  segmentId: string
  segmentOrder?: number | null
  distanceMeters?: number | null
  estimatedDurationMinutes?: number | null
  isScenic?: boolean | null
  isBusy?: boolean | null
  isCulturalArea?: boolean | null
}

/** GET `/api/journeys/{id}` (traveler) và GET `/api/admin/journeys/{id}` (admin). */
export interface JourneyWaypointVisitFeedbackResponse {
  visitId: string
  feedbackId?: string | null
  feedbackText?: string | null
  moderationStatus?: string | null
  feedbackCreatedAt?: string | null
  rating?: number | null
}

export interface JourneyWaypointResponse {
  waypointId: string
  experienceId: string
  suggestionId?: string | null
  segmentId?: string | null
  stopOrder: number
  name?: string | null
  categoryName?: string | null
  address?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  coverPhotoUrl?: string | null
  detourDistanceMeters?: number | null
  detourTimeMinutes?: number | null
  visitFeedback?: JourneyWaypointVisitFeedbackResponse | null
}

export interface JourneyDetailResponse {
  id: string
  travelerId?: string | null
  originAddress?: string | null
  destinationAddress?: string | null
  vehicleType?: string | null
  totalDistanceMeters?: number | null
  estimatedDurationMinutes?: number | null
  timeBudgetMinutes?: number | null
  maxDetourDistanceMeters?: number | null
  currentMood?: string | null
  status?: string | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
  journeyFeedback?: string | null
  journeyFeedbackModerationStatus?: string | null
  routePoints?: GeoPointResponse[] | null
  setupPrimaryRoutePoints?: GeoPointResponse[] | null
  segments?: RouteSegmentResponse[] | null
  waypoints?: JourneyWaypointResponse[] | null
  selectedSegmentId?: string | null
  // Anomaly fields
  isAnomalous?: boolean | null
  anomalyReason?: string | null
  anomalyDetectedAt?: string | null
}

/** StaffFeedbacksController POST moderate */
export interface ModerateFeedbackRequest {
  /** `approve` | `reject` */
  decision: string
  reason?: string | null
}

/** StaffUserReportsController POST */
export interface ReportPortalUserRequest {
  reason: string
  relatedFeedbackId?: string | null
}

// ——— MicroExperience/*.cs ———

export interface MicroExperienceListItemResponse {
  id: string
  name?: string | null
  city?: string | null
  status?: string | null
  preferredTimes?: string[] | null
  latitude?: number | null
  longitude?: number | null
  /** Ảnh bìa hoặc ảnh đầu — có thể là path `/uploads/...` */
  coverPhotoUrl?: string | null
}

/** Backend: `ExperiencePhotoResponse` */
export interface ExperiencePhotoResponse {
  id: string
  photoUrl: string
  thumbnailUrl?: string | null
  caption?: string | null
  isCover: boolean
  uploadedAt?: string | null
}

/** @deprecated Dùng `ExperiencePhotoResponse` (khớp tên C#). */
export type ExperiencePhotoDto = ExperiencePhotoResponse

/** `ExperiencePhotoInput.cs` — gắn ảnh theo URL trong POST create / PUT update (append). */
export interface ExperiencePhotoInput {
  photoUrl: string
  thumbnailUrl?: string | null
  caption?: string | null
  isCover: boolean
}

export interface MicroExperienceDetailResponse {
  id: string
  categoryId?: string | null
  name?: string | null
  categoryName?: string | null
  richDescription?: string | null
  /** Backend `decimal` — luôn có (mặc định 0). */
  avgRating: number
  /** Backend `decimal` — luôn có (mặc định 0). */
  qualityScore: number
  status?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  accessibleBy?: string[] | null
  preferredTimes?: string[] | null
  weatherSuitability?: string[] | null
  seasonality?: string[] | null
  amenityTags?: string[] | null
  tags?: string[] | null
  openingHours?: string | null
  priceRange?: string | null
  crowdLevel?: string | null
  latitude?: number | null
  longitude?: number | null
  photos?: ExperiencePhotoResponse[] | null
}

// ——— CategoryResponseDto.cs ———

export interface CategoryResponseDto {
  id: string
  name: string
  slug: string
  description?: string | null
  displayOrder: number
  isActive: boolean
}

// ——— AuditLogListItemDto.cs ———

export interface AuditLogListItemDto {
  id: string
  actorUserId?: string | null
  actorEmail?: string | null
  /** Giá trị khớp `PortalAuditActionType` (backend enum `ActionType`). */
  actionType: string
  entityType?: string | null
  entityId?: string | null
  oldValues?: string | null
  newValues?: string | null
  createdAt?: string | null
}

/**
 * Query GET `/api/micro-experiences` — `MicroExperienceFilter`:
 * keyword, categoryId, status, mood, timeOfDay (Morning | Afternoon | Evening | Night).
 */
export interface MicroExperienceListQuery {
  keyword?: string
  categoryId?: string
  status?: string
  mood?: string
  timeOfDay?: string
}

// ——— TopVisitedPlacesResponse ———

export interface TopVisitedPlaceItemResponse {
  experienceId: string
  name?: string | null
  city?: string | null
  visitedCount: number
}

export interface TopVisitedPlacesResponse {
  items: TopVisitedPlaceItemResponse[]
  rangeDays: number
  sampleJourneys: number
}

// ——— CloudinaryUploadSignatureResponse ———

export interface CloudinaryUploadSignatureResponse {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  publicId: string
  overwrite: boolean
  uploadUrl: string
  folder?: string | null
}
