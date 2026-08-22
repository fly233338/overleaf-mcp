export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function maskToken(value: unknown, secrets: readonly string[] = []): string {
  let message = String(value ?? '');

  for (const secret of secrets) {
    if (secret) {
      message = message.split(secret).join('***');
    }
  }

  return message.replace(/https:\/\/git:[^@\s]+@/gi, 'https://git:***@');
}
