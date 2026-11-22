'use client'

import * as React from 'react'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { getPatientRequirementDisplayValue } from '@/lib/schemas/patients.schema'
import type { ActionResponse, Patient, PatientAddress, PatientAuthorizationListPage, PatientContact, PatientRequirement } from '@/types'

const ACTION_BUTTON_SX = {
  borderColor: 'divider',
  '&:hover': {
    borderColor: 'divider',
  },
}

interface InfoSectionProps {
  title: string
  onEditClick: () => void
  children: React.ReactNode
  buttonText?: string
  tooltipText?: string
}

function InfoSection({ title, onEditClick, children, buttonText = 'Edit', tooltipText }: InfoSectionProps) {
  const button = (
    <Button
      size="small"
      variant="outlined"
      sx={ACTION_BUTTON_SX}
      startIcon={buttonText === 'Edit' ? <EditIcon /> : <AutorenewIcon />}
      onClick={onEditClick}
    >
      {buttonText}
    </Button>
  )

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        bgcolor: 'background.default',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        p: 0,
        gap: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.hover',
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {tooltipText ? (
          <Tooltip title={tooltipText}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        )}
      </Stack>
      <Divider />
      <Box sx={{ px: 2, py: 1 }}>{children}</Box>
    </Card>
  )
}

function InfoRows({ children }: { children: React.ReactNode }) {
  return <Stack divider={<Divider flexItem />}>{children}</Stack>
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(100px, 0.45fr) minmax(0, 1fr)' },
        gap: { xs: 0.25, sm: 1.5 },
        py: 1.25,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  )
}

export interface PatientCoreProps {
  patient: Patient
  addressesPromise: Promise<PatientAddress[]>
  contactsPromise: Promise<PatientContact[]>
  requirementsPromise: Promise<PatientRequirement[]>
  authorizationsPromise?: Promise<ActionResponse<PatientAuthorizationListPage>> | null
}

const PREVIEW_ROW_LIMIT = 3

function ViewMore({ path }: { path: string }) {
  const router = useRouter()

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <Button size="small" variant="text" onClick={() => router.push(path)}>
        View more
      </Button>
    </Box>
  )
}

function PreviewFallback({ label }: { label: string }) {
  return (
    <InfoRow label={label}>
      <CircularProgress size={16} />
    </InfoRow>
  )
}

function AddressPreview({
  patientId,
  addressesPromise,
}: {
  patientId: string
  addressesPromise: Promise<PatientAddress[]>
}) {
  const addresses = React.use(addressesPromise)
  const previewRows = addresses.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Address">No addresses added yet.</InfoRow>
      ) : (
        previewRows.map((address) => {
          const parts = [
            address.address_line_1,
            address.address_line_2,
            address.city,
            address.state,
            address.zip_code,
          ].filter(Boolean)
          return (
            <InfoRow label={address.address_type} key={address.id}>
              {parts.join(', ')}
            </InfoRow>
          )
        })
      )}
      {addresses.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/patients/${patientId}/address`} />
      ) : null}
    </InfoRows>
  )
}

function ContactPreview({
  patientId,
  contactsPromise,
}: {
  patientId: string
  contactsPromise: Promise<PatientContact[]>
}) {
  const contacts = React.use(contactsPromise)
  const previewRows = contacts.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Contact">No contact information on file.</InfoRow>
      ) : (
        previewRows.map((contact) => {
          const details = [contact.relationship, contact.phone, contact.email].filter(Boolean).join(' · ')
          return (
            <InfoRow label={contact.contact_type} key={contact.id}>
              {contact.contact_name}
              {details ? ` (${details})` : ''}
            </InfoRow>
          )
        })
      )}
      {contacts.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/patients/${patientId}/contact`} />
      ) : null}
    </InfoRows>
  )
}

function RequirementPreview({
  patientId,
  requirementsPromise,
}: {
  patientId: string
  requirementsPromise: Promise<PatientRequirement[]>
}) {
  const requirements = React.use(requirementsPromise)
  const previewRows = requirements.slice(0, PREVIEW_ROW_LIMIT)

  return (
    <InfoRows>
      {previewRows.length === 0 ? (
        <InfoRow label="Requirement">No requirements added yet.</InfoRow>
      ) : (
        previewRows.map((requirement) => (
          <InfoRow label={requirement.requirement_type} key={requirement.id}>
            {getPatientRequirementDisplayValue(requirement)}
          </InfoRow>
        ))
      )}
      {requirements.length > PREVIEW_ROW_LIMIT ? (
        <ViewMore path={`/patients/${patientId}/requirement`} />
      ) : null}
    </InfoRows>
  )
}

