// src/components/templates/crud-dashboard/components/DashboardSidebar.tsx
'use client';
import * as React from 'react';
import { useTheme, type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Toolbar from '@mui/material/Toolbar';
import type {} from '@mui/material/themeCssVarsAugmentation';
import { usePathname } from 'next/navigation';
import DashboardSidebarContext from '../context/DashboardSidebarContext';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from '../constants';
import DashboardSidebarPageItem from './DashboardSidebarPageItem';
import DashboardSidebarHeaderItem from './DashboardSidebarHeaderItem';
import DashboardSidebarDividerItem from './DashboardSidebarDividerItem';
import getDrawerSxTransitionMixin from '../mixins';
import type { NavigationItem } from '../navigation';

export interface DashboardSidebarProps {
  navigation: NavigationItem[];
  expanded?: boolean;
  setExpanded: (expanded: boolean) => void;
  disableCollapsibleSidebar?: boolean;
  container?: Element;
}

export default function DashboardSidebar({
  navigation,
  expanded = true,
  setExpanded,
  disableCollapsibleSidebar = false,
  container,
}: DashboardSidebarProps) {
  const theme = useTheme();
  const pathname = usePathname();

  const [expandedItemIds, setExpandedItemIds] = React.useState<string[]>([]);

  const isOverSmViewport = useMediaQuery(theme.breakpoints.up('sm'));
  const isOverMdViewport = useMediaQuery(theme.breakpoints.up('md'));
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldReduceDrawerMotion =
    theme.motion.reducedMotion === 'always' ||
    (theme.motion.reducedMotion === 'system' && prefersReducedMotion);
  const drawerEnteringDuration = shouldReduceDrawerMotion
    ? 0
    : theme.transitions.duration.enteringScreen;
  const drawerLeavingDuration = shouldReduceDrawerMotion
    ? 0
    : theme.transitions.duration.leavingScreen;

  const [isFullyExpanded, setIsFullyExpanded] = React.useState(expanded);
  const [isFullyCollapsed, setIsFullyCollapsed] = React.useState(!expanded);

  React.useEffect(() => {
    if (expanded) {
      if (drawerEnteringDuration === 0) {
        setIsFullyExpanded(true);
        return undefined;
      }
      const t = setTimeout(() => setIsFullyExpanded(true), drawerEnteringDuration);
      return () => clearTimeout(t);
    }
    setIsFullyExpanded(false);
    return undefined;
  }, [drawerEnteringDuration, expanded]);

  React.useEffect(() => {
    if (!expanded) {
      if (drawerLeavingDuration === 0) {
        setIsFullyCollapsed(true);
        return undefined;
      }
      const t = setTimeout(() => setIsFullyCollapsed(true), drawerLeavingDuration);
      return () => clearTimeout(t);
    }
    setIsFullyCollapsed(false);
    return undefined;
  }, [drawerLeavingDuration, expanded]);

  const mini = !disableCollapsibleSidebar && !expanded;

  const handleSetSidebarExpanded = React.useCallback(
    (newExpanded: boolean) => () => setExpanded(newExpanded),
    [setExpanded],
  );

  const handlePageItemClick = React.useCallback(
    (itemId: string, hasNestedNavigation: boolean) => {
      if (hasNestedNavigation && !mini) {
        setExpandedItemIds((prev) =>
          prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
        );
      } else if (!isOverSmViewport && !hasNestedNavigation) {
        setExpanded(false);
      }
    },
    [mini, setExpanded, isOverSmViewport],
  );

  const hasDrawerTransitions =
    isOverSmViewport && (!disableCollapsibleSidebar || isOverMdViewport);

  const renderNavigation = React.useCallback(
    function render(items: NavigationItem[]): React.ReactNode {
      return items.map((item, index) => {
        if (item.kind === 'header') {
          return (
            <DashboardSidebarHeaderItem key={`header-${index}`}>
              {item.title}
            </DashboardSidebarHeaderItem>
          );
        }
        if (item.kind === 'divider') {
          return <DashboardSidebarDividerItem key={`divider-${index}`} />;
        }

        const selected = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <DashboardSidebarPageItem
            key={item.id}
            id={item.id}
            title={item.title}
            icon={item.icon}
            href={item.href}
            prefetch={item.prefetch}
            selected={!!selected}
            defaultExpanded={!!selected}
            expanded={expandedItemIds.includes(item.id)}
            nestedNavigation={
              item.children ? (
                <List dense sx={{ padding: 0, my: 1, pl: mini ? 0 : 1, minWidth: 240 }}>
                  {render(item.children)}
                </List>
              ) : undefined
            }
          />
        );
      });
    },
    [pathname, expandedItemIds, mini],
  );

  const getDrawerContent = React.useCallback(
    (viewport: 'phone' | 'tablet' | 'desktop') => (
      <React.Fragment>
        <Toolbar />
        <Box
          component="nav"
          aria-label={`${viewport.charAt(0).toUpperCase()}${viewport.slice(1)}`}
          sx={[
            {
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'auto',
              scrollbarGutter: mini ? 'stable' : 'auto',
              overflowX: 'hidden',
              pt: !mini ? 0 : 2,
            },
            hasDrawerTransitions
              ? getDrawerSxTransitionMixin(isFullyExpanded, 'padding')
              : null,
          ]}
        >
          <List
            dense
            sx={{ padding: mini ? 0 : 0.5, mb: 4, width: mini ? MINI_DRAWER_WIDTH : 'auto' }}
          >
            {renderNavigation(navigation)}
          </List>
        </Box>
      </React.Fragment>
    ),
    [mini, hasDrawerTransitions, isFullyExpanded, renderNavigation, navigation],
  );

  const getDrawerSharedSx = React.useCallback(
    (isTemporary: boolean) => (drawerTheme: Theme) => {
      const drawerWidth = mini ? MINI_DRAWER_WIDTH : DRAWER_WIDTH;
      const widthTransitionStyles = getDrawerSxTransitionMixin(expanded, 'width')(drawerTheme);

      return {
        displayPrint: 'none',
        width: drawerWidth,
        flexShrink: 0,
        ...widthTransitionStyles,
        overflowX: 'hidden',
        ...(isTemporary ? { position: 'absolute' } : {}),
        [`& .MuiDrawer-paper`]: {
          position: 'absolute',
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundImage: 'none',
          ...widthTransitionStyles,
          overflowX: 'hidden',
        },
      };
    },
    [expanded, mini],
  );

  const sidebarContextValue = React.useMemo(
    () => ({
      onPageItemClick: handlePageItemClick,
      mini,
      fullyExpanded: isFullyExpanded,
      fullyCollapsed: isFullyCollapsed,
      hasDrawerTransitions,
    }),
    [handlePageItemClick, mini, isFullyExpanded, isFullyCollapsed, hasDrawerTransitions],
  );

  return (
    <DashboardSidebarContext.Provider value={sidebarContextValue}>
      <Drawer
        container={container}
        variant="temporary"
        open={expanded}
        onClose={handleSetSidebarExpanded(false)}
        ModalProps={{ keepMounted: true }}
        sx={[
          { display: { xs: 'block', sm: disableCollapsibleSidebar ? 'block' : 'none', md: 'none' } },
          getDrawerSharedSx(true),
        ]}
      >
        {getDrawerContent('phone')}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={[
          { display: { xs: 'none', sm: disableCollapsibleSidebar ? 'none' : 'block', md: 'none' } },
          getDrawerSharedSx(false),
        ]}
      >
        {getDrawerContent('tablet')}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={[{ display: { xs: 'none', md: 'block' } }, getDrawerSharedSx(false)]}
      >
        {getDrawerContent('desktop')}
      </Drawer>
    </DashboardSidebarContext.Provider>
  );
}
