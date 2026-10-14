// ─── Enums ───────────────────────────────────────────────────────────────────

// src/types/index.ts

export const ORG_ROLES = [
  'Agency Administrator',
  'Scheduler',
  'Clinical Manager',
  'HR Coordinator',
  'Compliance Administrator',
] as const

export type OrgRole = (typeof ORG_ROLES)[number]

export type PlatformRole = 'Platform Administrator' | 'Technical Support'

export type OrgStatus = 'Active' | 'Suspended' | 'Archived'

export type MembershipStatus = 'Active' | 'Suspended' | 'Revoked'

export type UserAccessStatus = 'Active' | 'Disabled' | 'Pending'

export type PermissionCode =
  | 'users.manage'
  | 'patients.read_basic'
  | 'patients.read_clinical'
  | 'patients.manage'
  | 'caregivers.manage'
  | 'caregivers.read_compensation'
  | 'authorizations.manage'
  | 'authorizations.read_rates'
  | 'shifts.manage'
  | 'matching.run'
  | 'call_offs.manage'
  | 'notifications.send'
  | 'dashboard.read'
  | 'reports.read'

export type PatientStatus = 'Intake' | 'Active' | 'Suspended' | 'Discharged' | 'Archived'

export type AddressType = 'Service' | 'Mailing' | 'Other'

export type RequirementType =
  | 'Skill'
  | 'Language'
  | 'Gender Preference'
  | 'Travel'
  | 'Pets'
  | 'Smoking'
  | 'Lifting'
  | 'Schedule'
  | 'Other'

export type MatchingEffect = 'Required' | 'Preferred' | 'Review Required' | 'Exclude'

export type VisibilityLevel = 'Operational' | 'Clinical' | 'Restricted'

export const PAYER_TYPES = ['Medicare', 'Medicaid', 'Waiver', 'Managed Care', 'Private Pay', 'Other'] as const
export type PayerType = (typeof PAYER_TYPES)[number]

export const AUTHORIZATION_STATUSES = [
  'Active',
  'Pending Recertification',
  'Under Review',
  'Suspended',
  'Expired',
] as const
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number]

export const QUANTITY_UNITS = ['Hours', 'Visits', 'Units'] as const
export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export const QUANTITY_PERIODS = ['Day', 'Week', 'Month', 'Authorization Period'] as const
export type QuantityPeriod = (typeof QUANTITY_PERIODS)[number]

export const RATE_UNITS = ['Hour', 'Visit', 'Unit'] as const
export type RateUnit = (typeof RATE_UNITS)[number]

export const CAREGIVER_CLASSIFICATIONS = ['RN', 'LPN', 'HHA', 'STNA'] as const

export type CaregiverClassification = (typeof CAREGIVER_CLASSIFICATIONS)[number]

export type CaregiverEmploymentStatus = 'Active' | 'Inactive' | 'Suspended' | 'Terminated'

export type CaregiverMatchingStatus = 'Active' | 'Inactive' | 'Suspended'

export type CredentialStatus = 'Active' | 'Expired' | 'Pending' | 'Revoked'

// `caregiver_credentials.credential_type` is free text in SQL — the app constrains it.
export const CREDENTIAL_TYPES = [
  'License',
  'Certification',
  'Background Check',
  'CPR',
  'TB Test',
  'Other',
] as const

export type CredentialType = (typeof CREDENTIAL_TYPES)[number]

export type CredentialHealth = 'OK' | 'Expiring Soon' | 'Expired' | 'Missing'

export type AvailabilityStatus = 'Available' | 'Unavailable' | 'Preferred'

export type ShiftStatus =
  | 'Open'
  | 'Assigned'
  | 'Replacement Needed'
  | 'Covered'
  | 'Uncovered'
  | 'Completed'
  | 'Cancelled'

export type ShiftCoverageStatus =
  | 'Open'
  | 'Assigned'
  | 'Call-Off Reported'
  | 'Replacement Pending'
  | 'Covered'
  | 'Uncovered'
  | 'Cancelled'

export type ShiftChangeType = 'Assigned' | 'Reassigned' | 'Call-Off' | 'Replacement' | 'Cancelled'

export type MatchingRunStatus = 'Started' | 'Completed' | 'Failed' | 'Expired'

export type RecommendationStatus = 'Recommended' | 'Review Required' | 'Excluded'

