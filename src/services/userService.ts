import { User, UserCreationAttributes } from "../models/User";
import { CreateUserDto, UpdateUserDto } from "../dtos/user.dto";
import { ApiError } from "../utils/ApiError";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";
import argon2 from "argon2";
import {
  PaginationParams,
  PaginatedResult,
  buildPaginatedResult,
} from "../utils/pagination";
import { sendMail } from "../utils/mailerClient";

export const getAllUsers = async (
  pg: PaginationParams
): Promise<PaginatedResult<User>> => {
  const { limit, offset, order } = pg;

  const { rows, count } = await User.findAndCountAll({
    where: { active: true },
    limit,
    offset,
    order,
    distinct: true, // por si en el futuro agregás include
  });

  return buildPaginatedResult(rows, count, pg);
};

export const getUserById = async (id: number) => {
  const user = await User.findOne({ where: { id, active: true } });
  if (!user) throw new ApiError("User not found", 404);
  return user;
};

export const createGoogleUser = async (userData: {
  name: string;
  lastName: string;
  email: string;
  cel: string;
  roleId: number;
}) => {
  try {
    const tempPassword = 'google' + Math.random().toString(36).substring(2, 8);
    
    // Generar el hash manualmente (igual que haría el hook)
    const passwordHash = await argon2.hash(tempPassword);
    
    console.log('Intentando crear usuario con datos:', {
      ...userData,
      password: tempPassword,
      passwordHash: '[HASH_GENERADO]',
      passwordLength: tempPassword.length
    });
    
    // Enviar tanto password como passwordHash, igual que en Postman
    const user = await User.create({
      name: userData.name,
      lastName: userData.lastName,
      email: userData.email,
      cel: userData.cel,
      roleId: userData.roleId,
      password: tempPassword,
      passwordHash: passwordHash, // Agregar el hash explícitamente
      active: true,
    });
    
    console.log('Usuario creado exitosamente:', user.email);
    return user;
  } catch (error) {
    console.error('Error detallado en createGoogleUser:', error);
    throw error;
  }
};

export const createUser = async (data: CreateUserDto) => {
  try {
    // Pre-chequeo para dar un 409 limpio
    const exists = await User.findOne({ where: { email: data.email } });
    if (exists) throw new ApiError("Email already in use", 409);

    const userData: UserCreationAttributes = { ...data, active: true } as UserCreationAttributes;
    const created = await User.create(userData); // hooks -> hashea y setea passwordHash
    return created;
  } catch (err: any) {
    if (err instanceof UniqueConstraintError || err?.name === "SequelizeUniqueConstraintError") {
      // Respaldo por constraint único en DB
      throw new ApiError("Email already in use", 409);
    }
    if (err instanceof ValidationError) {
      throw new ApiError(err.errors.map(e => e.message).join(", "), 400);
    }
    throw err;
  }
};

export const updateUser = async (id: number, data: UpdateUserDto) => {
  const user = await User.unscoped().findOne({ where: { id, active: true } });
  if (!user) throw new ApiError("User not found", 404);

  if (data.email && data.email !== user.email) {
    const taken = await User.findOne({ where: { email: data.email, id: { [Op.ne]: id } } });
    if (taken) throw new ApiError("Email already in use", 409);
  }

  // --- VALIDACIÓN FUERTE DE PASSWORD EN EL SERVICIO ---
  if ("password" in data) {
    // 1) Debe ser string sí o sí
    if (typeof data.password !== "string") {
      throw new ApiError("Password must be a string", 400);
    }
    const pwd = data.password.trim();

    // 2) Debe cumplir 8–16 (rechaza "5" y espacios)
    if (pwd.length < 8 || pwd.length > 16) {
      throw new ApiError("Password must be between 8 and 16 characters.", 400);
    }

    // 3) Seteamos el virtual; el hook beforeSave re-hashea
    user.set("password", pwd);
  }

  user.set({
    name: data.name ?? user.name,
    lastName: data.lastName ?? user.lastName,
    email: data.email ?? user.email,
    cel: data.cel ?? user.cel,
    roleId: data.roleId ?? user.roleId,
  });

  try {
    await user.save(); // dispara beforeSave (modelo)
  } catch (err: any) {
    if (err instanceof UniqueConstraintError || err?.name === "SequelizeUniqueConstraintError") {
      throw new ApiError("Email already in use", 409);
    }
    if (err instanceof ValidationError) {
      throw new ApiError(err.errors.map(e => e.message).join(", "), 400);
    }
    throw err;
  }

  // Integridad: si cambiaste password, verificá contra el hash persistido
  if ("password" in data && typeof data.password === "string" && data.password.trim().length >= 8) {
    const fresh = await User.scope("withHash").findByPk(user.id);
    if (!fresh) throw new ApiError("User not found after update", 500);
    const ok = await fresh.validatePassword(data.password.trim());
    if (!ok) throw new ApiError("Password update failed", 500);
  }

  return await User.findByPk(id); // defaultScope → sin hash
};
export const deleteUser = async (id: number) => {
  const user = await User.findOne({ where: { id, active: true } });
  if (!user) throw new ApiError("User not found", 404);
  await user.update({ active: false });
  return { message: "User disabled successfully" };
};

export const getUserByEmailForAuth = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  return await User.unscoped().findOne({ where: { email: normalized } }); // 👈 sin filtrar active
};


export const requestPasswordReset = async (email: string, resetUrl?: string) => {
  const user = await User.findOne({ where: { email, active: true } });
  if (!user) throw new ApiError("Email not found", 404);

  const subject = "Recuperá tu contraseña";
  const text = resetUrl
    ? `Hola ${user.name}, para resetear tu contraseña abrí este enlace: ${resetUrl}`
    : `Hola ${user.name}, recibimos tu solicitud para resetear la contraseña. Abrí la app y seguí los pasos.`;
  const html = resetUrl
    ? `<p>Hola ${user.name},</p><p>Para resetear tu contraseña hacé clic:</p><p><a href="${resetUrl}" target="_blank" rel="noopener">Resetear contraseña</a></p>`
    : `<p>Hola ${user.name},</p><p>Recibimos tu solicitud para resetear la contraseña. Abrí la app y seguí los pasos.</p>`;

  await sendMail({ to: email, subject, text, html });
  return { message: "Password reset email sent" };
};

export const restorePasswordByEmail = async (email: string, newPassword: string) => {
  const normalized = email.trim().toLowerCase();
  const user = await User.unscoped().findOne({ where: { email: normalized, active: true } });
  if (!user) throw new ApiError("Email not found", 404);

  const pwd = newPassword.trim();
  if (pwd.length < 8 || pwd.length > 16) {
    throw new ApiError("Password must be between 8 and 16 characters.", 400);
  }

  user.set("password", pwd);
  await user.save();              // hook → rehash
  const fresh = await User.scope("withHash").findByPk(user.id);
  if (!fresh) throw new ApiError("User not found after password restore", 500);

  const ok = await fresh.validatePassword(newPassword.trim());
  if (!ok) throw new ApiError("Password update failed", 500);

  return { message: "Password updated successfully" };
};