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

/* ===================== Helpers de subdomain ===================== */

const normalizeSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9-]+/g, "-")    // solo letras/números/guiones
    .replace(/--+/g, "-")            // colapsa guiones
    .replace(/^-+|-+$/g, "");        // sin guiones extremos

const makeBaseSubdomain = (name: string, lastName: string) =>
  normalizeSlug(`${name}-${lastName}`);

const ensureUniqueSubdomain = async (base: string): Promise<string> => {
  let candidate = base || "tenant";
  let n = 1;
  // si existe, probamos con -2, -3, ...
  while (true) {
    const exists = await User.findOne({ where: { subdomain: candidate } });
    if (!exists) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
    if (n > 9999) throw new ApiError("Unable to allocate unique subdomain", 500);
  }
};

/* ========================= Users ========================= */

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
    const tempPassword = "google" + Math.random().toString(36).substring(2, 8);

    // Hash manual (coherente con tu modelo)
    const passwordHash = await argon2.hash(tempPassword);

    // Generar subdomain automático y único
    const base = makeBaseSubdomain(userData.name, userData.lastName);
    const subdomain = await ensureUniqueSubdomain(base);

    const user = await User.create({
      name: userData.name,
      lastName: userData.lastName,
      email: userData.email,
      cel: userData.cel,
      roleId: userData.roleId,
      password: tempPassword, // por si tu modelo tiene setter
      passwordHash,           // cumplir allowNull: false
      active: true,
      subdomain,              // 👈 generado automáticamente
    } as UserCreationAttributes);

    return user;
  } catch (error: any) {
    if (error instanceof UniqueConstraintError || error?.name === "SequelizeUniqueConstraintError") {
      throw new ApiError("Email or subdomain already in use", 409);
    }
    if (error instanceof ValidationError) {
      throw new ApiError(error.errors.map((e) => e.message).join(", "), 400);
    }
    console.error("Error detallado en createGoogleUser:", error);
    throw error;
  }
};

export const createUser = async (data: CreateUserDto) => {
  try {
    // 1) Email único (409 limpio)
    const exists = await User.findOne({ where: { email: data.email } });
    if (exists) throw new ApiError("Email already in use", 409);

    // 2) Password válida
    const pwd = (data.password ?? "").trim();
    if (pwd.length < 8 || pwd.length > 16) {
      throw new ApiError("Password must be between 8 and 16 characters.", 400);
    }

    // 3) Subdomain automático y único a partir de name-lastName
    const base = makeBaseSubdomain(data.name, data.lastName);
    const subdomain = await ensureUniqueSubdomain(base);

    // 4) Hash explícito para cumplir allowNull:false en passwordHash
    const passwordHash = await argon2.hash(pwd);

    // 5) Crear user
    const created = await User.create({
      name: data.name,
      lastName: data.lastName,
      email: data.email,
      cel: data.cel,
      roleId: data.roleId,
      password: pwd,      // si hay setter, se dispara
      passwordHash,       // explícito para evitar null
      active: true,
      subdomain,          // 👈 generado automático
    } as UserCreationAttributes);

    return created;
  } catch (err: any) {
    if (err instanceof UniqueConstraintError || err?.name === "SequelizeUniqueConstraintError") {
      throw new ApiError("Email or subdomain already in use", 409);
    }
    if (err instanceof ValidationError) {
      throw new ApiError(err.errors.map((e) => e.message).join(", "), 400);
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

  // ⚠️ Por estabilidad del tenant NO regeneramos subdomain automáticamente
  // si cambian name/lastName. Si querés permitirlo, lo hacemos con endpoint aparte.

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
      throw new ApiError("Email or subdomain already in use", 409);
    }
    if (err instanceof ValidationError) {
      throw new ApiError(err.errors.map((e) => e.message).join(", "), 400);
    }
    throw err;
  }

  // Si se cambió la password, verifico e invalido tokens pendientes
  if ("password" in data && typeof data.password === "string" && data.password.trim().length >= 8) {
    const fresh = await User.scope("withHash").findByPk(user.id);
    if (!fresh) throw new ApiError("User not found after update", 500);
    const ok = await fresh.validatePassword(data.password.trim());
    if (!ok) throw new ApiError("Password update failed", 500);

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

/* ================= Tokens de reset ================= */

export const requestPasswordReset = async (email: string, resetUrl?: string) => {
  const user = await User.findOne({ where: { email, active: true } });
  if (!user) throw new ApiError("No se encontró una cuenta con este email.", 404);

  // token crudo (para el link) + hash (para DB)
  const rawToken = crypto.randomBytes(32).toString("hex");
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