export type CandidateOutreachStatus =
  | 'Not Contacted'
  | 'Contacted'
  | 'Notification Sent'
  | 'Notification Failed'

export type CandidateResponseStatus =
  | 'Pending'
  | 'Interested'
  | 'Accepted'
  | 'Declined'
  | 'No Response'
  | 'Withdrawn'
  | 'Selected'

export type CallOffStatus =
  | 'Reported'
  | 'Replacement Needed'
  | 'Candidates Available'
  | 'Outreach In Progress'
  | 'Pending Confirmation'
  | 'Resolved'
  | 'Unresolved'
  | 'Cancelled'

export type CallOffReasonCode =
  | 'Illness'
  | 'Emergency'
  | 'Transportation'
  | 'Schedule Conflict'
  | 'No Call / No Show'
  | 'Other'

export type CallOffReportSource = 'Phone' | 'Text' | 'Email' | 'Internal' | 'Other'

export type CallOffResolutionType =
  | 'Covered'
  | 'Missed'
  | 'Delayed'
  | 'Shortened'
  | 'Cancelled'
  | 'Other'

export type OutreachEventStatus =
  | 'Contacted'
  | 'No Answer'
  | 'Message Left'
  | 'Notification Sent'
  | 'Failed'

export type NotificationChannel = 'In-App' | 'Email' | 'SMS' | 'Phone' | 'Other'

export type NotificationAudience = 'Internal Staff' | 'Caregiver' | 'Administrator'

export type NotificationSensitivity = 'General' | 'Operational' | 'Restricted'

export type NotificationDeliveryStatus = 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Cancelled'

export type BillingServiceCategory =
  | 'Aide'
  | 'Nursing'
  | 'Assessment'
  | 'Personal Care'
  | 'Homemaker'
  | 'Other'

export type UnitType = 'Hour' | 'Visit' | 'Unit'

export type CodeMatchType = 'Exact' | 'Prefix'

export type OperationalHistoryStatus = 'Success' | 'Failed' | 'Blocked' | 'Cancelled'

// ─── Service response shape ───────────────────────────────────────────────────

export type ActionResponse<T = undefined> = {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
  requestId?: string
}

// ─── Identity and access ──────────────────────────────────────────────────────

export type Organization = {
  id: string
  name: string
  status: OrgStatus
  timezone: string
  data_region: string | null
  created_at: string
  updated_at: string | null
  archived_at: string | null
}

export type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  access_status: UserAccessStatus
  last_login_at: string | null
  created_at: string
  updated_at: string | null
  disabled_at: string | null
  disabled_by_user_id: string | null
}

export type OrgMemberWithProfile = OrganizationMembership & {
  profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'access_status'> | null
}

// List-only projection: just the columns the users grid renders, so the page
// never selects the full membership row for a table it only paginates through.
export type OrgMemberListItem = Pick<
  OrganizationMembership,
  'id' | 'organization_id' | 'user_id' | 'roles' | 'status' | 'joined_at'
> & {
  profile: Pick<UserProfile, 'id' | 'first_name' | 'last_name' | 'access_status'> | null
}

export type OrgMemberListPage = {
  rows: OrgMemberListItem[]
  rowCount: number
}

export type PlatformUserRole = {
  user_id: string
  role: PlatformRole
  status: 'Active' | 'Disabled'
  created_at: string
}

export type OrganizationMembership = {
  id: string
  organization_id: string
  user_id: string
  roles: OrgRole[]
  status: MembershipStatus
  joined_at: string
  disabled_at: string | null
  disabled_by_user_id: string | null
  last_access_review_at: string | null
}

export type RolePermissionDefault = {
  id: string
  role: OrgRole
  permission_code: PermissionCode
  enabled: boolean
  created_at: string
}

export type MembershipPermissionGrant = {
  id: string
  organization_id: string
  membership_id: string
  permission_code: PermissionCode
  reason: string | null
  granted_by_user_id: string
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
}

export type PendingInvite = {
  invite_id: string
  user_id: string
  email: string
  roles: OrgRole[]
  invited_at: string
  expires_at: string | null
}

export type OrgInvite = {
  id: string
  organization_id: string
  invited_user_id: string
  email: string
  roles: OrgRole[]
  status: 'Pending' | 'Accepted' | 'Cancelled'
  invited_by_user_id: string
  invited_at: string
  accepted_at: string | null
  expires_at: string | null
}

