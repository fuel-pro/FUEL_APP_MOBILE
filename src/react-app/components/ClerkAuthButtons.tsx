import { useClerk, useUser } from "@clerk/clerk-react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function ClerkAuthButtons() {
  if (!publishableKey) {
    const { user, logout } = useAuth();
    if (!user) return null;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:inline">{user.name}</span>
        </div>
        <button onClick={logout} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    );
  }
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  if (!isSignedIn) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={user.fullName || "User"} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="hidden sm:inline">{user?.fullName || user?.username}</span>
      </div>
      <button onClick={() => signOut()} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Sign Out</span>
      </button>
    </div>
  );
}
