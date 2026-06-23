import { UserButton } from "@clerk/clerk-react";

/**
 * ClerkUserButton - Shows the signed-in user's avatar and dropdown menu
 * 
 * This component displays:
 * - User avatar (from Clerk profile picture or initials)
 * - Dropdown menu with:
 *   - Manage Account
 *   - Sign Out
 *   - Other Clerk options
 * 
 * Place this in your header/navigation when user is signed in.
 */
export default function ClerkUserButton() {
  return (
    <div className="flex items-center">
      <UserButton 
        afterSignOutUrl="/#/sign-in"
        userProfileUrl="/#/user-profile"
      />
    </div>
  );
}
