import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const defaultSourceFile = path.join(projectRoot, 'public', 'assets', 'qb.json')
const defaultOutputDir = path.join(projectRoot, 'public', 'assets', 'qb-pages')
const defaultManifestFile = path.join(projectRoot, 'public', 'assets', 'qb.manifest.json')

/** @typedef {{ options?: unknown; answer?: unknown; type?: unknown; updated_at?: unknown; updatedAt?: unknown }} RawQuestion */
/** @typedef {{ question: string; options: string[]; answer: number; type?: string; updated_at?: string }} NormalizedQuestion */

/**
 * @typedef {object} CliOptions
 * @property {number} pageSize
 * @property {string} sourceFile
 * @property {string} outputDir
 * @property {string} manifestFile
 * @property {boolean} stage
 * @property {boolean} ifChanged
 * @property {boolean} quiet
 */

function printHelp() {
  console.log(`Usage: node ./scripts/split-qb.mjs [options] [pageSize]

Options:
  --page-size <n>    Questions per page (default: 240)
  --source <path>    Source qb.json path
  --output-dir <dir> Output directory for page files
  --manifest <path>  Output manifest file path
  --if-changed       Only run when source qb.json changed in git
  --stage            Stage generated files with git add -A
  --quiet            Only print essential messages
  --help             Show this help
`) }

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {CliOptions} */
  const options = {
    pageSize: 240,
    sourceFile: defaultSourceFile,
    outputDir: defaultOutputDir,
    manifestFile: defaultManifestFile,
    stage: false,
    ifChanged: false,
    quiet: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--page-size') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --page-size')
      const parsed = Number.parseInt(next, 10)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid --page-size: ${next}`)
      }
      options.pageSize = parsed
      i += 1
      continue
    }

    if (arg === '--source') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --source')
      options.sourceFile = path.resolve(projectRoot, next)
      i += 1
      continue
    }

    if (arg === '--output-dir') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --output-dir')
      options.outputDir = path.resolve(projectRoot, next)
      i += 1
      continue
    }

    if (arg === '--manifest') {
      const next = argv[i + 1]
      if (!next) throw new Error('Missing value for --manifest')
      options.manifestFile = path.resolve(projectRoot, next)
      i += 1
      continue
    }

    if (arg === '--if-changed') {
      options.ifChanged = true
      continue
    }

    if (arg === '--stage') {
      options.stage = true
      continue
    }

    if (arg === '--quiet') {
      options.quiet = true
      continue
    }

    if (/^\d+$/.test(arg)) {
      const parsed = Number.parseInt(arg, 10)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid page size: ${arg}`)
      }
      options.pageSize = parsed
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<{ code: number; stdout: string; stderr: string }>}
 */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr })
    })
  })
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>} true when file content changed
 */
async function writeFileIfChanged(filePath, content) {
  let before = null
  if (await exists(filePath)) {
    before = await fs.readFile(filePath, 'utf8')
  }

  if (before === content) {
    return false
  }

  await fs.writeFile(filePath, content, 'utf8')
  return true
}

/**
 * @param {string} question
 * @param {RawQuestion} raw
 * @returns {NormalizedQuestion | null}
 */
function normalizeQuestion(question, raw) {
  if (typeof question !== 'string' || question.length === 0) {
    return null
  }

  const options = Array.isArray(raw?.options) ? raw.options.filter((value) => typeof value === 'string').slice(0, 4) : []
  const answer = Number(raw?.answer ?? 0)

  if (options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) {
    return null
  }

  const normalized = {
    question,
    options,
    answer,
  }

  if (typeof raw?.type === 'string') {
    normalized.type = raw.type
  }

  const updatedAtRaw = typeof raw?.updated_at === 'string' ? raw.updated_at : typeof raw?.updatedAt === 'string' ? raw.updatedAt : null
  if (typeof updatedAtRaw === 'string') {
    const trimmed = updatedAtRaw.trim()
    if (trimmed.length > 0) {
      normalized.updated_at = trimmed
    }
  }

  return normalized
}

/**
 * @param {NormalizedQuestion[]} items
 * @param {number} size
 */
