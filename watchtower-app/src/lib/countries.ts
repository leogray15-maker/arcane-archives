// Country names and polygons for the client (Natural Earth via world-atlas, public domain).
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import type { Feature, Geometry } from 'geojson';

countries.registerLocale(en);

export const countryName = (iso3: string | null | undefined): string =>
  iso3 ? (countries.getName(iso3, 'en', { select: 'alias' }) ?? countries.getName(iso3, 'en') ?? iso3) : '';

export function allCountries(): { iso3: string; name: string }[] {
  const names = countries.getNames('en', { select: 'alias' });
  return Object.entries(names).map(([a2, name]) => ({ iso3: countries.alpha2ToAlpha3(a2) ?? a2, name }));
}

export type CountryFeature = Feature<Geometry, { iso3: string; name: string }>;

let cache: Promise<CountryFeature[]> | null = null;

/** Lazily loads 110m country polygons (~110KB) keyed by ISO3. */
export function loadCountryShapes(): Promise<CountryFeature[]> {
  return (cache ??= (async () => {
    const [{ feature }, topo] = await Promise.all([import('topojson-client'), import('world-atlas/countries-110m.json')]);
    const t = (topo as any).default ?? topo;
    const fc = feature(t, t.objects.countries) as unknown as { features: Feature<Geometry, { name: string }>[] };
    return fc.features
      .map((f) => {
        const iso3 = countries.numericToAlpha3(String(f.id).padStart(3, '0')) ?? (f.properties.name === 'Kosovo' ? 'XKX' : '');
        return { ...f, properties: { iso3, name: f.properties.name } } as CountryFeature;
      })
      .filter((f) => f.properties.iso3);
  })());
}
