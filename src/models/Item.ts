import { DataTypes as DT4, Model as M4, Optional as Opt4 } from "sequelize";
import sequelize4 from "../utils/databaseService";


export interface ItemAttributes {
id: number;
categoryId: number; // (categoriaId)
imageId: number | null; // (imagesid)
title: string;
description: string | null;
price: number; // store as DECIMAL(10,2)
active: boolean;
createdAt?: Date;
updatedAt?: Date;
}
export type ItemCreationAttributes = Opt4<ItemAttributes, "id" | "imageId" | "description" | "active" | "createdAt" | "updatedAt">;


export class Item extends M4<ItemAttributes, ItemCreationAttributes> implements ItemAttributes {
public id!: number;
public categoryId!: number;
public imageId!: number | null;
public title!: string;
public description!: string | null;
public price!: number;
public active!: boolean;
public readonly createdAt!: Date;
public readonly updatedAt!: Date;
}


Item.init(
{
id: { type: DT4.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
categoryId: { field: "categoryId", type: DT4.INTEGER.UNSIGNED, allowNull: false },
imageId: { field: "imageId", type: DT4.INTEGER.UNSIGNED, allowNull: true },
title: { type: DT4.STRING(160), allowNull: false },
description: { type: DT4.TEXT, allowNull: true },
price: { type: DT4.DECIMAL(10, 2), allowNull: false },
active: { type: DT4.BOOLEAN, allowNull: false, defaultValue: true },
},
{ sequelize: sequelize4, tableName: "items", modelName: "Item", timestamps: true }
);