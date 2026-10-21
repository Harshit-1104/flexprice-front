import { Pagination, WindowSize } from '@/models';
import { TypedBackendFilter, TypedBackendSort } from '../formatters/QueryBuilder';

// Dashboard Session Response
export interface DashboardSessionResponse {
	url: string;
	token: string;
	expires_at: string; // ISO 8601 timestamp
}

// Dashboard Paginated Request
export interface DashboardPaginatedRequest extends Pagination {
	filters?: TypedBackendFilter[];
	sort?: TypedBackendSort[];
	expand?: string;
}

// Get Customer Usage Summary Request (for dashboard)
export interface GetCustomerUsageSummaryRequest {
	feature_id?: string;
	start_time?: string;
	end_time?: string;
	limit?: number;
	offset?: number;
}

// Dashboard Analytics Request (similar to GetUsageAnalyticsRequest but for authenticated customer)
export interface DashboardAnalyticsRequest {
	feature_ids?: string[];
	sources?: string[];
	start_time?: string;
	end_time?: string;
	group_by?: string[]; // allowed values: "source", "feature_id", "properties.<field_name>"
	window_size?: WindowSize;
	expand?: string[]; // allowed values: "price", "meter", "feature", "subscription_line_item","plan","addon"
	property_filters?: Record<string, string[]>;
	/** Forwarded when portal API supports subscription-hierarchy aggregation. */
	include_children?: boolean;
}

// Dashboard Cost Analytics Request (similar to GetCostAnalyticsRequest but for authenticated customer)
export interface DashboardCostAnalyticsRequest {
	// Time range fields (optional - defaults to last 7 days if not provided)
	start_time?: string;
	end_time?: string;

	// Additional filters
	feature_ids?: string[];

	// Expand options - specify which entities to expand
	expand?: string[]; // "meter", "price"

	// Pagination
	limit?: number;
	offset?: number;
	property_filters?: Record<string, string[]>;
}

// Portal property lookups: the keys portal users may group or filter by, and one key's values.
export interface PortalPropertyKeysRequest {
	start_time: string;
	end_time: string;
	feature_ids?: string[];
}

export interface PortalPropertyValuesRequest extends PortalPropertyKeysRequest {
	key: string;
	prefix?: string;
	limit?: number; // 1–200, default 50
}

export interface PropertyValuesResponse {
	values: string[];
}
