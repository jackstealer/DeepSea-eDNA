export type UserRole = 'admin' | 'scientist' | 'viewer' | 'api_user';

export type OAuthProvider = 'google' | 'github';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  disabled: boolean;
  avatar_url?: string | null;
  providers: OAuthProvider[];
  has_password: boolean;
  created_at: string;
  last_login?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  full_name: string;
  password: string;
}

export interface AuthProvidersResponse {
  password: boolean;
  google: boolean;
  github: boolean;
}

export interface UserUpdateRequest {
  role?: UserRole;
  is_active?: boolean;
}

export interface HealthResponse {
  status: string;
  model_loaded?: boolean;
  database?: string;
}

export interface PredictionHistoryItem {
  id: number;
  sequence_id?: string | null;
  sequence_preview: string;
  sequence_length: number;
  predicted_class: string;
  confidence: number;
  is_novel: boolean;
  source: 'single' | 'batch' | string;
  created_at: string;
}

export interface JobHistoryItem {
  job_id: string;
  filenames: string[];
  status: string;
  progress: number;
  error?: string | null;
  total_sequences?: number | null;
  identified_taxa?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface MyStatsResponse {
  predictions: {
    total: number;
    last_7_days: number;
    novel: number;
    avg_confidence: number | null;
  };
  top_taxa: Array<{ taxon: string; count: number }>;
  recent_predictions: PredictionHistoryItem[];
  jobs: { total: number; recent: JobHistoryItem[] };
  model: { loaded: boolean; version_name: string | null; accuracy: number | null; novelty_threshold: number };
}

export interface ResourceMetric {
  usage_percent?: number;
  count?: number;
  total_bytes?: number;
  used_bytes?: number;
  available_bytes?: number;
  free_bytes?: number;
  status?: string;
}

export interface SystemHealthResponse {
  cpu?: ResourceMetric;
  memory?: ResourceMetric;
  disk?: ResourceMetric;
  error?: string;
}

export interface DetailedHealthResponse {
  status: string;
  /** which host resource caused a warning/critical status, e.g. "Disk 92% used" */
  reasons?: string[];
  timestamp?: string;
  components?: {
    api?: { status?: string; uptime?: string };
    system?: SystemHealthResponse;
    model?: { status?: string; loaded?: boolean };
    cache?: { status?: string; backend?: string };
    [key: string]: unknown;
  };
}

export interface ApplicationMetricsResponse {
  status?: string;
  uptime_seconds?: number;
  uptime_human?: string;
  timestamp?: string;
}

export interface DashboardMetricsResponse {
  overview?: {
    status?: string;
    uptime?: string;
    timestamp?: string;
  };
  system?: SystemHealthResponse;
  predictions?: {
    total?: number;
    rate_per_minute?: number;
  };
  requests?: {
    total?: number;
    rate_per_minute?: number;
  };
  errors?: {
    total?: number;
    rate_per_minute?: number;
  };
  cache?: CacheStatsResponse;
  model?: {
    loaded?: boolean;
    status?: string;
  };
}

export interface CacheStatsResponse {
  cache_type?: string;
  backend?: string;
  connected?: boolean;
  total_keys?: number;
  prediction_keys?: number;
  hits?: number;
  misses?: number;
  hit_rate?: number;
  ttl_seconds?: number;
  note?: string;
  error?: string;
}

export interface CacheClearResponse {
  status: string;
  cleared_keys: number;
  pattern?: string | null;
}

export interface PredictionAlternative {
  class: string;
  confidence: number;
}

export interface PredictResponse {
  predicted_class: string;
  confidence: number;
  alternatives?: PredictionAlternative[];
  probabilities?: Record<string, number>;
  cached?: boolean;
  is_novel?: boolean;
  class_id?: number;
  rank?: string;
  lineage?: string[];
}

export interface BatchPredictionItem {
  sequence_id: string;
  sequence?: string;
  predicted_class: string;
  confidence: number;
  alternatives?: PredictionAlternative[];
  is_novel?: boolean;
  cached?: boolean;
}

export interface BatchPredictResponse {
  total?: number;
  predictions?: BatchPredictionItem[];
  results?: BatchPredictionItem[];
  summary?: {
    richness?: number;
    dominant_taxon?: string;
    taxa_counts?: Record<string, number>;
  };
}

export interface UploadedFileInfo {
  filename: string;
  path: string;
  size: number;
}

export interface UploadResponse {
  message?: string;
  files?: UploadedFileInfo[];
  file_paths?: string[];
  jobId?: string;
  job_id?: string;
}

export interface TaxonomicResultEntry {
  name: string;
  abundance: number;
  confidence: number;
  isNovel?: boolean;
  taxonomicRank?: string;
  lineage?: string[];
}

export interface SequenceClassificationRow {
  sequence_id: string;
  predicted_taxon: string;
  confidence: number;
  abundance?: number;
  is_novel?: boolean;
  rank?: string;
  lineage?: string[];
}

export interface AnalysisJobResults {
  totalSequences?: number;
  identifiedTaxa?: number;
  novelTaxa?: number;
  shannonDiversity?: number;
  simpsonDiversity?: number;
  taxonomicData?: TaxonomicResultEntry[];
  predictions?: SequenceClassificationRow[];
  evenness?: number;
  metadata?: {
    processingTime?: number;
    model?: string;
    clustering?: string;
    timestamp?: string;
  };
}

export interface AnalysisJobResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  progress?: number | null;
  currentStep?: string | null;
  results?: AnalysisJobResults | null;
  error?: string | null;
}

