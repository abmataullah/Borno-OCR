const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('docflow_token');
}

function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('docflow_token', token);
  } else {
    localStorage.removeItem('docflow_token');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  isAdmin?: boolean;
  storageQuotaMb?: number;
  storageUsedMb?: number;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  pageCount: number;
  fileSizeKb: number;
  isShared: boolean;
  shareToken: string | null;
  originalPdfKey: string | null;
  projectData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  priceUsd: number;
  priceBdt: number;
  storageMb: number;
  features: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  provider: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: string;
}

export interface Job {
  id: string;
  projectId: string;
  userId: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
  bullmqJobId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  isAdmin: boolean;
  storageQuotaMb: number;
  storageUsedMb: number;
  createdAt: string;
}

export interface AdminProject {
  id: string;
  userId: string;
  name: string;
  pageCount: number;
  fileSizeKb: number;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayConfig {
  enabled: boolean;
  secretKey?: string;
  appKey?: string;
  appSecret?: string;
  username?: string;
  password?: string;
  storeId?: string;
  storePasswd?: string;
  baseUrl?: string;
}

export interface AppSettingsData {
  gateways: {
    stripe: GatewayConfig;
    bkash: GatewayConfig;
    sslcommerz: GatewayConfig;
  };
  planOverrides: Partial<Record<string, { priceUsd?: number; priceBdt?: number }>>;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportTicket extends SupportTicket {
  userEmail: string | null;
  userName: string | null;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderRole: 'customer' | 'admin';
  senderId: string | null;
  body: string;
  createdAt: string;
}

export interface AnnotationData {
  id: string;
  projectId: string;
  userId: string;
  pageIndex: number;
  annotationType: string;
  content: string | null;
  bbox: Record<string, unknown> | null;
  color: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export const api = {
  setToken,
  getToken,

  auth: {
    requestOtp: (email: string) =>
      request<{ sent: boolean }>('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    verifyOtp: (email: string, code: string, name?: string) =>
      request<{ token: string; user: User }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code, name }),
      }),

    me: () => request<User>('/auth/me'),
  },

