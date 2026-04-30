'use client';

import { useState, useTransition, useRef } from 'react';
import { updateUserName, updateUserAvatar, updateAccountType } from '@/lib/actions';
import Image from 'next/image';

export default function SettingsClient({
    email,
    isGoogleUser,
    defaultFirstName,
    defaultLastName,
    defaultAvatarUrl,
    defaultAccountType,
}: {
    email: string;
    isGoogleUser: boolean;
    defaultFirstName: string;
    defaultLastName: string;
    defaultAvatarUrl: string | null;
    defaultAccountType: 'for_profit' | 'non_profit';
}) {
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

            {activeTab === 'profile' && (
                <ProfileSection
                    email={email}
                    defaultFirstName={defaultFirstName}
                    defaultLastName={defaultLastName}
                    defaultAvatarUrl={defaultAvatarUrl}
                    defaultAccountType={defaultAccountType}
                />
            )}
            {activeTab === 'security' && <SecuritySection isGoogleUser={isGoogleUser} />}
        </div>
    );
}

// ─── Profile Section ─────────────────────────────────────────────────────────

function ProfileSection({
    email,
    defaultFirstName,
    defaultLastName,
    defaultAvatarUrl,
    defaultAccountType,
}: {
    email: string;
    defaultFirstName: string;
    defaultLastName: string;
    defaultAvatarUrl: string | null;
    defaultAccountType: 'for_profit' | 'non_profit';
}) {
    const [firstName, setFirstName] = useState(defaultFirstName);
    const [lastName, setLastName] = useState(defaultLastName);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(defaultAvatarUrl);
    const [accountType, setAccountType] = useState<'for_profit' | 'non_profit'>(defaultAccountType);
    const [accountTypeStatus, setAccountTypeStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [accountTypeError, setAccountTypeError] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');
    const [avatarStatus, setAvatarStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
    const [avatarError, setAvatarError] = useState('');
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAccountTypeChange = (type: 'for_profit' | 'non_profit') => {
        setAccountType(type);
        setAccountTypeStatus('saving');
        setAccountTypeError('');
        startTransition(async () => {
            const result = await updateAccountType(type);
            if (result.success) {
                setAccountTypeStatus('saved');
                setTimeout(() => setAccountTypeStatus('idle'), 2500);
            } else {
                setAccountTypeStatus('error');
                setAccountTypeError(result.error);
            }
        });
    };

    const handleSave = () => {
        startTransition(async () => {
            setSaveStatus('saving');
            setSaveError('');
            const result = await updateUserName(firstName, lastName);
            if (result.success) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2500);
            } else {
                setSaveStatus('error');
                setSaveError(result.error);
            }
        });
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAvatarStatus('uploading');
        setAvatarError('');

        const fd = new FormData();
        fd.append('avatar', file);

        const result = await updateUserAvatar(fd);
        if (result.success) {
            setAvatarUrl(result.data.avatar_url);
            setAvatarStatus('idle');
        } else {
            setAvatarStatus('error');
            setAvatarError(result.error);
        }

        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAvatar = () => {
        // Just clear locally; you can add a removeUserAvatar action if needed
        setAvatarUrl(null);
    };

    return (
        <div className="space-y-10">
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
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt="Profile photo"
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
                                👤
                            </div>
                        )}
                        {avatarStatus === 'uploading' && (
                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                <span className="text-xs text-gray-500">…</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Profile Photo</p>
                        <div className="flex items-center gap-3 mt-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={avatarStatus === 'uploading'}
                                className="text-sm font-medium text-[#F98C1F] hover:underline disabled:opacity-50"
                            >
                                {avatarStatus === 'uploading' ? 'Uploading…' : 'Update'}
                            </button>
                            {avatarUrl && (
                                <button
                                    onClick={handleRemoveAvatar}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        {avatarError && (
                            <p className="text-xs text-red-500 mt-1">{avatarError}</p>
                        )}
                    </div>
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarChange}
                    />
                </div>

                {/* Account Type */}
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Account Type</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Select your organization type. This may affect tax handling on ticket sales.
                    </p>
                    <div className="space-y-2">
                        <button
                            type="button"
                            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all w-full ${
                                accountType === 'for_profit'
                                    ? 'border-[#F98C1F] bg-[#F98C1F]/5 shadow-sm'
                                    : 'border-gray-200 hover:border-[#F98C1F]/40 hover:bg-gray-50'
                            }`}
                            onClick={() => handleAccountTypeChange('for_profit')}
                        >
                            <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5 ${
                                accountType === 'for_profit' ? 'border-[#F98C1F] bg-[#F98C1F]' : 'border-gray-300'
                            }`}>
                                {accountType === 'for_profit' && (
                                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <div className="font-medium text-sm text-gray-800">For-Profit Organization</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    Standard organization. You may charge sales tax on ticket prices.
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all w-full ${
                                accountType === 'non_profit'
                                    ? 'border-[#F98C1F] bg-[#F98C1F]/5 shadow-sm'
                                    : 'border-gray-200 hover:border-[#F98C1F]/40 hover:bg-gray-50'
                            }`}
                            onClick={() => handleAccountTypeChange('non_profit')}
                        >
                            <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5 ${
                                accountType === 'non_profit' ? 'border-[#F98C1F] bg-[#F98C1F]' : 'border-gray-300'
                            }`}>
                                {accountType === 'non_profit' && (
                                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <div className="font-medium text-sm text-gray-800">Non-Profit Organization</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    Registered non-profit. You may be exempt from charging sales tax on tickets.
                                </div>
                            </div>
                        </button>
                    </div>
                    {accountTypeStatus === 'saving' && (
                        <p className="text-xs text-gray-400 mt-2">Saving...</p>
                    )}
                    {accountTypeStatus === 'saved' && (
                        <p className="text-xs text-green-600 mt-2">Account type updated</p>
                    )}
                    {accountTypeError && (
                        <p className="text-xs text-red-500 mt-2">{accountTypeError}</p>
                    )}
                </div>

                {/* Fields */}
                <div className="space-y-6">
                    {/* First + Last Name */}
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">
                                FIRST NAME
                            </p>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="First name"
                                className="w-full text-sm text-gray-800 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-[#F98C1F] placeholder:text-gray-300 transition-colors"
                            />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">
                                LAST NAME
                            </p>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Last name"
                                className="w-full text-sm text-gray-800 bg-transparent border-b border-gray-200 pb-2 focus:outline-none focus:border-[#F98C1F] placeholder:text-gray-300 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Email — read-only */}
                    <div>
                        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">
                            EMAIL ADDRESS
                        </p>
                        <p className="text-sm text-gray-500 border-b border-gray-200 pb-2">
                            {email}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1.5">
                            Email cannot be changed here. Contact support if needed.
                        </p>
                    </div>
                </div>

                {saveError && (
                    <p className="mt-4 text-sm text-red-500">{saveError}</p>
                )}

                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
                    {saveStatus === 'saved' && (
                        <span className="text-sm text-green-600 font-medium">✓ Changes saved</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="bg-[#F98C1F] text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#e07b10] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </section>
        </div>
    );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection({ isGoogleUser }: { isGoogleUser: boolean }) {
    return (
        <div className="space-y-10">
            <section>
                <h2 className="text-xl font-bold text-gray-900">Security</h2>
                <p className="text-sm text-gray-500 mt-0.5 mb-8">Manage your password and security settings.</p>

                {isGoogleUser ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5">
                        <p className="text-sm font-medium text-gray-700">Password change not available</p>
                        <p className="text-sm text-gray-500 mt-1">
                            Your account uses Google Sign-In. Password management is handled through your Google account.
                        </p>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
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
