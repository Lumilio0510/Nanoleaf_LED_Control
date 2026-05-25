import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#4B5563',
      light: '#6B7280',
      dark: '#374151',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F4F5F7',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#111827',
      secondary: '#4B5563',
    },
    warning: {
      main: '#F59E0B',
      light: '#FDE68A',
      dark: '#D97706',
    },
    error: {
      main: '#EF4444',
    },
    divider: '#E3E6EC',
  },
  typography: {
    fontFamily: [
      '"PingFang SC"', '"Microsoft YaHei"', '-apple-system', 'BlinkMacSystemFont',
      '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
    ].join(','),
    h5: { fontWeight: 700, fontSize: '1.125rem' },
    h6: { fontWeight: 600, fontSize: '0.875rem' },
    body2: { color: '#4B5563' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(16, 185, 129, 0.15)',
        },
        containedPrimary: {
          '&:hover': { backgroundColor: '#059669' },
          '&:active': { backgroundColor: '#047857' },
        },
        outlinedSecondary: {
          borderColor: '#E3E6EC',
          color: '#4B5563',
          backgroundColor: '#F2F4F7',
          '&:hover': {
            backgroundColor: '#EBEDF2',
            borderColor: '#D1D5DB',
            color: '#111827',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(227, 230, 236, 0.6)',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '1.25rem',
          '&:last-child': { paddingBottom: '1.25rem' },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '1.25rem 1.25rem 0' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#F2F4F7',
            borderRadius: 8,
            fontSize: '0.875rem',
            '& fieldset': { borderColor: '#E3E6EC' },
            '&:hover fieldset': { borderColor: '#D1D5DB' },
            '&.Mui-focused fieldset': {
              borderColor: 'rgba(16, 185, 129, 0.6)',
              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.15)',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#F2F4F7',
          borderRadius: 8,
          fontSize: '0.875rem',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#F2F4F7',
          border: '1px solid #E3E6EC',
          color: '#4B5563',
          fontSize: '0.75rem',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-track': { backgroundColor: '#D1D5DB' },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#10B981',
          '& .MuiSlider-thumb': {
            '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.16)' },
            '&.Mui-active': { boxShadow: '0 0 0 14px rgba(16, 185, 129, 0.16)' },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
  },
})

export default theme
