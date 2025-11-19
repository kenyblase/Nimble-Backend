export const defaultSettings = {
  payment_methods: [],

  shipping_methods: [],

  admin_roles: [
    { role: "Admin", permissions: [] },
    { role: "Editor", permissions: [] },
    { role: "Moderator", permissions: [] },
  ],
  
  notification_settings: {
    inApp: {
      admin: {
        messages: true,
        disputes: true,
        supportRequest: true,
      },
      user: {
        messages: true,
        transactions: true,
        listing: true,
      },
      security: {
        userAccountChanges: true,
        bugFix: true,
        maintenance: true,
      }
    },
    email: {
      admin: {
        messages: false,
        disputes: false,
        supportRequest: false,
      },
      user: {
        messages: false,
        transactions: false,
        listing: false,
      },
      security: {
        userAccountChanges: false,
        bugFix: false,
        maintenance: false,
      }
    }
  }
};