// ─── Platform-global reference data ──────────────────────────────────────────

export type BillingService = {
  id: string
  billing_code: string
  code_match_type: CodeMatchType
  service_name: string
  service_category: BillingServiceCategory
  default_unit_type: UnitType
  effective_start_date: string
  effective_end_date: string | null
  active: boolean
  source: string
  version: string
  approved_by_user_id: string | null
  approved_at: string | null
  created_at: string
}

export type ServiceCodeMapping = {
  id: string
  billing_service_id: string
  evv_service_id: string
  evv_service_name: string
  payer_type: string
  program_name: string | null
  effective_start_date: string
  effective_end_date: string | null
  active: boolean
  source: string
  version: string
  approved_by_user_id: string | null
  approved_at: string | null
  created_at: string
}

export type NotificationTemplate = {
  id: string
  template_key: string
  notification_type: string
  channel: NotificationChannel
  audience: NotificationAudience
  allowed_variables: string[] | null
  sensitivity_classification: NotificationSensitivity
  active: boolean
  version: string
  created_at: string
  updated_at: string | null
}

// ─── Patients ────────────────────────────────────────────────────────────────

export type Patient = {
  id: string
  organization_id: string
  patient_external_id: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string | null
  status: PatientStatus
  created_at: string
  created_by_user_id: string
  updated_at: string | null
  updated_by_user_id: string | null
  archived_at: string | null
  created_by?: Pick<UserProfile, 'id' | 'first_name' | 'last_name'> | null
}

export type PatientListItem = Pick<
  Patient,
  | 'id'
  | 'organization_id'
  | 'first_name'
  | 'last_name'
  | 'date_of_birth'
  | 'status'
  | 'created_at'
  | 'created_by_user_id'
> & {
  created_by: Pick<UserProfile, 'id' | 'first_name' | 'last_name'> | null
}

export type PatientListPage = {
  rows: PatientListItem[]
  rowCount: number
}

export type PatientAddress = {
  id: string
  organization_id: string
  patient_id: string
  address_type: AddressType
  address_line_1: string
  address_line_2: string | null
  city: string
  state: string
  zip_code: string
  latitude: number | null
  longitude: number | null
  location_hash: string | null
  geocoding_provider: string | null
  geocoded_at: string | null
  active: boolean
  created_at: string
  archived_at: string | null
}

export type PatientContact = {
  id: string
  organization_id: string
  patient_id: string
  contact_type: string
  contact_name: string
  relationship: string | null
  phone: string | null
  email: string | null
  authorized_contact: boolean
  active: boolean
  created_at: string
  archived_at: string | null
}

export type PatientRequirement = {
  id: string
  organization_id: string
  patient_id: string
  requirement_type: RequirementType
  requirement_code: string
  matching_effect: MatchingEffect
  required_skill_code: string | null
  structured_value: Record<string, unknown> | null
  restricted_note_id: string | null
  visibility_level: VisibilityLevel
  effective_start_date: string | null
  effective_end_date: string | null
  active: boolean
  created_at: string
  updated_at: string | null
}

// ─── Authorizations and services ─────────────────────────────────────────────

export type Payer = {
  id: string
  organization_id: string
  payer_name: string
  payer_type: PayerType
  program_name: string | null
  status: 'Active' | 'Inactive'
  created_at: string
  updated_at: string | null
}

export type OrganizationService = {
  id: string
  organization_id: string
  service_code_mapping_id: string
  local_service_name: string | null
  default_reimbursement_rate: number | null
  default_rate_unit: RateUnit
  requires_clinical_approval: boolean
  enabled: boolean
  created_at: string
  created_by_user_id: string
  updated_at: string | null
  updated_by_user_id: string | null
}

export type PatientAuthorization = {
  id: string
  organization_id: string
  patient_id: string
  payer_id: string
  encrypted_prior_auth_number: string | null
  masked_prior_auth_number: string | null
  authorization_start_date: string
  authorization_end_date: string
  status: AuthorizationStatus
  retention_category: string | null
  created_at: string
  created_by_user_id: string
  updated_at: string | null
  updated_by_user_id: string | null
  archived_at: string | null
}

export type AuthorizationService = {
  id: string
  organization_id: string
  authorization_id: string
  organization_service_id: string
  authorized_quantity: number
  quantity_unit: QuantityUnit
  quantity_period: QuantityPeriod
  reimbursement_rate: number | null
  rate_unit: RateUnit
  service_requirement_code: string | null
  restricted_note_id: string | null
  effective_start_date: string
  effective_end_date: string
  active: boolean
  created_at: string
  updated_at: string | null
}

