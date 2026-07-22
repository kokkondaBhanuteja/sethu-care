// Rupee <-> paise conversion for the two forms that take an amount from the operator.
//
// Money is paise everywhere else in the console (@sethu/domain mirrors the backend's Money value
// object). A number input cannot sensibly ask for paise, so the conversion happens once, here, at
// the form boundary — never inline in a component and never as float arithmetic on a displayed
// value.

import { paiseToRupees } from "@sethu/domain";

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupeeInput(paise: number): number {
  return Math.round(paiseToRupees(paise) * 100) / 100;
}
