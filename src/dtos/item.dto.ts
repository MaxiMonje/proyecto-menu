export interface CreateItemDto {
  categoryId: number;
  title: string;
  description?: string | null;
  price?: number | null;
  active?: boolean;
  // ❌ Sin imágenes → se suben con /images/items/:itemId
}

export interface UpdateItemDto {
  categoryId: any;
  title?: string;
  description?: string | null;
  price?: number | null;
  active?: boolean;
  // ❌ Sin imágenes → se suben con /images/items/:itemId
}
