// Seeds two organizations with a handful of users and patients through the Supabase admin API.
// Idempotent: safe to run against a database that was already seeded.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
export const PASSWORD = 'e2e-Password-1!'

const ORG_A = '11111111-aaaa-aaaa-aaaa-111111111111'
const ORG_B = '22222222-bbbb-bbbb-bbbb-222222222222'

const USERS = [
  { email: 'admin-a@e2e.test', first: 'Ada', last: 'Admin', org: ORG_A, roles: ['Agency Administrator'] },
  // Only the sign-out test uses this one: signOut() ends every session of a user, which would log out parallel tests.
  { email: 'logout-a@e2e.test', first: 'Lou', last: 'Logout', org: ORG_A, roles: ['Agency Administrator'] },
  { email: 'scheduler-a@e2e.test', first: 'Sam', last: 'Scheduler', org: ORG_A, roles: ['Scheduler'] },
  { email: 'admin-b@e2e.test', first: 'Bea', last: 'Beta', org: ORG_B, roles: ['Agency Administrator'] },
]

async function must(promise, what) {
  const { data, error } = await promise
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

async function ensureUser({ email, first, last }) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  let id = data?.user?.id
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw new Error(`createUser ${email}: ${error.message}`)
    const list = await must(admin.auth.admin.listUsers({ perPage: 200 }), 'listUsers')
    id = list.users.find((u) => u.email === email)?.id
  }
  await must(
    admin.from('user_profiles').upsert({ id, first_name: first, last_name: last, access_status: 'Active' }),
    `profile ${email}`,
  )
  return id
}

await must(
  admin.from('organizations').upsert([
    { id: ORG_A, name: 'E2E Org A', timezone: 'America/Chicago' },
    { id: ORG_B, name: 'E2E Org B', timezone: 'America/Chicago' },
  ]),
  'organizations',
)

const ids = {}
for (const u of USERS) {
  ids[u.email] = await ensureUser(u)
  await must(
    admin
      .from('organization_memberships')
      .upsert(
        { organization_id: u.org, user_id: ids[u.email], roles: u.roles, status: 'Active' },
        { onConflict: 'organization_id,user_id' },
      ),
    `membership ${u.email}`,
  )
}

await must(
  admin.from('patients').upsert([
    {
      id: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
      organization_id: ORG_A,
      first_name: 'Alma',
      last_name: 'Alphapatient',
      status: 'Active',
      created_by_user_id: ids['admin-a@e2e.test'],
    },
    {
      id: 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
      organization_id: ORG_B,
      first_name: 'Bruno',
      last_name: 'Betapatient',
      status: 'Active',
      created_by_user_id: ids['admin-b@e2e.test'],
    },
  ]),
  'patients',
)

console.log('e2e seed complete')