  projects: {
    list: () => request<Project[]>('/projects'),
    search: (query: string) => request<Project[]>(`/projects?q=${encodeURIComponent(query)}`),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (data: { id?: string; name: string; pageCount?: number; fileSizeKb?: number; projectData?: Record<string, unknown> }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; pageCount: number; fileSizeKb: number; projectData: Record<string, unknown> }>) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    share: (id: string, isShared: boolean) =>
      request<{ shareToken: string | null; isShared: boolean }>(`/projects/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ isShared }),
      }),
    upload: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<Project>(`/projects/${id}/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    process: (id: string, options?: { runOcr?: boolean; runTableDetection?: boolean; ocrLang?: string }) =>
      request<Job>(`/projects/${id}/process`, {
        method: 'POST',
        body: JSON.stringify(options ?? {}),
      }),
    convert: (id: string, targetFormat: 'docx' | 'odt' | 'html') =>
      request<Job>(`/projects/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ targetFormat }),
      }),
  },

  jobs: {
    get: (jobId: string) => request<Job>(`/jobs/${jobId}`),
    getByProject: (projectId: string) => request<Job[]>(`/projects/${projectId}/jobs`),
    streamUrl: (jobId: string) => `${API_BASE}/jobs/${jobId}/stream`,
  },

  billing: {
    plans: () => request<{ plans: Plan[] }>('/billing/plans'),
    subscription: () => request<Subscription | null>('/billing/subscription'),
    history: () => request<Payment[]>('/billing/history'),
    createPayment: (data: { provider: string; planId: string; amount: number; currency: string; returnUrl: string }) =>
      request<{ paymentId: string; checkoutUrl: string }>('/billing/create-payment', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  admin: {
    stats: () => request<{
      users: number;
      projects: number;
      payments: number;
      revenue: number;
      planDistribution: Record<string, number>;
    }>('/admin/stats'),
    listUsers: (limit = 50, offset = 0) =>
      request<AdminUser[]>(`/admin/users?limit=${limit}&offset=${offset}`),
    getUser: (userId: string) => request<AdminUser>(`/admin/users/${userId}`),
    updatePlan: (userId: string, planId: string, storageQuotaMb?: number) =>
      request<{ success: boolean }>(`/admin/users/${userId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ planId, storageQuotaMb }),
      }),
    setAdmin: (userId: string, isAdmin: boolean) =>
      request<{ success: boolean }>(`/admin/users/${userId}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isAdmin }),
      }),
    deleteUser: (userId: string) =>
      request<void>(`/admin/users/${userId}`, { method: 'DELETE' }),
    addManualPayment: (data: {
      userId: string;
      planId: string;
      amount: number;
      provider?: string;
      note?: string;
    }) =>
      request<{ success: boolean }>('/admin/payments/manual', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listProjects: (limit = 50, offset = 0) =>
      request<AdminProject[]>(`/admin/projects?limit=${limit}&offset=${offset}`),
    listPayments: (limit = 50, offset = 0) =>
      request<Payment[]>(`/admin/payments?limit=${limit}&offset=${offset}`),
    getSettings: () => request<AppSettingsData>('/admin/settings'),
    updateSettings: (patch: Partial<AppSettingsData>) =>
      request<AppSettingsData>('/admin/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    listTickets: (limit = 50, offset = 0) =>
      request<AdminSupportTicket[]>(`/admin/tickets?limit=${limit}&offset=${offset}`),
    getTicket: (ticketId: string) =>
      request<{ ticket: SupportTicket; messages: TicketMessage[] }>(`/admin/tickets/${ticketId}`),
    replyToTicket: (ticketId: string, body: string) =>
      request<TicketMessage>(`/admin/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    updateTicketStatus: (ticketId: string, status: 'open' | 'pending' | 'closed') =>
      request<{ success: boolean }>(`/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  tickets: {
    list: () => request<SupportTicket[]>('/tickets'),
    create: (subject: string, message: string) =>
      request<SupportTicket>('/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) }),
    get: (ticketId: string) =>
      request<{ ticket: SupportTicket; messages: TicketMessage[] }>(`/tickets/${ticketId}`),
    reply: (ticketId: string, body: string) =>
      request<TicketMessage>(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
  },

  public: {
    getSharedProject: (shareToken: string) =>
      request<{
        id: string;
        name: string;
        pageCount: number;
        projectData: Record<string, unknown> | null;
        createdAt: string;
        updatedAt: string;
      }>(`/public/projects/${shareToken}`),
    downloadSharedProject: (shareToken: string) =>
      `${API_BASE}/public/projects/${shareToken}/download`,
  },

  annotations: {
    list: (projectId: string, page?: number) =>
      request<AnnotationData[]>(
        page !== undefined
          ? `/projects/${projectId}/annotations?page=${page}`
          : `/projects/${projectId}/annotations`
      ),
    create: (projectId: string, data: {
      pageIndex: number;
      annotationType?: string;
      content?: string;
      bbox?: Record<string, unknown>;
      color?: string;
    }) =>
      request<AnnotationData>(`/projects/${projectId}/annotations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (annotationId: string, data: Partial<{
      content: string;
      bbox: Record<string, unknown>;
      color: string;
      resolved: boolean;
    }>) =>
      request<AnnotationData>(`/annotations/${annotationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (annotationId: string) =>
      request<void>(`/annotations/${annotationId}`, { method: 'DELETE' }),
  },

  batch: {
    deleteProjects: (projectIds: string[]) =>
      request<{ results: { id: string; deleted: boolean }[] }>('/batch/projects/delete', {
        method: 'POST',
        body: JSON.stringify({ projectIds }),
      }),
    processProjects: (projectIds: string[], options?: { runOcr?: boolean; runTableDetection?: boolean; ocrLang?: string }) =>
      request<{ results: { id: string; jobId?: string; error?: string }[] }>('/batch/projects/process', {
        method: 'POST',
        body: JSON.stringify({ projectIds, options }),
      }),
    convertProjects: (projectIds: string[], targetFormat: 'docx' | 'odt' | 'html') =>
      request<{ results: { id: string; jobId?: string; error?: string }[] }>('/batch/projects/convert', {
        method: 'POST',
        body: JSON.stringify({ projectIds, targetFormat }),
      }),
    updateTags: (updates: { projectId: string; tags: string[] }[]) =>
      request<{ results: { id: string; updated: boolean }[] }>('/batch/projects/tags', {
        method: 'PATCH',
        body: JSON.stringify({ updates }),
      }),
  },

  wopi: {
    checkStatus: () => request<{ available: boolean; url: string | null; editorUrl: string | null }>('/wopi/status'),
    createSession: (file: Blob, filename: string) => {
      const formData = new FormData();
      formData.append('file', file, filename);
      return request<{ fileId: string; filename: string; accessToken: string }>('/wopi/create', {
        method: 'POST',
        body: formData,
      });
    },
    downloadEdited: async (fileId: string): Promise<Blob> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/wopi/${fileId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      return res.blob();
    },
  },

  ocr: {
    /** Check which OCR engines are available on the worker */
    engines: () => request<{ paddle: boolean; surya: boolean; tesseract: boolean }>('/ocr/engines'),
    /** Process a project with hybrid OCR (server-side PaddleOCR + Surya) */
    processHighAccuracy: (projectId: string, options?: { runTableDetection?: boolean; ocrLang?: string }) =>
      request<Job>(`/projects/${projectId}/process`, {
        method: 'POST',
        body: JSON.stringify({
          runOcr: true,
          runTableDetection: options?.runTableDetection ?? true,
          ocrLang: options?.ocrLang ?? 'ben+eng',
          useHybridOcr: true,
        }),
      }),
    /** Full document analysis — OCR + layout + KV + classification + quality */
    analyze: (file: File, lang?: string) => {
      const formData = new FormData();
      formData.append('file', file);
      const params = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      return request<{
        summary: {
          totalPages: number;
          documentType: string;
          documentTypeConfidence: number;
          overallQualityScore: number;
          overallGrade: string;
          totalKeyValues: number;
          totalTables: number;
          totalBarcodes: number;
          totalCorrections: number;
          worstPage: { page: number; score: number; grade: string } | null;
          bestPage: { page: number; score: number; grade: string } | null;
        };
        keyValues: Array<{ key: string; value: string; confidence: number; page: number }>;
        tables: Array<{ page: number; bbox: Record<string, unknown>; cells: Record<string, unknown>[] }>;
        barcodes: Array<{ type: string; data: string; page: number }>;
        pageQualities: Array<{ page: number; score: number; grade: string; avgConfidence: number }>;
      }>(`/hybrid-ocr/analyze${params}`, {
        method: 'POST',
        body: formData,
      });
    },
  },
};