export type ExportFormat = 'json' | 'csv' | 'tsv' | 'biom' | 'fasta';

export interface ServingModelInfo {
  source: 'mlflow' | 'local' | string;
  uri: string;
  name: string;
  alias: string | null;
  version: string;
  run_id: string | null;
  metrics: Record<string, number>;
  tracking_uri?: string;
  loaded_at?: string;
  mlflow_enabled: boolean;
  previous_version?: string;
}

export interface ModelVersion {
  version_id: string;
  version_name: string;
  model_path?: string;
  created_at: string;
  status: 'active' | 'archived' | 'deprecated' | string;
  is_current: boolean;
  description?: string;
  metrics?: Record<string, number>;
  training_info?: Record<string, unknown>;
  tags?: string[];
  checksum?: string;
}

export interface VersionListResponse {
  total: number;
  versions: ModelVersion[];
}

export interface VersionComparisonMetric {
  version_1: number | null;
  version_2: number | null;
  difference: number | null;
  percent_change: number | null;
  improved: boolean | null;
}

export interface VersionComparisonResponse {
  version_1: {
    id: string;
    name: string;
    created_at: string;
    status: string;
    is_current: boolean;
  };
  version_2: {
    id: string;
    name: string;
    created_at: string;
    status: string;
    is_current: boolean;
  };
  metrics_comparison: Record<string, VersionComparisonMetric>;
  summary?: {
    improved_metrics: number;
    degraded_metrics: number;
    unchanged_metrics: number;
    overall: string;
  };
}

export interface VersionHistoryItem {
  version_id: string;
  version_name: string;
  created_at: string;
  status: string;
  is_current: boolean;
  description?: string;
  key_metrics?: Record<string, number>;
  tags?: string[];
}

export interface VersionHistoryResponse {
  total: number;
  history: VersionHistoryItem[];
}

export interface ExperimentVariantSummary {
  name?: string;
  variant_id?: string;
  variant_name?: string;
  version_id: string;
  traffic?: number;
  traffic_percentage?: number;
  predictions?: number;
  prediction_count?: number;
  avg_confidence?: number;
  success_rate?: number;
  error_count?: number;
  confidence_interval?: {
    lower: number;
    upper: number;
  };
}

export interface Experiment {
  experiment_id: string;
  experiment_name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'stopped' | 'cancelled' | string;
  strategy?: string;
  created_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_days?: number | null;
  winner?: string | null;
  variants: ExperimentVariantSummary[];
}

export interface ExperimentsListResponse {
  total: number;
  experiments: Experiment[];
}

export interface ExperimentResultsResponse {
  experiment_id: string;
  experiment_name: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_days?: number | null;
  winner?: string | null;
  variants: ExperimentVariantSummary[];
  statistical_analysis?: {
    message?: string;
    control_samples?: number;
    treatment_samples?: number;
    p_value?: number;
    control?: {
      variant_name: string;
      mean_confidence: number;
      samples: number;
      confidence_interval: [number, number];
    };
    treatment?: {
      variant_name: string;
      mean_confidence: number;
      samples: number;
      confidence_interval: [number, number];
    };
    improvement_percent?: number;
    statistically_significant?: boolean;
    recommendation?: string;
  };
}

export interface UsersListResponse {
  total: number;
  users: User[];
}

export interface RolePermissionMapping {
  role: UserRole | string;
  description: string;
  permissions: string[] | 'all';
}

export interface PermissionsResponse {
  roles: RolePermissionMapping[];
  all_permissions: string[];
}

export interface SecurityStatsResponse {
  total_users: number;
  active_users: number;
  disabled_users: number;
  users_by_role: Record<string, number>;
  revoked_tokens: number;
  roles_available?: string[];
  permissions_available?: string[];
}

export interface ApiErrorInfo {
  status?: number;
  message: string;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'PAYLOAD_TOO_LARGE' | 'VALIDATION' | 'NETWORK' | 'NOT_FOUND' | 'SERVER' | 'UNKNOWN';
  isNetworkError: boolean;
  details?: string;
}