export type OrganizationServiceRate = {
  id: string
  organization_id: string
  organization_service_id: string
  reimbursement_rate: number
  rate_unit: RateUnit
  effective_start_date: string
  effective_end_date: string | null
  change_reason: string
  created_by_user_id: string
  created_at: string
}

export type OrganizationServiceWithMapping = Omit<OrganizationService, 'default_reimbursement_rate'> & {
  service_code_mapping: Pick<
    ServiceCodeMapping,
    'id' | 'evv_service_id' | 'evv_service_name' | 'payer_type' | 'program_name'
  > & {
    billing_service: Pick<BillingService, 'billing_code' | 'service_name' | 'service_category'>
  }
}

export type PayerListPage = {
  rows: Pick<Payer, 'id' | 'organization_id' | 'payer_name' | 'payer_type' | 'program_name' | 'status' | 'created_at'>[]
  rowCount: number
}

export type OrganizationServiceListPage = {
  rows: OrganizationServiceWithMapping[]
  rowCount: number
}

export type PatientAuthorizationListItem = Omit<PatientAuthorization, 'encrypted_prior_auth_number'> & {
  payer: Pick<Payer, 'payer_name' | 'payer_type'>
  service_count: number
  effective_status: AuthorizationStatus
}

export type PatientAuthorizationListPage = {
  rows: PatientAuthorizationListItem[]
  rowCount: number
}

export type EffectiveRate = {
  rate: number | null
  rate_unit: RateUnit | null
  source: 'authorization' | 'organization_default' | 'missing'
}

export type AuthorizationServiceCompatibility = {
  authorization_valid: boolean
  service_authorized: boolean
  has_rate: boolean
  reason_code: 'authorization_missing' | 'authorization_inactive' | 'service_not_authorized' | 'rate_missing' | null
  rate_source: 'authorization' | 'organization_default' | 'missing'
}

export type AuthorizationServiceWithEffectiveRate = AuthorizationService & {
  organization_service: Pick<OrganizationService, 'local_service_name'>
  effective_rate: EffectiveRate
}

export type PatientAuthorizationDetail = Omit<PatientAuthorization, 'encrypted_prior_auth_number'> & {
  payer: Pick<Payer, 'payer_name' | 'payer_type'>
  services: AuthorizationServiceWithEffectiveRate[]
  effective_status: AuthorizationStatus
}

// ─── Caregivers ───────────────────────────────────────────────────────────────

export type Caregiver = {
  id: string
  organization_id: string
  employee_external_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  classification: CaregiverClassification
  employment_status: CaregiverEmploymentStatus
  max_hours_per_week: number | null
  service_area_zip: string | null
  travel_radius_miles: number | null
  matching_status: CaregiverMatchingStatus
  created_at: string
  created_by_user_id: string
  updated_at: string | null
  updated_by_user_id: string | null
  archived_at: string | null
}

export type CaregiverCompensationRate = {
  id: string
  organization_id: string
  caregiver_id: string
  organization_service_id: string | null
  pay_rate: number
  rate_unit: RateUnit
  effective_start_date: string
  effective_end_date: string | null
  approved_by_user_id: string
  approved_at: string
  active: boolean
}

export type CaregiverCredential = {
  id: string
  organization_id: string
  caregiver_id: string
  credential_type: string
  credential_name: string
  encrypted_credential_number: string | null
  issued_date: string | null
  expiration_date: string | null
  status: CredentialStatus
  verified_by_user_id: string | null
  verified_at: string | null
  created_at: string
  updated_at: string | null
}

export type CaregiverServiceEligibility = {
  id: string
  organization_id: string
  caregiver_id: string
  organization_service_id: string
  supervision_required: boolean
  approved_by_user_id: string
  approved_at: string
  active: boolean
}

export type CaregiverSkill = {
  id: string
  organization_id: string
  caregiver_id: string
  skill_code: string
  skill_name: string
  verified_at: string | null
  expires_at: string | null
  active: boolean
}

export type CaregiverAvailability = {
  id: string
  organization_id: string
  caregiver_id: string
  day_of_week: number
  start_time: string
  end_time: string
  availability_status: AvailabilityStatus
  effective_start_date: string
  effective_end_date: string | null
  created_at: string
  updated_at: string | null
}

