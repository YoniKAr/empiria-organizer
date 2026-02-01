export default function DashboardHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Organizer Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Total Revenue</h3>
            <p className="text-2xl font-bold mt-2">₹0.00</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Tickets Sold</h3>
            <p className="text-2xl font-bold mt-2">0</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Active Events</h3>
            <p className="text-2xl font-bold mt-2">0</p>
        </div>
      </div>
    </div>
  );
}
