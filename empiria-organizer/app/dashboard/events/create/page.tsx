export default function CreateEvent() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Event</h1>
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-sm mb-6">This will be a multi-step form connecting to Supabase.</p>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                <input className="w-full border p-2 rounded-md" placeholder="e.g. Summer Music Festival" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <input type="datetime-local" className="w-full border p-2 rounded-md" />
            </div>
            <button className="bg-black text-white px-6 py-2 rounded-lg font-medium mt-4">
                Save Draft
            </button>
        </div>
      </div>
    </div>
  );
}