export type CaregiverConstraint = {
  id: string
  organization_id: string
  caregiver_id: string
  constraint_type: string
  structured_value: Record<string, unknown>
  matching_effect: 'Exclude' | 'Review Required' | 'Preference'
  restricted_note_id: string | null
  active: boolean
  created_at: string
  updated_at: string | null
}

export type CaregiverCredentialSummary = Pick<
  CaregiverCredential,
  'id' | 'credential_type' | 'expiration_date' | 'status'
>

export type CaregiverWithCredentialSummary = Caregiver & {
  credentials: CaregiverCredentialSummary[]
}

export type CaregiverListItem = Pick<
  Caregiver,
  | 'id'
  | 'organization_id'
  | 'first_name'
  | 'last_name'
  | 'classification'
  | 'employment_status'
  | 'matching_status'
  | 'service_area_zip'
  | 'created_at'
  | 'archived_at'
> & {
  credentials: CaregiverCredentialSummary[]
}

export type CaregiverListPage = {
  rows: CaregiverListItem[]
  rowCount: number
}

export type CaregiverServiceEligibilityWithService = CaregiverServiceEligibility & {
  organization_service: {
    id: string
    local_service_name: string | null
    service_code_mapping: { evv_service_name: string } | null
  } | null
}

// ─── Scheduling and matching ──────────────────────────────────────────────────

export type Shift = {
  id: string
  organization_id: string
  patient_id: string
  authorization_service_id: string
  assigned_caregiver_id: string | null
  start_datetime: string
  end_datetime: string
  visit_type: string
  status: ShiftStatus
  coverage_status: ShiftCoverageStatus
  assignment_confirmed_by_user_id: string | null
  assignment_confirmed_at: string | null
  version: number
  created_at: string
  created_by_user_id: string
  updated_at: string | null
  updated_by_user_id: string | null
  archived_at: string | null
}

export type ShiftAssignmentHistory = {
  id: string
  organization_id: string
  shift_id: string
  previous_caregiver_id: string | null
  new_caregiver_id: string | null
  change_type: ShiftChangeType
  reason_code: string | null
  changed_by_user_id: string
  changed_at: string
}

export type MatchingRun = {
  id: string
  organization_id: string
  patient_id: string
  shift_id: string
  authorization_service_id: string
  call_off_id: string | null
  initiated_by_user_id: string
  ruleset_version: string
  status: MatchingRunStatus
  started_at: string
  completed_at: string | null
  expires_at: string | null
}

export type MatchingCandidate = {
  id: string
  organization_id: string
  matching_run_id: string
  caregiver_id: string
  score: number
  recommendation_status: RecommendationStatus
  score_components: Record<string, unknown> | null
  explanation_codes: string[] | null
  review_flags: string[] | null
  outreach_status: CandidateOutreachStatus | null
  response_status: CandidateResponseStatus | null
  contacted_at: string | null
  responded_at: string | null
  selected_at: string | null
  selected_by_user_id: string | null
}

// ─── Call-offs ────────────────────────────────────────────────────────────────

export type CallOff = {
  id: string
  organization_id: string
  shift_id: string
  original_caregiver_id: string
  reported_by_user_id: string
  reported_at: string
  report_source: CallOffReportSource
  reason_code: CallOffReasonCode
  restricted_reason_note_id: string | null
  status: CallOffStatus
  replacement_caregiver_id: string | null
  resolved_by_user_id: string | null
  resolved_at: string | null
  resolution_type: CallOffResolutionType | null
  created_at: string
  updated_at: string | null
}

