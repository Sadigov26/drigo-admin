import type { ReactNode } from 'react';
import type { CarDetail } from './carsApi';
import { StatusBadge } from '../components/StatusBadge';

const numeric = (value: unknown, unit = '', digits = 0) => typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, useGrouping: false }).format(value)}${unit}` : '—';
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : '—';

function label(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()); }
function valueView(value: unknown): ReactNode {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? <ul>{value.map((item, index) => <li key={index}>{valueView(item)}</li>)}</ul> : 'None';
  if (typeof value === 'object') return <dl className="car-nested">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{label(key)}</dt><dd>{valueView(item)}</dd></div>)}</dl>;
  return typeof value === 'number' ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6, useGrouping: false }).format(value) : String(value);
}
export function CarDetails({ car }: { car: CarDetail }) {
  const location = car.location && typeof car.location === 'object' ? car.location as Record<string, unknown> : {};
  const features = Array.isArray(car.carFeatures) ? car.carFeatures.flatMap(item => item && typeof item === 'object' && typeof item.name === 'string' ? [item.name] : []) : [];
  const status = car.activeRentalId != null ? 'Rented' : car.isActive === true ? 'Active' : car.isActive === false ? 'Inactive' : '—';
  const fields: [string, ReactNode][] = [
    ['Plate', text(car.plateNumber)], ['Brand', text(car.brandName)], ['Model', text(car.modelName)], ['Color', text(car.colorName)],
    ['Year', numeric(car.manufactureYear)], ['Fuel type', text(car.fuelTypeName)], ['Max speed', numeric(car.maxSpeed, ' km/h')], ['Status', <StatusBadge status={status} />],
    ['Fuel level', numeric(car.fuelLevel, '%')], ['City', text(location.city)], ['Price', numeric(car.price, ' AED', 2)],
    ['Tariff', car.tariffPackageId == null ? '—' : `#${car.tariffPackageId}`], ['Active rental', car.activeRentalId == null ? '—' : `#${car.activeRentalId}`],
  ];
  const primary = ['plateNumber', 'brandName', 'modelName', 'colorName', 'manufactureYear', 'fuelTypeName', 'maxSpeed', 'isActive', 'activeRentalId', 'location', 'fuelLevel', 'tariffPackageId', 'price', 'carFeatures'];
  return <>
    <dl className="car-details car-primary-details">{fields.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <section className="car-detail-section"><h3>Features</h3><div className="car-feature-list">{features.length ? features.map((name, index) => <span key={`${name}-${index}`}>{name}</span>) : '—'}</div></section>
    <section className="car-detail-section"><h3>Location</h3><p>{numeric(location.latitude, '', 6)}, {numeric(location.longitude, '', 6)}</p><p>{text(location.address)}</p></section>
    <details className="car-extra"><summary>Technical details</summary><dl className="car-details">{Object.entries(car).filter(([key]) => !primary.includes(key)).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{valueView(value)}</dd></div>)}</dl></details>
  </>;
}
