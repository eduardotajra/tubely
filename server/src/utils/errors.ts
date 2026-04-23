export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message)
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(400, message)
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, message)
  }
}
