/**
 * Layout Configuration
 * 
 * Toggle between "top-nav" and "sidebar" layouts
 * 
 * Change LAYOUT_MODE to switch between layouts:
 * - "top-nav": Traditional horizontal navigation bar at the top
 * - "sidebar": Modern left sidebar navigation with collapsible menu
 * 
 * This makes it easy to experiment and switch back if needed.
 */

export type LayoutMode = 'top-nav' | 'sidebar'

export const LAYOUT_CONFIG = {
  mode: 'sidebar' as LayoutMode, // Change to 'top-nav' to use horizontal navigation
  sidebar: {
    defaultCollapsed: false, // Default sidebar state on desktop
    collapsedWidth: '4rem', // Width when collapsed (icons only)
    expandedWidth: '16rem', // Width when expanded (with text)
  },
}
