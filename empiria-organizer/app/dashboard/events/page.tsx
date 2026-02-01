import Link from "next/link";

export default function EventsList() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Events</h1>
        <Link href="/dashboard/events/create" className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Create Event
        </Link>
      </div>
      
      {/* Placeholder for empty state */}
      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-500 mb-4">You haven't created any events yet.</p>
        <Link href="/dashboard/events/create" className="text-orange-600 font-medium hover:underline">
            Create your first event
        </Link>
      </div>
    </div>
  );
}
