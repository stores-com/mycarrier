# Changelog

## 0.0.1

- Add MyCarrier API key authentication, freight rate requests, and shipping location queries.
- Add `getShippingLocation(locationId)` to retrieve a saved shipping location by ID.
- Add `getShipmentDetails(id)` to retrieve shipment details by shipment ID or quote reference ID.
- Support client and per-request timeouts and a configurable API base URL.
- Preserve HTTP error status and response bodies using `@stores.com/http-error`.
