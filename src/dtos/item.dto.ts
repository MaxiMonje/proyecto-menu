export interface ItemImageInput {
  id?: number;          // para update
  url: string;
  alt?: string | null;
  sortOrder?: number;
  active?: boolean;
  _delete?: boolean;    // para borrar en update
}

export interface CreateItemDto {
  categoryId: number;
  title: string;
  description?: string | null;
  price: number;
  active?: boolean;
  images?: ItemImageInput[]; // NUEVO
}

export interface UpdateItemDto {
  title?: string;
  description?: string | null;
  price?: number;
  active?: boolean;
  images?: ItemImageInput[]; // NUEVO
}
