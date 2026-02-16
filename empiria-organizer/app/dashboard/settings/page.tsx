export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Organizer Settings</h1>
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="font-medium mb-4">Organization Details</h3>
        <div className="space-y-4">
            <input className="w-full border p-2 rounded-md" placeholder="Organization Name" />
            <input className="w-full border p-2 rounded-md" placeholder="Support Email" />
            <button className="bg-black text-white px-4 py-2 rounded-lg text-sm">Update Profile</button>
        </div>
      </div>
    </div>
  );
}
