export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ConfigurationCreatedError extends Error {
  constructor(readonly filePath: string) {
    super(`Configuration created at ${filePath}\nAdd your Overleaf project and restart.`);
    this.name = 'ConfigurationCreatedError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function maskToken(value: unknown, token?: string): string {
  let message = String(value ?? '');

  if (token) {
    message = message.split(token).join('***');
  }

  return message.replace(/https:\/\/git:[^@\s]+@/gi, 'https://git:***@');
}
