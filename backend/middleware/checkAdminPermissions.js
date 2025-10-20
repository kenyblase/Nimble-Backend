import Setting from "../models/generalSettingsModel.js";

export const checkAdminPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const adminRole = req.role;

      const adminRolesSetting = await Setting.findOne({ key: "admin_roles" });

      if (!adminRolesSetting) {
        return res.status(500).json({
          success: false,
          message: "Admin roles not configured in settings",
        });
      }

      const roles = adminRolesSetting.value || [];

      // Find the role object for this admin
      const adminRoleObj = roles.find((r) => r.role === adminRole);

      if (!adminRoleObj) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Unknown role '${adminRole}'`,
        });
      }

      // Check if role contains the required permission
      const hasPermission = adminRoleObj.permissions.includes(permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Missing '${permission}' permission`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
};