import type {
  AppConfig,
  AppNotification,
  ContactMethod,
  DiscoverResponse,
  FeedbackValue,
  MatchDetail,
  MatchesResponse,
  MeResponse,
  MissingPartnerSuggestion,
  Mode,
  ModeProfileInput,
  PartnerIntent,
  PartnerUpResponse,
  Partnership,
  ProfileDraft,
  ProfileInput,
  StudyGroupSuggestion,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;
let onUnauthorized: () => void = () => {};

export function configureApi(options: { getToken: TokenGetter; onUnauthorized: () => void }): void {
  getToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

const FRIENDLY_OFFLINE = 'We couldn’t reach Partner Up. Check your connection and try again.';

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline', FRIENDLY_OFFLINE);
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON (e.g. proxy error page) — handled below.
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? 'Something went wrong. Please try again.');
  }
  return payload as T;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
}

export const api = {
  config: () => request<AppConfig>('GET', '/api/config'),
  signUp: (email: string, password: string) => request<Tokens>('POST', '/api/auth/signup', { email, password }),
  signIn: (email: string, password: string) => request<Tokens>('POST', '/api/auth/login', { email, password }),
  signOut: () => request<{ ok: true }>('POST', '/api/auth/logout'),
  demo: () => request<Tokens>('POST', '/api/auth/demo'),
  resetDemo: () => request<{ ok: true }>('POST', '/api/demo/reset'),

  me: () => request<MeResponse>('GET', '/api/me'),
  saveProfile: (profile: ProfileInput) => request<MeResponse>('PUT', '/api/profile', profile),
  saveModeProfile: (mode: Mode, input: ModeProfileInput) => request<MeResponse>('PUT', `/api/mode-profiles/${mode}`, input),
  saveContacts: (contacts: ContactMethod[]) => request<MeResponse>('PUT', '/api/contacts', { contacts }),
  regenerateDna: () => request<MeResponse>('POST', '/api/dna/generate'),
  deleteAccount: () => request<{ ok: true }>('DELETE', '/api/account'),
  profileDraft: (text: string, mode: Mode) => request<ProfileDraft>('POST', '/api/ai/profile-draft', { text, mode }),

  discover: (mode: Mode | null, text?: string) => request<DiscoverResponse>('POST', '/api/discover', { mode, text }),
  matchDetail: (targetId: string, mode: Mode, intent: PartnerIntent | null) =>
    request<MatchDetail>('POST', '/api/match/detail', { targetId, mode, intent }),
  partnerUp: (targetId: string, mode: Mode, intent: PartnerIntent | null) =>
    request<PartnerUpResponse>('POST', '/api/partner-up', { targetId, mode, intent }),
  withdraw: (requestId: string) => request<{ ok: true }>('DELETE', `/api/partner-up/${requestId}`),
  matches: () => request<MatchesResponse>('GET', '/api/matches'),
  partnership: (id: string) => request<Partnership>('GET', `/api/partnerships/${id}`),
  endPartnership: (id: string) => request<{ ok: true }>('POST', `/api/partnerships/${id}/end`),
  feedback: (targetId: string, mode: Mode, value: FeedbackValue) => request<{ ok: true }>('POST', '/api/feedback', { targetId, mode, value }),

  buildGroup: (subjects: string[] | undefined, size: number) => request<StudyGroupSuggestion>('POST', '/api/groups/build', { subjects, size }),
  completeGroup: (memberIds: string[], subjects: string[], subject: string) =>
    request<MissingPartnerSuggestion>('POST', '/api/groups/complete', { memberIds, subjects, subject }),
  partnerUpGroup: (memberIds: string[], subjects: string[]) =>
    request<{ results: Array<{ profileId: string } & PartnerUpResponse> }>('POST', '/api/groups/partner-up', { memberIds, subjects }),

  notifications: () => request<{ notifications: AppNotification[] }>('GET', '/api/notifications'),
  markNotificationsRead: () => request<{ ok: true }>('POST', '/api/notifications/read'),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Partner AI is taking a break. Your profile is safe — try again shortly.';
}
