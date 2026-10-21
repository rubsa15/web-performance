/** Error de uso (argumentos o flags inválidos). Sale con código 2. */
export class UsageError extends Error {
  override name = 'UsageError';
}

/** Error de ejecución (Chrome, red, timeout, formato inesperado). Sale con código 3. */
export class RuntimeError extends Error {
  override name = 'RuntimeError';
}
