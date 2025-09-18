import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../utils/databaseService";
import argon2 from "argon2";
import { attachDbLengthValidator } from "../utils/lengthValidator";

export interface UserAttributes {
  id: number;
  name: string;
  lastName: string;
  email: string;
  cel: string;
  roleId: number;
  active: boolean;
  passwordHash: string;
  password?: string; // virtual: viene en requests/seeders, no se persiste
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes
  extends Optional<UserAttributes, "id" | "active" | "createdAt" | "updatedAt" | "passwordHash"> {
  password: string; // requerido para crear
}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public name!: string;
  public lastName!: string;
  public email!: string;
  public cel!: string;
  public roleId!: number;
  public active!: boolean;
  public passwordHash!: string;
  public password?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  async validatePassword(plain: string) {
    return argon2.verify(this.passwordHash, plain);
  }

  toJSON() {
    const v = { ...this.get() } as any;
    delete v.passwordHash;
    delete v.password;
    return v;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },

    // ÚNICO a nivel BD -> garantiza 409 si colisiona
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // si querés permitir reusar email con soft-delete, ver nota abajo
      validate: { isEmail: true },
    },

    cel: { type: DataTypes.STRING, allowNull: false },
    roleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // Campo virtual para recibir la contraseña (no se guarda)
    password: {
      type: DataTypes.VIRTUAL,
      set(value: string) {
        const trimmed = typeof value === "string" ? value.trim() : value;
        (this as any).setDataValue("password", trimmed);
      },
      validate: { len: [8, 16] },
    },

    // Hash persistido (NOT NULL)
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,

    // ocultamos el hash por default
    defaultScope: { attributes: { exclude: ["passwordHash"] } },
    // y un scope explícito para traer el hash cuando haga falta (auth)
    scopes: {
      withHash: { attributes: { include: ["passwordHash"] } },
    },

    hooks: {
      // punto único de verdad: normaliza email, valida y hashea cuando corresponda
      async beforeSave(user: User) {
        // Normalizar email SIEMPRE
        if (typeof user.email === "string") {
          user.email = user.email.trim().toLowerCase();
        }

        // CREATE: password obligatoria
        if (user.isNewRecord) {
          const pwd = (user.password ?? "").trim();
          if (!pwd) throw new Error("Password is required");
          if (pwd.length < 8 || pwd.length > 16) {
            throw new Error("Password must be between 8 and 16 characters.");
          }
          user.passwordHash = await argon2.hash(pwd);
          return;
        }

        // UPDATE: solo si vino password (y no queda vacía tras TRIM)
        if (typeof user.password === "string") {
          const pwd = user.password.trim();
          if (pwd.length === 0) {
            // Mandaron "" o solo espacios -> NO tocar el hash
            (user as any).password = undefined;
            return;
          }
          if (pwd.length < 8 || pwd.length > 16) {
            throw new Error("Password must be between 8 and 16 characters.");
          }
          user.passwordHash = await argon2.hash(pwd);
        }
      },
    },

    // Si querés permitir reusar un email cuando el usuario anterior quedó inactivo, en vez de `unique: true` arriba:
    // indexes: [
    //   { name: "uniq_users_email_active", unique: true, fields: ["email", "active"] },
    // ],
  }
);

attachDbLengthValidator(User as any, "users");
export default User;
