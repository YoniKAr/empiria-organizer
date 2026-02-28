'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  return (
    <div className="max-w-3xl">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 mb-8">
        {(['profile', 'security'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-1 pb-3 mr-8 text-sm font-medium capitalize transition-colors ${activeTab === tab
                ? 'text-[#F98C1F]'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab === 'profile' ? 'Profile Details' : 'Security'}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F98C1F] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileSection />}
      {activeTab === 'security' && <SecuritySection />}
    </div>
  );
}

// ─── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection() {
  return (
    <div className="space-y-10">
      {/* Profile Information */}
      <section>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
            <p className="text-sm text-gray-500 mt-0.5">Update your photo and personal details.</p>
          </div>
          <span className="text-xs font-medium text-green-600 border border-green-500 rounded-full px-3 py-1">
            Active
          </span>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mt-6 mb-8">
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
              👤
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Profile Photo</p>
            <div className="flex items-center gap-3 mt-1">
              <button className="text-sm font-medium text-[#F98C1F] hover:underline">Update</button>
              <button className="text-sm text-gray-500 hover:text-gray-700">Remove</button>
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-6">
          {/* First + Last Name */}
          <div className="grid grid-cols-2 gap-8">
            <FieldRow label="FIRST NAME" placeholder="First name" />
            <FieldRow label="LAST NAME" placeholder="Last name" />
          </div>

          {/* Email */}
          <FieldRow label="EMAIL ADDRESS" placeholder="you@example.com" type="email" />

          {/* Phone + Company */}
          <div className="grid grid-cols-2 gap-8">
            <FieldRow label="PHONE NUMBER" placeholder="+1 (555) 000-0000" type="tel" />
            <FieldRow label="COMPANY" placeholder="Your company" />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button className="bg-[#F98C1F] text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#e07b10] transition-colors">
            Save Changes
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-bold text-gray-900">Security</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-8">Manage your password and security settings.</p>

        <div className="space-y-6">
          <FieldRow label="CURRENT PASSWORD" type="password" placeholder="••••••••••••" />
          <FieldRow label="NEW PASSWORD" type="password" placeholder="New password" />
          <FieldRow label="CONFIRM NEW PASSWORD" type="password" placeholder="Confirm new password" />
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
          <button className="bg-[#F98C1F] text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#e07b10] transition-colors">
            Update Password
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  placeholder,
  type = 'text',
}: {
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">
        {label}
      </p>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full text-sm text-gray-800 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-[#F98C1F] placeholder:text-gray-300 transition-colors"
      />
    </div>
  );
}
