export type JwtUser = {
  id: string;
  email: string;
  role: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export class HttpError extends Error {
  status: number;
  extra: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
