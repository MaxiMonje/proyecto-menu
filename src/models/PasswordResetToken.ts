// src/models/PasswordResetToken.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from "../utils/databaseService";
import { User } from './User';

interface PasswordResetTokenAttributes {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  is_used: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface PasswordResetTokenCreationAttributes 
  extends Optional<PasswordResetTokenAttributes, 'id' | 'created_at' | 'updated_at'> {}

class PasswordResetToken extends Model<PasswordResetTokenAttributes, PasswordResetTokenCreationAttributes> 
  implements PasswordResetTokenAttributes {
  
  public id!: number;
  public user_id!: number;
  public token!: string;
  public expires_at!: Date;
  public is_used!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PasswordResetToken.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  tableName: 'password_reset_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Asociaciones
PasswordResetToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
User.hasMany(PasswordResetToken, {
  foreignKey: 'user_id',
  as: 'resetTokens',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

export { PasswordResetToken };