export interface CreateUserDto {
  name: string;
  lastName: string;
  email: string;
  cel: string;
  roleId: number;
  password: string;        // <- requerido
  subdomain: string;
}

export interface UpdateUserDto {
  name?: string;
  lastName?: string;
  email?: string;
  cel?: string;
  roleId?: number;
  password?: string;       // <- opcional para cambiar clave
}