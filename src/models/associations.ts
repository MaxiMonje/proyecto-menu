import { User } from "./User";
import { Role } from "./Role";
import { Payment } from "./Payment";   
import { Menu as MenuA } from "./Menu";
import { Category as CategoryA } from "./Category";
import { Image as ImageA } from "./Image";
import { Item as ItemA } from "./Item";

export const setupAssociations = () => {

    // User - Role
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });
  User.belongsTo(Role, { foreignKey: "roleId", as: "role" });

  // User - Payment  
  User.hasMany(Payment, { foreignKey: "userId", as: "payments" });
  Payment.belongsTo(User, { foreignKey: "userId", as: "user" });

  MenuA.hasMany(CategoryA, { foreignKey: "menuId", as: "categories" });
  CategoryA.belongsTo(MenuA, { foreignKey: "menuId", as: "menu" });


  MenuA.hasMany(ImageA, { foreignKey: "menuId", as: "images" });
  ImageA.belongsTo(MenuA, { foreignKey: "menuId", as: "menu" });


  CategoryA.hasMany(ItemA, { foreignKey: "categoryId", as: "items" });
  ItemA.belongsTo(CategoryA, { foreignKey: "categoryId", as: "category" });


  ImageA.hasMany(ItemA, { foreignKey: "imageId", as: "items" });
  ItemA.belongsTo(ImageA, { foreignKey: "imageId", as: "image" });
};