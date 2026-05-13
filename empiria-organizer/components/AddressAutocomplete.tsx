'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/input';

interface AddressResult {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing address...',
  error = false,
  className = '',
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const dummyDivRef = useRef<HTMLDivElement>(null);

  // Initialize Google Places services
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google?.maps?.places) return;
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    if (dummyDivRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(dummyDivRef.current);
    }
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!autocompleteServiceRef.current || input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        types: ['address'],
        sessionToken: sessionTokenRef.current || undefined,
      },
      (results, status) => {
        setIsLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results as unknown as Prediction[]);
          setIsOpen(true);
        } else {
          setPredictions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 300);
  };

  const handleSelect = (prediction: Prediction) => {
    setIsOpen(false);
    onChange(prediction.description);

    if (!placesServiceRef.current) {
      onSelect({ address: prediction.description, city: '', postalCode: '', country: '' });
      return;
    }

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address'],
        sessionToken: sessionTokenRef.current || undefined,
      },
      (place, status) => {
        // Reset session token after getDetails
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          onSelect({ address: prediction.description, city: '', postalCode: '', country: '' });
          return;
        }

        let city = '';
        let postalCode = '';
        let country = '';

        for (const comp of place.address_components || []) {
          if (comp.types.includes('locality')) {
            city = comp.long_name;
          } else if (comp.types.includes('administrative_area_level_1') && !city) {
            city = comp.long_name;
          }
          if (comp.types.includes('postal_code')) {
            postalCode = comp.long_name;
          }
          if (comp.types.includes('country')) {
            country = comp.short_name;
          }
        }

        const fullAddress = place.formatted_address || prediction.description;
        onChange(fullAddress);
        onSelect({ address: fullAddress, city, postalCode, country });
      }
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div ref={dummyDivRef} style={{ display: 'none' }} />
      <div className="relative">
        <Search className="absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (predictions.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          aria-invalid={error}
          className={`h-11 pl-9 ${className}`}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute top-3.5 right-3 size-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              className="flex items-start gap-2.5 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => handleSelect(p)}
            >
              <MapPin className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {p.structured_formatting.main_text}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.structured_formatting.secondary_text}
                </p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-right border-t">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
