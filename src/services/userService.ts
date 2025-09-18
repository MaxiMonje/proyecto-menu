import { User, UserCreationAttributes } from "../models/User";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { CreateUserDto, UpdateUserDto } from "../dtos/user.dto";
import { ApiError } from "../utils/ApiError";
import { Op, UniqueConstraintError, ValidationError } from "sequelize";
import argon2 from "argon2";
import crypto from "crypto"; 
import {
  PaginationParams,
  PaginatedResult,
  buildPaginatedResult,
} from "../utils/pagination";
import { sendMail } from "../utils/mailerClient";
import sequelize from "../utils/databaseService";

const RESET_TTL_MIN = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? "10", 10);

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

  if ("password" in data) {
    if (typeof data.password !== "string") {
      throw new ApiError("Password must be a string", 400);
    }
    const pwd = data.password.trim();
    if (pwd.length < 8 || pwd.length > 16) {
      throw new ApiError("Password must be between 8 and 16 characters.", 400);
    }
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
    await user.save();
  } catch (err: any) {
    if (err instanceof UniqueConstraintError || err?.name === "SequelizeUniqueConstraintError") {
      throw new ApiError("Email already in use", 409);
    }
    if (err instanceof ValidationError) {
      throw new ApiError(err.errors.map(e => e.message).join(", "), 400);
    }
    throw err;
  }

  // 🔐 Si se cambió la password, verifico y luego INVALIDO tokens pendientes
  if ("password" in data && typeof data.password === "string" && data.password.trim().length >= 8) {
    const fresh = await User.scope("withHash").findByPk(user.id);
    if (!fresh) throw new ApiError("User not found after update", 500);
    const ok = await fresh.validatePassword(data.password.trim());
    if (!ok) throw new ApiError("Password update failed", 500);

    // ⛔️ Invalida TODOS los tokens no usados de este usuario
    await PasswordResetToken.update(
      { is_used: true },
      { where: { user_id: user.id, is_used: false } }
    );
  }

  return await User.findByPk(id);
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

// ===== FUNCIONES MODIFICADAS PARA TOKENS DE RESET =====

export const requestPasswordReset = async (email: string, resetUrl?: string) => {
  const user = await User.findOne({ where: { email, active: true } });
  if (!user) throw new ApiError("No se encontró una cuenta con este email.", 404);

  // token crudo (para el link) + hash (para DB)
  const rawToken  = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000); // ⏳ 10 min

  await sequelize.transaction(async (t) => {
    // invalidar tokens anteriores no usados
    await PasswordResetToken.update(
      { is_used: true },
      { where: { user_id: user.id, is_used: false }, transaction: t }
    );

    // crear nuevo token válido
    await PasswordResetToken.create(
      { user_id: user.id, token: tokenHash, expires_at: expiresAt, is_used: false },
      { transaction: t }
    );
  });

  const completeResetUrl = resetUrl ? `${resetUrl}/${rawToken}` : rawToken;

  const subject = "Recuperá tu contraseña";
  const text = resetUrl
    ? `Hola ${user.name}, para resetear tu contraseña abrí este enlace: ${completeResetUrl}`
    : `Hola ${user.name}, tu código de recuperación es: ${rawToken}`;
  const html = resetUrl
    ? `<p>Hola ${user.name},</p><p>Para resetear tu contraseña hacé clic:</p><p><a href="${completeResetUrl}" target="_blank" rel="noopener">Resetear contraseña</a></p>`
    : `<p>Hola ${user.name},</p><p>Tu código de recuperación es: <strong>${rawToken}</strong></p>`;

  await sendMail({ to: email, subject, text, html });
  return { message: `Enviamos un enlace de recuperación. Caduca en ${RESET_TTL_MIN} minutos.` };
};

export const verifyResetToken = async (token: string): Promise<boolean> => {
  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await PasswordResetToken.findOne({
      where: {
        token: tokenHash,
        is_used: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });
    return !!resetToken;
  } catch (e) {
    console.error("Error verificando token:", e);
    return false;
  }
};

export const resetPasswordWithToken = async (token: string, newPassword: string) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return await sequelize.transaction(async (t) => {
    const resetToken = await PasswordResetToken.findOne({
      where: {
        token: tokenHash,
        is_used: false,
        expires_at: { [Op.gt]: new Date() },
      },
      include: [{ model: User, as: "user" }],
      transaction: t,
      lock: t.LOCK.UPDATE, // evita carreras
    });

    if (!resetToken) throw new ApiError("Token inválido o expirado", 404);

    const pwd = newPassword.trim();
    if (pwd.length < 8 || pwd.length > 16) {
      throw new ApiError("La contraseña debe tener entre 8 y 16 caracteres.", 422);
    }

    // cambiar contraseña
    const user = await User.unscoped().findOne({
      where: { id: resetToken.user_id, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) throw new ApiError("Usuario no encontrado", 404);

    user.set("password", pwd);
    await user.save({ transaction: t });

    // marcar este token como usado e invalidar cualquier otro pendiente
    await PasswordResetToken.update(
      { is_used: true },
      { where: { user_id: user.id, is_used: false }, transaction: t }
    );

    // verificación final
    const fresh = await User.scope("withHash").findByPk(user.id, { transaction: t });
    const ok = await fresh!.validatePassword(pwd);
    if (!ok) throw new ApiError("Error actualizando contraseña", 500);

    return { message: "Contraseña cambiada exitosamente" };
  });
};