export type CallOffOutreachEvent = {
  id: string
  organization_id: string
  call_off_id: string
  matching_candidate_id: string | null
  caregiver_id: string
  contact_method: CallOffReportSource
  outreach_status: OutreachEventStatus
  response_status: 'Pending' | 'Interested' | 'Accepted' | 'Declined' | 'No Response'
  contacted_by_user_id: string
  contacted_at: string
  responded_at: string | null
  restricted_note_id: string | null
  created_at: string
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type Notification = {
  id: string
  organization_id: string
  template_id: string
  recipient_user_id: string | null
  recipient_caregiver_id: string | null
  channel: NotificationChannel
  notification_type: string
  sensitivity_classification: NotificationSensitivity
  contains_phi: boolean
  idempotency_key: string | null
  provider_message_id: string | null
  delivery_status: NotificationDeliveryStatus
  delivery_failure_reason_code: string | null
  approved_by_policy_version: string | null
  sent_at: string | null
  created_at: string
}

// ─── Travel cache ─────────────────────────────────────────────────────────────

export type TravelResultCache = {
  id: string
  organization_id: string
  origin_location_hash: string
  destination_location_hash: string
  travel_mode: string
  service_date: string | null
  distance_meters: number | null
  travel_duration_seconds: number | null
  provider: string
  calculated_at: string
  expires_at: string
  created_at: string
}

// ─── Operational history ──────────────────────────────────────────────────────

export type OperationalHistoryEvent = {
  id: string
  organization_id: string
  actor_user_id: string | null
  action_type: string
  resource_type: string
  resource_id: string
  related_patient_id: string | null
  related_caregiver_id: string | null
  related_shift_id: string | null
  related_call_off_id: string | null
  status: OperationalHistoryStatus
  summary_code: string | null
  metadata: Record<string, unknown> | null
  request_id: string | null
  occurred_at: string
  created_at: string
}

// ─── Supabase Database type ───────────────────────────────────────────────────

type TableDef<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }
type PatientTableDef = Omit<TableDef<Patient>, 'Relationships'> & {
  Relationships: [
    {
      foreignKeyName: 'patients_created_by_user_id_fkey'
      columns: ['created_by_user_id']
      isOneToOne: false
      referencedRelation: 'user_profiles'
      referencedColumns: ['id']
    },
  ]
}

