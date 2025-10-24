
export interface MenuColorDto {
  primary: string;   // "#RRGGBB"
  secondary: string; // "#RRGGBB"
}


export interface CreateMenuDto { 
    title: string;
    logo?: string;
    backgroundImage?: string;
    color?: MenuColorDto;
    pos?: string;
 }


export interface UpdateMenuDto { 
    title?: string; 
    active?: boolean; 
    logo?: string;
    backgroundImage?: string;
    color?: MenuColorDto;
    pos?: string;
}