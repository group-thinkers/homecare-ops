import { renderAuthorizationPage } from '../route-content'

export default async function Page({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params
  return renderAuthorizationPage({ patientId, mode: 'new' })
}
