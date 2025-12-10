export interface CreateUserDto {
  name: string;
  lastName: string;
  email: string;
  cel?: string | null;
  roleId: number;
  subdomain?: string | null;
}

export interface UpdateUserDto {
  name?: string;
  lastName?: string;
  email?: string;
  cel?: string;
  roleId?: number;
  password?: string;       // <- opcional para cambiar clave
}
