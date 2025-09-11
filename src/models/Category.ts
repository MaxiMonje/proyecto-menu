import { DataTypes as DT3, Model as M3, Optional as Opt3 } from "sequelize";
import sequelize3 from "../utils/databaseService";


export interface CategoryAttributes {
id: number;
menuId: number;
title: string;
active: boolean;
createdAt?: Date;
updatedAt?: Date;
}
export type CategoryCreationAttributes = Opt3<CategoryAttributes, "id" | "active" | "createdAt" | "updatedAt">;


export class Category extends M3<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
public id!: number;
public menuId!: number;
public title!: string;
public active!: boolean;
public readonly createdAt!: Date;
public readonly updatedAt!: Date;
}


Category.init(
{
id: { type: DT3.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
menuId: { type: DT3.INTEGER.UNSIGNED, allowNull: false },
title: { type: DT3.STRING(120), allowNull: false },
active: { type: DT3.BOOLEAN, allowNull: false, defaultValue: true },
},
{ sequelize: sequelize3, tableName: "categories", modelName: "Category", timestamps: true }
);