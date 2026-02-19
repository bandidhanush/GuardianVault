import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 120000, // 2 min for video uploads
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Camera {
    id: string;
    name: string;
    location_name: string;
    latitude?: number;
    longitude?: number;
    rtsp_url?: string;
    is_active: boolean;
    police_name?: string;
    nearby_police_lat?: number;
    nearby_police_lon?: number;
    police_phone?: string;
    hospital_name?: string;
    nearby_hospital_lat?: number;
    nearby_hospital_lon?: number;
    hospital_phone?: string;
    created_at: string;
}

export interface Incident {
    id: string;
    camera_id?: string;
    timestamp: string;
    accident_confidence: number;
    severity_level: number;
    severity_label: string;
    location_lat?: number;
    location_lon?: number;
    location_name?: string;
    alert_sent: boolean;
    alert_sent_at?: string;
    video_clip_path?: string;
    thumbnail_path?: string;
    video_hash_sha256?: string;
    video_hash_md5?: string;
    status: string;
    created_at: string;
}

export interface Evidence {
    id: string;
    incident_id: string;
    original_filename?: string;
    encrypted_filename?: string;
    file_size_bytes?: number;
    duration_seconds?: number;
    sha256_hash?: string;
    md5_hash?: string;
    encryption_algorithm: string;
    created_at: string;
    reviewed_by?: string;
    review_notes?: string;
    is_court_submitted: boolean;
}

export interface DetectionResult {
    incident_id?: string;
    accident_found: boolean;
    confidence: number;
    severity_level?: number;
    severity_label?: string;
    video_hash_sha256?: string;
    video_hash_md5?: string;
    alert_sent: boolean;
    message: string;
}

export interface Stats {
    total: number;
    today: number;
    this_week: number;
    this_month: number;
    severity_distribution: Record<string, number>;
    alert_sent_count: number;
}

// ── Camera API ────────────────────────────────────────────────────────────────

export const cameraApi = {
    list: () => api.get<Camera[]>('/cameras/').then(r => r.data),
    get: (id: string) => api.get<Camera>(`/cameras/${id}`).then(r => r.data),
    create: (data: Partial<Camera>) => api.post<Camera>('/cameras/', data).then(r => r.data),
    update: (id: string, data: Partial<Camera>) => api.put<Camera>(`/cameras/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/cameras/${id}`).then(r => r.data),
    toggle: (id: string) => api.patch(`/cameras/${id}/toggle`).then(r => r.data),
};

// ── Incident API ──────────────────────────────────────────────────────────────

export const incidentApi = {
    list: (params?: { severity?: number; camera_id?: string; status?: string; limit?: number }) =>
        api.get<Incident[]>('/incidents/', { params }).then(r => r.data),
    get: (id: string) => api.get<Incident>(`/incidents/${id}`).then(r => r.data),
    stats: () => api.get<Stats>('/incidents/stats').then(r => r.data),
    updateStatus: (id: string, status: string) =>
        api.patch(`/incidents/${id}/status`, null, { params: { status } }).then(r => r.data),
    delete: (id: string) => api.delete(`/incidents/${id}`).then(r => r.data),
};

// ── Evidence API ──────────────────────────────────────────────────────────────

export const evidenceApi = {
    get: (incidentId: string) => api.get<Evidence>(`/evidence/${incidentId}`).then(r => r.data),
    verify: (incidentId: string) => api.get(`/evidence/${incidentId}/verify`).then(r => r.data),
    streamUrl: (incidentId: string) => `/api/evidence/${incidentId}/stream`,
    certificateUrl: (incidentId: string) => `/api/evidence/${incidentId}/certificate`,
    hashReportUrl: (incidentId: string) => `/api/evidence/${incidentId}/hash-report`,
    thumbnailUrl: (incidentId: string) => `/api/evidence/${incidentId}/thumbnail`,
};

// ── Detection API ─────────────────────────────────────────────────────────────

export const detectionApi = {
    uploadVideo: (
        file: File,
        options?: { camera_id?: string; lat?: number; lon?: number; location_name?: string },
        onProgress?: (pct: number) => void
    ) => {
        const form = new FormData();
        form.append('file', file);
        if (options?.camera_id) form.append('camera_id', options.camera_id);
        if (options?.lat) form.append('lat', String(options.lat));
        if (options?.lon) form.append('lon', String(options.lon));
        if (options?.location_name) form.append('location_name', options.location_name);

        return api.post<DetectionResult>('/detect/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: e => {
                if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
            },
        }).then(r => r.data);
    },
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthApi = {
    check: () => api.get('/health').then(r => r.data),
};

export default api;
