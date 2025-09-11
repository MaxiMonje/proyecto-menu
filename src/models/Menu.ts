import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../utils/databaseService";


export interface MenuAttributes {
id: number;
userId: number;
title: string;
active: boolean;
createdAt?: Date;
updatedAt?: Date;
}


export type MenuCreationAttributes = Optional<MenuAttributes, "id" | "active" | "createdAt" | "updatedAt">;


export class Menu extends Model<MenuAttributes, MenuCreationAttributes> implements MenuAttributes {
public id!: number;
public userId!: number;
public title!: string;
public active!: boolean;
public readonly createdAt!: Date;
public readonly updatedAt!: Date;
}


Menu.init(
{
id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
title: { type: DataTypes.STRING(120), allowNull: false },
active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
},
{ sequelize, tableName: "menus", modelName: "Menu", timestamps: true }
);