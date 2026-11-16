export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(entity: string, id?: number | string) {
    return new AppError(404, id === undefined ? `${entity} not found` : `${entity} ${id} not found`);
  }

  static conflict(message: string) {
    return new AppError(409, message);
  }
}
