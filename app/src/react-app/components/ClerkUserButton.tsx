import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { LogOut, User } from "lucide-react";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function ClerkUserButton() {
  if (!publishableKey) {
    const { user, logout } = useAuth();
    if (!user) return null;
    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
          <User className="w-5 h-5" />
        </div>
        <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-300 hover:text-white">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center">
      <UserButton afterSignOutUrl="/#/sign-in" userProfileUrl="/#/user-profile" />
    </div>
  );
}
