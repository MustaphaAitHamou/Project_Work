"use client";
import { useCountryName } from "@/lib/i18n/names";
import { Checkbox } from "@/components/ui/checkbox";

export function CountryCheckboxes({ name, countries, defaultValue = [], legend }: { name: string; countries: readonly string[]; defaultValue?: string[]; legend: string }) {
  const countryName = useCountryName();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {countries.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox name={name} value={c} defaultChecked={defaultValue.includes(c)} />
            {countryName(c)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
