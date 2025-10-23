
export interface MenuColorDto {
  primary: string;   // "#RRGGBB"
  secondary: string; // "#RRGGBB"
}


export interface CreateMenuDto { 
    userId: number; 
    title: string;
    logo?: string;
    backgroundImage?: string;
    color?: MenuColorDto;
    puntosDeVenta?: string;
 }


export interface UpdateMenuDto { 
    title?: string; 
    active?: boolean; 
    logo?: string;
    backgroundImage?: string;
    color?: MenuColorDto;
    puntosDeVenta?: string;
}