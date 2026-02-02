export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-md text-center">
        {/* Icon */}
        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Organizer Access Only</h1>
        <p className="text-gray-500 mb-8 text-sm">
          You are currently logged in with a standard <strong>Attendee</strong> account. 
          This dashboard is restricted to event organizers.
        </p>
        
        <div className="space-y-3">
          {/* Option A: Convert Account (Logout -> Signup) */}
          <a
            href="https://auth.empiriaindia.com/auth/logout?returnTo=https://onboarding.empiriaindia.com"
            className="block w-full bg-black text-white py-3 px-4 rounded-lg font-bold hover:bg-gray-800 transition-colors"
          >
            Create Organizer Account
          </a>
          
          {/* Option B: Go Home */}
          <a
            href="https://empiriaindia.com"
            className="block w-full border border-gray-200 py-3 px-4 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            Go Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
