'use client';

import * as React from 'react';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import CssBaseline from '@mui/material/CssBaseline';
import AccessibleIcon from '@mui/icons-material/Accessible';
import BadgeIcon from '@mui/icons-material/Badge';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';

import DashboardLayout from '@/components/templates/crud-dashboard/components/DashboardLayout';
import NotificationsProvider from '@/components/templates/crud-dashboard/hooks/useNotifications/NotificationsProvider';
import DialogsProvider from '@/components/templates/crud-dashboard/hooks/useDialogs/DialogsProvider';
import type { NavigationItem } from '@/components/templates/crud-dashboard/navigation';
import type { OrgRole } from '@/types';

import AppTheme from '@/components/templates/shared-theme/AppTheme';
import {
  dataGridCustomizations,
  datePickersCustomizations,
  sidebarCustomizations,
  formInputCustomizations,
} from '@/components/templates/crud-dashboard/theme/customizations';

const navigation: NavigationItem[] = [
  { kind: 'header', title: 'Navigation' },
  {
    kind: 'page',
    id: 'link',
    title: 'Home',
    icon: <HomeIcon />,
    href: '/dashboard',
  },
  {
    kind: 'page',
    id: 'patients',
    title: 'Patients',
    icon: <AccessibleIcon />,
    href: '/patients',
  },
  {
    kind: 'page',
    id: 'caregivers',
    title: 'Caregivers',
    icon: <BadgeIcon />,
    href: '/caregivers',
  },
  { kind: 'header', title: 'Settings' },
  {
    kind: 'page',
    id: 'user-settings',
    title: 'Users',
    icon: <PersonIcon />,
    href: '/settings/users',
  },
  {
    kind: 'page',
    id: 'payer-settings',
    title: 'Payers',
    icon: <AccountBalanceIcon />,
    href: '/settings/payers',
  },
  {
    kind: 'page',
    id: 'service-settings',
    title: 'Services',
    icon: <MedicalServicesIcon />,
    href: '/settings/services',
  },
  {
    kind: 'page',
    id: 'logout',
    title: 'Logout',
    icon: <LogoutIcon />,
    href: '/logout',
    prefetch: false,
  },
];

const themeComponents = {
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...sidebarCustomizations,
  ...formInputCustomizations,
};

export default function DashboardFrame({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: OrgRole[];
}) {
  return (
    <AppTheme themeComponents={themeComponents}>
      <CssBaseline enableColorScheme />
      <NotificationsProvider>
        <DialogsProvider>
          <DashboardLayout navigation={navigation} roles={roles}>
            {children}
          </DashboardLayout>
        </DialogsProvider>
      </NotificationsProvider>
    </AppTheme>
  );
}