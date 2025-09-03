import { User } from "./User";
import { Role } from "./Role";
import { Payment } from "./Payment";   

export const setupAssociations = () => {

    // User - Role
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });
  User.belongsTo(Role, { foreignKey: "roleId", as: "role" });

  // User - Payment  
  User.hasMany(Payment, { foreignKey: "userId", as: "payments" });
  Payment.belongsTo(User, { foreignKey: "userId", as: "user" });
};