import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { TEMP_PREFIX, writeFileAtomic } from '../atomicWrite'

describe('writeFileAtomic', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-atomic-'))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(dir, { recursive: true, force: true })
  })

  const leftovers = async () => (await fs.readdir(dir)).filter((n) => n.startsWith(TEMP_PREFIX))

  it('creates a new file (text and binary)', async () => {
    await writeFileAtomic(path.join(dir, 'a.md'), '# 안녕')
    await writeFileAtomic(path.join(dir, 'b.bin'), new Uint8Array([1, 2, 3]))
    expect(await fs.readFile(path.join(dir, 'a.md'), 'utf-8')).toBe('# 안녕')
    expect([...(await fs.readFile(path.join(dir, 'b.bin')))]).toEqual([1, 2, 3])
    expect(await leftovers()).toEqual([])
  })

  it('replaces an existing file and keeps its permissions', async () => {
    const target = path.join(dir, 'memo.md')
    await fs.writeFile(target, 'old')
    await fs.chmod(target, 0o600)
    await writeFileAtomic(target, 'new')
    expect(await fs.readFile(target, 'utf-8')).toBe('new')
    if (process.platform !== 'win32') expect((await fs.stat(target)).mode & 0o777).toBe(0o600)
    expect(await leftovers()).toEqual([])
  })

  it('leaves the old content intact and cleans up when the rename fails', async () => {
    const target = path.join(dir, 'memo.md')
    await fs.writeFile(target, 'old')
    vi.spyOn(fs, 'rename').mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }))
    await expect(writeFileAtomic(target, 'new')).rejects.toThrow('boom')
    expect(await fs.readFile(target, 'utf-8')).toBe('old')
    expect(await leftovers()).toEqual([])
  })

  it('Windows: retries a locked rename, then succeeds', async () => {
    const target = path.join(dir, 'memo.md')
    await fs.writeFile(target, 'old')
    const realRename = fs.rename.bind(fs)
    let calls = 0
    vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      calls++
      if (calls < 3) throw Object.assign(new Error('locked'), { code: 'EBUSY' })
      return realRename(from, to)
    })
    await writeFileAtomic(target, 'new', { platform: 'win32', retryDelayMs: 1 })
    expect(calls).toBe(3)
    expect(await fs.readFile(target, 'utf-8')).toBe('new')
    expect(await leftovers()).toEqual([])
  })

  it('Windows: falls back to an in-place copy when the target stays locked', async () => {
    const target = path.join(dir, 'memo.md')
    await fs.writeFile(target, 'old')
    vi.spyOn(fs, 'rename').mockRejectedValue(Object.assign(new Error('locked'), { code: 'EPERM' }))
    await writeFileAtomic(target, 'new', { platform: 'win32', renameAttempts: 2, retryDelayMs: 1 })
    expect(await fs.readFile(target, 'utf-8')).toBe('new')
    expect(await leftovers()).toEqual([])
  })

  it('fails when the directory does not exist', async () => {
    await expect(writeFileAtomic(path.join(dir, 'missing', 'x.md'), 'x')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
