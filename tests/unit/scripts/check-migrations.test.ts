// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve(__dirname, '../../../scripts/check-migrations.sh')
let repo: string

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } })
const write = (name: string, body = '-- sql\n') => writeFileSync(join(repo, 'supabase/migrations', name), body)
const commit = (msg: string) => { git('add', '-A'); git('commit', '-q', '-m', msg) }
const run = (...args: string[]) => spawnSync('bash', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' })

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'migcheck-'))
  git('init', '-q', '-b', 'main')
  mkdirSync(join(repo, 'supabase/migrations'), { recursive: true })
  write('00001_init.sql')
  write('00002_more.sql')
  commit('base')
  git('branch', 'base-ref') // the "main" the PR is compared with
  git('checkout', '-q', '-b', 'pr')
})
afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('check-migrations.sh', () => {
  it('passes a clean history and a new sequential migration', () => {
    write('00003_new.sql'); commit('add')
    const r = run('--base', 'base-ref')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('ok (3 migrations)')
  })

  it('fails on a duplicate number (two PRs both took 00003)', () => {
    write('00003_a.sql'); write('00003_b.sql'); commit('dup')
    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('duplicate migration number 00003')
  })

  it('fails on a gap', () => {
    write('00004_skips_three.sql'); commit('gap')
    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('gap before 00004_skips_three.sql')
  })

  it('fails on a badly named file', () => {
    write('0003_short.sql'); commit('bad')
    const r = run()
    expect(r.status).toBe(1)
    expect(r.stderr).toContain("bad file name '0003_short.sql'")
  })

  it('fails when an existing migration is edited', () => {
    write('00002_more.sql', '-- changed\n'); commit('edit')
    const r = run('--base', 'base-ref')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('existing migration 00002_more.sql was changed')
  })

  it('fails when an existing migration is deleted', () => {
    rmSync(join(repo, 'supabase/migrations/00002_more.sql')); commit('delete')
    const r = run('--base', 'base-ref')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('00002_more.sql was changed')
  })

  it('fails when an existing migration is renamed', () => {
    renameSync(join(repo, 'supabase/migrations/00002_more.sql'), join(repo, 'supabase/migrations/00002_renamed.sql')); commit('rename')
    const r = run('--base', 'base-ref')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('was changed')
  })

  it('allows an edit that is listed in the allow file, and says so', () => {
    write('00002_more.sql', '-- changed\n')
    writeFileSync(join(repo, 'supabase/migration-edits.allow'), '# comment\n00002_more.sql  reserved word alias\n')
    commit('edit with allowlist')
    const r = run('--base', 'base-ref')
    expect(r.status).toBe(0)
    expect(r.stderr).toContain('allowed by')
  })

  it('does not compare with the base when none is given (post-merge pushes)', () => {
    write('00002_more.sql', '-- changed\n'); commit('edit')
    expect(run().status).toBe(0)
  })
})
