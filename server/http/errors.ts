export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what = 'That') => new ApiError(404, 'not_found', `${what} could not be found.`);
export const forbidden = () => new ApiError(403, 'forbidden', 'You don’t have access to that.');
export const needsProfile = () => new ApiError(409, 'profile_required', 'Tell Partner AI a little about yourself first.');
