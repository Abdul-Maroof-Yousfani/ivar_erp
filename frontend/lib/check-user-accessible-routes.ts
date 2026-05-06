// Helper to check which routes are accessible to a user based on their permissions
import { routePermissions } from "./route-permissions";

export interface AccessibleRoute {
  route: string;
  requiredPermissions: string[];
  userHasAccess: boolean;
  matchedPermissions: string[];
}

/**
 * Get all routes accessible to a user based on their permissions
 */
export function getAccessibleRoutes(userPermissions: string[]): AccessibleRoute[] {
  const accessibleRoutes: AccessibleRoute[] = [];

  for (const [route, requiredPermissions] of Object.entries(routePermissions)) {
    // If route has no permissions required, it's public
    if (requiredPermissions.length === 0) {
      accessibleRoutes.push({
        route,
        requiredPermissions: [],
        userHasAccess: true,
        matchedPermissions: [],
      });
      continue;
    }

    // Check if user has any of the required permissions
    const matchedPermissions = requiredPermissions.filter(perm => 
      userPermissions.includes(perm)
    );

    accessibleRoutes.push({
      route,
      requiredPermissions,
      userHasAccess: matchedPermissions.length > 0,
      matchedPermissions,
    });
  }

  return accessibleRoutes;
}

/**
 * Get only accessible routes (filtered)
 */
export function getOnlyAccessibleRoutes(userPermissions: string[]): string[] {
  return getAccessibleRoutes(userPermissions)
    .filter(route => route.userHasAccess)
    .map(route => route.route);
}

/**
 * Print accessible routes for debugging
 */
export function printAccessibleRoutes(userPermissions: string[]) {
  console.log("=== USER PERMISSIONS ===");
  console.log(userPermissions);
  console.log("\n=== ACCESSIBLE ROUTES ===");
  
  const routes = getAccessibleRoutes(userPermissions);
  const accessible = routes.filter(r => r.userHasAccess);
  const inaccessible = routes.filter(r => !r.userHasAccess);

  console.log(`\n✅ ACCESSIBLE (${accessible.length} routes):`);
  accessible.forEach(route => {
    console.log(`  ${route.route}`);
    if (route.matchedPermissions.length > 0) {
      console.log(`    Matched: ${route.matchedPermissions.join(", ")}`);
    }
  });

  console.log(`\n❌ INACCESSIBLE (${inaccessible.length} routes):`);
  inaccessible.forEach(route => {
    console.log(`  ${route.route}`);
    console.log(`    Required: ${route.requiredPermissions.join(", ")}`);
  });
}

