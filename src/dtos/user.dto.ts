export interface CreateUserDto {
  name: string;
  lastName: string;
  email: string;
  cel: string;
  roleId: number;
  password: string;        // <- requerido
}

export interface UpdateUserDto {
  name?: string;
  lastName?: string;
  email?: string;
  cel?: string;
  roleId?: number;
  password?: string;       // <- opcional para cambiar clave
}