import { renderAuthorizationPage } from '../../../route-content'

export default async function Page({ params }: { params: Promise<{ patientId: string; authorizationId: string }> }) {
  return renderAuthorizationPage({ ...await params, mode: 'service-new' })
}
