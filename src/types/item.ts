export interface Item {
  id: string;
  barcode: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  location?: string;
  supplier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemRequest {
  barcode: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  location?: string;
  supplier?: string;
}

export interface UpdateItemRequest {
  barcode?: string;
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  quantity?: number;
  unit?: string;
  location?: string;
  supplier?: string;
}

export interface ItemSearchQuery {
  barcode?: string;
  name?: string;
  category?: string;
  location?: string;
  supplier?: string;
  limit?: number;
  offset?: number;
  page?: number;
  sortBy?: 'name' | 'createdAt' | 'barcode' | 'category';
  sortOrder?: 'asc' | 'desc';
}

export interface ItemsResponse {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
  page?: number;
  totalPages: number;
}