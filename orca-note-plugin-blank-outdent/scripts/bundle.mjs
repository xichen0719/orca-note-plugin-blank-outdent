import { readdir, readFile, unlink, writeFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const distDir = join(rootDir, "dist")
const entryFile = join(distDir, "index.js")
const seenFiles = new Set()
const moduleChunks = []

await collectModule(entryFile, true)
await writeFile(entryFile, `${moduleChunks.join("\n\n")}\n`, "utf8")

for (const entry of await readdir(distDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".js") && entry.name !== "index.js") {
    await unlink(join(distDir, entry.name))
  }
}

async function collectModule(filePath, keepExports) {
  const normalizedPath = resolve(filePath)
  if (seenFiles.has(normalizedPath)) return
  seenFiles.add(normalizedPath)

  const source = await readFile(normalizedPath, "utf8")
  const importMatches = source.matchAll(/^import\s+(?!type)[\s\S]*?from\s+"(\.\/[^"]+\.js)";$/gm)
  for (const match of importMatches) {
    const specifier = match[1]
    if (specifier == null) continue
    await collectModule(join(dirname(normalizedPath), specifier), false)
  }

  const body = transformModule(source, keepExports)
  if (body.trim().length > 0) {
    moduleChunks.push(`// ${basename(normalizedPath)}\n${body}`)
  }
}

function transformModule(source, keepExports) {
  let result = source
    .replace(/^import\s+(?!type)[\s\S]*?from\s+"\.\/[^"]+\.js";\r?\n?/gm, "")
    .replace(/^export\s+\{};\r?\n?/gm, "")

  if (!keepExports) {
    result = result
      .replace(/^export\s+(const|let|var)\s+/gm, "$1 ")
      .replace(/^export\s+function\s+/gm, "function ")
      .replace(/^export\s+class\s+/gm, "class ")
  }

  return result.trim()
}
