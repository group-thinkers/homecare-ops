import { renderAuthorizationPage } from './route-content'

export default async function Page({ params, searchParams }: {
  params: Promise<{ patientId: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { patientId } = await params
  const rawPage = (await searchParams).page
  const page = typeof rawPage === 'string' && /^\d+$/.test(rawPage) ? Number(rawPage) : 0
  return renderAuthorizationPage({ patientId, mode: 'list', page: Number.isSafeInteger(page) ? page : 0 })
}