export type Database = {
  public: {
    Tables: {
      organizations:                      TableDef<Organization>
      user_profiles:                      TableDef<UserProfile>
      platform_user_roles:                TableDef<PlatformUserRole>
      organization_memberships:           TableDef<OrganizationMembership>
      org_invites:                        TableDef<OrgInvite>
      role_permission_defaults:           TableDef<RolePermissionDefault>
      membership_permission_grants:       TableDef<MembershipPermissionGrant>
      billing_services:                   TableDef<BillingService>
      service_code_mappings:              TableDef<ServiceCodeMapping>
      notification_templates:             TableDef<NotificationTemplate>
      patients:                           PatientTableDef
      patient_addresses:                  TableDef<PatientAddress>
      patient_contacts:                   TableDef<PatientContact>
      patient_requirements:               TableDef<PatientRequirement>
      payers:                             TableDef<Payer>
      organization_services:              TableDef<OrganizationService>
      patient_authorizations:             TableDef<PatientAuthorization>
      authorization_services:             TableDef<AuthorizationService>
      organization_service_rates:          TableDef<OrganizationServiceRate>
      caregivers:                         TableDef<Caregiver>
      caregiver_compensation_rates:       TableDef<CaregiverCompensationRate>
      caregiver_credentials:              TableDef<CaregiverCredential>
      caregiver_service_eligibility:      TableDef<CaregiverServiceEligibility>
      caregiver_skills:                   TableDef<CaregiverSkill>
      caregiver_availability:             TableDef<CaregiverAvailability>
      caregiver_constraints:              TableDef<CaregiverConstraint>
      shifts:                             TableDef<Shift>
      shift_assignment_history:           TableDef<ShiftAssignmentHistory>
      matching_runs:                      TableDef<MatchingRun>
      matching_candidates:                TableDef<MatchingCandidate>
      call_offs:                          TableDef<CallOff>
      call_off_outreach_events:           TableDef<CallOffOutreachEvent>
      notifications:                      TableDef<Notification>
      travel_result_cache:                TableDef<TravelResultCache>
      operational_history_events:         TableDef<OperationalHistoryEvent>
    }
    Views: Record<string, never>
    Functions: {
      has_org_permission:    { Args: { org_id: string; perm_code: string };                                     Returns: boolean }
      is_org_member:         { Args: { org_id: string };                                                       Returns: boolean }
      is_org_admin:          { Args: { org_id: string };                                                       Returns: boolean }
      can_manage_org_users:  { Args: { target_org_id: string };                                                Returns: boolean }
      create_org_invite:          { Args: { target_org_id: string; target_user_id: string; target_email: string; initial_roles: OrgRole[]; invite_expires_at?: string }; Returns: OrgInvite }
      complete_org_invite:        { Args: { target_org_id: string };                                           Returns: OrganizationMembership }
      create_org_member:          { Args: { target_org_id: string; target_user_id: string; initial_roles: OrgRole[] }; Returns: OrganizationMembership }
      list_pending_org_invites:   { Args: { target_org_id: string }; Returns: PendingInvite[] }
      delete_org_invite:          { Args: { target_org_id: string; target_user_id: string }; Returns: void }
      suspend_org_member:    { Args: { target_org_id: string; target_user_id: string };                        Returns: OrganizationMembership }
      unsuspend_org_member:  { Args: { target_org_id: string; target_user_id: string };                        Returns: OrganizationMembership }
      set_org_member_roles:  { Args: { target_org_id: string; target_user_id: string; new_roles: OrgRole[] };  Returns: OrganizationMembership }
      revoke_org_member:     { Args: { target_org_id: string; target_user_id: string };                        Returns: OrganizationMembership }
      create_patient_with_address: {
        Args: {
          target_org_id: string
          first_name: string
          last_name: string
          middle_name?: string | null
          date_of_birth?: string | null
          patient_external_id?: string | null
          status?: string
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          latitude?: number | null
          longitude?: number | null
        }
        Returns: Patient
      }
      upsert_patient_requirement: {
        Args: {
          target_org_id: string
          target_patient_id: string
          req_type: RequirementType
          req_code: string
          matching_effect: MatchingEffect
          required_skill_code?: string | null
          structured_value?: Record<string, unknown> | null
          restricted_note_id?: string | null
          visibility_level: VisibilityLevel
          effective_start_date?: string | null
          effective_end_date?: string | null
        }
        Returns: PatientRequirement
      }
      list_patient_requirements_by_visibility: {
        Args: { target_org_id: string; target_patient_id: string; target_visibility?: VisibilityLevel }
        Returns: PatientRequirement[]
      }
      can_manage_org_caregivers: { Args: { org_id: string }; Returns: boolean }
      can_read_org_compensation:  { Args: { org_id: string }; Returns: boolean }
      can_manage_org_authorizations: { Args: { org_id: string }; Returns: boolean }
      can_read_org_authorizations: { Args: { org_id: string }; Returns: boolean }
      can_read_org_authorization_rates: { Args: { org_id: string }; Returns: boolean }
      create_authorization_with_services: {
        Args: {
          target_org_id: string
          target_patient_id: string
          target_payer_id: string
          authorization_start_date: string
          authorization_end_date: string
          status?: AuthorizationStatus
          prior_auth_number?: string | null
          services?: Record<string, unknown>[]
        }
        Returns: PatientAuthorization
      }
      check_authorization_service_compatibility: {
        Args: {
          target_org_id: string
          target_patient_id: string
          target_organization_service_id: string
          service_date: string
        }
        Returns: AuthorizationServiceCompatibility[]
      }
      set_organization_service_rate: {
        Args: {
          target_org_id: string
          target_organization_service_id: string
          reimbursement_rate: number
          rate_unit: RateUnit
          effective_start_date: string
          change_reason: string
        }
        Returns: OrganizationServiceRate
      }
      get_effective_organization_service_rates: {
        Args: {
          target_org_id: string
          target_organization_service_ids: string[]
          service_date: string
        }
        Returns: (Pick<OrganizationServiceRate, 'organization_service_id' | 'reimbursement_rate' | 'rate_unit'>)[]
      }
      create_caregiver: {
        Args: {
          target_org_id: string
          first_name: string
          last_name: string
          classification: CaregiverClassification
          email?: string | null
          phone?: string | null
          employee_external_id?: string | null
          max_hours_per_week?: number | null
          service_area_zip?: string | null
          travel_radius_miles?: number | null
        }
        Returns: Caregiver
      }
      upsert_caregiver_availability: {
        Args: {
          target_org_id: string
          target_caregiver_id: string
          day_of_week: number
          start_time: string
          end_time: string
          availability_status: AvailabilityStatus
          effective_start_date: string
          effective_end_date?: string | null
        }
        Returns: CaregiverAvailability
      }
      set_caregiver_compensation_rate: {
        Args: {
          target_org_id: string
          target_caregiver_id: string
          pay_rate: number
          rate_unit: RateUnit
          effective_start_date: string
          organization_service_id?: string | null
        }
        Returns: CaregiverCompensationRate
      }
      mark_expired_credentials: { Args: { target_org_id: string }; Returns: number }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
