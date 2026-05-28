/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'

function toModulePath(sourcePath) {
  return sourcePath.replace(/\.ts$/, '.mjs').replace(/\.tsx$/, '.mjs')
}

function rewriteRelativeImports(outputText) {
  return outputText.replace(/from ['"](\.{1,2}\/[^'"]+)['"]/g, (match, specifier) => {
    if (specifier.endsWith('.js') || specifier.endsWith('.mjs')) return match
    return match.replace(specifier, `${specifier}.mjs`)
  })
}

export async function loadTranspiledModule({
  entry,
  modules,
  prefix = 'gitwikitree-test-',
  compilerOptions = {}
}) {
  const tempDir = await mkdtemp(join(tmpdir(), prefix))
  await symlink(
    new URL('../../node_modules', import.meta.url),
    join(tempDir, 'node_modules'),
    'dir'
  )

  for (const sourcePath of modules) {
    const targetPath = join(tempDir, toModulePath(sourcePath))
    await mkdir(dirname(targetPath), { recursive: true })

    const source = await readFile(new URL(`../../${sourcePath}`, import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        ...compilerOptions
      }
    })
    await writeFile(targetPath, rewriteRelativeImports(outputText))
  }

  const module = await import(`file://${join(tempDir, toModulePath(entry))}`)
  return { module, tempDir }
}

export async function loadSingleTranspiledModule(sourcePath) {
  const { module, tempDir } = await loadTranspiledModule({
    entry: sourcePath,
    modules: [sourcePath],
    prefix: 'gitwikitree-single-module-test-'
  })

  return { module, tempDir }
}
