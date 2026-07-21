// Branded identifier types. A plain string can't be passed where a BookingId is expected, so a
// UserId and a BookingId never get mixed up across module boundaries — even though both are UUIDs
// at runtime. The brand exists only at compile time; there is zero runtime cost.

declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

export type UserId = Brand<string, "UserId">;
export type BookingId = Brand<string, "BookingId">;
export type OrderId = Brand<string, "OrderId">;
export type TechnicianId = Brand<string, "TechnicianId">;
export type AddressId = Brand<string, "AddressId">;
export type ServiceId = Brand<string, "ServiceId">;
export type VariantId = Brand<string, "VariantId">;
export type PaymentReference = Brand<string, "PaymentReference">;

/** Cast a raw string from the API boundary into a branded id. Unsafe by design — call it once,
 *  at the edge where the value enters the app, then the type system carries the guarantee. */
export function brandId<TBrand extends string>(raw: string): Brand<string, TBrand> {
  return raw as Brand<string, TBrand>;
}
