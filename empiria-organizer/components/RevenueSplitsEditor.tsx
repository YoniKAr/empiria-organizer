'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Users } from 'lucide-react';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Label } from '@/components/label';
import { Separator } from '@/components/separator';
import { cn } from '@/lib/utils';

interface Split {
  id: string;
  recipientUserId: string;
  recipientStripeId: string;
  recipientName: string;
  recipientEmail: string;
  percentage: number;
  description: string;
}

interface RevenueSplitsEditorProps {
  splits: Split[];
  onSplitsChange: (splits: Split[]) => void;
  primaryOrganizerName: string;
  primaryOrganizerPercentage: number;
}

interface OrganizerResult {
  id: string;
  auth0_id: string;
  full_name: string;
  email: string;
  stripe_account_id: string;
  organizer_code: string | null;
}

export function RevenueSplitsEditor({
  splits,
  onSplitsChange,
  primaryOrganizerName,
  primaryOrganizerPercentage,
}: RevenueSplitsEditorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrganizerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const totalSplitPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
  const isValid = splits.length === 0 || totalSplitPercentage + primaryOrganizerPercentage === 100;

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search-organizers?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        // Filter out organizers already added
        const existingIds = new Set(splits.map((s) => s.recipientUserId));
        setResults((data.results || []).filter((r: OrganizerResult) => !existingIds.has(r.id)));
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, splits]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function addOrganizer(org: OrganizerResult) {
    const newSplit: Split = {
      id: crypto.randomUUID(),
      recipientUserId: org.id,
      recipientStripeId: org.stripe_account_id,
      recipientName: org.full_name || org.email,
      recipientEmail: org.email,
      percentage: 0,
      description: '',
    };
    onSplitsChange([...splits, newSplit]);
    setQuery('');
    setShowDropdown(false);
  }

  function removeSplit(splitId: string) {
    onSplitsChange(splits.filter((s) => s.id !== splitId));
  }

  function updateSplitPercentage(splitId: string, percentage: number) {
    onSplitsChange(
      splits.map((s) => (s.id === splitId ? { ...s, percentage } : s))
    );
  }

  function updateSplitDescription(splitId: string, description: string) {
    onSplitsChange(
      splits.map((s) => (s.id === splitId ? { ...s, description } : s))
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-foreground mb-1 block">
          Revenue Splits
        </Label>
        <p className="text-xs text-muted-foreground mb-3">
          Optionally split ticket revenue with co-organizers. Each must have a connected Stripe account.
        </p>
      </div>

      {/* Primary organizer row */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="size-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {primaryOrganizerName || 'You (Primary Organizer)'}
              </p>
              <p className="text-xs text-muted-foreground">Primary organizer</p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                isValid ? 'text-foreground' : 'text-destructive'
              )}
            >
              {primaryOrganizerPercentage}%
            </span>
            <p className="text-[10px] text-muted-foreground">auto-calculated</p>
          </div>
        </div>
      </div>

      {/* Added co-organizer splits */}
      {splits.map((split) => (
        <div
          key={split.id}
          className="rounded-lg border border-border p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {split.recipientName}
              </p>
              <p className="text-xs text-muted-foreground">
                {split.recipientEmail}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeSplit(split.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">
                Percentage
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={split.percentage || ''}
                  onChange={(e) =>
                    updateSplitPercentage(
                      split.id,
                      Math.max(0, Math.min(100, Number(e.target.value) || 0))
                    )
                  }
                  className="h-8 w-20 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex-[2]">
              <Label className="text-xs text-muted-foreground">
                Description (optional)
              </Label>
              <Input
                type="text"
                value={split.description}
                onChange={(e) =>
                  updateSplitDescription(split.id, e.target.value)
                }
                placeholder="e.g. Co-organizer fee"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Search to add co-organizer */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search co-organizer by name, email, or organizer code..."
            className="h-9 pl-8 text-sm"
          />
          {searching && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            <div className="max-h-48 overflow-y-auto py-1">
              {results.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => addOrganizer(org)}
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {org.full_name || 'No name'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {org.email}
                      {org.organizer_code && (
                        <span className="ml-1.5 text-[10px] font-mono bg-muted px-1 py-0.5 rounded">
                          {org.organizer_code}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-3 shadow-lg">
            <p className="text-xs text-muted-foreground text-center">
              No organizers found matching &quot;{query}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Validation message */}
      {splits.length > 0 && !isValid && (
        <p className="text-xs font-medium text-destructive">
          Percentages must total 100%. Currently: {totalSplitPercentage + primaryOrganizerPercentage}%
        </p>
      )}
    </div>
  );
}
