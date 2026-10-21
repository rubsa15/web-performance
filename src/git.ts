import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitInfo {
  commit: string;
  dirty: boolean;
}

/**
 * Commit actual del repositorio de `cwd`, o `undefined` si no es un repo (o no hay git/commits).
 * `.perf/` se excluye de `dirty`: los reportes guardados no deben marcar el árbol como sucio.
 */
export async function getGitInfo(cwd: string): Promise<GitInfo | undefined> {
  const git = (...args: string[]) => execFileAsync('git', args, { cwd });
  try {
    const { stdout: commit } = await git('rev-parse', '--short', 'HEAD');
    const { stdout: status } = await git('status', '--porcelain', '--', '.', ':(exclude).perf');
    return { commit: commit.trim(), dirty: status.trim().length > 0 };
  } catch {
    return undefined;
  }
}