function toChunks(items, size) {
  const chunks = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

/** @param {string} input */
function sha256(input) {
  return createHash('sha256').update(input).digest('hex')
}

/** @param {string} fromPath */
function toPosixRelativePath(fromPath) {
  const relative = path.relative(projectRoot, fromPath)
  return relative.split(path.sep).join('/')
}

/** @param {string} sourceFile */
function toManifestSourcePath(sourceFile) {
  const publicDir = path.join(projectRoot, 'public')
  const fromPublic = path.relative(publicDir, sourceFile)
  if (!fromPublic.startsWith('..') && !path.isAbsolute(fromPublic)) {
    return fromPublic.split(path.sep).join('/')
  }

  return toPosixRelativePath(sourceFile)
}

/** @param {string} sourceFile */
async function shouldRunByGitDiff(sourceFile) {
  const relativeSource = toPosixRelativePath(sourceFile)
  const checks = [
    ['diff', '--name-only', '--', relativeSource],
    ['diff', '--cached', '--name-only', '--', relativeSource],
  ]

  for (const args of checks) {
    const result = await run('git', args)
    if (result.code !== 0) {
      const message = result.stderr.trim() || `git ${args.join(' ')} failed`
      throw new Error(message)
    }

    if (result.stdout.trim().length > 0) {
      return true
    }
  }

  return false
}

/**
 * @param {CliOptions} options
 * @param {string[]} expectedFiles
 */
async function cleanupStalePages(options, expectedFiles) {
  const expected = new Set(expectedFiles.map((file) => path.basename(file)))
  const entries = await fs.readdir(options.outputDir, { withFileTypes: true })

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !expected.has(entry.name))
      .map((entry) => fs.rm(path.join(options.outputDir, entry.name), { force: true })),
  )
}

/** @param {CliOptions} options */
async function splitQuestionBank(options) {
  if (!(await exists(options.sourceFile))) {
    throw new Error(`Source file not found: ${options.sourceFile}`)
  }

  const rawContent = await fs.readFile(options.sourceFile, 'utf8')
  const parsed = JSON.parse(rawContent)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('qb.json must be an object map')
  }

  const sourceEntries = Object.entries(parsed)
  /** @type {NormalizedQuestion[]} */
  const normalized = []

  for (const [question, raw] of sourceEntries) {
    const item = normalizeQuestion(question, /** @type {RawQuestion} */ (raw))
    if (item) {
      normalized.push(item)
    }
  }

  const chunks = toChunks(normalized, options.pageSize)

  await fs.mkdir(options.outputDir, { recursive: true })
  await fs.mkdir(path.dirname(options.manifestFile), { recursive: true })

  const pages = []
  const expectedPageFiles = []
  let changedFiles = 0

  for (let index = 0; index < chunks.length; index += 1) {
    const fileName = `qb.page.${String(index + 1).padStart(3, '0')}.json`
    const pageItems = chunks[index]
    const pagePath = path.join(options.outputDir, fileName)
    const pageContent = JSON.stringify(pageItems)
    const pageHash = sha256(pageContent)

    const pageChanged = await writeFileIfChanged(pagePath, pageContent)
    if (pageChanged) {
      changedFiles += 1
    }

    expectedPageFiles.push(pagePath)
    pages.push({
      index,
      file: fileName,
      count: pageItems.length,
      hash: pageHash,
    })
  }

  await cleanupStalePages(options, expectedPageFiles)

  const manifest = {
    version: 1,
    source: toManifestSourcePath(options.sourceFile),
    total: normalized.length,
    pageSize: options.pageSize,
    contentHash: sha256(JSON.stringify(normalized)),
    dropped: sourceEntries.length - normalized.length,
    pages,
  }

  const manifestChanged = await writeFileIfChanged(options.manifestFile, JSON.stringify(manifest, null, 2))
  if (manifestChanged) {
    changedFiles += 1
  }

  return {
    total: normalized.length,
    pages: pages.length,
    pageSize: options.pageSize,
    dropped: manifest.dropped,
    changedFiles,
  }
}

/**
 * @param {CliOptions} options
 * @param {string[]} files
 */
async function stageGeneratedFiles(options, files) {
  const args = ['add', '-A', ...files.map((file) => toPosixRelativePath(file))]
  const result = await run('git', args)

  if (result.code !== 0) {
    const message = result.stderr.trim() || 'Failed to stage generated question bank files'
    throw new Error(message)
  }

  if (!options.quiet) {
    console.log(`Staged generated files: ${files.map((file) => toPosixRelativePath(file)).join(', ')}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.ifChanged) {
    const changed = await shouldRunByGitDiff(options.sourceFile)
    if (!changed) {
      if (!options.quiet) {
        console.log('Skip split: source qb.json has no git changes.')
      }
      return
    }
  }

  const result = await splitQuestionBank(options)

  if (!options.quiet) {
    console.log(
      `Split question bank complete. total=${result.total}, pages=${result.pages}, pageSize=${result.pageSize}, dropped=${result.dropped}, changedFiles=${result.changedFiles}`,
    )
  }

  if (options.stage) {
    await stageGeneratedFiles(options, [options.manifestFile, options.outputDir])
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
