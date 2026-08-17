import type { GlobalThemeOverrides } from 'naive-ui';

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    // M12 U2: forge amber / copper-orange brand primary (design doc A11)
    primaryColor: '#ea580cFF',
    primaryColorHover: '#F97316FF',
    primaryColorPressed: '#C2410CFF',
    primaryColorSuppl: '#F97316FF',
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: { color: '#f1f5f9' },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px' },
    },
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    // M12 U2: forge amber / copper-orange brand primary (design doc A11)
    primaryColor: '#F97316FF',
    primaryColorHover: '#FB923CFF',
    primaryColorPressed: '#EA580CFF',
    primaryColorSuppl: '#FB923CFF',
  },

  Notification: {
    color: '#333333',
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px', color: '#1e1e1e' },
    },
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    color: '#1c1c1c',
    siderColor: '#232323',
    siderBorderColor: 'transparent',
  },

  Card: {
    color: '#232323',
    borderColor: '#282828',
  },

  Table: {
    tdColor: '#232323',
    thColor: '#353535',
  },
};
