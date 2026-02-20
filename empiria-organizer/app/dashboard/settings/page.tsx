export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-[#e07b10]">Organizer Settings</h1>
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="font-medium mb-4 text-[#e07b10]">Organization Details</h3>
        <div className="space-y-4">
          <input className="w-full border p-2 rounded-md placeholder:text-gray-400" placeholder="Organization Name" />
          <input className="w-full border p-2 rounded-md placeholder:text-gray-400" placeholder="Support Email" />
          <button className="bg-[#e07b10] text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-[#c96d0e] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0">Update Profile</button>
        </div>
      </div>
    </div>
  );
}
