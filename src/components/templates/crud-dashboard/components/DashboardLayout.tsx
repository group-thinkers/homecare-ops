// src/components/templates/crud-dashboard/components/DashboardLayout.tsx
'use client';
import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import SitemarkIcon from './SitemarkIcon';
import type { NavigationItem } from '../navigation';
import type { OrgRole } from '@/types';

export interface DashboardLayoutProps {
  navigation: NavigationItem[];
  roles: OrgRole[];
  title?: string;
  children: React.ReactNode;
}

export default function DashboardLayout({
  navigation,
  roles,
  title = '',
  children,
}: DashboardLayoutProps) {
  const theme = useTheme();

  const [isDesktopNavigationExpanded, setIsDesktopNavigationExpanded] = React.useState(true);
  const [isMobileNavigationExpanded, setIsMobileNavigationExpanded] = React.useState(false);

  const isOverMdViewport = useMediaQuery(theme.breakpoints.up('md'));

  const isNavigationExpanded = isOverMdViewport
    ? isDesktopNavigationExpanded
    : isMobileNavigationExpanded;

  const setIsNavigationExpanded = React.useCallback(
    (newExpanded: boolean) => {
      if (isOverMdViewport) {
        setIsDesktopNavigationExpanded(newExpanded);
      } else {
        setIsMobileNavigationExpanded(newExpanded);
      }
    },
    [isOverMdViewport],
  );

  const handleToggleHeaderMenu = React.useCallback(
    (isExpanded: boolean) => setIsNavigationExpanded(isExpanded),
    [setIsNavigationExpanded],
  );

  const [layoutEl, setLayoutEl] = React.useState<HTMLDivElement | null>(null);

  return (
    <Box
      ref={setLayoutEl}
      sx={{ position: 'relative', display: 'flex', overflow: 'hidden', height: '100%', width: '100%' }}
    >
      <DashboardHeader
        logo={<SitemarkIcon />}
        title={title}
        roles={roles}
        menuOpen={isNavigationExpanded}
        onToggleMenu={handleToggleHeaderMenu}
      />
      <DashboardSidebar
        navigation={navigation}
        expanded={isNavigationExpanded}
        setExpanded={setIsNavigationExpanded}
        container={layoutEl ?? undefined}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Toolbar sx={{ displayPrint: 'none' }} />
        <Box component="main" sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}