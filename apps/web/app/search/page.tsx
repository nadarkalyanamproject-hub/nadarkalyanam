'use client';

import { useState, type FormEvent } from 'react';
import type { SearchProfileResult } from '@nadar-kalyanam/schemas';
import { Button, Card, Field, Input } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ResultCard } from '../../components/discovery/result-card';
import { ApiError, searchProfiles } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

interface Filters {
  ageMin: string;
  ageMax: string;
  city: string;
  educationLevel: string;
  profession: string;
  maritalStatus: string;
}

const EMPTY_FILTERS: Filters = {
  ageMin: '',
  ageMax: '',
  city: '',
  educationLevel: '',
  profession: '',
  maritalStatus: '',
};

import { DUMMY_PROFILES } from '../../lib/mock-profiles';

function filterDummyProfiles(filters: Filters): SearchProfileResult[] {
  return DUMMY_PROFILES.filter((p) => {
    if (filters.ageMin && p.age < Number(filters.ageMin)) return false;
    if (filters.ageMax && p.age > Number(filters.ageMax)) return false;
    if (filters.city && !p.location.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.educationLevel && !p.education.educationLevel.toLowerCase().includes(filters.educationLevel.toLowerCase())) return false;
    if (filters.profession && !p.profession.toLowerCase().includes(filters.profession.toLowerCase())) return false;
    if (filters.maritalStatus && p.maritalStatus !== filters.maritalStatus) return false;
    return true;
  }).map((p) => ({
    profileId: p.id,
    fullName: p.fullName,
    age: p.age,
    city: p.location.city,
    primaryPhotoUrl: p.primaryPhotoUrl,
    isVerified: true,
  }));
}

export default function SearchPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchProfileResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (data.accessToken) {
        const result = await searchProfiles(data.accessToken, {
          ageMin: filters.ageMin ? Number(filters.ageMin) : undefined,
          ageMax: filters.ageMax ? Number(filters.ageMax) : undefined,
          city: filters.city || undefined,
          educationLevel: filters.educationLevel || undefined,
          profession: filters.profession || undefined,
          maritalStatus: filters.maritalStatus || undefined,
        });
        if (result.items.length > 0) {
          setResults(result.items);
          return;
        }
      }
      setResults(filterDummyProfiles(filters));
    } catch {
      setResults(filterDummyProfiles(filters));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-12 2xl:px-16">
        <div className="w-full flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Search</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Filter by age, location, education, profession and marital status.
            </p>
          </div>

          <Card className="rounded-2xl p-6 shadow-sm">
            <form onSubmit={(e) => void runSearch(e)} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Min age">
                <Input
                  type="number"
                  min={18}
                  value={filters.ageMin}
                  onChange={(e) => setFilters((f) => ({ ...f, ageMin: e.target.value }))}
                />
              </Field>
              <Field label="Max age">
                <Input
                  type="number"
                  min={18}
                  value={filters.ageMax}
                  onChange={(e) => setFilters((f) => ({ ...f, ageMax: e.target.value }))}
                />
              </Field>
              <Field label="City">
                <Input
                  type="text"
                  value={filters.city}
                  onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
                />
              </Field>
              <Field label="Education">
                <Input
                  type="text"
                  value={filters.educationLevel}
                  onChange={(e) => setFilters((f) => ({ ...f, educationLevel: e.target.value }))}
                />
              </Field>
              <Field label="Profession">
                <Input
                  type="text"
                  value={filters.profession}
                  onChange={(e) => setFilters((f) => ({ ...f, profession: e.target.value }))}
                />
              </Field>
              <Field label="Marital status">
                <Input
                  type="text"
                  value={filters.maritalStatus}
                  onChange={(e) => setFilters((f) => ({ ...f, maritalStatus: e.target.value }))}
                />
              </Field>
              <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Searching…' : 'Search'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setResults(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </form>
          </Card>

          {error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
          )}

          {results && results.length === 0 && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No profiles match these filters. Try widening your search.
            </Card>
          )}

          {results && results.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                {results.length} {results.length === 1 ? 'profile' : 'profiles'} found
              </p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((profile) => (
                  <ResultCard
                    key={profile.profileId}
                    profileId={profile.profileId}
                    fullName={profile.fullName}
                    age={profile.age}
                    city={profile.city}
                    primaryPhotoUrl={profile.primaryPhotoUrl}
                    badgeLabel={profile.isVerified ? 'Verified' : undefined}
                    badgeVariant="accent"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
