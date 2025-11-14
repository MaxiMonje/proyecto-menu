export interface CreateItemDto {
  categoryId: number;
  title: string;
  description?: string | null;
  price: number;
  active?: boolean;
  // ❌ Sin imágenes → se suben con /images/items/:itemId
}

export interface UpdateItemDto {
  title?: string;
  description?: string | null;
  price?: number;
  active?: boolean;
  // ❌ Sin imágenes → se suben con /images/items/:itemId
}
