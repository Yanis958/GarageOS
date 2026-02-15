/**
 * Types pour l'API de génération de messages clients (SMS / Email).
 */

export type ClientMessageTemplate =
  | "relance_j2"
  | "relance_j7"
  | "demande_accord"
  | "vehicule_pret"
  | "demande_infos";

export type ClientMessageRequest = {
  template: ClientMessageTemplate;
  clientName: string;
  vehicleLabel?: string;
  quoteRef?: string;
  totalTtc?: number;
  validUntil?: string | null;
};

export type ClientMessageResponse = {
  subject: string;
  body: string;
  sms: string;
};