function AuthorizationPreview({ resultPromise, patientId }: {
  resultPromise: Promise<ActionResponse<PatientAuthorizationListPage>>
  patientId: string
}) {
  const router = useRouter()
  const result = React.use(resultPromise)
  if (!result.success && result.error === 'Not authorized.') return null
  return (
    <InfoSection title="Patient Authorization" onEditClick={() => router.push(`/patients/${patientId}/authorization`)} buttonText="View">
      <InfoRows>
        {!result.success || !result.data ? (
          <InfoRow label="Authorization">{result.error ?? 'Unable to load authorizations.'}</InfoRow>
        ) : result.data.rows.length === 0 ? (
          <InfoRow label="Authorization">No authorization information on file.</InfoRow>
        ) : (
          result.data.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
            <InfoRow key={row.id} label={row.payer.payer_name}>
              {row.effective_status} · {row.masked_prior_auth_number ?? 'No authorization number'}
            </InfoRow>
          ))
        )}
        {result.success && result.data && result.data.rowCount > PREVIEW_ROW_LIMIT && (
          <ViewMore path={`/patients/${patientId}/authorization`} />
        )}
      </InfoRows>
    </InfoSection>
  )
}

export default function PatientCore({
  patient,
  addressesPromise,
  contactsPromise,
  requirementsPromise,
  authorizationsPromise,
}: PatientCoreProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = React.useTransition()
  const fullName = [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ')
  const createdByName = [patient.created_by?.first_name, patient.created_by?.last_name].filter(Boolean).join(' ')

  const goTo = React.useCallback(
    (path: string) => () => {
      router.push(`/patients/${patient.id}/${path}`)
    },
    [router, patient.id],
  )

  const handleRefresh = React.useCallback(() => {
    startRefresh(() => {
      router.refresh()
    })
  }, [router])

  return (
    <PageContainer
      title="Patient Information"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Patients', path: '/patients' },
        { title: fullName || 'Patient' },
      ]}
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Tooltip title="Reload data" placement="right" enterDelay={1000}>
            <div>
              <IconButton size="small" aria-label="reload" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              </IconButton>
            </div>
          </Tooltip>
          <Button variant="contained" startIcon={<AutorenewIcon />} onClick={goTo('matching')}>
            Match Patient
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          Review and manage demographics, service details, contacts, and matching requirements for {fullName || 'this patient'}.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          <InfoSection title="Demographics" onEditClick={goTo('edit')}>
            <InfoRows>
              <InfoRow label="Name">{fullName || '—'}</InfoRow>
              <InfoRow label="Date of Birth">{patient.date_of_birth ?? '—'}</InfoRow>
              <InfoRow label="Status">{patient.status}</InfoRow>
              <InfoRow label="External ID">{patient.patient_external_id ?? '—'}</InfoRow>
              <InfoRow label="Created By">{createdByName || 'Unknown user'}</InfoRow>
            </InfoRows>
          </InfoSection>

          <InfoSection title="Caregiver Assignment" onEditClick={goTo('matching')} buttonText="View Matches">
            <InfoRows>
              <InfoRow label="Assignment">No caregiver assigned.</InfoRow>
            </InfoRows>
          </InfoSection>

          <InfoSection title="Addresses" onEditClick={goTo('address')}>
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Address" /></InfoRows>}>
              <AddressPreview patientId={patient.id} addressesPromise={addressesPromise} />
            </React.Suspense>
          </InfoSection>

          <InfoSection title="Emergency Contacts" onEditClick={goTo('contact')}>
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Contact" /></InfoRows>}>
              <ContactPreview patientId={patient.id} contactsPromise={contactsPromise} />
            </React.Suspense>
          </InfoSection>

          {authorizationsPromise && (
            <React.Suspense fallback={null}>
              <AuthorizationPreview resultPromise={authorizationsPromise} patientId={patient.id} />
            </React.Suspense>
          )}

          <InfoSection title="Requirements" onEditClick={goTo('requirement')}>
            <React.Suspense fallback={<InfoRows><PreviewFallback label="Requirement" /></InfoRows>}>
              <RequirementPreview patientId={patient.id} requirementsPromise={requirementsPromise} />
            </React.Suspense>
          </InfoSection>
        </Box>
      </Stack>
    </PageContainer>
  )
}
