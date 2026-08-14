// Permission Categories and their specific permissions
export const PERMISSION_CATEGORIES = {
  users: {
    label: 'Users',
    icon: 'person',
    permissions: {
      'users.view': 'View Users',
      'users.add': 'Add Users',
      'users.edit': 'Edit Users',
      'users.delete': 'Delete Users',
    }
  },
  roles: {
    label: 'Roles & Permissions',
    icon: 'security',
    permissions: {
      'roles.view': 'View Roles',
      'roles.add': 'Add Roles',
      'roles.edit': 'Edit Roles',
      'roles.delete': 'Delete Roles',
      'roles.assign': 'Assign Roles to Users',
    }
  },
  customers: {
    label: 'Customers',
    icon: 'people',
    permissions: {
      'customers.view': 'View Customers',
      'customers.add': 'Add Customers',
      'customers.edit': 'Edit Customers',
      'customers.delete': 'Delete Customers',
    }
  },
  customer_groups: {
    label: 'Customer Groups',
    icon: 'group',
    permissions: {
      'customer_groups.view': 'View Customer Groups',
      'customer_groups.add': 'Add Customer Groups',
      'customer_groups.edit': 'Edit Customer Groups',
      'customer_groups.delete': 'Delete Customer Groups',
    }
  },
  price_lists: {
    label: 'Price Lists',
    icon: 'price_change',
    permissions: {
      'price_lists.view': 'View Price Lists',
      'price_lists.add': 'Add Price Lists',
      'price_lists.edit': 'Edit Price Lists',
      'price_lists.delete': 'Delete Price Lists',
    }
  },
  balance: {
    label: 'Balance',
    icon: 'account_balance',
    permissions: {
      'balance.view': 'View Balance',
      'balance.add': 'Add Balance',
      'balance.edit': 'Edit Balance',
      'balance.delete': 'Delete Balance',
    }
  },
  sale_keys: {
    label: 'Sale Keys',
    icon: 'keyboard',
    permissions: {
      'sale_keys.view': 'View Sale Keys',
      'sale_keys.add': 'Add Sale Keys',
      'sale_keys.edit': 'Edit Sale Keys',
      'sale_keys.delete': 'Delete Sale Keys',
    }
  },
  products: {
    label: 'Products',
    icon: 'inventory',
    permissions: {
      'products.view': 'View Products',
      'products.add': 'Add Products',
      'products.edit': 'Edit Products',
      'products.delete': 'Delete Products',
    }
  },
  classification: {
    label: 'Classification',
    icon: 'category',
    permissions: {
      'classification.view': 'View Classification',
      'classification.add': 'Add Classification',
      'classification.edit': 'Edit Classification',
      'classification.delete': 'Delete Classification',
    }
  },
  suppliers: {
    label: 'Suppliers',
    icon: 'business',
    permissions: {
      'suppliers.view': 'View Suppliers',
      'suppliers.add': 'Add Suppliers',
      'suppliers.edit': 'Edit Suppliers',
      'suppliers.delete': 'Delete Suppliers',
    }
  },
  taxes: {
    label: 'Tax Rates',
    icon: 'receipt',
    permissions: {
      'taxes.view': 'View Tax Rates',
      'taxes.add': 'Add Tax Rates',
      'taxes.edit': 'Edit Tax Rates',
      'taxes.delete': 'Delete Tax Rates',
    }
  },
  payment_methods: {
    label: 'Payment Methods',
    icon: 'payment',
    permissions: {
      'payment_methods.view': 'View Payment Methods',
      'payment_methods.add': 'Add Payment Methods',
      'payment_methods.edit': 'Edit Payment Methods',
      'payment_methods.delete': 'Delete Payment Methods',
    }
  },
  promotion_categories: {
    label: 'Promotion Categories',
    icon: 'local_offer',
    permissions: {
      'promotion_categories.view': 'View Promotion Categories',
      'promotion_categories.add': 'Add Promotion Categories',
      'promotion_categories.edit': 'Edit Promotion Categories',
      'promotion_categories.delete': 'Delete Promotion Categories',
    }
  },
  surcharges: {
    label: 'Surcharges',
    icon: 'attach_money',
    permissions: {
      'surcharges.view': 'View Surcharges',
      'surcharges.add': 'Add Surcharges',
      'surcharges.edit': 'Edit Surcharges',
      'surcharges.delete': 'Delete Surcharges',
    }
  },
  register: {
    label: 'Register / Sell Screen',
    icon: 'point_of_sale',
    permissions: {
      'register.view_live_profit': 'View Live Profit',
      'register.discount': 'Discount',
    }
  },
};

export const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES)
  .flatMap(category => Object.keys(category.permissions));

export const getPermissionLabel = (permission) => {
  for (const category of Object.values(PERMISSION_CATEGORIES)) {
    if (category.permissions[permission]) {
      return category.permissions[permission];
    }
  }
  return permission;
};

export const getPermissionCategory = (permission) => {
  return Object.keys(PERMISSION_CATEGORIES).find(categoryKey => 
    PERMISSION_CATEGORIES[categoryKey].permissions[permission]
  );
};
